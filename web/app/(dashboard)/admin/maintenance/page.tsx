'use client';

// Admin maintenance toggle at /admin/maintenance.
//
// Hydrates from `GET /api/admin/maintenance` and PATCHes each row to
// `/api/admin/maintenance/:host`. Contract: docs/arena-maintenance-spec.md
// in the competzy-web repo.
//
// Layout (top → bottom):
//   1. Per-site grid: Main group + Competitions Pages group
//   2. Global kill switch banner (the `*` row) — at the BOTTOM, since
//      it's a rare "everything off" escape hatch; admins shouldn't have
//      to scroll past it on every visit to reach the per-site toggles.
//   3. Audit log (last 20 changes)

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Globe,
  Loader2,
  PowerOff,
  ShieldCheck,
  Wrench,
} from 'lucide-react';

import { adminHttp } from '@/lib/api/client';
import { PageHeader } from '@/components/shell/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// ── Friendly labels per host. Keep in sync with the backend's KNOWN_HOSTS. ──
// `group` drives the two-section layout below: 'main' covers the public
// landing + arena portal, 'comp' is the 12 per-competition subdomains.
type SiteGroup = 'main' | 'comp';
const SITES: Array<{ host: string; label: string; group: SiteGroup }> = [
  { host: 'competzy.com',               label: 'Main Landing',           group: 'main' },
  { host: 'arena.competzy.com',         label: 'Main Arena Page',        group: 'main' },
  { host: 'emc.competzy.com',           label: 'EMC',                    group: 'comp' },
  { host: 'komodo.competzy.com',        label: 'KOMODO',                 group: 'comp' },
  { host: 'ispo.competzy.com',          label: 'ISPO',                   group: 'comp' },
  { host: 'osebi.competzy.com',         label: 'OSEBI',                  group: 'comp' },
  { host: 'genius.competzy.com',        label: 'Genius Olympiad',        group: 'comp' },
  { host: 'owlypia.competzy.com',       label: 'Owlypia',                group: 'comp' },
  { host: 'mathchallenge.competzy.com', label: 'Math Challenge Thailand', group: 'comp' },
  { host: 'stemolympiad.competzy.com',  label: 'STEM Olympiad',          group: 'comp' },
  { host: 'nextgen.competzy.com',       label: 'NextGen Olympiad',       group: 'comp' },
  { host: 'youngmaster.competzy.com',   label: 'Young Master Challenge', group: 'comp' },
  { host: 'angkor.competzy.com',        label: 'Angkor Math Competition', group: 'comp' },
  { host: 'igo.competzy.com',           label: 'IGO London',             group: 'comp' },
];

type Mode = 'off' | 'read-only' | 'on';

const MODE_META: Record<Mode, {
  label: string;
  hint: string;
  icon: typeof ShieldCheck;
  badge: string;
  pillClass: string;
}> = {
  off: {
    label: 'Off',
    hint: 'Normal operation.',
    icon: ShieldCheck,
    badge: 'Live',
    pillClass:
      'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-200',
  },
  'read-only': {
    label: 'Read-only',
    hint: 'Page visible. Submissions disabled + return 503.',
    icon: Wrench,
    badge: 'Read-only',
    pillClass:
      'bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-950/60 dark:text-amber-200',
  },
  on: {
    label: 'On',
    hint: 'Full takeover. Only admin bypass cookie holders see the real page.',
    icon: PowerOff,
    badge: 'Maintenance',
    pillClass:
      'bg-rose-100 text-rose-900 hover:bg-rose-200 dark:bg-rose-950/60 dark:text-rose-200',
  },
};

interface MaintenanceRow {
  host: string;
  mode: Mode;
  updated_by: string;
  updated_by_email: string | null;
  updated_by_name: string | null;
  updated_at: string;
}

