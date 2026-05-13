'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { OrganizerProvider, useOrganizer } from '@/lib/auth/organizer-context';
import ThemeToggle from '@/components/ThemeToggle';

const NAV = [
  { href: '/organizer-dashboard',     label: 'Dashboard',     icon: '▦' },
  { href: '/organizer-competitions',  label: 'Competitions',  icon: '🏆' },
  { href: '/participants',            label: 'Participants',  icon: '👥' },
  { href: '/revenue',                 label: 'Revenue',       icon: '💰' },
];


export default function OrganizerLayout({ children }: { children: React.ReactNode }) {
  return (
    <OrganizerProvider>
      <OrganizerLayoutInner>{children}</OrganizerLayoutInner>
    </OrganizerProvider>
  );
}

function OrganizerLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, logout, loading } = useOrganizer();
  const pathname = usePathname();
  const router   = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/');
  }, [user, loading, pathname, router]);

  if (loading || !user) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="spin" />
    </div>
  );

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <aside style={{ width: 216, flexShrink: 0, background: 'var(--bg-card)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '22px 20px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: 'linear-gradient(135deg,#f59e0b,#f97316)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>🏆</div>
            <div>
              <div style={{ fontFamily: 'var(--ff-display)', fontSize: 14, lineHeight: 1.2 }}>Competzy</div>
              <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.1em' }}>Organizer Portal</div>
            </div>
          </div>
        </div>
        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(n => {
            const isActive = n.href === '/organizer-dashboard'
              ? pathname === '/organizer-dashboard'
              : pathname.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '8px 11px', borderRadius: 8,
                textDecoration: 'none', fontSize: 13, fontWeight: 500,
                background: isActive ? 'rgba(245,158,11,.12)' : 'transparent',
                color: isActive ? '#f59e0b' : 'var(--text-2)',
                borderLeft: isActive ? '2px solid #f59e0b' : '2px solid transparent',
                transition: 'all var(--ease)',
              }}>
                <span style={{ fontSize: 14 }}>{n.icon}</span>
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{user.full_name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--ff-mono)', marginBottom: 10 }}>{user.email}</div>
          <ThemeToggle />
          <button className="btn btn-ghost" onClick={handleLogout} style={{ width: '100%', justifyContent: 'center', fontSize: 12, padding: '6px' }}>
            Sign out
          </button>
        </div>
      </aside>
      <main style={{ flex: 1, overflowY: 'auto', background: 'var(--bg)' }}>
        {children}
      </main>
    </div>
  );
}