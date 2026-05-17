'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { organizerCompetitionsApi } from '@/lib/api';
import { PageHeader } from '@/components/shell/page-header';
import { CompetitionForm, type CompetitionFormValues } from '@/components/competition-form';

export default function EditCompetitionPage() {
  const params = useParams();
  const id = (Array.isArray(params.id) ? params.id[0] : params.id) ?? '';
  const router = useRouter();
  const [initial, setInitial] = useState<Partial<CompetitionFormValues> | null>(null);

  useEffect(() => {
    if (!id) return;
    organizerCompetitionsApi
      .getOne(id)
      .then((d) =>
        setInitial({
          name: d.name || '',
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
        }),
      )
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
        <CompetitionForm
          initial={initial}
          submitLabel="Save changes"
          cancelHref={`/organizer-competitions/${id}`}
          onSubmit={async (payload) => {
            await organizerCompetitionsApi.update(id, payload);
            router.push(`/organizer-competitions/${id}`);
          }}
        />
      )}
    </div>
  );
}
