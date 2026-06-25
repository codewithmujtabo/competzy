'use client';

import { LocaleToggle } from './locale-toggle';
import { ThemeToggle } from './theme-toggle';
import { cn } from '@/lib/utils';

// Language (EN | ID) + light/dark toggles for public / auth pages that render
// OUTSIDE the AppShell (sign-in, register, forgot/reset, verify, privacy,
// terms). Fixed to the top-right of the viewport so it stays put on both the
// full-screen split layouts and the scrolling legal pages. Both providers are
// root-mounted (app/layout.tsx), so this works on any page.
export function PublicToggles({ className }: { className?: string }) {
  return (
    <div className={cn('fixed right-5 top-5 z-50 flex items-center gap-2', className)}>
      <LocaleToggle className="rounded-lg border bg-card px-2 py-1.5" />
      <ThemeToggle />
    </div>
  );
}
