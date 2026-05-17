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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  description: string | null;
  checkType: CheckType;
}

const CHECK_TYPE_OPTIONS: { value: CheckType; label: string }[] = [
  { value: 'profile', label: 'Gate — profile complete' },
  { value: 'documents', label: 'Gate — documents uploaded' },
  { value: 'payment', label: 'Gate — payment made' },
  { value: 'approval', label: 'Gate — organizer approved' },
  { value: 'none', label: 'Info only — no gate' },
];

const CHECK_TYPE_LABEL: Record<CheckType, string> = {
  profile: 'Profile',
  documents: 'Documents',
  payment: 'Payment',
  approval: 'Approval',
  none: 'Info',
};

const FORM_DEFAULTS = { title: '', description: '', checkType: 'none' as CheckType };

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
        description: form.description.trim() || null,
        checkType: form.checkType,
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
    setForm({ title: s.title, description: s.description ?? '', checkType: s.checkType });
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
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
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
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                  {s.title}
                </p>
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
          <div>
            <Label className="mb-1.5 text-xs text-muted-foreground">Title</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Pay the registration fee"
            />
          </div>
          <div>
            <Label className="mb-1.5 text-xs text-muted-foreground">Description</Label>
            <Input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Shown under the step on the dashboard"
            />
          </div>
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
