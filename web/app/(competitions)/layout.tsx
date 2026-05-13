// Route-group layout for the per-competition portals (/emc/*, future /ispo/*, …).
// Mounts the EMC auth context so login/register/dashboard/admin pages all
// share one hydration of GET /auth/me. No auth guard at this level — the
// login + register pages must be reachable unauthenticated; the dashboard
// and admin sub-layouts apply their own role guards.

import type { ReactNode } from 'react';
import { EmcAuthProvider } from '@/lib/auth/emc-context';

export default function CompetitionsLayout({ children }: { children: ReactNode }) {
  return <EmcAuthProvider>{children}</EmcAuthProvider>;
}
