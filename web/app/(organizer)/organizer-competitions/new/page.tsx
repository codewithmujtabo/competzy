'use client';

import { useRouter } from 'next/navigation';
import { organizerCompetitionsApi } from '@/lib/api';
import { PageHeader } from '@/components/shell/page-header';
import { CompetitionForm } from '@/components/competition-form';

export default function NewCompetitionPage() {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-[1100px] space-y-6 p-6 lg:p-8">
      <PageHeader
        eyebrow="My competitions"
        title="Create competition"
        subtitle="Fill in the details to add a new competition to Competzy."
      />
      <CompetitionForm
        submitLabel="Create competition"
        cancelHref="/organizer-competitions"
        onSubmit={async (payload) => {
          await organizerCompetitionsApi.create(payload);
          router.push('/organizer-competitions');
        }}
      />
    </div>
  );
}
