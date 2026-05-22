// Mobile mirror of web/lib/question-bank/languages.ts.
// Keep the two in sync — they describe the same 6 question columns.

export const LANGS = [
  { col: "content", code: "en", label: "English" },
  { col: "content2", code: "id", label: "Bahasa" },
  { col: "content3", code: "ru", label: "Russian" },
  { col: "content4", code: "es", label: "Spanish" },
  { col: "content5", code: "fr", label: "French" },
  { col: "content6", code: "kk", label: "Kazakh" },
] as const;

export type LangCol =
  | "content"
  | "content2"
  | "content3"
  | "content4"
  | "content5"
  | "content6";

export type LangCode = (typeof LANGS)[number]["code"];

export const LANG_TO_COL: Record<string, LangCol> = Object.fromEntries(
  LANGS.map((l) => [l.code, l.col]),
) as Record<string, LangCol>;

/**
 * Pick the right language content from a row that carries all 6 columns,
 * falling back to English (`content`) when the chosen language is empty.
 * The web app keeps a parallel implementation in
 * web/lib/question-bank/languages.ts — they must stay in sync.
 */
export function pickLang(
  row: Partial<Record<LangCol, string | null>> | null | undefined,
  langCode: string,
): string {
  if (!row) return "";
  const col = LANG_TO_COL[langCode] ?? "content";
  const v = row[col];
  if (typeof v === "string" && v.trim()) return v;
  return (row.content as string | undefined) ?? "";
}

/**
 * Strip HTML to plain text for React Native Text rendering. The web app
 * renders the same HTML through KaTeX-styled spans (operator-authored
 * TipTap output); mobile gets the readable text + LaTeX source. A future
 * phase can swap this for `react-native-render-html` + a KaTeX RN renderer
 * to display math properly on phones too.
 */
export function htmlToPlainText(html: string): string {
  if (!html) return "";
  return html
    // <br> + block tags become newlines so paragraphs don't run together.
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    // Strip everything else.
    .replace(/<[^>]+>/g, "")
    // HTML entities — the common ones.
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    // Collapse 3+ newlines into 2.
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
