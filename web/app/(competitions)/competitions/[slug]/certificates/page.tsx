'use client';

// The student's certificates for a competition (EMC Wave 12 Phase 4).
// Certificates are auto-issued once the student finishes an exam — this page
// lists them with a download link + a link to the public verification page.

import { useEffect, useState } from 'react';
import { useParams, notFound } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Award, CheckCircle2, Download, Loader2, ShieldAlert } from 'lucide-react';
import { emcHttp } from '@/lib/api/client';
import { usePortalComp } from '@/lib/competitions/use-portal-comp';
import { getCompetitionConfig, competitionPaths } from '@/lib/competitions/registry';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface MyCertificate {
  id: string;
  certificateNumber: string;
  verificationCode: string;
  type: string;
  awardLabel: string | null;
  competitionName: string;
  grade: string | null;
  score: number | null;
  scoreMax: number | null;
  issuedAt: string;
  revokedAt: string | null;
}

export default function CompetitionCertificatesPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const config = getCompetitionConfig(slug);
  const paths = competitionPaths(slug);

  const { comp } = usePortalComp(slug);
  const [items, setItems] = useState<MyCertificate[] | null>(null);

  useEffect(() => {
    if (!config) notFound();
  }, [config]);

  useEffect(() => {
    if (!comp?.id) return;
    emcHttp
      .get<MyCertificate[]>(`/certificates/mine?compId=${encodeURIComponent(comp.id)}`)
      .then(setItems)
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : 'Failed to load certificates');
        setItems([]);
      });
  }, [comp?.id]);

  if (!config) return null;

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
          <h1 className="mt-1 font-serif text-2xl font-medium text-foreground">
            Your certificates
          </h1>
        </div>

        {!items ? (
          <Card className="items-center gap-3 p-10 text-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </Card>
        ) : items.length === 0 ? (
          <Card className="items-center gap-2 p-10 text-center">
            <Award className="size-7 text-muted-foreground" />
            <h2 className="font-serif text-lg font-medium text-foreground">No certificates yet</h2>
            <p className="text-sm text-muted-foreground">
              Your certificate is issued automatically once you finish a {config.wordmark} exam.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((c) => (
              <Card key={c.id} className="gap-0 p-5">
                <p className="font-medium text-foreground">
                  {c.type === 'achievement'
                    ? 'Certificate of Achievement'
                    : 'Certificate of Participation'}
                </p>
                {c.awardLabel && (
                  <p className="mt-0.5 text-sm font-medium text-primary">{c.awardLabel}</p>
                )}
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                  {c.certificateNumber}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  <Badge
                    variant="outline"
                    className={
                      c.revokedAt
                        ? 'gap-1 text-[10px] text-destructive'
                        : 'gap-1 text-[10px] text-emerald-700 dark:text-emerald-400'
                    }
                  >
                    {c.revokedAt ? (
                      <ShieldAlert className="size-3" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="size-3" aria-hidden="true" />
                    )}
                    {c.revokedAt ? 'Revoked' : 'Valid'}
                  </Badge>
                  {c.grade && (
                    <Badge variant="outline" className="text-[10px]">
                      {c.grade}
                    </Badge>
                  )}
                  {c.score != null && (
                    <Badge variant="outline" className="text-[10px]">
                      Score {c.score}
                      {c.scoreMax != null ? ` / ${c.scoreMax}` : ''}
                    </Badge>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Issued{' '}
                  {new Date(c.issuedAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild size="sm">
                    <a
                      href={`/api/certificates/verify/${c.verificationCode}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="size-3.5" />
                      Download
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/verify/${c.verificationCode}`}>Verify</Link>
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
