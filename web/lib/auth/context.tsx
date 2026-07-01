'use client';

import { adminHttp } from '@/lib/api/client';
import { createRoleAuth } from './factory';

const { Provider, useHook } = createRoleAuth({
  http: adminHttp,
  acceptRole: role => role === 'admin' || role === 'manager',
  hookName: 'useAuth',
  deniedMessage: 'Access denied. Admin or Manager account required.',
});

export const AuthProvider = Provider;
export const useAuth      = useHook;
