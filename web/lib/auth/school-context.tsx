'use client';

import { schoolHttp } from '@/lib/api/client';
import { createRoleAuth } from './factory';

// Re-export so existing callers don't have to change their import path.
export { schoolHttp, schoolFetch } from '@/lib/api/client';

const { Provider, useHook } = createRoleAuth({
  http: schoolHttp,
  acceptRole: role => role === 'school_admin' || role === 'teacher',
  hookName: 'useSchool',
  deniedMessage: 'Access denied. School coordinator or teacher account required.',
});

export const SchoolProvider = Provider;
export const useSchool      = useHook;
