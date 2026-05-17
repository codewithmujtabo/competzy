'use client';

import { organizerHttp } from '@/lib/api/client';
import { createRoleAuth } from './factory';

// Re-export for components that imported organizerHttp from this file historically.
export { organizerHttp } from '@/lib/api/client';

const { Provider, useHook } = createRoleAuth({
  http: organizerHttp,
  acceptRole: role => role === 'organizer',
  hookName: 'useOrganizer',
  deniedMessage: 'Access denied. Organizer account required.',
});

export const OrganizerProvider = Provider;
export const useOrganizer      = useHook;
