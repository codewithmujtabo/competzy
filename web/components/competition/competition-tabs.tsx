'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { competitionPaths } from '@/lib/competitions/registry';
import { useT } from '@/lib/i18n/context';
import type { MessageKey } from '@/lib/i18n/messages/en';
import { cn } from '@/lib/utils';

/**
 * Per-competition sub-navigation. With the sidebar now showing the SHARED
 * global 5-item menu everywhere (it no longer swaps when you enter a
 * competition), a competition's own features live here as in-page tabs,
 * scoped to this slug. Rendered by the competition layout under the top bar.
 */
export function CompetitionTabs({ slug }: { slug: string }) {
  const pathname = usePathname() ?? '';
  const t = useT();
  const p = competitionPaths(slug);
  const tabs: { labelKey: MessageKey; href: string }[] = [
    { labelKey: 'tabs.overview', href: p.dashboard },
    { labelKey: 'tabs.announcements', href: p.announcements },
    { labelKey: 'tabs.materials', href: p.materials },
    { labelKey: 'tabs.store', href: p.store },
    { labelKey: 'tabs.certificates', href: p.certificate },
    { labelKey: 'tabs.feedback', href: p.feedback },
  ];
  return (
    <div className="border-b bg-background/95 px-4 sm:px-6 lg:px-10">
      <nav className="-mb-px flex gap-1 overflow-x-auto">
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + '/');
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors',
                active
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t(tab.labelKey)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
