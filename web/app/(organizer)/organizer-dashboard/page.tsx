'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Flame, Trophy, Users, Wallet, ClipboardList } from 'lucide-react';
import { organizerHttp, useOrganizer } from '@/lib/auth/organizer-context';
import { PageHeader } from '@/components/shell/page-header';
import { StatCard } from '@/components/shell/stat-card';
import { ChartCard } from '@/components/shell/chart-card';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface Stats {
  total_competitions: number;
  total_registrations: number;
  revenue_this_month: number;
  active_competitions: number;
}

interface Competition {
  id: string;
  name: string;
  registrationStatus: string;
  registrationCount: number;
  regCloseDate?: string;
}

interface Activity {
  id: string;
  description: string;
  created_at: string;
}

function fmtRp(n: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n);
}

export default function OrganizerDashboardPage() {
  const { user } = useOrganizer();
  const [stats, setStats] = useState<Stats | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      organizerHttp.get<{ totalRegistrations: number; totalRevenue: number }>('/organizers/revenue'),
      organizerHttp.get<Competition[]>('/organizers/competitions'),
    ])
      .then(([revenue, comps]) => {
        setStats({
          total_competitions: comps.length,
          total_registrations: revenue.totalRegistrations,
          revenue_this_month: revenue.totalRevenue,
          active_competitions: comps.filter((c) => c.registrationStatus === 'Open').length,
        });
        setActivity(
          comps.slice(0, 5).map((c) => ({
            id: c.id,
            description: `${c.name} — ${c.registrationCount} registration${c.registrationCount === 1 ? '' : 's'}`,
            created_at: c.regCloseDate || new Date().toISOString(),
          })),
        );
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const QUICK = [
    {
      href: '/organizer-competitions',
      icon: Trophy,
      label: 'Manage competitions',
      desc: 'View, create, and edit competitions',
    },
    {
      href: '/participants',
      icon: Users,
      label: 'View participants',
      desc: 'Browse registered participants',
    },
  ];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Welcome back"
        title={user?.full_name || 'Organizer'}
        subtitle="Your competitions, registrations, and revenue at a glance."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="gap-0 p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-4 h-8 w-28" />
            </Card>
          ))
        ) : (
          <>
            <StatCard label="Competitions" value={stats?.total_competitions ?? 0} icon={Trophy} accent="teal" />
            <StatCard
              label="Registrations"
              value={stats?.total_registrations ?? 0}
              icon={ClipboardList}
              accent="green"
            />
            <StatCard
              label="Revenue · month"
              value={fmtRp(stats?.revenue_this_month ?? 0)}
              icon={Wallet}
              accent="indigo"
            />
            <StatCard label="Active now" value={stats?.active_competitions ?? 0} icon={Flame} accent="rose" />
          </>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {QUICK.map((l) => {
          const Icon = l.icon;
          return (
            <Link key={l.href} href={l.href} className="group">
              <Card className="flex-row items-center gap-4 p-5 transition-colors group-hover:border-primary/40 group-hover:bg-accent/40">
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

      <ChartCard title="Recent activity" description="Latest competitions and their registration counts" bodyClassName="py-2">
        {loading ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
        ) : activity.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No recent activity.</p>
        ) : (
          <ul className="divide-y">
            {activity.map((a) => (
              <li key={a.id} className="flex items-center gap-3 py-3">
                <span className="size-2 shrink-0 rounded-full bg-primary" />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">{a.description}</span>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {new Date(a.created_at).toLocaleDateString('en-US', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </ChartCard>
    </div>
  );
}
