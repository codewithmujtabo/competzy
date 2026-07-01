'use client';

// Privacy Policy. Bilingual (EN/ID) via the shared locale toggle.
// References UU PDP No. 27 of 2022 (Indonesia data protection law).

import { Fragment, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PublicToggles } from '@/components/shell/public-toggles';
import { useLocale } from '@/lib/i18n/context';

const EMAIL = 'competzy@eduversal.org';
const H = '!mt-8 font-serif text-lg font-medium text-foreground';

function mailLink() {
  return (
    <a href={`mailto:${EMAIL}`} className="text-primary hover:underline">
      {EMAIL}
    </a>
  );
}

interface Copy {
  back: string;
  title: string;
  updated: string;
  intro: ReactNode;
  sections: { h: string; body: ReactNode }[];
  seeAlso: string;
  seeAlsoLink: string;
}

const EN: Copy = {
  back: 'Back',
  title: 'Privacy Policy',
  updated: 'Last updated: 1 July 2026',
  intro: (
    <p>
      Competzy (&ldquo;we&rdquo;, &ldquo;us&rdquo;) is the platform you are using. This Privacy
      Policy explains how we collect, use, store, and protect personal data of platform users in
      compliance with the Personal Data Protection Law of Indonesia (UU PDP No. 27 / 2022).
    </p>
  ),
  sections: [
    {
      h: '1. Data we collect',
      body: (
        <ul className="list-disc space-y-1 pl-5">
          <li>Identity: full name, date of birth, email, phone number, city, school</li>
          <li>Education data: grade, NISN/NPSN, supervisor / parent contacts</li>
          <li>Documents you upload: student card, report card, photos</li>
          <li>Payment metadata: order ID, amount, gateway response (we do not store card numbers)</li>
          <li>Activity: which competitions you view, register for, and submit to</li>
        </ul>
      ),
    },
    {
      h: '2. Lawful basis',
      body: (
        <p>
          We process the data above on the basis of (a) explicit consent given at signup,
          (b) performance of the contract to register you for competitions, and (c) legitimate
          interest in operating the platform and protecting it from abuse.
        </p>
      ),
    },
    {
      h: '3. How long we keep data',
      body: (
        <ul className="list-disc space-y-1 pl-5">
          <li>Your account profile: while your account is active, plus 1 year after closure</li>
          <li>Uploaded documents: until 1 year after the related competition ends</li>
          <li>Audit logs of administrative actions: 5 years</li>
          <li>Payment records: per Indonesian tax law (typically 10 years)</li>
        </ul>
      ),
    },
    {
      h: '4. Where data is stored',
      body: (
        <p>
          All personal data is stored in Indonesia, on infrastructure operated by us, in line with
          UU PDP Pasal 14. We do not transfer your data abroad.
        </p>
      ),
    },
    {
      h: '5. Your rights',
      body: (
        <p>
          You may request access, correction, deletion, or portability of your data at any time by
          emailing {mailLink()}. Some deletions are subject to the legal retention windows above.
        </p>
      ),
    },
    {
      h: '6. Sharing with third parties',
      body: (
        <p>
          We share minimal data with payment processors (Midtrans), notification providers (Twilio,
          Expo Push, SMTP), and infrastructure providers strictly to deliver the service. We never
          sell your data.
        </p>
      ),
    },
    {
      h: '7. Children',
      body: (
        <p>
          Most participants are minors. Registration requires parent or guardian consent for users
          under 13, and account ownership is in the parent&rsquo;s name where required by law.
        </p>
      ),
    },
    {
      h: '8. Contact',
      body: <p>Data Protection Officer: {mailLink()}.</p>,
    },
  ],
  seeAlso: 'See also: ',
  seeAlsoLink: 'Terms of Service',
};

