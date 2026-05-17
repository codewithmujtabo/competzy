// Grade-vocabulary reconciliation. A student's grade is stored numerically
// ("9"), but an exam may reference grades either numerically or by school level
// (SD = grades 1-6, SMP = 7-9, SMA = 10-12) — both in its `grades` tag and in
// its per-grade `correct_score` / `wrong_score` maps. `gradeTokens` returns
// every token a student's grade should match, so the two vocabularies reconcile
// instead of an exact-string compare silently excluding the student (from every
// exam, and from every point — a correct answer scoring 0).

export function gradeTokens(grade: string | null): string[] {
  if (!grade) return [];
  const tokens = new Set<string>([grade]);
  const n = parseInt(grade, 10);
  if (!Number.isNaN(n)) {
    tokens.add(String(n)); // normalize "09" → "9"
    if (n >= 1 && n <= 6) tokens.add("SD");
    else if (n >= 7 && n <= 9) tokens.add("SMP");
    else if (n >= 10 && n <= 12) tokens.add("SMA");
  }
  return [...tokens];
}
