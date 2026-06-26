'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { ListChecks, Pencil, Plus, Trash2 } from 'lucide-react';
import { competitionsApi } from '@/lib/api';
import { adminHttp } from '@/lib/api/client';
import { useT } from '@/lib/i18n/context';
import type { Competition } from '@/types';
import { FlowEditorDialog } from '@/components/flow-editor-dialog';
import { CompetitionLogoUploader } from '@/components/competition-logo-uploader';
import { PageHeader } from '@/components/shell/page-header';
import { Pager } from '@/components/shell/pager';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { GradeMultiSelect } from '@/components/grade-multi-select';
import {
  RoundsBuilder,
  roundsToDrafts,
  draftsToPayload,
  type RoundDraft,
} from '@/components/rounds-builder';
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
const LIMIT = 15;

const FORM_DEFAULTS = {
  name: '',
  organizer_name: '',
  organizer_id: '',
  category: '',
  grade_level: '',
  kind: 'native' as 'native' | 'affiliated',
  fee: '0',
  description: '',
  reg_open_date: '',
  reg_close_date: '',
  competition_date: '',
  post_payment_redirect_url: '',
  rounds: [] as RoundDraft[],
};

type OrganizerOption = { id: string; full_name: string; email: string };

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
  hint,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  hint?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 text-xs text-muted-foreground">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
      {hint && <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function CompetitionsPage() {
  const t = useT();
  const FILTERS = [{ key: 'all', label: t('acp.all') }, ...CATEGORIES.map((c) => ({ key: c, label: c }))];
  const [comps, setComps] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [cat, setCat] = useState('all');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(FORM_DEFAULTS);
  const [flowComp, setFlowComp] = useState<{ id: string; name: string } | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [organizers, setOrganizers] = useState<OrganizerOption[]>([]);

  useEffect(() => {
    adminHttp
      .get<{ organizers: OrganizerOption[] }>('/admin/organizers')
      .then((r) => setOrganizers(r.organizers ?? []))
      .catch(() => setOrganizers([]));
  }, []);

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
      toast.error(e instanceof Error ? e.message : t('acp.toastLoadFail'));
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
    setForm({ ...FORM_DEFAULTS, organizer_id: organizers[0]?.id ?? '' });
    setLogoUrl(null);
    setShowForm(true);
  };

  const openEdit = async (c: Competition) => {
    setEditId(c.id);
    setLogoUrl(c.logo_url ?? null);
    setForm({
      name: c.name,
      organizer_name: c.organizer_name,
      organizer_id: c.created_by ?? '',
      category: c.category || '',
      grade_level: c.grade_level || '',
      kind: c.kind === 'affiliated' ? 'affiliated' : 'native',
      fee: String(c.fee ?? 0),
      description: c.description || '',
      reg_open_date: fmtForInput(c.reg_open_date),
      reg_close_date: fmtForInput(c.reg_close_date),
      competition_date: fmtForInput(c.competition_date),
      post_payment_redirect_url: c.post_payment_redirect_url || '',
      rounds: [],
    });
    setShowForm(true);
    // The list endpoint omits rounds — fetch the detail to populate them.
    try {
      const detail = await competitionsApi.get(c.id);
      setForm((f) => ({ ...f, rounds: roundsToDrafts(detail.rounds) }));
    } catch {
      /* rounds stay empty — the competition is still editable */
    }
  };

  const save = async () => {
    if (!form.name || !form.organizer_name) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        fee: parseInt(form.fee, 10) || 0,
        // Owner is optional. Only send organizer_id when it's a real organizer
        // the admin actually picked; otherwise omit it so the backend preserves
        // the existing created_by (which may be null, or an admin id that isn't
        // in this organizer-only list). Sending '' would clobber created_by;
        // sending a non-organizer id would 400.
        organizer_id: organizers.some((o) => o.id === form.organizer_id)
          ? form.organizer_id
          : undefined,
        rounds: draftsToPayload(form.rounds),
      };
      if (editId) {
        await competitionsApi.update(editId, payload);
        toast.success(t('acp.toastUpdated'));
      } else {
        await competitionsApi.create(payload);
        toast.success(t('acp.toastCreated'));
      }
      setShowForm(false);
      setEditId(null);
      setForm({ ...FORM_DEFAULTS });
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('cf.toastSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(t('acp.confirmDelete', { name }))) return;
    try {
      await competitionsApi.delete(id);
      toast.success(t('acp.toastDeleted'));
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('acp.toastDeleteFail'));
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow={t('adm.management')}
        title={t('opnav.competitions')}
        subtitle={t('acp.subtitle')}
        actions={
          <Button onClick={openAdd}>
            <Plus className="size-4" />
            {t('acp.newCompetition')}
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
          <Table className="w-full table-fixed min-w-[1024px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t('adm.colName')}</TableHead>
                <TableHead className="w-[200px]">{t('acp.colCategory')}</TableHead>
                <TableHead className="w-36">{t('acp.colOrganizer')}</TableHead>
                <TableHead className="w-24">{t('acp.colFee')}</TableHead>
                <TableHead className="w-28">{t('acp.colRegCloses')}</TableHead>
                <TableHead className="w-28">{t('acp.colEventDate')}</TableHead>
                <TableHead className="w-[200px] text-right">{t('acp.colActions')}</TableHead>
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
                    {t('acp.empty')}
                  </TableCell>
                </TableRow>
              ) : (
                comps.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="truncate font-medium text-foreground">{c.name}</div>
                      {c.grade_level && (
                        <div className="truncate text-xs text-muted-foreground">{c.grade_level}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.category ? (
                        <Badge variant="secondary" className="max-w-full truncate font-normal">
                          {c.category}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="truncate text-sm">{c.organizer_name}</TableCell>
                    <TableCell>
                      {c.fee === 0 ? (
                        <Badge
                          variant="outline"
                          className="border-transparent bg-emerald-100 font-mono text-[10px] text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                        >
                          {t('acp.free')}
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
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setFlowComp({ id: c.id, name: c.name })}
                        >
                          <ListChecks className="size-3.5" />
                          {t('acp.flow')}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEdit(c)}>
                          <Pencil className="size-3.5" />
                          {t('acp.edit')}
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
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editId ? t('acp.dlgEditTitle') : t('acp.dlgNewTitle')}</DialogTitle>
            <DialogDescription>
              {editId ? t('acp.dlgEditDesc') : t('acp.dlgNewDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-6">
            <Field label={t('acp.fldName')} required className="sm:col-span-4">
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Olimpiade Matematika Nasional"
              />
            </Field>
            <Field label={t('acp.fldCategory')} className="sm:col-span-2">
              <Select
                value={form.category || undefined}
                onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('acp.selectPlaceholder')} />
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

            <Field label={t('acp.fldOrganizerName')} required className="sm:col-span-4">
              <Input
                value={form.organizer_name}
                onChange={(e) => setForm((f) => ({ ...f, organizer_name: e.target.value }))}
                placeholder="EMC Organizer"
              />
            </Field>
            <Field
              label={t('acp.fldBaseFee')}
              className="sm:col-span-2"
              hint={t('acp.fldBaseFeeHint')}
            >
              <Input
                type="number"
                value={form.fee}
                onChange={(e) => setForm((f) => ({ ...f, fee: e.target.value }))}
              />
            </Field>
            <Field label={t('acp.fldOwner')} required className="sm:col-span-6">
              <Select
                value={form.organizer_id || undefined}
                onValueChange={(v) => setForm((f) => ({ ...f, organizer_id: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      organizers.length === 0 ? t('acp.noOrganizers') : t('acp.selectOrganizer')
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {organizers.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.full_name} — {o.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-muted-foreground">{t('acp.fldOwnerHint')}</p>
            </Field>
            <Field label={t('acp.fldGradeLevel')} className="sm:col-span-6">
              <GradeMultiSelect
                value={form.grade_level}
                onChange={(v) => setForm((f) => ({ ...f, grade_level: v }))}
              />
            </Field>

            <Field label={t('acp.fldRegOpens')} className="sm:col-span-2">
              <Input
                type="date"
                value={form.reg_open_date}
                onChange={(e) => setForm((f) => ({ ...f, reg_open_date: e.target.value }))}
              />
            </Field>
            <Field label={t('acp.fldRegCloses')} className="sm:col-span-2">
              <Input
                type="date"
                value={form.reg_close_date}
                onChange={(e) => setForm((f) => ({ ...f, reg_close_date: e.target.value }))}
              />
            </Field>
            <Field label={t('acp.fldEventDate')} className="sm:col-span-2">
              <Input
                type="date"
                value={form.competition_date}
                onChange={(e) => setForm((f) => ({ ...f, competition_date: e.target.value }))}
              />
            </Field>

            <Field label={t('acp.fldType')} className="sm:col-span-2">
              <Select
                value={form.kind}
                onValueChange={(v) =>
                  setForm((f) => ({ ...f, kind: v as 'native' | 'affiliated' }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="native">{t('acp.typeNative')}</SelectItem>
                  <SelectItem value="affiliated">{t('acp.typeAffiliated')}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field
              label={form.kind === 'affiliated' ? t('acp.fldAffiliatedUrl') : t('acp.fldPostPaymentUrl')}
              required={form.kind === 'affiliated'}
              className="sm:col-span-4"
            >
              <Input
                type="url"
                value={form.post_payment_redirect_url}
                onChange={(e) =>
                  setForm((f) => ({ ...f, post_payment_redirect_url: e.target.value }))
                }
                placeholder="https://…"
              />
            </Field>

            <Field label={t('acp.fldDescription')} className="sm:col-span-6">
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder={t('acp.descPlaceholder')}
                className="flex min-h-20 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              />
            </Field>

            <Field label={t('acp.fldRounds')} className="sm:col-span-6">
              <RoundsBuilder
                rounds={form.rounds}
                onChange={(rounds) => setForm((f) => ({ ...f, rounds }))}
              />
            </Field>

            <Field label={t('acp.fldLogo')} className="sm:col-span-6">
              {editId ? (
                <CompetitionLogoUploader
                  endpoint={`/admin/competitions/${editId}/logo`}
                  http={adminHttp}
                  logoUrl={logoUrl}
                  onUploaded={setLogoUrl}
                />
              ) : (
                <p className="text-[11px] text-muted-foreground">{t('acp.logoHint')}</p>
              )}
            </Field>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={save}
              disabled={saving || !form.name || !form.organizer_name}
            >
              {saving ? t('cf.saving') : editId ? t('acp.saveChanges') : t('acp.createCompetition')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FlowEditorDialog
        competitionId={flowComp?.id ?? null}
        competitionName={flowComp?.name ?? ''}
        onClose={() => setFlowComp(null)}
      />
    </div>
  );
}
