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
  /**
   * Dashboard hero treatment:
   *  - `'tricolor'` — white card, multi-colour wordmark + math watermark (EMC)
   *  - `'komodo'`   — deep-purple gradient, lime accents + mascot watermark
   *  - `'gradient'` (default) — a clean accent-gradient hero
   */
  heroStyle?: 'tricolor' | 'komodo' | 'gradient';
  /** Three-colour palette used when `heroStyle === 'tricolor'`. */
  tricolor?: { blue: string; pink: string; orange: string };
  /**
   * Hero headline. Overrides `wordmark` as the big H1 in the dashboard hero —
   * e.g. Komodo's "Komodo 2026/2027 — Your Journey to Bali". Falls back to
   * `wordmark` when unset.
   */
  heroTitle?: string;
  /** Emoji mascot rendered as a faded watermark on the `'komodo'` hero. */
  mascot?: string;
  /**
   * Highlight colour for active nodes / badges / the Next-action CTA. Defaults
   * to `accent`. EMC = orange; Komodo = lime (see `compTheme`).
   */
  activeAccent?: string;
}

export const competitionRegistry: Record<string, CompetitionPortalConfig> = {
  emc: {
    slug: 'emc',
    shortName: 'EMC',
    wordmark: 'Mathematics Competition',
    tagline: 'Where problem-solvers become champions',
    accent: '#1B6EF3',
    accentDark: '#1456c4',
    gradient: ['#1B6EF3', '#0D47C4'] as const,
    heroStyle: 'tricolor',
    tricolor: { blue: '#1B6EF3', pink: '#E91E8C', orange: '#FF6B00' },
    activeAccent: '#FF6B00',
  },
  ispo: {
    slug: 'ispo',
    shortName: 'ISPO',
    wordmark: 'Science Project Olympiad',
    tagline: 'Turn your idea into a science project',
    accent: '#0E7C66',
    accentDark: '#0a5a4a',
    gradient: ['#0E7C66', '#0a5a4a'] as const,
  },
  osebi: {
    slug: 'osebi',
    shortName: 'OSEBI',
    wordmark: 'Arts & Culture Competition',
    tagline: 'Celebrate creativity and culture',
    accent: '#D9277B',
    accentDark: '#a81a5d',
    gradient: ['#D9277B', '#a81a5d'] as const,
  },
  komodo: {
    slug: 'komodo',
    shortName: 'Komodo',
    wordmark: 'International Math Competition',
    heroTitle: 'Komodo 2026/2027, Your Journey to Bali',
    tagline: 'A playing ground for agile young minds.',
    accent: '#5627FF',
    accentDark: '#3A1290',
    gradient: ['#1E0550', '#3A1290'] as const,
    heroStyle: 'komodo',
    activeAccent: '#B8FF00',
    mascot: '🦎',
  },
};

/**
 * Default landing slug for student/parent post-login routing — used by `/`'s
 * "create a student account" link.
 */
export const DEFAULT_COMPETITION_SLUG = 'emc';

/**
 * Derives a usable portal config for a competition with no hand-tuned registry
 * entry — e.g. an operator-created competition. The portal (catalog →
 * dashboard) still works; only the bespoke branding is missing.
 */
function defaultPortalConfig(slug: string): CompetitionPortalConfig {
  const words = slug
    .replace(/-[a-z0-9]{1,6}$/i, '') // drop the uniqueness suffix appended on create
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1));
  const wordmark = words.join(' ') || 'Competition';
  return {
    slug,
    shortName: (words[0] ?? 'Competition').slice(0, 14),
    wordmark,
    tagline: 'Compete. Learn. Grow.',
    accent: '#5627FF',
    accentDark: '#3a1bb8',
    gradient: ['#5627FF', '#3a1bb8'] as const,
  };
}

/**
 * Returns the portal config for a slug — the hand-tuned registry entry if one
 * exists, otherwise a derived default so every catalog competition has a
 * working portal. Never null.
 */
export function getCompetitionConfig(slug: string): CompetitionPortalConfig {
  return competitionRegistry[slug] ?? defaultPortalConfig(slug);
}

/**
 * Builds the canonical paths for a competition portal. All competition
 * portals share the unified `/` login — the `?comp=<slug>` query keeps the
 * login + forgot-password screens branded with this competition, and routes
 * the student/parent post-login back to this dashboard.
 */
export function competitionPaths(slug: string) {
  const q = `?comp=${encodeURIComponent(slug)}`;
  return {
    login:     `/${q}`,
    register:  `/competitions/${slug}/register`,
    dashboard: `/competitions/${slug}/dashboard`,
    admin:     `/competitions/${slug}/admin`,
    pay:       `/competitions/${slug}/pay`,
    store:     `/competitions/${slug}/store`,
    announcements: `/competitions/${slug}/announcements`,
    materials: `/competitions/${slug}/materials`,
    feedback:  `/competitions/${slug}/feedback`,
    certificate: `/competitions/${slug}/certificates`,
    forgotPassword: `/forgot-password${q}`,
  };
}
