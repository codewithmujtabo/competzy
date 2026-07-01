import type { Metadata } from 'next';
import { Wrench } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Maintenance · Competzy',
  description: 'Competzy is briefly offline for scheduled maintenance.',
  // Keep search engines from indexing this transient page.
  robots: { index: false, follow: false },
};

/**
 * Takeover page served by middleware.ts when arena.competzy.com is in
 * maintenance mode='on' (or the global '*' kill switch is non-off) AND
 * the visitor doesn't have a valid admin bypass cookie.
 *
 * Plain Server Component — no auth context, no client state. Reachable
 * directly via /maintenance for testing.
 */
export default function MaintenancePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-white via-white to-[#f5f0ff] px-6 py-12">
      <div className="mx-auto w-full max-w-xl text-center">
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[#5627ff] via-[#7849ff] to-[#937aff] text-white shadow-[0_18px_42px_-18px_rgba(86,39,255,0.65)]">
          <Wrench className="size-7" aria-hidden />
        </div>

        <h1 className="font-serif text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Sebentar, kami sedang berbenah
        </h1>

        <p className="mx-auto mt-3 max-w-md text-balance text-sm leading-relaxed text-muted-foreground sm:text-base">
          Competzy is briefly offline for scheduled maintenance. We&apos;re back as soon as the
          work wraps up. Try again in a few minutes.
        </p>

        <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
          Status, maintenance window
        </div>

        <p className="mt-10 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
          competzy team
        </p>
      </div>
    </main>
  );
}
