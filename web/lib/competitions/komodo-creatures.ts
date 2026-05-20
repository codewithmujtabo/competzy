// Komodo creature registry — the frontend mirror of
// `backend/src/services/komodo-creature.service.ts`. The server is the source
// of truth for classification (don't trust a creature value sent from the
// client); this file exists so cards can render without an extra fetch
// when the API has already returned the creature key.

export type CreatureKey =
  | 'gecko'
  | 'salamander'
  | 'chameleon'
  | 'iguana'
  | 'dragon';

export interface CreatureInfo {
  key: CreatureKey;
  name: string;
  ageRange: string;
  photoUrl: string;
  placeholder?: boolean;
  /** A short, fun tagline shown under the creature name on the card. */
  tagline: string;
}

export const CREATURES: Record<CreatureKey, CreatureInfo> = {
  gecko: {
    key: 'gecko',
    name: 'Gecko',
    ageRange: 'Up to 8 years',
    photoUrl: 'https://competzy.com/images/Komodo/salamander.webp',
    placeholder: true,
    tagline: 'Tiny but mighty — the youngest Komodo bracket.',
  },
  salamander: {
    key: 'salamander',
    name: 'Salamander',
    ageRange: 'Over 8 to 10 years',
    photoUrl: 'https://competzy.com/images/Komodo/salamander.webp',
    tagline: 'Sharp and curious — the Komodo apprentice.',
  },
  chameleon: {
    key: 'chameleon',
    name: 'Chameleon',
    ageRange: 'Over 10 to 12 years',
    photoUrl: 'https://competzy.com/images/Komodo/chameleon.webp',
    tagline: 'Adaptable and clever — change colours under pressure.',
  },
  iguana: {
    key: 'iguana',
    name: 'Iguana',
    ageRange: 'Over 12 to 15 years',
    photoUrl: 'https://competzy.com/images/Komodo/iguana.webp',
    tagline: 'Strategic and steady — the Komodo veteran tier.',
  },
  dragon: {
    key: 'dragon',
    name: 'Dragon',
    ageRange: 'Over 15 to 18 years',
    photoUrl: 'https://competzy.com/images/Komodo/dragon.webp',
    tagline: 'Apex predator — the Komodo elite.',
  },
};

export function creatureInfo(key: CreatureKey | string | null | undefined): CreatureInfo | null {
  if (!key) return null;
  return (CREATURES as Record<string, CreatureInfo>)[String(key)] ?? null;
}
