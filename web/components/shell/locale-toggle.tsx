'use client';

import { useLocale, type Locale } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';

// Compact EN | ID segmented switch. Mirrors the reference chip — the active
// language reads in the accent colour, the other is muted. Used in the
// AppShell top bar and on the public login header.
export function LocaleToggle({ className }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  const item = (l: Locale, label: string) => (
    <button
      type="button"
      onClick={() => setLocale(l)}
      aria-pressed={locale === l}
      aria-label={l === 'id' ? 'Bahasa Indonesia' : 'English'}
      className={cn(
        'rounded-md px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide transition-colors',
        locale === l ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
  return (
    <div
      className={cn('inline-flex items-center gap-0.5 font-mono', className)}
      role="group"
      aria-label="Language"
    >
      {item('en', 'EN')}
      <span aria-hidden className="text-xs text-border">
        |
      </span>
      {item('id', 'ID')}
    </div>
  );
}
