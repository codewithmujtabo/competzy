'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme/context';
import { useT } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';

// Reusable light/dark icon button. Mirrors the bordered card-style button on
// the sign-in page; used by <PublicToggles> on every shell-less public page.
// (AppShell has its own ghost-style theme button in its top bar.)
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const t = useT();
  const isDark = theme === 'dark';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? t('common.lightMode') : t('common.darkMode')}
      title={isDark ? t('common.lightMode') : t('common.darkMode')}
      className={cn(
        'flex size-9 items-center justify-center rounded-lg border bg-card text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
        className,
      )}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
