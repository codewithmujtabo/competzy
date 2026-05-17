// Left panel of the split-screen competition auth — the competition's own
// gradient + wordmark + tagline. Parametrised by the portal config so every
// competition (EMC / ISPO / OSEBI / …) reuses it with its own brand.

import type { CompetitionPortalConfig } from '@/lib/competitions/registry';

export function BrandPanel({ config }: { config: CompetitionPortalConfig }) {
  const [from, to] = config.gradient;
  return (
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
          {config.shortName}
        </div>
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-80">Competzy</span>
      </div>

      <h2 className="relative font-serif text-6xl leading-[0.96]">
        Compete.
        <br />
        <span className="text-amber-300">Excel.</span>
      </h2>

      <div className="relative max-w-sm">
        <p className="font-medium opacity-95">{config.wordmark}</p>
        <p className="mt-1 text-sm italic opacity-75">&ldquo;{config.tagline}&rdquo;</p>
        <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.12em] opacity-60">
          © 2026 Competzy
        </p>
      </div>
    </div>
  );
}
