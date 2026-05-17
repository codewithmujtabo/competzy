'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { competitionsApi } from '@/lib/api';
import type { Competition } from '@/types';
import { PageHeader } from '@/components/shell/page-header';
import { Pager } from '@/components/shell/pager';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const CATEGORIES = ['Science', 'Math', 'Art', 'Sports', 'Technology', 'Literature', 'Music'];
const FILTERS = [{ key: 'all', label: 'All' }, ...CATEGORIES.map((c) => ({ key: c, label: c }))];
const LIMIT = 15;

const FORM_DEFAULTS = {
  name: '',
  organizer_name: '',
  category: '',
  grade_level: '',
  fee: '0',
  description: '',
  reg_open_date: '',
  reg_close_date: '',
  competition_date: '',
};

function fmtForInput(d?: string) {
  if (!d) return '';
  return new Date(d).toISOString().split('T')[0];
}

function fmtDate(d?: string) {
  return d
    ? new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';
}

function Field({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 text-xs text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}

export default function CompetitionsPage() {
  const [comps, setComps] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [cat, setCat] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(FORM_DEFAULTS);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await competitionsApi.list({
        page,
        limit: LIMIT,
        category: cat === 'all' ? undefined : cat,
      });
      setComps(Array.isArray(r?.competitions) ? r.competitions : []);
      setTotal(r?.pagination?.total ?? 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load competitions');
      setComps([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, cat]);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditId(null);
    setForm({ ...FORM_DEFAULTS });
    setShowForm(true);
  };

  const openEdit = (c: Competition) => {
    setEditId(c.id);
    setForm({
      name: c.name,
      organizer_name: c.organizer_name,
      category: c.category || '',
      grade_level: c.grade_level || '',
      fee: String(c.fee ?? 0),
      description: c.description || '',
      reg_open_date: fmtForInput(c.reg_open_date),
      reg_close_date: fmtForInput(c.reg_close_date),
      competition_date: fmtForInput(c.competition_date),
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name || !form.organizer_name) return;
    setSaving(true);
    try {
      const payload = { ...form, fee: parseInt(form.fee, 10) || 0 };
      if (editId) {
        await competitionsApi.update(editId, payload);
        toast.success('Competition updated.');
      } else {
        await competitionsApi.create(payload);
        toast.success('Competition created.');
      }
      setShowForm(false);
      setEditId(null);
      setForm({ ...FORM_DEFAULTS });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save competition');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await competitionsApi.delete(id);
      toast.success('Competition deleted.');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete competition');
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Management"
        title="Competitions"
        subtitle="Create and manage the competitions listed on Competzy."
        actions={
          <Button onClick={openAdd}>
            <Plus className="size-4" />
            New competition
          </Button>
        }
      />

      <Tabs
        value={cat}
        onValueChange={(v) => {
          setCat(v);
          setPage(1);
        }}
      >
        <TabsList>
          {FILTERS.map((f) => (
            <TabsTrigger key={f.key} value={f.key}>
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Organizer</TableHead>
                <TableHead>Fee</TableHead>
                <TableHead>Reg. closes</TableHead>
                <TableHead>Event date</TableHead>
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
              ) : comps.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-sm text-muted-foreground">
                    No competitions found.
                  </TableCell>
                </TableRow>
              ) : (
                comps.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="max-w-[260px]">
                      <div className="truncate font-medium text-foreground">{c.name}</div>
                      {c.grade_level && (
                        <div className="text-xs text-muted-foreground">{c.grade_level}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.category ? (
                        <Badge variant="secondary" className="font-normal">
                          {c.category}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">{c.organizer_name}</TableCell>
                    <TableCell>
                      {c.fee === 0 ? (
                        <Badge
                          variant="outline"
                          className="border-transparent bg-emerald-100 font-mono text-[10px] text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                        >
                          Free
                        </Badge>
                      ) : (
                        <span className="text-sm tabular-nums">Rp {c.fee.toLocaleString('id-ID')}</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {fmtDate(c.reg_close_date)}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {fmtDate(c.competition_date)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                          <Pencil className="size-3.5" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => remove(c.id, c.name)}
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
        <Pager page={page} total={total} limit={LIMIT} onChange={setPage} />
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editId ? 'Edit competition' : 'New competition'}</DialogTitle>
            <DialogDescription>
              {editId
                ? 'Update the competition details below.'
                : 'Add a new competition to the Competzy catalog.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-6">
            <Field label="Name" required className="sm:col-span-4">
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Olimpiade Matematika Nasional"
              />
            </Field>
            <Field label="Category" className="sm:col-span-2">
              <Select
                value={form.category || undefined}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select…" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Organizer" required className="sm:col-span-3">
              <Input
                value={form.organizer_name}
                onChange={(e) => setForm((f) => ({ ...f, organizer_name: e.target.value }))}
                placeholder="EMC Organizer"
              />
            </Field>
            <Field label="Grade level" className="sm:col-span-2">
              <Input
                value={form.grade_level}
                onChange={(e) => setForm((f) => ({ ...f, grade_level: e.target.value }))}
                placeholder="SMP, SMA"
              />
            </Field>
            <Field label="Fee (IDR)" className="sm:col-span-1">
              <Input
                type="number"
                value={form.fee}
                onChange={(e) => setForm((f) => ({ ...f, fee: e.target.value }))}
              />
            </Field>

            <Field label="Reg. opens" className="sm:col-span-2">
              <Input
                type="date"
                value={form.reg_open_date}
                onChange={(e) => setForm((f) => ({ ...f, reg_open_date: e.target.value }))}
              />
            </Field>
            <Field label="Reg. closes" className="sm:col-span-2">
              <Input
                type="date"
                value={form.reg_close_date}
                onChange={(e) => setForm((f) => ({ ...f, reg_close_date: e.target.value }))}
              />
            </Field>
            <Field label="Event date" className="sm:col-span-2">
              <Input
                type="date"
                value={form.competition_date}
                onChange={(e) => setForm((f) => ({ ...f, competition_date: e.target.value }))}
              />
            </Field>

            <Field label="Description" className="sm:col-span-6">
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Describe the competition…"
                className="flex min-h-20 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !form.name || !form.organizer_name}>
              {saving ? 'Saving…' : editId ? 'Save changes' : 'Create competition'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
