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
    revenueRp: number;
  };
  paidRate: number;
  avgTimeToPaymentHours: number | null;
  topCompetitions: Array<{ id: string; name: string; fee: number; registrationCount: number }>;
  dailySeries: Array<{ date: string; registrations: number; revenueRp: number }>;
}

interface QuickLink {
  href: string;
  icon: LucideIcon;
  label: string;
  desc: string;
  /** Self-contained color story — bg gradient + ink + ring blur. */
  tile: { bg: string; ink: string; blob: string };
}

// Brand palette: #4BC2EC #4CBCBE #65C8DB  #F7B643 #BE65A9 #FEE404.
// All gradients below combine ONLY these six. Ink colors paired for contrast.
const TILE_SKY = {
  bg: 'bg-gradient-to-br from-[#4BC2EC] via-[#65C8DB] to-[#4CBCBE]',
  ink: 'text-[#062a3d]',
  blob: 'bg-[#FEE404]',
};
const TILE_BERRY = {
  bg: 'bg-gradient-to-br from-[#9c4b8a] via-[#BE65A9] to-[#d68bbf]',
  ink: 'text-[#fff4e8]',
  blob: 'bg-[#FEE404]',
};
const TILE_SUNSHINE = {
  bg: 'bg-gradient-to-br from-[#FEE404] via-[#F8C824] to-[#F7B643]',
  ink: 'text-[#2d1f0a]',
  blob: 'bg-[#BE65A9]',
};
const TILE_HORIZON = {
  bg: 'bg-gradient-to-br from-[#4BC2EC] via-[#7798c8] to-[#BE65A9]',
  ink: 'text-[#fff4e8]',
  blob: 'bg-[#FEE404]',
};
const TILE_CITRUS = {
  bg: 'bg-gradient-to-br from-[#65C8DB] via-[#aedb9f] to-[#FEE404]',
  ink: 'text-[#0a2a18]',
  blob: 'bg-[#BE65A9]',
};
const TILE_SOLAR = {
  bg: 'bg-gradient-to-br from-[#F7B643] via-[#e58572] to-[#BE65A9]',
  ink: 'text-[#fff4e8]',
  blob: 'bg-[#FEE404]',
};

const QUICK_LINKS: QuickLink[] = [
  { href: '/registrations', icon: ClipboardList, label: 'Registrations', desc: 'Approve or reject pending applications', tile: TILE_SKY },
  { href: '/admin/competitions', icon: Trophy, label: 'Competitions', desc: 'Create and manage competitions', tile: TILE_BERRY },
  { href: '/segments', icon: Layers, label: 'Segments', desc: 'Build cross-sell audiences', tile: TILE_SUNSHINE },
  { href: '/notifications', icon: Megaphone, label: 'Send Notification', desc: 'Announce competitions to schools', tile: TILE_SOLAR },
  { href: '/schools', icon: School, label: 'Schools', desc: 'View and add schools', tile: TILE_CITRUS },
  { href: '/users', icon: Users, label: 'Users', desc: 'Browse registered users', tile: TILE_HORIZON },
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
    <div className="rounded-xl border border-[#4BC2EC]/30 bg-popover px-3 py-2 shadow-lg">
      <p className="font-mono text-[10px] uppercase tracking-wider text-[#4CBCBE]">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">
        {payload[0].value} registration{payload[0].value === 1 ? '' : 's'}
      </p>
    </div>
  );
}

