'use client';

// Admin Edit User dialog — common identity fields + role-specific
// assignment widgets:
//   • Student / Teacher / School Admin → school picker (single)
//   • Parent → linked-student list with Add by email
//   • Country Rep → an outbound link to /country-reps (multi-comp/country
//     management lives there, not in this dialog)

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2 } from 'lucide-react';

import { schoolsApi, usersApi } from '@/lib/api';
import type { School, User } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Props {
  userId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

const SCHOOL_ROLES = new Set(['student', 'teacher', 'school_admin']);

export function UserEditDialog({ userId, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [u, setU] = useState<
    (User & { school_id?: string | null; school_name?: string | null }) | null
  >(null);
  const [linkedStudents, setLinkedStudents] = useState<
    Array<{ id: string; full_name: string; email: string }>
  >([]);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [schoolId, setSchoolId] = useState<string>('__none__');

  // Schools loaded lazily — only when the role uses a school picker.
  const [schools, setSchools] = useState<School[] | null>(null);

  // Parent ↔ student linking state.
  const [linkEmail, setLinkEmail] = useState('');
  const [linking, setLinking] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { user, linkedStudents } = await usersApi.get(userId);
      setU(user);
      setLinkedStudents(linkedStudents);
      setFullName(user.full_name || '');
      setPhone(user.phone || '');
      setSchoolId(user.school_id ?? '__none__');
      if (SCHOOL_ROLES.has(user.role)) {
        // Pull verified schools so admin can re-assign cleanly.
        const r = await schoolsApi.list({ limit: 500 });
        setSchools(r.schools ?? []);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load user');
      onClose();
    } finally {
      setLoading(false);
    }
  }, [userId, onClose]);

  useEffect(() => {
    if (userId) void load();
  }, [userId, load]);

  async function handleSave() {
    if (!u) return;
    setSaving(true);
    try {
      await usersApi.update(u.id, {
        fullName: fullName.trim(),
        phone: phone.trim() || null,
        schoolId: SCHOOL_ROLES.has(u.role)
          ? schoolId === '__none__'
            ? null
            : schoolId
          : undefined,
      });
      toast.success('User updated');
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update user');
    } finally {
      setSaving(false);
    }
  }

  async function handleLink() {
    if (!u || !linkEmail.trim()) return;
    setLinking(true);
    try {
      await usersApi.linkStudent(u.id, linkEmail.trim());
      toast.success('Student linked');
      setLinkEmail('');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to link student');
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlink(studentId: string) {
    if (!u) return;
    setUnlinkingId(studentId);
    try {
      await usersApi.unlinkStudent(u.id, studentId);
      toast.success('Student unlinked');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to unlink student');
    } finally {
      setUnlinkingId(null);
    }
  }

  return (
    <Dialog open={!!userId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>
            Update profile details and role-specific assignments.
          </DialogDescription>
        </DialogHeader>

        {loading || !u ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <div className="flex items-center justify-between">
                <span className="font-mono">{u.email}</span>
                <span className="font-mono capitalize">{u.role.replace(/_/g, ' ')}</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-name">Full name</Label>
              <Input
                id="user-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Full name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="user-phone">Phone</Label>
              <Input
                id="user-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="08xxx or +628xxx"
                inputMode="tel"
              />
            </div>

            {SCHOOL_ROLES.has(u.role) && (
              <div className="space-y-2">
                <Label>Associated school</Label>
                <Select value={schoolId} onValueChange={setSchoolId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a school" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="__none__">No school</SelectItem>
                    {(schools ?? []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                        {s.npsn ? ` (${s.npsn})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Linking a {u.role.replace(/_/g, ' ')} to a school enables school-scoped
                  features (bulk registration, achievement PDF, school dashboard).
                </p>
              </div>
            )}

            {u.role === 'parent' && (
              <div className="space-y-3 rounded-md border bg-muted/20 p-3">
                <div>
                  <p className="text-sm font-medium">Linked students</p>
                  <p className="text-xs text-muted-foreground">
                    Parent can monitor + pay for any linked student.
                  </p>
                </div>
                {linkedStudents.length === 0 ? (
                  <p className="text-xs italic text-muted-foreground">No students linked yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {linkedStudents.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between gap-2 rounded-md bg-background px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{s.full_name || s.email}</p>
                          <p className="truncate font-mono text-[11px] text-muted-foreground">
                            {s.email}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-destructive"
                          disabled={unlinkingId === s.id}
                          onClick={() => handleUnlink(s.id)}
                          aria-label={`Unlink ${s.email}`}
                        >
                          {unlinkingId === s.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex gap-2">
                  <Input
                    value={linkEmail}
                    onChange={(e) => setLinkEmail(e.target.value)}
                    placeholder="Student email"
                    type="email"
                  />
                  <Button onClick={handleLink} disabled={linking || !linkEmail.trim()}>
                    {linking ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                    Link
                  </Button>
                </div>
              </div>
            )}

            {u.role === 'country_representative' && (
              <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs text-foreground">
                <p className="font-medium">Country &amp; competition assignments</p>
                <p className="mt-1 text-muted-foreground">
                  Country reps manage their country/competition pairings in the{' '}
                  <a href="/country-reps" className="font-medium text-primary hover:underline">
                    Country Reps
                  </a>{' '}
                  page.
                </p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loading || !u}>
            {saving && <Loader2 className="size-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
