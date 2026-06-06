'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { countryRepHttp } from '@/lib/api/client';
import { competitionsApi } from '@/lib/api';
import { useT } from '@/lib/i18n/context';
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
  const t = useT();
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
      toast.error(e instanceof Error ? e.message : t('cr.failLoad'));
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
      toast.error(t('cr.allRequired'));
      return;
    }
    setSaving(true);
    try {
      await countryRepHttp.post('/country-representatives', form);
      toast.success(t('cr.created'));
      setShowForm(false);
      setForm(FORM_DEFAULTS);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('cr.failCreate'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(t('cr.confirmRemove', { name }))) return;
    try {
      await countryRepHttp.delete(`/country-representatives/${id}`);
      toast.success(t('cr.removed'));
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('cr.failRemove'));
    }
  };

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow={t('cr.eyebrow')}
        title={t('cr.title')}
        subtitle={t('cr.subtitle')}
        actions={
          <Button
            onClick={() => {
              setForm(FORM_DEFAULTS);
              setShowForm(true);
            }}
          >
            <Plus className="size-4" />
            {t('cr.newRep')}
          </Button>
        }
      />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[1024px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t('adm.colName')}</TableHead>
                <TableHead>{t('adm.colEmail')}</TableHead>
                <TableHead className="w-40">{t('cr.colCountry')}</TableHead>
                <TableHead>{t('cr.colCompetition')}</TableHead>
                <TableHead className="w-20 text-right">{t('acp.colActions')}</TableHead>
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
                    {t('cr.empty')}
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
            <DialogTitle>{t('cr.dialogTitle')}</DialogTitle>
            <DialogDescription>{t('cr.dialogDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="mb-1.5 text-xs text-muted-foreground">{t('cr.fullName')}</Label>
              <Input
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5 text-xs text-muted-foreground">{t('cr.email')}</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div>
                <Label className="mb-1.5 text-xs text-muted-foreground">{t('cr.password')}</Label>
                <Input
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="mb-1.5 text-xs text-muted-foreground">{t('cr.country')}</Label>
                <Input
                  value={form.country}
                  onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                  placeholder="e.g. Malaysia"
                />
              </div>
              <div>
                <Label className="mb-1.5 text-xs text-muted-foreground">{t('cr.competition')}</Label>
                <Select
                  value={form.compId || undefined}
                  onValueChange={(v) => setForm((f) => ({ ...f, compId: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('acp.selectPlaceholder')} />
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
              {t('common.cancel')}
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? t('cr.creating') : t('cr.createRep')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
