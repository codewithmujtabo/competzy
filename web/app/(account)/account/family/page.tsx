'use client';

import { AccountTabs } from '@/components/account/account-tabs';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, Loader2, Mail, Users, X } from 'lucide-react';
import { emcHttp } from '@/lib/api/client';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PendingLink {
  linkId: string;
  parentId: string;
  parentName: string;
  parentEmail: string;
  createdAt: string;
}

interface InviteResponse {
  invitationId: string;
  message: string;
  emailSent: boolean;
  debugPin?: string;
  debugEmail?: string;
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function AccountFamilyPage() {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [lastInvite, setLastInvite] = useState<InviteResponse | null>(null);

  const [pending, setPending] = useState<PendingLink[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const loadPending = useCallback(async () => {
    try {
      setPending(await emcHttp.get<PendingLink[]>('/parents/pending-invitations'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load parent requests');
      setPending([]);
    }
  }, []);

  useEffect(() => {
    void loadPending();
  }, [loadPending]);

  async function sendInvite() {
    if (!isEmail(email.trim())) {
      toast.error('Enter a valid email address.');
      return;
    }
    setSending(true);
    try {
      const r = await emcHttp.post<InviteResponse>('/parents/invite-parent', {
        parentEmail: email.trim(),
      });
      setLastInvite(r);
      setEmail('');
      toast.success(r.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not send the invitation');
    } finally {
      setSending(false);
    }
  }

  async function respond(link: PendingLink, status: 'active' | 'rejected') {
    setBusy(link.linkId);
    try {
      await emcHttp.put<{ message: string }>(`/parents/links/${link.linkId}/approve`, {
        status,
      });
      setPending((cur) => cur?.filter((p) => p.linkId !== link.linkId) ?? null);
      toast.success(status === 'active' ? 'Parent linked' : 'Request declined');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update the request');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 lg:p-8">
      <AccountTabs />
      <PageHeader
        eyebrow="My Account"
        title="Family"
        subtitle="Invite a parent or guardian so they can follow your competitions."
      />

      {/* Invite */}
      <Card className="gap-4 p-6">
        <h2 className="font-serif text-lg font-medium text-foreground">Invite a parent</h2>
        <p className="text-sm text-muted-foreground">
          We&apos;ll email them a 6-digit PIN. Once they sign up and enter it, their request
          shows below for you to approve.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[16rem] flex-1 space-y-1.5">
            <Label>Parent / guardian email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="parent@example.com"
              onKeyDown={(e) => e.key === 'Enter' && sendInvite()}
            />
          </div>
          <Button onClick={sendInvite} disabled={sending}>
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
            Send invite
          </Button>
        </div>
        {lastInvite?.debugPin && (
          <div className="rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            Dev mode — share PIN{' '}
            <span className="font-mono font-semibold text-foreground">
              {lastInvite.debugPin}
            </span>{' '}
            with {lastInvite.debugEmail} (email delivery is off in this environment).
          </div>
        )}
      </Card>

      {/* Pending approvals */}
      <Card className="gap-0 p-0">
        <div className="border-b p-5">
          <h2 className="font-serif text-lg font-medium text-foreground">Parent requests</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            People who entered your PIN and are waiting for you to link them.
          </p>
        </div>
        {!pending ? (
          <div className="flex items-center justify-center p-10">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : pending.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-10 text-center">
            <Users className="size-7 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No pending requests.</p>
          </div>
        ) : (
          pending.map((p, i) => (
            <div key={p.linkId} className={'flex flex-wrap items-center gap-3 p-5' + (i > 0 ? ' border-t' : '')}>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-foreground">{p.parentName || p.parentEmail}</p>
                <p className="text-sm text-muted-foreground">{p.parentEmail}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Requested {fmtDate(p.createdAt)}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === p.linkId}
                  onClick={() => respond(p, 'rejected')}
                >
                  <X className="size-4" />
                  Decline
                </Button>
                <Button
                  size="sm"
                  disabled={busy === p.linkId}
                  onClick={() => respond(p, 'active')}
                >
                  {busy === p.linkId ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  Approve
                </Button>
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
