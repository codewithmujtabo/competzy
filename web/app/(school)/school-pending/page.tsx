'use client';

import { useRouter } from 'next/navigation';
import { AlertTriangle, Clock } from 'lucide-react';
import { useSchool } from '@/lib/auth/school-context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function SchoolPendingPage() {
  const router = useRouter();
  const { user, logout } = useSchool();

  const isRejected = user?.schoolVerificationStatus === 'rejected';
  const reason = user?.schoolRejectionReason;

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="max-w-lg gap-0 p-9 text-center">
        <div
          className={cn(
            'mx-auto flex size-14 items-center justify-center rounded-2xl',
            isRejected
              ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
              : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
          )}
        >
          {isRejected ? <AlertTriangle className="size-7" /> : <Clock className="size-7" />}
        </div>

        <h1 className="mt-4 font-serif text-2xl font-medium text-foreground">
          {isRejected ? 'Application rejected' : 'Verification in progress'}
        </h1>

        {isRejected ? (
          <>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Your school application was rejected.
            </p>
            {reason && (
              <p className="mt-3 rounded-lg bg-muted px-4 py-3 text-left text-sm text-foreground">
                <strong>Reason:</strong> {reason}
              </p>
            )}
            <p className="mt-3 text-sm text-muted-foreground">
              Contact{' '}
              <a href="mailto:hello@competzy.com" className="font-medium text-primary hover:underline">
                hello@competzy.com
              </a>{' '}
              if you’d like to address the issue and re-apply.
            </p>
          </>
        ) : (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Your school is being reviewed. You’ll get an email once verified — usually within one
            business day. The school portal (Bulk Registration, Bulk Payment, Reports) unlocks
            immediately after.
          </p>
        )}

        <Button
          variant="outline"
          className="mt-6"
          onClick={async () => {
            await logout();
            router.replace('/');
          }}
        >
          Sign out
        </Button>
      </Card>
    </div>
  );
}
