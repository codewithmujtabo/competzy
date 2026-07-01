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
import { useT } from '@/lib/i18n/context';
import type { MessageKey } from '@/lib/i18n/messages/en';

const ROUND_TYPES = ['Online', 'On-site', 'Hybrid'];
const ROUND_TYPE_KEY: Record<string, MessageKey> = {
  Online: 'rb.typeOnline',
  'On-site': 'rb.typeOnsite',
  Hybrid: 'rb.typeHybrid',
};
const GATING_RULES: { value: string; labelKey: MessageKey }[] = [
  { value: 'registered', labelKey: 'rb.ruleRegistered' },
  { value: 'paid', labelKey: 'rb.rulePaid' },
  { value: 'completed', labelKey: 'rb.ruleCompleted' },
];
const ROUND_CATEGORIES: { value: string; labelKey: MessageKey }[] = [
  { value: 'online', labelKey: 'rb.catOnline' },
  { value: 'fast_track', labelKey: 'rb.catFastTrack' },
  { value: 'local', labelKey: 'rb.catLocal' },
  { value: 'global', labelKey: 'rb.catGlobal' },
];
const EXAM_MODES: { value: string; labelKey: MessageKey }[] = [
  { value: 'online', labelKey: 'rb.examOnline' },
  { value: 'offline', labelKey: 'rb.examOffline' },
];

export interface RoundDraft {
  /** Stable client-side id — gating prerequisites reference this, not an index. */
  tempId: string;
  roundName: string;
  /** Optional Bahasa Indonesia translation of the round name (Phase 4 i18n). */
  roundNameId: string;
  roundType: string;
  roundCategory: string;
  startDate: string;
  registrationDeadline: string;
  examDate: string;
  resultsDate: string;
  fee: number;
  /**
   * Optional international price in USD. Null means "no international price"
   * — non-Indonesian students will see the round but won't get a price quote.
   * Stored as a number so cents are allowed (e.g. 19.99).
   */
  feeInternational: number | null;
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
  /**
   * For age-grouped competitions (Komodo): the date the student's age is
   * measured against to pick a creature bracket. Per-round so the bracket
   * shifts as students age between rounds. Blank for grade-based comps.
   */
  ageCutoffDate: string;
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
    roundNameId: '',
    roundType: 'Online',
    roundCategory: 'online',
    startDate: '',
    registrationDeadline: '',
    examDate: '',
    resultsDate: '',
    fee: 0,
    feeInternational: null,
    qualifyingScore: null,
    location: '',
    country: '',
    examMode: 'online',
    requiredDocs: [],
    gatingMode: 'open',
    requiresTempId: null,
    gatingRule: 'completed',
    isActive: true,
    ageCutoffDate: '',
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
      roundNameId: r?.roundNameId ?? '',
      roundType: ROUND_TYPES.includes(r?.roundType) ? r.roundType : 'Online',
      roundCategory: r?.roundCategory ?? 'online',
      startDate: dateInput(r?.startDate),
      registrationDeadline: dateInput(r?.registrationDeadline),
      examDate: dateInput(r?.examDate),
      resultsDate: dateInput(r?.resultsDate),
      fee: Number(r?.fee) || 0,
      feeInternational:
        r?.feeInternational != null && Number.isFinite(Number(r.feeInternational))
          ? Number(r.feeInternational)
          : null,
      qualifyingScore: r?.qualifyingScore != null ? Number(r.qualifyingScore) : null,
      location: r?.location ?? '',
      country: r?.country ?? '',
      examMode: r?.examMode === 'offline' ? 'offline' : 'online',
      requiredDocs: Array.isArray(r?.requiredDocs) ? r.requiredDocs : [],
      gatingMode: ['prerequisite', 'qualified', 'unqualified'].includes(mode) ? mode : 'open',
      requiresTempId: reqId ? idToTemp.get(String(reqId)) ?? null : null,
      gatingRule: r?.gating?.rule ?? 'completed',
      isActive: r?.isActive !== false,
      ageCutoffDate: dateInput(r?.ageCutoffDate),
    } as RoundDraft;
  });
}

