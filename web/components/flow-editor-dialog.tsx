'use client';

// Admin step-flow editor — the per-competition `competition_flows` config
// behind the student dashboard's guided progression. Add / edit / reorder /
// remove steps, wired to the Wave 4 Phase 2 admin endpoints.

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus, Trash2 } from 'lucide-react';

import { adminHttp } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { BilingualInput } from '@/components/ui/bilingual-input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

type CheckType = 'profile' | 'documents' | 'payment' | 'approval' | 'none';

interface FlowStep {
  id: string;
  stepOrder: number;
  stepKey: string;
  title: string;
  titleId: string | null;
  description: string | null;
  descriptionId: string | null;
  checkType: CheckType;
  startsOn: string | null;
  endsOn: string | null;
  location: string | null;
}

// An API date (ISO or null) → the YYYY-MM-DD a <input type="date"> expects.
function toDateInput(v: string | null): string {
  if (!v) return '';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

// Short "2 Jun – 1 Aug 2026" label for the step list.
function fmtStepDates(startsOn: string | null, endsOn: string | null): string {
  const f = (v: string) =>
    new Date(v).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  if (startsOn && endsOn) return `${f(startsOn)} – ${f(endsOn)}`;
  if (startsOn) return f(startsOn);
  return endsOn ? f(endsOn) : '';
}

const CHECK_TYPE_OPTIONS: { value: CheckType; label: string }[] = [
  { value: 'profile', label: 'Gate, profile complete' },
  { value: 'documents', label: 'Gate, documents uploaded' },
  { value: 'payment', label: 'Gate, payment made' },
  { value: 'approval', label: 'Gate, organizer approved' },
  { value: 'none', label: 'Info only, no gate' },
];

const CHECK_TYPE_LABEL: Record<CheckType, string> = {
  profile: 'Profile',
  documents: 'Documents',
  payment: 'Payment',
  approval: 'Approval',
  none: 'Info',
};

const FORM_DEFAULTS = {
  title: '',
  titleId: '',
  description: '',
  descriptionId: '',
  checkType: 'none' as CheckType,
  startsOn: '',
  endsOn: '',
  location: '',
};

export function FlowEditorDialog({
  competitionId,
  competitionName,
  onClose,
}: {
  competitionId: string | null;
  competitionName: string;
  onClose: () => void;
}) {
  const [steps, setSteps] = useState<FlowStep[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(FORM_DEFAULTS);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      setSteps(await adminHttp.get<FlowStep[]>(`/competitions/${id}/flow`));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load step-flow');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (competitionId) {
      setEditId(null);
      setForm(FORM_DEFAULTS);
      void load(competitionId);
    }
  }, [competitionId, load]);

  const resetForm = () => {
    setEditId(null);
    setForm(FORM_DEFAULTS);
  };

  const submit = async () => {
    if (!competitionId || !form.title.trim()) return;
    setBusy(true);
    try {
      const body = {
        title: form.title.trim(),
        titleId: form.titleId.trim() || null,
        description: form.description.trim() || null,
        descriptionId: form.descriptionId.trim() || null,
        checkType: form.checkType,
        startsOn: form.startsOn || null,
        endsOn: form.endsOn || null,
        location: form.location.trim() || null,
      };
      if (editId) {
        await adminHttp.put(`/admin/competitions/${competitionId}/flow/${editId}`, body);
        toast.success('Step updated.');
      } else {
        await adminHttp.post(`/admin/competitions/${competitionId}/flow`, body);
        toast.success('Step added.');
      }
      resetForm();
      await load(competitionId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save step');
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (s: FlowStep) => {
    setEditId(s.id);
    setForm({
      title: s.title,
      titleId: s.titleId ?? '',
      description: s.description ?? '',
      descriptionId: s.descriptionId ?? '',
      checkType: s.checkType,
      startsOn: toDateInput(s.startsOn),
      endsOn: toDateInput(s.endsOn),
      location: s.location ?? '',
    });
  };

  const remove = async (s: FlowStep) => {
    if (!competitionId) return;
    setBusy(true);
    try {
      await adminHttp.delete(`/admin/competitions/${competitionId}/flow/${s.id}`);
      if (editId === s.id) resetForm();
      toast.success('Step removed.');
      await load(competitionId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove step');
    } finally {
      setBusy(false);
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    if (!competitionId) return;
    const next = index + dir;
    if (next < 0 || next >= steps.length) return;
    const ids = steps.map((s) => s.id);
    [ids[index], ids[next]] = [ids[next], ids[index]];
    setBusy(true);
    try {
      setSteps(
        await adminHttp.put<FlowStep[]>(`/admin/competitions/${competitionId}/flow/reorder`, {
          stepIds: ids,
        })
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to reorder steps');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={!!competitionId}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Step-flow</DialogTitle>
          <DialogDescription>
            The guided progression students see on {competitionName || 'this competition'}’s
            dashboard.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : steps.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No steps yet. Add the first one below.
          </p>
        ) : (
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li
                key={s.id}
                className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2"
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                  {s.stepOrder}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{s.title}</p>
                  {(s.startsOn || s.endsOn) && (
                    <p className="truncate text-[11px] text-muted-foreground">
                      {fmtStepDates(s.startsOn, s.endsOn)}
                    </p>
                  )}
                </div>
                <Badge variant="secondary" className="shrink-0 font-normal">
                  {CHECK_TYPE_LABEL[s.checkType]}
                </Badge>
                <div className="flex shrink-0 items-center">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    disabled={busy || i === 0}
                    onClick={() => move(i, -1)}
                    aria-label="Move up"
                  >
                    <ArrowUp className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    disabled={busy || i === steps.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label="Move down"
                  >
                    <ArrowDown className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7"
                    disabled={busy}
                    onClick={() => startEdit(s)}
                    aria-label="Edit step"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 text-destructive hover:text-destructive"
                    disabled={busy}
                    onClick={() => remove(s)}
                    aria-label="Remove step"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="space-y-3 rounded-lg border border-dashed p-3">
          <p className="text-xs font-medium text-muted-foreground">
            {editId ? 'Edit step' : 'Add a step'}
          </p>
          <BilingualInput
            label="Title"
            required
            value={form.title}
            valueId={form.titleId}
            onChange={(v) => setForm((f) => ({ ...f, title: v }))}
            onChangeId={(v) => setForm((f) => ({ ...f, titleId: v }))}
            placeholder="e.g. Pay the registration fee"
          />
          <BilingualInput
            label="Description"
            textarea
            value={form.description}
            valueId={form.descriptionId}
            onChange={(v) => setForm((f) => ({ ...f, description: v }))}
            onChangeId={(v) => setForm((f) => ({ ...f, descriptionId: v }))}
            placeholder="Shown under the step on the dashboard"
          />
          <div>
            <Label className="mb-1.5 text-xs text-muted-foreground">Gate</Label>
            <Select
              value={form.checkType}
              onValueChange={(v) => setForm((f) => ({ ...f, checkType: v as CheckType }))}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHECK_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Timeline dates shown on the student dashboard. Both optional — set
              the start alone for a single-day stage, or both for a range. */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="flow-start" className="mb-1.5 text-xs text-muted-foreground">
                Start date
              </Label>
              <Input
                id="flow-start"
                type="date"
                value={form.startsOn}
                onChange={(e) => setForm((f) => ({ ...f, startsOn: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="flow-end" className="mb-1.5 text-xs text-muted-foreground">
                End date (optional)
              </Label>
              <Input
                id="flow-end"
                type="date"
                value={form.endsOn}
                onChange={(e) => setForm((f) => ({ ...f, endsOn: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label htmlFor="flow-location" className="mb-1.5 text-xs text-muted-foreground">
              Location / mode (optional)
            </Label>
            <Input
              id="flow-location"
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="e.g. Online, or Online / Test Center"
            />
          </div>
          <div className="flex justify-end gap-2">
            {editId && (
              <Button variant="ghost" size="sm" onClick={resetForm} disabled={busy}>
                Cancel
              </Button>
            )}
            <Button size="sm" onClick={submit} disabled={busy || !form.title.trim()}>
              {editId ? (
                'Save step'
              ) : (
                <>
                  <Plus className="size-3.5" />
                  Add step
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
