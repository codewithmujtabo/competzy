'use client';

// Admin maintenance toggle at /admin/maintenance.
//
// Hydrates from `GET /api/admin/maintenance` and PATCHes each row to
// `/api/admin/maintenance/:host`. Contract: docs/arena-maintenance-spec.md
// in the competzy-web repo.
//
// Layout (top → bottom):
//   1. Global kill switch banner (the `*` row)
//   2. Per-site grid with 3-way segmented control
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
  UserPlus,
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
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

// ── Friendly labels per host. Keep in sync with the backend's KNOWN_HOSTS. ──
const SITES: Array<{ host: string; label: string }> = [
  { host: 'competzy.com',               label: 'Main landing' },
  { host: 'emc.competzy.com',           label: 'EMC' },
  { host: 'ispo.competzy.com',          label: 'ISPO' },
  { host: 'osebi.competzy.com',         label: 'OSEBI' },
  { host: 'komodo.competzy.com',        label: 'KOMODO' },
  { host: 'genius.competzy.com',        label: 'Genius Olympiad' },
  { host: 'owlypia.competzy.com',       label: 'Owlypia' },
  { host: 'mathchallenge.competzy.com', label: 'Math Challenge Thailand' },
  { host: 'stemolympiad.competzy.com',  label: 'STEM Olympiad' },
  { host: 'nextgen.competzy.com',       label: 'NextGen Olympiad' },
  { host: 'youngmaster.competzy.com',   label: 'Young Master Challenge' },
  { host: 'angkor.competzy.com',        label: 'Angkor Math Competition' },
  { host: 'igo.competzy.com',           label: 'IGO London' },
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
  payload: { body?: { mode?: string; value?: unknown } } | null;
  created_at: string;
  actor_name: string | null;
  actor_email: string | null;
}

interface MaintenanceResponse {
  entries: MaintenanceRow[];
  audit: AuditRow[];
}

interface ArenaSetting {
  key: string;
  value: unknown;
  description: string | null;
  updated_by: string;
  updated_by_email: string | null;
  updated_at: string;
}

interface ArenaSettingsResponse {
  settings: ArenaSetting[];
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

export default function MaintenanceAdminPage() {
  const [rows, setRows] = useState<MaintenanceRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingHost, setSavingHost] = useState<string | null>(null);

