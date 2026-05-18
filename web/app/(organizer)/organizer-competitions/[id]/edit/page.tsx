'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { organizerCompetitionsApi } from '@/lib/api';
import { organizerHttp } from '@/lib/api/client';
import { PageHeader } from '@/components/shell/page-header';
import { Card } from '@/components/ui/card';
import { CompetitionForm, type CompetitionFormValues } from '@/components/competition-form';
import { CompetitionLogoUploader } from '@/components/competition-logo-uploader';
import { roundsToDrafts } from '@/components/rounds-builder';

export default function EditCompetitionPage() {
  const params = useParams();
  const id = (Array.isArray(params.id) ? params.id[0] : params.id) ?? '';
  const router = useRouter();
  const [initial, setInitial] = useState<Partial<CompetitionFormValues> | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    organizerCompetitionsApi
      .getOne(id)
      .then((d) => {
        setLogoUrl(d.logoUrl ?? null);
        setInitial({
          name: d.name || '',
          kind: d.kind === 'affiliated' ? 'affiliated' : 'native',
          category: d.category || '',
          gradeLevel: d.gradeLevel || '',
          organizerName: d.organizerName || '',
          websiteUrl: d.websiteUrl || '',
          registrationStatus: d.registrationStatus || 'Coming Soon',
          posterUrl: d.posterUrl || '',
          isInternational: !!d.isInternational,
          detailedDescription: d.detailedDescription || '',
          description: d.description || '',
          fee: d.fee || 0,
          quota: d.quota || 100,
          regOpenDate: d.regOpenDate?.split('T')[0] || '',
          regCloseDate: d.regCloseDate?.split('T')[0] || '',
          competitionDate: d.competitionDate?.split('T')[0] || '',
          requiredDocs: d.requiredDocs || [],
          imageUrl: d.imageUrl || '',
          participantInstructions: d.participantInstructions || '',
          postPaymentRedirectUrl: d.postPaymentRedirectUrl || '',
          rounds: roundsToDrafts(d.rounds),
        });
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load competition'));
  }, [id]);

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="My competitions"
        title="Edit competition"
        subtitle="Update your competition details."
      />
      {!initial ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-5">
          <Card className="gap-0 p-0">
            <div className="border-b px-5 py-3.5">
              <h3 className="text-sm font-semibold text-foreground">Competition logo</h3>
            </div>
            <div className="p-5">
              <CompetitionLogoUploader
                endpoint={`/organizers/competitions/${id}/logo`}
                http={organizerHttp}
                logoUrl={logoUrl}
                onUploaded={setLogoUrl}
              />
            </div>
          </Card>
          <CompetitionForm
            initial={initial}
            submitLabel="Save changes"
            cancelHref={`/organizer-competitions/${id}`}
            onSubmit={async (payload) => {
              await organizerCompetitionsApi.update(id, payload);
              router.push(`/organizer-competitions/${id}`);
            }}
          />
        </div>
      )}
    </div>
  );
}