interface AuditRow {
  id: number;
  action: string;
  resource_id: string | null;
  payload: { body?: { mode?: string } } | null;
  created_at: string;
  actor_name: string | null;
  actor_email: string | null;
}

interface MaintenanceResponse {
  entries: MaintenanceRow[];
  audit: AuditRow[];
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function actorLabel(row: { updated_by_email: string | null; updated_by_name: string | null; updated_by: string }): string {
  if (row.updated_by_email) return row.updated_by_email;
  if (row.updated_by_name)  return row.updated_by_name;
  if (row.updated_by === 'system') return 'system';
  return 'unknown';
}

interface ToggleProps {
  value: Mode;
  onChange: (next: Mode) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

function ModeToggle({ value, onChange, disabled, size = 'md' }: ToggleProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Maintenance mode"
      className={cn(
        'inline-flex rounded-lg border bg-background p-1 shadow-sm',
        size === 'sm' && 'p-0.5',
      )}
    >
      {(Object.keys(MODE_META) as Mode[]).map((m) => {
        const meta = MODE_META[m];
        const Icon = meta.icon;
        const active = value === m;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled || active}
            onClick={() => onChange(m)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md font-medium transition-colors',
              size === 'md' ? 'px-3 py-1.5 text-xs' : 'px-2 py-1 text-[11px]',
              active
                ? meta.pillClass + ' shadow-sm'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              disabled && !active && 'cursor-not-allowed opacity-50',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/75 focus-visible:ring-offset-1',
            )}
            title={meta.hint}
          >
            <Icon className={size === 'md' ? 'size-3.5' : 'size-3'} aria-hidden />
            {meta.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * One per-site card with the 3-mode segmented toggle. Extracted so the
 * Main and Competitions Pages groups can render identical cards without
 * duplicating the markup.
 */
function SiteCard({
  host,
  label,
  row,
  loading,
  saving,
  globalActive,
  onChange,
}: {
  host: string;
  label: string;
  row: MaintenanceRow | undefined;
  loading: boolean;
  saving: boolean;
  globalActive: boolean;
  onChange: (m: Mode) => void;
}) {
  const mode: Mode = (row?.mode ?? 'off') as Mode;
  return (
    <Card className="gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium text-foreground">{label}</span>
            {mode !== 'off' && (
              <Badge variant="outline" className={cn('font-mono text-[10px]', MODE_META[mode].pillClass)}>
                {MODE_META[mode].badge}
              </Badge>
            )}
          </div>
          <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{host}</p>
        </div>
        <a
          href={`https://${host}`}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${host} in new tab`}
          title="Open in new tab"
          className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/75 rounded"
        >
          <ExternalLink className="size-4" />
        </a>
      </div>
      {loading ? (
        <Skeleton className="h-8 w-full" />
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <ModeToggle value={mode} onChange={onChange} disabled={saving || globalActive} size="sm" />
          {saving && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
        </div>
      )}
      {row && (
        <p className="mt-0.5 text-[10px] font-mono text-muted-foreground">
          {relativeTime(row.updated_at)} · {actorLabel(row)}
        </p>
      )}
    </Card>
  );
}

export default function MaintenanceAdminPage() {
  const [rows, setRows] = useState<MaintenanceRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingHost, setSavingHost] = useState<string | null>(null);

  // Confirm dialog state — only fires for transitions INTO 'on' (the
  // destructive full-takeover mode). off ↔ read-only ↔ off go through
  // without prompting since neither hides the public site.
  const [pendingOn, setPendingOn] = useState<{ host: string; label: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const maintenance = await adminHttp.get<MaintenanceResponse>('/admin/maintenance');
      setRows(maintenance.entries);
      setAudit(maintenance.audit);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load maintenance state');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rowByHost = useMemo(() => {
    const m = new Map<string, MaintenanceRow>();
    for (const r of rows) m.set(r.host, r);
    return m;
  }, [rows]);

  const globalRow = rowByHost.get('*');
  const globalMode: Mode = (globalRow?.mode ?? 'off') as Mode;
  const globalActive = globalMode !== 'off';

  async function setMode(host: string, mode: Mode): Promise<void> {
    // Optimistic — revert on failure.
    const prev = rows;
    setSavingHost(host);
    setRows((cur) => cur.map((r) => (r.host === host ? { ...r, mode } : r)));
    try {
      const r = await adminHttp.patch<MaintenanceRow & { ok: true }>(
        // The `:` of competzy.com:3000 isn't a worry — these hosts are
        // already plain DNS names. encodeURIComponent is the safe bet for
        // arbitrary host strings.
        `/admin/maintenance/${encodeURIComponent(host)}`,
        { mode },
      );
      setRows((cur) =>
        cur.map((row) =>
          row.host === host
            ? {
                ...row,
                mode: r.mode,
                updated_by: r.updated_by,
                updated_at: r.updated_at,
                // The PATCH response doesn't include the joined email — the
                // GET reload below pulls it back in.
              }
            : row,
        ),
      );
      toast.success(
        host === '*'
          ? `Global kill switch → ${MODE_META[mode].label}`
          : `${host} → ${MODE_META[mode].label}`,
      );
      // Pull audit log + the joined updated_by_email back in.
      void load();
    } catch (e) {
      setRows(prev);
      toast.error(e instanceof Error ? e.message : 'Failed to update maintenance state');
    } finally {
      setSavingHost(null);
    }
  }

  // Intercept transitions INTO 'on' so the admin must explicitly confirm —
  // this is the full-takeover mode that hides the public site, reserved
  // for incidents or scheduled downtime. Every other transition fires
  // straight through.
  function requestMode(host: string, next: Mode, label: string): void {
    const current = (rowByHost.get(host)?.mode ?? 'off') as Mode;
    if (next === 'on' && current !== 'on') {
      setPendingOn({ host, label });
      return;
    }
    void setMode(host, next);
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Operations"
        title="Site maintenance"
        subtitle="Per-site toggle for the public landing pages. Read-only disables form submissions; On replaces every page with the maintenance screen until an admin bypass cookie is present."
      />

      {/* ── Per-site toggle — Main + Competitions Pages ────────────── */}
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-serif text-base font-medium text-foreground">Per-site toggle</h2>
          {globalActive && (
            <p className="text-xs italic text-muted-foreground">
              Per-site values are hidden by the global override below.
            </p>
          )}
        </div>

        {/* Main — Main Landing + Main Arena Page. */}
        <h3 className="mt-1 mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Main
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {SITES.filter((s) => s.group === 'main').map(({ host, label }) => (
            <SiteCard
              key={host}
              host={host}
              label={label}
              row={rowByHost.get(host)}
              loading={loading}
              saving={savingHost === host}
              globalActive={globalActive}
              onChange={(m) => requestMode(host, m, label)}
            />
          ))}
        </div>

        {/* Competitions Pages — the 12 per-competition landing subdomains. */}
        <h3 className="mt-6 mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Competitions Pages
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {SITES.filter((s) => s.group === 'comp').map(({ host, label }) => (
            <SiteCard
              key={host}
              host={host}
              label={label}
              row={rowByHost.get(host)}
              loading={loading}
              saving={savingHost === host}
              globalActive={globalActive}
              onChange={(m) => requestMode(host, m, label)}
            />
          ))}
        </div>
      </div>

      {/* ── Global kill switch — placed AFTER the per-site grid because
          it's a rarely-used "everything off" escape hatch; admins reach
          for per-site toggles 99% of the time and shouldn't have to
          scroll past the big card to get there. ──────────────────── */}
      <Card
        className={cn(
          'gap-3 border-2 p-5 transition-colors',
          globalActive
            ? 'border-rose-300 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/30'
            : 'border-border bg-background',
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-full',
                globalActive
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200'
                  : 'bg-muted text-muted-foreground',
              )}
              aria-hidden
            >
              <Globe className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-serif text-lg font-semibold text-foreground">
                  Global kill switch
                </h2>
                {globalActive && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="size-3" />
                    Overrides every site
                  </Badge>
                )}
              </div>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                When this is set to <strong>read-only</strong> or <strong>on</strong>, every
                landing-page subdomain serves that mode regardless of its individual setting.
                Use it for platform-wide incidents or scheduled downtime.
              </p>
              {globalRow && (
                <p className="mt-2 text-xs font-mono text-muted-foreground">
                  Last changed {relativeTime(globalRow.updated_at)} by {actorLabel(globalRow)}
                </p>
              )}
            </div>
          </div>
          {loading ? (
            <Skeleton className="h-9 w-72" />
          ) : (
            <ModeToggle
              value={globalMode}
              onChange={(m) => requestMode('*', m, 'Global kill switch')}
              disabled={savingHost === '*'}
            />
          )}
        </div>
      </Card>

      {/* ── Audit log ──────────────────────────────────────────────── */}
      <Card className="gap-2 p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-serif text-base font-medium text-foreground">Recent changes</h2>
          <span className="text-xs text-muted-foreground">Last 20</span>
        </div>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : audit.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No maintenance changes recorded yet.
          </p>
        ) : (
          <ul className="divide-y divide-border/60 text-sm">
            {audit.map((a) => {
              const mode = a.payload?.body?.mode as Mode | undefined;
              const meta = mode ? MODE_META[mode] : null;
              return (
                <li key={a.id} className="flex items-center gap-3 py-2">
                  <CheckCircle2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="font-mono text-xs text-foreground">{a.resource_id ?? '(unknown)'}</span>
                      <span className="text-xs text-muted-foreground">→</span>
                      {meta ? (
                        <Badge variant="outline" className={cn('font-mono text-[10px]', meta.pillClass)}>
                          {meta.label}
                        </Badge>
                      ) : (
                        <span className="text-xs italic text-muted-foreground">(mode unknown)</span>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {a.actor_email ?? a.actor_name ?? 'unknown'}
                    </p>
                  </div>
                  <span
                    className="shrink-0 font-mono text-[11px] text-muted-foreground"
                    title={new Date(a.created_at).toLocaleString()}
                  >
                    {relativeTime(a.created_at)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* ── Confirm dialog — transitions INTO 'on' only ─────────────── */}
      <Dialog
        open={!!pendingOn}
        onOpenChange={(o) => {
          if (!o) setPendingOn(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-300">
              <PowerOff className="size-5" aria-hidden />
              <DialogTitle>Turn on maintenance mode?</DialogTitle>
            </div>
            <DialogDescription>
              Only flip a site to <strong>On</strong> for an incident or scheduled downtime.
              Every public visitor will see the maintenance page until you flip it back —
              admins with the bypass cookie keep through-access.
            </DialogDescription>
          </DialogHeader>

          {pendingOn && (
            <div className="rounded-md border border-rose-200/60 bg-rose-50/60 p-3 text-sm dark:border-rose-900/50 dark:bg-rose-950/30">
              <dl className="space-y-1">
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-xs uppercase text-muted-foreground">Site</dt>
                  <dd className="font-medium">{pendingOn.label}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-24 shrink-0 text-xs uppercase text-muted-foreground">Host</dt>
                  <dd className="font-mono text-xs">{pendingOn.host === '*' ? '(global kill switch — every site)' : pendingOn.host}</dd>
                </div>
              </dl>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPendingOn(null)}
              disabled={!!savingHost}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!pendingOn) return;
                const host = pendingOn.host;
                setPendingOn(null);
                void setMode(host, 'on');
              }}
              disabled={!!savingHost}
            >
              {savingHost && <Loader2 className="size-4 animate-spin" />}
              Turn on maintenance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
