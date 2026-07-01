'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Eye, Pencil, Plus } from 'lucide-react';
import { organizerHttp } from '@/lib/auth/organizer-context';
import { PageHeader } from '@/components/shell/page-header';
import { useT } from '@/lib/i18n/context';
import { compStatusLabel, compStatusTone } from '@/lib/competitions/status';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

interface Competition {
  id: string;
  name: string;
  category?: string;
  registrationStatus: string;
  registrationCount: number;
  regCloseDate?: string;
  fee: number;
}


function fmtDate(d?: string) {
  return d
    ? new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
    : '-';
}

export default function OrganizerCompetitionsPage() {
  const t = useT();
  const [comps, setComps] = useState<Competition[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setComps(await organizerHttp.get<Competition[]>('/organizers/competitions'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load competitions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const publish = async (id: string) => {
    try {
      await organizerHttp.post(`/organizers/competitions/${id}/publish`, {});
      toast.success('Competition published.');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to publish');
    }
  };

  const close = async (id: string) => {
    if (!confirm('Close registration for this competition?')) return;
    try {
      await organizerHttp.post(`/organizers/competitions/${id}/close`, {});
      toast.success('Registration closed.');
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to close');
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow={t('org.eyebrowMyComps')}
        title={t('opnav.competitions')}
        subtitle={t('org.compSubtitle')}
        actions={
          <Button asChild>
            <Link href="/organizer-competitions/new">
              <Plus className="size-4" />
              {t('org.newCompetition')}
            </Link>
          </Button>
        }
      />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[1024px]">
            <TableHeader>
              <TableRow>
                <TableHead>{t('adm.colName')}</TableHead>
                <TableHead>{t('org.colCategory')}</TableHead>
                <TableHead>{t('adm.colStatus')}</TableHead>
                <TableHead>{t('org.colRegistrations')}</TableHead>
                <TableHead>{t('org.colFee')}</TableHead>
                <TableHead>{t('org.colRegCloses')}</TableHead>
                <TableHead className="text-right">{t('adm.reg.colActions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}>
                      <Skeleton className="h-9 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : comps.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-sm text-muted-foreground">
                    No competitions yet.{' '}
                    <Link href="/organizer-competitions/new" className="font-medium text-primary hover:underline">
                      Create your first one →
                    </Link>
                  </TableCell>
                </TableRow>
              ) : (
                comps.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="max-w-[260px] truncate font-medium text-foreground">
                      {c.name}
                    </TableCell>
                    <TableCell>
                      {c.category ? (
                        <Badge variant="secondary" className="font-normal">
                          {c.category}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          'border-transparent font-mono text-[10px]',
                          compStatusTone(c.registrationStatus),
                        )}
                      >
                        {compStatusLabel(c.registrationStatus, t)}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-[12px] text-muted-foreground">
                      {c.registrationCount}
                    </TableCell>
                    <TableCell>
                      {c.fee === 0 ? (
                        <Badge
                          variant="outline"
                          className="border-transparent bg-emerald-100 font-mono text-[10px] text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
                        >
                          Free
                        </Badge>
                      ) : (
                        <span className="text-sm tabular-nums">Rp {c.fee.toLocaleString('id-ID')}</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {fmtDate(c.regCloseDate)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/organizer-competitions/${c.id}`}>
                            <Eye className="size-3.5" />
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/organizer-competitions/${c.id}/edit`}>
                            <Pencil className="size-3.5" />
                          </Link>
                        </Button>
                        {c.registrationStatus !== 'Registration Opened' &&
                        c.registrationStatus !== 'Registration Closed' ? (
                          <Button size="sm" onClick={() => publish(c.id)}>
                            Publish
                          </Button>
                        ) : c.registrationStatus === 'Registration Opened' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={() => close(c.id)}
                          >
                            Close
                          </Button>
                        ) : null}
                      </div>
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
