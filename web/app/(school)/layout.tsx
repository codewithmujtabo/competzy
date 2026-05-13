'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { SchoolProvider, useSchool } from '@/lib/auth/school-context';
import ThemeToggle from '@/components/ThemeToggle';

// Навигация для администратора школы
const ADMIN_NAV = [
  { href: '/school-dashboard',    label: 'Dashboard',         icon: '▦' },
  { href: '/school-students',     label: 'Student Roster',    icon: '👨‍🎓' },
  { href: '/bulk-registration',   label: 'Bulk Registration', icon: '📋' },
  { href: '/bulk-payment',        label: 'Bulk Payment',      icon: '💳' },
  { href: '/school-registrations', label: 'Registrations',    icon: '📊' },
];

// Навигация для учителя
const TEACHER_NAV = [
  { href: '/school-dashboard',      label: 'Dashboard',       icon: '▦' },
  { href: '/school-my-students',    label: 'My Students',     icon: '👨‍🎓' },
  { href: '/school-my-competitions', label: 'My Competitions', icon: '🏆' },
  { href: '/school-registrations',  label: 'Registrations',   icon: '📊' },
  { href: '/school-deadline',        label: 'Deadlines',       icon: '⏰' },
];

export default function SchoolLayout({ children }: { children: React.ReactNode }) {
  return (
    <SchoolProvider>
      <SchoolLayoutInner>{children}</SchoolLayoutInner>
    </SchoolProvider>
  );
}

function SchoolLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, logout, loading } = useSchool();
  const pathname = usePathname();
  const router   = useRouter();

  useEffect(() => {
    if (!loading && !user && !pathname.includes('/school-signup')) {
      router.replace('/');
    }
  }, [user, loading, pathname, router]);

  // school-signup remains reachable unauthenticated (no sidebar)
  if (pathname.includes('/school-signup')) return <>{children}</>;

  // School-admin users whose school isn't verified yet land on /school-pending.
  // school_admin only — teachers can be linked to verified schools and don't go through approval.
  if (
    user?.role === 'school_admin' &&
    user.schoolVerificationStatus &&
    user.schoolVerificationStatus !== 'verified' &&
    !pathname.includes('/school-pending')
  ) {
    if (typeof window !== 'undefined') router.replace('/school-pending');
    return null;
  }
  // Unverified user on /school-pending: render only the pending page (no sidebar).
  if (pathname.includes('/school-pending')) return <>{children}</>;

  if (loading || !user) return (
    <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span className="spin" />
    </div>
  );

  const handleLogout = async () => { await logout(); router.replace('/'); };
  
  // Выбираем навигацию в зависимости от роли пользователя
  const isAdmin = user.role === 'school_admin';
  const navItems = isAdmin ? ADMIN_NAV : TEACHER_NAV;

  // Роль пользователя для отображения
  const roleLabel = isAdmin ? 'Admin Portal' : 'Teacher Portal';
  const roleColor = isAdmin ? '#3b82f6' : '#22c55e';

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <aside style={{ width: 240, flexShrink: 0, background: 'var(--bg-card)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
        {/* Logo */}
        <div style={{ padding: '22px 20px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ 
              width: 30, height: 30, borderRadius: 8, 
              background: `linear-gradient(135deg,${roleColor},${isAdmin ? '#6366f1' : '#16a34a'})`, 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              fontSize: 14, flexShrink: 0 
            }}>
              🏫
            </div>
            <div>
              <div style={{ fontFamily: 'var(--ff-display)', fontSize: 14, lineHeight: 1.2 }}>Competzy</div>
              <div style={{ fontFamily: 'var(--ff-mono)', fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.1em' }}>
                {roleLabel}
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(n => {
            const isActive = n.href === '/school-dashboard'
              ? pathname === '/school-dashboard'
              : pathname.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} style={{
                display: 'flex', alignItems: 'center', gap: 9,
                padding: '8px 11px', borderRadius: 8,
                textDecoration: 'none', fontSize: 13, fontWeight: 500,
                background: isActive ? `${roleColor}18` : 'transparent',
                color: isActive ? roleColor : 'var(--text-2)',
                borderLeft: isActive ? `2px solid ${roleColor}` : '2px solid transparent',
                transition: 'all var(--ease)',
              }}>
                <span style={{ fontSize: 14 }}>{n.icon}</span>
                {n.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div style={{ padding: '14px 18px', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{user.full_name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--ff-mono)', marginBottom: 10 }}>{user.email}</div>
          <div style={{ fontSize: 10, color: roleColor, marginBottom: 10, textTransform: 'uppercase' }}>
            {isAdmin ? 'Administrator' : 'Teacher'}
          </div>
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