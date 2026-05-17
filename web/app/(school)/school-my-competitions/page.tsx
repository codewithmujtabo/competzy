'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useSchool, schoolHttp } from '@/lib/auth/school-context';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface CompetitionStudent {
  id: string;
  fullName?: string;
  grade?: string;
}
interface TeacherCompetition {
  id: string;
  name: string;
  category?: string;
  fee?: number;
  students?: CompetitionStudent[];
}

export default function MyCompetitionsPage() {
  const { user } = useSchool();
  const [competitions, setCompetitions] = useState<TeacherCompetition[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'teacher') return;
    schoolHttp
      .get<{ competitions?: TeacherCompetition[] }>('/teachers/my-competitions')
      .then((d) => setCompetitions(d.competitions || []))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load competitions'))
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="School"
        title="My Competitions"
        subtitle="Competitions your students are registered for."
      />

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : competitions.length === 0 ? (
        <Card className="p-12 text-center text-sm text-muted-foreground">
          Your students have not registered for any competitions yet.
        </Card>
      ) : (
        <div className="space-y-4">
          {competitions.map((comp) => (
            <Card key={comp.id} className="gap-0 p-5">
              <h3 className="font-serif text-lg font-medium text-foreground">{comp.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {comp.category || 'General'}
                {' · '}
                {comp.fee && comp.fee > 0 ? `Rp ${comp.fee.toLocaleString('id-ID')}` : 'Free'}
              </p>
              <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                Registered students ({comp.students?.length || 0})
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {comp.students && comp.students.length > 0 ? (
                  comp.students.map((s) => (
                    <Badge key={s.id} variant="secondary" className="font-normal">
                      {s.fullName}
                      {s.grade ? ` · ${s.grade}` : ''}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No students yet.</span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
