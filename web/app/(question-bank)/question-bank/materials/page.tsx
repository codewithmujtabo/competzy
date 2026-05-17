'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { FileText, Pencil, Plus, Trash2, Upload } from 'lucide-react';
import { marketingHttp } from '@/lib/api/client';
import { useQuestionBank } from '@/lib/question-bank/context';
import { useQuestionBankAuth } from '@/lib/auth/question-bank-context';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
const GRADES = ['SD', 'SMP', 'SMA'];
const TEXTAREA_CLS =
  'flex min-h-20 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

interface Material {
  id: string;
  compId: string | null;
  title: string;
  body: string | null;
  category: string | null;
  grades: string[];
  file: string | null;
  isActive: boolean;
  publishedAt: string | null;
}

const DEFAULTS = {
  title: '',
  category: '',
  body: '',
  grades: [] as string[],
  isActive: true,
  published: true,
};

export default function MaterialsPage() {
  const { competitions, loading: compsLoading } = useQuestionBank();
  const { user } = useQuestionBankAuth();
  const isAdmin = user?.role === 'admin';

  const [scope, setScope] = useState('');
  const [rows, setRows] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Material | null>(null);
  const [form, setForm] = useState(DEFAULTS);
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
      const r = await marketingHttp.get<Material[]>(
        `/marketing/materials?compId=${encodeURIComponent(scope)}`,
      );
      setRows(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load materials');
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
    setFile(null);
    setFileName(null);
    setOpen(true);
  };
  const openEdit = (m: Material) => {
    setEditing(m);
    setForm({
      title: m.title,
      category: m.category ?? '',
      body: m.body ?? '',
      grades: m.grades ?? [],
      isActive: m.isActive,
      published: !!m.publishedAt,
    });
    setFile(null);
    setFileName(m.file ? 'Current file attached' : null);
    setOpen(true);
  };

  const toggleGrade = (g: string) =>
    setForm((f) => ({
      ...f,
      grades: f.grades.includes(g) ? f.grades.filter((x) => x !== g) : [...f.grades, g],
    }));

  const pickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      toast.error('File must be 10 MB or smaller.');
      return;
    }
    setFile(f);
    setFileName(f.name);
  };

  const save = async () => {
    if (!form.title.trim() || !scope) return;
    setSaving(true);
    try {
      const body = {
        compId: scope,
        title: form.title.trim(),
        body: form.body.trim() || null,
        category: form.category.trim() || null,
        grades: form.grades,
        isActive: form.isActive,
        published: form.published,
      };
      const saved = editing
        ? await marketingHttp.put<Material>(`/marketing/materials/${editing.id}`, body)
        : await marketingHttp.post<Material>('/marketing/materials', body);
      if (file) {
        const fd = new FormData();
        fd.append('file', file);
        await marketingHttp.postFormData(`/marketing/materials/${saved.id}/upload?kind=file`, fd);
      }
      toast.success(editing ? 'Material saved.' : 'Material created.');
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save material');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (m: Material) => {
    if (!confirm(`Delete "${m.title}"?`)) return;
    setBusy(m.id);
    try {
      await marketingHttp.delete(`/marketing/materials/${m.id}`);
      toast.success('Material removed.');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete material');
    } finally {
      setBusy(null);
    }
  };

  if (!compsLoading && competitions.length === 0 && !isAdmin) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
        <PageHeader eyebrow="Marketing" title="Materials" />
        <Card className="p-12 text-center">
          <p className="text-sm font-medium text-foreground">No competitions to manage</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Marketing"
        title="Materials"
        subtitle="The study-material library shown to students — per-competition or platform-wide."
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select value={scope} onValueChange={setScope}>
          <SelectTrigger className="w-full sm:w-72">
            <SelectValue placeholder="Select a scope…" />
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
          New material
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead className="w-40">Category</TableHead>
                <TableHead className="w-40">Grades</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-9 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-sm text-muted-foreground">
                    No materials for this scope yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((m) => (
                  <TableRow key={m.id} className="cursor-pointer" onClick={() => openEdit(m)}>
                    <TableCell>
                      <span className="font-medium text-foreground">{m.title}</span>
                      {m.file && <FileText className="ml-2 inline size-3.5 text-muted-foreground" />}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {m.category || '—'}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {m.grades.length ? m.grades.join(', ') : 'All grades'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          m.publishedAt
                            ? 'border-transparent bg-emerald-100 font-mono text-[10px] text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                            : 'border-transparent bg-muted font-mono text-[10px] text-muted-foreground'
                        }
                      >
                        {m.publishedAt ? 'Published' : 'Draft'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="size-8" onClick={() => openEdit(m)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          disabled={busy === m.id}
                          onClick={() => remove(m)}
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
            <DialogTitle>{editing ? 'Edit material' : 'New material'}</DialogTitle>
            <DialogDescription>
              {scope === PLATFORM
                ? 'Platform-wide — shown in every competition’s library.'
                : 'Shown in this competition’s study-material library.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5 text-xs text-muted-foreground">
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div>
                <Label className="mb-1.5 text-xs text-muted-foreground">Category</Label>
                <Input
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  placeholder="Past Papers"
                />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">Description</Label>
              <textarea
                className={TEXTAREA_CLS}
                value={form.body}
                onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">
                Target grades{' '}
                <span className="font-normal text-muted-foreground/70">— none = all grades</span>
              </Label>
              <div className="flex gap-2">
                {GRADES.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggleGrade(g)}
                    className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                      form.grades.includes(g)
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-input text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">File</Label>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                onChange={pickFile}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="size-3.5" />
                {fileName ? 'Replace file' : 'Upload file'}
              </Button>
              {fileName && <span className="ml-2 text-xs text-muted-foreground">{fileName}</span>}
            </div>
            <div className="flex gap-4">
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
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="size-4 accent-primary"
                />
                Visible
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !form.title.trim()}>
              {saving ? 'Saving…' : editing ? 'Save material' : 'Create material'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
