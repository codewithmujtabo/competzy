'use client';

// Help center. Bilingual (EN/ID) via the shared locale toggle, mirroring the
// privacy/terms public-page pattern. FAQ is static; the contact form POSTs to
// the public backend route POST /api/contact (stores + emails support).

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronDown, Send, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { PublicToggles } from '@/components/shell/public-toggles';
import { useLocale } from '@/lib/i18n/context';
import { adminHttp } from '@/lib/api/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

const EMAIL = 'competzy@eduversal.org';
const H = '!mt-8 font-serif text-lg font-medium text-foreground';
const TEXTAREA_CLS =
  'flex min-h-36 w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50';

interface Faq {
  q: string;
  a: string;
}

interface Copy {
  back: string;
  title: string;
  subtitle: string;
  faqHeading: string;
  faqs: Faq[];
  contactHeading: string;
  contactBody: string;
  nameLabel: string;
  emailLabel: string;
  subjectLabel: string;
  subjectOptional: string;
  messageLabel: string;
  send: string;
  sending: string;
  emailInvalid: string;
  sentTitle: string;
  sentBody: string;
  sentAgain: string;
  errorGeneric: string;
  orEmailPre: string;
  seeAlso: string;
  privacy: string;
  terms: string;
}

const EN: Copy = {
  back: 'Back',
  title: 'Help center',
  subtitle: 'Answers to common questions, and a direct line to our team.',
  faqHeading: 'Frequently asked questions',
  faqs: [
    {
      q: 'Do I need an account to join a competition?',
      a: 'Yes. One free Competzy account lets you register for any competition on the platform, national or international. Create it once and reuse it every year.',
    },
    {
      q: 'How do I create an account?',
      a: 'Click Sign up on the home page, enter your email, and verify it with the code we send. Students under 13 register with a parent or guardian.',
    },
    {
      q: 'How do I register for a competition?',
      a: 'Sign in, open the competition you want from your dashboard, and follow the registration steps. You can track every entry under My Registrations.',
    },
    {
      q: 'Is there a fee, and how do I pay?',
      a: 'Some competitions are free and some charge an entry fee, shown before you confirm. Payment is handled securely in-app through our payment partner, Midtrans.',
    },
    {
      q: 'Where do I see my results?',
      a: 'Results appear under Results in your dashboard once the organizer publishes them. You will also receive a notification.',
    },
    {
      q: 'How do I download my certificate?',
      a: 'Open Certificates in your dashboard. Available certificates can be viewed and downloaded as a PDF at any time.',
    },
    {
      q: 'Can a school register many students at once?',
      a: 'Yes. School accounts can add students and use bulk registration and bulk payment. Message us below if you manage a group and need a school account.',
    },
    {
      q: 'I forgot my password or cannot sign in.',
      a: 'Use Forgot password on the sign-in screen to reset it by email. If you are still stuck, send us a message below.',
    },
  ],
  contactHeading: 'Contact us',
  contactBody: 'Cannot find what you need? Send us a message and we will get back to you by email.',
  nameLabel: 'Your name',
  emailLabel: 'Email',
  subjectLabel: 'Subject',
  subjectOptional: '(optional)',
  messageLabel: 'Message',
  send: 'Send message',
  sending: 'Sending...',
  emailInvalid: 'Enter a valid email address.',
  sentTitle: 'Message sent',
  sentBody: 'Thanks for reaching out. We will reply to your email as soon as we can.',
  sentAgain: 'Send another message',
  errorGeneric: 'Could not send your message. Please try again.',
  orEmailPre: 'Or email us directly at ',
  seeAlso: 'See also: ',
  privacy: 'Privacy Policy',
  terms: 'Terms of Service',
};

