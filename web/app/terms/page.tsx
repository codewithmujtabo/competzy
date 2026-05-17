import Link from 'next/link';
import { ArrowLeft, TriangleAlert } from 'lucide-react';

// Placeholder content. MUST be replaced by counsel before production launch.

export default function TermsPage() {
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

        <h1 className="mt-8 font-serif text-3xl font-medium text-foreground">Terms of Service</h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">
          Last reviewed: <em>pending legal review</em>
        </p>

        <div className="mt-6 space-y-2 text-sm leading-relaxed text-muted-foreground">
          <h2 className="font-serif text-lg font-medium text-foreground">1. Who we are</h2>
          <p>
            Competzy is a platform that lets students discover and register for academic
            competitions in Indonesia and abroad.
          </p>

          <h2 className="!mt-8 font-serif text-lg font-medium text-foreground">2. Eligibility</h2>
          <p>
            You may use Competzy if you are at least 13 years old, or younger with the consent and
            oversight of a parent or legal guardian, and provided your participation does not
            violate the rules of any competition you register for.
          </p>

          <h2 className="!mt-8 font-serif text-lg font-medium text-foreground">3. Accounts</h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>One account per person. Sharing credentials is grounds for suspension.</li>
            <li>You are responsible for keeping your password and OTP codes secret.</li>
            <li>Information you provide must be accurate and current.</li>
          </ul>

          <h2 className="!mt-8 font-serif text-lg font-medium text-foreground">4. Payments</h2>
          <p>
            Competition fees are payable via the payment methods displayed at checkout. All
            payments are final unless explicitly stated otherwise by the competition organiser.
            Refunds, where permitted, are issued back to the original payment method.
          </p>

          <h2 className="!mt-8 font-serif text-lg font-medium text-foreground">
            5. Conduct during competitions
          </h2>
          <ul className="list-disc space-y-1 pl-5">
            <li>You agree to follow each organiser’s rules in good faith.</li>
            <li>
              Cheating, plagiarism, or attempts to manipulate results may result in
              disqualification and account termination.
            </li>
            <li>
              Webcam recordings (where applicable) are reviewed solely for proctoring purposes and
              retained per the Privacy Policy.
            </li>
          </ul>

          <h2 className="!mt-8 font-serif text-lg font-medium text-foreground">
            6. Suspension and termination
          </h2>
          <p>
            We may suspend or terminate accounts that breach these Terms or the rules of a
            competition. Where suspension is precautionary, we will state the reason and the
            process for appeal.
          </p>

          <h2 className="!mt-8 font-serif text-lg font-medium text-foreground">7. Liability</h2>
          <p>
            Competzy is provided as-is. We are not the organiser of competitions listed on the
            platform unless explicitly stated. Competition outcomes and prizes are determined by
            the organisers.
          </p>

          <h2 className="!mt-8 font-serif text-lg font-medium text-foreground">
            8. Changes to these Terms
          </h2>
          <p>
            We may update these Terms from time to time. Material changes will be announced in the
            app and by email at least 7 days before they take effect.
          </p>

          <h2 className="!mt-8 font-serif text-lg font-medium text-foreground">9. Governing law</h2>
          <p>
            These Terms are governed by the laws of the Republic of Indonesia. Any disputes will be
            resolved in the courts of Jakarta Selatan unless required otherwise.
          </p>

          <h2 className="!mt-8 font-serif text-lg font-medium text-foreground">10. Contact</h2>
          <p>
            Questions:{' '}
            <a href="mailto:legal@competzy.com" className="text-primary hover:underline">
              legal@competzy.com
            </a>
            .
          </p>
        </div>

        <p className="mt-12 text-xs text-muted-foreground">
          See also:{' '}
          <Link href="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}
