'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useSchool, schoolHttp } from '@/lib/auth/school-context';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface Student {
  id: string;
  fullName: string;
  email: string;
  grade: string;
  nisn: string;
  registrationCount: number;
}

export default function MyStudentsPage() {
  const { user } = useSchool();
  const [students, setStudents] = useState<Student[]>([]);
  const [stats, setStats] = useState({ totalStudents: 0, totalRegistrations: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== 'teacher') return;
    schoolHttp
      .get<{ students: Student[]; stats?: { totalStudents: number; totalRegistrations: number } }>(
        '/teachers/my-students',
      )
      .then((d) => {
        setStudents(d.students || []);
        setStats(d.stats || { totalStudents: 0, totalRegistrations: 0 });
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load students'))
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="School"
        title="My Students"
        subtitle={`${stats.totalStudents} student${stats.totalStudents === 1 ? '' : 's'} · ${stats.totalRegistrations} total registration${stats.totalRegistrations === 1 ? '' : 's'}.`}
      />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>NISN</TableHead>
                <TableHead className="text-right">Registrations</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-8 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-sm text-muted-foreground">
                    No students linked to your classes yet. Ask your school administrator to add them.
                  </TableCell>
                </TableRow>
              ) : (
                students.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium text-foreground">{s.fullName}</TableCell>
                    <TableCell className="font-mono text-[12px] text-muted-foreground">{s.email}</TableCell>
                    <TableCell>{s.grade || '—'}</TableCell>
                    <TableCell className="font-mono text-[12px] text-muted-foreground">{s.nisn || '—'}</TableCell>
                    <TableCell className="text-right font-mono text-[13px] text-muted-foreground">
                      {s.registrationCount || 0}
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
