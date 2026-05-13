'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useEmcAuth } from '@/lib/auth/emc-context';
import { EMC } from '@/lib/competitions/emc';

export default function EmcDashboardLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useEmcAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(EMC.loginPath);
    else if (user.role === 'admin') router.replace(EMC.adminPath);
  }, [user, loading, router]);

  if (loading || !user || user.role === 'admin') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f7f7fb' }}>
        <div className="spin" />
      </div>
    );
  }

  return <>{children}</>;
}
