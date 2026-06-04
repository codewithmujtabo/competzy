'use client';

// Global Announcements feed — every announcement for the competitions the
// student is registered in, plus platform-wide posts. Backed by the
// GET /api/announcements/mine aggregator.

import { useEffect, useState } from 'react';
import { Loader2, Megaphone } from 'lucide-react';

import { marketingHttp } from '@/lib/api/client';
import { useT } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Announcement {
  id: string;
  compId: string | null;
  competitionName: string | null;
  title: string;
  body: string | null;
  type: string | null;
  image: string | null;
  file: string | null;
  isFeatured: boolean;
  publishedAt: string | null;
}

function fmtDate(d: string | null): string {
  return d
    ? new Date(d).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
    : '';
}

function AnnouncementCard({ a }: { a: Announcement }) {
  const t = useT();
  return (
    <Card className={cn('gap-0 overflow-hidden p-0', a.isFeatured && 'border-amber-300/70')}>
      {a.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.image} alt="" className="h-40 w-full object-cover" />
      )}
      <div className="space-y-2 p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          {a.isFeatured && (
            <Badge className="bg-amber-100 font-normal text-amber-800 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-200">
              {t('acc.featured')}
            </Badge>
          )}
          <Badge variant="secondary" className="font-normal">
            {a.competitionName ?? t('acc.platformWide')}
          </Badge>
          {a.type && (
            <Badge variant="outline" className="font-normal text-muted-foreground">
              {a.type}
            </Badge>
          )}
          {a.publishedAt && (
            <span className="ml-auto text-xs text-muted-foreground">{fmtDate(a.publishedAt)}</span>
          )}
        </div>
        <h2 className="font-serif text-lg font-medium leading-snug text-foreground">{a.title}</h2>
        {a.body && <p className="whitespace-pre-line text-sm text-muted-foreground">{a.body}</p>}
        {a.file && (
          <Button asChild variant="outline" size="sm" className="mt-1">
            <a href={a.file} target="_blank" rel="noreferrer">
              {t('acc.openAttachment')}
            </a>
          </Button>
        )}
      </div>
    </Card>
  );
}

export default function AnnouncementsPage() {
  const t = useT();
  const [items, setItems] = useState<Announcement[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    marketingHttp
      .get<Announcement[]>('/announcements/mine')
      .then(setItems)
      .catch((e) => setErr(e instanceof Error ? e.message : t('acc.failedAnnouncements')));
  }, [t]);

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 lg:p-10">
      <div>
        <h1 className="font-serif text-2xl font-semibold tracking-tight text-foreground">
          {t('acc.announcementsTitle')}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('acc.announcementsSubtitle')}</p>
      </div>

      {err && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {err}
        </div>
      )}

      {!items ? (
        <Card className="items-center gap-3 p-10 text-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('acc.loadingAnnouncements')}</p>
        </Card>
      ) : items.length === 0 ? (
        <Card className="items-center gap-2 p-10 text-center">
          <Megaphone className="size-7 text-muted-foreground" />
          <h2 className="font-serif text-lg font-medium text-foreground">{t('acc.noAnnouncements')}</h2>
          <p className="text-sm text-muted-foreground">{t('acc.noAnnouncementsBody')}</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((a) => (
            <AnnouncementCard key={a.id} a={a} />
          ))}
        </div>
      )}
    </div>
  );
}
