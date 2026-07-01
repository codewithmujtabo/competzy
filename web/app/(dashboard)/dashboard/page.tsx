'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  ClipboardList,
  Clock,
  Layers,
  Megaphone,
  Percent,
  School,
  Sparkles,
  Trophy,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/lib/auth/context';
import { useT } from '@/lib/i18n/context';
import { adminHttp } from '@/lib/api/client';
import { StatCard } from '@/components/shell/stat-card';
import { ChartCard } from '@/components/shell/chart-card';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Kpi {
  totals: {
    totalRegistrations: number;
    paidRegistrations: number;
    freeRegistrations: number;
    revenueRp: number | null;
  };
  paidRate: number;
  avgTimeToPaymentHours: number | null;
  topCompetitions: Array<{ id: string; name: string; fee: number; registrationCount: number }>;
  dailySeries: Array<{ date: string; registrations: number; revenueRp: number | null }>;
}

interface QuickLink {
  href: string;
  icon: LucideIcon;
  label: string;
  desc: string;
  /** Self-contained color story — bg gradient + ink + ring blur. */
  tile: { bg: string; ink: string; blob: string };
}

// The competzy.com categorical accents — indigo, pink, orange, gold, green,
// blue, lime. Every tile combines ONLY these. Ink colors paired for contrast.
const TILE_BLUE = {
  bg: 'bg-gradient-to-br from-[#3d8bff] via-[#0066ff] to-[#0047c2]',
  ink: 'text-white',
  blob: 'bg-[#7cd516]',
};
const TILE_PINK = {
  bg: 'bg-gradient-to-br from-[#b01561] via-[#d9277b] to-[#e85aa0]',
  ink: 'text-[#fff4e8]',
  blob: 'bg-[#f8db46]',
};
const TILE_GOLD = {
  bg: 'bg-gradient-to-br from-[#fbe57a] via-[#f8db46] to-[#eec522]',
  ink: 'text-[#2d240a]',
  blob: 'bg-[#d9277b]',
};
const TILE_INDIGO = {
  bg: 'bg-gradient-to-br from-[#6a3dff] via-[#5627ff] to-[#2a1170]',
  ink: 'text-[#fff4e8]',
  blob: 'bg-[#937aff]',
};
const TILE_LIME = {
  bg: 'bg-gradient-to-br from-[#a5ec4a] via-[#7cd516] to-[#57a30a]',
  ink: 'text-[#15260a]',
  blob: 'bg-[#5627ff]',
};
const TILE_ORANGE = {
  bg: 'bg-gradient-to-br from-[#ffb84d] via-[#f08c00] to-[#d97a00]',
  ink: 'text-[#2d1c05]',
  blob: 'bg-[#f8db46]',
};

const QUICK_LINKS: QuickLink[] = [
  { href: '/registrations', icon: ClipboardList, label: 'Registrations', desc: 'Approve or reject pending applications', tile: TILE_BLUE },
  { href: '/admin/competitions', icon: Trophy, label: 'Competitions', desc: 'Create and manage competitions', tile: TILE_PINK },
  { href: '/segments', icon: Layers, label: 'Segments', desc: 'Build cross-sell audiences', tile: TILE_GOLD },
  { href: '/notifications', icon: Megaphone, label: 'Send Notification', desc: 'Announce competitions to schools', tile: TILE_ORANGE },
  { href: '/schools', icon: School, label: 'Schools', desc: 'View and add schools', tile: TILE_LIME },
  { href: '/users', icon: Users, label: 'Users', desc: 'Browse registered users', tile: TILE_INDIGO },
];

function fmtRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(n);
}

function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[#5627ff]/30 bg-popover px-3 py-2 shadow-lg">
      <p className="font-mono text-[10px] uppercase tracking-wider text-[#5627ff]">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">
        {payload[0].value} registration{payload[0].value === 1 ? '' : 's'}
      </p>
    </div>
  );
}

