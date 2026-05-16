'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import { marketingHttp } from '@/lib/api/client';
import { CompetitionPicker, useQuestionBank } from '@/lib/question-bank/context';
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

interface Referral {
  id: string;
  compId: string;
  name: string;
  email: string | null;
  phone: string | null;
  code: string;
  year: number | null;
  commissionPerPaid: number;
  click: number;
  account: number;
  registration: number;
  paid: number;
  commission: number;
  bonus: number;
  total: number;
}

const DEFAULTS = { name: '', email: '', phone: '', code: '', commissionPerPaid: '', bonus: '', year: '' };

function rupiah(n: number) {
  return `Rp ${new Intl.NumberFormat('id-ID').format(n)}`;
}

export default function ReferralsPage() {
  const { selectedId, selected, competitions, loading: compsLoading } = useQuestionBank();
  const [rows, setRows] = useState<Referral[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchVal, setSearchVal] = useState('');
  const [loading, setLoading] = useState(false);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Referral | null>(null);
  const [form, setForm] = useState(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!selectedId) {
      setRows([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        compId: selectedId,
        page: String(page),
        limit: String(LIMIT),
      });
      if (search) qs.set('search', search);
      const r = await marketingHttp.get<{ referrals: Referral[]; pagination: { total: number } }>(
        `/marketing/referrals?${qs}`,
      );
      setRows(r.referrals ?? []);
      setTotal(r.pagination?.total ?? 0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load referrals');
    } finally {
      setLoading(false);
    }
  }, [selectedId, page, search]);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm(DEFAULTS);
    setOpen(true);
  };
  const openEdit = (r: Referral) => {
    setEditing(r);
    setForm({
      name: r.name,
      email: r.email ?? '',
      phone: r.phone ?? '',
      code: r.code,
      commissionPerPaid: String(r.commissionPerPaid),
      bonus: String(r.bonus),
      year: r.year ? String(r.year) : '',
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !selectedId) return;
    setSaving(true);
    try {
      const body = {
        compId: selectedId,
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        commissionPerPaid: Number(form.commissionPerPaid) || 0,
        bonus: Number(form.bonus) || 0,
        year: Number(form.year) || null,
        ...(editing ? {} : { code: form.code.trim() || undefined }),
      };
      if (editing) await marketingHttp.put(`/marketing/referrals/${editing.id}`, body);
      else await marketingHttp.post('/marketing/referrals', body);
      toast.success(editing ? 'Referral saved.' : 'Referral created.');
      setOpen(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save referral');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (r: Referral) => {
    if (!confirm(`Delete referral "${r.name}" (${r.code})?`)) return;
    setBusy(r.id);
    try {
      await marketingHttp.delete(`/marketing/referrals/${r.id}`);
      toast.success('Referral removed.');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete referral');
    } finally {
      setBusy(null);
    }
  };

  const copyLink = (code: string) => {
    const slug = selected?.slug;
    if (!slug) {
      toast.error('This competition has no portal slug yet.');
      return;
    }
    const url = `${window.location.origin}/competitions/${slug}/register?ref=${encodeURIComponent(code)}`;
    navigator.clipboard.writeText(url).then(
      () => toast.success('Share link copied.'),
      () => toast.error('Could not copy the link.'),
    );
  };

  if (!compsLoading && competitions.length === 0) {
    return (
      <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
        <PageHeader eyebrow="Marketing" title="Referrals" />
        <Card className="p-12 text-center">
          <p className="text-sm font-medium text-foreground">No native competitions yet</p>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Affiliate referrals are available for native competitions only.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Marketing"
        title="Referrals"
        subtitle="Affiliate referral links — track the click → sign-up → registration → paid funnel."
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <CompetitionPicker className="w-full sm:w-72" />
        <Button onClick={openAdd} disabled={!selectedId}>
          <Plus className="size-4" />
          New referral
        </Button>
      </div>

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
          placeholder="Search name, code or email…"
          value={searchVal}
          onChange={(e) => setSearchVal(e.target.value)}
        />
        <Button type="submit" variant="outline">
          Search
        </Button>
      </form>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Affiliate</TableHead>
                <TableHead className="w-44">Code</TableHead>
                <TableHead className="w-20 text-right">Clicks</TableHead>
                <TableHead className="w-20 text-right">Sign-ups</TableHead>
                <TableHead className="w-20 text-right">Regs</TableHead>
                <TableHead className="w-16 text-right">Paid</TableHead>
                <TableHead className="w-36 text-right">Commission</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8}>
                      <Skeleton className="h-9 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center text-sm text-muted-foreground">
                    No referrals yet — create the first one.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <p className="font-medium text-foreground">{r.name}</p>
                      {r.email && <p className="text-xs text-muted-foreground">{r.email}</p>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-[11px] text-muted-foreground">{r.code}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-6 text-muted-foreground"
                          title="Copy share link"
                          onClick={() => copyLink(r.code)}
                        >
                          <Copy className="size-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {r.click}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {r.account}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {r.registration}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-foreground">
                      {r.paid}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium text-foreground">
                      {rupiah(r.total)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" className="size-8" onClick={() => openEdit(r)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-muted-foreground hover:text-destructive"
                          disabled={busy === r.id}
                          onClick={() => remove(r)}
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
            <DialogTitle>{editing ? 'Edit referral' : 'New referral'}</DialogTitle>
            <DialogDescription>
              {editing
                ? `Code ${editing.code} — the funnel counters update automatically.`
                : 'An affiliate who shares a ?ref= link for this competition.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">
                Affiliate name <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="School / partner / ambassador name"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5 text-xs text-muted-foreground">Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <Label className="mb-1.5 text-xs text-muted-foreground">Phone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">
                Referral code{' '}
                <span className="font-normal text-muted-foreground/70">
                  {editing ? '— immutable' : '— optional, auto-generated if blank'}
                </span>
              </Label>
              <Input
                value={form.code}
                disabled={!!editing}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="e.g. SMAN8-2026"
                className="font-mono"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label className="mb-1.5 text-xs text-muted-foreground">Commission / paid (Rp)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.commissionPerPaid}
                  onChange={(e) => setForm((f) => ({ ...f, commissionPerPaid: e.target.value }))}
                />
              </div>
              <div>
                <Label className="mb-1.5 text-xs text-muted-foreground">Bonus (Rp)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.bonus}
                  onChange={(e) => setForm((f) => ({ ...f, bonus: e.target.value }))}
                />
              </div>
              <div>
                <Label className="mb-1.5 text-xs text-muted-foreground">Year</Label>
                <Input
                  type="number"
                  value={form.year}
                  onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))}
                  placeholder="2026"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving || !form.name.trim()}>
              {saving ? 'Saving…' : editing ? 'Save referral' : 'Create referral'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
