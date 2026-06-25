'use client';

import { adminHttp } from '@/lib/api/client';
import { VerificationQueue } from '@/components/verification-queue';

export default function AdminApprovalsPage() {
  return <VerificationQueue http={adminHttp} />;
}
