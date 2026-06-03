'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

// Documents / Records / Family were folded out of the simplified 5-item
// sidebar and now live as tabs under Profile. This bar renders at the top of
// each of those four pages so they read as one "Profile" hub.
const TABS = [
  { label: 'Profile', href: '/account/profile' },
  { label: 'Documents', href: '/account/documents' },
  { label: 'Records', href: '/account/records' },
  { label: 'Family', href: '/account/family' },
];

export function AccountTabs() {
  const pathname = usePathname() ?? '';
  return (
    <div className="border-b">
      <nav className="-mb-px flex gap-1 overflow-x-auto">
        {TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + '/');
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                'whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors',
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
