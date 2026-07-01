'use client';

import { useEffect, useState } from 'react';
import { useParams, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, MessageSquare } from 'lucide-react';
import { emcHttp } from '@/lib/api/client';
import { useT } from '@/lib/i18n/context';
import { usePortalComp } from '@/lib/competitions/use-portal-comp';
import { getCompetitionConfig, competitionPaths } from '@/lib/competitions/registry';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const TEXTAREA_CLS =
  'flex min-h-36 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

export default function CompetitionFeedbackPage() {
  const t = useT();
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const config = getCompetitionConfig(slug);
  const paths = competitionPaths(slug);

  const { comp } = usePortalComp(slug);
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!config) notFound();
  }, [config]);

  const submit = async () => {
    if (!content.trim() || !comp?.id) return;
    setSending(true);
    setErr(null);
    try {
      await emcHttp.post('/suggestions', { compId: comp.id, content: content.trim() });
      setSent(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to send your feedback');
    } finally {
      setSending(false);
    }
  };

  if (!config) return null;

  return (
    <div>
      <div className="mx-auto max-w-xl space-y-6 p-6 lg:p-10">
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground" asChild>
          <Link href={paths.dashboard}>
            <ArrowLeft className="size-4" />
            {t('pay.back')}
          </Link>
        </Button>

        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary">
            {config.shortName} 2026
          </p>
          <h1 className="mt-1 font-serif text-2xl font-medium text-foreground">{t('comp.sendFeedback')}</h1>
        </div>

        {sent ? (
          <Card className="items-center gap-3 p-10 text-center">
            <CheckCircle2 className="size-10 text-emerald-600" />
            <h2 className="font-serif text-xl font-medium text-foreground">{t('comp.thankYou')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('comp.feedbackSentBody', { name: config.wordmark })}
            </p>
            <Button className="mt-2" asChild>
              <Link href={paths.dashboard}>{t('pay.back')}</Link>
            </Button>
          </Card>
        ) : (
          <Card className="gap-0 p-7">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <MessageSquare className="size-4" />
              {t('comp.feedbackPrompt')}
            </p>
            <textarea
              className={`${TEXTAREA_CLS} mt-4`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('comp.feedbackPlaceholder')}
            />
            {err && <p className="mt-2 text-sm text-destructive">{err}</p>}
            <Button
              className="mt-4 w-full"
              size="lg"
              onClick={submit}
              disabled={sending || !content.trim()}
            >
              {sending ? t('comp.sending') : t('comp.sendFeedback')}
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
