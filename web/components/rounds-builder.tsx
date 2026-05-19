'use client';

import { useState } from 'react';
import { X, Plus, ChevronUp, ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

const ROUND_TYPES = ['Online', 'On-site', 'Hybrid'];
const GATING_RULES = [
  { value: 'registered', label: 'registered for it' },
  { value: 'paid', label: 'paid for it' },
  { value: 'completed', label: 'completed it' },
];
const ROUND_CATEGORIES = [
  { value: 'online', label: 'Online round' },
  { value: 'fast_track', label: 'Fast Track (catch-up)' },
  { value: 'local', label: 'Local round (a country)' },
  { value: 'global', label: 'Global round (final)' },
];
const EXAM_MODES = [
  { value: 'online', label: 'Online — on the platform' },
  { value: 'offline', label: 'Offline — printed, scores imported' },
];

export interface RoundDraft {
  /** Stable client-side id — gating prerequisites reference this, not an index. */
  tempId: string;
  roundName: string;
  roundType: string;
  roundCategory: string;
  startDate: string;
  registrationDeadline: string;
  examDate: string;
  resultsDate: string;
  fee: number;
  qualifyingScore: number | null;
  location: string;
  country: string;
  examMode: string;
  requiredDocs: string[];
  gatingMode: 'open' | 'prerequisite' | 'qualified' | 'unqualified';
  requiresTempId: string | null;
  gatingRule: 'registered' | 'paid' | 'completed';
  /** Operator visibility toggle — false hides the round from students. */
  isActive: boolean;
}

function uid(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export function emptyRound(): RoundDraft {
  return {
    tempId: uid(),
    roundName: '',
    roundType: 'Online',
    roundCategory: 'online',
    startDate: '',
    registrationDeadline: '',
    examDate: '',
    resultsDate: '',
    fee: 0,
    qualifyingScore: null,
    location: '',
    country: '',
    examMode: 'online',
    requiredDocs: [],
    gatingMode: 'open',
    requiresTempId: null,
    gatingRule: 'completed',
    isActive: true,
  };
}

const dateInput = (v: unknown): string =>
  typeof v === 'string' && v ? v.split('T')[0] : '';

/** Backend round objects (from a GET /competitions/:id) → editable drafts. */
export function roundsToDrafts(rounds: unknown): RoundDraft[] {
  if (!Array.isArray(rounds)) return [];
  const idToTemp = new Map<string, string>();
  const staged = rounds.map((r) => {
    const tempId = uid();
    if (r?.id) idToTemp.set(String(r.id), tempId);
    return { r, tempId };
  });
  return staged.map(({ r, tempId }) => {
    const reqId = r?.gating?.requiresRoundId ?? r?.requiresRoundId ?? null;
    const mode = r?.gating?.mode;
    return {
      tempId,
      roundName: r?.roundName ?? '',
      roundType: ROUND_TYPES.includes(r?.roundType) ? r.roundType : 'Online',
      roundCategory: r?.roundCategory ?? 'online',
      startDate: dateInput(r?.startDate),
      registrationDeadline: dateInput(r?.registrationDeadline),
      examDate: dateInput(r?.examDate),
      resultsDate: dateInput(r?.resultsDate),
      fee: Number(r?.fee) || 0,
      qualifyingScore: r?.qualifyingScore != null ? Number(r.qualifyingScore) : null,
      location: r?.location ?? '',
      country: r?.country ?? '',
      examMode: r?.examMode === 'offline' ? 'offline' : 'online',
      requiredDocs: Array.isArray(r?.requiredDocs) ? r.requiredDocs : [],
      gatingMode: ['prerequisite', 'qualified', 'unqualified'].includes(mode) ? mode : 'open',
      requiresTempId: reqId ? idToTemp.get(String(reqId)) ?? null : null,
      gatingRule: r?.gating?.rule ?? 'completed',
      isActive: r?.isActive !== false,
    } as RoundDraft;
  });
}

/** Editable drafts → the `rounds` payload for a POST/PUT competition. */
export function draftsToPayload(drafts: RoundDraft[]) {
  return drafts.map((r) => ({
    roundName: r.roundName,
    roundType: r.roundType,
    roundCategory: r.roundCategory,
    startDate: r.startDate || null,
    registrationDeadline: r.registrationDeadline || null,
    examDate: r.examDate || null,
    resultsDate: r.resultsDate || null,
    fee: Number(r.fee) || 0,
    qualifyingScore: r.qualifyingScore,
    location: r.location || null,
    country: r.country || null,
    examMode: r.examMode,
    requiredDocs: r.requiredDocs,
    gatingMode: r.gatingMode,
    requiresRoundIndex:
      r.gatingMode === 'prerequisite' && r.requiresTempId
        ? drafts.findIndex((x) => x.tempId === r.requiresTempId)
        : null,
    gatingRule: r.gatingRule,
    isActive: r.isActive,
  }));
}

const isPastDate = (s: string): boolean => {
  if (!s) return false;
  const t = new Date(s).getTime();
  return !Number.isNaN(t) && t < Date.now();
};

// Registration for a round is still open if it has no deadline, or the
// deadline hasn't passed yet.
const registrationOpen = (r: RoundDraft): boolean =>
  !r.registrationDeadline || !isPastDate(r.registrationDeadline);

// A round has "finished" once its results date — or, failing that, its exam
// date — has passed.
const roundFinished = (r: RoundDraft): boolean =>
  isPastDate(r.resultsDate || r.examDate);

/**
 * Advisory hint for a Fast Track / Global round, given the other rounds.
 * Never blocks — it just nudges the operator toward the right toggle state.
 */
function activationAdvice(
  round: RoundDraft,
  all: RoundDraft[],
): { tone: 'warn' | 'info'; text: string } | null {
  if (round.roundCategory === 'fast_track') {
    const openOnline = all.filter(
      (r) => r.roundCategory === 'online' && registrationOpen(r),
    );
    const onlineCount = all.filter((r) => r.roundCategory === 'online').length;
    if (round.isActive && openOnline.length > 0) {
      return {
        tone: 'warn',
        text: `${openOnline.length} online round${openOnline.length > 1 ? 's are' : ' is'} still open for registration. Fast Track is normally kept off until students can no longer enter the online rounds.`,
      };
    }
    if (!round.isActive && onlineCount > 0 && openOnline.length === 0) {
      return {
        tone: 'info',
        text: 'Every online round has closed registration — you can turn Fast Track on now.',
      };
    }
    return null;
  }
  if (round.roundCategory === 'global') {
    const others = all.filter((r) => r.tempId !== round.tempId);
    const unfinished = others.filter((r) => !roundFinished(r));
    if (round.isActive && unfinished.length > 0) {
      return {
        tone: 'warn',
        text: `${unfinished.length} other round${unfinished.length > 1 ? 's have' : ' has'} not finished yet. The Global Round is normally kept off until every earlier round is done.`,
      };
    }
    if (!round.isActive && others.length > 0 && unfinished.length === 0) {
      return {
        tone: 'info',
        text: 'Every other round has finished — you can open the Global Round now.',
      };
    }
    return null;
  }
  return null;
}

/**
 * The competition rounds editor — add / remove / reorder rounds, each with its
 * own type, dates, fee, location, required documents and a configurable
 * round-to-round gating rule. A competition with no rounds is single-stage.
 */
export function RoundsBuilder({
  rounds,
  onChange,
}: {
  rounds: RoundDraft[];
  onChange: (rounds: RoundDraft[]) => void;
}) {
  const update = (i: number, patch: Partial<RoundDraft>) =>
    onChange(rounds.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  const add = () => onChange([...rounds, emptyRound()]);

  const remove = (i: number) => {
    const removed = rounds[i];
    onChange(
      rounds
        .filter((_, idx) => idx !== i)
        .map((r) =>
          r.requiresTempId === removed.tempId
            ? { ...r, gatingMode: 'open' as const, requiresTempId: null }
            : r,
        ),
    );
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rounds.length) return;
    const next = [...rounds];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {rounds.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No rounds — this competition uses a single registration and fee. Add
          rounds for a multi-stage competition where students register and pay
          per round.
        </p>
      )}
      {rounds.map((r, i) => (
        <RoundCard
          key={r.tempId}
          round={r}
          index={i}
          all={rounds}
          isFirst={i === 0}
          isLast={i === rounds.length - 1}
          onChange={(patch) => update(i, patch)}
          onRemove={() => remove(i)}
          onMove={(dir) => move(i, dir)}
        />
      ))}
      <Button type="button" variant="outline" onClick={add}>
        <Plus className="size-4" />
        Add round
      </Button>
    </div>
  );
}

const DATE_FIELDS = [
  ['startDate', 'Starts'],
  ['registrationDeadline', 'Reg. deadline'],
  ['examDate', 'Exam date'],
  ['resultsDate', 'Results'],
] as const;

function RoundCard({
  round,
  index,
  all,
  isFirst,
  isLast,
  onChange,
  onRemove,
  onMove,
}: {
  round: RoundDraft;
  index: number;
  all: RoundDraft[];
  isFirst: boolean;
  isLast: boolean;
  onChange: (patch: Partial<RoundDraft>) => void;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const [newDoc, setNewDoc] = useState('');
  const others = all.filter((r) => r.tempId !== round.tempId);
  const advice = activationAdvice(round, all);

  const addDoc = () => {
    const d = newDoc.trim();
    if (d && !round.requiredDocs.includes(d)) {
      onChange({ requiredDocs: [...round.requiredDocs, d] });
      setNewDoc('');
    }
  };

  return (
    <Card className="space-y-3 border-dashed p-4">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="shrink-0 font-mono">
          Round {index + 1}
        </Badge>
        <Input
          value={round.roundName}
          onChange={(e) => onChange({ roundName: e.target.value })}
          placeholder="Round name — e.g. Online Round 1"
          className="h-8 flex-1"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={isFirst}
          onClick={() => onMove(-1)}
          aria-label="Move round up"
        >
          <ChevronUp className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={isLast}
          onClick={() => onMove(1)}
          aria-label="Move round down"
        >
          <ChevronDown className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-destructive hover:text-destructive"
          onClick={onRemove}
          aria-label="Remove round"
        >
          <X className="size-4" />
        </Button>
      </div>

      <div className="rounded-md border bg-muted/40 p-3">
        <div className="flex items-start gap-3">
          <Switch
            id={`round-active-${round.tempId}`}
            checked={round.isActive}
            onCheckedChange={(v) => onChange({ isActive: v })}
            className="mt-0.5"
          />
          <div className="min-w-0 flex-1">
            <Label
              htmlFor={`round-active-${round.tempId}`}
              className="text-xs font-medium text-foreground"
            >
              {round.isActive ? 'Visible to students' : 'Hidden from students'}
            </Label>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              Turn off to hide this round from students — they won’t see it or be
              able to register. Use it to stage a round: keep Fast Track off while
              the online rounds are still open, or the Global Round off until they
              finish.
            </p>
          </div>
        </div>
        {advice && (
          <p
            className={
              'mt-2 rounded-md px-2.5 py-1.5 text-[11px] leading-relaxed ' +
              (advice.tone === 'warn'
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200'
                : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200')
            }
          >
            {advice.text}
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label className="mb-1 text-xs text-muted-foreground">Type</Label>
          <Select value={round.roundType} onValueChange={(v) => onChange({ roundType: v })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROUND_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1 text-xs text-muted-foreground">Fee (IDR)</Label>
          <Input
            type="number"
            value={round.fee}
            onChange={(e) => onChange({ fee: parseInt(e.target.value, 10) || 0 })}
          />
        </div>
        <div>
          <Label className="mb-1 text-xs text-muted-foreground">Location</Label>
          <Input
            value={round.location}
            onChange={(e) => onChange({ location: e.target.value })}
            placeholder="Online / a city"
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="mb-1 text-xs text-muted-foreground">Category</Label>
          <Select
            value={round.roundCategory}
            onValueChange={(v) => onChange({ roundCategory: v })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROUND_CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1 text-xs text-muted-foreground">
            Qualifying score — medal threshold
          </Label>
          <Input
            type="number"
            value={round.qualifyingScore ?? ''}
            onChange={(e) =>
              onChange({
                qualifyingScore: e.target.value === '' ? null : parseInt(e.target.value, 10),
              })
            }
            placeholder="e.g. 16 — blank for none"
          />
        </div>
        {round.roundCategory === 'local' && (
          <>
            <div>
              <Label className="mb-1 text-xs text-muted-foreground">Country</Label>
              <Input
                value={round.country}
                onChange={(e) => onChange({ country: e.target.value })}
                placeholder="e.g. Malaysia"
              />
            </div>
            <div>
              <Label className="mb-1 text-xs text-muted-foreground">Exam mode</Label>
              <Select value={round.examMode} onValueChange={(v) => onChange({ examMode: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXAM_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {DATE_FIELDS.map(([key, label]) => (
          <div key={key}>
            <Label className="mb-1 text-xs text-muted-foreground">{label}</Label>
            <Input
              type="date"
              value={round[key]}
              onChange={(e) => onChange({ [key]: e.target.value } as Partial<RoundDraft>)}
            />
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label className="mb-1 text-xs text-muted-foreground">Access</Label>
          <Select
            value={round.gatingMode}
            onValueChange={(v) => onChange({ gatingMode: v as RoundDraft['gatingMode'] })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">Open entry</SelectItem>
              <SelectItem value="prerequisite">Requires another round</SelectItem>
              <SelectItem value="qualified">Requires a medal (Global Round)</SelectItem>
              <SelectItem value="unqualified">Catch-up — until the student qualifies</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {round.gatingMode === 'prerequisite' && (
          <>
            <div>
              <Label className="mb-1 text-xs text-muted-foreground">Prerequisite round</Label>
              <Select
                value={round.requiresTempId ?? undefined}
                onValueChange={(v) => onChange({ requiresTempId: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a round" />
                </SelectTrigger>
                <SelectContent>
                  {others.map((o) => (
                    <SelectItem key={o.tempId} value={o.tempId}>
                      {`Round ${all.findIndex((x) => x.tempId === o.tempId) + 1}${
                        o.roundName ? ` — ${o.roundName}` : ''
                      }`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 text-xs text-muted-foreground">Student must have…</Label>
              <Select
                value={round.gatingRule}
                onValueChange={(v) => onChange({ gatingRule: v as RoundDraft['gatingRule'] })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GATING_RULES.map((g) => (
                    <SelectItem key={g.value} value={g.value}>
                      {g.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>

      <div>
        <Label className="mb-1 text-xs text-muted-foreground">
          Required documents for this round
        </Label>
        <div className="flex gap-2">
          <Input
            value={newDoc}
            onChange={(e) => setNewDoc(e.target.value)}
            placeholder="e.g. Student ID"
            className="h-8"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addDoc();
              }
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={addDoc}>
            Add
          </Button>
        </div>
        {round.requiredDocs.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {round.requiredDocs.map((doc) => (
              <Badge key={doc} variant="secondary" className="gap-1 font-normal">
                {doc}
                <button
                  type="button"
                  onClick={() =>
                    onChange({ requiredDocs: round.requiredDocs.filter((d) => d !== doc) })
                  }
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={`Remove ${doc}`}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
