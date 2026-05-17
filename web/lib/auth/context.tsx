'use client';

import { adminHttp } from '@/lib/api/client';
import { createRoleAuth } from './factory';

const { Provider, useHook } = createRoleAuth({
  http: adminHttp,
  acceptRole: role => role === 'admin',
  hookName: 'useAuth',
  deniedMessage: 'Access denied. Admin account required.',
});

export const AuthProvider = Provider;
export const useAuth      = useHook;
