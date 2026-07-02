// Shared per-competition visual identity — ONE source of truth for how a
// competition looks anywhere it's rendered as a card (student catalog, admin
// management grid, the account "My Competitions" page, …).
//
// Known competitions reuse the registry gradient + the self-hosted
// /competitions/<slug>.webp logo (mirrored from competzy.com). Operator-created
// competitions with no hand-tuned branding hash into a stable palette drawn
// ONLY from the landing's categorical accents, so every card is recognisable
// instead of a wall of white cards.

import { competitionRegistry } from '@/lib/competitions/registry';

export interface BrandableCompetition {
  id: string;
  slug?: string | null;
  name?: string | null;
  logoUrl?: string | null;
}

// Self-hosted logos in /public/competitions/<file>.webp. Matched by keyword
// against slug + name, because operator-created slugs look like
// `international-greenwich-olympiad-f3i6d`.
const LOGO_MATCHERS: { file: string; test: RegExp }[] = [
  { file: 'komodo', test: /komodo/i },
  { file: 'owlypia', test: /owlypia/i },
  { file: 'genius', test: /genius/i },
  { file: 'igo', test: /\bigo\b|greenwich/i },
  { file: 'nextgen', test: /next\s*gen/i },
  { file: 'coding', test: /coding/i },
  { file: 'ispo', test: /\bispo\b/i },
  { file: 'osebi', test: /osebi/i },
  { file: 'emc', test: /\bemc\b/i },
];

export function resolveLogo(comp: BrandableCompetition): string | null {
  const hay = `${comp.slug ?? ''} ${comp.name ?? ''}`;
  for (const m of LOGO_MATCHERS) if (m.test.test(hay)) return `/competitions/${m.file}.webp`;
  // An operator-uploaded absolute logo URL is the last resort.
  return comp.logoUrl && /^https?:\/\//i.test(comp.logoUrl) ? comp.logoUrl : null;
}

export type Palette = { from: string; to: string; accent: string; glow: string; ink: 'light' | 'dark' };

// Landing categorical accents only — indigo, pink, orange, green, blue,
// gold, lime, sirih.
const HASH_PALETTES: Palette[] = [
  { from: '#6a3dff', to: '#2a1170', accent: '#5627ff', glow: '#937aff', ink: 'light' },
  { from: '#e85aa0', to: '#b01561', accent: '#d9277b', glow: '#f5b1d0', ink: 'light' },
  { from: '#ffb84d', to: '#c47200', accent: '#f08c00', glow: '#ffd9a1', ink: 'dark' },
  { from: '#54c91f', to: '#20720a', accent: '#31ab00', glow: '#a8e88a', ink: 'light' },
  { from: '#3d8bff', to: '#0047c2', accent: '#0066ff', glow: '#9cc4ff', ink: 'light' },
  { from: '#fbe57a', to: '#d9b21a', accent: '#b8860b', glow: '#fdf2b3', ink: 'dark' },
  { from: '#a5ec4a', to: '#57a30a', accent: '#4f8f0e', glow: '#d3f5a1', ink: 'dark' },
  { from: '#937aff', to: '#4a22cc', accent: '#5627ff', glow: '#c9bcff', ink: 'light' },
];

export type CardBrand = Palette & { logoSrc: string | null };

export function brandFor(comp: BrandableCompetition): CardBrand {
  const reg = comp.slug ? competitionRegistry[comp.slug] : undefined;
  let palette: Palette;
  if (reg) {
    // Real brand gradient + accent — matches the competition's portal hero.
    palette = {
      from: reg.gradient[0],
      to: reg.gradient[1],
      accent: reg.accent,
      glow: reg.activeAccent ?? reg.accent,
      ink: 'light',
    };
  } else {
    const key = comp.id || comp.slug || comp.name || '';
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    palette = HASH_PALETTES[h % HASH_PALETTES.length];
  }
  return { ...palette, logoSrc: resolveLogo(comp) };
}

// Canonical catalog display order (business-decided). Matched by keyword
// against slug + name, so operator-created slugs still rank. Anything not
// matched keeps its relative order after the ranked ones.
const DISPLAY_ORDER: RegExp[] = [
  /\bemc\b/i,
  /genius/i,
  /komodo/i,
  /\bispo\b/i,
  /osebi/i,
  /owlypia/i,
  /\bstem\b/i,
  /next\s*gen/i,
  /coding/i,
  /young\s*master/i,
  /teeneagle/i,
  /angkor/i,
  /greenwich|\bigo\b/i,
];

export function displayRank(comp: { slug?: string | null; name?: string | null }): number {
  const hay = `${comp.slug ?? ''} ${comp.name ?? ''}`;
  for (let i = 0; i < DISPLAY_ORDER.length; i++) {
    if (DISPLAY_ORDER[i].test(hay)) return i;
  }
  return DISPLAY_ORDER.length;
}

/** Stable sort into the canonical order; unranked items keep relative order. */
export function orderCompetitions<T extends { slug?: string | null; name?: string | null }>(list: T[]): T[] {
  return list
    .map((c, i) => ({ c, i }))
    .sort((a, b) => displayRank(a.c) - displayRank(b.c) || a.i - b.i)
    .map((x) => x.c);
}

/** hex → rgba, for the soft brand wash painted over theme-aware card bodies. */
export function hexA(hex: string, a: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
