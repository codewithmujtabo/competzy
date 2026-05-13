'use client';

import Link from 'next/link';

// Placeholder content. MUST be replaced by counsel before production launch.

export default function TermsPage() {
  return (
    <div style={{
      maxWidth: 760,
      margin: '0 auto',
      padding: '48px 24px',
      lineHeight: 1.65,
      color: 'var(--text-1)',
    }}>
      <Link href="/" style={{ color: 'var(--text-3)', fontSize: 13 }}>← Back</Link>

      <div role="alert" style={{
        marginTop: 16,
        padding: '14px 18px',
        background: '#FEF3C7',
        border: '1px solid #F59E0B',
        borderRadius: 8,
        color: '#78350F',
        fontSize: 14,
        fontWeight: 600,
        lineHeight: 1.5,
      }}>
        ⚠ DRAFT — NOT FOR PRODUCTION
        <div style={{ fontWeight: 400, marginTop: 4 }}>
          This document has not been reviewed by counsel. It must not be relied on as legal terms until reviewed and approved.
        </div>
      </div>

      <h1 style={{ fontFamily: 'var(--ff-display)', fontSize: 32, marginTop: 24 }}>Terms of Service</h1>
      <p style={{ color: 'var(--text-3)', fontSize: 13, fontFamily: 'var(--ff-mono)', marginBottom: 32 }}>
        Last reviewed: <em>pending legal review</em>
      </p>

      <h2>1. Who we are</h2>
      <p>
        Competzy is a platform that lets students discover and register for academic
        competitions in Indonesia and abroad.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        You may use Competzy if you are at least 13 years old, or younger with the consent and
        oversight of a parent or legal guardian, and provided your participation does not
        violate the rules of any competition you register for.
      </p>

      <h2>3. Accounts</h2>
      <ul>
        <li>One account per person. Sharing credentials is grounds for suspension.</li>
        <li>You are responsible for keeping your password and OTP codes secret.</li>
        <li>Information you provide must be accurate and current.</li>
      </ul>

      <h2>4. Payments</h2>
      <p>
        Competition fees are payable via the payment methods displayed at checkout. All
        payments are final unless explicitly stated otherwise by the competition organiser.
        Refunds, where permitted, are issued back to the original payment method.
      </p>

      <h2>5. Conduct during competitions</h2>
      <ul>
        <li>You agree to follow each organiser's rules in good faith.</li>
        <li>Cheating, plagiarism, or attempts to manipulate results may result in disqualification and account termination.</li>
        <li>Webcam recordings (where applicable) are reviewed solely for proctoring purposes and retained per the Privacy Policy.</li>
      </ul>

      <h2>6. Suspension and termination</h2>
      <p>
        We may suspend or terminate accounts that breach these Terms or the rules of a
        competition. Where suspension is precautionary, we will state the reason and the
        process for appeal.
      </p>

      <h2>7. Liability</h2>
      <p>
        Competzy is provided as-is. We are not the organiser of competitions listed on the
        platform unless explicitly stated. Competition outcomes and prizes are determined
        by the organisers.
      </p>

      <h2>8. Changes to these Terms</h2>
      <p>
        We may update these Terms from time to time. Material changes will be announced in
        the app and by email at least 7 days before they take effect.
      </p>

      <h2>9. Governing law</h2>
      <p>
        These Terms are governed by the laws of the Republic of Indonesia. Any disputes
        will be resolved in the courts of Jakarta Selatan unless required otherwise.
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions: <a href="mailto:legal@competzy.com">legal@competzy.com</a>.
      </p>

      <p style={{ marginTop: 48, color: 'var(--text-3)', fontSize: 12 }}>
        See also: <Link href="/privacy">Privacy Policy</Link>
      </p>
    </div>
  );
}
