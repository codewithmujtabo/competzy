'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { schoolHttp, useSchool } from '@/lib/auth/school-context';
import { PageHeader } from '@/components/shell/page-header';
import { Pager } from '@/components/shell/pager';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface Registration {
  registrationId: string;
  status: string;
  registeredAt: string;
  student: { id: string; name: string; email: string; grade?: string };
  competition: { id: string; name: string; category?: string };
  payment?: { status: string; amount: number } | null;
}
interface Competition {
  id: string;
  name: string;
}

const STATUS_STYLE: Record<string, string> = {
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  submitted: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200',
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
};

const STATUS_TABS = [
  { key: 'all', label: 'All' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'paid', label: 'Paid' },
];
const LIMIT = 25;

export default function SchoolRegistrationsPage() {
  const { user } = useSchool();
  const isAdmin = user?.role === 'school_admin';

  const [regs, setRegs] = useState<Registration[]>([]);
  const [comps, setComps] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [compFilter, setCompFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      if (isAdmin) {
        const q = new URLSearchParams({
          page: String(page),
          limit: String(LIMIT),
          ...(compFilter && { compId: compFilter }),
          ...(statusFilter && { status: statusFilter }),
        });
        const r = await schoolHttp.get<{
          registrations: Registration[];
          pagination: { total: number };
        }>(`/schools/registrations?${q}`);
        setRegs(r.registrations);
        setTotal(r.pagination.total);
      } else {
        const response = await schoolHttp.get<{ competitions?: unknown[] }>('/teachers/my-competitions');
        const competitionsArray = (response.competitions || []) as Array<{
          id: string;
          name: string;
          category?: string;
          students?: Array<{ id: string; fullName?: string; name?: string; email?: string; grade?: string; status?: string }>;
        }>;
        const allRegs: Registration[] = [];
        for (const comp of competitionsArray) {
          for (const s of comp.students ?? []) {
            allRegs.push({
              registrationId: s.id || `reg-${comp.id}`,
              status: s.status || 'registered',
              registeredAt: new Date().toISOString(),
              student: { id: s.id, name: s.fullName || s.name || '', email: s.email || '', grade: s.grade },
              competition: { id: comp.id, name: comp.name, category: comp.category },
            });
          }
        }
        const filtered = compFilter ? allRegs.filter((r) => r.competition.id === compFilter) : allRegs;
        const start = (page - 1) * LIMIT;
        setRegs(filtered.slice(start, start + LIMIT));
        setTotal(filtered.length);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load registrations');
    } finally {
      setLoading(false);
    }
  }, [user, isAdmin, page, compFilter, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    if (isAdmin) {
      schoolHttp
        .get<{ registrations?: Registration[] }>('/schools/registrations?limit=500')
        .then((r) => {
          const seen = new Map<string, Competition>();
          (r.registrations ?? []).forEach((reg) => {
            if (reg?.competition?.id && !seen.has(reg.competition.id)) {
              seen.set(reg.competition.id, { id: reg.competition.id, name: reg.competition.name });
            }
          });
          setComps([...seen.values()]);
        })
        .catch(() => {});
    } else {
      schoolHttp
        .get<{ competitions?: Competition[] }>('/teachers/my-competitions')
        .then((d) => setComps((d.competitions ?? []).map((c) => ({ id: c.id, name: c.name }))))
        .catch(() => {});
    }
  }, [isAdmin, user]);

  const exportCsv = () => {
    const headers = 'Student,Email,Grade,Competition,Status,Date\n';
    const rows = regs
      .map(
        (r) =>
          `"${r.student.name}","${r.student.email}","${r.student.grade ?? ''}","${r.competition.name}","${r.status}","${new Date(r.registeredAt).toLocaleDateString()}"`,
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `registrations-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="School"
        title="Registrations"
        subtitle={`${total} registration${total === 1 ? '' : 's'} across your competitions.`}
        actions={
          regs.length > 0 ? (
            <Button variant="outline" onClick={exportCsv}>
              <Download className="size-4" />
              Export CSV
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        {comps.length > 0 && (
          <Select
            value={compFilter || 'all'}
            onValueChange={(v) => {
              setCompFilter(v === 'all' ? '' : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All competitions</SelectItem>
              {comps.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {isAdmin && (
          <Tabs
            value={statusFilter || 'all'}
            onValueChange={(v) => {
              setStatusFilter(v === 'all' ? '' : v);
              setPage(1);
            }}
          >
            <TabsList>
              {STATUS_TABS.map((s) => (
                <TabsTrigger key={s.key} value={s.key}>
                  {s.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Competition</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Registered</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : regs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-sm text-muted-foreground">
                    {isAdmin
                      ? 'No registrations found.'
                      : 'Your students have not registered for any competitions yet.'}
                  </TableCell>
                </TableRow>
              ) : (
                regs.map((r, idx) => (
                  <TableRow key={r.registrationId || idx}>
                    <TableCell>
                      <div className="font-medium text-foreground">{r.student.name}</div>
                      <div className="font-mono text-[11px] text-muted-foreground">{r.student.email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{r.competition.name}</div>
                      {r.competition.category && (
                        <Badge variant="secondary" className="mt-1 font-normal">
                          {r.competition.category}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{r.student.grade ? `Grade ${r.student.grade}` : '—'}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          'border-transparent font-mono text-[10px] capitalize',
                          STATUS_STYLE[r.status] ?? 'bg-muted text-muted-foreground',
                        )}
                      >
                        {r.status.replace(/_/g, ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {new Date(r.registeredAt).toLocaleDateString('en-US', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <Pager page={page} total={total} limit={LIMIT} onChange={setPage} />
      </Card>
    </div>
  );
}
