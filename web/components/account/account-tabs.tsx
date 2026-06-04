'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '@/lib/i18n/context';
import type { MessageKey } from '@/lib/i18n/messages/en';
import { cn } from '@/lib/utils';

// Documents / Records / Family were folded out of the simplified 5-item
// sidebar and now live as tabs under Profile. This bar renders at the top of
// each of those four pages so they read as one "Profile" hub.
const TABS: { labelKey: MessageKey; href: string }[] = [
  { labelKey: 'account.tabProfile', href: '/account/profile' },
  { labelKey: 'account.tabDocuments', href: '/account/documents' },
  { labelKey: 'account.tabRecords', href: '/account/records' },
  { labelKey: 'account.tabFamily', href: '/account/family' },
];

export function AccountTabs() {
  const pathname = usePathname() ?? '';
  const t = useT();
  return (
    <div className="border-b">
      <nav className="-mb-px flex gap-1 overflow-x-auto">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(tab.href + '/');
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
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
