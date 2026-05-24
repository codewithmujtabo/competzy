# Deploy Competzy ke Coolify (host-nginx + Coolify hybrid)

> **Configuration placeholders** (resolve at deploy time, never commit
> the real values back to this doc):
> - `<PROD_HOST>` — public IPv4 of the production server
> - `<DEPLOY_USER>` — SSH login on the host (sudo + docker group)
> - `<COOLIFY_ADMIN_EMAIL>` — Coolify dashboard root account
>
> The real values live in the team's private deploy notes (Notion / 1Password).
> This doc is a structural runbook only.

> **Server target:** `<PROD_HOST>` — sudah ada Coolify (`coolify`,
> `coolify-db`, `coolify-realtime`, `coolify-redis`, `coolify-sentinel`
> running healthy) **plus** host-level **nginx 1.24 + certbot** sebagai
> reverse proxy publik. Coolify di server ini **tidak pakai Traefik** —
> setiap container expose port langsung ke host, dan host nginx yang
> handle domain + SSL.

## Arsitektur

```
Internet ─► :80 / :443 ──► nginx host (certbot SSL)
                            ├─► localhost:3000  → competzy.com landing (repo competzy-web)
                            ├─► localhost:3001/4000 → pathvance.com (tenant lain)
                            ├─► localhost:3010 → backend (Competzy API)        ◀── this guide
                            ├─► localhost:3011 → web (Competzy arena)          ◀── this guide
                            └─► localhost:9000 → minio S3 endpoint             ◀── this guide
```

Service yang akan diprovision di Coolify untuk repo ini:

| Service        | Coolify resource     | Host port (exposed) | Internal port | Public domain                       |
| -------------- | -------------------- | ------------------- | ------------- | ----------------------------------- |
| PostgreSQL 16  | Database             | — (internal only)   | `5432`        | — (no public domain)                |
| MinIO          | Service              | `9000`, `9001`      | `9000`/`9001` | `https://minio.arena.competzy.com`  |
| Backend (API)  | Application (Docker) | `3010`              | `3000`        | `https://api.competzy.com`          |
| Web (Next.js)  | Application (Docker) | `3011`              | `3001`        | `https://arena.competzy.com`        |

**`app/` (Expo)** tidak deploy di sini — mobile binary di-build via EAS
Build dari laptop (`eas build --profile production`).

---

## 0. Prasyarat

- SSH access ke server sebagai user dengan sudo + docker group.
- Akses ke DNS `competzy.com` untuk bikin A-record.
- Coolify dashboard credentials (UI di `http://<PROD_HOST>:8000`).

### DNS A-records yang harus dibuat

```
api.competzy.com           A    <PROD_HOST>    TTL 300
arena.competzy.com         A    <PROD_HOST>    TTL 300
minio.arena.competzy.com   A    <PROD_HOST>    TTL 300
```

Tunggu propagate (`dig +short api.competzy.com` harus return IP) sebelum
jalankan certbot di Step 6.

---

## 1. Buat Project di Coolify

Coolify UI → **Projects → + New Project**
- Name: `competzy`
- Environment: `production`

---

## 2. Provision PostgreSQL

Inside project → **+ New Resource → Database → PostgreSQL 16**
- Name: `competzy-postgres`
- Database name: `competzy`
- **Public Port: OFF** — backend container reach Postgres lewat docker
  network internal Coolify, tidak perlu publish ke host.

Setelah deploy berhasil, klik service → tab **Environment** → catat:
- Internal hostname (mis. `competzy-postgres` atau yang muncul di `Postgres URL`)
- Password
- Constructed URL: `postgres://postgres:<password>@<hostname>:5432/competzy`

---

## 3. Provision MinIO

**+ New Resource → Services → MinIO** (atau Docker Image `minio/minio:latest`
dengan command `server /data --console-address :9001`).

Settings:
- **Exposed Ports** (host:container):
  - `9000:9000` — S3 API (HTTP → nanti di-fronted nginx untuk HTTPS)
  - `9001:9001` — Console (optional public, atau internal saja)
- Persistent volume: mount `/data` ke storage (Coolify Storages tab)
- Environment:
  - `MINIO_ROOT_USER=minio`
  - `MINIO_ROOT_PASSWORD=` (generate: `openssl rand -hex 24`)
- **Domains field di Coolify: kosongkan** — nginx host yang handle.

