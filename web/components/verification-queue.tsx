'use client';

// Shared account-verification queue used by BOTH the admin and the organizer
// portals (pass the matching http client). Two tabs — Schools and Teachers —
// over the unified /api/verification/* endpoints. Verify / reject mirror the
// original admin school-pending screen; reject requires a reason that is
// relayed to the applicant.

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Building2, GraduationCap } from 'lucide-react';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type Status = 'pending_verification' | 'rejected';
type Applicant = { id: string; name: string; email: string; phone: string | null } | null;

interface PendingSchool {
  id: string;
  npsn: string;
  name: string;
  city: string | null;
  province: string | null;
  verificationStatus: Status;
  appliedAt: string | null;
  rejectionReason: string | null;
  applicant: Applicant;
}
interface PendingTeacher {
  id: string;
  school: string | null;
  subject: string | null;
  npsn: string | null;
  verificationStatus: Status;
  appliedAt: string | null;
  rejectionReason: string | null;
  applicant: Applicant;
}

type Http = { get: <T>(p: string) => Promise<T>; post: <T>(p: string, b: unknown) => Promise<T> };
type Kind = 'schools' | 'teachers';

function StatusCell({ status, reason }: { status: Status; reason: string | null }) {
  return (
    <>
      <Badge
        variant="outline"
        className={cn(
          'border-transparent font-mono text-[10px]',
          status === 'rejected'
            ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'
            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
        )}
      >
        {status === 'rejected' ? 'Rejected' : 'Pending'}
      </Badge>
      {reason && <div className="mt-1 max-w-[220px] text-xs text-muted-foreground">{reason}</div>}
    </>
  );
}

function ApplicantCell({ applicant }: { applicant: Applicant }) {
  if (!applicant) return <span className="text-muted-foreground">—</span>;
  return (
    <>
      <div className="text-sm">{applicant.name}</div>
      <div className="font-mono text-[11px] text-muted-foreground">{applicant.email}</div>
      {applicant.phone && <div className="font-mono text-[11px] text-muted-foreground">{applicant.phone}</div>}
    </>
  );
}

