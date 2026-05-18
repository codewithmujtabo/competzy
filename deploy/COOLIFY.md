# Deploy Competzy ke Coolify

Panduan ini mendeploy dua service web Competzy ke server Coolify:

| Service        | Tipe Coolify | Image / Dockerfile     | Internal port | Domain publik             |
| -------------- | ------------ | ---------------------- | ------------- | ------------------------- |
| PostgreSQL     | Database     | `postgres:16-alpine`   | `5432`        | — (internal only)         |
| MinIO          | Service      | `minio/minio`          | `9000` / `9001` | `https://minio.arena.competzy.com` |
| `backend/`     | Application  | `backend/Dockerfile`   | `3000`        | `https://api.competzy.com` |
| `web/`         | Application  | `web/Dockerfile`       | `3001`        | `https://arena.competzy.com` |

> `app/` (Expo React Native) **tidak** di-deploy ke Coolify — mobile binary di-build
> via EAS Build (`eas build --profile production`) dari laptop. Landing page
> `competzy.com` ada di repo terpisah (`eduversal-team/competzy-web`).

---

## 0. Prasyarat

- Server sudah ter-connect ke Coolify (v4+).
- DNS sudah diarahkan ke IP server:
  - `api.competzy.com` → A record
  - `arena.competzy.com` → A record
  - `minio.arena.competzy.com` → A record (untuk public MinIO endpoint)
- Akses repo `eduversal-team/competzy` (public sekarang; nanti kalau private,
  tambah deploy key di Coolify → Sources → GitHub App).

---

## 1. Buat Project

Coolify UI → **Projects → + New Project**
- Name: `competzy`
- Environment: `production`

---

## 2. Provision PostgreSQL

Inside project → **+ New Resource → Database → PostgreSQL 16**
- Name: `competzy-postgres`
- Database name: `competzy`
- Public: **OFF** (akses hanya dari docker network)

Setelah running, klik service → tab **Environment** → copy nilai
**`Postgres URL`** (yang `postgres://postgres:<password>@<service>:5432/postgres`).
Ganti suffix `/postgres` jadi `/competzy` saat dipakai sebagai `DATABASE_URL`
di backend.

---

## 3. Provision MinIO

**+ New Resource → Services → MinIO** (atau pakai template Docker Image
`minio/minio:latest` dengan command `server /data --console-address :9001`).

- Port API: `9000`
- Port Console: `9001`
- Volume: mount `/data` ke persistent volume (Coolify Storages tab)
- Environment:
  - `MINIO_ROOT_USER=minio`
  - `MINIO_ROOT_PASSWORD=<openssl rand -hex 24>`
- Domain (port `9000`): `https://minio.arena.competzy.com`
  > Ini yang dipakai browser untuk fetch presigned URL. Kalau mau
  > console MinIO juga publik, expose port `9001` ke subdomain berbeda.

Buat bucket awal:
1. Buka console MinIO (port 9001) → login pakai root user/password.
2. **Buckets → Create Bucket** → name: `competzy`.
3. **Access Keys → Create** → simpan Access Key & Secret Key (jangan pakai
   root creds untuk backend).

---

## 4. Deploy Backend

**+ New Resource → Public Repository → Dockerfile**
- Repository: `https://github.com/eduversal-team/competzy`
- Branch: `main`
- **Base Directory:** `/backend`
- **Dockerfile Location:** `Dockerfile`
- **Port:** `3000`
- **Domain:** `https://api.competzy.com` (Coolify provision SSL otomatis)
- **Healthcheck Path:** `/api/health`
- **Persistent Storage:** mount volume ke `/app/uploads` (backup untuk file
  lokal lama; produksi pakai MinIO).
- **Environment Variables** (copy dari `backend/.env.example` dan isi):

  ```env
  NODE_ENV=production
  PORT=3000
  DATABASE_URL=postgres://postgres:<password>@competzy-postgres:5432/competzy
  JWT_SECRET=<openssl rand -hex 32>
  JWT_EXPIRES_IN=7d
  CORS_ORIGINS=https://arena.competzy.com
  APP_URL=https://arena.competzy.com
  SMTP_HOST=...
  SMTP_PORT=587
  SMTP_USER=...
  SMTP_PASS=...
  SMTP_FROM=Competzy <noreply@competzy.id>
  OTP_EXPIRY_MINUTES=10
  SENTRY_DSN=...
  TWILIO_ACCOUNT_SID=...
  TWILIO_AUTH_TOKEN=...
  TWILIO_VERIFY_SID=...
  MIDTRANS_SERVER_KEY=...
  MIDTRANS_CLIENT_KEY=...
  MIDTRANS_IS_PRODUCTION=true
  API_CO_ID_KEY=...
  MINIO_ENDPOINT=http://<minio-service-name>:9000
  MINIO_ACCESS_KEY=<bucket access key>
  MINIO_SECRET_KEY=<bucket secret key>
  MINIO_BUCKET=competzy
  MINIO_PUBLIC_URL=https://minio.arena.competzy.com
  ```