Setelah running, akses console di `http://<PROD_HOST>:9001` (sementara
sebelum SSL siap):
1. Login pakai root user/password.
2. **Buckets → Create Bucket** → name: `competzy`.
3. **Access Keys → Create** → buat key non-root untuk backend. Simpan
   `Access Key` + `Secret Key` (jangan pakai root creds untuk backend).

---

## 4. Deploy Backend (Express)

**+ New Resource → Public Repository → Dockerfile**
- Repository: `https://github.com/eduversal-team/competzy`
- Branch: `main`
- **Base Directory:** `/backend`
- **Dockerfile Location:** `Dockerfile`
- **Exposed Port (host:container):** `3010:3000`
  - Internal Dockerfile EXPOSE 3000; host bind ke 3010 untuk menghindari
    tabrakan dengan landing competzy.com yang sudah pakai 3000.
- **Domains field di Coolify: kosongkan.** nginx host yang routing.
- **Healthcheck Path:** `/api/health` (Coolify boleh tetap configure;
  nginx tidak butuh ini)
- **Persistent Storage:** mount volume ke `/app/uploads`. (Selama
  `MINIO_*` env set di bawah, path ini idle — file lewat MinIO. Volume
  dipasang sebagai safety net.)

**Environment Variables** (copy dari `backend/.env.example`):
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=postgres://postgres:<password>@<postgres-service-name>:5432/competzy
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
# MinIO: backend pakai internal docker hostname (lewat docker network),
# browser pakai PUBLIC_URL (lewat nginx).
MINIO_ENDPOINT=http://<minio-service-name>:9000
MINIO_ACCESS_KEY=<bucket access key>
MINIO_SECRET_KEY=<bucket secret key>
MINIO_BUCKET=competzy
MINIO_PUBLIC_URL=https://minio.arena.competzy.com
```

Deploy. Tunggu sampai container status "running".

### Migrasi DB pertama kali

Coolify UI → service backend → tab **Terminal**:

```bash
npm run db:migrate
```

Seed/admin scripts (`db:create-admin`, `db:seed:*`) pakai `ts-node` yang
sudah dipangkas dari image production. Jalankan dari laptop dengan
`DATABASE_URL` mengarah ke Coolify Postgres:

```bash
# Sementara expose Postgres ke public di Coolify UI, atau pakai SSH tunnel:
ssh -L 5432:127.0.0.1:<postgres-host-port> <DEPLOY_USER>@<PROD_HOST>

# Lalu di terminal lain:
cd backend
DATABASE_URL=postgres://postgres:<password>@localhost:5432/competzy \
  npm run db:create-admin
```

---

## 5. Deploy Web (Next.js)

**+ New Resource → Public Repository → Dockerfile**
- Repository: `https://github.com/eduversal-team/competzy`
- Branch: `main`
- **Base Directory:** `/web`
- **Dockerfile Location:** `Dockerfile`
- **Exposed Port (host:container):** `3011:3001`
- **Domains field di Coolify: kosongkan.**
- **Build Arguments** (penting — Next.js inline ini saat build):
  ```
  NEXT_PUBLIC_API_URL=https://api.competzy.com/api
  ```
- **Environment Variables** (runtime):
  ```env
  NODE_ENV=production
  PORT=3001
  HOSTNAME=0.0.0.0
  BACKEND_URL=http://<backend-service-name>:3000
  ```

`BACKEND_URL` dipakai server-side rewrites di `next.config.mjs`
(`/api/:path*` → backend over docker network). `NEXT_PUBLIC_API_URL`
dipakai oleh kode client-side.

Deploy.

---

## 6. Konfigurasi nginx host + SSL

File `deploy/nginx.conf` di repo ini adalah template siap-pakai. Dari
server (SSH masuk dulu):

```bash
# Dari working copy repo di server, atau scp dari laptop:
sudo cp deploy/nginx.conf /etc/nginx/sites-available/competzy-arena
sudo ln -s /etc/nginx/sites-available/competzy-arena \
           /etc/nginx/sites-enabled/competzy-arena

# Smoke test config sebelum reload:
sudo nginx -t

# Reload nginx (zero downtime; existing competzy.com / pathvance.com tetap up):
sudo systemctl reload nginx

# Pastikan DNS sudah propagate:
dig +short api.competzy.com arena.competzy.com minio.arena.competzy.com
# (semuanya harus return <PROD_HOST>)

# Issue SSL untuk semua subdomain sekaligus:
sudo certbot --nginx \
  -d api.competzy.com \
  -d arena.competzy.com \
  -d minio.arena.competzy.com

# Certbot akan modify /etc/nginx/sites-enabled/competzy-arena: tambah
# `listen 443 ssl;` blocks dengan path cert, dan ubah listen 80 blocks
# jadi HTTP→HTTPS redirect. Renewal otomatis lewat certbot.timer.

# Verifikasi:
sudo nginx -t && sudo systemctl reload nginx
curl -sI https://api.competzy.com/api/health     # expect 200
curl -sI https://arena.competzy.com/             # expect 200
curl -sI https://minio.arena.competzy.com/minio/health/live  # expect 200
```

