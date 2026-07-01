'use client';

// Blocking modal shown to teachers + school_admins who land in the
// school portal without an associated school. Asks them to pick a
// verified school from the directory. The confirm button is destructive-
// styled because the choice is sticky — only an admin can reassign once
// they've confirmed.

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, School, ShieldAlert } from 'lucide-react';

import { schoolHttp } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  open: boolean;
  /** Called after the user successfully links to a school — caller should
   *  refresh the auth context / re-fetch /auth/me to pick up school_id. */
  onConfirmed: () => void;
}

interface VerifiedSchool {
  id: string;
  name: string;
  npsn: string | null;
  city: string | null;
  province: string | null;
}

export function SelectSchoolModal({ open, onConfirmed }: Props) {
  const [schools, setSchools] = useState<VerifiedSchool[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    schoolHttp
      .get<VerifiedSchool[]>(
        `/schools/verified${search.trim() ? `?search=${encodeURIComponent(search.trim())}` : ''}`,
      )
      .then((rows) => {
        if (!cancelled) setSchools(rows);
      })
      .catch((e) => {
        if (!cancelled) toast.error(e instanceof Error ? e.message : 'Failed to load schools');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, search]);

  async function confirm() {
    if (!pickedId || confirming) return;
    setConfirming(true);
    try {
      await schoolHttp.post('/users/me/select-school', { schoolId: pickedId });
      toast.success('School linked');
      onConfirmed();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not link school');
      setConfirming(false);
    }
  }

  const picked = schools?.find((s) => s.id === pickedId) ?? null;

  return (
    // Non-dismissible — user must pick a school to enter the portal. No
    // close button, ESC + outside-click ignored.
    <Dialog open={open}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="size-5" />
            <DialogTitle>Pick your school to continue</DialogTitle>
          </div>
          <DialogDescription>
            Your account isn&apos;t linked to a school yet. Pick the verified school you belong
            to. This can&apos;t be changed by you afterwards (an admin must reassign).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by school name or NPSN…"
          />

          <div className="max-h-64 overflow-y-auto rounded-md border">
            {loading && !schools ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : !schools || schools.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No verified schools match.
              </p>
            ) : (
              <ul className="divide-y">
                {schools.map((s) => {
                  const active = s.id === pickedId;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setPickedId(s.id)}
                        className={
                          active
                            ? 'flex w-full items-start gap-2 bg-destructive/10 px-3 py-2.5 text-left text-sm'
                            : 'flex w-full items-start gap-2 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/60'
                        }
                      >
                        <School className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-foreground">{s.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {s.npsn ? `${s.npsn} · ` : ''}
                            {s.city || 'Unknown city'}
                            {s.province ? `, ${s.province}` : ''}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {picked && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs">
              <p className="font-medium text-destructive">Confirm school assignment</p>
              <p className="mt-1 text-muted-foreground">
                You&apos;re about to permanently link your account to{' '}
                <span className="font-semibold text-foreground">{picked.name}</span>. After
                confirming, only an administrator can change this.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="destructive"
            disabled={!pickedId || confirming}
            onClick={confirm}
          >
            {confirming && <Loader2 className="size-4 animate-spin" />}
            Confirm school assignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
