'use client';

import Link from 'next/link';

// Placeholder content. MUST be replaced by counsel before production launch.
// References UU PDP No. 27 of 2022 (Indonesia data protection law).

export default function PrivacyPage() {
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

      <h1 style={{ fontFamily: 'var(--ff-display)', fontSize: 32, marginTop: 24 }}>Privacy Policy</h1>
      <p style={{ color: 'var(--text-3)', fontSize: 13, fontFamily: 'var(--ff-mono)', marginBottom: 32 }}>
        Last reviewed: <em>pending legal review</em>
      </p>

      <p>
        Competzy (<em>"we", "us"</em>) is the platform you are using. This Privacy Policy
        explains how we collect, use, store, and protect personal data of platform users in
        compliance with the Personal Data Protection Law of Indonesia (UU PDP No. 27 / 2022).
      </p>

      <h2>1. Data we collect</h2>
      <ul>
        <li>Identity: full name, date of birth, email, phone number, city, school</li>
        <li>Education data: grade, NISN/NPSN, supervisor / parent contacts</li>
        <li>Documents you upload: student card, report card, photos</li>
        <li>Payment metadata: order ID, amount, gateway response (we do not store card numbers)</li>
        <li>Activity: which competitions you view, register for, and submit to</li>
      </ul>

      <h2>2. Lawful basis</h2>
      <p>
        We process the data above on the basis of (a) explicit consent given at signup,
        (b) performance of the contract to register you for competitions, and (c) legitimate
        interest in operating the platform and protecting it from abuse.
      </p>

      <h2>3. How long we keep data</h2>
      <ul>
        <li>Your account profile: while your account is active, plus 1 year after closure</li>
        <li>Uploaded documents: until 1 year after the related competition ends</li>
        <li>Audit logs of administrative actions: 5 years</li>
        <li>Payment records: per Indonesian tax law (typically 10 years)</li>
      </ul>

      <h2>4. Where data is stored</h2>
      <p>
        All personal data is stored in Indonesia, on infrastructure operated by us, in line
        with UU PDP Pasal 14. We do not transfer your data abroad.
      </p>

      <h2>5. Your rights</h2>
      <p>
        You may request access, correction, deletion, or portability of your data at any time
        by emailing <a href="mailto:privacy@competzy.com">privacy@competzy.com</a>. Some
        deletions are subject to legal retention windows above.
      </p>

      <h2>6. Sharing with third parties</h2>
      <p>
        We share minimal data with payment processors (Midtrans), notification providers
        (Twilio, Expo Push, SMTP), and infrastructure providers strictly to deliver service.
        We never sell your data.
      </p>

      <h2>7. Children</h2>
      <p>
        Most participants are minors. Registration requires parent or guardian consent for
        users under 13, and account ownership is in the parent's name where required by law.
      </p>

      <h2>8. Contact</h2>
      <p>
        Data Protection Officer: <a href="mailto:privacy@competzy.com">privacy@competzy.com</a>.
        Postal: Competzy, [address pending].
      </p>

      <p style={{ marginTop: 48, color: 'var(--text-3)', fontSize: 12 }}>
        See also: <Link href="/terms">Terms of Service</Link>
      </p>
    </div>
  );
}
