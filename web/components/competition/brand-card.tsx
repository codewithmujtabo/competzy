'use client';

// The shared branded competition card shell — the EXACT visual language of the
// student catalog's cards (gradient band + dot texture + sheen + glow + logo
// chip + faded watermarks + brand wash body), reusable with any body/footer.
// Used by the admin management grid and the account "My Competitions" page so
// a competition looks identical wherever it appears.

/* eslint-disable @next/next/no-img-element -- decorative, self-hosted logos */

import { Trophy } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { hexA, type CardBrand } from '@/lib/competitions/branding';

interface CompetitionBrandCardProps {
  brand: CardBrand;
  /** Bottom-left chips on the gradient band (category, level, …). */
  bandChips?: React.ReactNode;
  /** Top-right control on the band (heart, kind badge, …). */
  bandAction?: React.ReactNode;
  /** Lifts on hover — set when the card (or its primary action) navigates. */
  interactive?: boolean;
  dimmed?: boolean;
  className?: string;
  /** Card body (title, meta, badges). Rendered over the brand wash. */
  children: React.ReactNode;
  /** Pinned to the card's bottom edge. */
  footer?: React.ReactNode;
}

export function CompetitionBrandCard({
  brand,
  bandChips,
  bandAction,
  interactive = false,
  dimmed = false,
  className,
  children,
  footer,
}: CompetitionBrandCardProps) {
  const bandFg = brand.ink === 'dark' ? '#181219' : '#ffffff';
  return (
    <Card
      className={cn(
        'flex h-full flex-col gap-0 overflow-hidden border-0 bg-card p-0 shadow-sm ring-1 ring-black/5 transition-all duration-300 dark:ring-white/10',
        interactive && 'hover:-translate-y-1 hover:shadow-xl',
        dimmed && 'opacity-70',
        className,
      )}
    >
      {/* Brand banner — gradient + dot texture + sheen + glow + faded logo
          watermark, so each competition reads like its own portal hero. */}
      <div
        className="relative h-28 shrink-0 overflow-hidden"
        style={{ backgroundImage: `linear-gradient(135deg, ${brand.from}, ${brand.to})`, color: bandFg }}
      >
        <span
          aria-hidden
          className="absolute inset-0 opacity-[0.18]"
          style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1.4px)', backgroundSize: '15px 15px' }}
        />
        <span
          aria-hidden
          className="absolute inset-0"
          style={{ backgroundImage: 'linear-gradient(120deg, rgba(255,255,255,0.18), transparent 45%)' }}
        />
        <span aria-hidden className="absolute -right-12 -top-14 size-44 rounded-full blur-2xl" style={{ backgroundColor: brand.glow, opacity: 0.45 }} />
        <span aria-hidden className="absolute -bottom-16 -left-12 size-40 rounded-full bg-white/15 blur-2xl" />
        {brand.logoSrc && (
          <img
            src={brand.logoSrc}
            alt=""
            aria-hidden
            className="pointer-events-none absolute -right-3 top-1/2 size-36 -translate-y-1/2 object-contain opacity-20"
          />
        )}

        {/* Foreground: logo chip + optional action */}
        <div className="relative flex items-start justify-between p-4">
          <span
            className={cn(
              'flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl shadow-lg ring-1 ring-black/5',
              brand.logoSrc ? 'bg-white p-2' : 'bg-white/20 ring-white/30 backdrop-blur-sm',
            )}
          >
            {brand.logoSrc ? (
              <img src={brand.logoSrc} alt="" className="size-full object-contain" />
            ) : (
              <Trophy className="size-6" />
            )}
          </span>
          {bandAction}
        </div>

        {bandChips && (
          <div className="absolute bottom-3 left-4 flex flex-wrap items-center gap-1.5">{bandChips}</div>
        )}
      </div>

      {/* Body — soft brand wash + faded logo watermark; flex-1 keeps card
          heights equal in a grid with the footer pinned to the bottom. */}
      <div className="relative flex flex-1 flex-col overflow-hidden p-5">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ background: `linear-gradient(180deg, ${hexA(brand.from, 0.1)}, ${hexA(brand.to, 0.03)} 60%, transparent)` }}
        />
        {brand.logoSrc && (
          <img
            src={brand.logoSrc}
            alt=""
            aria-hidden
            className="pointer-events-none absolute -bottom-5 -right-5 size-28 object-contain opacity-[0.07]"
          />
        )}

        <div className="relative flex-1">{children}</div>
        {footer && <div className="relative mt-auto pt-4">{footer}</div>}
      </div>
    </Card>
  );
}

/** The catalog's translucent white chip used on the gradient band. */
export function BandChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-white/30 backdrop-blur-sm">
      {children}
    </span>
  );
}