/** Editable drafts → the `rounds` payload for a POST/PUT competition. */
export function draftsToPayload(drafts: RoundDraft[]) {
  return drafts.map((r) => ({
    roundName: r.roundName,
    roundNameId: r.roundNameId.trim() || null,
    roundType: r.roundType,
    roundCategory: r.roundCategory,
    startDate: r.startDate || null,
    registrationDeadline: r.registrationDeadline || null,
    examDate: r.examDate || null,
    resultsDate: r.resultsDate || null,
    fee: Number(r.fee) || 0,
    feeInternational: r.feeInternational != null ? Number(r.feeInternational) : null,
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
    ageCutoffDate: r.ageCutoffDate || null,
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
): { tone: 'warn' | 'info'; key: MessageKey; vars?: Record<string, string | number> } | null {
  if (round.roundCategory === 'fast_track') {
    const openOnline = all.filter(
      (r) => r.roundCategory === 'online' && registrationOpen(r),
    );
    const onlineCount = all.filter((r) => r.roundCategory === 'online').length;
    if (round.isActive && openOnline.length > 0) {
      return openOnline.length > 1
        ? { tone: 'warn', key: 'rb.adviceFtWarnMany', vars: { count: openOnline.length } }
        : { tone: 'warn', key: 'rb.adviceFtWarnOne' };
    }
    if (!round.isActive && onlineCount > 0 && openOnline.length === 0) {
      return { tone: 'info', key: 'rb.adviceFtInfo' };
    }
    return null;
  }
  if (round.roundCategory === 'global') {
    const others = all.filter((r) => r.tempId !== round.tempId);
    const unfinished = others.filter((r) => !roundFinished(r));
    if (round.isActive && unfinished.length > 0) {
      return unfinished.length > 1
        ? { tone: 'warn', key: 'rb.adviceGlobalWarnMany', vars: { count: unfinished.length } }
        : { tone: 'warn', key: 'rb.adviceGlobalWarnOne' };
    }
    if (!round.isActive && others.length > 0 && unfinished.length === 0) {
      return { tone: 'info', key: 'rb.adviceGlobalInfo' };
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
  const t = useT();
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
        <p className="text-sm text-muted-foreground">{t('rb.emptyHint')}</p>
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
        {t('rb.addRound')}
      </Button>
    </div>
  );
}

const DATE_FIELDS: readonly (readonly [keyof RoundDraft, MessageKey])[] = [
  ['startDate', 'rb.dateStarts'],
  ['registrationDeadline', 'rb.dateRegDeadline'],
  ['examDate', 'rb.dateExam'],
  ['resultsDate', 'rb.dateResults'],
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
  const t = useT();
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
          {t('rb.roundLabel', { n: index + 1 })}
        </Badge>
        <Input
          value={round.roundName}
          onChange={(e) => onChange({ roundName: e.target.value })}
          placeholder={t('rb.roundNamePlaceholder')}
          className="h-8 flex-1"
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          disabled={isFirst}
          onClick={() => onMove(-1)}
          aria-label={t('rb.moveUp')}
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
          aria-label={t('rb.moveDown')}
        >
          <ChevronDown className="size-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-destructive hover:text-destructive"
          onClick={onRemove}
          aria-label={t('rb.removeRound')}
        >
          <X className="size-4" />
        </Button>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {t('rb.roundNameIdLabel')}
            <span className="font-mono text-[9px] uppercase tracking-wide text-primary">ID</span>
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px] text-muted-foreground"
            disabled={!round.roundName.trim()}
            onClick={() => onChange({ roundNameId: round.roundName })}
          >
            {t('rb.copyFromEnglish')}
          </Button>
        </div>
        <Input
          value={round.roundNameId}
          onChange={(e) => onChange({ roundNameId: e.target.value })}
          placeholder={t('rb.roundNameIdPlaceholder')}
          className="h-8"
        />
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
              {round.isActive ? t('rb.visible') : t('rb.hidden')}
            </Label>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
              {t('rb.visibilityHint')}
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
            {t(advice.key, advice.vars)}
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label className="mb-1 text-xs text-muted-foreground">{t('rb.type')}</Label>
          <Select value={round.roundType} onValueChange={(v) => onChange({ roundType: v })}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROUND_TYPES.map((rt) => (
                <SelectItem key={rt} value={rt}>
                  {t(ROUND_TYPE_KEY[rt])}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1 text-xs text-muted-foreground">{t('rb.feeIdr')}</Label>
          <Input
            type="number"
            value={round.fee}
            onChange={(e) => onChange({ fee: parseInt(e.target.value, 10) || 0 })}
          />
        </div>
        <div>
          <Label className="mb-1 text-xs text-muted-foreground">
            {t('rb.feeUsd')} <span className="text-muted-foreground/70">{t('rb.optional')}</span>
          </Label>
          <Input
            type="number"
            step="0.01"
            value={round.feeInternational ?? ''}
            onChange={(e) => {
              const raw = e.target.value.trim();
              const next = raw === '' ? null : Number(raw);
              onChange({ feeInternational: next != null && Number.isFinite(next) ? next : null });
            }}
            placeholder={t('rb.feeUsdPlaceholder')}
          />
        </div>
      </div>

      <div>
        <Label className="mb-1 text-xs text-muted-foreground">{t('rb.location')}</Label>
        <Input
          value={round.location}
          onChange={(e) => onChange({ location: e.target.value })}
          placeholder={t('rb.locationPlaceholder')}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="mb-1 text-xs text-muted-foreground">{t('rb.category')}</Label>
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
                  {t(c.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1 text-xs text-muted-foreground">{t('rb.qualifyingScore')}</Label>
          <Input
            type="number"
            value={round.qualifyingScore ?? ''}
            onChange={(e) =>
              onChange({
                qualifyingScore: e.target.value === '' ? null : parseInt(e.target.value, 10),
              })
            }
            placeholder={t('rb.qualifyingPlaceholder')}
          />
        </div>
        {round.roundCategory === 'local' && (
          <>
            <div>
              <Label className="mb-1 text-xs text-muted-foreground">{t('rb.country')}</Label>
              <Input
                value={round.country}
                onChange={(e) => onChange({ country: e.target.value })}
                placeholder={t('rb.countryPlaceholder')}
              />
            </div>
            <div>
              <Label className="mb-1 text-xs text-muted-foreground">{t('rb.examMode')}</Label>
              <Select value={round.examMode} onValueChange={(v) => onChange({ examMode: v })}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXAM_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {t(m.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {DATE_FIELDS.map(([key, labelKey]) => (
          <div key={key}>
            <Label className="mb-1 text-xs text-muted-foreground">{t(labelKey)}</Label>
            <Input
              type="date"
              value={round[key] as string}
              onChange={(e) => onChange({ [key]: e.target.value } as Partial<RoundDraft>)}
            />
          </div>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="mb-1 text-xs text-muted-foreground">{t('rb.ageCutoff')}</Label>
          <Input
            type="date"
            value={round.ageCutoffDate}
            onChange={(e) => onChange({ ageCutoffDate: e.target.value })}
          />
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {t('rb.ageCutoffHint')}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <Label className="mb-1 text-xs text-muted-foreground">{t('rb.access')}</Label>
          <Select
            value={round.gatingMode}
            onValueChange={(v) => onChange({ gatingMode: v as RoundDraft['gatingMode'] })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="open">{t('rb.accessOpen')}</SelectItem>
              <SelectItem value="prerequisite">{t('rb.accessPrereq')}</SelectItem>
              <SelectItem value="qualified">{t('rb.accessQualified')}</SelectItem>
              <SelectItem value="unqualified">{t('rb.accessUnqualified')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {round.gatingMode === 'prerequisite' && (
          <>
            <div>
              <Label className="mb-1 text-xs text-muted-foreground">{t('rb.prereqRound')}</Label>
              <Select
                value={round.requiresTempId ?? undefined}
                onValueChange={(v) => onChange({ requiresTempId: v })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('rb.selectRound')} />
                </SelectTrigger>
                <SelectContent>
                  {others.map((o) => (
                    <SelectItem key={o.tempId} value={o.tempId}>
                      {`${t('rb.roundLabel', {
                        n: all.findIndex((x) => x.tempId === o.tempId) + 1,
                      })}${o.roundName ? `, ${o.roundName}` : ''}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 text-xs text-muted-foreground">{t('rb.studentMustHave')}</Label>
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
                      {t(g.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>

      <div>
        <Label className="mb-1 text-xs text-muted-foreground">{t('rb.reqDocsRound')}</Label>
        <div className="flex gap-2">
          <Input
            value={newDoc}
            onChange={(e) => setNewDoc(e.target.value)}
            placeholder={t('rb.reqDocPlaceholder')}
            className="h-8"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addDoc();
              }
            }}
          />
          <Button type="button" variant="outline" size="sm" onClick={addDoc}>
            {t('rb.add')}
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
                  aria-label={t('cf.removeDoc', { doc })}
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
