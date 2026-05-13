'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/context';
import ThemeToggle from '@/components/ThemeToggle';

const NAV = [
  { href: '/dashboard',       label: 'Dashboard',         icon: '▦',  exact: true },
  { href: '/registrations',   label: 'Registrations',     icon: '📋' },
  { href: '/competitions',    label: 'Competitions',      icon: '🏆' },
  { href: '/segments',        label: 'Segments',          icon: '🧩' },
  { href: '/notifications',   label: 'Send Notification', icon: '📣' },
  { href: '/schools-pending', label: 'Pending Schools',   icon: '⏳' },
  { href: '/schools',         label: 'Schools',           icon: '🏫' },
  { href: '/users',           label: 'Users',             icon: '👥' },
];

export default function Sidebar({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const pathname         = usePathname();
  const router           = useRouter();

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <aside style={{
        width: 216, flexShrink: 0,
        background: 'var(--bg-card)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
      }}>
        <div style={{ padding: '22px 20px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontFamily: 'var(--ff-display)', fontSize: 14, lineHeight: 1.2 }}>Competzy</div>
          <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.1em', marginTop: 3 }}>Admin Panel</div>
        </div>

        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(n => {
            const active = isActive(n.href, n.exact);
            return (
              <Link key={n.href} href={n.href} style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '8px 11px', borderRadius: 8,
                textDecoration: 'none', fontSize: 13, fontWeight: 500,
                transition: 'all var(--ease)',
                background: active ? 'var(--accent-dim)' : 'transparent',
                color: active ? 'var(--accent-hover)' : 'var(--text-2)',
                borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
              }}>
                <span style={{ fontSize: 14 }}>{n.icon}</span>
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{user?.full_name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--ff-mono)', marginBottom: 10 }}>{user?.email}</div>
          <ThemeToggle />
          <button className="btn btn-ghost" onClick={async () => { await logout(); router.replace('/'); }}
            style={{ width: '100%', justifyContent: 'center', fontSize: 12, padding: '6px' }}>
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
