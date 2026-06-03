'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { competitionPaths } from '@/lib/competitions/registry';
import { cn } from '@/lib/utils';

/**
 * Per-competition sub-navigation. With the sidebar now showing the SHARED
 * global 5-item menu everywhere (it no longer swaps when you enter a
 * competition), a competition's own features live here as in-page tabs,
 * scoped to this slug. Rendered by the competition layout under the top bar.
 */
export function CompetitionTabs({ slug }: { slug: string }) {
  const pathname = usePathname() ?? '';
  const p = competitionPaths(slug);
  const tabs = [
    { label: 'Overview', href: p.dashboard },
    { label: 'Announcements', href: p.announcements },
    { label: 'Materials', href: p.materials },
    { label: 'Store', href: p.store },
    { label: 'Certificates', href: p.certificate },
    { label: 'Feedback', href: p.feedback },
  ];
  return (
    <div className="border-b bg-background/95 px-4 sm:px-6 lg:px-10">
      <nav className="-mb-px flex gap-1 overflow-x-auto">
        {tabs.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + '/');
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                'whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
