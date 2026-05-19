'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowRight, Heart, Loader2, Trophy } from 'lucide-react';
import { emcHttp } from '@/lib/api/client';
import { getCompetitionConfig } from '@/lib/competitions/registry';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Registration {
  id: string;
  compId: string;
  status: string;
}

interface Catalog {
  id: string;
  slug: string | null;
  name: string;
  organizerName: string;
  category: string | null;
}

// GET /favorites returns favorite_id + the raw `competitions` row (snake_case).
interface FavRow {
  id: string;
  slug: string | null;
  name: string;
  organizer_name: string | null;
  category: string | null;
}

const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Pending payment',
  pending_review: 'Under review',
  pending_approval: 'Under review',
  registered: 'Registered',
  paid: 'Paid',
  approved: 'Approved',
  completed: 'Completed',
  rejected: 'Declined',
};

function statusLabel(s: string): string {
  return STATUS_LABEL[s] ?? s.replace(/_/g, ' ');
}

function portalHref(slug: string | null): string | null {
  if (!slug) return null;
  return getCompetitionConfig(slug) ? `/competitions/${slug}/dashboard` : null;
}

export default function AccountCompetitionsPage() {
  const [regs, setRegs] = useState<Registration[] | null>(null);
  const [compList, setCompList] = useState<Catalog[] | null>(null);
  const [favs, setFavs] = useState<FavRow[] | null>(null);

  useEffect(() => {
    emcHttp
      .get<Catalog[]>('/competitions')
      .then(setCompList)
      .catch(() => setCompList([]));
    emcHttp
      .get<Registration[]>('/registrations')
      .then(setRegs)
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : 'Failed to load registrations');
        setRegs([]);
      });
    emcHttp
      .get<{ favorites: FavRow[] }>('/favorites')
      .then((r) => setFavs(r.favorites))
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : 'Failed to load saved competitions');
        setFavs([]);
      });
  }, []);

  async function unsave(compId: string) {
    setFavs((cur) => cur?.filter((f) => f.id !== compId) ?? null);
    try {
      await emcHttp.delete<{ message: string }>(`/favorites/${compId}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not remove from saved');
      emcHttp
        .get<{ favorites: FavRow[] }>('/favorites')
        .then((r) => setFavs(r.favorites))
        .catch(() => {});
    }
  }

  const compMap = new Map((compList ?? []).map((c) => [c.id, c]));

  // One entry per competition the student has registered for.
  const byComp = new Map<string, Registration[]>();
  for (const r of regs ?? []) {
    if (!byComp.has(r.compId)) byComp.set(r.compId, []);
    byComp.get(r.compId)!.push(r);
  }

  const registeredReady = regs !== null && compList !== null;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="My Account"
        title="My Competitions"
        subtitle="The competitions you've registered for and the ones you've saved."
      />

      <Tabs defaultValue="registered">
        <TabsList>
          <TabsTrigger value="registered">
            Registered{registeredReady ? ` (${byComp.size})` : ''}
          </TabsTrigger>
          <TabsTrigger value="saved">
            Saved{favs ? ` (${favs.length})` : ''}
          </TabsTrigger>
        </TabsList>

        {/* Registered */}
        <TabsContent value="registered" className="mt-4">
          {!registeredReady ? (
            <Card className="items-center p-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </Card>
          ) : byComp.size === 0 ? (
            <Card className="items-center gap-2 p-12 text-center">
              <Trophy className="size-7 text-muted-foreground" />
              <h2 className="font-serif text-lg font-medium text-foreground">
                No registrations yet
              </h2>
              <p className="text-sm text-muted-foreground">
                Browse competitions and register to see them here.
              </p>
              <Button asChild size="sm" variant="outline" className="mt-1">
                <Link href="/competitions">Browse competitions</Link>
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {[...byComp.entries()].map(([compId, list]) => {
                const comp = compMap.get(compId);
                const href = portalHref(comp?.slug ?? null);
                const statuses = [...new Set(list.map((r) => r.status))];
                return (
                  <Card key={compId} className="gap-0 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-serif text-base font-medium text-foreground">
                          {comp?.name ?? 'Competition'}
                        </h3>
                        {comp?.organizerName && (
                          <p className="text-sm text-muted-foreground">
                            {comp.organizerName}
                          </p>
                        )}
                      </div>
                      {comp?.category && (
                        <Badge variant="secondary" className="shrink-0 font-normal">
                          {comp.category}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {statuses.map((s) => (
                        <Badge key={s} variant="outline" className="font-normal">
                          {statusLabel(s)}
                        </Badge>
                      ))}
                    </div>
                    {href && (
                      <Button asChild size="sm" variant="outline" className="mt-4 self-start">
                        <Link href={href}>
                          Open competition
                          <ArrowRight className="size-3.5" />
                        </Link>
                      </Button>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Saved */}
        <TabsContent value="saved" className="mt-4">
          {!favs ? (
            <Card className="items-center p-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </Card>
          ) : favs.length === 0 ? (
            <Card className="items-center gap-2 p-12 text-center">
              <Heart className="size-7 text-muted-foreground" />
              <h2 className="font-serif text-lg font-medium text-foreground">
                Nothing saved yet
              </h2>
              <p className="text-sm text-muted-foreground">
                Tap the heart on a competition to save it for later.
              </p>
              <Button asChild size="sm" variant="outline" className="mt-1">
                <Link href="/competitions">Browse competitions</Link>
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {favs.map((f) => {
                const href = portalHref(f.slug);
                return (
                  <Card key={f.id} className="gap-0 p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-serif text-base font-medium text-foreground">
                          {f.name}
                        </h3>
                        {f.organizer_name && (
                          <p className="text-sm text-muted-foreground">{f.organizer_name}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        aria-label="Remove from saved"
                        title="Remove from saved"
                        onClick={() => unsave(f.id)}
                        className="shrink-0 rounded-full p-1 text-primary transition-colors hover:text-muted-foreground"
                      >
                        <Heart className="size-5 fill-primary" />
                      </button>
                    </div>
                    {f.category && (
                      <div className="mt-3">
                        <Badge variant="secondary" className="font-normal">
                          {f.category}
                        </Badge>
                      </div>
                    )}
                    {href && (
                      <Button asChild size="sm" variant="outline" className="mt-4 self-start">
                        <Link href={href}>
                          Open competition
                          <ArrowRight className="size-3.5" />
                        </Link>
                      </Button>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
