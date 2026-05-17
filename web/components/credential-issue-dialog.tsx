'use client';

// Issues / edits the affiliated-competition access credential for one
// registration (Wave 5 Phase 2b). The username + password the student
// carries to the affiliated competition's external site.

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';

import { organizerHttp } from '@/lib/auth/organizer-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Ambiguous-character-free alphabet for a readable generated password.
function randomPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function CredentialIssueDialog({
  registrationId,
  studentName,
  existing,
  onClose,
  onSaved,
}: {
  registrationId: string | null;
  studentName: string;
  existing: { username: string; password: string } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (registrationId) {
      setUsername(existing?.username ?? '');
      setPassword(existing?.password ?? '');
    }
  }, [registrationId, existing]);

  const save = async () => {
    if (!registrationId || !username.trim() || !password.trim()) return;
    setSaving(true);
    try {
      await organizerHttp.post(`/registrations/${registrationId}/credentials`, {
        username: username.trim(),
        password: password.trim(),
      });
      toast.success('Credentials issued — the student can now see them.');
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to issue credentials');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!registrationId} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? 'Edit' : 'Issue'} access credentials</DialogTitle>
          <DialogDescription>
            The login {studentName} will use to sign in to the affiliated competition&apos;s
            external site.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="mb-1.5 text-xs text-muted-foreground">Username</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Login the partner platform expects"
            />
          </div>
          <div>
            <Label className="mb-1.5 text-xs text-muted-foreground">Password</Label>
            <div className="flex gap-2">
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Generate a password"
                onClick={() => setPassword(randomPassword())}
              >
                <RefreshCw className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving || !username.trim() || !password.trim()}>
            {saving ? 'Saving…' : existing ? 'Save credentials' : 'Issue credentials'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
