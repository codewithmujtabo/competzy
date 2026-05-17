'use client';

import { emcHttp } from '@/lib/api/client';
import { createRoleAuth } from './factory';

// Auth context shared by every competition portal (slug-agnostic). The role
// gate accepts the participant-side roles (student, parent) plus admin —
// admins land on the per-competition admin view. The provider is mounted
// once in `web/app/(competitions)/layout.tsx` so all child pages share a
// single hydration of GET /auth/me.
//
// All sign-in happens at the unified `/` route; this context only gates
// authenticated pages inside `/competitions/[slug]/…`.
const { Provider, useHook } = createRoleAuth({
  http: emcHttp,
  acceptRole: role => role === 'admin' || role === 'student' || role === 'parent',
  hookName: 'useCompetitionAuth',
  deniedMessage:
    'This portal is for students, parents, and admins. Sign in from the home page to land on the right workspace.',
});

export const CompetitionAuthProvider = Provider;
export const useCompetitionAuth      = useHook;
