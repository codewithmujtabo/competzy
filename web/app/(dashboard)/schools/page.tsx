'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, Search, X } from 'lucide-react';
import { schoolsApi } from '@/lib/api';
import type { School } from '@/types';
import { PageHeader } from '@/components/shell/page-header';
import { Pager } from '@/components/shell/pager';
import { Card } from '@/components/ui/card';
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

const LIMIT = 20;
const FORM_DEFAULTS = { npsn: '', name: '', city: '', province: '', address: '' };

export default function SchoolsPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchVal, setSearchVal] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(FORM_DEFAULTS);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await schoolsApi.list({ page, limit: LIMIT, search: search || undefined });
      setSchools(r?.schools ?? []);
      setTotal(r?.pagination?.total ?? 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load schools');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!form.npsn || !form.name) return;
    setSaving(true);
    try {
      await schoolsApi.create(form);
      toast.success('School added.');
      setShowAdd(false);
      setForm(FORM_DEFAULTS);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add school');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Management"
        title="Schools"
        subtitle="The directory of schools registered on Competzy."
        actions={
          <Button
            onClick={() => {
              setForm(FORM_DEFAULTS);
              setShowAdd(true);
            }}
          >
            <Plus className="size-4" />
            Add school
          </Button>
        }
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(searchVal.trim());
          setPage(1);
        }}
        className="flex gap-2"
      >
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="w-72 pl-9"
            placeholder="Search name, city, NPSN…"
            value={searchVal}
            onChange={(e) => setSearchVal(e.target.value)}
          />
        </div>
        <Button type="submit" variant="outline">
          Search
        </Button>
        {search && (
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setSearch('');
              setSearchVal('');
              setPage(1);
            }}
          >
            <X className="size-4" />
            Clear
          </Button>
        )}
      </form>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>NPSN</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Province</TableHead>
                <TableHead>Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : schools.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-sm text-muted-foreground">
                    No schools found.
                  </TableCell>
                </TableRow>
              ) : (
                schools.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-[12px] text-muted-foreground">{s.npsn}</TableCell>
                    <TableCell className="font-medium text-foreground">{s.name}</TableCell>
                    <TableCell>{s.city || '—'}</TableCell>
                    <TableCell>{s.province || '—'}</TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {s.created_at
                        ? new Date(s.created_at).toLocaleDateString('en-US', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <Pager page={page} total={total} limit={LIMIT} onChange={setPage} />
      </Card>

      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add school</DialogTitle>
            <DialogDescription>Manually add a school to the Competzy directory.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">
                NPSN <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.npsn}
                onChange={(e) => setForm((f) => ({ ...f, npsn: e.target.value }))}
                placeholder="12345678"
              />
            </div>
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="SDN 001 Jakarta"
              />
            </div>
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">City</Label>
              <Input
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                placeholder="Jakarta"
              />
            </div>
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">Province</Label>
              <Input
                value={form.province}
                onChange={(e) => setForm((f) => ({ ...f, province: e.target.value }))}
                placeholder="DKI Jakarta"
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1.5 text-xs text-muted-foreground">Address</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Jl. Sudirman No. 1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !form.npsn || !form.name}>
              {saving ? 'Saving…' : 'Add school'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
