'use client';

// Terms of Service. Bilingual (EN/ID) via the shared locale toggle.

import { Fragment, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PublicToggles } from '@/components/shell/public-toggles';
import { useLocale } from '@/lib/i18n/context';

const EMAIL = 'competzy@eduversal.org';
const H = '!mt-8 font-serif text-lg font-medium text-foreground';
const H_FIRST = 'font-serif text-lg font-medium text-foreground';

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
  sections: { h: string; body: ReactNode }[];
  seeAlso: string;
  seeAlsoLink: string;
}

const EN: Copy = {
  back: 'Back',
  title: 'Terms of Service',
  updated: 'Last updated: 1 July 2026',
  sections: [
    {
      h: '1. Who we are',
      body: (
        <p>
          Competzy is a platform that lets students discover and register for academic competitions
          in Indonesia and abroad.
        </p>
      ),
    },
    {
      h: '2. Eligibility',
      body: (
        <p>
          You may use Competzy if you are at least 13 years old, or younger with the consent and
          oversight of a parent or legal guardian, and provided your participation does not violate
          the rules of any competition you register for.
        </p>
      ),
    },
    {
      h: '3. Accounts',
      body: (
        <ul className="list-disc space-y-1 pl-5">
          <li>One account per person. Sharing credentials is grounds for suspension.</li>
          <li>You are responsible for keeping your password and OTP codes secret.</li>
          <li>Information you provide must be accurate and current.</li>
        </ul>
      ),
    },
    {
      h: '4. Payments',
      body: (
        <p>
          Competition fees are payable via the payment methods displayed at checkout. All payments
          are final unless explicitly stated otherwise by the competition organiser. Refunds, where
          permitted, are issued back to the original payment method.
        </p>
      ),
    },
    {
      h: '5. Conduct during competitions',
      body: (
        <ul className="list-disc space-y-1 pl-5">
          <li>You agree to follow each organiser&rsquo;s rules in good faith.</li>
          <li>
            Cheating, plagiarism, or attempts to manipulate results may result in disqualification
            and account termination.
          </li>
          <li>
            Webcam recordings (where applicable) are reviewed solely for proctoring purposes and
            retained per the Privacy Policy.
          </li>
        </ul>
      ),
    },
    {
      h: '6. Suspension and termination',
      body: (
        <p>
          We may suspend or terminate accounts that breach these Terms or the rules of a
          competition. Where suspension is precautionary, we will state the reason and the process
          for appeal.
        </p>
      ),
    },
    {
      h: '7. Liability',
      body: (
        <p>
          Competzy is provided as is. We are not the organiser of competitions listed on the
          platform unless explicitly stated. Competition outcomes and prizes are determined by the
          organisers.
        </p>
      ),
    },
    {
      h: '8. Changes to these Terms',
      body: (
        <p>
          We may update these Terms from time to time. Material changes will be announced in the app
          and by email at least 7 days before they take effect.
        </p>
      ),
    },
    {
      h: '9. Governing law',
      body: (
        <p>
          These Terms are governed by the laws of the Republic of Indonesia. Any disputes will be
          resolved in the courts of Jakarta Selatan unless required otherwise.
        </p>
      ),
    },
    {
      h: '10. Contact',
      body: <p>Questions: {mailLink()}.</p>,
    },
  ],
  seeAlso: 'See also: ',
  seeAlsoLink: 'Privacy Policy',
};

