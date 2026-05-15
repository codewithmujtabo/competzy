'use client';

// Split-screen shell for the platform auth pages (forgot-password,
// reset-password). Teal Competzy brand panel on the left, form on the right,
// with the light/dark toggle. The `/` unified login uses the same visual
// language inline (it has more moving parts).

import { Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme/context';

interface HubAuthShellProps {
  headlineTop: string;
  headlineBottom: string;
  caption: string;
  quote: string;
  children: React.ReactNode;
}

export function HubAuthShell({ headlineTop, headlineBottom, caption, quote, children }: HubAuthShellProps) {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div
        className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex"
        style={{ background: 'linear-gradient(135deg,#0d7377 0%,#14a085 60%,#1b7a6a 100%)' }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:36px_36px]"
        />
        <div className="relative flex items-center gap-3.5">
          <div className="flex size-12 items-center justify-center rounded-xl border border-white/30 bg-white/15 font-mono text-sm font-semibold backdrop-blur">
            CZ
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

      <div className="relative flex items-center justify-center bg-background px-6 py-12">
        <button
          onClick={toggle}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="absolute right-5 top-5 flex size-9 items-center justify-center rounded-lg border bg-card text-muted-foreground transition-colors hover:text-foreground"
        >
          {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </button>
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
