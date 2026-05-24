'use client';

// Country-representative portal context. A rep can operate on any round in
// the competition that they have access to — their country's local round AND
// every online/fast-track/global round Komodo runs centrally. The picker on
// every page selects which round the rest of the page reads from; the choice
// persists across navigation via localStorage, and is reflected in the
// /rep/context payload via the ?roundId= query param so the student roster +
// counts come back scoped to the same round.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import { countryRepHttp } from '@/lib/api/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

export interface RepStudent {
  registrationId: string;
  status: string;
  score: number | null;
  isMedalist: boolean | null;
  userId: string;
  fullName: string;
  email: string;
  grade: string | null;
}

// A single round in the rep's accessible set. `category` discriminates between
// `online` / `fast_track` / `local` / `global` so the picker can label it
// without ambiguity (two online rounds otherwise look identical in the list).
export interface RepRound {
  id: string;
  name: string;
  category: 'online' | 'fast_track' | 'local' | 'global' | string;
  country: string | null;
  isActive: boolean;
  fee: number;
  examMode: string;
  qualifyingScore: number | null;
  examDate: string | null;
}

export interface RepContextPayload {
  country: string;
  competition: { id: string; name: string };
  rounds: RepRound[];
  localRound: RepRound | null;
  selectedRound: RepRound | null;
  students: RepStudent[];
}

interface RepState {
  ctx: RepContextPayload | null;
  loading: boolean;
  selectedRoundId: string;
  setSelectedRoundId: (id: string) => void;
  refresh: () => Promise<void>;
}

const Ctx = createContext<RepState | null>(null);
const STORAGE_KEY = 'competzy.rep.roundId';

export function RepProvider({ children }: { children: ReactNode }) {
  const [ctx, setCtx] = useState<RepContextPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRoundId, setSelectedRoundIdState] = useState('');
  const [hydrated, setHydrated] = useState(false);

  // Hydrate the persisted selection once. We can't read localStorage during
  // SSR / first render, so this useEffect bumps `hydrated` so the fetch
  // effect knows the round id is final.
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSelectedRoundIdState(localStorage.getItem(STORAGE_KEY) || '');
    }
    setHydrated(true);
  }, []);

  const fetchCtx = useCallback(async (roundId: string) => {
    setLoading(true);
    try {
      const qs = roundId ? `?roundId=${encodeURIComponent(roundId)}` : '';
      const next = await countryRepHttp.get<RepContextPayload>(`/rep/context${qs}`);
      setCtx(next);
      // If the persisted id is no longer in the accessible set (rep moved
      // countries, round removed), fall back to whatever the backend selected.
      if (roundId && !next.rounds.some((r) => r.id === roundId)) {
        const fallback = next.selectedRound?.id ?? '';
        setSelectedRoundIdState(fallback);
        if (typeof window !== 'undefined') {
          if (fallback) localStorage.setItem(STORAGE_KEY, fallback);
          else localStorage.removeItem(STORAGE_KEY);
        }
      } else if (!roundId && next.selectedRound) {
        // Backend defaulted us to a round — adopt it so the UI shows that
        // round as the active selection in the picker.
        setSelectedRoundIdState(next.selectedRound.id);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load your portal');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    fetchCtx(selectedRoundId);
  }, [hydrated, selectedRoundId, fetchCtx]);

  const setSelectedRoundId = useCallback((id: string) => {
    setSelectedRoundIdState(id);
    if (typeof window !== 'undefined') {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const refresh = useCallback(async () => {
    await fetchCtx(selectedRoundId);
  }, [fetchCtx, selectedRoundId]);

  return (
    <Ctx.Provider value={{ ctx, loading, selectedRoundId, setSelectedRoundId, refresh }}>
      {children}
    </Ctx.Provider>
  );
}

export function useRep() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useRep must be used inside <RepProvider>');
  return v;
}

const CATEGORY_LABEL: Record<string, string> = {
  online: 'Online',
  fast_track: 'Fast Track',
  local: 'Local',
  global: 'Global',
};

export function roundCategoryLabel(category: string | null): string {
  if (!category) return 'Round';
  return CATEGORY_LABEL[category] ?? category;
}

/**
 * The global round picker — drop it at the top of every rep-portal page so the
 * rep can switch rounds without leaving the page they're on. Renders nothing
 * while loading or when the rep has access to fewer than two rounds (there's
 * nothing to pick between).
 */
export function RoundPicker({ className }: { className?: string }) {
  const { ctx, selectedRoundId, setSelectedRoundId, loading } = useRep();
  if (loading || !ctx || ctx.rounds.length <= 1) return null;

  const current = ctx.rounds.find((r) => r.id === selectedRoundId) ?? ctx.selectedRound;
  return (
    <Select value={current?.id ?? ''} onValueChange={setSelectedRoundId}>
      <SelectTrigger className={className ?? 'w-full sm:w-80'}>
        <SelectValue placeholder="Select a round…" />
      </SelectTrigger>
      <SelectContent>
        {ctx.rounds.map((r) => (
          <SelectItem key={r.id} value={r.id}>
            <span className="flex items-center gap-2">
              <span>{r.name}</span>
              <Badge variant="outline" className="text-[10px]">
                {roundCategoryLabel(r.category)}
                {r.category === 'local' && r.country ? ` · ${r.country}` : ''}
              </Badge>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function rupiah(n: number): string {
  return `Rp ${new Intl.NumberFormat('id-ID').format(n)}`;
}
