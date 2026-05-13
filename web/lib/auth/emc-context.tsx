'use client';

import { emcHttp } from '@/lib/api/client';
import { createRoleAuth } from './factory';

// Per-competition portal accepts students + parents (the "participant" surface)
// and admins (so the same admin lands on the EMC-scoped admin view). All sign-in
// happens at the unified `/` route; this context only gates EMC-specific pages
// (/emc/dashboard, /emc/admin).
const { Provider, useHook } = createRoleAuth({
  http: emcHttp,
  acceptRole: role => role === 'admin' || role === 'student' || role === 'parent',
  hookName: 'useEmcAuth',
  deniedMessage:
    'This portal is for students, parents, and admins. Sign in from the home page to land on the right workspace.',
});

export const EmcAuthProvider = Provider;
export const useEmcAuth      = useHook;
