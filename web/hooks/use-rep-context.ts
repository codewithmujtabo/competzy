'use client';

// Back-compat shim around the new <RepProvider> at @/lib/rep/context. The hook
// used to fetch /rep/context itself; that responsibility now lives in the
// provider so the round selection persists across navigation. Pages that read
// `ctx.localRound` keep working — it now points at the currently-selected
// round (which may or may not be the country's local round).

import { useRep, type RepStudent } from '@/lib/rep/context';

export interface RepLocalRound {
  id: string;
  name: string;
  fee: number;
  examMode: string;
  qualifyingScore: number | null;
  examDate: string | null;
}

export interface RepContext {
  country: string;
  competition: { id: string; name: string };
  /** The round the rep is currently operating on. Renamed from `localRound` —
   *  kept as an alias so the 6 portal pages migrate page-by-page. */
  selectedRound: RepLocalRound | null;
  /** @deprecated points at the currently-selected round, not necessarily the
   *  country's local round. New code should read `selectedRound` instead. */
  localRound: RepLocalRound | null;
  students: RepStudent[];
}

export type { RepStudent };

export function useRepContext() {
  const { ctx, loading, refresh } = useRep();
  if (!ctx) {
    return { ctx: null, loading, refresh };
  }
  const selected = ctx.selectedRound;
  const reshape: RepContext = {
    country: ctx.country,
    competition: ctx.competition,
    selectedRound: selected,
    localRound: selected, // alias — see deprecation note above
    students: ctx.students,
  };
  return { ctx: reshape, loading, refresh };
}

export { rupiah } from '@/lib/rep/context';
