'use client';

// Banner shown whenever the current session is a super-admin
// impersonation. Renders INSIDE the AppShell's SidebarInset (above the
// sticky header) so it pushes the header + main content down naturally
// instead of overlaying them. It self-fetches GET /auth/me (independent
// of the per-role auth providers, which reject a mismatched role during
// impersonation) and offers a one-click "Stop impersonating". Returns
// null for a normal session, so it has zero layout impact outside an
// impersonation.

import { useEffect, useState } from 'react';
import { Loader2, ShieldAlert } from 'lucide-react';
import { adminHttp } from '@/lib/api/client';
import type { AuthUser } from '@/types';

export function ImpersonationBanner() {
  const [me, setMe] = useState<AuthUser | null>(null);
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    adminHttp
      .get<AuthUser>('/auth/me')
      .then((u) => {
        if (u?.impersonating) setMe(u);
      })
      .catch(() => {
        /* not signed in / not impersonating — no banner */
      });
  }, []);

  if (!me) return null;

  const name = me.fullName || me.full_name || me.email || 'this user';
  const role = me.role ? me.role.replace(/_/g, ' ') : '';

  const stop = async () => {
    setStopping(true);
    try {
      await adminHttp.post('/auth/stop-impersonation', {});
      // Hard nav so every per-role auth provider re-hydrates with the
      // restored admin cookie (same reason the login page hard-navs).
      window.location.assign('/dashboard');
    } catch {
      // A failed unwind leaves an ambiguous session — drop to the login page.
      window.location.assign('/');
    }
  };

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-center gap-x-3 gap-y-1.5 border-b border-amber-600/40 bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950">
      <span className="inline-flex items-center gap-2">
        <ShieldAlert className="size-4 shrink-0" />
        Impersonating <strong className="font-semibold">{name}</strong>
        {role && <span className="opacity-80">({role})</span>}
      </span>
      <button
        type="button"
        onClick={stop}
        disabled={stopping}
        className="inline-flex items-center gap-1.5 rounded-md bg-amber-950 px-3 py-1 text-xs font-semibold text-amber-50 transition-colors hover:bg-amber-900 disabled:opacity-60"
      >
        {stopping && <Loader2 className="size-3 animate-spin" />}
        Stop impersonating
      </button>
    </div>
  );
}
