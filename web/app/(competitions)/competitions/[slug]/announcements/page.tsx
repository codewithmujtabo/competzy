'use client';

import { useEffect, useState } from 'react';
import { useParams, notFound } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Download, Loader2, Megaphone, Star } from 'lucide-react';
import { emcHttp } from '@/lib/api/client';
import { usePortalComp } from '@/lib/competitions/use-portal-comp';
import { getCompetitionConfig, competitionPaths } from '@/lib/competitions/registry';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Announcement {
  id: string;
  compId: string | null;
  title: string;
  body: string | null;
  type: string | null;
  image: string | null;
  file: string | null;
  isFeatured: boolean;
  publishedAt: string | null;
}

function fmtDate(s: string | null) {
  if (!s) return '';
  return new Date(s).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
}

function AnnouncementCard({ a, featured }: { a: Announcement; featured?: boolean }) {
  return (
    <Card className={`gap-0 p-6 ${featured ? 'border-amber-300 dark:border-amber-900' : ''}`}>
      <div className="flex flex-wrap items-center gap-2">
        {featured && (
          <Badge className="bg-amber-500 text-[10px] text-white">
            <Star className="size-3" /> Featured
          </Badge>
        )}
        {a.type && (
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-primary">
            {a.type}
          </span>
        )}
        {a.compId === null && (
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            Platform
          </span>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{fmtDate(a.publishedAt)}</span>
      </div>
      <h2 className="mt-2 font-serif text-lg font-medium text-foreground">{a.title}</h2>
      {a.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={a.image}
          alt={a.title}
          className="mt-3 max-h-72 w-full rounded-md border bg-muted object-cover"
        />
      )}
      {a.body && (
        <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
          {a.body}
        </p>
      )}
      {a.file && (
        <Button asChild variant="outline" size="sm" className="mt-3 w-fit">
          <a href={a.file} target="_blank" rel="noopener noreferrer">
            <Download className="size-3.5" />
            Download attachment
          </a>
        </Button>
      )}
    </Card>
  );
}

export default function CompetitionAnnouncementsPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const config = getCompetitionConfig(slug);
  const paths = competitionPaths(slug);

  const { comp } = usePortalComp(slug);
  const [items, setItems] = useState<Announcement[] | null>(null);

  useEffect(() => {
    if (!config) notFound();
  }, [config]);

  useEffect(() => {
    if (!comp?.id) return;
    emcHttp
      .get<Announcement[]>(`/announcements?compId=${encodeURIComponent(comp.id)}`)
      .then(setItems)
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : 'Failed to load announcements');
        setItems([]);
      });
  }, [comp?.id]);

  if (!config) return null;

  const featured = items?.filter((a) => a.isFeatured) ?? [];
  const rest = items?.filter((a) => !a.isFeatured) ?? [];

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto max-w-2xl space-y-6 p-6 lg:p-10">
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" asChild>
          <Link href={paths.dashboard}>
            <ArrowLeft className="size-4" />
            Back to dashboard
          </Link>
        </Button>

        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary">
            {config.shortName} 2026
          </p>
          <h1 className="mt-1 font-serif text-2xl font-medium text-foreground">Announcements</h1>
        </div>

        {!items ? (
          <Card className="items-center gap-3 p-10 text-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </Card>
        ) : items.length === 0 ? (
          <Card className="items-center gap-2 p-10 text-center">
            <Megaphone className="size-7 text-muted-foreground" />
            <h2 className="font-serif text-lg font-medium text-foreground">No announcements yet</h2>
            <p className="text-sm text-muted-foreground">
              News about {config.wordmark} will appear here.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {featured.map((a) => (
              <AnnouncementCard key={a.id} a={a} featured />
            ))}
            {rest.map((a) => (
              <AnnouncementCard key={a.id} a={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
