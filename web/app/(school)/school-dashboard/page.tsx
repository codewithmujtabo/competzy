'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Award,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock,
  CreditCard,
  Star,
  Trophy,
  Upload,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useSchool, schoolHttp } from '@/lib/auth/school-context';
import { PageHeader } from '@/components/shell/page-header';
import { StatCard } from '@/components/shell/stat-card';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface SchoolInfo {
  id: string;
  npsn: string;
  name: string;
  city: string;
  province: string;
  studentCount: number;
}
interface Stats {
  total_students: number;
  active_registrations: number;
  pending_registrations: number;
  approved_registrations: number;
}
interface TeacherStats {
  totalStudents: number;
  totalRegistrations: number;
  confirmedRegistrations: number;
  activeStudents: number;
}

interface QuickLink {
  href: string;
  icon: LucideIcon;
  label: string;
  desc: string;
  external?: boolean;
}

const ADMIN_QUICK: QuickLink[] = [
  { href: '/school-students', icon: Users, label: 'Student Roster', desc: 'View and manage your students' },
  { href: '/bulk-registration', icon: Upload, label: 'Bulk Registration', desc: 'Register multiple students at once' },
  { href: '/school-registrations', icon: ClipboardList, label: 'Registrations', desc: 'Track all student registrations' },
  { href: '/bulk-payment', icon: CreditCard, label: 'Bulk Payment', desc: 'Pay for multiple registrations' },
  { href: '/api/schools/export/achievement.pdf', icon: Award, label: 'Achievement PDF', desc: 'Download the student results report', external: true },
];

const TEACHER_QUICK: QuickLink[] = [
  { href: '/school-my-students', icon: Users, label: 'My Students', desc: 'View your students' },
  { href: '/school-my-competitions', icon: Trophy, label: 'My Competitions', desc: 'Competitions your students joined' },
  { href: '/school-registrations', icon: ClipboardList, label: 'Registrations', desc: 'Track registrations' },
  { href: '/school-deadline', icon: CalendarClock, label: 'Deadlines', desc: 'Upcoming deadlines' },
];

export default function SchoolDashboardPage() {
  const { user } = useSchool();
  const [school, setSchool] = useState<SchoolInfo | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [teacherStats, setTeacherStats] = useState<TeacherStats | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === 'school_admin';
  const quickLinks = isAdmin ? ADMIN_QUICK : TEACHER_QUICK;

  useEffect(() => {
    if (!user) return;
    if (isAdmin) {
      Promise.all([
        schoolHttp.get<SchoolInfo>('/schools/my-school').catch(() => null),
        schoolHttp
          .get<{ registrations: { status: string }[] }>('/schools/registrations?limit=500')
          .catch(() => ({ registrations: [] })),
      ])
        .then(([schoolData, regsData]) => {
          if (schoolData) setSchool(schoolData);
          const regs = regsData?.registrations || [];
          setStats({
            total_students: schoolData?.studentCount || 0,
            active_registrations: regs.length,
            pending_registrations: regs.filter((r) => r.status === 'submitted' || r.status === 'pending').length,
            approved_registrations: regs.filter((r) => r.status === 'approved' || r.status === 'paid').length,
          });
        })
        .finally(() => setLoading(false));
    } else {
      schoolHttp
        .get<TeacherStats>('/teachers/dashboard-summary')
        .then((s) => setTeacherStats(s))
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [user, isAdmin]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Welcome back"
        title={user?.full_name || 'School'}
        subtitle={
          isAdmin && school
            ? `${school.name} — ${[school.city, school.province].filter(Boolean).join(', ')}`
            : 'Monitor your students and their competition registrations.'
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="gap-0 p-5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-4 h-8 w-20" />
            </Card>
          ))
        ) : isAdmin && stats ? (
          <>
            <StatCard label="Total Students" value={stats.total_students} icon={Users} accent="teal" />
            <StatCard label="Active Registrations" value={stats.active_registrations} icon={ClipboardList} accent="indigo" />
            <StatCard label="Pending Review" value={stats.pending_registrations} icon={Clock} accent="amber" />
            <StatCard label="Approved" value={stats.approved_registrations} icon={CheckCircle2} accent="green" />
          </>
        ) : teacherStats ? (
          <>
            <StatCard label="My Students" value={teacherStats.totalStudents} icon={Users} accent="teal" />
            <StatCard label="Registrations" value={teacherStats.totalRegistrations} icon={ClipboardList} accent="indigo" />
            <StatCard label="Confirmed" value={teacherStats.confirmedRegistrations} icon={CheckCircle2} accent="green" />
            <StatCard label="Active · 30d" value={teacherStats.activeStudents} icon={Star} accent="amber" />
          </>
        ) : null}
      </div>

      <div>
        <h2 className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          Quick actions
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((l) => {
            const Icon = l.icon;
            const inner = (
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
            );
            return l.external ? (
              <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer" className="group">
                {inner}
              </a>
            ) : (
              <Link key={l.href} href={l.href} className="group">
                {inner}
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
