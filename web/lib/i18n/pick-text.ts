import type { Locale } from './context';

// Phase 4 — dynamic-content i18n. Operator-authored text is stored as a
// canonical (English) value plus an optional Bahasa Indonesia translation in a
// parallel `*_id`-style field. `pickText` returns the translation when the
// active locale is ID and it's non-empty, otherwise the canonical value —
// mirroring the question bank's `pickLang` fallback behaviour.
//
//   pickText(step.title, step.titleId, locale)
export function pickText(
  base: string | null | undefined,
  translated: string | null | undefined,
  locale: Locale,
): string {
  if (locale === 'id' && typeof translated === 'string' && translated.trim()) {
    return translated;
  }
  return base ?? '';
}