function StatSkeleton() {
  return (
    <Card className="gap-0 overflow-hidden border-0 bg-gradient-to-br from-[#dff4fb] to-[#e8f7eb] p-6">
      <div className="flex items-start justify-between">
        <Skeleton className="h-3 w-24 bg-[#4BC2EC]/25" />
        <Skeleton className="size-11 rounded-2xl bg-[#4BC2EC]/25" />
      </div>
      <Skeleton className="mt-5 h-10 w-32 bg-[#4BC2EC]/25" />
      <Skeleton className="mt-2 h-3 w-20 bg-[#4BC2EC]/25" />
    </Card>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
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
          'bg-gradient-to-br from-[#66C7D7] to-[#4CBCBE]',
          'shadow-[0_28px_70px_-30px_rgba(102,199,215,0.55)]',
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
              <Sparkles className="size-3.5 text-[#FEE404]" />
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[#fff4e8]">
                Welcome back
              </span>
            </div>
            <h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight text-[#fff4e8] sm:text-5xl">
              Hello, {user?.full_name?.split(' ')[0] || 'Admin'}.
            </h1>
            <p className="mt-2 max-w-prose text-[15px] text-[#fff4e8]/85">
              Here&apos;s how Competzy is performing across every competition. Tap a card to dive in.
            </p>
          </div>
          {kpi && (
            <div className="relative shrink-0 rounded-2xl bg-[#fff4e8]/15 px-5 py-4 text-right backdrop-blur-sm ring-1 ring-[#fff4e8]/30">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[#fff4e8]/80">
                Live · last 90d
              </p>
              <p className="mt-1 font-serif text-3xl font-semibold text-[#fff4e8]">
                {kpi.totals.totalRegistrations.toLocaleString('en-US')}
              </p>
              <p className="text-xs text-[#fff4e8]/80">total registrations</p>
            </div>
          )}
        </div>
      </section>

      {/* KPI cards — full vibrant treatment */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {kpi ? (
          <>
            <StatCard
              label="Registrations"
              value={kpi.totals.totalRegistrations.toLocaleString('en-US')}
              icon={ClipboardList}
              hint={`${kpi.totals.freeRegistrations} free`}
              accent="sky"
            />
            <StatCard
              label="Paid Rate"
              value={`${(kpi.paidRate * 100).toFixed(1)}%`}
              icon={Percent}
              hint={`${kpi.totals.paidRegistrations} paid`}
              accent="berry"
            />
            <StatCard
              label="Revenue · 90d"
              value={fmtRp(kpi.totals.revenueRp)}
              icon={Wallet}
              accent="solar"
            />
            <StatCard
              label="Avg Time to Pay"
              value={kpi.avgTimeToPaymentHours != null ? `${kpi.avgTimeToPaymentHours.toFixed(1)} h` : '—'}
              icon={Clock}
              hint="Registration → settlement"
              accent="sunshine"
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
          className="lg:col-span-2 border-0 shadow-[0_18px_40px_-24px_rgba(75,194,236,0.3)] ring-1 ring-[#4BC2EC]/20"
          title="Registrations"
          description="Daily new registrations over the last 90 days"
        >
          {kpi ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="registrationsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4BC2EC" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#4BC2EC" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="registrationsStroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#4BC2EC" />
                    <stop offset="50%" stopColor="#BE65A9" />
                    <stop offset="100%" stopColor="#F7B643" />
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
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#4BC2EC', strokeOpacity: 0.35 }} />
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
          className="border-0 shadow-[0_18px_40px_-24px_rgba(190,101,169,0.3)] ring-1 ring-[#BE65A9]/20"
          title="Top competitions"
          description="By registrations · last 90 days"
          bodyClassName="py-2"
        >
          {!kpi ? (
            <div className="space-y-3 py-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : kpi.topCompetitions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No registrations yet.</p>
          ) : (
            <ol className="space-y-2">
              {kpi.topCompetitions.map((c, i) => {
                // Rank tiles — pure brand colors, 1st=sunshine, 2nd=berry, 3rd=sky
                const rankTiles = [
                  'bg-gradient-to-br from-[#FEE404] to-[#F7B643] text-[#2d1f0a]',     // 1st — sunshine
                  'bg-gradient-to-br from-[#d68bbf] to-[#BE65A9] text-[#fff4e8]',     // 2nd — berry
                  'bg-gradient-to-br from-[#65C8DB] to-[#4BC2EC] text-[#062a3d]',     // 3rd — sky
                ];
                const tile = rankTiles[i] ?? 'bg-muted text-foreground';
                return (
                  <li
                    key={c.id}
                    className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-[#BE65A9]/5"
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
                    <span className="shrink-0 rounded-full bg-[#BE65A9]/10 px-2.5 py-0.5 text-xs font-semibold tabular-nums text-[#BE65A9]">
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
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-[#BE65A9]">
              Quick actions
            </p>
            <h2 className="mt-1 font-serif text-2xl font-semibold tracking-tight text-foreground">
              Jump straight in
            </h2>
          </div>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
                    'hover:-translate-y-1 group-focus-visible:-translate-y-1 hover:shadow-[0_22px_50px_-22px_rgba(75,194,236,0.45)]',
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
