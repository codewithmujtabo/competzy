// Komodo creature classifier.
//
// Komodo groups students by **age** at a per-round cutoff date, not by grade.
// Five brackets, ordered youngest → oldest. The brackets are the boundary
// definitions from https://competzy.com/komodo. The frontend mirrors this
// registry in `web/lib/competitions/komodo-creatures.ts` so cards can render
// without an extra fetch, but the SERVER is the source of truth — never trust
// a creature value sent from the client.
//
// Bracket semantics:
//   - inclusive lower, exclusive upper. e.g. salamander = (8, 10] means
//     "older than 8 AND 10 or younger", i.e. the student turned 9 or 10
//     by the cutoff.
//   - "gecko" is 8 and under (the public page calls this "Up to 8 years").
//   - "dragon" is 15..18 inclusive — beyond 18 the student is out of scope.

export type CreatureKey =
  | "gecko"
  | "salamander"
  | "chameleon"
  | "iguana"
  | "dragon";

export interface Creature {
  key: CreatureKey;
  name: string;
  /** Human-readable age range, e.g. "Over 8 to 10 years". */
  ageRange: string;
  /** Absolute URL to the artwork on competzy.com. */
  photoUrl: string;
  /**
   * True when we don't have a confirmed artwork URL yet (Gecko on the public
   * site at the time of writing). The frontend can flag it in the UI; we'll
   * swap the URL once it lands.
   */
  placeholder?: boolean;
}

interface Bracket {
  key: CreatureKey;
  name: string;
  ageRange: string;
  /** Minimum age (exclusive of the previous bracket). */
  minExclusive: number;
  /** Maximum age (inclusive). */
  maxInclusive: number;
  photoUrl: string;
  placeholder?: boolean;
}

// Brackets sorted youngest → oldest. Bounds are half-open above; gecko is
// the catch-all for ages 0..8 (the public page says "Up to 8 years").
const BRACKETS: Bracket[] = [
  {
    key: "gecko",
    name: "Gecko",
    ageRange: "Up to 8 years",
    minExclusive: -1,    // any non-negative age qualifies
    maxInclusive: 8,
    // The public Komodo page doesn't surface a Gecko artwork URL at the time
    // of writing — surface the salamander photo with placeholder:true so the
    // frontend can flag it and we can swap once the real one ships.
    photoUrl: "https://competzy.com/images/Komodo/salamander.webp",
    placeholder: true,
  },
  {
    key: "salamander",
    name: "Salamander",
    ageRange: "Over 8 to 10 years",
    minExclusive: 8,
    maxInclusive: 10,
    photoUrl: "https://competzy.com/images/Komodo/salamander.webp",
  },
  {
    key: "chameleon",
    name: "Chameleon",
    ageRange: "Over 10 to 12 years",
    minExclusive: 10,
    maxInclusive: 12,
    photoUrl: "https://competzy.com/images/Komodo/chameleon.webp",
  },
  {
    key: "iguana",
    name: "Iguana",
    ageRange: "Over 12 to 15 years",
    minExclusive: 12,
    maxInclusive: 15,
    photoUrl: "https://competzy.com/images/Komodo/iguana.webp",
  },
  {
    key: "dragon",
    name: "Dragon",
    ageRange: "Over 15 to 18 years",
    minExclusive: 15,
    maxInclusive: 18,
    photoUrl: "https://competzy.com/images/Komodo/dragon.webp",
  },
];

/**
 * The age the student will be on `cutoff`, measured in completed years
 * (i.e. the conventional "I am X years old" reading). Returns null when
 * either input is missing or malformed.
 */
export function ageOn(dob: Date | string | null, cutoff: Date | string | null): number | null {
  if (!dob || !cutoff) return null;
  const d = dob instanceof Date ? dob : new Date(dob);
  const c = cutoff instanceof Date ? cutoff : new Date(cutoff);
  if (Number.isNaN(d.getTime()) || Number.isNaN(c.getTime())) return null;
  let age = c.getFullYear() - d.getFullYear();
  const monthDiff = c.getMonth() - d.getMonth();
  const dayDiff = c.getDate() - d.getDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age -= 1;
  return age;
}

/**
 * Classify a student into a creature based on DOB + cutoff date. Returns null
 * when either is missing, when the computed age is negative, or when the age
 * exceeds the Dragon ceiling (the student is out of bracket).
 */
export function classifyCreature(
  dob: Date | string | null,
  cutoff: Date | string | null,
): (Creature & { ageAtCutoff: number }) | null {
  const age = ageOn(dob, cutoff);
  if (age === null || age < 0) return null;
  for (const b of BRACKETS) {
    if (age > b.minExclusive && age <= b.maxInclusive) {
      return {
        key: b.key,
        name: b.name,
        ageRange: b.ageRange,
        photoUrl: b.photoUrl,
        ...(b.placeholder ? { placeholder: true } : {}),
        ageAtCutoff: age,
      };
    }
  }
  return null;
}

/** The full set of brackets, in age order — handy for legend/admin UI. */
export const CREATURES: readonly Creature[] = BRACKETS.map((b) => ({
  key: b.key,
  name: b.name,
  ageRange: b.ageRange,
  photoUrl: b.photoUrl,
  ...(b.placeholder ? { placeholder: true } : {}),
}));