function StatSkeleton() {
  return (
    <Card className="gap-0 overflow-hidden border-0 bg-gradient-to-br from-[#ece5ff] to-[#f4f1fb] p-6">
      <div className="flex items-start justify-between">
        <Skeleton className="h-3 w-24 bg-[#5627ff]/20" />
        <Skeleton className="size-11 rounded-2xl bg-[#5627ff]/20" />
      </div>
      <Skeleton className="mt-5 h-10 w-32 bg-[#5627ff]/20" />
      <Skeleton className="mt-2 h-3 w-20 bg-[#5627ff]/20" />
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const t = useT();
  const [kpi, setKpi] = useState<Kpi | null>(null);

  useEffect(() => {
    adminHttp
      .get<Kpi>('/admin/kpi')
      .then(setKpi)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load dashboard'));
  }, []);

  const chartData =
    kpi?.dailySeries.map((d) => ({ label: fmtDay(d.date), registrations: d.registrations })) ?? [];

  return (
    <div className="mx-auto max-w-[1400px] space-y-7 p-6 lg:p-8">
      {/* Hero — soft 2-tone cyan→teal horizon. Both anchors live in the
          cool family of the brand palette so there's no contrast clash
          at the corners. Decorative warm blobs (yellow/gold/pink) that
          used to muddy the bottom-right have been removed; a single
          ivory bloom sits behind the text for subtle depth without
          introducing a third hue. */}
      <section
        className={cn(
          'relative overflow-hidden rounded-3xl px-7 py-8 sm:px-10 sm:py-10',
          'bg-gradient-to-br from-[#6a3dff] via-[#5627ff] to-[#2a1170]',
          'shadow-[0_28px_70px_-30px_rgba(86,39,255,0.55)]',
        )}
      >
        {/* Single ivory bloom — adds depth without adding a third color. */}
        <span
          aria-hidden
          className="pointer-events-none absolute -left-16 -top-16 size-72 rounded-full bg-[#fff4e8] opacity-20 blur-3xl"
        />

        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="min-w-0 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#fff4e8]/18 px-3 py-1 backdrop-blur-sm ring-1 ring-[#fff4e8]/25">
              <Sparkles className="size-3.5 text-[#f8db46]" />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#fff4e8]">
                Welcome back
              </span>
            </div>
            <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight text-[#fff4e8] sm:text-5xl">
              {t('adm.greeting', { name: user?.full_name?.split(' ')[0] || 'Admin' })}
            </h1>
            <p className="mt-2 max-w-prose text-[15px] text-[#fff4e8]/85">{t('adm.dashSubtitle')}</p>
          </div>
          {kpi && (
            <div className="relative shrink-0 rounded-2xl bg-[#fff4e8]/15 px-5 py-4 text-right backdrop-blur-sm ring-1 ring-[#fff4e8]/30">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#fff4e8]/80">
                {t('adm.live90d')}
              </p>
              <p className="mt-1 font-serif text-3xl font-semibold text-[#fff4e8]">
                {kpi.totals.totalRegistrations.toLocaleString('en-US')}
              </p>
              <p className="text-xs text-[#fff4e8]/80">{t('adm.totalRegistrations')}</p>
            </div>
          )}
        </div>
      </section>

      {/* KPI cards — full vibrant treatment */}
      <div className="stagger-children grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {kpi ? (
          <>
            <StatCard
              label={t('adm.kpiRegistrations')}
              value={kpi.totals.totalRegistrations}
              icon={ClipboardList}
              hint={t('adm.free', { n: kpi.totals.freeRegistrations })}
              accent="blue"
            />
            <StatCard
              label={t('adm.kpiPaidRate')}
              value={`${(kpi.paidRate * 100).toFixed(1)}%`}
              icon={Percent}
              hint={t('adm.paid', { n: kpi.totals.paidRegistrations })}
              accent="pink"
            />
            {kpi.totals.revenueRp != null ? (
              <StatCard
                label={t('adm.kpiRevenue90d')}
                value={kpi.totals.revenueRp}
                format={(n) => fmtRp(Math.round(n))}
                icon={Wallet}
                accent="orange"
              />
            ) : (
              // Managers see operations, not money — paid volume instead.
              <StatCard
                label={t('adm.kpiPaidCount')}
                value={kpi.totals.paidRegistrations}
                icon={Wallet}
                accent="orange"
              />
            )}
            <StatCard
              label={t('adm.kpiAvgTimeToPay')}
              value={kpi.avgTimeToPaymentHours != null ? `${kpi.avgTimeToPaymentHours.toFixed(1)} h` : '-'}
              icon={Clock}
              hint={t('adm.regToSettlement')}
              accent="gold"
            />
          </>
        ) : (
          <>
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
            <StatSkeleton />
          </>
        )}
      </div>

      {/* Chart + Top competitions */}
      <div className="grid gap-5 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2 border-0 shadow-[0_18px_40px_-24px_rgba(86,39,255,0.3)] ring-1 ring-[#5627ff]/20"
          title={t('adm.chartRegistrations')}
          description={t('adm.chartRegDesc')}
        >
          {kpi ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="registrationsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5627ff" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#5627ff" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="registrationsStroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#5627ff" />
                    <stop offset="50%" stopColor="#d9277b" />
                    <stop offset="100%" stopColor="#f08c00" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={44}
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                />
                <YAxis
                  width={34}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#5627ff', strokeOpacity: 0.35 }} />
                <Area
                  type="monotone"
                  dataKey="registrations"
                  stroke="url(#registrationsStroke)"
                  strokeWidth={3}
                  fill="url(#registrationsFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <Skeleton className="h-[260px] w-full" />
          )}
        </ChartCard>

        <ChartCard
          className="border-0 shadow-[0_18px_40px_-24px_rgba(217,39,123,0.3)] ring-1 ring-[#d9277b]/20"
          title={t('adm.topCompetitions')}
          description={t('adm.topCompDesc')}
          bodyClassName="py-2"
        >
          {!kpi ? (
            <div className="space-y-3 py-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : kpi.topCompetitions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">{t('adm.noRegistrationsYet')}</p>
          ) : (
            <ol className="space-y-2">
              {kpi.topCompetitions.map((c, i) => {
                // Rank tiles — landing accents: 1st=gold, 2nd=pink, 3rd=blue
                const rankTiles = [
                  'bg-gradient-to-br from-[#fbe57a] to-[#f8db46] text-[#2d240a]',     // 1st — gold
                  'bg-gradient-to-br from-[#e85aa0] to-[#d9277b] text-[#fff4e8]',     // 2nd — pink
                  'bg-gradient-to-br from-[#3d8bff] to-[#0066ff] text-white',         // 3rd — blue
                ];
                const tile = rankTiles[i] ?? 'bg-muted text-foreground';
                return (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-[#d9277b]/5"
                  >
                    <span
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-bold shadow-sm',
                        tile,
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{c.name}</span>
                    <span className="shrink-0 rounded-full bg-[#d9277b]/10 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-[#d9277b]">
                      {c.registrationCount}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}
        </ChartCard>
      </div>

      {/* Quick actions — vibrant tiles */}
      <div>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d9277b]">
              Quick actions
            </p>
            <h2 className="mt-1 font-serif text-2xl font-semibold tracking-tight text-foreground">
              Jump straight in
            </h2>
          </div>
        </div>
        <div className="stagger-children grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map((l) => {
            const Icon = l.icon;
            return (
              <Link
                key={l.href}
                href={l.href}
                className="group rounded-xl focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/75 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <Card
                  className={cn(
                    'relative h-full flex-row items-center gap-4 overflow-hidden border-0 p-5 transition-all duration-300',
                    'hover:-translate-y-1 group-focus-visible:-translate-y-1 hover:shadow-[0_22px_50px_-22px_rgba(86,39,255,0.45)]',
                    l.tile.bg,
                    l.tile.ink,
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      'pointer-events-none absolute -right-10 -top-10 size-32 rounded-full opacity-25 blur-2xl transition-transform duration-500 group-hover:scale-110',
                      l.tile.blob,
                    )}
                  />
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -bottom-12 -left-8 size-28 rounded-full bg-current opacity-10 blur-2xl"
                  />
                  <span className="relative flex size-12 shrink-0 items-center justify-center rounded-2xl bg-current/18 ring-1 ring-current/28 backdrop-blur-sm transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110">
                    <Icon className="size-[1.35rem]" strokeWidth={2.25} />
                  </span>
                  <div className="relative min-w-0 flex-1">
                    <p className="text-[15px] font-bold leading-tight">{l.label}</p>
                    <p className="mt-0.5 text-[12.5px] opacity-85">{l.desc}</p>
                  </div>
                  <ArrowRight className="relative size-4 shrink-0 opacity-75 transition-transform group-hover:translate-x-1 group-hover:opacity-100" />
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
