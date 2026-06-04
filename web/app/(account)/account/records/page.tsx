'use client';

import { AccountTabs } from '@/components/account/account-tabs';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { History, Loader2, Search } from 'lucide-react';
import { emcHttp } from '@/lib/api/client';
import { PageHeader } from '@/components/shell/page-header';
import { useT } from '@/lib/i18n/context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface HistoricalRecord {
  id: string;
  fullName: string;
  grade: string | null;
  result: string | null;
  schoolName: string | null;
  compName: string | null;
  compYear: string | number | null;
  compCategory: string | null;
  eventPart: string | null;
}

function RecordCard({ rec, action }: { rec: HistoricalRecord; action?: React.ReactNode }) {
  return (
    <Card className="gap-0 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-serif text-base font-medium text-foreground">
            {rec.compName ?? 'Competition'}
            {rec.compYear ? ` ${rec.compYear}` : ''}
          </h3>
          <p className="text-sm text-muted-foreground">{rec.fullName}</p>
        </div>
        {action}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {rec.compCategory && (
          <Badge variant="secondary" className="font-normal">
            {rec.compCategory}
          </Badge>
        )}
        {rec.grade && (
          <Badge variant="outline" className="font-normal">
            Grade {rec.grade}
          </Badge>
        )}
        {rec.eventPart && (
          <Badge variant="outline" className="font-normal">
            {rec.eventPart}
          </Badge>
        )}
        {rec.result && (
          <Badge variant="outline" className="font-normal">
            {rec.result}
          </Badge>
        )}
      </div>
      {rec.schoolName && (
        <p className="mt-2 text-xs text-muted-foreground">{rec.schoolName}</p>
      )}
    </Card>
  );
}

export default function AccountRecordsPage() {
  const t = useT();
  const [mine, setMine] = useState<HistoricalRecord[] | null>(null);

  const [name, setName] = useState('');
  const [school, setSchool] = useState('');
  const [compName, setCompName] = useState('');
  const [results, setResults] = useState<HistoricalRecord[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const loadMine = useCallback(async () => {
    try {
      setMine(await emcHttp.get<HistoricalRecord[]>('/historical/my-records'));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load your records');
      setMine([]);
    }
  }, []);

  useEffect(() => {
    void loadMine();
  }, [loadMine]);

  async function doSearch() {
    if (name.trim().length < 3) {
      toast.error('Enter at least 3 characters of the name to search.');
      return;
    }
    setSearching(true);
    try {
      const qs = new URLSearchParams({ name: name.trim() });
      if (school.trim()) qs.set('school', school.trim());
      if (compName.trim()) qs.set('compName', compName.trim());
      setResults(await emcHttp.get<HistoricalRecord[]>(`/historical/search?${qs}`));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Search failed');
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function claim(rec: HistoricalRecord) {
    setBusy(rec.id);
    try {
      await emcHttp.post<{ message: string }>(`/historical/${rec.id}/claim`, {});
      toast.success('Record claimed');
      setResults((cur) => cur?.filter((r) => r.id !== rec.id) ?? null);
      await loadMine();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not claim this record');
    } finally {
      setBusy(null);
    }
  }

  async function unclaim(rec: HistoricalRecord) {
    setBusy(rec.id);
    try {
      await emcHttp.post<{ message: string }>(`/historical/${rec.id}/unclaim`, {});
      toast.success('Record removed');
      setMine((cur) => cur?.filter((r) => r.id !== rec.id) ?? null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not remove this record');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6 lg:p-8">
      <AccountTabs />
      <PageHeader
        eyebrow={t('apf.eyebrow')}
        title={t('acc.recordsTitle')}
        subtitle={t('acc.recordsSubtitle')}
      />

      <Tabs defaultValue="mine">
        <TabsList>
          <TabsTrigger value="mine">
            {t('acc.recTabMine')}{mine ? ` (${mine.length})` : ''}
          </TabsTrigger>
          <TabsTrigger value="find">{t('acc.recTabFind')}</TabsTrigger>
        </TabsList>

        {/* My records */}
        <TabsContent value="mine" className="mt-4">
          {!mine ? (
            <Card className="items-center p-12">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </Card>
          ) : mine.length === 0 ? (
            <Card className="items-center gap-2 p-12 text-center">
              <History className="size-7 text-muted-foreground" />
              <h2 className="font-serif text-lg font-medium text-foreground">
                {t('acc.noRecordsClaimed')}
              </h2>
              <p className="text-sm text-muted-foreground">{t('acc.recNoClaimedBody')}</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {mine.map((r) => (
                <RecordCard
                  key={r.id}
                  rec={r}
                  action={
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      disabled={busy === r.id}
                      onClick={() => unclaim(r)}
                    >
                      {busy === r.id ? <Loader2 className="size-4 animate-spin" /> : t('acc.remove')}
                    </Button>
                  }
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Find & claim */}
        <TabsContent value="find" className="mt-4 space-y-4">
          <Card className="gap-4 p-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>{t('acc.recName')}</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('acc.searchFullName')}
                  onKeyDown={(e) => e.key === 'Enter' && doSearch()}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('acc.recSchoolOpt')}</Label>
                <Input
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
                  placeholder={t('acc.searchSchool')}
                  onKeyDown={(e) => e.key === 'Enter' && doSearch()}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{t('acc.recCompetitionOpt')}</Label>
                <Input
                  value={compName}
                  onChange={(e) => setCompName(e.target.value)}
                  placeholder={t('acc.searchCompetition')}
                  onKeyDown={(e) => e.key === 'Enter' && doSearch()}
                />
              </div>
            </div>
            <Button onClick={doSearch} disabled={searching} className="self-start">
              {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              {t('acc.search')}
            </Button>
          </Card>

          {results !== null &&
            (results.length === 0 ? (
              <Card className="items-center gap-1 p-10 text-center">
                <p className="text-sm text-muted-foreground">{t('acc.noRecordMatch')}</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {results.map((r) => (
                  <RecordCard
                    key={r.id}
                    rec={r}
                    action={
                      <Button
                        size="sm"
                        className="shrink-0"
                        disabled={busy === r.id}
                        onClick={() => claim(r)}
                      >
                        {busy === r.id ? <Loader2 className="size-4 animate-spin" /> : t('acc.claim')}
                      </Button>
                    }
                  />
                ))}
              </div>
            ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
