// Left panel of the split-screen auth — gradient + competition wordmark +
// tagline. Parametrised by competition config so ISPO/OSEBI/etc. can reuse it.

import type { CompetitionPortalConfig } from '@/lib/competitions/registry';

export function BrandPanel({ config }: { config: CompetitionPortalConfig }) {
  const [from, to] = config.gradient;
  return (
    <div
      className="brand-panel"
      style={{
        background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
      }}
    >
      <div className="brand-panel-grid" aria-hidden />
      <div className="brand-panel-inner">
        <div className="brand-panel-mark">
          <div className="brand-panel-mark-disc">{config.shortName}</div>
          <div className="brand-panel-mark-label">Competzy</div>
        </div>

        <div className="brand-panel-headline">
          <div className="brand-panel-headline-1">Compete.</div>
          <div className="brand-panel-headline-2">Excel.</div>
        </div>

        <div className="brand-panel-tagline">
          <div className="brand-panel-fullname">{config.wordmark}</div>
          <div className="brand-panel-quote">&ldquo;{config.tagline}&rdquo;</div>
        </div>

        <div className="brand-panel-footer">
          &copy; 2026 Competzy
        </div>
      </div>
    </div>
  );
}
