// Route-group layout for every per-competition portal at
// /competitions/[slug]/{register,dashboard,admin}. Mounts the slug-agnostic
// auth context so login/register/dashboard/admin pages all share one
// hydration of GET /auth/me. No auth guard at this level — the register
// page must be reachable unauthenticated; the dashboard and admin
// sub-layouts apply their own role guards.

import type { ReactNode } from 'react';
import { CompetitionAuthProvider } from '@/lib/auth/competition-context';

export default function CompetitionsLayout({ children }: { children: ReactNode }) {
  return <CompetitionAuthProvider>{children}</CompetitionAuthProvider>;
}
