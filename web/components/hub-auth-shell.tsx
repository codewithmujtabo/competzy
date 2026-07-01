'use client';

// Split-screen shell for the platform auth pages (forgot-password,
// reset-password). Form on the left, the SAME "every competition, one arena"
// brand panel as the `/` unified login + the per-competition register page on
// the right — so every auth surface shares one orientation and one set of
// branding.

import { PublicToggles } from './shell/public-toggles';
import { CompetzyBrandPanel } from '@/components/auth/competzy-brand-panel';

export function HubAuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-screen lg:grid-cols-2">
      {/* Form panel — LEFT */}
      <div className="relative flex items-center justify-center px-6 py-12">
        {/* Language + theme toggles — top-right of the form column */}
        <PublicToggles className="absolute" />
        <div className="w-full max-w-md">{children}</div>
      </div>

      {/* Brand panel — RIGHT (same showcase as sign-in + register) */}
      <CompetzyBrandPanel showcase />
    </div>
  );
}
