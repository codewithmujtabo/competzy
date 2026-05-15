import Link from 'next/link';
import { ArrowLeft, TriangleAlert } from 'lucide-react';

// Placeholder content. MUST be replaced by counsel before production launch.
// References UU PDP No. 27 of 2022 (Indonesia data protection law).

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back
        </Link>

        <div
          role="alert"
          className="mt-4 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-800 dark:bg-amber-950/60 dark:text-amber-200"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">DRAFT — NOT FOR PRODUCTION</p>
            <p className="mt-0.5 opacity-90">
              This document has not been reviewed by counsel and must not be relied on as legal
              terms until reviewed and approved.
            </p>
          </div>
        </div>

        <h1 className="mt-8 font-serif text-3xl font-medium text-foreground">Privacy Policy</h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          Last reviewed: <em>pending legal review</em>
        </p>

        <div className="mt-6 space-y-2 text-sm leading-relaxed text-muted-foreground">
          <p>
            Competzy (<em>“we”, “us”</em>) is the platform you are using. This Privacy Policy
            explains how we collect, use, store, and protect personal data of platform users in
            compliance with the Personal Data Protection Law of Indonesia (UU PDP No. 27 / 2022).
          </p>

          <h2 className="!mt-8 font-serif text-lg font-medium text-foreground">1. Data we collect</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Identity: full name, date of birth, email, phone number, city, school</li>
            <li>Education data: grade, NISN/NPSN, supervisor / parent contacts</li>
            <li>Documents you upload: student card, report card, photos</li>
            <li>Payment metadata: order ID, amount, gateway response (we do not store card numbers)</li>
            <li>Activity: which competitions you view, register for, and submit to</li>
          </ul>

          <h2 className="!mt-8 font-serif text-lg font-medium text-foreground">2. Lawful basis</h2>
          <p>
            We process the data above on the basis of (a) explicit consent given at signup,
            (b) performance of the contract to register you for competitions, and (c) legitimate
            interest in operating the platform and protecting it from abuse.
          </p>

          <h2 className="!mt-8 font-serif text-lg font-medium text-foreground">3. How long we keep data</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>Your account profile: while your account is active, plus 1 year after closure</li>
            <li>Uploaded documents: until 1 year after the related competition ends</li>
            <li>Audit logs of administrative actions: 5 years</li>
            <li>Payment records: per Indonesian tax law (typically 10 years)</li>
          </ul>

          <h2 className="!mt-8 font-serif text-lg font-medium text-foreground">4. Where data is stored</h2>
          <p>
            All personal data is stored in Indonesia, on infrastructure operated by us, in line
            with UU PDP Pasal 14. We do not transfer your data abroad.
          </p>

          <h2 className="!mt-8 font-serif text-lg font-medium text-foreground">5. Your rights</h2>
          <p>
            You may request access, correction, deletion, or portability of your data at any time
            by emailing{' '}
            <a href="mailto:privacy@competzy.com" className="text-primary hover:underline">
              privacy@competzy.com
            </a>
            . Some deletions are subject to the legal retention windows above.
          </p>

          <h2 className="!mt-8 font-serif text-lg font-medium text-foreground">
            6. Sharing with third parties
          </h2>
          <p>
            We share minimal data with payment processors (Midtrans), notification providers
            (Twilio, Expo Push, SMTP), and infrastructure providers strictly to deliver the
            service. We never sell your data.
          </p>

          <h2 className="!mt-8 font-serif text-lg font-medium text-foreground">7. Children</h2>
          <p>
            Most participants are minors. Registration requires parent or guardian consent for
            users under 13, and account ownership is in the parent’s name where required by law.
          </p>

          <h2 className="!mt-8 font-serif text-lg font-medium text-foreground">8. Contact</h2>
          <p>
            Data Protection Officer:{' '}
            <a href="mailto:privacy@competzy.com" className="text-primary hover:underline">
              privacy@competzy.com
            </a>
            . Postal: Competzy, [address pending].
          </p>
        </div>

        <p className="mt-12 text-xs text-muted-foreground">
          See also:{' '}
          <Link href="/terms" className="text-primary hover:underline">
            Terms of Service
          </Link>
        </p>
      </div>
    </div>
  );
}
