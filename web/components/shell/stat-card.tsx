import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Accent palette — built from the user's six brand colors:
 *
 *   #4BC2EC  sky cyan         #F7B643  sunshine gold
 *   #4CBCBE  teal cyan        #BE65A9  berry magenta
 *   #65C8DB  soft cyan        #FEE404  lemon
 *
 * Every gradient below combines only these six. Font ink is chosen per-tile
 * for contrast — cream `#fff4e8` on cyan/magenta surfaces, warm cocoa
 * `#2d1f0a` on yellow surfaces. No pure black, no pure white — warmer reads
 * more premium against this primary-color energy.
 */
type CanonicalAccent = 'sky' | 'berry' | 'sunshine' | 'horizon' | 'citrus' | 'solar';

export type StatAccent =
  | CanonicalAccent
  // Legacy aliases from previous palettes — mapped to canonical.
  | 'mocha'
  | 'cherry'
  | 'butter'
  | 'pistachio'
  | 'aubergine'
  | 'apricot'
  | 'violet'
  | 'pink'
  | 'gold'
  | 'mint'
  | 'sunset'
  | 'teal'
  | 'indigo'
  | 'amber'
  | 'rose'
  | 'green';

const ALIASES: Record<string, CanonicalAccent> = {
  // Earth palette → primary palette
  mocha: 'solar',
  cherry: 'berry',
  butter: 'sunshine',
  pistachio: 'sky',
  aubergine: 'berry',
  apricot: 'solar',
  // Tailwind-ish → primary palette
  violet: 'berry',
  pink: 'berry',
  gold: 'sunshine',
  mint: 'sky',
  sunset: 'solar',
  teal: 'sky',
  indigo: 'horizon',
  amber: 'sunshine',
  rose: 'berry',
  green: 'sky',
};

/** Each accent is a self-contained color story. */
const ACCENT: Record<
  CanonicalAccent,
  { bg: string; fg: string; eyebrow: string; iconBg: string; blob: string; ring: string }
> = {
  // Pure cyan family triangulation — cool, premium, ocean-clear.
  sky: {
    bg: 'bg-gradient-to-br from-[#4BC2EC] via-[#65C8DB] to-[#4CBCBE]',
    fg: 'text-[#062a3d]',
    eyebrow: 'text-[#062a3d]/70',
    iconBg: 'bg-[#062a3d]/12 text-[#062a3d] ring-1 ring-[#062a3d]/15',
    blob: 'bg-[#FEE404]',
    ring: 'shadow-[0_22px_50px_-22px_rgba(75,194,236,0.55)]',
  },
  // Magenta opening up to soft pink-magenta — confident pop.
  berry: {
    bg: 'bg-gradient-to-br from-[#9c4b8a] via-[#BE65A9] to-[#d68bbf]',
    fg: 'text-[#fff4e8]',
    eyebrow: 'text-[#fff4e8]/75',
    iconBg: 'bg-[#fff4e8]/18 text-[#fff4e8] ring-1 ring-[#fff4e8]/28',
    blob: 'bg-[#FEE404]',
    ring: 'shadow-[0_22px_50px_-22px_rgba(190,101,169,0.55)]',
  },
  // Yellow burst — lemon sliding into golden sun.
  sunshine: {
    bg: 'bg-gradient-to-br from-[#FEE404] via-[#F8C824] to-[#F7B643]',
    fg: 'text-[#2d1f0a]',
    eyebrow: 'text-[#2d1f0a]/70',
    iconBg: 'bg-[#2d1f0a]/12 text-[#2d1f0a] ring-1 ring-[#2d1f0a]/15',
    blob: 'bg-[#BE65A9]',
    ring: 'shadow-[0_22px_50px_-22px_rgba(247,182,67,0.7)]',
  },
  // Sky-to-berry diagonal — the Mowalola/pop-art collision.
  horizon: {
    bg: 'bg-gradient-to-br from-[#4BC2EC] via-[#7798c8] to-[#BE65A9]',
    fg: 'text-[#fff4e8]',
    eyebrow: 'text-[#fff4e8]/80',
    iconBg: 'bg-[#fff4e8]/18 text-[#fff4e8] ring-1 ring-[#fff4e8]/28',
    blob: 'bg-[#FEE404]',
    ring: 'shadow-[0_22px_50px_-22px_rgba(75,194,236,0.5)]',
  },
  // Soft cyan into lemon — fresh citrus.
  citrus: {
    bg: 'bg-gradient-to-br from-[#65C8DB] via-[#aedb9f] to-[#FEE404]',
    fg: 'text-[#0a2a18]',
    eyebrow: 'text-[#0a2a18]/70',
    iconBg: 'bg-[#0a2a18]/12 text-[#0a2a18] ring-1 ring-[#0a2a18]/15',
    blob: 'bg-[#BE65A9]',
    ring: 'shadow-[0_22px_50px_-22px_rgba(101,200,219,0.55)]',
  },
  // Sunshine gold deepening into berry — sunset over a bougainvillea wall.
  solar: {
    bg: 'bg-gradient-to-br from-[#F7B643] via-[#e58572] to-[#BE65A9]',
    fg: 'text-[#fff4e8]',
    eyebrow: 'text-[#fff4e8]/82',
    iconBg: 'bg-[#fff4e8]/18 text-[#fff4e8] ring-1 ring-[#fff4e8]/28',
    blob: 'bg-[#FEE404]',
    ring: 'shadow-[0_22px_50px_-22px_rgba(247,182,67,0.6)]',
  },
};

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  /** Small muted line under the value. */
  hint?: string;
  accent?: StatAccent;
  className?: string;
}

/**
 * Vibrant KPI card built from the brand's six primary colors. Each accent
 * is a curated gradient with paired ink color. Card lifts on hover and
 * the icon tile spins slightly.
 */
export function StatCard({ label, value, icon: Icon, hint, accent = 'sky', className }: StatCardProps) {
  const resolved: CanonicalAccent = ALIASES[accent] ?? (accent as CanonicalAccent);
  const a = ACCENT[resolved];
  return (
    <Card
      className={cn(
        'group relative gap-0 overflow-hidden border-0 p-6 transition-all duration-300',
        'hover:-translate-y-1',
        a.bg,
        a.fg,
        a.ring,
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute -right-12 -top-12 size-40 rounded-full opacity-25 blur-2xl transition-transform duration-500 group-hover:scale-110',
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
            'flex size-11 shrink-0 items-center justify-center rounded-2xl backdrop-blur-sm transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110',
            a.iconBg,
          )}
        >
          <Icon className="size-[1.25rem]" strokeWidth={2.25} />
        </span>
      </div>
      <p className={cn('relative mt-5 font-serif text-4xl font-semibold tracking-tight', a.fg)}>{value}</p>
      {hint && <p className={cn('relative mt-1.5 text-xs font-medium', a.eyebrow)}>{hint}</p>}
    </Card>
  );
}
