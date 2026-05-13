'use client';

// Resolves "the canonical competition row" for a per-competition portal
// (e.g. EMC) by its slug. Used by register/dashboard/admin pages to find
// the comp_id to enroll into / filter registrations by.

import { useEffect, useState } from 'react';
import { emcHttp } from '@/lib/api/client';

export interface PortalCompetition {
  id: string;
  slug: string | null;
  name: string;
  fee: number;
  registrationStatus?: 'On Going' | 'Closed' | 'Coming Soon';
}

export function usePortalComp(slug: string) {
  const [comp, setComp]     = useState<PortalCompetition | null>(null);
  const [loading, setLoad]  = useState(true);
  const [error, setError]   = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoad(true);
    emcHttp
      .get<PortalCompetition[]>(`/competitions?slug=${encodeURIComponent(slug)}`)
      .then(rows => {
        if (cancelled) return;
        setComp(rows[0] ?? null);
        setError(rows[0] ? null : 'Competition not found');
      })
      .catch(e => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load competition');
      })
      .finally(() => { if (!cancelled) setLoad(false); });
    return () => { cancelled = true; };
  }, [slug]);

  return { comp, loading, error };
}
