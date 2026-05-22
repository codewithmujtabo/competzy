'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { countryRepHttp } from '@/lib/api/client';

// The country-representative portal payload — returned by GET /api/rep/context.
// Every page in /rep-portal/* loads this once on mount.

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
  localRound: RepLocalRound | null;
  students: RepStudent[];
}

export function useRepContext() {
  const [ctx, setCtx] = useState<RepContext | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setCtx(await countryRepHttp.get<RepContext>('/rep/context'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load your portal');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { ctx, loading, refresh };
}

export function rupiah(n: number): string {
  return `Rp ${new Intl.NumberFormat('id-ID').format(n)}`;
}
