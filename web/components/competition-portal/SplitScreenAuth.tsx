// Split-screen layout for per-competition auth pages.
// Left: branded gradient panel. Right: form content.
// Mobile collapses to single column (form only, brand becomes a slim header).

import type { ReactNode } from 'react';
import type { CompetitionPortalConfig } from '@/lib/competitions/emc';
import { BrandPanel } from './BrandPanel';

interface Props {
  config: CompetitionPortalConfig;
  children: ReactNode;
}

export function SplitScreenAuth({ config, children }: Props) {
  return (
    <div className="auth-split" style={{ ['--portal-accent' as string]: config.accent }}>
      <BrandPanel config={config} />
      <div className="form-panel">
        <div className="form-panel-inner">
          {children}
        </div>
      </div>
    </div>
  );
}