Deploy. Tunggu sampai healthcheck hijau.

### Jalankan migrasi pertama kali

Coolify UI → service backend → tab **Terminal**:

```bash
npm run db:migrate
```

Untuk seed/admin awal — `db:create-admin` dan teman-temannya pakai `ts-node`
(devDependency, sudah dipangkas di image production). Jalankan dari laptop
dengan `DATABASE_URL` mengarah ke Coolify Postgres (publikkan sementara,
atau pakai SSH tunnel ke server):

```bash
cd backend
DATABASE_URL=postgres://... npm run db:create-admin
```

---

## 5. Deploy Web (Next.js)

**+ New Resource → Public Repository → Dockerfile**
- Repository: `https://github.com/eduversal-team/competzy`
- Branch: `main`
- **Base Directory:** `/web`
- **Dockerfile Location:** `Dockerfile`
- **Port:** `3001`
- **Domain:** `https://arena.competzy.com`
- **Build Arguments** (penting — Next.js inline ini di build time):
  ```
  NEXT_PUBLIC_API_URL=https://api.competzy.com/api
  ```
- **Environment Variables** (runtime):
  ```
  NODE_ENV=production
  PORT=3001
  HOSTNAME=0.0.0.0
  BACKEND_URL=http://<backend-service-name>:3000
  ```

`BACKEND_URL` dipakai oleh `next.config.mjs` rewrites (server-side proxy
`/api/*` → backend). `NEXT_PUBLIC_API_URL` dipakai client-side.

Deploy.

---

## 6. Verifikasi

- `curl https://api.competzy.com/api/health` → `200 OK`
- Buka `https://arena.competzy.com` → halaman login load, request ke
  `/api/*` proxy mulus ke backend
- Upload file (dari halaman registrasi) → object muncul di MinIO bucket
- `https://minio.arena.competzy.com/competzy/<key>` accessible via
  presigned URL yang di-generate backend

---

## 7. Operasi rutin

| Task                          | Cara                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| Deploy versi baru             | `git push origin main` → Coolify auto-deploy (kalau webhook aktif)                     |
| Tail log                      | Coolify service → tab **Logs**                                                         |
| Run migrasi baru              | service backend → **Terminal** → `npm run db:migrate`                                  |
| Rollback                      | service → **Deployments** → pilih commit lama → **Redeploy**                           |
| Backup Postgres               | service postgres → **Backups** → enable scheduled S3 backup ke MinIO bucket terpisah    |
| Backup MinIO                  | MinIO sendiri sudah ada di persistent volume; backup volume lewat Coolify Storages     |
| Mobile app rilis              | Dari laptop: `cd app && eas build --profile production && eas submit`                  |

---

## 8. Troubleshooting

**Backend gagal start dengan `Missing required environment variable: DATABASE_URL`**
→ env var belum di-set di Coolify, atau pakai `${DATABASE_URL}` style yang
nggak di-resolve. Pastikan paste raw value, bukan template.

**Web 502 saat panggil `/api/*`**
→ `BACKEND_URL` salah. Cek dari Web container: `curl $BACKEND_URL/api/health`
(tab Terminal). Service name harus persis sama dengan nama service backend
di Coolify (lowercase, dash, contoh: `competzy-backend`).

**CORS error di browser**
→ Tambah origin ke `CORS_ORIGINS` di env backend (comma-separated, tanpa
trailing slash) lalu redeploy backend.

**File upload sukses tapi gambar broken di browser**
→ `MINIO_PUBLIC_URL` salah. Browser butuh URL HTTPS publik MinIO, bukan
internal docker hostname. Pastikan ada DNS + SSL untuk
`minio.arena.competzy.com`.

**Next.js build warning soal multiple lockfiles**
→ Sudah ditangani via `outputFileTracingRoot` di `next.config.mjs`. Kalau
tetap muncul, pastikan `Base Directory` di Coolify diset ke `/web`, bukan
`/`.
