'use client';

// The Competzy-branded right panel shared by every public auth surface
// (the unified login at `/`, the per-competition register page, the
// forgot/reset password pages via HubAuthShell). Renders only the platform
// brand — no per-competition wordmark, gradient, or tagline. Competition
// context (the `?comp=` query / `/competitions/[slug]/...` URL) is preserved
// elsewhere purely for post-auth redirect routing.

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const COMPETZY = {
  shortName: 'CZ',
  wordmark: 'Competzy Portal',
  tagline:
    "Indonesia's unified stage for student competitions — admins, organizers, schools, and students, in one place.",
  gradient: ['#5627ff', '#3f18cc'] as const,
};

// Motivational one-liners that cycle on the panel. Each is split into a
// neutral `lead` and an amber `accent` tail — the accent is the punchy ending.
const TAGLINES: { lead: string; accent: string }[] = [
  { lead: 'Every champion was once a', accent: 'beginner.' },
  { lead: 'One platform for every', accent: 'competition.' },
  { lead: "Where Indonesia's brightest", accent: 'minds compete.' },
  { lead: 'Register once. Compete', accent: 'everywhere.' },
  { lead: 'Your next achievement starts', accent: 'right here.' },
];

// Fixed slot count so word spans never mount/unmount between phrases — that
// keeps the CSS transition (not a remount) responsible for every change.
const WORD_SLOTS = Math.max(
  ...TAGLINES.map((t) => t.lead.split(' ').length + t.accent.split(' ').length),
);

export function CompetzyBrandPanel() {
  const [from, to] = COMPETZY.gradient;

  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    // Animate the very first phrase in too.
    const intro = window.setTimeout(() => setShown(true), 90);

    // Two-phase cycle: fade the current phrase out, then (once it's hidden)
    // swap the text and fade the next one in.
    const cycle = window.setInterval(() => {
      setShown(false);
      window.setTimeout(() => {
        setIndex((i) => (i + 1) % TAGLINES.length);
        setShown(true);
      }, 650);
    }, 4600);

    return () => {
      window.clearTimeout(intro);
      window.clearInterval(cycle);
    };
  }, []);

  const current = TAGLINES[index];
  const raw = [
    ...current.lead.split(' ').map((w) => ({ w, accent: false })),
    ...current.accent.split(' ').map((w) => ({ w, accent: true })),
  ];
  const words = Array.from({ length: WORD_SLOTS }, (_, i) => raw[i] ?? { w: '', accent: false });

  return (
    <div
      className="relative hidden flex-col justify-between overflow-hidden p-12 text-white lg:flex"
      style={{ background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }}
    >
      {/* grid texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:36px_36px]"
      />
      {/* soft glows */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-white/15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-20 size-96 rounded-full bg-amber-300/10 blur-3xl"
      />

      {/* logo */}
      <div className="relative flex items-center gap-3.5">
        <div className="flex size-12 items-center justify-center rounded-xl border border-white/30 bg-white/15 font-mono text-sm font-semibold tracking-wide backdrop-blur">
          {COMPETZY.shortName}
        </div>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-80">Competzy</span>
      </div>

      {/* rotating hero */}
      <div className="relative">
        <h2 className="min-h-[13rem] font-serif text-5xl leading-[1.06] tracking-[-0.01em] xl:text-6xl">
          {words.map((item, wi) => (
            <span
              key={wi}
              className={cn(
                'mr-[0.26em] inline-block transition-all ease-out will-change-transform',
                item.accent && 'text-amber-300',
                shown
                  ? 'translate-y-0 scale-100 opacity-100 blur-0'
                  : 'translate-y-5 scale-[0.96] opacity-0 blur-[4px]',
              )}
              style={{
                transitionDuration: '600ms',
                transitionDelay: shown ? `${wi * 65}ms` : '0ms',
              }}
            >
              {item.w}
            </span>
          ))}
        </h2>
      </div>

      {/* footer */}
      <div className="relative max-w-sm">
        <p className="font-medium opacity-95">{COMPETZY.wordmark}</p>
        <p className="mt-1 text-sm italic opacity-75">&ldquo;{COMPETZY.tagline}&rdquo;</p>
        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.12em] opacity-60">
          © 2026 Competzy
        </p>
      </div>
    </div>
  );
}
