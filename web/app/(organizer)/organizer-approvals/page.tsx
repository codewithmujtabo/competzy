'use client';

import { organizerHttp } from '@/lib/api/client';
import { VerificationQueue } from '@/components/verification-queue';

export default function OrganizerApprovalsPage() {
  return <VerificationQueue http={organizerHttp} />;
}
