'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { registrationsApi } from '@/lib/api';
import type { PendingRegistration } from '@/types';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { cn } from '@/lib/utils';

const STATUSES = [
  { key: 'all', label: 'All' },
  { key: 'pending_review', label: 'Pending Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
];

const STATUS_STYLE: Record<string, string> = {
  pending_review: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  pending_approval: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  pending_payment: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200',
  registered: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
};

function formatFee(fee: number) {
  return fee === 0 ? 'Free' : `Rp ${fee.toLocaleString('id-ID')}`;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={cn('border-transparent font-mono text-[10px] capitalize', STATUS_STYLE[status] ?? 'bg-muted text-muted-foreground')}
    >
      {status.replace(/_/g, ' ')}
    </Badge>
  );
}

export default function RegistrationsPage() {
  const [items, setItems] = useState<PendingRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async (status: string) => {
    setLoading(true);
    try {
      const r = await registrationsApi.listPending(status);
      setItems(r.pendingRegistrations ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load registrations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  const handleApprove = async (id: string) => {
    setBusy(id);
    try {
      await registrationsApi.approve(id);
      setItems((prev) => prev.filter((r) => r.registrationId !== id));
      toast.success('Registration approved — student notified.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to approve');
    } finally {
      setBusy(null);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectId || !reason.trim()) return;
    setBusy(rejectId);
    try {
      await registrationsApi.reject(rejectId, reason.trim());
      setItems((prev) => prev.filter((r) => r.registrationId !== rejectId));
      toast.success('Registration rejected — student notified.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reject');
    } finally {
      setBusy(null);
      setRejectId(null);
      setReason('');
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Admin"
        title="Registrations"
        subtitle="Review competition registrations and approve or reject pending applications."
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {STATUSES.map((s) => (
            <TabsTrigger key={s.key} value={s.key}>
              {s.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table className="w-full table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>School / Grade</TableHead>
                <TableHead>Competition</TableHead>
                <TableHead className="w-24">Fee</TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead className="w-28">Submitted</TableHead>
                <TableHead className="w-40 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-9 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-sm text-muted-foreground">
                    No registrations found in this view.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((r) => (
                  <TableRow key={r.registrationId}>
                    <TableCell>
                      <div className="truncate font-medium text-foreground">{r.student.name}</div>
                      <div className="truncate font-mono text-[11px] text-muted-foreground">{r.student.email}</div>
                      {r.student.phone && (
                        <div className="truncate font-mono text-[11px] text-muted-foreground">{r.student.phone}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="truncate text-sm">{r.student.school || '—'}</div>
                      <div className="truncate text-xs text-muted-foreground">Grade {r.student.grade || '—'}</div>
                      {r.student.nisn && (
                        <div className="truncate font-mono text-[10px] text-muted-foreground">NISN {r.student.nisn}</div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      <div className="truncate">{r.competition.name}</div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          'border-transparent font-mono text-[10px]',
                          r.competition.fee === 0
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                            : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200',
                        )}
                      >
                        {formatFee(r.competition.fee)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {new Date(r.registeredAt).toLocaleDateString('en-US', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.status === 'pending_review' ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            disabled={busy === r.registrationId}
                            onClick={() => handleApprove(r.registrationId)}
                          >
                            {busy === r.registrationId ? '…' : 'Approve'}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            disabled={busy === r.registrationId}
                            onClick={() => {
                              setRejectId(r.registrationId);
                              setReason('');
                            }}
                          >
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
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
        open={!!rejectId}
        onOpenChange={(open) => {
          if (!open) {
            setRejectId(null);
            setReason('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject registration</DialogTitle>
            <DialogDescription>
              The student will be notified with the reason you provide below.
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
                setRejectId(null);
                setReason('');
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!reason.trim() || busy === rejectId}
              onClick={handleRejectSubmit}
            >
              {busy === rejectId ? 'Rejecting…' : 'Reject registration'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
