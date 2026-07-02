// Person-name normalization.
//
// Rule: a name typed ENTIRELY in caps ("BRUNO CARLES DELGADILLO ALVAREZ") or
// entirely in lowercase is normalized to Capitalized Case ("Bruno Carles
// Delgadillo Alvarez"). Mixed-case input is preserved exactly as typed, so
// intentional casing ("McDonald", "van der Berg") is never mangled.
// Capitalization restarts after spaces, hyphens, and apostrophes
// ("SITI NUR-AINI O'BRIEN" → "Siti Nur-Aini O'Brien").

export function normalizeFullName(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const name = raw.trim().replace(/\s+/g, " ");
  if (!name) return "";

  const hasLetters = /[a-zA-Z]/.test(name);
  const isAllCaps = hasLetters && name === name.toUpperCase();
  const isAllLower = hasLetters && name === name.toLowerCase();
  if (!isAllCaps && !isAllLower) return name;

  return name
    .toLowerCase()
    .replace(/(^|[\s\-'])([a-z])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}
