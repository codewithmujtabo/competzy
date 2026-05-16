'use client';

import { questionBankHttp } from '@/lib/api/client';
import { createRoleAuth } from './factory';

// Re-export so callers can import the HTTP client from the same module.
export { questionBankHttp } from '@/lib/api/client';

// The question bank is managed from inside the admin + organizer roles —
// there is no dedicated question-maker account.
const { Provider, useHook } = createRoleAuth({
  http: questionBankHttp,
  acceptRole: (role) => role === 'admin' || role === 'organizer',
  hookName: 'useQuestionBankAuth',
  deniedMessage: 'Access denied. An admin or organizer account is required.',
});

export const QuestionBankAuthProvider = Provider;
export const useQuestionBankAuth = useHook;
