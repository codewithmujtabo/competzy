'use client';

// The Competzy-branded right panel shared by every public auth surface.
//
// Two variants:
//  - GenericPanel   — platform-only brand with rotating taglines. Used by the
//                     login `/` + forgot/reset surfaces (the default).
//  - ShowcasePanel  — the "every competition, one arena" cloud. Used by the
//                     per-competition register page (pass `showcase`). It makes
//                     it obvious arena.competzy.com is the same platform the
//                     student came from on competzy.com: every hosted
//                     competition's real logo + name sits in a tidy column on
//                     the right of the panel, with the headline + continuity
//                     copy anchored left-of-centre over a scrim. The SAME design
//                     renders for every competition — it's a platform statement.

/* eslint-disable @next/next/no-img-element -- decorative, self-hosted logos */

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

const GRADIENT = ['#5627ff', '#3f18cc'] as const;

export function CompetzyBrandPanel({ showcase }: { showcase?: boolean } = {}) {
  return showcase ? <ShowcasePanel /> : <GenericPanel />;
}

// ── "Every competition" showcase variant ──────────────────────────────────

// The competitions whose logos are self-hosted in /public/competitions.
// Logos are mirrored from the competzy.com marketing site so arena and the
// landing page stay visually consistent. Add a competition by dropping its
// `<slug>.webp` into /public/competitions and appending a row here.
const SHOWCASE: { slug: string; name: string }[] = [
  { slug: 'komodo', name: 'Komodo' },
  { slug: 'emc', name: 'EMC' },
  { slug: 'ispo', name: 'ISPO' },
  { slug: 'owlypia', name: 'Owlypia' },
  { slug: 'genius', name: 'Genius Olympiad' },
  { slug: 'igo', name: 'IGO' },
  { slug: 'nextgen', name: 'NextGen Olympiad' },
];

// Deterministic seeded PRNG so the cloud layout is identical between SSR +
// client (no hydration mismatch). Only timing varies per chip — positions stay
// on a tidy grid so the labels read as a neat column, not a scatter.
function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Chip {
  slug: string;
  name: string;
  top: number;
  left: number;
  dur: number;
  delay: number;
}

// A clean 3-column × 7-row grid. No rotation, no position jitter — the labels
// line up tidily. Only the float timing differs per chip so the column has a
// little life without looking messy. The left-to-right scrim later fades the
// two left columns behind the copy, leaving a neat right-hand stack visible.
function makeChips(): Chip[] {
  const rng = mulberry32(0x5c0e);
  const COLS = 3;
  const ROWS = 7;
  const COUNT = 21;
  return Array.from({ length: COUNT }, (_, i) => {
    const comp = SHOWCASE[i % SHOWCASE.length];
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    return {
      slug: comp.slug,
      name: comp.name,
      left: Math.round(((col + 0.5) / COLS) * 1000) / 10,
      top: Math.round(((row + 0.5) / ROWS) * 1000) / 10,
      dur: +(7 + rng() * 5).toFixed(2),
      delay: +(rng() * 6).toFixed(2),
    };
  });
}

function ShowcasePanel() {
  const [from, to] = GRADIENT;
  const chips = useMemo(makeChips, []);

  return (
    <div
      className="relative hidden flex-col justify-center overflow-hidden p-12 text-white lg:flex"
      style={{ background: `linear-gradient(150deg, ${from} 0%, ${to} 100%)` }}
    >
      {/* drift keyframe (respects the global prefers-reduced-motion reset) */}
      <style>{`@keyframes cbDrift{0%,100%{transform:translate(-50%,-50%)}50%{transform:translate(-50%,calc(-50% - 10px))}}`}</style>

      {/* grid texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:38px_38px]"
      />

      {/* tidy column of competition logos — real logos + names */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {chips.map((c, i) => (
          <div
            key={i}
            className="absolute flex items-center gap-2.5 rounded-full bg-white/95 py-1.5 pl-1.5 pr-4 shadow-xl shadow-black/25 ring-1 ring-black/5 will-change-transform"
            style={{
              top: `${c.top}%`,
              left: `${c.left}%`,
              transform: 'translate(-50%,-50%)',
              animation: `cbDrift ${c.dur}s ease-in-out ${c.delay}s infinite`,
            }}
          >
            <img
              src={`/competitions/${c.slug}.webp`}
              alt=""
              className="size-10 shrink-0 rounded-full bg-white object-contain p-0.5"
            />
            <span className="whitespace-nowrap text-[15px] font-semibold text-slate-800">{c.name}</span>
          </div>
        ))}
      </div>

      {/* readability scrim — opaque on the left where the copy sits, fading to
          clear on the right so the logo column stays vivid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `linear-gradient(to right, ${to} 0%, ${to}f2 38%, ${to}b3 56%, ${to}40 72%, transparent 88%)`,
        }}
      />

      {/* ambient brand glow drifting behind the copy (landing's ds-ambient-drift) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-1/3 size-[28rem] rounded-full bg-white/10 blur-3xl animate-ambient"
      />

      {/* headline + continuity copy — vertically centred, left-aligned,
          entering with the design system's staggered fade-up */}
      <div className="relative z-10 max-w-md stagger-children">
        <h2 className="font-serif text-5xl font-bold leading-[1.05] tracking-[-0.01em] xl:text-6xl">
          Every competition,
          <br />
          <span className="text-[#f8db46]">one arena.</span>
        </h2>
        <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/80">
          Arena is where the competing happens. One account signs you in to EMC, ISPO, Komodo,
          Owlypia and every competition.
        </p>
      </div>
    </div>
  );
}

// ── Generic platform variant (login / forgot / reset) ─────────────────────

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

function GenericPanel() {
  const [from, to] = GRADIENT;

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
      className="relative hidden flex-col justify-center overflow-hidden p-12 text-white lg:flex"
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
    </div>
  );
}
