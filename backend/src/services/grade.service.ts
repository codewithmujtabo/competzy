// Grade normalisation. A student's grade is stored numerically ("9"), and since
// the grades-numeric migration an exam references grades numerically too (in its
// `grades` tag and its per-grade `correct_score` / `wrong_score` maps).
// `gradeTokens` returns the token(s) a student's grade should match — trimming
// and normalising "09" -> "9" — so a non-canonical stored value still reconciles
// instead of an exact-string compare silently excluding the student (from every
// exam, and from every point — a correct answer scoring 0).

export function gradeTokens(grade: string | null): string[] {
  if (!grade) return [];
  const raw = grade.trim();
  if (!raw) return [];
  const tokens = new Set<string>([raw]);
  const n = parseInt(raw, 10);
  if (!Number.isNaN(n)) tokens.add(String(n)); // normalise "09" -> "9"
  return [...tokens];
}
