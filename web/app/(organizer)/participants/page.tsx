'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Download } from 'lucide-react';
import { organizerHttp } from '@/lib/auth/organizer-context';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface Competition {
  id: string;
  name: string;
  registrationCount: number;
}

interface Registration {
  id: string;
  status: string;
  registrationNumber?: string;
  createdAt: string;
  student: { id: string; fullName: string; email: string; phone?: string; school?: string; grade?: string };
  payment: { status: string; amount: number } | null;
}

const STATUS_STYLE: Record<string, string> = {
  pending_approval: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
  registered: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200',
  pending_review: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
  approved: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200',
};

const ACTIONABLE = new Set(['pending_approval', 'pending_review']);

export default function ParticipantsPage() {
  const [comps, setComps] = useState<Competition[]>([]);
  const [selectedComp, setSelectedComp] = useState('');
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    organizerHttp
      .get<Competition[]>('/organizers/competitions')
      .then(setComps)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load competitions'));
  }, []);

  const refresh = async () => {
    if (!selectedComp) return;
    setRegistrations(
      await organizerHttp.get<Registration[]>(`/organizers/competitions/${selectedComp}/registrations`),
    );
  };

  useEffect(() => {
    if (!selectedComp) return;
    setLoading(true);
    organizerHttp
      .get<Registration[]>(`/organizers/competitions/${selectedComp}/registrations`)
      .then(setRegistrations)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load registrations'))
      .finally(() => setLoading(false));
  }, [selectedComp]);

  const approve = async (id: string) => {
    setBusy(id);
    try {
      await organizerHttp.post(`/organizers/registrations/${id}/approve`, {});
      toast.success('Registration approved — student notified.');
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to approve');
    } finally {
      setBusy(null);
    }
  };

  const submitReject = async () => {
    if (!rejectId || !reason.trim()) return;
    setBusy(rejectId);
    try {
      await organizerHttp.post(`/organizers/registrations/${rejectId}/reject`, { reason: reason.trim() });
      toast.success('Registration rejected — student notified.');
      setRejectId(null);
      setReason('');
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reject');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Management"
        title="Participants"
        subtitle="Review and approve registrations for each of your competitions."
        actions={
          selectedComp ? (
            <Button
              variant="outline"
              onClick={() => window.open(`/api/organizers/competitions/${selectedComp}/export`, '_blank')}
            >
              <Download className="size-4" />
              Export CSV
            </Button>
          ) : undefined
        }
      />

      <div className="max-w-md">
        <Select value={selectedComp || undefined} onValueChange={setSelectedComp}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select a competition…" />
          </SelectTrigger>
          <SelectContent>
            {comps.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} ({c.registrationCount})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedComp ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          Select a competition above to view its participants.
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
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
                ) : registrations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-32 text-center text-sm text-muted-foreground">
                      No registrations yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  registrations.map((r) => {
                    const paid =
                      r.payment?.status === 'settlement' || r.payment?.status === 'capture';
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="font-medium text-foreground">{r.student.fullName}</div>
                          <div className="font-mono text-[11px] text-muted-foreground">
                            {r.student.email}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">{r.student.school || '—'}</TableCell>
                        <TableCell className="text-sm">{r.student.grade || '—'}</TableCell>
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
                        <TableCell>
                          {r.payment ? (
                            <Badge
                              variant="outline"
                              className={cn(
                                'border-transparent font-mono text-[10px]',
                                paid
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
                              )}
                            >
                              {r.payment.status}
                            </Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-[11px] text-muted-foreground">
                          {new Date(r.createdAt).toLocaleDateString('en-US', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          {ACTIONABLE.has(r.status) ? (
                            <div className="flex justify-end gap-2">
                              <Button size="sm" disabled={busy === r.id} onClick={() => approve(r.id)}>
                                {busy === r.id ? '…' : 'Approve'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive hover:text-destructive"
                                disabled={busy === r.id}
                                onClick={() => {
                                  setRejectId(r.id);
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
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}

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
            <DialogDescription>The student is notified with the reason below.</DialogDescription>
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
              onClick={submitReject}
            >
              {busy === rejectId ? 'Rejecting…' : 'Reject registration'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
