'use client';

import { useEffect, useState } from 'react';
import { useParams, notFound } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Download, FileText, Loader2 } from 'lucide-react';
import { emcHttp } from '@/lib/api/client';
import { usePortalComp } from '@/lib/competitions/use-portal-comp';
import { getCompetitionConfig, competitionPaths } from '@/lib/competitions/registry';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface Material {
  id: string;
  compId: string | null;
  title: string;
  body: string | null;
  category: string | null;
  grades: string[];
  file: string | null;
}

export default function CompetitionMaterialsPage() {
  const params = useParams<{ slug: string }>();
  const slug = params?.slug ?? '';
  const config = getCompetitionConfig(slug);
  const paths = competitionPaths(slug);

  const { comp } = usePortalComp(slug);
  const [items, setItems] = useState<Material[] | null>(null);

  useEffect(() => {
    if (!config) notFound();
  }, [config]);

  useEffect(() => {
    if (!comp?.id) return;
    emcHttp
      .get<Material[]>(`/materials?compId=${encodeURIComponent(comp.id)}`)
      .then(setItems)
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : 'Failed to load materials');
        setItems([]);
      });
  }, [comp?.id]);

  if (!config) return null;

  // Group by category (newest API order preserved within each group).
  const groups = new Map<string, Material[]>();
  for (const m of items ?? []) {
    const key = m.category || 'Other';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }

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
          <h1 className="mt-1 font-serif text-2xl font-medium text-foreground">Study materials</h1>
        </div>

        {!items ? (
          <Card className="items-center gap-3 p-10 text-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </Card>
        ) : items.length === 0 ? (
          <Card className="items-center gap-2 p-10 text-center">
            <FileText className="size-7 text-muted-foreground" />
            <h2 className="font-serif text-lg font-medium text-foreground">No materials yet</h2>
            <p className="text-sm text-muted-foreground">
              Study materials for {config.wordmark} will appear here.
            </p>
          </Card>
        ) : (
          <div className="space-y-6">
            {[...groups.entries()].map(([category, mats]) => (
              <div key={category}>
                <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  {category}
                </p>
                <div className="space-y-3">
                  {mats.map((m) => (
                    <Card key={m.id} className="gap-0 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-medium text-foreground">{m.title}</p>
                          {m.body && (
                            <p className="mt-0.5 text-sm text-muted-foreground">{m.body}</p>
                          )}
                          <div className="mt-2 flex flex-wrap gap-1">
                            {m.compId === null && (
                              <Badge variant="outline" className="text-[10px]">
                                Platform
                              </Badge>
                            )}
                            {(m.grades.length ? m.grades : ['All grades']).map((g) => (
                              <Badge key={g} variant="outline" className="text-[10px]">
                                {g}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        {m.file && (
                          <Button asChild size="sm" variant="outline" className="shrink-0">
                            <a href={m.file} target="_blank" rel="noopener noreferrer">
                              <Download className="size-3.5" />
                              Download
                            </a>
                          </Button>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
