'use client';

import { questionBankHttp } from '@/lib/api/client';
import { createRoleAuth } from './factory';

// Re-export so callers can import the HTTP client from the same module.
export { questionBankHttp } from '@/lib/api/client';

// The question bank is reachable from three roles:
//   - admin / organizer  — full workspace
//   - question_maker     — narrow author role: taxonomy + questions only,
//                          nav-filtered + backend path-scoped accordingly.
const { Provider, useHook } = createRoleAuth({
  http: questionBankHttp,
  acceptRole: (role) => role === 'admin' || role === 'organizer' || role === 'question_maker',
  hookName: 'useQuestionBankAuth',
  deniedMessage:
    'Access denied. An admin, organizer, or question-maker account is required.',
});

export const QuestionBankAuthProvider = Provider;
export const useQuestionBankAuth = useHook;
