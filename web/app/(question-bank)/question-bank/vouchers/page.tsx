'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Pencil, Plus, Tags, Ticket, Trash2 } from 'lucide-react';
import { commerceHttp } from '@/lib/api/client';
import { CompetitionPicker, useQuestionBank } from '@/lib/question-bank/context';
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

interface VoucherGroup {
  id: string;
  compId: string;
  name: string;
  code: string;
  usableCount: number;
  price: number;
  discounted: number;
  isActive: boolean;
  voucherCount: number;
  usedCount: number;
  createdAt: string;
}
interface Voucher {
  id: string;
  code: string;
  npsn: string | null;
  used: number;
  max: number;
  claimerEmail: string | null;
  createdAt: string;
}

const CREATE_DEFAULTS = {
  name: '',
  discounted: '',
  price: '',
  usableCount: '20',
  npsn: '',
  isActive: true,
};

function rupiah(n: number) {
  return `Rp ${new Intl.NumberFormat('id-ID').format(n)}`;
}

export default function VouchersPage() {
  const { selectedId, competitions, loading: compsLoading } = useQuestionBank();
  const [rows, setRows] = useState<VoucherGroup[]>([]);
  const [loading, setLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<VoucherGroup | null>(null);
  const [form, setForm] = useState(CREATE_DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  // Minted-codes viewer.
  const [codesOpen, setCodesOpen] = useState(false);
  const [codesGroup, setCodesGroup] = useState<VoucherGroup | null>(null);
  const [codes, setCodes] = useState<Voucher[]>([]);
  const [codesLoading, setCodesLoading] = useState(false);

  const load = useCallback(async () => {
    if (!selectedId) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const r = await commerceHttp.get<VoucherGroup[]>(
        `/commerce/voucher-groups?compId=${encodeURIComponent(selectedId)}`,
      );
      setRows(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load voucher groups');
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm(CREATE_DEFAULTS);
    setOpen(true);
  };
  const openEdit = (g: VoucherGroup) => {
    setEditing(g);
    setForm({
      name: g.name,
      discounted: String(g.discounted),
      price: String(g.price),
      usableCount: String(g.usableCount),
      npsn: '',
      isActive: g.isActive,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !selectedId) return;
    setSaving(true);
    try {
      if (editing) {
        await commerceHttp.put(`/commerce/voucher-groups/${editing.id}`, {
          name: form.name.trim(),
          discounted: Number(form.discounted) || 0,
          price: Number(form.price) || 0,
          isActive: form.isActive,
        });
        toast.success('Voucher group saved.');
      } else {
        const count = Number(form.usableCount) || 0;
        const g = await commerceHttp.post<VoucherGroup>('/commerce/voucher-groups', {
          compId: selectedId,
          name: form.name.trim(),
          discounted: Number(form.discounted) || 0,
          price: Number(form.price) || 0,
          usableCount: count,
          npsn: form.npsn.trim() || null,
          isActive: form.isActive,
        });
        toast.success(`Voucher group created — ${g.voucherCount} codes minted.`);
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save voucher group');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (g: VoucherGroup) => {
    if (!confirm(`Delete voucher group "${g.name}" and all ${g.voucherCount} codes?`)) return;
    setBusy(g.id);
    try {
      await commerceHttp.delete(`/commerce/voucher-groups/${g.id}`);
      toast.success('Voucher group removed.');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete voucher group');
    } finally {
      setBusy(null);
    }
  };

  const viewCodes = async (g: VoucherGroup) => {
    setCodesGroup(g);
    setCodes([]);
    setCodesOpen(true);
    setCodesLoading(true);
    try {
      const r = await commerceHttp.get<Voucher[]>(`/commerce/voucher-groups/${g.id}/vouchers`);
      setCodes(r);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load codes');
    } finally {
      setCodesLoading(false);
    }
  };

  if (!compsLoading && competitions.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
        <PageHeader eyebrow="Commerce" title="Vouchers" />
        <Card className="p-12 text-center">
          <p className="text-sm font-medium text-foreground">No native competitions yet</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Registration-fee vouchers are available for native competitions only.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Commerce"
        title="Vouchers"
        subtitle="Batches of discount codes that reduce the registration fee — often issued to a school."
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <CompetitionPicker className="w-full sm:w-72" />
        <Button onClick={openAdd} disabled={!selectedId}>
          <Plus className="size-4" />
          New voucher batch
        </Button>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch</TableHead>
                <TableHead className="w-28">Code</TableHead>
                <TableHead className="w-40">Discounted fee</TableHead>
                <TableHead className="w-28">Usage</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-44 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-10 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-sm text-muted-foreground">
                    No voucher batches yet — create the first one.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium text-foreground">{g.name}</TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {g.code}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">
                      {rupiah(g.discounted)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {g.usedCount} / {g.voucherCount} used
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          g.isActive
                            ? 'border-transparent bg-emerald-100 font-mono text-[10px] text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                            : 'border-transparent bg-muted font-mono text-[10px] text-muted-foreground'
                        }
                      >
                        {g.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="outline" onClick={() => viewCodes(g)}>
                          <Ticket className="size-3.5" />
                          Codes
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8"
                          onClick={() => openEdit(g)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          disabled={busy === g.id}
                          onClick={() => remove(g)}
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

      {/* Create / edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit voucher batch' : 'New voucher batch'}</DialogTitle>
            <DialogDescription>
              {editing
                ? `Code ${editing.code} · ${editing.voucherCount} codes (immutable)`
                : 'Creating the batch mints every code at once.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">
                Batch name <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="SMAN 1 Jakarta — 2026 batch"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5 text-xs text-muted-foreground">
                  Discounted fee (Rp)
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={form.discounted}
                  onChange={(e) => setForm((f) => ({ ...f, discounted: e.target.value }))}
                  placeholder="50000"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  What a voucher-holder pays to register.
                </p>
              </div>
              <div>
                <Label className="mb-1.5 text-xs text-muted-foreground">
                  Normal fee (Rp){' '}
                  <span className="font-normal text-muted-foreground/70">— optional</span>
                </Label>
                <Input
                  type="number"
                  min={0}
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  placeholder="150000"
                />
              </div>
            </div>
            {!editing && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="mb-1.5 text-xs text-muted-foreground">
                    Number of codes <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    value={form.usableCount}
                    onChange={(e) => setForm((f) => ({ ...f, usableCount: e.target.value }))}
                  />
                  <p className="mt-1 text-xs text-muted-foreground">1–1000, minted immediately.</p>
                </div>
                <div>
                  <Label className="mb-1.5 text-xs text-muted-foreground">
                    School NPSN{' '}
                    <span className="font-normal text-muted-foreground/70">— optional</span>
                  </Label>
                  <Input
                    value={form.npsn}
                    onChange={(e) => setForm((f) => ({ ...f, npsn: e.target.value }))}
                    placeholder="20100001"
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Locks the codes to one school.
                  </p>
                </div>
              </div>
            )}
            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                className="size-4 accent-primary"
              />
              Active (codes can be redeemed)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !form.name.trim()}>
              {saving ? 'Saving…' : editing ? 'Save batch' : 'Create & mint codes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Minted-codes viewer */}
      <Dialog open={codesOpen} onOpenChange={setCodesOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tags className="size-4" />
              {codesGroup?.name}
            </DialogTitle>
            <DialogDescription>
              {codesGroup
                ? `${codesGroup.voucherCount} codes · ${rupiah(codesGroup.discounted)} discounted fee`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead className="w-24">NPSN</TableHead>
                  <TableHead className="w-20">Status</TableHead>
                  <TableHead>Claimed by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codesLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={4}>
                        <Skeleton className="h-7 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : codes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-20 text-center text-sm text-muted-foreground">
                      No codes.
                    </TableCell>
                  </TableRow>
                ) : (
                  codes.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-mono text-xs text-foreground">{v.code}</TableCell>
                      <TableCell className="font-mono text-[11px] text-muted-foreground">
                        {v.npsn || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            v.used >= v.max
                              ? 'border-transparent bg-muted font-mono text-[10px] text-muted-foreground'
                              : 'border-transparent bg-emerald-100 font-mono text-[10px] text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                          }
                        >
                          {v.used >= v.max ? 'Used' : 'Open'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {v.claimerEmail || '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
