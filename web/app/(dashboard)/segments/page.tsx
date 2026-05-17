'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Users } from 'lucide-react';
import { adminHttp } from '@/lib/api/client';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface Segment {
  key: string;
  label: string;
  description: string;
  count: number;
  sampleUserIds: string[];
}

export default function SegmentsPage() {
  const [segments, setSegments] = useState<Segment[] | null>(null);

  useEffect(() => {
    adminHttp
      .get<Segment[]>('/admin/segments')
      .then(setSegments)
      .catch((e) => {
        toast.error(e instanceof Error ? e.message : 'Failed to load segments');
        setSegments([]);
      });
  }, []);

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="Audience"
        title="Segments"
        subtitle="Pre-built cross-sell audiences — target any of these from the Send Notification page."
      />

      <div className="space-y-4">
        {!segments
          ? Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="p-6">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="mt-3 h-4 w-full max-w-md" />
              </Card>
            ))
          : segments.map((s) => (
              <Card key={s.key} className="gap-0 p-6">
                <div className="flex items-start justify-between gap-6">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                      {s.key}
                    </p>
                    <h2 className="mt-1 font-serif text-xl font-medium text-foreground">{s.label}</h2>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {s.description}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-serif text-3xl font-medium tracking-tight text-foreground">
                      {s.count.toLocaleString('en-US')}
                    </p>
                    <p className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                      <Users className="size-3" />
                      members
                    </p>
                  </div>
                </div>
                {s.sampleUserIds.length > 0 && (
                  <details className="mt-4 border-t pt-3">
                    <summary className="cursor-pointer text-xs text-muted-foreground">
                      Sample user IDs (first {s.sampleUserIds.length})
                    </summary>
                    <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 font-mono text-[11px] text-muted-foreground">
                      {s.sampleUserIds.join('\n')}
                    </pre>
                  </details>
                )}
              </Card>
            ))}
      </div>

      <p className="text-xs text-muted-foreground">
        A future wave adds a custom segment builder + scheduled recompute. Today’s segments are
        computed on each page load.
      </p>
    </div>
  );
}
