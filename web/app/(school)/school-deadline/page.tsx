'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useSchool, schoolHttp } from '@/lib/auth/school-context';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface Deadline {
  id: string;
  competition: string;
  deadline: string;
  daysLeft: number;
  status: string;
  registeredCount: number;
}

export default function DeadlinesPage() {
  const { user } = useSchool();
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'teacher') return;
    schoolHttp
      .get<Deadline[]>('/teachers/upcoming-deadlines')
      .then((d) => setDeadlines(Array.isArray(d) ? d : []))
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load deadlines'))
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="School"
        title="Upcoming Deadlines"
        subtitle="Competitions with a registration deadline in the next 30 days."
      />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Competition</TableHead>
                <TableHead>Deadline</TableHead>
                <TableHead>Days left</TableHead>
                <TableHead className="text-right">Your students</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={4}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : deadlines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-sm text-muted-foreground">
                    No upcoming deadlines.
                  </TableCell>
                </TableRow>
              ) : (
                deadlines.map((dl) => (
                  <TableRow key={dl.id}>
                    <TableCell className="font-medium text-foreground">{dl.competition}</TableCell>
                    <TableCell className="font-mono text-[12px] text-muted-foreground">{dl.deadline}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          'border-transparent font-mono text-[10px]',
                          dl.status === 'urgent'
                            ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200'
                            : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
                        )}
                      >
                        {dl.daysLeft} days
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {dl.registeredCount} registered
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}
