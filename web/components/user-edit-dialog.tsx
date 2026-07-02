'use client';

// Admin Edit User dialog — the comprehensive form:
//   • Identity (all roles): full name, email, phone, city, country
//   • Role switcher — SUPER-ADMIN ONLY (backend-enforced too); switching
//     shows the target role's sections immediately so role + details save
//     in one go
//   • Student → grade (1-12), NISN, date of birth, school picker
//   • Teacher → school picker + free-text school name, subject, department
//   • School Admin → school picker
//   • Parent → linked-student list with Add by email
//   • Country Rep → outbound link to /country-reps

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, ShieldAlert, Trash2 } from 'lucide-react';

import { schoolsApi, usersApi } from '@/lib/api';
import { useAuth } from '@/lib/auth/context';
import type { School, User } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { CountrySelect } from '@/components/ui/country-select';
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

const ALL_ROLES = [
  'student',
  'parent',
  'teacher',
  'school_admin',
  'organizer',
  'country_representative',
  'question_maker',
  'manager',
  'admin',
] as const;

const GRADES = Array.from({ length: 12 }, (_, i) => String(i + 1));

function roleLabel(r: string): string {
  return r.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function UserEditDialog({ userId, onClose, onSaved }: Props) {
  const { user: me } = useAuth();
  const isSuperAdmin = !!me?.isSuperAdmin;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [u, setU] = useState<
    (User & { school_id?: string | null; school_name?: string | null; country?: string | null }) | null
  >(null);
  const [linkedStudents, setLinkedStudents] = useState<
    Array<{ id: string; full_name: string; email: string }>
  >([]);

  // Identity
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState<string | null>(null);

  // Role (super-admin only; drives which sections render)
  const [role, setRole] = useState<string>('student');

  // Role-specific
  const [schoolId, setSchoolId] = useState<string>('__none__');
  const [grade, setGrade] = useState<string>('__none__');
  const [nisn, setNisn] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [teacherSchool, setTeacherSchool] = useState('');
  const [subject, setSubject] = useState('');
  const [department, setDepartment] = useState('');

  // Schools loaded lazily — only when the (selected) role uses a picker.
  const [schools, setSchools] = useState<School[] | null>(null);

  // Parent ↔ student linking state.
  const [linkEmail, setLinkEmail] = useState('');
  const [linking, setLinking] = useState(false);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

  const ensureSchools = useCallback(async () => {
    if (schools) return;
    const r = await schoolsApi.list({ limit: 500 });
    setSchools(r.schools ?? []);
  }, [schools]);

  const load = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { user, linkedStudents, studentDetail, teacherDetail } = await usersApi.get(userId);
      setU(user);
      setLinkedStudents(linkedStudents);
      setFullName(user.full_name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setCity(user.city || '');
      setCountry(user.country ?? null);
      setRole(user.role);
      setSchoolId(user.school_id ?? '__none__');
      setGrade(studentDetail?.grade ? String(studentDetail.grade) : '__none__');
      setNisn(studentDetail?.nisn ?? '');
      setDateOfBirth(
        studentDetail?.date_of_birth ? String(studentDetail.date_of_birth).slice(0, 10) : '',
      );
      setTeacherSchool(teacherDetail?.school ?? '');
      setSubject(teacherDetail?.subject ?? '');
      setDepartment(teacherDetail?.department ?? '');
      if (SCHOOL_ROLES.has(user.role)) await ensureSchools();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load user');
      onClose();
    } finally {
      setLoading(false);
    }
  }, [userId, onClose, ensureSchools]);

  useEffect(() => {
    if (userId) void load();
  }, [userId, load]);

  // Switching the role select to a school-bearing role needs the picker data.
  useEffect(() => {
    if (SCHOOL_ROLES.has(role)) void ensureSchools();
  }, [role, ensureSchools]);

  const roleChanged = !!u && role !== u.role;

  async function handleSave() {
    if (!u) return;
    setSaving(true);
    try {
      await usersApi.update(u.id, {
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        city: city.trim() || null,
        country,
        ...(isSuperAdmin && roleChanged ? { role } : {}),
        schoolId: SCHOOL_ROLES.has(role)
          ? schoolId === '__none__'
            ? null
            : schoolId
          : undefined,
        ...(role === 'student'
          ? {
              grade: grade === '__none__' ? null : grade,
              nisn: nisn.trim() || null,
              dateOfBirth: dateOfBirth || null,
            }
          : {}),
        ...(role === 'teacher'
          ? {
              teacherSchool: teacherSchool.trim() || null,
              subject: subject.trim() || null,
              department: department.trim() || null,
            }
          : {}),
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
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>
            Update identity, role, and role-specific assignments.
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
            {/* ── Identity ─────────────────────────────────────────────── */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="user-name">Full name</Label>
                <Input
                  id="user-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full name"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="user-email">Email</Label>
                <Input
                  id="user-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@email.com"
                />
                <p className="text-[11px] text-muted-foreground">
                  The sign-in identity. Changing it takes effect immediately.
                </p>
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
              <div className="space-y-2">
                <Label htmlFor="user-city">City</Label>
                <Input
                  id="user-city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="City"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Country</Label>
                <CountrySelect value={country} onChange={setCountry} />
              </div>
            </div>

            {/* ── Role — super-admin only ──────────────────────────────── */}
            {isSuperAdmin ? (
              <div className="space-y-2 rounded-md border border-warning/60 bg-warning/10 p-3">
                <Label>Role</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALL_ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {roleLabel(r)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {roleChanged && (
                  <p className="flex items-start gap-1.5 text-[11px] text-foreground">
                    <ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-warning-foreground" />
                    Changing {roleLabel(u.role)} to {roleLabel(role)} changes everything this
                    account can access, effective immediately after saving.
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                Role: <span className="font-mono capitalize">{roleLabel(u.role)}</span>
                <span className="ml-1">(only the super-admin can change roles)</span>
              </div>
            )}

            {/* ── Student ──────────────────────────────────────────────── */}
            {role === 'student' && (
              <div className="grid gap-4 rounded-md border bg-muted/20 p-3 sm:grid-cols-2">
                <p className="text-sm font-medium sm:col-span-2">Student details</p>
                <div className="space-y-2">
                  <Label>Grade (class)</Label>
                  <Select value={grade} onValueChange={setGrade}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Grade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Not set</SelectItem>
                      {GRADES.map((g) => (
                        <SelectItem key={g} value={g}>
                          Grade {g}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-nisn">NISN</Label>
                  <Input
                    id="user-nisn"
                    value={nisn}
                    onChange={(e) => setNisn(e.target.value)}
                    placeholder="10 digits"
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="user-dob">Date of birth</Label>
                  <Input
                    id="user-dob"
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                  />
                </div>
              </div>
            )}

            {/* ── Teacher ──────────────────────────────────────────────── */}
            {role === 'teacher' && (
              <div className="grid gap-4 rounded-md border bg-muted/20 p-3 sm:grid-cols-2">
                <p className="text-sm font-medium sm:col-span-2">Teacher details</p>
                <div className="space-y-2">
                  <Label htmlFor="user-tschool">School name (free text)</Label>
                  <Input
                    id="user-tschool"
                    value={teacherSchool}
                    onChange={(e) => setTeacherSchool(e.target.value)}
                    placeholder="School name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="user-subject">Subject</Label>
                  <Input
                    id="user-subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Mathematics"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="user-dept">Department</Label>
                  <Input
                    id="user-dept"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="Department"
                  />
                </div>
              </div>
            )}

            {/* ── School association (student / teacher / school admin) ── */}
            {SCHOOL_ROLES.has(role) && (
              <div className="space-y-2">
                <Label>Associated school</Label>
                <Select value={schoolId} onValueChange={setSchoolId}>
                  <SelectTrigger className="w-full">
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
                  Linking a {roleLabel(role).toLowerCase()} to a school enables school-scoped
                  features (bulk registration, achievement PDF, school dashboard).
                </p>
              </div>
            )}

            {/* ── Parent: linked students ──────────────────────────────── */}
            {role === 'parent' && (
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

            {/* ── Country rep pointer ──────────────────────────────────── */}
            {role === 'country_representative' && (
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
