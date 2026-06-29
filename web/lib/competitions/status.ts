import type { MessageKey } from '@/lib/i18n/messages/en';

// The canonical competition registration-status values, stored verbatim in
// `competitions.registration_status`. Admin + organizer edit forms offer
// exactly these three; the student catalog renders them as localized badges.
export const COMPETITION_STATUSES = [
  'Coming Soon',
  'Registration Opened',
  'Registration Closed',
] as const;

export type CompetitionStatus = (typeof COMPETITION_STATUSES)[number];

const STATUS_KEY: Record<string, MessageKey> = {
  'Coming Soon': 'compStatus.comingSoon',
  'Registration Opened': 'compStatus.registrationOpened',
  'Registration Closed': 'compStatus.registrationClosed',
};

// Localized label for a stored status. Unknown / legacy values fall back to the
// raw string so nothing ever renders blank.
export function compStatusLabel(
  value: string | null | undefined,
  t: (key: MessageKey) => string,
): string {
  if (!value) return '';
  const key = STATUS_KEY[value];
  return key ? t(key) : value;
}

// Badge colour tokens per status (shared by the catalog + operator lists).
export function compStatusTone(value: string | null | undefined): string {
  switch (value) {
    case 'Registration Opened':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200';
    case 'Registration Closed':
      return 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200';
    case 'Coming Soon':
    default:
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200';
  }
}
