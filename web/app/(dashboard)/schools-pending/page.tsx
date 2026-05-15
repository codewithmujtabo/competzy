'use client';

import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { ExternalLink } from 'lucide-react';
import { adminHttp } from '@/lib/api/client';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface PendingSchool {
  id: string;
  npsn: string;
  name: string;
  city: string | null;
  province: string | null;
  address: string | null;
  verificationStatus: 'pending_verification' | 'rejected';
  verificationLetterUrl: string | null;
  appliedAt: string | null;
  rejectionReason: string | null;
  applicant: { id: string; name: string; email: string; phone: string | null } | null;
}

export default function SchoolsPendingPage() {
  const [schools, setSchools] = useState<PendingSchool[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PendingSchool | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try {
      setSchools(await adminHttp.get<PendingSchool[]>('/admin/schools/pending'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load applications');
      setSchools([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const verify = async (s: PendingSchool) => {
    setBusyId(s.id);
    try {
      await adminHttp.post(`/admin/schools/${s.id}/verify`, {});
      toast.success(`Verified ${s.name}.`);
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
      await adminHttp.post(`/admin/schools/${rejectTarget.id}/reject`, { reason: reason.trim() });
      toast.success(`Rejected ${rejectTarget.name}.`);
      setRejectTarget(null);
      setReason('');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reject');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Verification queue"
        title="School Applications"
        subtitle="Approve schools so their coordinator can access the school portal — bulk registration, bulk payment, and reports."
      />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>School</TableHead>
                <TableHead>NPSN</TableHead>
                <TableHead>Coordinator</TableHead>
                <TableHead>Letter</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!schools ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-9 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : schools.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-sm text-muted-foreground">
                    No pending school applications.
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
                      {s.applicant ? (
                        <>
                          <div className="text-sm">{s.applicant.name}</div>
                          <div className="font-mono text-[11px] text-muted-foreground">
                            {s.applicant.email}
                          </div>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {s.verificationLetterUrl ? (
                        <a
                          href={s.verificationLetterUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                        >
                          View
                          <ExternalLink className="size-3.5" />
                        </a>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {s.verificationStatus === 'rejected' ? (
                        <Badge
                          variant="outline"
                          className="border-transparent bg-red-100 font-mono text-[10px] text-red-800 dark:bg-red-950 dark:text-red-200"
                        >
                          Rejected
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-transparent bg-amber-100 font-mono text-[10px] text-amber-800 dark:bg-amber-950 dark:text-amber-200"
                        >
                          Pending
                        </Badge>
                      )}
                      {s.rejectionReason && (
                        <div className="mt-1 max-w-[220px] text-xs text-muted-foreground">
                          {s.rejectionReason}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {s.verificationStatus === 'pending_verification' ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            disabled={busyId === s.id}
                            onClick={() => {
                              setRejectTarget(s);
                              setReason('');
                            }}
                          >
                            Reject
                          </Button>
                          <Button size="sm" disabled={busyId === s.id} onClick={() => verify(s)}>
                            {busyId === s.id ? '…' : 'Verify'}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === s.id}
                          onClick={() => verify(s)}
                          title="Reset rejection and re-approve"
                        >
                          Re-verify
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
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
            <DialogTitle>Reject {rejectTarget?.name}</DialogTitle>
            <DialogDescription>
              The reason is sent to the school coordinator by email.
            </DialogDescription>
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
            <Button
              variant="destructive"
              disabled={!reason.trim() || busyId === rejectTarget?.id}
              onClick={submitReject}
            >
              {busyId === rejectTarget?.id ? 'Rejecting…' : 'Reject application'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