const ID: Copy = {
  back: 'Kembali',
  title: 'Pusat bantuan',
  subtitle: 'Jawaban untuk pertanyaan umum, dan jalur langsung ke tim kami.',
  faqHeading: 'Pertanyaan yang sering diajukan',
  faqs: [
    {
      q: 'Apakah saya perlu akun untuk ikut kompetisi?',
      a: 'Ya. Satu akun Competzy gratis bisa dipakai mendaftar ke semua kompetisi di platform, nasional maupun internasional. Buat sekali, pakai setiap tahun.',
    },
    {
      q: 'Bagaimana cara membuat akun?',
      a: 'Klik Daftar di halaman utama, masukkan email, lalu verifikasi dengan kode yang kami kirim. Pelajar di bawah 13 tahun mendaftar bersama orang tua atau wali.',
    },
    {
      q: 'Bagaimana cara mendaftar kompetisi?',
      a: 'Masuk ke akun, buka kompetisi yang kamu mau dari dashboard, lalu ikuti langkah pendaftaran. Semua pendaftaran bisa dipantau di menu Pendaftaran.',
    },
    {
      q: 'Apakah ada biaya, dan bagaimana membayarnya?',
      a: 'Sebagian kompetisi gratis dan sebagian memungut biaya yang ditampilkan sebelum kamu mengonfirmasi. Pembayaran diproses aman di dalam aplikasi melalui mitra pembayaran kami, Midtrans.',
    },
    {
      q: 'Di mana saya melihat hasil?',
      a: 'Hasil muncul di menu Hasil pada dashboard setelah panitia menerbitkannya. Kamu juga akan mendapat notifikasi.',
    },
    {
      q: 'Bagaimana cara mengunduh sertifikat?',
      a: 'Buka menu Sertifikat di dashboard. Sertifikat yang tersedia bisa dilihat dan diunduh sebagai PDF kapan saja.',
    },
    {
      q: 'Apakah sekolah bisa mendaftarkan banyak siswa sekaligus?',
      a: 'Bisa. Akun sekolah dapat menambahkan siswa serta memakai pendaftaran dan pembayaran massal. Kirim pesan ke kami di bawah jika kamu mengelola grup dan butuh akun sekolah.',
    },
    {
      q: 'Saya lupa kata sandi atau tidak bisa masuk.',
      a: 'Gunakan Lupa kata sandi di layar masuk untuk mengatur ulang lewat email. Jika masih terkendala, kirim pesan ke kami di bawah.',
    },
  ],
  contactHeading: 'Hubungi kami',
  contactBody: 'Tidak menemukan yang kamu cari? Kirim pesan dan kami akan membalas lewat email.',
  nameLabel: 'Nama kamu',
  emailLabel: 'Email',
  subjectLabel: 'Subjek',
  subjectOptional: '(opsional)',
  messageLabel: 'Pesan',
  send: 'Kirim pesan',
  sending: 'Mengirim...',
  emailInvalid: 'Masukkan alamat email yang valid.',
  sentTitle: 'Pesan terkirim',
  sentBody: 'Terima kasih sudah menghubungi kami. Kami akan membalas ke email kamu secepatnya.',
  sentAgain: 'Kirim pesan lain',
  errorGeneric: 'Tidak dapat mengirim pesan. Silakan coba lagi.',
  orEmailPre: 'Atau email langsung ke ',
  seeAlso: 'Lihat juga: ',
  privacy: 'Kebijakan Privasi',
  terms: 'Ketentuan Layanan',
};

export default function HelpPage() {
  const { locale } = useLocale();
  const c = locale === 'id' ? ID : EN;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const canSubmit =
    name.trim().length > 0 && emailValid && message.trim().length > 0 && !submitting;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await adminHttp.post('/contact', {
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim() || undefined,
        message: message.trim(),
      });
      setSent(true);
      toast.success(c.sentTitle);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : c.errorGeneric);
    } finally {
      setSubmitting(false);
    }
  }

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
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{c.subtitle}</p>

        {/* FAQ */}
        <h2 className={H}>{c.faqHeading}</h2>
        <div className="mt-3 border-t border-border">
          {c.faqs.map((f) => (
            <details key={f.q} className="group border-b border-border">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-serif text-base font-medium text-foreground [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="pb-4 pr-8 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>

        {/* Contact */}
        <h2 className={H}>{c.contactHeading}</h2>
        {sent ? (
          <div className="mt-3 flex items-start gap-3 rounded-xl border border-border bg-card p-5">
            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
            <div>
              <p className="font-serif text-base font-medium text-foreground">{c.sentTitle}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{c.sentBody}</p>
              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setSubject('');
                  setMessage('');
                }}
                className="mt-3 text-sm font-medium text-primary hover:underline"
              >
                {c.sentAgain}
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.contactBody}</p>
            <form onSubmit={submit} noValidate className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="c-name" className="mb-1.5 text-xs text-muted-foreground">
                    {c.nameLabel}
                  </Label>
                  <Input
                    id="c-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="c-email" className="mb-1.5 text-xs text-muted-foreground">
                    {c.emailLabel}
                  </Label>
                  <Input
                    id="c-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    aria-invalid={email.length > 0 && !emailValid}
                  />
                  {email.length > 0 && !emailValid && (
                    <p className="mt-1 text-xs text-destructive">{c.emailInvalid}</p>
                  )}
                </div>
              </div>
              <div>
                <Label htmlFor="c-subject" className="mb-1.5 text-xs text-muted-foreground">
                  {c.subjectLabel}{' '}
                  <span className="text-muted-foreground/70">{c.subjectOptional}</span>
                </Label>
                <Input
                  id="c-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="c-message" className="mb-1.5 text-xs text-muted-foreground">
                  {c.messageLabel}
                </Label>
                <textarea
                  id="c-message"
                  className={TEXTAREA_CLS}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" size="lg" className="w-full sm:w-auto" disabled={!canSubmit}>
                {submitting ? c.sending : c.send}
                {!submitting && <Send className="size-4" />}
              </Button>
            </form>
            <p className="mt-5 text-xs text-muted-foreground">
              {c.orEmailPre}
              <a href={`mailto:${EMAIL}`} className="text-primary hover:underline">
                {EMAIL}
              </a>
              .
            </p>
          </>
        )}

        <p className="mt-12 text-xs text-muted-foreground">
          {c.seeAlso}
          <Link href="/privacy" className="text-primary hover:underline">
            {c.privacy}
          </Link>
          {' · '}
          <Link href="/terms" className="text-primary hover:underline">
            {c.terms}
          </Link>
        </p>
      </div>
    </div>
  );
}