  // Arena-side feature flags (separate from site_maintenance). Today
  // just `registration_enabled`; the table renders any flag the server
  // returns so adding new flags later is a backend-only change.
  const [arenaSettings, setArenaSettings] = useState<ArenaSetting[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Confirm dialog state — only fires for transitions INTO 'on' (the
  // destructive full-takeover mode). off ↔ read-only ↔ off go through
  // without prompting since neither hides the public site.
  const [pendingOn, setPendingOn] = useState<{ host: string; label: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [maintenance, settings] = await Promise.all([
        adminHttp.get<MaintenanceResponse>('/admin/maintenance'),
        adminHttp.get<ArenaSettingsResponse>('/admin/arena-settings'),
      ]);
      setRows(maintenance.entries);
      setAudit(maintenance.audit);
      setArenaSettings(settings.settings);
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

  async function setArenaSetting(key: string, value: unknown, friendlyLabel: string): Promise<void> {
    const prev = arenaSettings;
    setSavingKey(key);
    setArenaSettings((cur) =>
      cur.map((s) => (s.key === key ? { ...s, value } : s)),
    );
    try {
      const r = await adminHttp.patch<ArenaSetting & { ok: true }>(
        `/admin/arena-settings/${encodeURIComponent(key)}`,
        { value },
      );
      setArenaSettings((cur) =>
        cur.map((s) =>
          s.key === key
            ? { ...s, value: r.value, updated_by: r.updated_by, updated_at: r.updated_at }
            : s,
        ),
      );
      toast.success(`${friendlyLabel} → ${value === true ? 'enabled' : 'disabled'}`);
      // Re-fetch so the joined updated_by_email comes back in.
      void load();
    } catch (e) {
      setArenaSettings(prev);
      toast.error(e instanceof Error ? e.message : 'Failed to update setting');
    } finally {
      setSavingKey(null);
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

      {/* ── Global kill switch ──────────────────────────────────────── */}
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

      {/* ── Per-site grid ──────────────────────────────────────────── */}
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-serif text-base font-medium text-foreground">Per-site toggle</h2>
          {globalActive && (
            <p className="text-xs italic text-muted-foreground">
              Per-site values are hidden by the global override above.
            </p>
          )}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {SITES.map(({ host, label }) => {
            const row = rowByHost.get(host);
            const mode: Mode = (row?.mode ?? 'off') as Mode;
            const isSaving = savingHost === host;
            return (
              <Card key={host} className="gap-3 p-4">
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
                    <ModeToggle
                      value={mode}
                      onChange={(m) => requestMode(host, m, label)}
                      disabled={isSaving || globalActive}
                      size="sm"
                    />
                    {isSaving && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
                  </div>
                )}
                {row && (
                  <p className="mt-0.5 text-[10px] font-mono text-muted-foreground">
                    {relativeTime(row.updated_at)} · {actorLabel(row)}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── Arena settings ─────────────────────────────────────────── */}
      {/* Feature flags for arena.competzy.com itself — distinct from the
          public-landing toggles above. Server is source of truth; the
          register form on web pre-checks via GET /api/arena-settings/public. */}
      <Card className="gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-serif text-base font-medium text-foreground">
              Arena settings
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Controls for arena.competzy.com itself. Login + existing users are unaffected.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 1 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : arenaSettings.length === 0 ? (
          <p className="py-3 text-sm text-muted-foreground">
            No arena settings configured.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {arenaSettings.map((s) => {
              const isBool = typeof s.value === 'boolean';
              const enabled = isBool ? (s.value as boolean) : false;
              // Friendly per-key label + icon. New flag = add a case here.
              const meta = (() => {
                switch (s.key) {
                  case 'registration_enabled':
                    return {
                      icon: UserPlus,
                      label: 'Allow new user registration',
                      hint: 'When off, the register form is disabled and POST /api/auth/signup returns 503. Login + existing users keep working.',
                    };
                  default:
                    return { icon: ShieldCheck, label: s.key, hint: s.description ?? '' };
                }
              })();
              const Icon = meta.icon;
              const saving = savingKey === s.key;
              return (
                <li key={s.key} className="flex items-center gap-4 py-3">
                  <div
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-lg',
                      enabled
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-200',
                    )}
                    aria-hidden
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-medium text-foreground">{meta.label}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{s.key}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{meta.hint}</p>
                    <p className="mt-1 text-[10px] font-mono text-muted-foreground">
                      {relativeTime(s.updated_at)} ·{' '}
                      {s.updated_by_email ?? (s.updated_by === 'system' ? 'system' : 'unknown')}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {saving && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
                    {isBool ? (
                      <Switch
                        checked={enabled}
                        disabled={saving}
                        onCheckedChange={(next) => setArenaSetting(s.key, next, meta.label)}
                        aria-label={meta.label}
                      />
                    ) : (
                      <Badge variant="outline" className="font-mono text-[10px]">
                        (unsupported value type)
                      </Badge>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
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
              // Mixed-action audit feed: site_maintenance writes carry
              // `body.mode` (3-mode enum); arena_settings writes carry
              // `body.value` (boolean today). Render adapts so both
              // surface meaningfully.
              const isArena = a.action === 'admin.arena_settings.update';
              const mode = a.payload?.body?.mode as Mode | undefined;
              const meta = mode ? MODE_META[mode] : null;
              const value = a.payload?.body?.value;
              return (
                <li key={a.id} className="flex items-center gap-3 py-2">
                  <CheckCircle2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      <span className="font-mono text-xs text-foreground">{a.resource_id ?? '(unknown)'}</span>
                      <span className="text-xs text-muted-foreground">→</span>
                      {isArena ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            'font-mono text-[10px]',
                            value === true
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200'
                              : 'bg-rose-100 text-rose-900 dark:bg-rose-950/60 dark:text-rose-200',
                          )}
                        >
                          {value === true ? 'enabled' : value === false ? 'disabled' : '(unknown)'}
                        </Badge>
                      ) : meta ? (
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
