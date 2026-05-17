'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { adminHttp } from '@/lib/api/client';
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

const LIMIT = 20;
const NO_AREA = '__none__';

interface Area {
  id: string;
  province: string;
  part: string | null;
  groupName: string | null;
  code: string | null;
  isActive: boolean;
}
interface TestCenter {
  id: string;
  areaId: string | null;
  areaProvince: string | null;
  code: string | null;
  name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  isActive: boolean;
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <Badge
      variant="outline"
      className={
        active
          ? 'border-transparent bg-emerald-100 font-mono text-[10px] text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
          : 'border-transparent bg-muted font-mono text-[10px] text-muted-foreground'
      }
    >
      {active ? 'Active' : 'Inactive'}
    </Badge>
  );
}

// ── Areas ─────────────────────────────────────────────────────────────────
const AREA_DEFAULTS = { province: '', part: '', groupName: '', code: '', isActive: true };

function AreasPanel() {
  const [rows, setRows] = useState<Area[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchVal, setSearchVal] = useState('');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(AREA_DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (search) qs.set('search', search);
      const r = await adminHttp.get<{ areas: Area[]; pagination: { total: number } }>(
        `/venues/areas?${qs}`,
      );
      setRows(r.areas ?? []);
      setTotal(r.pagination?.total ?? 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load areas');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditingId(null);
    setForm(AREA_DEFAULTS);
    setOpen(true);
  };
  const openEdit = (a: Area) => {
    setEditingId(a.id);
    setForm({
      province: a.province,
      part: a.part ?? '',
      groupName: a.groupName ?? '',
      code: a.code ?? '',
      isActive: a.isActive,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.province.trim()) return;
    setSaving(true);
    try {
      if (editingId) await adminHttp.put(`/admin/venues/areas/${editingId}`, form);
      else await adminHttp.post('/admin/venues/areas', form);
      toast.success(editingId ? 'Area saved.' : 'Area added.');
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save area');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a: Area) => {
    if (!confirm(`Delete area "${a.province}"?`)) return;
    setBusy(a.id);
    try {
      await adminHttp.delete(`/admin/venues/areas/${a.id}`);
      toast.success('Area removed.');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete area');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchVal.trim());
            setPage(1);
          }}
          className="flex gap-2"
        >
          <Input
            className="w-64"
            placeholder="Search province or code…"
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
          />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
        <Button onClick={openAdd}>
          <Plus className="size-4" />
          Add area
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Province</TableHead>
                <TableHead>Part</TableHead>
                <TableHead>Group</TableHead>
                <TableHead className="w-28">Code</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-28 text-center text-sm text-muted-foreground">
                    No areas yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium text-foreground">{a.province}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.part || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {a.groupName || '—'}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {a.code || '—'}
                    </TableCell>
                    <TableCell>
                      <ActiveBadge active={a.isActive} />
                    </TableCell>
                    <TableCell className="text-right">
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
        <Pager page={page} total={total} limit={LIMIT} onChange={setPage} />
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit area' : 'Add area'}</DialogTitle>
            <DialogDescription>A geographic region grouping test centers.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="mb-1.5 text-xs text-muted-foreground">
                Province <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.province}
                onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))}
                placeholder="DKI Jakarta"
              />
            </div>
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">Part</Label>
              <Input value={form.part} onChange={(e) => setForm((f) => ({ ...f, part: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">Group</Label>
              <Input
                value={form.groupName}
                onChange={(e) => setForm((f) => ({ ...f, groupName: e.target.value }))}
              />
            </div>
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">Code</Label>
              <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
            </div>
            <div className="flex items-end">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="size-4 accent-primary"
                />
                Active
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !form.province.trim()}>
              {saving ? 'Saving…' : editingId ? 'Save area' : 'Add area'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Test centers ──────────────────────────────────────────────────────────
const TC_DEFAULTS = {
  name: '',
  areaId: NO_AREA,
  code: '',
  address: '',
  city: '',
  phone: '',
  isActive: true,
};

function TestCentersPanel() {
  const [rows, setRows] = useState<TestCenter[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchVal, setSearchVal] = useState('');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(TC_DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
      if (search) qs.set('search', search);
      const r = await adminHttp.get<{ testCenters: TestCenter[]; pagination: { total: number } }>(
        `/venues/test-centers?${qs}`,
      );
      setRows(r.testCenters ?? []);
      setTotal(r.pagination?.total ?? 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load test centers');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    load();
  }, [load]);

  const openDialog = async (tc: TestCenter | null) => {
    if (tc) {
      setEditingId(tc.id);
      setForm({
        name: tc.name,
        areaId: tc.areaId ?? NO_AREA,
        code: tc.code ?? '',
        address: tc.address ?? '',
        city: tc.city ?? '',
        phone: tc.phone ?? '',
        isActive: tc.isActive,
      });
    } else {
      setEditingId(null);
      setForm(TC_DEFAULTS);
    }
    setOpen(true);
    try {
      const r = await adminHttp.get<{ areas: Area[] }>('/venues/areas?limit=100');
      setAreas(r.areas ?? []);
    } catch {
      setAreas([]);
    }
  };

  const save = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const body = { ...form, areaId: form.areaId === NO_AREA ? null : form.areaId };
      if (editingId) await adminHttp.put(`/admin/venues/test-centers/${editingId}`, body);
      else await adminHttp.post('/admin/venues/test-centers', body);
      toast.success(editingId ? 'Test center saved.' : 'Test center added.');
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save test center');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (tc: TestCenter) => {
    if (!confirm(`Delete test center "${tc.name}"?`)) return;
    setBusy(tc.id);
    try {
      await adminHttp.delete(`/admin/venues/test-centers/${tc.id}`);
      toast.success('Test center removed.');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete test center');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSearch(searchVal.trim());
            setPage(1);
          }}
          className="flex gap-2"
        >
          <Input
            className="w-64"
            placeholder="Search name, code or city…"
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
          />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
        <Button onClick={() => openDialog(null)}>
          <Plus className="size-4" />
          Add test center
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>City</TableHead>
                <TableHead className="w-28">Code</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-28 text-center text-sm text-muted-foreground">
                    No test centers yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((tc) => (
                  <TableRow key={tc.id}>
                    <TableCell className="font-medium text-foreground">{tc.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {tc.areaProvince || '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{tc.city || '—'}</TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {tc.code || '—'}
                    </TableCell>
                    <TableCell>
                      <ActiveBadge active={tc.isActive} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          onClick={() => openDialog(tc)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          disabled={busy === tc.id}
                          onClick={() => remove(tc)}
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit test center' : 'Add test center'}</DialogTitle>
            <DialogDescription>A physical venue where students sit exams.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="mb-1.5 text-xs text-muted-foreground">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Jakarta Testing Center 1"
              />
            </div>
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">Area</Label>
              <Select
                value={form.areaId}
                onValueChange={(v) => setForm((f) => ({ ...f, areaId: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_AREA}>No area</SelectItem>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.province}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">Code</Label>
              <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">City</Label>
              <Input value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
            </div>
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1.5 text-xs text-muted-foreground">Address</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
            <div className="flex items-end">
              <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                  className="size-4 accent-primary"
                />
                Active
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !form.name.trim()}>
              {saving ? 'Saving…' : editingId ? 'Save test center' : 'Add test center'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function VenuesPage() {
  const [tab, setTab] = useState('areas');
  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Management"
        title="Venues"
        subtitle="Geographic areas and the physical test centers where students sit exams."
      />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="areas">Areas</TabsTrigger>
          <TabsTrigger value="test-centers">Test Centers</TabsTrigger>
        </TabsList>
      </Tabs>
      {tab === 'areas' ? <AreasPanel /> : <TestCentersPanel />}
    </div>
  );
}
