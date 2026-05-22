'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { countryRepHttp } from '@/lib/api/client';
import { competitionsApi } from '@/lib/api';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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

interface Rep {
  id: string;
  fullName: string;
  email: string;
  country: string;
  compId: string;
  compName: string | null;
}

interface CompOption {
  id: string;
  name: string;
}

const FORM_DEFAULTS = { fullName: '', email: '', password: '', country: '', compId: '' };

export default function CountryRepsPage() {
  const [reps, setReps] = useState<Rep[]>([]);
  const [comps, setComps] = useState<CompOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(FORM_DEFAULTS);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setReps(await countryRepHttp.get<Rep[]>('/country-representatives'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load representatives');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    competitionsApi
      .list({ limit: 100 })
      .then((r) =>
        setComps((r.competitions ?? []).map((c) => ({ id: c.id, name: c.name }))),
      )
      .catch(() => {});
  }, [load]);

  const save = async () => {
    if (!form.fullName || !form.email || !form.password || !form.country || !form.compId) {
      toast.error('All fields are required.');
      return;
    }
    setSaving(true);
    try {
      await countryRepHttp.post('/country-representatives', form);
      toast.success('Representative created.');
      setShowForm(false);
      setForm(FORM_DEFAULTS);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create representative');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Remove ${name}? Their account will be deactivated.`)) return;
    try {
      await countryRepHttp.delete(`/country-representatives/${id}`);
      toast.success('Representative removed.');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove representative');
    }
  };

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Schools & Users"
        title="Country Representatives"
        subtitle="Representatives manage a country's students for a competition's local round."
        actions={
          <Button
            onClick={() => {
              setForm(FORM_DEFAULTS);
              setShowForm(true);
            }}
          >
            <Plus className="size-4" />
            New representative
          </Button>
        }
      />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[1024px]">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-40">Country</TableHead>
                <TableHead>Competition</TableHead>
                <TableHead className="w-20 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-9 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : reps.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-28 text-center text-sm text-muted-foreground">
                    No country representatives yet.
                  </TableCell>
                </TableRow>
              ) : (
                reps.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-foreground">{r.fullName}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{r.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-normal">
                        {r.country}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">{r.compName ?? r.compId}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        onClick={() => remove(r.id, r.fullName)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New country representative</DialogTitle>
            <DialogDescription>
              Create the account and assign a competition + country. Share the password with the
              representative.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">Full name</Label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5 text-xs text-muted-foreground">Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <Label className="mb-1.5 text-xs text-muted-foreground">Password</Label>
                <Input
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5 text-xs text-muted-foreground">Country</Label>
                <Input
                  value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                  placeholder="e.g. Malaysia"
                />
              </div>
              <div>
                <Label className="mb-1.5 text-xs text-muted-foreground">Competition</Label>
                <Select
                  value={form.compId || undefined}
                  onValueChange={(v) => setForm((f) => ({ ...f, compId: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select…" />
                  </SelectTrigger>
                  <SelectContent>
                    {comps.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? 'Creating…' : 'Create representative'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