---

## 7. Verifikasi end-to-end

- `curl https://api.competzy.com/api/health` → `200 OK`
- Browser buka `https://arena.competzy.com` → halaman login load,
  request ke `/api/*` proxy mulus ke backend
- Login dengan admin yang dibuat lewat `db:create-admin`
- Upload file dari halaman registrasi → cek bucket MinIO (console di
  `https://<PROD_HOST>:9001` atau `http://...:9001`) — object muncul
  di bucket `competzy`
- `https://minio.arena.competzy.com/competzy/<key>?<presigned-params>`
  accessible — itu yang ditampilkan ke browser sebagai `fileUrl`

---

## 8. Operasi rutin

| Task                          | Cara                                                                                   |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| Deploy versi baru             | `git push origin main` → Coolify auto-deploy (kalau webhook aktif di Source settings)  |
| Tail log                      | Coolify service → tab **Logs**                                                         |
| Run migrasi baru              | service backend → **Terminal** → `npm run db:migrate`                                  |
| Rollback                      | service → **Deployments** → pilih commit lama → **Redeploy**                           |
| Backup Postgres               | service postgres → **Backups** → enable scheduled S3 backup ke MinIO bucket terpisah   |
| Backup MinIO                  | persistent volume MinIO di-backup lewat Coolify Storages                               |
| Tambah subdomain baru         | Edit `/etc/nginx/sites-available/competzy-arena`, `nginx -t`, reload, `certbot --nginx -d ...` |
| Mobile rilis                  | Dari laptop: `cd app && eas build --profile production && eas submit`                  |

---

## 9. Troubleshooting

**Backend gagal start, `Missing required environment variable: DATABASE_URL`**
→ env var belum di-set di Coolify, atau pakai `${DATABASE_URL}` style yang
tidak di-resolve. Paste raw value, bukan template.

**`api.competzy.com` return 502 Bad Gateway**
→ Backend container tidak listen di port 3010 host. Cek
`docker ps --format "{{.Names}}\t{{.Ports}}" | grep 3010`. Pastikan
Coolify "Exposed Ports" diset `3010:3000`, lalu redeploy.

**`arena.competzy.com` load, tapi `/api/*` 502**
→ `BACKEND_URL` salah. Dari container web (Coolify Terminal):
`curl $BACKEND_URL/api/health`. Service name harus persis sama dengan
nama service backend di Coolify (lowercase + dash).

**CORS error di browser console**
→ Tambah origin ke `CORS_ORIGINS` di env backend (comma-separated, tanpa
trailing slash) lalu redeploy backend.

**Upload sukses, gambar broken di browser**
→ `MINIO_PUBLIC_URL` salah atau DNS belum propagate untuk
`minio.arena.competzy.com`. Cek `curl -sI https://minio.arena.competzy.com/`
→ harus 200/403 (bukan timeout / wrong cert).

**`certbot --nginx` gagal di salah satu domain**
→ DNS belum propagate. `dig +short <domain>` harus return IP server.
Tunggu 5–10 menit, retry. Atau jalankan satu domain saja dulu untuk
isolate error: `sudo certbot --nginx -d api.competzy.com`.

**Next.js build warning soal multiple lockfiles**
→ Sudah ditangani via `outputFileTracingRoot` di `next.config.mjs`. Kalau
masih muncul, pastikan `Base Directory` di Coolify diset ke `/web`, bukan
root repo.

**`docker ps` menampilkan container baru tapi nginx 502**
→ Service Coolify mungkin running tapi port mapping salah. Cek di Coolify
service → **Settings → Network** → "Ports Mappings": pastikan format
`<host-port>:<container-port>` dengan host-port = 3010 (backend) atau
3011 (web), dan container-port match `EXPOSE` di Dockerfile (3000 atau
3001).
