'use client';

// Broadcast-email unsubscribe confirmation. The email footer link hits the
// backend GET endpoint, which suppresses the address and redirects here with
// ?done=1 (or ?error=1 on a bad token). Public, bilingual, no auth.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, MailX, XCircle } from 'lucide-react';
import { PublicToggles } from '@/components/shell/public-toggles';
import { useLocale } from '@/lib/i18n/context';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function UnsubscribePage() {
  const { locale } = useLocale();
  const id = locale === 'id';
  const [state, setState] = useState<'done' | 'error' | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setState(q.get('error') ? 'error' : 'done');
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <PublicToggles />
      <Card className="w-full max-w-md items-center gap-4 p-10 text-center animate-pop">
        {state === 'error' ? (
          <>
            <span className="flex size-14 items-center justify-center rounded-full bg-destructive/10">
              <XCircle className="size-7 text-destructive" />
            </span>
            <h1 className="font-serif text-2xl font-bold text-foreground">
              {id ? 'Tautan tidak valid' : 'Invalid link'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {id
                ? 'Tautan berhenti berlangganan ini tidak valid atau sudah kedaluwarsa. Kamu bisa menghubungi kami di competzy@eduversal.org.'
                : 'This unsubscribe link is invalid or expired. You can reach us at competzy@eduversal.org.'}
            </p>
          </>
        ) : (
          <>
            <span className="flex size-14 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="size-7 text-success" />
            </span>
            <h1 className="font-serif text-2xl font-bold text-foreground">
              {id ? 'Berhasil berhenti berlangganan' : 'You are unsubscribed'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {id
                ? 'Kamu tidak akan menerima email kampanye dari Competzy lagi. Email penting akun (verifikasi, reset kata sandi) tetap dikirim.'
                : 'You will no longer receive campaign emails from Competzy. Essential account emails (verification, password reset) still arrive.'}
            </p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <MailX className="size-3.5" />
              {id ? 'Berubah pikiran? Hubungi competzy@eduversal.org' : 'Changed your mind? Contact competzy@eduversal.org'}
            </p>
          </>
        )}
        <Button asChild variant="outline" size="sm" className="mt-2">
          <Link href="/">{id ? 'Ke halaman masuk' : 'Go to sign in'}</Link>
        </Button>
      </Card>
    </div>
  );
}
