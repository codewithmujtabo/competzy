// Split-screen layout for per-competition auth pages.
// Left: the form. Right: the competition's branded gradient panel.
// Below lg the brand panel is hidden and the form takes the full width.
// Mirrors the unified login page layout (web/app/page.tsx).

import type { ReactNode } from 'react';
import type { CompetitionPortalConfig } from '@/lib/competitions/registry';
import { BrandPanel } from './BrandPanel';

interface Props {
  config: CompetitionPortalConfig;
  children: ReactNode;
}

export function SplitScreenAuth({ config, children }: Props) {
  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      {/* Form panel — LEFT */}
      <div className="relative flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-md">{children}</div>
      </div>
      {/* Brand panel — RIGHT */}
      <BrandPanel config={config} />
    </div>
  );
}