export function VerificationQueue({
  http,
  eyebrow = 'Verification',
  title = 'Account approvals',
  subtitle = 'Review schools and teachers awaiting approval before their portal unlocks.',
}: {
  http: Http;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
}) {
  const [kind, setKind] = useState<Kind>('schools');
  const [schools, setSchools] = useState<PendingSchool[] | null>(null);
  const [teachers, setTeachers] = useState<PendingTeacher[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ kind: Kind; id: string; label: string } | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try {
      const [s, t] = await Promise.all([
        http.get<PendingSchool[]>('/verification/schools/pending'),
        http.get<PendingTeacher[]>('/verification/teachers/pending'),
      ]);
      setSchools(s);
      setTeachers(t);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load approvals');
      setSchools([]);
      setTeachers([]);
    }
  }, [http]);

  useEffect(() => {
    void load();
  }, [load]);

  const verify = async (k: Kind, id: string, label: string) => {
    setBusyId(id);
    try {
      await http.post(`/verification/${k}/${id}/verify`, {});
      toast.success(`Verified ${label}.`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to verify');
    } finally {
      setBusyId(null);
    }
  };

  const submitReject = async () => {
    if (!rejectTarget || !reason.trim()) return;
    setBusyId(rejectTarget.id);
    try {
      await http.post(`/verification/${rejectTarget.kind}/${rejectTarget.id}/reject`, { reason: reason.trim() });
      toast.success(`Rejected ${rejectTarget.label}.`);
      setRejectTarget(null);
      setReason('');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reject');
    } finally {
      setBusyId(null);
    }
  };

  const actionCell = (k: Kind, id: string, label: string, status: Status) => (
    <TableCell className="text-right">
      {status === 'pending_verification' ? (
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:text-destructive"
            disabled={busyId === id}
            onClick={() => {
              setRejectTarget({ kind: k, id, label });
              setReason('');
            }}
          >
            Reject
          </Button>
          <Button size="sm" disabled={busyId === id} onClick={() => verify(k, id, label)}>
            {busyId === id ? '…' : 'Verify'}
          </Button>
        </div>
      ) : (
        <Button
          size="sm"
          variant="outline"
          disabled={busyId === id}
          onClick={() => verify(k, id, label)}
          title="Reset rejection and re-approve"
        >
          Re-verify
        </Button>
      )}
    </TableCell>
  );

  const tabs: { key: Kind; label: string; icon: typeof Building2; count: number | null }[] = [
    { key: 'schools', label: 'Schools', icon: Building2, count: schools?.filter((s) => s.verificationStatus === 'pending_verification').length ?? null },
    { key: 'teachers', label: 'Teachers', icon: GraduationCap, count: teachers?.filter((t) => t.verificationStatus === 'pending_verification').length ?? null },
  ];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />

      <div className="grid w-fit grid-cols-2 gap-1 rounded-xl bg-muted p-1">
        {tabs.map((tab) => {
          const active = kind === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setKind(tab.key)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <tab.icon className="size-4" />
              {tab.label}
              {tab.count !== null && tab.count > 0 && (
                <span className="rounded-full bg-primary/15 px-1.5 text-[11px] font-semibold text-primary">{tab.count}</span>
              )}
            </button>
          );
        })}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          {kind === 'schools' ? (
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>School</TableHead>
                  <TableHead>NPSN</TableHead>
                  <TableHead>Coordinator</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!schools ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}>
                        <Skeleton className="h-9 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : schools.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-sm text-muted-foreground">
                      No school applications waiting.
                    </TableCell>
                  </TableRow>
                ) : (
                  schools.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="font-medium text-foreground">{s.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {[s.city, s.province].filter(Boolean).join(', ') || '—'}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-[12px] text-muted-foreground">{s.npsn}</TableCell>
                      <TableCell>
                        <ApplicantCell applicant={s.applicant} />
                      </TableCell>
                      <TableCell>
                        <StatusCell status={s.verificationStatus} reason={s.rejectionReason} />
                      </TableCell>
                      {actionCell('schools', s.id, s.name, s.verificationStatus)}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          ) : (
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Teacher</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead>NPSN</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!teachers ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={6}>
                        <Skeleton className="h-9 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : teachers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-sm text-muted-foreground">
                      No teacher applications waiting.
                    </TableCell>
                  </TableRow>
                ) : (
                  teachers.map((tch) => (
                    <TableRow key={tch.id}>
                      <TableCell>
                        <ApplicantCell applicant={tch.applicant} />
                      </TableCell>
                      <TableCell className="text-sm">{tch.school || '—'}</TableCell>
                      <TableCell className="font-mono text-[12px] text-muted-foreground">{tch.npsn || '—'}</TableCell>
                      <TableCell className="text-sm">{tch.subject || '—'}</TableCell>
                      <TableCell>
                        <StatusCell status={tch.verificationStatus} reason={tch.rejectionReason} />
                      </TableCell>
                      {actionCell('teachers', tch.id, tch.applicant?.name || 'teacher', tch.verificationStatus)}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>

      <Dialog
        open={!!rejectTarget}
        onOpenChange={(open) => {
          if (!open) {
            setRejectTarget(null);
            setReason('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {rejectTarget?.label}</DialogTitle>
            <DialogDescription>The reason is sent to the applicant.</DialogDescription>
          </DialogHeader>
          <textarea
            rows={3}
            autoFocus
            placeholder="Reason for rejection (required)…"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="flex min-h-20 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setRejectTarget(null);
                setReason('');
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" disabled={!reason.trim() || busyId === rejectTarget?.id} onClick={submitReject}>
              {busyId === rejectTarget?.id ? 'Rejecting…' : 'Reject application'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