const ID: Copy = {
  back: 'Kembali',
  title: 'Ketentuan Layanan',
  updated: 'Terakhir diperbarui: 1 Juli 2026',
  sections: [
    {
      h: '1. Siapa kami',
      body: (
        <p>
          Competzy adalah platform yang memungkinkan siswa menemukan dan mendaftar kompetisi
          akademik di Indonesia dan luar negeri.
        </p>
      ),
    },
    {
      h: '2. Kelayakan',
      body: (
        <p>
          Anda dapat menggunakan Competzy jika berusia minimal 13 tahun, atau lebih muda dengan
          persetujuan dan pengawasan orang tua atau wali yang sah, serta selama partisipasi Anda
          tidak melanggar aturan kompetisi yang Anda ikuti.
        </p>
      ),
    },
    {
      h: '3. Akun',
      body: (
        <ul className="list-disc space-y-1 pl-5">
          <li>Satu akun per orang. Berbagi kredensial dapat menyebabkan penangguhan.</li>
          <li>Anda bertanggung jawab menjaga kerahasiaan kata sandi dan kode OTP Anda.</li>
          <li>Informasi yang Anda berikan harus akurat dan terkini.</li>
        </ul>
      ),
    },
    {
      h: '4. Pembayaran',
      body: (
        <p>
          Biaya kompetisi dibayarkan melalui metode pembayaran yang ditampilkan saat checkout. Semua
          pembayaran bersifat final kecuali dinyatakan lain secara eksplisit oleh penyelenggara
          kompetisi. Pengembalian dana, jika diizinkan, dikembalikan ke metode pembayaran semula.
        </p>
      ),
    },
    {
      h: '5. Perilaku selama kompetisi',
      body: (
        <ul className="list-disc space-y-1 pl-5">
          <li>Anda setuju mengikuti aturan setiap penyelenggara dengan itikad baik.</li>
          <li>
            Kecurangan, plagiarisme, atau upaya memanipulasi hasil dapat mengakibatkan diskualifikasi
            dan penghentian akun.
          </li>
          <li>
            Rekaman webcam (jika berlaku) ditinjau semata-mata untuk keperluan pengawasan ujian dan
            disimpan sesuai Kebijakan Privasi.
          </li>
        </ul>
      ),
    },
    {
      h: '6. Penangguhan dan penghentian',
      body: (
        <p>
          Kami dapat menangguhkan atau menghentikan akun yang melanggar Ketentuan ini atau aturan
          suatu kompetisi. Jika penangguhan bersifat pencegahan, kami akan menyampaikan alasannya dan
          proses untuk mengajukan banding.
        </p>
      ),
    },
    {
      h: '7. Tanggung jawab',
      body: (
        <p>
          Competzy disediakan sebagaimana adanya. Kami bukan penyelenggara kompetisi yang tercantum
          di platform kecuali dinyatakan secara eksplisit. Hasil dan hadiah kompetisi ditentukan oleh
          penyelenggara.
        </p>
      ),
    },
    {
      h: '8. Perubahan Ketentuan',
      body: (
        <p>
          Kami dapat memperbarui Ketentuan ini dari waktu ke waktu. Perubahan material akan
          diumumkan di aplikasi dan melalui email setidaknya 7 hari sebelum berlaku.
        </p>
      ),
    },
    {
      h: '9. Hukum yang berlaku',
      body: (
        <p>
          Ketentuan ini diatur oleh hukum Republik Indonesia. Setiap sengketa akan diselesaikan di
          pengadilan Jakarta Selatan kecuali diwajibkan lain.
        </p>
      ),
    },
    {
      h: '10. Kontak',
      body: <p>Pertanyaan: {mailLink()}.</p>,
    },
  ],
  seeAlso: 'Lihat juga: ',
  seeAlsoLink: 'Kebijakan Privasi',
};

export default function TermsPage() {
  const { locale } = useLocale();
  const c = locale === 'id' ? ID : EN;

  return (
    <div className="min-h-screen">
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
          {c.sections.map((s, i) => (
            <Fragment key={s.h}>
              <h2 className={i === 0 ? H_FIRST : H}>{s.h}</h2>
              {s.body}
            </Fragment>
          ))}
        </div>

        <p className="mt-12 text-xs text-muted-foreground">
          {c.seeAlso}
          <Link href="/privacy" className="text-primary hover:underline">
            {c.seeAlsoLink}
          </Link>
        </p>
      </div>
    </div>
  );
}
