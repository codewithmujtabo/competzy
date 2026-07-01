'use client';
import { QuestionBankProvider } from '@/lib/question-bank/context';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ImageIcon, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { marketingHttp } from '@/lib/api/client';
import { useQuestionBank } from '@/lib/question-bank/context';
import { useAuth } from '@/lib/auth/context';
import { PageHeader } from '@/components/shell/page-header';
import { useT } from '@/lib/i18n/context';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BilingualInput } from '@/components/ui/bilingual-input';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const PLATFORM = 'platform';
const TEXTAREA_CLS =
  'flex min-h-28 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

interface Announcement {
  id: string;
  compId: string | null;
  title: string;
  titleId: string | null;
  body: string | null;
  bodyId: string | null;
  type: string | null;
  image: string | null;
  isActive: boolean;
  isFeatured: boolean;
  publishedAt: string | null;
  createdAt: string;
  // Open-tracking analytics (operator list only).
  opens?: number;
  reach?: number;
}

const DEFAULTS = {
  title: '',
  titleId: '',
  type: '',
  body: '',
  bodyId: '',
  isActive: true,
  isFeatured: false,
  published: true,
  notify: false,
};

function fmtDate(s: string | null) {
  if (!s) return '-';
  return new Date(s).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function AnnouncementsPage() {
  const t = useT();
  const { competitions, loading: compsLoading } = useQuestionBank();
  // After the (question-bank) → (dashboard) move (PR #33), this page sits in
  // the admin route group — read the role from the admin auth context, not
  // from useQuestionBankAuth (whose provider isn't mounted here, so the
  // missing-provider error was crashing the whole page).
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [scope, setScope] = useState('');
  const [rows, setRows] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState(DEFAULTS);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Default the scope once competitions resolve.
  useEffect(() => {
    if (scope) return;
    if (competitions.length > 0) setScope(competitions[0].id);
    else if (isAdmin) setScope(PLATFORM);
  }, [competitions, isAdmin, scope]);

  const load = useCallback(async () => {
    if (!scope) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const r = await marketingHttp.get<Announcement[]>(
        `/marketing/announcements?compId=${encodeURIComponent(scope)}`,
      );
      setRows(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm(DEFAULTS);
    setImageFile(null);
    setImagePreview(null);
    setOpen(true);
  };
  const openEdit = (a: Announcement) => {
    setEditing(a);
    setForm({
      title: a.title,
      titleId: a.titleId ?? '',
      type: a.type ?? '',
      body: a.body ?? '',
      bodyId: a.bodyId ?? '',
      isActive: a.isActive,
      isFeatured: a.isFeatured,
      published: !!a.publishedAt,
      notify: false,
    });
    setImageFile(null);
    setImagePreview(a.image);
    setOpen(true);
  };

  const pickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be 10 MB or smaller.');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const save = async () => {
    if (!form.title.trim() || !scope) return;
    setSaving(true);
    try {
      const body = {
        compId: scope,
        title: form.title.trim(),
        titleId: form.titleId.trim() || null,
        body: form.body.trim() || null,
        bodyId: form.bodyId.trim() || null,
        type: form.type.trim() || null,
        isActive: form.isActive,
        isFeatured: form.isFeatured,
        published: form.published,
        notify: form.notify,
      };
      const saved = editing
        ? await marketingHttp.put<Announcement>(`/marketing/announcements/${editing.id}`, body)
        : await marketingHttp.post<Announcement>('/marketing/announcements', body);
      if (imageFile) {
        const fd = new FormData();
        fd.append('file', imageFile);
        await marketingHttp.postFormData(
          `/marketing/announcements/${saved.id}/upload?kind=image`,
          fd,
        );
      }
      toast.success(editing ? 'Announcement saved.' : 'Announcement created.');
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save announcement');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a: Announcement) => {
    if (!confirm(`Delete "${a.title}"?`)) return;
    setBusy(a.id);
    try {
      await marketingHttp.delete(`/marketing/announcements/${a.id}`);
      toast.success('Announcement removed.');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete announcement');
    } finally {
      setBusy(null);
    }
  };

  if (!compsLoading && competitions.length === 0 && !isAdmin) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
        <PageHeader eyebrow={t('opnav.marketing')} title={t('opnav.announcements')} />
        <Card className="p-12 text-center">
          <p className="text-sm font-medium text-foreground">{t('adm.noNativeComps')}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow={t('opnav.marketing')}
        title={t('opnav.announcements')}
        subtitle={t('adm.ann.subtitle')}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select value={scope} onValueChange={setScope}>
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue placeholder={t('adm.selectScope')} />
          </SelectTrigger>
          <SelectContent>
            {competitions.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
            {isAdmin && <SelectItem value={PLATFORM}>Platform-wide (all competitions)</SelectItem>}
          </SelectContent>
        </Select>
        <Button onClick={openAdd} disabled={!scope}>
          <Plus className="size-4" />
          New announcement
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[1024px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t('adm.colTitle')}</TableHead>
                <TableHead className="w-28">Type</TableHead>
                <TableHead className="w-32">Status</TableHead>
                <TableHead className="w-32">Published</TableHead>
                <TableHead className="w-32">{t('adm.colOpens')}</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-9 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-sm text-muted-foreground">
                    {t('adm.ann.noAnnouncements')}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((a) => (
                  <TableRow key={a.id} className="cursor-pointer" onClick={() => openEdit(a)}>
                    <TableCell>
                      <span className="font-medium text-foreground">{a.title}</span>
                      {a.isFeatured && (
                        <Badge className="ml-2 bg-amber-500 text-[10px] text-white">Featured</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.type || '-'}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          a.publishedAt
                            ? 'border-transparent bg-emerald-100 font-mono text-[10px] text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                            : 'border-transparent bg-muted font-mono text-[10px] text-muted-foreground'
                        }
                      >
                        {a.publishedAt ? 'Published' : 'Draft'}
                        {!a.isActive && ' · hidden'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {fmtDate(a.publishedAt)}
                    </TableCell>
                    <TableCell className="text-sm">
                      <span className="font-medium text-foreground">{a.opens ?? 0}</span>
                      <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">
                        {(a.reach ?? 0) > 0
                          ? `${Math.round(((a.opens ?? 0) / (a.reach ?? 1)) * 100)}% ${t('adm.ofReach', { reach: a.reach ?? 0 })}`
                          : t('adm.noReach')}
                      </span>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="size-8" onClick={() => openEdit(a)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          disabled={busy === a.id}
                          onClick={() => remove(a)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit announcement' : 'New announcement'}</DialogTitle>
            <DialogDescription>
              {scope === PLATFORM
                ? 'Platform-wide, shown in every competition portal.'
                : 'Shown in this competition’s portal.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <BilingualInput
              label="Title"
              required
              value={form.title}
              valueId={form.titleId}
              onChange={(v) => setForm((f) => ({ ...f, title: v }))}
              onChangeId={(v) => setForm((f) => ({ ...f, titleId: v }))}
            />
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">Type</Label>
              <Input
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                placeholder="news"
                className="sm:max-w-[12rem]"
              />
            </div>
            <BilingualInput
              label="Body"
              textarea
              value={form.body}
              valueId={form.bodyId}
              onChange={(v) => setForm((f) => ({ ...f, body: v }))}
              onChangeId={(v) => setForm((f) => ({ ...f, bodyId: v }))}
              placeholder="The announcement text shown to students."
            />
            <div className="flex items-center gap-4">
              {imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imagePreview}
                  alt="preview"
                  className="size-16 rounded-md border bg-muted object-cover"
                />
              ) : (
                <div className="flex size-16 items-center justify-center rounded-md border bg-muted text-muted-foreground">
                  <ImageIcon className="size-5" />
                </div>
              )}
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={pickImage}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="size-3.5" />
                  {imagePreview ? 'Change image' : 'Add image'}
                </Button>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={form.published}
                  onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))}
                  className="size-4 accent-primary"
                />
                Published
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={form.isFeatured}
                  onChange={(e) => setForm((f) => ({ ...f, isFeatured: e.target.checked }))}
                  className="size-4 accent-primary"
                />
                Featured
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="size-4 accent-primary"
                />
                Visible
              </label>
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={form.notify}
                  onChange={(e) => setForm((f) => ({ ...f, notify: e.target.checked }))}
                  className="size-4 accent-primary"
                />
                Also notify students
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !form.title.trim()}>
              {saving ? 'Saving…' : editing ? 'Save announcement' : 'Create announcement'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Mounted under /(dashboard) so the surrounding layout is the admin shell.
// QuestionBankProvider still wraps the page so the existing competition
// picker keeps working — moving these pages out of /question-bank doesn't
// change how they fetch the operator's competitions.
export default function AnnouncementsPageWithProvider() {
  return (
    <QuestionBankProvider>
      <AnnouncementsPage />
    </QuestionBankProvider>
  );
}