const ID: Copy = {
  back: 'Kembali',
  title: 'Kebijakan Privasi',
  updated: 'Terakhir diperbarui: 1 Juli 2026',
  intro: (
    <p>
      Competzy (&ldquo;kami&rdquo;) adalah platform yang Anda gunakan. Kebijakan Privasi ini
      menjelaskan cara kami mengumpulkan, menggunakan, menyimpan, dan melindungi data pribadi
      pengguna platform sesuai dengan Undang-Undang Pelindungan Data Pribadi Indonesia (UU PDP No.
      27 Tahun 2022).
    </p>
  ),
  sections: [
    {
      h: '1. Data yang kami kumpulkan',
      body: (
        <ul className="list-disc space-y-1 pl-5">
          <li>Identitas: nama lengkap, tanggal lahir, email, nomor telepon, kota, sekolah</li>
          <li>Data pendidikan: kelas, NISN/NPSN, kontak pendamping / orang tua</li>
          <li>Dokumen yang Anda unggah: kartu pelajar, rapor, foto</li>
          <li>Metadata pembayaran: ID pesanan, jumlah, respons gateway (kami tidak menyimpan nomor kartu)</li>
          <li>Aktivitas: kompetisi yang Anda lihat, ikuti, dan kirimi jawaban</li>
        </ul>
      ),
    },
    {
      h: '2. Dasar hukum',
      body: (
        <p>
          Kami memproses data di atas berdasarkan (a) persetujuan eksplisit yang diberikan saat
          pendaftaran, (b) pelaksanaan kontrak untuk mendaftarkan Anda ke kompetisi, dan (c)
          kepentingan yang sah dalam mengoperasikan platform serta melindunginya dari
          penyalahgunaan.
        </p>
      ),
    },
    {
      h: '3. Berapa lama kami menyimpan data',
      body: (
        <ul className="list-disc space-y-1 pl-5">
          <li>Profil akun Anda: selama akun aktif, ditambah 1 tahun setelah ditutup</li>
          <li>Dokumen yang diunggah: hingga 1 tahun setelah kompetisi terkait berakhir</li>
          <li>Log audit tindakan administratif: 5 tahun</li>
          <li>Catatan pembayaran: sesuai hukum pajak Indonesia (umumnya 10 tahun)</li>
        </ul>
      ),
    },
    {
      h: '4. Di mana data disimpan',
      body: (
        <p>
          Seluruh data pribadi disimpan di Indonesia, pada infrastruktur yang kami operasikan,
          sesuai UU PDP Pasal 14. Kami tidak mentransfer data Anda ke luar negeri.
        </p>
      ),
    },
    {
      h: '5. Hak Anda',
      body: (
        <p>
          Anda dapat meminta akses, koreksi, penghapusan, atau portabilitas data Anda kapan saja
          dengan mengirim email ke {mailLink()}. Beberapa penghapusan tunduk pada jangka waktu
          retensi hukum di atas.
        </p>
      ),
    },
    {
      h: '6. Berbagi dengan pihak ketiga',
      body: (
        <p>
          Kami berbagi data seminimal mungkin dengan pemroses pembayaran (Midtrans), penyedia
          notifikasi (Twilio, Expo Push, SMTP), dan penyedia infrastruktur semata-mata untuk
          menyediakan layanan. Kami tidak pernah menjual data Anda.
        </p>
      ),
    },
    {
      h: '7. Anak-anak',
      body: (
        <p>
          Sebagian besar peserta adalah anak di bawah umur. Pendaftaran memerlukan persetujuan orang
          tua atau wali untuk pengguna di bawah 13 tahun, dan kepemilikan akun atas nama orang tua
          jika diwajibkan oleh hukum.
        </p>
      ),
    },
    {
      h: '8. Kontak',
      body: <p>Petugas Pelindungan Data (Data Protection Officer): {mailLink()}.</p>,
    },
  ],
  seeAlso: 'Lihat juga: ',
  seeAlsoLink: 'Ketentuan Layanan',
};

export default function PrivacyPage() {
  const { locale } = useLocale();
  const c = locale === 'id' ? ID : EN;

  return (
    <div className="min-h-screen bg-background">
      <PublicToggles />
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 font-mono text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          {c.back}
        </Link>

        <h1 className="mt-8 font-serif text-3xl font-medium text-foreground">{c.title}</h1>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{c.updated}</p>

        <div className="mt-6 space-y-2 text-sm leading-relaxed text-muted-foreground">
          {c.intro}
          {c.sections.map((s) => (
            <Fragment key={s.h}>
              <h2 className={H}>{s.h}</h2>
              {s.body}
            </Fragment>
          ))}
        </div>

        <p className="mt-12 text-xs text-muted-foreground">
          {c.seeAlso}
          <Link href="/terms" className="text-primary hover:underline">
            {c.seeAlsoLink}
          </Link>
        </p>
      </div>
    </div>
  );
}
