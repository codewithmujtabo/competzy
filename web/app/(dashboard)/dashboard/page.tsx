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
  Trophy,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';

import { useAuth } from '@/lib/auth/context';
import { adminHttp } from '@/lib/api/client';
import { PageHeader } from '@/components/shell/page-header';
import { StatCard } from '@/components/shell/stat-card';
import { ChartCard } from '@/components/shell/chart-card';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

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

const QUICK_LINKS: { href: string; icon: LucideIcon; label: string; desc: string }[] = [
  { href: '/registrations', icon: ClipboardList, label: 'Registrations', desc: 'Approve or reject pending applications' },
  { href: '/admin/competitions', icon: Trophy, label: 'Competitions', desc: 'Create and manage competitions' },
  { href: '/segments', icon: Layers, label: 'Segments', desc: 'Build cross-sell audiences' },
  { href: '/notifications', icon: Megaphone, label: 'Send Notification', desc: 'Announce competitions to schools' },
  { href: '/schools', icon: School, label: 'Schools', desc: 'View and add schools' },
  { href: '/users', icon: Users, label: 'Users', desc: 'Browse registered users' },
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
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-md">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">
        {payload[0].value} registration{payload[0].value === 1 ? '' : 's'}
      </p>
    </div>
  );
}

function StatSkeleton() {
  return (
    <Card className="gap-0 p-5">
      <div className="flex items-start justify-between">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="size-9 rounded-lg" />
      </div>
      <Skeleton className="mt-4 h-8 w-28" />
      <Skeleton className="mt-2 h-3 w-20" />
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
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Welcome back"
        title={user?.full_name || 'Admin'}
        subtitle="Here’s how Competzy is performing across every competition."
      />

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpi ? (
          <>
            <StatCard
              label="Registrations"
              value={kpi.totals.totalRegistrations.toLocaleString('en-US')}
              icon={ClipboardList}
              hint={`${kpi.totals.freeRegistrations} free`}
              accent="teal"
            />
            <StatCard
              label="Paid Rate"
              value={`${(kpi.paidRate * 100).toFixed(1)}%`}
              icon={Percent}
              hint={`${kpi.totals.paidRegistrations} paid`}
              accent="indigo"
            />
            <StatCard
              label="Revenue · 90d"
              value={fmtRp(kpi.totals.revenueRp)}
              icon={Wallet}
              accent="green"
            />
            <StatCard
              label="Avg Time to Pay"
              value={kpi.avgTimeToPaymentHours != null ? `${kpi.avgTimeToPaymentHours.toFixed(1)} h` : '—'}
              icon={Clock}
              hint="Registration → settlement"
              accent="amber"
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
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          className="lg:col-span-2"
          title="Registrations"
          description="Daily new registrations over the last 90 days"
        >
          {kpi ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                <defs>
                  <linearGradient id="registrationsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
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
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--border)' }} />
                <Area
                  type="monotone"
                  dataKey="registrations"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  fill="url(#registrationsFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <Skeleton className="h-[260px] w-full" />
          )}
        </ChartCard>

        <ChartCard title="Top competitions" description="By registrations · last 90 days" bodyClassName="py-2">
          {!kpi ? (
            <div className="space-y-3 py-2">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
            </div>
          ) : kpi.topCompetitions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No registrations yet.</p>
          ) : (
            <ol className="divide-y">
              {kpi.topCompetitions.map((c, i) => (
                <li key={c.id} className="flex items-center gap-3 py-2.5">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 font-mono text-xs font-semibold text-primary">
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{c.name}</span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                    {c.registrationCount}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </ChartCard>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Quick actions
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map((l) => {
            const Icon = l.icon;
            return (
              <Link key={l.href} href={l.href} className="group">
                <Card className="flex-row items-center gap-4 p-4 transition-colors group-hover:border-primary/40 group-hover:bg-accent/40">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{l.label}</p>
                    <p className="truncate text-xs text-muted-foreground">{l.desc}</p>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
