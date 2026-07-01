# Security Audit — 1 Juli 2026 (overnight run)

Scope: production server (read-only inspection, per policy no server changes were
made) + application level (fixes shipped in code). Auditor: Claude (overnight
autonomous run), verified with external port probes from an independent network.

## 🔴 CRITICAL — perlu tindakan devops segera

### 1. Semua port internal terbuka ke internet
Verified externally (TCP connect + HTTP from outside the server):

| Port | Service | Status dari internet |
|---|---|---|
| 3000 | competzy.com landing (container) | OPEN, HTTP 200 |
| 3010 | Competzy backend API | OPEN (bypass nginx/TLS) |
| 3011 | Arena web | OPEN, HTTP 200 (bypass TLS) |
| 4000 | pathvance tenant | OPEN |
| 8000 | **Coolify dashboard** | OPEN, login page reachable over plain HTTP |
| 6001 | Coolify realtime | OPEN |
| 9000 | MinIO S3 API | OPEN |
| 9001 | **MinIO console** | OPEN, HTTP 200 login page |
| 5432 | PostgreSQL | closed (baik — internal only) |

Dampak: dashboard Coolify + console MinIO (kendali penuh atas deploy + file
storage) terekspos publik lewat HTTP polos; trafik app bisa bypass TLS.
Catatan penting: **UFW saja tidak cukup** — Docker menulis aturan iptables
sendiri yang melewati UFW untuk published ports. Opsi fix (pilih salah satu):
1. **Cloud firewall di level provider** (paling sederhana): allow hanya 22, 80,
   443. Ini satu-satunya lapisan yang pasti menang atas Docker.
2. Ubah port mapping Coolify per-service menjadi bind `127.0.0.1:PORT` (Coolify
   "Ports Mappings" → `127.0.0.1:3010:3000`) sehingga hanya nginx yang bisa
   mengaksesnya. Perlu redeploy per service.
3. `DOCKER-USER` iptables chain rules (advanced).

### 2. SSH `PermitRootLogin yes`
Login root langsung via SSH diizinkan. Fix devops: set `PermitRootLogin no`
(atau `prohibit-password` bila root-key memang dipakai) di
`/etc/ssh/sshd_config` + `systemctl reload sshd`.

### 3. Tidak ada fail2ban / rate-limit SSH
Brute-force SSH tidak dimitigasi. Fix: `apt install fail2ban` (default jail
sshd sudah cukup).

## 🟡 MEDIUM

4. **nginx `server_tokens` masih default (on)** — versi nginx bocor di header
   + error pages. Fix: un-comment `server_tokens off;` di nginx.conf.
5. **9 paket security update pending** — unattended-upgrades aktif (baik),
   tapi reboot-required updates (kernel) butuh reboot manual berkala.
   Uptime 6 minggu; jadwalkan maintenance reboot.
6. **Kredensial dev fixtures di produksi** — `admin@eduversal.com/admin123`,
   `organizer123`, `manager123` (baru). Ganti semua lewat UI sebelum publik
   ramai. Super-admin email default juga `admin@eduversal.com`.

## ✅ Yang sudah SAYA PERBAIKI malam ini (level aplikasi, di kode)

- **Security headers** (sebelumnya nol):
  - Backend Express: `X-Powered-By` dimatikan; `Strict-Transport-Security`
    (prod), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
    `Referrer-Policy: strict-origin-when-cross-origin`.
  - Web Next.js: `poweredByHeader: false` + header set yang sama, dengan
    `X-Frame-Options: SAMEORIGIN` dan `Permissions-Policy`
    (`camera=(self)` — webcam proctoring ujian tetap jalan; mic + geolocation
    dimatikan).
- **Gate role portal admin di web** — sebelumnya context menerima siapa pun
  yang berrole admin saja tapi layout tidak me-redirect role lain ke portal
  mereka; kini (dashboard) menolak non-admin/manager dan mengarahkan ke home
  role masing-masing. Role `manager` baru dibatasi dari data finansial di
  backend (bukan cuma disembunyikan di UI).
- Fondasi yang sudah baik dan terverifikasi ulang: JWT httpOnly cookie
  (SameSite=Lax, Secure in prod), rate limiting di auth/OTP/reset, webhook
  Midtrans signature-verified + idempotent, audit log di semua privileged
  writes, soft-delete 401 di middleware, signed file URLs 15 menit.

## ⚪ Belum dilakukan (candidly) / rekomendasi lanjutan

- **Content-Security-Policy** di web — butuh kerja nonce/inline-script audit
  (TipTap, KaTeX, Midtrans Snap); jangan dipasang buru-buru karena bisa
  mematikan pembayaran. Rekomendasi: sprint tersendiri dengan report-only
  mode dulu (`Content-Security-Policy-Report-Only`).
- **Unsubscribe list untuk broadcast email** — v1 memakai mailto unsubscribe;
  untuk deliverability jangka panjang tambahkan tabel suppression + link
  one-click (RFC 8058).
- Rotasi kredensial Midtrans/Resend secara berkala; keduanya kini hanya ada
  di env Coolify (benar).
