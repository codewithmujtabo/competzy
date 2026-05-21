'use client';

// Split-screen shell for the platform auth pages (forgot-password,
// reset-password). Form on the left, brand panel on the right, with the
// light/dark toggle. Mirrors the `/` unified login and the per-competition
// register page so all auth surfaces share one orientation.
//
// When a competition slug is in scope (passed via `?comp=` on the URL), the
// brand panel renders that competition's gradient + shortName + wordmark.
// Otherwise it falls back to the default violet Competzy brand.

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme/context';
import type { CompetitionPortalConfig } from '@/lib/competitions/registry';

interface HubAuthShellProps {
  headlineTop: string;
  headlineBottom: string;
  caption: string;
  quote: string;
  brand?: CompetitionPortalConfig | null;
  children: React.ReactNode;
}

const COMPETZY_DEFAULT = {
  shortName: 'CZ',
  gradient: ['#5627ff', '#3f18cc'] as const,
};

export function HubAuthShell({ headlineTop, headlineBottom, caption, quote, brand, children }: HubAuthShellProps) {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  const shortName = brand?.shortName ?? COMPETZY_DEFAULT.shortName;
  const [from, to] = brand?.gradient ?? COMPETZY_DEFAULT.gradient;

  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      {/* Theme toggle — pinned to the top-right of the whole screen */}
      <button
        onClick={toggle}
        aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        className="absolute right-5 top-5 z-20 flex size-9 items-center justify-center rounded-lg border bg-card text-muted-foreground transition-colors hover:text-foreground"
      >
        {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
      </button>

      {/* Form panel — LEFT */}
      <div className="relative flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-md">{children}</div>
      </div>

      {/* Brand panel — RIGHT */}
      <div
        className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex"
        style={{ background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:36px_36px]"
        />
        <div className="relative flex items-center gap-3.5">
          <div className="flex size-12 items-center justify-center rounded-xl border border-white/30 bg-white/15 font-mono text-sm font-semibold tracking-wide backdrop-blur">
            {shortName}
          </div>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-80">Competzy</span>
        </div>
        <h2 className="relative font-serif text-6xl leading-[0.96]">
          {headlineTop}
          <br />
          <span className="text-amber-300">{headlineBottom}</span>
        </h2>
        <div className="relative max-w-sm">
          <p className="font-medium opacity-95">{caption}</p>
          <p className="mt-1 text-sm italic opacity-75">&ldquo;{quote}&rdquo;</p>
          <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.12em] opacity-60">
            © 2026 Competzy
          </p>
        </div>
      </div>
    </div>
  );
}
