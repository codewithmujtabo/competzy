// Slug-keyed registry of per-competition portal configs. The URL structure
// `/competitions/[slug]/{register,dashboard,admin}` reuses the SAME pages —
// look up `competitionRegistry[slug]` to get the branding for the current
// portal. Add a new competition by adding a new entry here; no new route
// files needed.

export interface CompetitionPortalConfig {
  /** Matches the `slug` column on the `competitions` row. */
  slug: string;
  /** Short identifier shown on the brand-panel disc (e.g. "EMC", "ISPO"). */
  shortName: string;
  /** Full competition name on the brand panel under the headline. */
  wordmark: string;
  /** One-liner tagline shown in italics. */
  tagline: string;
  /** Primary accent hex (button background, focus rings, status pills). */
  accent: string;
  /** Slightly darker accent hex for hover/pressed states. */
  accentDark: string;
  /** Two-stop gradient for the brand panel left half. */
  gradient: readonly [string, string];
}

export const competitionRegistry: Record<string, CompetitionPortalConfig> = {
  'emc-2026': {
    slug: 'emc-2026',
    shortName: 'EMC',
    wordmark: 'Mathematics Competition',
    tagline: 'Rejuvenate your Brain with Math',
    accent: '#5627FF',
    accentDark: '#3a1bb8',
    gradient: ['#5627FF', '#3a1bb8'] as const,
  },
};

/**
 * Default landing slug for student/parent post-login routing.
 * Replaced with a true `/competitions` catalog page in Wave 2.
 */
export const DEFAULT_COMPETITION_SLUG = 'emc-2026';

export function getCompetitionConfig(slug: string): CompetitionPortalConfig | null {
  return competitionRegistry[slug] ?? null;
}

/**
 * Builds the canonical paths for a competition portal. All competition
 * portals share the unified `/` login.
 */
export function competitionPaths(slug: string) {
  return {
    login:     '/',
    register:  `/competitions/${slug}/register`,
    dashboard: `/competitions/${slug}/dashboard`,
    admin:     `/competitions/${slug}/admin`,
  };
}
