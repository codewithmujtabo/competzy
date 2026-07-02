'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowRight, Heart, Loader2, Trophy } from 'lucide-react';
import { emcHttp } from '@/lib/api/client';
import { useT } from '@/lib/i18n/context';
import type { MessageKey } from '@/lib/i18n/messages/en';
import { getCompetitionConfig } from '@/lib/competitions/registry';
import { brandFor, orderCompetitions } from '@/lib/competitions/branding';
import { CompetitionBrandCard, BandChip } from '@/components/competition/brand-card';
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
  logoUrl?: string | null;
}

// GET /favorites returns favorite_id + the raw `competitions` row (snake_case).
interface FavRow {
  id: string;
  slug: string | null;
  name: string;
  organizer_name: string | null;
  category: string | null;
  logo_url?: string | null;
}

function portalHref(slug: string | null): string | null {
  if (!slug) return null;
  return getCompetitionConfig(slug) ? `/competitions/${slug}/dashboard` : null;
}

export default function AccountCompetitionsPage() {
  const t = useT();
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
    <div className="mx-auto max-w-5xl space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow={t('apf.eyebrow')}
        title={t('acc.myCompTitle')}
        subtitle={t('acc.myCompSubtitle')}
      />

      <Tabs defaultValue="registered">
        <TabsList>
          <TabsTrigger value="registered">
            {t('acc.tabRegistered')}{registeredReady ? ` (${byComp.size})` : ''}
          </TabsTrigger>
          <TabsTrigger value="saved">
            {t('acc.tabSaved')}{favs ? ` (${favs.length})` : ''}
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
                {t('acc.noRegistrations')}
              </h2>
              <p className="text-sm text-muted-foreground">{t('acc.noRegistrationsBody')}</p>
              <Button asChild size="sm" variant="outline" className="mt-1">
                <Link href="/competitions">{t('acc.browse')}</Link>
              </Button>
            </Card>
          ) : (
            <div className="stagger-children grid gap-5 sm:grid-cols-2">
              {orderCompetitions(
                [...byComp.entries()].map(([compId, list]) => ({
                  compId,
                  list,
                  slug: compMap.get(compId)?.slug ?? null,
                  name: compMap.get(compId)?.name ?? null,
                })),
              ).map(({ compId, list }) => {
                const comp = compMap.get(compId);
                const href = portalHref(comp?.slug ?? null);
                const statuses = [...new Set(list.map((r) => r.status))];
                const brand = brandFor({
                  id: compId,
                  slug: comp?.slug ?? null,
                  name: comp?.name ?? null,
                  logoUrl: comp?.logoUrl ?? null,
                });
                return (
                  <CompetitionBrandCard
                    key={compId}
                    brand={brand}
                    interactive={!!href}
                    bandChips={comp?.category ? <BandChip>{comp.category}</BandChip> : undefined}
                  >
                    <h3 className="font-serif text-lg font-semibold leading-snug text-foreground">
                      {comp?.name ?? 'Competition'}
                    </h3>
                    {comp?.organizerName && (
                      <p className="mt-1 text-sm text-muted-foreground">{comp.organizerName}</p>
                    )}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {statuses.map((s) => (
                        <Badge key={s} variant="outline" className="bg-background/60 font-normal">
                          {t(`status.${s}` as MessageKey)}
                        </Badge>
                      ))}
                    </div>
                    {href && (
                      <Button asChild size="sm" variant="outline" className="mt-4 self-start">
                        <Link href={href}>
                          {t('acc.openCompetition')}
                          <ArrowRight className="size-3.5" />
                        </Link>
                      </Button>
                    )}
                  </CompetitionBrandCard>
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
                {t('acc.noSaved')}
              </h2>
              <p className="text-sm text-muted-foreground">{t('acc.noSavedBody')}</p>
              <Button asChild size="sm" variant="outline" className="mt-1">
                <Link href="/competitions">{t('acc.browse')}</Link>
              </Button>
            </Card>
          ) : (
            <div className="stagger-children grid gap-5 sm:grid-cols-2">
              {orderCompetitions(favs).map((f) => {
                const href = portalHref(f.slug);
                const brand = brandFor({ id: f.id, slug: f.slug, name: f.name, logoUrl: f.logo_url ?? null });
                return (
                  <CompetitionBrandCard
                    key={f.id}
                    brand={brand}
                    interactive={!!href}
                    bandChips={f.category ? <BandChip>{f.category}</BandChip> : undefined}
                    bandAction={
                      <button
                        type="button"
                        aria-label={t('acc.removeFromSaved')}
                        title={t('acc.removeFromSaved')}
                        onClick={() => unsave(f.id)}
                        className="flex size-9 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30 backdrop-blur-sm transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/75"
                      >
                        <Heart className="size-4 fill-current" />
                      </button>
                    }
                  >
                    <h3 className="font-serif text-lg font-semibold leading-snug text-foreground">{f.name}</h3>
                    {f.organizer_name && (
                      <p className="mt-1 text-sm text-muted-foreground">{f.organizer_name}</p>
                    )}
                    {href && (
                      <Button asChild size="sm" variant="outline" className="mt-4 self-start">
                        <Link href={href}>
                          {t('acc.openCompetition')}
                          <ArrowRight className="size-3.5" />
                        </Link>
                      </Button>
                    )}
                  </CompetitionBrandCard>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
