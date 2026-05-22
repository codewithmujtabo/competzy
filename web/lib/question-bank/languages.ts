// Single source of truth for the 6 languages the question bank supports.
// Re-used by:
//   - the operator question editor (phase 4 — multi-language tab strip)
//   - the student exam runner (phase 5 — language picker + render-time pick)
//
// The `col` values are the actual Postgres column names on the `questions`
// and `answers` tables. The `code` values are ISO 639-1 / Komodo-compat
// codes saved on `sessions.language` and used by the URL query (?lang=fr).

export const LANGS = [
  { col: 'content',  code: 'en', label: 'English' },
  { col: 'content2', code: 'id', label: 'Bahasa' },
  { col: 'content3', code: 'ru', label: 'Russian' },
  { col: 'content4', code: 'es', label: 'Spanish' },
  { col: 'content5', code: 'fr', label: 'French' },
  { col: 'content6', code: 'kk', label: 'Kazakh' },
] as const;

export type LangCol =
  | 'content'
  | 'content2'
  | 'content3'
  | 'content4'
  | 'content5'
  | 'content6';

export type LangCode = (typeof LANGS)[number]['code'];

export const LANG_CODES = LANGS.map((l) => l.code);
export const LANG_COLS: readonly LangCol[] = LANGS.map((l) => l.col);

export const LANG_TO_COL: Record<string, LangCol> = Object.fromEntries(
  LANGS.map((l) => [l.code, l.col]),
) as Record<string, LangCol>;

export const COL_TO_CODE: Record<LangCol, LangCode> = Object.fromEntries(
  LANGS.map((l) => [l.col, l.code]),
) as Record<LangCol, LangCode>;

/**
 * Pick the right language content from a row that carries all 6 columns.
 * Falls back to English (`content`) when the chosen language is empty —
 * a question authored only in English still renders in any language the
 * student picks at exam start.
 */
export function pickLang(
  row: Partial<Record<LangCol, string | null>> | null | undefined,
  langCode: string,
): string {
  if (!row) return '';
  const col = LANG_TO_COL[langCode] ?? 'content';
  const v = row[col];
  if (typeof v === 'string' && v.trim()) return v;
  return (row.content as string | undefined) ?? '';
}

/** Empty Record<LangCol, string> — used to initialise editor state. */
export function emptyLangs(): Record<LangCol, string> {
  return {
    content: '',
    content2: '',
    content3: '',
    content4: '',
    content5: '',
    content6: '',
  };
}

/** Copy a row's 6 content columns into a Record<LangCol, string>. */
export function readLangs(
  row: Partial<Record<LangCol, string | null>> | null | undefined,
): Record<LangCol, string> {
  const out = emptyLangs();
  if (!row) return out;
  for (const col of LANG_COLS) {
    const v = row[col];
    out[col] = typeof v === 'string' ? v : '';
  }
  return out;
}
