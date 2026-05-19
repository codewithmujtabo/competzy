// Standard interest categories for the student profile.
// Kept in sync with the mobile app's `app/constants/interests.ts` — the web is
// a separate package, so the list is duplicated rather than shared.

export const INTEREST_CATEGORIES = [
  'Math',
  'Science',
  'Debate',
  'Arts',
  'Language',
  'Technology',
  'Sports',
] as const;

export type InterestCategory = (typeof INTEREST_CATEGORIES)[number];
