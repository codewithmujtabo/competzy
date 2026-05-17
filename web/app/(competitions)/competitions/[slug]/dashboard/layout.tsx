'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter, useParams, notFound } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useCompetitionAuth } from '@/lib/auth/competition-context';
import { getCompetitionConfig, competitionPaths } from '@/lib/competitions/registry';

export default function CompetitionDashboardLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const config = getCompetitionConfig(slug);
  const paths = competitionPaths(slug);

  const { user, loading } = useCompetitionAuth();
  const router = useRouter();

  useEffect(() => {
    if (!config) notFound();
  }, [config]);

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(paths.login);
    else if (user.role === 'admin') router.replace(paths.admin);
  }, [user, loading, router, paths.login, paths.admin]);

  if (!config || loading || !user || user.role === 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
