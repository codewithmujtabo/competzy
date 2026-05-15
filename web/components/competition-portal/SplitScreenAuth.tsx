// Split-screen layout for per-competition auth pages.
// Left: the competition's branded gradient panel. Right: the form.
// Below lg the brand panel is hidden and the form takes the full width.

import type { ReactNode } from 'react';
import type { CompetitionPortalConfig } from '@/lib/competitions/registry';
import { BrandPanel } from './BrandPanel';

interface Props {
  config: CompetitionPortalConfig;
  children: ReactNode;
}

export function SplitScreenAuth({ config, children }: Props) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <BrandPanel config={config} />
      <div className="flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
