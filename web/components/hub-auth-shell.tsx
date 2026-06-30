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
      {/* Language + theme toggles — pinned to the top-right of the whole screen */}
      <PublicToggles />

      {/* Form panel — LEFT */}
      <div className="relative flex items-center justify-center bg-background px-6 py-12">
        <div className="w-full max-w-md">{children}</div>
      </div>

      {/* Brand panel — RIGHT (same showcase as sign-in + register) */}
      <CompetzyBrandPanel showcase />
    </div>
  );
}
