# Laporan Overnight Run — 1→2 Juli 2026

Semua sudah **live di produksi** (arena.competzy.com + api.competzy.com),
di-commit ke `main`, migrasi ter-apply, dan di-smoke-test langsung di prod.

## 1. 🎨 Design system competzy.com diterapkan ke arena

- **Token diselaraskan 1:1 dengan competzy.com** (diekstrak dari CSS live
  landing): surface ivory hangat (light) + deep-ink `#0e0b14` (dark), aksen
  kategorikal indigo/pink/orange/gold/green/blue/lime, font display pindah
  dari Bricolage Grotesque ke **Plus Jakarta Sans** (persis landing, 1 font
  lebih ringan).
- **Bahasa motion landing di-port 1:1**: durasi 150/250/400/600ms, kurva
  ease-out-expo / ease-in-expo / ease-spring / ease-smooth, keyframes
  fade-up / slide-in / float / pulse-glow / shimmer / ambient-drift / drift,
  glow shadows brand. Semua jadi utility Tailwind (`animate-fade-up`,
  `ease-spring`, `shadow-brand`, `stagger-children`, `hover-lift`).
- **Animasi menjangkau SEMUA portal lewat komponen shared** (bukan per-halaman):
  - AppShell: transisi halaman fade-up di setiap navigasi, semua portal.
  - PageHeader: entrance judul + actions menyusul satu ketukan.
  - StatCard: dibangun ulang di palet landing + **angka count-up** (semua
    dashboard: admin, organizer, school, rep, question-bank).
  - Login: entrance berjenjang penuh + glow CTA + ambient drift di panel brand.
  - Dashboard admin: hero indigo landing, chart, rank tiles, quick-actions —
    palet cyan/lemon lama disapu habis; grid ber-stagger.
  - Confetti dipertahankan (partikelnya kini warna aksen landing).
  - `prefers-reduced-motion` dihormati global.
- **/design-system** diperbaiki: label hex stale (satu-satunya data hardcoded
  di seluruh web) kini sesuai token live + section Motion baru yang mendemokan
  semua animasi.
- Survey penuh mengonfirmasi: **tidak ada data display hardcoded lain** —
  semua stat live dari DB.

## 2. 👔 Role baru: MANAGER (staff panitia administratif)

- Login: `manager@eduversal.com` / `manager123` (**GANTI PASSWORD-NYA**).
- Dapat SEMUA operasional admin: kompetisi, registrasi (approve/reject),
  users, schools, verifikasi guru/sekolah, venues, flow editor, notifikasi,
  waitlist, country reps, segments, **email broadcast**.
- TIDAK dapat (ditegakkan di backend, bukan cuma disembunyikan):
  laporan revenue (403), angka uang di KPI/stats (di-redact null), refund
  (403), maintenance toggle, impersonation, workspace question-bank/commerce/
  marketing-operator.
- Sidebar manager otomatis menyembunyikan menu yang diblokir backend.
- Diverifikasi di PROD: login 200, /admin/users 200, KPI revenue null,
  revenue report 403.

## 3. 📧 Email Broadcast (seperti kirim.email) — LIVE

Menu: **Marketing → Email Broadcast** (`/broadcasts`) untuk admin + manager.
- Audiens LIVE dari DB: semua siswa (108 di prod) / orang tua / guru /
  semua user / **pendaftar per-kompetisi** (opsional hanya yang lunas) /
  **siswa pasif 12 bulan** (30 di prod). Hitungan penerima exact sebelum kirim.
- Composer rich-text (TipTap), personalisasi `{{name}}`, template email
  ber-branding Competzy (header indigo + footer unsubscribe).
- **Kirim uji ke inbox sendiri** dulu, lalu dialog konfirmasi menyebut jumlah
  penerima persis sebelum kirim beneran.
- Pengiriman via **Resend BATCH API** (SMTP_PASS-mu adalah API key — tanpa
  secret baru), background processor 15 detik × 90 email (≈360/menit),
  progres per-kampanye live di tabel riwayat, resumable kalau server restart,
  bisa cancel di tengah.
- Diuji end-to-end: test email terkirim + processor menuntaskan broadcast
  1 penerima via batch API (sent 1/1).

## 4. 🔐 Keamanan

**Diperbaiki di kode (live):**
- Security headers di backend + web (sebelumnya NOL): HSTS, nosniff,
  X-Frame-Options, Referrer-Policy, Permissions-Policy (camera=self supaya
  proctoring webcam ujian tetap jalan); X-Powered-By dihilangkan.
- Gate role portal admin di web + context menerima manager.

**⚠️ TEMUAN KRITIS DI SERVER — perlu devops, saya tidak mengubah server
(sesuai instruksimu "hanya laporkan"):** lihat `docs/SECURITY-AUDIT-2026-07-01.md`.
Ringkas: **semua port internal terbuka ke internet** (dashboard Coolify :8000,
console MinIO :9001, app port bypass TLS — diverifikasi dari jaringan luar),
`PermitRootLogin yes`, tanpa fail2ban. Fix tercepat: **cloud firewall
allow hanya 22/80/443** (UFW saja tidak cukup — Docker bypass UFW).

## 5. Yang perlu KAMU lakukan pagi ini

1. **Cek tampilannya**: hard-refresh (Cmd+Shift+R) arena.competzy.com —
   login, dashboard admin, /design-system, /broadcasts.
2. **Ganti password** `manager@eduversal.com` (dan admin/organizer yang masih
   password dev).
3. **Kirim broadcast percobaan** dari /broadcasts (test-send dulu ke emailmu).
4. **Teruskan temuan keamanan server ke devops** — terutama firewall.
   Ini yang paling penting dari semuanya.

## 6. Jujur: yang belum / trade-off

- Poles animasi bespoke per-halaman untuk seluruh ~70 halaman tidak realistis
  dalam satu malam; strateginya: sistem motion ditanam di komponen shared
  sehingga SEMUA halaman dapat transisi + entrance + count-up konsisten,
  lalu halaman kunci (login, dashboard admin, design-system) dipoles tangan.
  Halaman lain sudah "ikut sistem" — kandidat poles tangan berikutnya:
  katalog /competitions (hero), dashboard kompetisi siswa (hero per-brand).
- CSP penuh belum dipasang (berisiko mematikan Midtrans Snap/KaTeX bila
  terburu-buru) — rencana report-only dulu ada di security audit.
- Broadcast unsubscribe masih mailto (v1); suppression list + one-click
  (RFC 8058) direkomendasikan sebelum kampanye massal rutin.
- Header keamanan web dipasang dua lapis (next.config + middleware) karena
  respons prerender-cache di prod terpantau melewati config-level headers.

## Commits malam ini (urut)
`4bb3ac3` fondasi design system + motion → `4a122c5` login showcase +
design-system page → `bec7ccb`+`72bc9e4` manager role → `40f4485` email
broadcast → `1287d0d` security headers + audit → `b5f7876` middleware headers.
