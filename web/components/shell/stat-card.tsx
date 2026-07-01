'use client';

import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { AnimatedNumber } from '@/components/motion/animated-number';
import { cn } from '@/lib/utils';

/**
 * Accent palette — the competzy.com design system's categorical accents,
 * and ONLY those (one design language across landing + arena):
 *
 *   indigo #5627ff   pink #d9277b   orange #f08c00   gold #f8db46
 *   green  #31ab00   blue #0066ff   lime   #7cd516
 *
 * Each accent is a curated gradient with a paired ink and a brand-colored
 * glow shadow lifted straight from the landing's shadow tokens.
 */
type CanonicalAccent = 'indigo' | 'pink' | 'orange' | 'gold' | 'green' | 'blue' | 'lime';

export type StatAccent =
  | CanonicalAccent
  // Legacy aliases from previous palettes — mapped to canonical so existing
  // call sites keep compiling and land on the nearest brand accent.
  | 'sky'
  | 'berry'
  | 'sunshine'
  | 'horizon'
  | 'citrus'
  | 'solar'
  | 'mocha'
  | 'cherry'
  | 'butter'
  | 'pistachio'
  | 'aubergine'
  | 'apricot'
  | 'violet'
  | 'mint'
  | 'sunset'
  | 'teal'
  | 'amber'
  | 'rose';

const ALIASES: Record<string, CanonicalAccent> = {
  sky: 'blue',
  berry: 'pink',
  sunshine: 'gold',
  horizon: 'indigo',
  citrus: 'lime',
  solar: 'orange',
  mocha: 'orange',
  cherry: 'pink',
  butter: 'gold',
  pistachio: 'green',
  aubergine: 'indigo',
  apricot: 'orange',
  violet: 'indigo',
  mint: 'green',
  sunset: 'orange',
  teal: 'blue',
  amber: 'gold',
  rose: 'pink',
};

/** Each accent is a self-contained color story on the landing palette. */
const ACCENT: Record<
  CanonicalAccent,
  { bg: string; fg: string; eyebrow: string; iconBg: string; blob: string; ring: string }
> = {
  indigo: {
    bg: 'bg-gradient-to-br from-[#6a3dff] via-[#5627ff] to-[#2a1170]',
    fg: 'text-white',
    eyebrow: 'text-white/75',
    iconBg: 'bg-white/15 text-white ring-1 ring-white/25',
    blob: 'bg-[#937aff]',
    ring: 'shadow-[0_22px_50px_-22px_rgba(86,39,255,0.55)]',
  },
  pink: {
    bg: 'bg-gradient-to-br from-[#e85aa0] via-[#d9277b] to-[#b01561]',
    fg: 'text-white',
    eyebrow: 'text-white/78',
    iconBg: 'bg-white/16 text-white ring-1 ring-white/26',
    blob: 'bg-[#f8db46]',
    ring: 'shadow-[0_22px_50px_-22px_rgba(217,39,123,0.55)]',
  },
  orange: {
    bg: 'bg-gradient-to-br from-[#ffb84d] via-[#f08c00] to-[#d97a00]',
    fg: 'text-[#2d1c05]',
    eyebrow: 'text-[#2d1c05]/70',
    iconBg: 'bg-[#2d1c05]/12 text-[#2d1c05] ring-1 ring-[#2d1c05]/15',
    blob: 'bg-[#f8db46]',
    ring: 'shadow-[0_22px_50px_-22px_rgba(240,140,0,0.6)]',
  },
  gold: {
    bg: 'bg-gradient-to-br from-[#fbe57a] via-[#f8db46] to-[#eec522]',
    fg: 'text-[#2d240a]',
    eyebrow: 'text-[#2d240a]/70',
    iconBg: 'bg-[#2d240a]/12 text-[#2d240a] ring-1 ring-[#2d240a]/15',
    blob: 'bg-[#d9277b]',
    ring: 'shadow-[0_22px_50px_-22px_rgba(248,219,70,0.7)]',
  },
  green: {
    bg: 'bg-gradient-to-br from-[#54c91f] via-[#31ab00] to-[#237a02]',
    fg: 'text-white',
    eyebrow: 'text-white/78',
    iconBg: 'bg-white/16 text-white ring-1 ring-white/26',
    blob: 'bg-[#f8db46]',
    ring: 'shadow-[0_22px_50px_-22px_rgba(49,171,0,0.55)]',
  },
  blue: {
    bg: 'bg-gradient-to-br from-[#3d8bff] via-[#0066ff] to-[#0047c2]',
    fg: 'text-white',
    eyebrow: 'text-white/78',
    iconBg: 'bg-white/16 text-white ring-1 ring-white/26',
    blob: 'bg-[#7cd516]',
    ring: 'shadow-[0_22px_50px_-22px_rgba(0,102,255,0.55)]',
  },
  lime: {
    bg: 'bg-gradient-to-br from-[#a5ec4a] via-[#7cd516] to-[#57a30a]',
    fg: 'text-[#15260a]',
    eyebrow: 'text-[#15260a]/70',
    iconBg: 'bg-[#15260a]/12 text-[#15260a] ring-1 ring-[#15260a]/15',
    blob: 'bg-[#5627ff]',
    ring: 'shadow-[0_22px_50px_-22px_rgba(124,213,22,0.6)]',
  },
};

interface StatCardProps {
  label: string;
  /** Pass a NUMBER to get the animated count-up; a formatted string renders as-is. */
  value: React.ReactNode;
  icon: LucideIcon;
  /** Formatter for numeric `value` (receives fractional values mid-flight). */
  format?: (n: number) => string;
  /** Small muted line under the value. */
  hint?: string;
  accent?: StatAccent;
  className?: string;
}

/**
 * Vibrant KPI card on the landing's categorical accents. Numeric values
 * count up with the expo-out curve; the card lifts with a brand glow on
 * hover and the icon tile springs.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  format,
  hint,
  accent = 'indigo',
  className,
}: StatCardProps) {
  const resolved: CanonicalAccent = ALIASES[accent] ?? (accent as CanonicalAccent);
  const a = ACCENT[resolved];
  return (
    <Card
      className={cn(
        'group relative gap-0 overflow-hidden border-0 p-6',
        'transition-[transform,box-shadow] duration-base ease-out-expo hover:-translate-y-1',
        a.bg,
        a.fg,
        a.ring,
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute -right-12 -top-12 size-40 rounded-full opacity-25 blur-2xl transition-transform duration-slower ease-smooth group-hover:scale-110',
          a.blob,
        )}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute -bottom-16 -left-10 size-32 rounded-full bg-white/12 blur-2xl"
      />

      <div className="relative flex items-start justify-between gap-3">
        <p className={cn('font-mono text-[11px] font-semibold uppercase tracking-[0.16em]', a.eyebrow)}>
          {label}
        </p>
        <span
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-2xl backdrop-blur-sm transition-transform duration-base ease-spring group-hover:rotate-6 group-hover:scale-110',
            a.iconBg,
          )}
        >
          <Icon className="size-[1.25rem]" strokeWidth={2.25} />
        </span>
      </div>
      <p className={cn('relative mt-5 font-serif text-4xl font-bold tracking-tight', a.fg)}>
        {typeof value === 'number' ? <AnimatedNumber value={value} format={format} /> : value}
      </p>
      {hint && <p className={cn('relative mt-1.5 text-xs font-medium', a.eyebrow)}>{hint}</p>}
    </Card>
  );
}
