// Canonical EMC portal config — one source for the slug + branding the
// /emc/* pages and the SplitScreenAuth component read.
//
// `slug` matches the seeded row in `competitions.slug` (migration
// 1748000000000_add-competition-slug). The web resolves it to a UUID/TEXT id
// at runtime via GET /api/competitions?slug=emc-2026 — never hardcode the id.

export const EMC = {
  slug: 'emc-2026',
  shortName: 'EMC',
  wordmark: 'Mathematics Competition',
  tagline: 'Rejuvenate your Brain with Math',
  accent: '#5627FF',
  accentDark: '#3a1bb8',
  // Used by the brand panel's gradient on the login/register split-screen.
  gradient: ['#5627FF', '#3a1bb8'] as const,
  loginPath: '/',
  registerPath: '/emc/register',
  dashboardPath: '/emc/dashboard',
  adminPath: '/emc/admin',
} as const;

export type CompetitionPortalConfig = typeof EMC;
