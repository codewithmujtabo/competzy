# Competzy — Claude Project Brief

Indonesia's unified K-12 academic competition platform. Students, parents, teachers, and organizers all in one place. Replaces fragmented per-competition websites (EMC, ISPO, OSEBI, Komodo, Owlypia, etc.).

**GitHub:** https://github.com/codewithmujtabo/competzy  
**Phase 1 deadline:** July 10, 2026  
**Owner split:** Mujtabo → mobile app (`app/`) + backend (`backend/`). Teammate → web portals (`web/`).

---

## Monorepo Structure

```
competzy/
├── app/          React Native (Expo) — student, parent, teacher (light)
├── web/          Next.js 14 App Router — admin, organizer, school, rep, referral portals
├── backend/      Express.js 5 + PostgreSQL — shared API for both app and web (port 3000)
├── docs/         PROJECT_PLAN.md (task board) + PROJECT_PLAN.docx
└── package.json  Root convenience scripts
```

**There is no separate backend for the web. Both app and web call the same Express backend on port 3000.**

---

## How to Run

```bash
# From each subdirectory:
cd backend && npm run dev        # Express backend — port 3000
cd web     && npm run dev        # Next.js web — port 3001
cd app     && npm start          # Expo mobile — opens Expo dev tools

# Or from the monorepo root:
npm run backend
npm run web
npm run app

# Install all deps at once:
npm run install:all
```

**Web `.env.local`** (`web/.env.local`):
```
BACKEND_URL=http://localhost:3000
```

**App `.env.local`** (`app/.env.local`):
```
EXPO_PUBLIC_API_URL=http://<MAC_LAN_IP>:3000/api
```
> The Mac's LAN IP changes when reconnecting to WiFi. Run `ipconfig getifaddr en0` to get the current IP and update this file. For iOS Simulator only, `http://localhost:3000/api` works.

**Backend `.env`** (`backend/.env`) — not committed. Copy from `backend/.env.example`.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | React Native + Expo SDK 52 + TypeScript + Expo Router (file-based) |
| Web | Next.js 14 App Router + TypeScript |
| Backend | Express.js 5 + TypeScript + node-pg (raw SQL, no ORM) |
| Database | PostgreSQL — self-hosted on VPS |
| Auth | JWT (7-day) + Email OTP + Phone OTP via Twilio |
| Payments | Midtrans Snap (GoPay, OVO, Dana, Bank VA, QRIS) |
| File storage | Currently local disk `/backend/uploads/` → needs MinIO migration |
| Push notifications | Expo Push Service |
| Email | Nodemailer (SMTP / Gmail) |
| Regions data | Static JSON from emsifa.com (called directly from app, not proxied) |
| School search | api.co.id (requires `API_CO_ID_KEY`) — falls back to DB when key not set |

---

## Rules — Always Follow

1. **Never propose Supabase, Neon, RDS, PlanetScale, or any managed DBaaS.** Self-hosted PostgreSQL on VPS only.
2. **Never use an ORM.** Raw SQL with `node-pg` (`pool.query()`). Migrations are plain `.sql` files in `backend/migrations/`.
3. **All web pages must have `'use client'`** if they use React state, hooks, or browser APIs. Next.js App Router defaults to Server Components.
4. **Web calls backend via Next.js rewrite** (`/api/*` → `http://localhost:3000/api/*`). Never hardcode backend URLs in web code — always use relative `/api/...` paths.
5. **Backend routes follow REST conventions.** Admin routes are under `/api/admin/`. Organizer routes under `/api/organizers/`. Never expose admin endpoints without `adminOnly` middleware.
6. **No TypeScript `any` in new code** unless there is truly no alternative (e.g. third-party payloads).
7. **Phone numbers are always normalized to E.164 (`+62...`)** before storing. Use `toE164()` in `twilio.service.ts`.
8. **Dev OTP bypass:** When `TWILIO_VERIFY_SID` is not set, phone OTP is bypassed and the code `000000` always works. Email OTP uses a real SMTP server even in dev.

---

## Important Codebase Context

### Authentication
- **Web (since Sprint 14):** JWT issued in an `httpOnly + SameSite=Lax + Secure-in-prod` cookie named `competzy_token`. The cookie is set automatically by every login endpoint (email/password, email-OTP, phone-OTP) via the `issueAuthCookie()` helper in `auth.routes.ts`. localStorage is no longer used. `POST /api/auth/logout` clears the cookie. `web/lib/auth/{context,organizer-context,school-context}.tsx` hydrate via `GET /api/auth/me` on mount; the same shared cookie powers all three portals.
- **Single-session implication:** because all three web portals share one cookie, a browser cannot be admin and organizer simultaneously. Log out to switch roles.
- **Mobile:** JWT stored in `SecureStore` and sent as `Authorization: Bearer …`. The auth middleware reads the Bearer header first, then falls back to the cookie — so mobile is unaffected by the web change.
- **CORS:** backend now opts in to `credentials: true` with an explicit origin allowlist (`CORS_ORIGINS` env, defaults to `http://localhost:3000,http://localhost:3001`). Empty Origin (server-to-server, mobile) is allowed.
- **Soft-deleted users are 401-rejected** by the auth middleware, so deleting an account immediately invalidates all live sessions.
- Role-based: `student`, `parent`, `teacher`, `school_admin`, `admin`, `organizer`.
- `GET /api/auth/me` is the user hydration endpoint on app startup. Now returns `kid` (KX-2026-NNNNNNN) and, for `school_admin`, `schoolVerificationStatus` + `schoolRejectionReason`.

### Database
- Schema is in `backend/src/db/schema.sql`.
- Tables: `users`, `students`, `parents`, `teachers`, `competitions`, `competition_rounds`, `registrations`, `payments`, `documents`, `notifications`, `otp_codes`, `invitations`, `parent_student_links`, `teacher_student_links`, `bulk_registration_jobs`, `favorites`, `schools`, `historical_participants`, `school_payment_batches`, `school_payment_batch_items`, `organizers`, **`audit_log` (Sprint 14)**, **`payment_webhook_events` (Sprint 14)**.
- Migrations live in `backend/migrations/` as timestamped `.sql` files. Run with `npm run db:migrate`.
- `DATABASE_URL` format: `postgresql://user:password@localhost:5432/competzy`. Local DB has been renamed to `competzy` ✅. **VPS still needs**: `ALTER DATABASE kompetix RENAME TO competzy;` (or `beyond_classroom RENAME TO competzy;` if VPS skipped the May 6 rename) + update `DATABASE_URL` in VPS `backend/.env`.
- **Latest migration:** `1747500000000_school-verification.sql` (Sprint 16). Earlier in this batch: `1746900000000_audit-log`, `1747000000000_soft-delete`, `1747100000000_payment-webhook-events`, `1747200000000_add-person-kid`, `1747300000000_drop-orphan-parent-school-id`, `1747400000000_add-payer-user-id`. Run all on VPS.
- **Soft delete (Sprint 14):** `users`, `students`, `parents`, `teachers`, `registrations`, `payments`, `documents`, `historical_participants`, `notifications` all have a nullable `deleted_at TIMESTAMPTZ`. Live queries must filter `deleted_at IS NULL` — use `liveFilter("alias")` from `backend/src/db/query-helpers.ts`. Helpers `softDelete(table, id)` and `restore(table, id)` are also exported (whitelisted to the 9 tables above).
- **Person-KID (Sprint 15):** `users.kid` is a `KX-2026-NNNNNNN` immutable identifier (sequence-backed, UNIQUE, NOT NULL). All 19 existing users were backfilled. Distinct from `registrations.registration_number` (`CTZ-2026-XXXXX`).
- **students table school column:** The column is `school_name TEXT` (not `school`). There is also a `school_id UUID` FK to the `schools` table. Always use `COALESCE(sc.name, s.school_name)` with a `LEFT JOIN schools sc ON s.school_id = sc.id` when you need the school name in queries.
- **Schools verification (Sprint 16):** `schools.verification_status` ∈ {`pending_verification`, `verified`, `rejected`}. Existing rows defaulted to `verified`. Self-signed-up schools start `pending_verification` until an admin approves at `/schools-pending`.
- **Payments payer attribution (Sprint 15):** `payments.payer_user_id` (FK users.id, nullable) + `payments.payer_kind` ∈ {`self`, `parent`, `school`, `sponsor`}. Existing rows backfilled to `(user_id, 'self')`. The mobile pay screen and school bulk-batch flow set this on insert.

### Registration Flow (updated May 2026)
1. Student registers → status = `pending_approval`
2. Admin approves on web (`/registrations` page) → status = `registered` (paid comp) or `paid` (free comp)
3. Student gets push notification to pay
4. Student pays via Midtrans Snap → webhook fires → status = `paid` automatically
5. No manual proof upload — Midtrans webhook is the only confirmation mechanism

### Payments
- Midtrans Snap: `POST /api/payments/snap` creates a transaction and returns a `snap_token`. Body now also accepts optional `payerKind` (`self` | `parent` | `school` | `sponsor`) and `payerUserId` (Sprint 15).
- Snap is blocked with 400 if registration is still `pending_approval` (not yet admin-approved).
- Webhook at `POST /api/payments/webhook` — verifies Midtrans signature **and** dedupes by `(provider, order_id, signature_key)` against the `payment_webhook_events` table (Sprint 14). Duplicate retries return `200 OK (duplicate)` without re-processing.
- **Payment proof upload has been removed** — Midtrans auto-confirms.
- VA expiry: webhook `expire` event resets registration back to `registered` (T10 fix).
- **Verify endpoint:** `GET /api/payments/verify/:registrationId` — calls Midtrans Status API directly and force-updates DB to `paid` when settled. Used by the app after browser close to sync status without relying on the webhook (which can't reach localhost in sandbox). In production the webhook still handles it; verify is a belt-and-suspenders backup.
- `pay.tsx` flow (Sprint 15): on screen mount, shows a "Dibayar Oleh" radio selector (4 options) **before** opening Snap. User picks payer attribution then taps "Lanjutkan ke Pembayaran". Auto-launch removed.
- After browser close, `pay.tsx` calls verify (both "Return to merchant" and user-dismiss paths). Only shows "Payment Completed!" when DB confirms `paid`. Polls up to 6× with 3s gaps (~18s total).
- **School-batch payments (Sprint 16.4):** Midtrans receipt is now issued in the SCHOOL'S name (was the coordinator's personal name); coordinator email remains the contact. This is what reimbursement workflows need.
- Sandbox keys are in `.env`. Switch to production keys before launch.

### File Storage (Sprint 14 — signed URLs)
- Files stored locally in `backend/uploads/<userId>/` in dev, or in MinIO/S3 when `MINIO_ENDPOINT` is set.
- **All client-facing URLs are now signed and 15-min expiry** (Sprint 14):
  - S3/MinIO: real presigned GET URLs via `@aws-sdk/s3-request-presigner`
  - Local disk dev: JWT-token URLs at `/uploads-signed/<token>` served by an endpoint in `index.ts` with path-traversal guard
- `GET /api/documents` returns signed URLs in the `fileUrl` field. Raw `/uploads/...` static path still served for backward compat in dev — **remove from production nginx config**.
- `backend/src/services/storage.service.ts` exposes `storeFile`, `deleteFile`, `getSignedUrl`, `verifySignedUrlToken`, and `isS3Configured`.

### Audit Log (Sprint 14)
- Append-only `audit_log` table records every privileged write. Columns: `user_id`, `user_role` (snapshot), `action`, `resource_type`, `resource_id`, `ip`, `user_agent`, `payload` (JSONB, with secrets redacted), `created_at`.
- Wired into 16 admin/organizer routes via `audit({ action, resourceType, resourceIdParam })` middleware (`backend/src/middleware/audit.ts`). Action labels look like `admin.competition.create`, `organizer.registration.approve`, `admin.school.verify`, etc.
- Logs only on 2xx responses; never blocks the request (fire-and-forget).
- Redacts: `password`, `current_password`, `token`, `snap_token`, `signature_key`, OTP `code`, parent invite `pin`.
- Retention: 5 years (purged by retention cron, see below).

### Retention Cron (Sprint 14)
- `backend/src/services/cron.service.ts` → `scheduleRetentionEnforcement()` runs daily at 02:00.
- Soft-deletes `documents` whose competition ended > 1 year ago.
- Hard-deletes `audit_log` rows older than 5 years.
- Hard-deletes already-read `notifications` older than 1 year.

### Rate Limiting
- `express-rate-limit` is wired to: `/api/auth/{signup,login}` (20/15min), `/api/auth/{send,verify}-otp` (5–10/window), parent PIN verify (5/15min per email), and `/api/bulk-registration/upload` (3/hour per user — Sprint 14 addition). Returns 429 with friendly JSON.

### Bulk Registration
- CSV upload → `POST /api/bulk-registration/upload` (rate-limited 3/hour) → creates a job in `bulk_registration_jobs`.
- Background cron (every 1 min) in `backend/src/services/bulk-processor.service.ts` processes pending jobs.
- **Hard-match dedup (Sprint 15):** if NISN + email both miss but `LOWER(full_name) + school + grade` matches exactly one existing student, the row links to that user instead of creating a duplicate. Multiple matches throw "Ambiguous hard-match" so an operator can resolve manually.
- ~~Known gaps (Sprint 0 Task 3): bulk processor doesn't check competition fee, doesn't email temp password to new users, doesn't insert school_name~~ — all fixed in earlier sprints.

### Parent-Student Linking
- Student sends invite to parent email → `POST /api/parents/invite-parent` → generates 6-digit PIN → emails parent.
- Parent accepts → `POST /api/parents/accept-invitation` with PIN.
- Links stored in `parent_student_links` table.
- Debug PIN endpoint (`GET /api/parents/debug-pin/:userId`) blocked in production.

### Teacher-Student Roster (added May 2026)
- Teacher explicitly links students they supervise — no automatic school-based scoping.
- `POST /api/teachers/link-student` — teacher adds student by email (direct link, no PIN).
- `DELETE /api/teachers/link-student/:studentId` — remove from roster.
- Links stored in `teacher_student_links` table (migration `1746500000000_teacher-student-links.sql` — **already applied locally and on VPS**).
- **All teacher dashboard data is scoped to linked students only** — `GET /api/teachers/my-students`, `GET /api/teachers/my-competitions`, `GET /api/teachers/dashboard-summary`.
- App: `teacher-students.tsx` → manage roster; `teacher-analytics.tsx` → competitions my students joined.
- Teacher portal is **monitoring-only** — no bulk registration or bulk payment actions from the app. All write operations go through the web portal or admin.

### Profile Edit (role-aware, updated May 2026)
- `app/app/(tabs)/profile/edit.tsx` renders different fields per role — do NOT add student-specific fields for teacher/parent.
- **Student**: Personal Details (name, DOB, phone, email, city, interests, referral) + Student Card upload + School Details + Supervisor/Teacher + Parent/Guardian sections.
- **Teacher**: Personal Details (name, phone, email, city) + Professional Info (school, subject, department).
- **Parent**: Personal Details only (name, phone, email, city).
- Backend `PUT /api/users/me` saves `school` + `department` for teachers (not just `subject`).

### Regions (Province/City)
- App calls emsifa.com **directly** (not through backend) with in-memory cache.
- `app/services/regions.service.ts` — provinces and regencies cached for the session.
- Backend still has `GET /api/regions/provinces` and `GET /api/regions/regencies/:code` but the app no longer uses them.

### School Search on Signup
- Calls `GET /api/schools/search?name=...&regencyCode=...`
- Uses api.co.id when `API_CO_ID_KEY` is set.
- Falls back to querying the local `schools` DB table when key is not set (returns up to 20 matches by name).

### Web Portal Structure
- `web/app/page.tsx` — **Role selector landing page** with **footer** (Privacy / Terms / Contact links — Sprint 14)
- `web/app/privacy/page.tsx` — UU PDP-aware Privacy Policy placeholder (DRAFT, needs counsel review) — Sprint 14
- `web/app/terms/page.tsx` — Terms of Service placeholder (DRAFT) — Sprint 14
- `web/app/login/page.tsx` — Admin login (has ← Back to role selector)
- `web/app/(dashboard)/` — Admin portal (cookie-guarded by `(dashboard)/layout.tsx`)
- `web/app/(dashboard)/dashboard/page.tsx` — **Rewritten in Sprint 15**: 4 KPI cards (Registrations, Paid Rate, Revenue, Avg Time to Pay) + 90-day registrations sparkline + Top-3 competitions panel + 6-link grid
- `web/app/(dashboard)/registrations/page.tsx` — All registrations with status filter tabs (All/Pending/Registered/Paid/Rejected); approve/reject only for `pending_approval`
- `web/app/(dashboard)/competitions/page.tsx` — Competition management (create/edit/delete)
- `web/app/(dashboard)/users/page.tsx` — User management
- `web/app/(dashboard)/schools/page.tsx` — Schools management
- `web/app/(dashboard)/schools-pending/page.tsx` — **NEW Sprint 16:** verification queue for school applications (verify / reject with reason)
- `web/app/(dashboard)/segments/page.tsx` — **NEW Sprint 15:** 3 pre-built audiences (lapsed >1y, multi-comp veterans, EMC-only never tried KMC) for cross-sell campaigns
- `web/app/(dashboard)/notifications/page.tsx` — Broadcast notifications
- `web/app/(organizer)/` — Organizer portal (cookie-guarded by `(organizer)/layout.tsx`)
- `web/app/(organizer)/organizer-login/page.tsx` — Organizer login
- `web/app/(organizer)/organizer-dashboard/page.tsx` — Organizer dashboard
- `web/app/(organizer)/organizer-competitions/page.tsx` — Competitions list (publish/close actions)
- `web/app/(organizer)/organizer-competitions/new/page.tsx` — **Built (teammate) + Sprint 15 added `postPaymentRedirectUrl` field**
- `web/app/(organizer)/organizer-competitions/[id]/page.tsx` — Competition detail view (built by teammate)
- `web/app/(organizer)/organizer-competitions/[id]/edit/page.tsx` — Edit form (built; same redirect-URL field added)
- `web/app/(organizer)/participants/page.tsx` — Participants view per competition (approve/reject)
- `web/app/(organizer)/revenue/page.tsx` — Revenue overview (stat cards + per-competition table)
- `web/app/(school)/` — School portal (cookie-guarded by `(school)/layout.tsx` with verification gating)
- `web/app/(school)/school-login/page.tsx` — School login (has "New school? Apply for an account" link)
- `web/app/(school)/school-signup/page.tsx` — **NEW Sprint 16:** self-signup form for school + coordinator account
- `web/app/(school)/school-pending/page.tsx` — **NEW Sprint 16:** shown to logged-in coordinators while their school is `pending_verification` or `rejected`
- `web/app/(school)/school-dashboard/page.tsx` — School dashboard (stats + quick links; **Achievement PDF tile added in Sprint 16**)
- `web/app/(school)/{bulk-registration,bulk-payment,school-students,school-my-students,school-my-competitions,school-registrations,school-deadline}/page.tsx` — gated behind `verification_status = 'verified'`
- `web/lib/api/client.ts` — **Rewritten in Sprint 14:** single shared http function with `credentials: 'include'`; `adminHttp`/`organizerHttp`/`schoolHttp` aliases
- `web/lib/auth/{context,organizer-context,school-context}.tsx` — **Rewritten in Sprint 14** to hydrate via `/api/auth/me` cookie auth (no more localStorage)
- `web/components/Sidebar.tsx` — Admin nav with Dashboard, Registrations, Competitions, **Segments**, **Pending Schools**, Send Notification, Schools, Users
- `web/next.config.mjs` — API proxy config

**Test accounts (local dev):**
- Admin: `admin@eduversal.com` / (password set via `npm run db:create-admin` in backend)
- Organizer: `organizer@eduversal.com` / (password set via `npm run db:create-organizer` in backend)

### Historical Data (IMPORTED ✅)
- 63,365 real participant records imported into `historical_participants` table.
- Excel file lives at `/Users/mujtabo/Desktop/All/Internship Eduversal/beyond-classroom/Eduversal_Database.xlsx` — NOT in the repo.
- Identity matching: email (88.6% coverage) + WhatsApp/phone (96.9% coverage).
- Auto-link fires at login (`/me` and `/phone/verify-otp`) — matches email OR phone, skips if already linked.
- Manual claim via `GET /api/historical/search` + `POST /api/historical/:id/claim`.
- Mobile: `app/app/(tabs)/profile/history.tsx` — "My Records" tab + "Find & Claim" tab.
- **Smart phone login (added May 2026):** If phone OTP succeeds but no `users` account, backend checks `historical_participants.phone`. If matched, returns `{ historicalMatch: true, fullName, email, phone }`. App routes to `app/(auth)/claim-account.tsx` which pre-fills name/email from historical data — user only needs to set a password. Account is created and historical records are auto-linked on signup.

### File Storage
- **Dev (default):** local disk `backend/uploads/<userId>/`, served as static by Express.
- **Production (MinIO):** set `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`, `MINIO_PUBLIC_URL` in `backend/.env`. The code automatically switches to S3 when these are set.
- All three upload routes (users, documents, payments) now use `multer.memoryStorage()` + `storeFile()` from `storage.service.ts`.
- T21 (MinIO Docker on VPS) is the only remaining infrastructure step before production storage works.

---

## Current Task Status (as of May 13, 2026 — Session 10)

**Sprints 0–16 fully complete locally + Sprints 19 (Gen Z redesign) and 20 (unified login + de-brand) shipped + EMC Port Wave 1 in execution (4-phase).**
**Latest milestone (Phase A):** Sprint 20 shipped — unified email/password login at `/` auto-routes by role; all per-role login pages (`/login`, `/organizer-login`, `/school-login`) removed; competition-portal scaffolding at `/emc/{register,dashboard,admin}` is live (renamed to slug-based routes in Phase C); migration `1748000000000_add-competition-slug` adds `competitions.slug` and seeds the EMC 2026 row de-branded; backend CORS allows any `http://localhost:<port>` in dev; migration `1747600000000` hot-fixed (`comp_id` column typo + `p.payment_status='settlement'`). All user-visible "Eduversal" references stripped — platform is Competzy-only.

### EMC Port (begins 2026-05-13) — Wave 1 IN EXECUTION (4 phases)

We're porting the feature set of the legacy `eduversal-team/emc` Laravel app onto Competzy's existing stack. 9 waves total, ~6–10 weeks. Wave 1 was re-scoped from "schema-only" into four sequential phases.

- **Plan file:** `/Users/mujtabo/.claude/plans/resumption-prompt-paste-playful-bachman.md` (supersedes the earlier `image-1-yeah-when-unified-galaxy.md`).
- **Cadence:** wave-by-wave — plan-mode session → ship → plan next wave. No mega-plan. Within a wave, one commit per phase + push to `feature/legacy-cleanup`.
- **Wave 1 phases:** (A) cleanup + de-brand to Competzy-only ✅ this commit; (B) login + register polish (forgot-password, phone OTP, mobile-responsive); (C) generalize `/emc/*` → `/competitions/[slug]/*`; (D) 6 new migrations creating 31 multi-tenant tables.
- **Wave 1 schema scope (Phase D):** 6 migrations `1748100000000`–`1748600000000` creating 31 tables (subjects, topics, subtopics, questions, answers, question_topics, proofreads, areas, test_centers, area_user, test_center_user, exams, exam_question, sessions, periods, answer_keys, paper_exams, paper_answers, webcams, voucher_groups, vouchers, products, orders, order_items, referrals, clicks, announcements, materials, suggestions, settings, accesses). UUID PKs, JSONB for legacy TEXT-JSON, soft-delete pattern matches Sprint 14.
- **Skipped this wave:** `representatives` (already in our `schools` table), `tags`/`taggables` (Spatie polymorphic — not essential), Spatie permission tables (we keep `users.role` enum-as-text).
- **Wave 2–9 preview:** (2) role enum + question-bank admin UI + **per-competition step-flow abstraction** + `/competitions` catalog landing, (3) online + paper exam delivery, (4) test-center / area / webcam proctoring, (5) vouchers + products + orders UI, (6) referrals + announcements + materials, (7) mobile rollout of student surfaces, (8) certificate PDF + QR verify + barcode, (9) data import from legacy `kompetisi.net` MySQL.
- **Locked design decisions** (per user May 13, 2026 evening replanning): **Multi-tenant schema from day one** — content tables carry `comp_id` (tiered: 24 strict NOT NULL, 2 nullable on `announcements`/`materials`, 5 global on `areas`/`test_centers`/`settings`/pivots). **One app + one website for ALL competitions** — routes are slug-keyed `/competitions/[slug]/…`. **Per-competition step-flow engine in Wave 2**. Both online AND paper exam from day one. No `PortalUser`/cross-site SSO. Legacy users keep their data (Wave 9 import — now simpler thanks to multi-tenancy: every legacy row gets `comp_id = 'comp_emc_2026_main'`). Mobile in lockstep but operator-only features stay web-only. UX matches `competzy.com` marketing site palette + typography. **Brand is Competzy-only — no user-visible "Eduversal" references anywhere.**

### Manual rollout still required (Sprint 13/17 — needs your access)

8 commits ahead of `origin/main` and `eduversal/main` (Phase A of Wave 1 ships as commit #8; Phases B/C/D will push three more commits):
```
<phase-A-sha>  chore(brand): ship unified login + de-brand to Competzy-only
6f83ec6 feat(deploy): production infra templates (nginx, pm2, eas, k6, runbook)
c7e117f feat(school): achievement PDF + school-named bulk-payment receipts
83c4bbd feat(school): self-signup + admin verification + portal gating
1b9b4b1 feat(security): httpOnly cookie auth migration
29ae506 feat(launch1): Sprint 15 polish for Phase 1 soft launch
d0fc10c feat(security): Sprint 14 compliance & hardening
165c5c0 feat(rebrand): Kompetix → Competzy across app, web, backend, docs
```

### Manual rollout still required (Sprint 13/17 — needs your access)
- **MinIO Docker on VPS** (T21): `docker run -d -p 9000:9000 -p 9001:9001 -e MINIO_ROOT_USER=... -e MINIO_ROOT_PASSWORD=... quay.io/minio/minio server /data --console-address :9001`, then set the 5 `MINIO_*` env vars in VPS `backend/.env`.
- **Run all migrations on VPS:** `cd backend && npm run db:migrate` to apply `1746500000000` through `1748000000000` (and, after Wave 1 of the EMC port runs locally, also `1748100000000`–`1748600000000`).
- **Rename DB on VPS:** `ALTER DATABASE kompetix RENAME TO competzy;` (or `beyond_classroom RENAME TO competzy;`). Update VPS `DATABASE_URL`.
- **Production deploy:** copy `deploy/nginx.conf` to `/etc/nginx/sites-available/competzy.conf`; `pm2 start deploy/pm2.config.js --env production` after `npm run build` in `backend/` and `web/`. See `docs/RUNBOOK.md`.
- **DNS + SSL:** A records for `competzy.com`, `api.competzy.com`, `admin.competzy.com`, `organizer.competzy.com`, `partner.competzy.com`, `compete.competzy.com`. Then `certbot --nginx -d ...`.
- **Midtrans production keys** + webhook URL `https://api.competzy.com/api/payments/webhook`.
- **EAS init:** `cd app && npx eas init` (needs expo.dev account). Fill in `appleId`, `ascAppId`, `appleTeamId` in `app/eas.json`.
- **Apple Developer + Play Console** for App Store / Play Store submission.
- **api.co.id production key** (`API_CO_ID_KEY` in VPS `.env`).
- **Privacy + Terms legal review** of `web/app/privacy/page.tsx` and `web/app/terms/page.tsx` (currently DRAFT).
- **Load test against staging** once it's up: `k6 run loadtest/k6-registration.js --env BASE=https://staging-api.competzy.com`.

---

## Sprint Plan (Full Roadmap)

### SPRINT 0 — Quick Wins ✅ COMPLETE
| Task | Status | What |
|---|---|---|
| T1 | ✅ | Rename app "Beyond Classroom" → "Kompetix" → "Competzy" (final rebrand May 8, 2026) |
| T2 | ✅ | Remove admin screens from mobile — redirect admin users to web portal |
| T3 | ✅ | Fix bulk processor: check fee, email temp pwd, insert school_name |
| T4 | ✅ | Fix quota race condition in bulk processor |

### SPRINT 1 — Critical Backend Foundations ✅ COMPLETE
| Task | Status | What |
|---|---|---|
| T5 | ✅ | Add `registration_number` column (originally `KMP-2026-XXXXX`; rebranded to `CTZ-2026-XXXXX` on May 8, 2026) |
| T6 | ✅ | Add `profile_snapshot` JSONB column to registrations |
| T7 | ✅ | Add `organizer` role + `organizers` table + `organizerOnly` middleware |

### SPRINT 2 — Organizer Backend Routes ✅ COMPLETE
| Task | Status | What |
|---|---|---|
| T8 | ✅ | All 12 organizer endpoints in `backend/src/routes/organizer.routes.ts` |

### SPRINT 3 — Payment Fixes ✅ COMPLETE
| Task | Status | What |
|---|---|---|
| T9 | ✅ | Post-payment JWT redirect endpoint (`GET /api/payments/redirect/:registrationId`) |
| T10 | ✅ | VA expiry: reset registration to `registered` on webhook expire event |

### SPRINT 4 — Historical Data ✅ COMPLETE (data imported)
| Task | Status | What |
|---|---|---|
| T11 | ✅ | `historical_participants` table migration — deployed |
| T12 | ✅ | Excel import script — 63,365 records imported into DB |
| T13 | ✅ | Auto-link at login (email + phone match, fire-and-forget) |
| T14 | ✅ | Claim system API: GET /my-records, GET /search, POST /:id/claim, POST /:id/unclaim |

### SPRINT 5 — Mobile Polish ✅ COMPLETE
| Task | Status | What |
|---|---|---|
| T15 | ✅ | "Recommended for you" horizontal scroll in competitions screen (was already implemented) |
| T16 | ✅ | `CTZ-2026-XXXXX` badge on My Competitions cards (legacy rows show `KMP-2026-XXXXX`) |
| T17 | ✅ | Profile snapshot section + "Open Competition Platform" redirect button in competition hub |
| T18 | ✅ | New screen `profile/history.tsx` — My Records tab + Find & Claim tab |
| T19 | ✅ | Teacher actions: removed in-app bulk CSV, added web portal banner |
| T20 | ✅ | `canAccessRegistration()` in payments.routes.ts — parents can pay for linked children |

### SPRINT 6 — File Storage Migration ✅ CODE COMPLETE (T21 VPS pending)
| Task | Status | What |
|---|---|---|
| T21 | ⏳ VPS manual | MinIO Docker setup on VPS — see instructions in NEXT STEP section above |
| T22 | ✅ | `storage.service.ts` rewritten with S3/local dual-mode; multer → memoryStorage in all 3 upload routes |

### SPRINT 7 — Phase 2 (after Phase 1 launch)
| Task | Status | What | Files |
|---|---|---|---|
| T23 | ✅ | school_payment_batches table + bulk pay endpoint | `1746300000000_school-payment-batches.sql` + `payments.routes.ts` |
| T24 | ✅ | Add referral_code column to registrations | `1746400000000_add-referral-code.sql` + `registrations.routes.ts` |
| T25 | ✅ | Admin refund endpoint | `midtrans.service.ts` + `admin.routes.ts` |

### SPRINT 9 — Web Portal QA Pass (May 6, 2026) ✅ COMPLETE
| Fix | What | Key files |
|---|---|---|
| DB rename | PostgreSQL `beyond_classroom` → `kompetix` locally; `.env` + `.env.example` updated | `backend/.env`, `backend/.env.example` |
| Role selector | `/` is now a role-selector landing page (Admin / Organizer / Teacher-soon) instead of redirect | `web/app/page.tsx` |
| Back buttons | `← Back` on both login pages to return to role selector | `web/app/login/page.tsx`, `web/app/(organizer)/organizer-login/page.tsx` |
| School column fix | `s.school` → `s.school_name` in all 6 queries across admin & organizer routes | `backend/src/routes/admin.routes.ts`, `backend/src/routes/organizer.routes.ts` |
| Organizer competitions | Assigned all 21 NULL-owned competitions to organizer account; `POST /admin/competitions` now sets `created_by` | `backend/src/routes/admin.routes.ts` |
| Admin registrations | Page now shows all statuses with filter tabs (All/Pending/Registered/Paid/Rejected) | `web/app/(dashboard)/registrations/page.tsx`, `backend/src/routes/admin.routes.ts` |
| Organizer login redirect | Fixed wrong redirect `/organizer/organizer-dashboard` → `/organizer-dashboard` | `web/app/(organizer)/organizer-login/page.tsx` |
| Participants status | Fixed STATUS_CLS map and approve/reject button condition (was using wrong statuses) | `web/app/(organizer)/participants/page.tsx` |
| Missing API methods | Added `competitionsApi.create/update/delete` to web API client | `web/lib/api/index.ts` |
| Null guards | Defensive `?? []` / `?? 0` on users/schools pagination state setters | `web/app/(dashboard)/users/page.tsx`, `web/app/(dashboard)/schools/page.tsx` |
| Revenue page | New organizer revenue page with stat cards + per-competition table | `web/app/(organizer)/revenue/page.tsx` |
| Dead code | Removed unused OrganizerSidebar component from organizer layout | `web/app/(organizer)/layout.tsx` |
| Types | PendingRegistration student sub-fields marked optional | `web/types/index.ts` |

### SPRINT 10 — Mobile Bug Fixes (May 6, 2026 Session 2) ✅ COMPLETE
| Fix | What | Key files |
|---|---|---|
| Payment: "Kembali" → "Back" | Indonesian string hardcoded in pay.tsx | `app/app/(payment)/pay.tsx` |
| Payment: webhook race condition | After paying and closing browser, `refreshRegistrations()` was called before the Midtrans webhook updated the DB. Fix: poll `GET /registrations/:id` up to 4× (every 2s, max ~6s) before giving up. Screen shows "Verifying payment status..." during poll. | `app/app/(payment)/pay.tsx` |
| Payment: "Another web browser is already open" | iOS keeps previous `openAuthSessionAsync` session "alive" briefly. Fix: call `WebBrowser.dismissAuthSession()` before every `openAuthSessionAsync` call. | `app/app/(payment)/pay.tsx` |
| Teacher sees Discover screen on login | `_layout.tsx` defaulted `userRole` to `"student"` before context loaded → competitions tab became visible → tab navigator landed there. Fix: default to `""` (empty string) so all role-specific tabs stay hidden during load. | `app/app/(tabs)/_layout.tsx` |
| Teacher redirect safety net | `competitions.tsx` also defaulted to "student" and had no redirect for teachers. Fix: added `useEffect` that redirects teachers to `/(tabs)/teacher-dashboard` and admins to `/(tabs)/web-portal-redirect` when `userRole` resolves. | `app/app/(tabs)/competitions.tsx` |
| Teacher "monitoring mode" | Removed Bulk Registration and Export Student Data from teacher quick actions. Replaced with monitoring-only tiles: Competitions, View Reports, Deadlines, My Students. Updated web portal banner text to remove bulk registration mention. | `app/app/(tabs)/teacher-actions.tsx` |

### SPRINT 13 — Production Infra Templates (May 9, 2026 Session 5) ✅ LOCAL ARTIFACTS DONE
| Item | What | Files |
|---|---|---|
| nginx config | Reverse proxy + SSL termination for api/admin/organizer/school/partner subdomains, 12 MB body limit, HTTP→HTTPS redirect | `deploy/nginx.conf` |
| pm2 supervisor | Cluster mode for backend (one worker per CPU), single fork for Next.js, log rotation paths | `deploy/pm2.config.js` |
| Expo build config | development/preview/production profiles; production sets EXPO_PUBLIC_API_URL=`https://api.competzy.com/api` | `app/eas.json` |
| k6 load test | 500-VU ramp testing signup → /me → /competitions → POST /registrations; thresholds p95<2s, error<2% | `loadtest/k6-registration.js`, `loadtest/README.md` |
| Runbook | Deploy steps, common incident playbooks (API down, payment stuck, signed-URL 403, soft-delete recovery, audit-log forensics, rollback) | `docs/RUNBOOK.md` |

### SPRINT 19 — Gen Z Playful Redesign + English/Back-Nav Mop-up (May 12, 2026 Session 7) ✅ COMPLETE
| Task | What | Key files |
|---|---|---|
| 19.1 | **Design tokens overhauled** — `Brand` swapped to vibrant purple (`#6F4FE8`) + navy (`#1E2A78`) + sunshine (`#F8D24A`) + coral (`#F47B5A`) + mint (`#7BD389`) + sky (`#C5D8FF`) + lavender background (`#FAF8FF`). `Radius` scale bumped (sm→10, lg→18, 2xl→28, 3xl→36, new 4xl→44). New `Shadow.playful` clay halo using `Brand.primary`. Display weights bumped to 800/900. Added `subjectColorFor()` deterministic palette picker and `Brand.{navy,sunshine,coral,mint,sky}*` aliases. | `app/constants/theme.ts` |
| 19.2 | **Shared playful primitives** — new `SubjectCircle` (colored disk with subject letter, used wherever competitions are listed), `StatTile` (label + value + icon in pastel-tinted clay block), `GeometricHeader` (SVG hero with overlapping coral/sunshine/navy shapes — Profile uses this). `Card` gains `variant="playful"` (Radius 3xl + Shadow lg). `EmptyState` gains `icon` + `tint` props for vector-icon support. `Button` primary uses `Shadow.playful` + 0.97 press-scale. | `app/components/ui/{SubjectCircle,StatTile,GeometricHeader}.tsx`, `app/components/ui/{Card,Button,EmptyState,index}.ts*` |
| 19.3 | **Screen redesigns** — Discover (chunky search, SubjectCircle on cards, vibrant category chips with letter-disks), My Competitions (Ionicon tab bar, color-coded status), Profile (GeometricHeader purple/coral/sunshine, StatTile row for Total/Active/Done, pastel-tinted menu icon disks, "Keep Learning ✨" footer), Competition Detail (white-halo hero with sunshine accent + 4xl bottom corners, `variant="playful"` section cards), Registration Details (hero gets sunshine + coral blobs, all cards `playful`), Onboarding (Ionicons hero on layered blobs, larger 168×168 icon tile), Notifications (icon-tinted disks, status-coloured left border via `accentColor`). All emoji usages converted to `@expo/vector-icons/Ionicons`. | `app/app/(tabs)/{competitions,my-competitions,notifications,my-registration-details,profile/index,competitions/[id]}.tsx`, `app/app/(onboarding)/index.tsx` |
| 19.4 | **Sprint 18 leakage mop-up** — fixed strings that escaped the English pass: `"Approved / Bergabung"` → `"Joined"`, `"Lokasi/Platform"` → `"Location/Platform"`, `compName ?? "Kompetisi"` → `"Competition"`, `"Round & Jadwal"` → `"Round & Schedule"`, `"Completedkan pembayaran…"` → `"Complete the payment…"`, `"✓ Bergabung"` → `"✓ Joined"`, `"Kategori:"` filter → `"Category:"`, `"About Kompetisi"` → `"About Competition"`, `Categories` heading. Date locale `id-ID` → `en-US` in 5 more files (my-registration-details, notifications, competitions, competitions/[id], profile/document-vault). Currency stays `id-ID` (period thousand separator). | `app/app/(tabs)/my-registration-details.tsx`, `app/app/(tabs)/my-competitions.tsx`, `app/app/(tabs)/competitions.tsx`, `app/app/(tabs)/competitions/[id].tsx`, `app/app/(tabs)/notifications.tsx`, `app/app/(tabs)/profile/document-vault.tsx`, `app/app/(tabs)/profile/history.tsx` |
| 19.5 | **Back-nav holdouts unified** — Sprint 18.4 unified back affordance on 4 screens; 5 stragglers still had `"← Back"` text links. Replaced with circular-chevron `ScreenHeader` on `profile/edit`, `profile/document-vault`, `teacher-actions`, and both wizard steps in `(auth)/register` (the multi-step register keeps `setStep("role")` as the back action instead of `router.back()`). Pay screen's footer cancel link is intentionally left as text (it's not a header). Dead `backButton`/`backButtonText`/`title`/`header` styles removed. | `app/app/(tabs)/profile/edit.tsx`, `app/app/(tabs)/profile/document-vault.tsx`, `app/app/(tabs)/teacher-actions.tsx`, `app/app/(auth)/register.tsx` |

### SPRINT 20 — Unified Login + De-Brand to Competzy (May 13, 2026 Session 10) — Phase A of EMC Wave 1 ✅ COMPLETE
| Task | What | Key files |
|---|---|---|
| 20.1 | **Ship May 12–13 working tree** — unified email/password login at `/` (split-screen, role auto-route, session detection, theme toggle); per-role login pages deleted (`/login`, `/organizer-login`, `/school-login`); competition-portal scaffolding (`/emc/{register,dashboard,admin}` with generic `SplitScreenAuth` + `BrandPanel` + `CompetitionAuthProvider`); slug migration `1748000000000_add-competition-slug` (adds `competitions.slug` + seeds EMC 2026 de-branded); backend CORS opens any `http://localhost:<port>` in dev. | `web/app/page.tsx`, `web/app/(competitions)/emc/{register,dashboard,admin}/*`, `web/components/competition-portal/*`, `web/lib/auth/{factory,emc-context}.tsx`, `web/lib/competitions/emc.ts`, `backend/migrations/1748000000000_add-competition-slug.sql`, `backend/src/index.ts` |
| 20.2 | **Migration `1747600000000` hot-fix** — column-name typos: `competition_id` → `comp_id`, `p.status='settled'` → `p.payment_status='settlement'`. | `backend/migrations/1747600000000_promote-legacy-approved-registrations.sql` |
| 20.3 | **De-brand to Competzy-only** — every user-visible "Eduversal" / "Eduversal Foundation" string replaced with Competzy or competition-specific names: login page brand label + footers (4 strings), generic `BrandPanel` label + footer (2 strings), EMC wordmark (`Eduversal Mathematics Competition` → `Mathematics Competition`), Privacy + Terms boilerplate ("operated by Eduversal" → platform-neutral), mobile profile/history copy (2 strings), Achievement PDF footer + subtitle (2 strings), `schools.routes.ts` spec comment. Seed data: `organizer_name: "Eduversal Foundation"` → `"Competzy Foundation"` in `seed.ts` (3 rows), `organizerName: "Eduversal"` → `"Competzy"` in `seed-competitions-from-csv.ts`. Slug migration `1748000000000` body de-branded + idempotent `UPDATE` clauses appended so any previously-seeded local DB row gets renamed on re-run. | `web/app/page.tsx`, `web/components/competition-portal/BrandPanel.tsx`, `web/lib/competitions/emc.ts`, `web/app/{terms,privacy}/page.tsx`, `app/app/(tabs)/profile/history.tsx`, `backend/src/routes/schools.routes.ts`, `backend/src/db/{seed,seed-competitions-from-csv}.ts`, `backend/migrations/1748000000000_add-competition-slug.sql` |
| 20.4 | **Intentionally kept** (internal-only) — test fixture emails `admin@eduversal.com` / `organizer@eduversal.com` (working dev credentials); historical-import script's `Eduversal_Database.xlsx` filename ref; migration header comments mentioning Eduversal as data source; historical sprint logs in CLAUDE.md. See `feedback_brand_competzy_only.md` for the rule. | n/a |
| 20.5 | **`.gitignore`** — added `graphify-out/.rebuild.lock` so the local rebuild lock doesn't keep appearing in `git status`. | `.gitignore` |

### SPRINT 16 — School Portal Soft Launch (May 9, 2026 Session 5) ✅ COMPLETE
| Task | What | Key files |
|---|---|---|
| 16.1 | **School signup + verification flow** — new migration `1747500000000_school-verification.sql` adds `verification_status`, `verification_letter_url`, `applied_by_user_id`, `applied_at`, `verified_at`, `verified_by_user_id`, `rejection_reason` columns. Existing rows default to `verified` to preserve seeded data. New `POST /api/schools/signup` (public) creates school + school_admin user in one transaction. New admin endpoints `GET /api/admin/schools/pending`, `POST /api/admin/schools/:id/verify`, `POST /api/admin/schools/:id/reject` (all wrapped in `audit()`). `/api/auth/me` exposes `schoolVerificationStatus` + rejection reason. | `backend/migrations/1747500000000_school-verification.sql`, `backend/src/routes/schools.routes.ts`, `backend/src/routes/admin.routes.ts`, `backend/src/routes/auth.routes.ts` |
| 16.2 | **Layout gating** — unverified `school_admin` users land on `/school-pending`; `/school-signup` is reachable unauthenticated. New web pages `/school-signup` and `/school-pending`. New admin page `/schools-pending` with verify/reject UI. Sidebar gains "Pending Schools" link. | `web/app/(school)/layout.tsx`, `web/app/(school)/school-signup/page.tsx`, `web/app/(school)/school-pending/page.tsx`, `web/app/(dashboard)/schools-pending/page.tsx`, `web/components/Sidebar.tsx` |
| 16.3 | **Achievement PDF export** — new `GET /api/schools/export/achievement.pdf` renders A4 PDF with school name + NPSN header, per-student rows from historical_participants + recent registrations, page-break safety, Eduversal/Competzy brand strip. School dashboard gains "Achievement PDF" tile. | `backend/src/routes/schools.routes.ts`, `web/app/(school)/school-dashboard/page.tsx` |
| 16.4 | **Bulk-payment payer attribution** — `/api/payments/school-batch` now passes the school's name as Midtrans `customer_name` (was the coordinator's personal name). Receipts go to coordinator email but receipt-bearing party is the school. | `backend/src/routes/payments.routes.ts` |

### SPRINT 15 — Launch 1 Polish (May 8, 2026 Session 4) ✅ COMPLETE
| Task | What | Key files |
|---|---|---|
| 15.1 | **3 missing organizer CRUD pages** — pages were already built by teammate; added missing `postPaymentRedirectUrl` field (form input + backend POST/PUT support) for the redirect-to-existing-platform flow. | `backend/src/routes/organizer.routes.ts`, `web/app/(organizer)/organizer-competitions/{new,[id]/edit}/page.tsx` |
| 15.2 | **/completeness endpoint** — `GET /api/registrations/:id/completeness` returns per-requirement boolean (profile, documents, payment, school NPSN, parent linked) + `is_ready`. Powers pre-payment gating now and pre-exam gating in Launch 2. | `backend/src/routes/registrations.routes.ts` |
| 15.3 | **Person-KID** — new migration adds `users.kid` (`KX-2026-NNNNNNN`) with sequence + backfill. UNIQUE indexed. Exposed in `/api/auth/me`. Distinct from registration_number. | `backend/migrations/1747200000000_add-person-kid.sql`, `backend/src/routes/auth.routes.ts` |
| 15.4 | **Parent-payer attribution UI** — new migration adds `payments.payer_user_id` + `payer_kind`. Backend `POST /api/payments/snap` accepts optional `payerKind` + `payerUserId`. Mobile `pay.tsx` adds 4-option "Dibayar Oleh" radio screen before Snap launches; auto-launch removed. | `backend/migrations/1747400000000_add-payer-user-id.sql`, `backend/src/routes/payments.routes.ts`, `app/services/payments.service.ts`, `app/app/(payment)/pay.tsx` |
| 15.5 | **Profile snapshot mobile display** — already implemented (line 162 `my-registration-details.tsx`). | `app/app/(tabs)/my-registration-details.tsx` |
| 15.6 | **Bulk CSV hard-match dedup** — when NISN + email both miss, `LOWER(full_name) + school + grade` exact match links to existing student instead of creating duplicate. Ambiguous (>1) matches throw. | `backend/src/services/bulk-processor.service.ts` |
| 15.7 | **Admin segments viewer** — `GET /api/admin/segments` returns 3 pre-built audiences: lapsed >1y, multi-comp veterans, EMC-only never tried KMC. New `/segments` web page. | `backend/src/routes/admin.routes.ts`, `web/app/(dashboard)/segments/page.tsx` |
| 15.8 | **Cross-comp KPI dashboard** — `GET /api/admin/kpi` returns totals (registrations, paid, free, revenue Rp), paid rate, avg time-to-payment, top-3 competitions, 90-day daily series. Admin dashboard page rewritten with stat cards + sparkline + top-3 panel. | `backend/src/routes/admin.routes.ts`, `web/app/(dashboard)/dashboard/page.tsx` |
| 15.9 | **Calendar/.ics export** — `GET /api/registrations/:id/calendar.ics` returns RFC 5545 single-event iCal with 3h default duration and proper escaping. | `backend/src/routes/registrations.routes.ts` |
| 15.10 | **Drop orphan column** — `students.parent_school_id` removed (was orphaned from earlier schema rev). | `backend/migrations/1747300000000_drop-orphan-parent-school-id.sql` |
| 15.11 | **Double-stringify audit** — confirmed `app/services/competitions.service.ts:96` was the only offender (already fixed). Other `JSON.stringify` usages all use `fetch()` directly, not `apiRequest`. | n/a |

### SPRINT 14 — Compliance & Security Hardening (May 8–9, 2026 Sessions 4–5) ✅ COMPLETE
| Task | What | Key files |
|---|---|---|
| 14.1 | **Audit log table + middleware** — new migration creates append-only `audit_log` (id, user_id, user_role snapshot, action, resource_type, resource_id, ip, user_agent, payload JSONB, created_at) with indexes. New `audit()` middleware redacts password/token/PIN/OTP from payload, fires async (never blocks request), logs only on 2xx. Wired to 16 admin/organizer/school routes. | `backend/migrations/1746900000000_audit-log.sql`, `backend/src/middleware/audit.ts`, `backend/src/routes/{admin,organizer}.routes.ts` |
| 14.2 | **Soft delete on 9 PII tables** — migration adds `deleted_at` to users, students, parents, teachers, registrations, payments, documents, historical_participants, notifications + partial "live" indexes. New `query-helpers.ts` with `liveFilter()`, `softDelete()`, `restore()` (whitelisted tables). Auth middleware now rejects soft-deleted users with 401. | `backend/migrations/1747000000000_soft-delete.sql`, `backend/src/db/query-helpers.ts`, `backend/src/middleware/auth.ts` |
| 14.3 | **Retention enforcement cron** — daily 02:00: soft-delete documents whose competition ended >1 year ago, hard-delete audit_log >5 years, hard-delete read notifications >1 year. | `backend/src/services/cron.service.ts` |
| 14.4 | **Signed URLs for documents** — new `getSignedUrl()` in storage.service: S3 presigned via `@aws-sdk/s3-request-presigner` (15-min expiry) for production, JWT-token URL via new `/uploads-signed/:token` endpoint for local dev. `/api/documents` returns signed URLs. | `backend/src/services/storage.service.ts`, `backend/src/index.ts`, `backend/src/routes/documents.routes.ts` |
| 14.5 | **httpOnly cookie auth migration** — backend installs cookie-parser, login endpoints set `competzy_token` httpOnly + SameSite=Lax + Secure-in-prod cookie via `issueAuthCookie()`. New `POST /api/auth/logout` clears it. Auth middleware reads Bearer header first then falls back to cookie. CORS opts in to credentials with explicit origin allowlist. Web client rewritten with `credentials: 'include'`; all 3 auth contexts hydrate via `/api/auth/me`. localStorage no longer used by web. **Single-session change**: a browser can't be both admin and organizer simultaneously. | `backend/src/index.ts`, `backend/src/middleware/auth.ts`, `backend/src/routes/auth.routes.ts`, `web/lib/api/client.ts`, `web/lib/auth/{context,organizer-context,school-context}.tsx` |
| 14.6 | **Rate limit bulk uploads** — new `bulkUploadLimiter` (3/hour per user) added to `/api/bulk-registration/upload`. | `backend/src/middleware/rate-limit.ts`, `backend/src/routes/bulk-registration.routes.ts` |
| 14.7 | **Webhook idempotency** — new `payment_webhook_events` table with UNIQUE(provider, order_id, signature_key). Webhook handler INSERTs ON CONFLICT DO NOTHING; if dup, returns 200 noop without re-processing. Prevents double-settlement on Midtrans retries. | `backend/migrations/1747100000000_payment-webhook-events.sql`, `backend/src/routes/payments.routes.ts` |
| 14.8 | **Privacy + Terms placeholder pages** — UU PDP-aware drafts at `/privacy` and `/terms` (DRAFT, needs counsel review). Footer link from `/` role selector. | `web/app/privacy/page.tsx`, `web/app/terms/page.tsx`, `web/app/page.tsx` |
| 14.9 | **Error handler upgrade** — respects `err.statusCode`, logs 4xx as warn (5xx as error), structured JSON response, doesn't leak internal messages on 5xx. body-parser 400s no longer pollute the error log as "Unhandled error". | `backend/src/middleware/error-handler.ts` |

### SPRINT 12 — Rebrand Kompetix → Competzy (May 8, 2026 Session 4) ✅ COMPLETE
| Fix | What | Key files |
|---|---|---|
| Display name | All UI strings, emails, push titles, splash text rebranded `Kompetix` → `Competzy` | `web/app/**`, `app/app/**`, `backend/src/services/email.service.ts` |
| App identity | Expo `name`/`slug`/`scheme` updated; deep-link scheme `kompetix://` → `competzy://`; Midtrans callbacks updated | `app/app.json`, `app/app/(payment)/pay.tsx`, `backend/src/services/midtrans.service.ts` |
| Package names | npm `name` fields rebranded across root, `app/`, `web/`, `backend/` | `package.json`, `app/package.json`, `web/package.json`, `backend/package.json` |
| GitHub URL | Updated to `github.com/codewithmujtabo/competzy` (manual repo rename still required on GitHub) | `CLAUDE.md` |
| Domain references | All `kompetix.id` / `kompetix.com` → `competzy.id` / `competzy.com` | `app/app/(tabs)/teacher-actions.tsx`, `app/app/(tabs)/web-portal-redirect.tsx`, `app/app/(auth)/register.tsx`, `docs/PROJECT_PLAN.md` |
| DB defaults | `MINIO_BUCKET` default `"kompetix"` → `"competzy"`; `SMTP_FROM` default updated; `DATABASE_URL` example updated | `backend/src/config/env.ts`, `backend/.env.example` |
| Reg-number prefix | New migration alters default to `CTZ-2026-XXXXX`. Existing `KMP-2026-*` rows untouched. | `backend/migrations/1746800000000_rebrand-registration-prefix-to-CTZ.sql` |
| On-disk folder | Disk folder renamed `kompetix/` → `competzy/` (May 8, 2026). Folder diagrams and `cd …` examples in docs updated. | n/a |

### SPRINT 11 — Bug Fixes (May 6, 2026 Session 3) ✅ COMPLETE
| Fix | What | Key files |
|---|---|---|
| Teacher DB migration | `teacher_student_links` table was missing locally → "relation does not exist" when adding student by email. Fix: `npm run db:migrate`. | `backend/migrations/1746500000000_teacher-student-links.sql` |
| Role-aware profile edit | `edit.tsx` was showing "Student Details" + all student fields for every role. Rewritten to render role-specific sections: student (full), teacher (personal + professional), parent (personal only). | `app/app/(tabs)/profile/edit.tsx` |
| Teacher profile update | Backend `PUT /api/users/me` only saved `subject` for teachers. Now also saves `school` and `department`. | `backend/src/routes/users.routes.ts` |
| Payment verify endpoint | After paying, app showed "Payment Completed!" based on redirect URL params, but DB still showed `registered` (webhook never fires to localhost in sandbox). Added `GET /api/payments/verify/:registrationId` that calls Midtrans Status API, force-updates DB if settled. | `backend/src/routes/payments.routes.ts`, `backend/src/services/midtrans.service.ts` |
| pay.tsx verify flow | App now always calls verify endpoint after browser close instead of trusting URL params. Polls up to 6× with 3s gaps. Only shows "Payment Completed!" when DB confirms `paid`. | `app/app/(payment)/pay.tsx`, `app/services/payments.service.ts` |

### SPRINT 8 — UX Fixes & Data Scoping (May 5, 2026) ✅ COMPLETE
| Task | What | Key files |
|---|---|---|
| T26 | **Historical phone login** — phone OTP matched to `historical_participants` returns `{ historicalMatch }` instead of NO_ACCOUNT; app routes to new `claim-account.tsx` screen pre-filled with name/email | `auth.routes.ts`, `app/(auth)/claim-account.tsx`, `app/(auth)/login.tsx`, `auth.service.ts` |
| T27 | **Remove payment proof upload** — Midtrans webhook auto-confirms; webhook now marks `registrations.status = 'paid'` on settlement; removed upload-proof + manual-intent + GET-proof endpoints | `payments.routes.ts`, `app/(payment)/pay.tsx`, `my-competitions.tsx` |
| T28 | **Admin registration approval flow** — all new registrations start as `pending_approval`; admin approves on web → `registered` (paid comp) or `paid` (free); student notified | `registrations.routes.ts`, `admin.routes.ts`, `web/app/(dashboard)/registrations/page.tsx`, `web/components/Sidebar.tsx`, `web/lib/api/index.ts`, `web/types/index.ts`, `my-competitions.tsx`, `AuthContext.tsx` |
| T29 | **Teacher roster scoping** — new `teacher_student_links` table; teacher adds students by email; all teacher queries (students, analytics, dashboard) now scoped to linked students only; `teacher-analytics.tsx` repurposed as "My Competitions" showing which students are registered for each competition | `1746500000000_teacher-student-links.sql`, `teachers.routes.ts`, `teachers.service.ts`, `teacher-dashboard.tsx`, `teacher-students.tsx`, `teacher-analytics.tsx`, `teacher-actions.tsx` |

### Dependency Map
```
T5 (reg_number) ──────────► T16 (mobile shows it)
T6 (profile_snapshot) ────► T17 (mobile shows it)
T7 (organizer role) ──────► T8 (organizer routes) ──► teammate can build portal
T9 (JWT redirect) ────────► T17 (mobile redirect button)
T11 (DB table) ──► T12 (import) ──► T13 (auto-link) ──► T14 (claim API) ──► T18 (mobile history)
T21 (MinIO) ──────────────► T22 (storage migration)
```

### Week-by-Week Schedule
| Week | Dates | Sprint | Key Deliverable |
|---|---|---|---|
| 1 | May 5–11 | 0 + 1 | App renamed, admin removed from mobile, reg_number, profile_snapshot, organizer role |
| 2 | May 12–18 | 2 | All 12 organizer endpoints → teammate unblocked |
| 3 | May 19–25 | 3 + 4 setup | Payment fixes, historical table + import script |
| 4 | May 26–Jun 1 | 4 complete | Auto-link, claim API, historical mobile screen |
| 5 | Jun 2–8 | 5 | Mobile polish — recommendations, reg numbers, history, teacher cleanup |
| 6 | Jun 9–15 | 6 | MinIO migration |
| 7–8 | Jun 16–30 | Integration + QA | End-to-end testing with teammate's web portals |
| Buffer | Jul 1–10 | Launch prep | App Store submission, production keys |

---

## Known Issues / Quirks

- ~~`next.config.ts` exists in `web/` alongside `next.config.mjs`.~~ Removed.
- ~~`web/tsconfig.tsbuildinfo` is committed.~~ Untracked + `*.tsbuildinfo` gitignored.
- ~~`app/constants/api.ts` and `app/config/api.ts` both exist.~~ Legacy `constants/api.ts` deleted; `admin.service.ts` now imports from `config/api.ts` directly.
- Competition `id` column is `TEXT` (not UUID) — changed in migration `1744070500000`. IDs look like `comp_emc_2026_main`.
- ~~The `students` and `parents` tables have orphaned `parent_school_id` columns (Sprint 7 to drop).~~ Dropped on `students` in Sprint 15 migration `1747300000000`. `parents` table never had the column despite earlier comments.
- Disk folder renamed `kompetix/` → `competzy/` on May 8, 2026. Reopen any IDE workspace, terminal tab, or Claude Code session that pointed at the old path: `/Users/<you>/Desktop/All/Internship Eduversal/competzy/`.
- DB rename history: `beyond_classroom` → `kompetix` (May 6, 2026, local only) → `competzy` (May 8, 2026, local **applied ✅**). VPS still pending: `ALTER DATABASE … RENAME TO competzy;` + update `DATABASE_URL`.
- Registration number prefix rebranded `KMP-2026-XXXXX` → `CTZ-2026-XXXXX` on May 8, 2026 via migration `1746800000000_rebrand-registration-prefix-to-CTZ.sql`. Existing rows keep their `KMP-` numbers; only new rows pick up the new default.
- ~~There are 3 registrations with status `approved` in the DB (legacy status, pre-T28).~~ Migration `1747600000000_promote-legacy-approved-registrations.sql` promotes them to `paid` (free comp or settled-payment) or `registered` (paid comp, no settled payment). Run on VPS to clear them there too.
- `competitions.tsx` defaults `userRole` to `""` (not "student") when user context hasn't loaded. Guard: `useEffect` redirects teachers/admins away. Same change in `_layout.tsx`.
- `pay.tsx` polling: after browser close (any path), calls `GET /api/payments/verify/:registrationId` up to 6× with 3s gaps. The verify endpoint calls Midtrans Status API and force-updates DB — this is what makes sandbox work without a live webhook. In production the webhook arrives first and verify is a no-op.
- **Sprint 14 dual-auth quirk:** auth middleware accepts both Authorization Bearer header AND `competzy_token` cookie. This means existing localStorage-based logins (from before the cookie migration) continue to work in the wild as long as the JWT hasn't expired. Once everyone re-logins or the JWT TTL elapses (7 days), only cookies will be in use.
- **Sprint 14 retention sweep**: kicks in nightly. If you accidentally delete a doc-related `competition_date` in the past, the next 02:00 run will soft-delete those docs. Use `restore()` from `query-helpers.ts` to recover.
- **`/uploads/...` static path is still served unsigned by the backend** for backward-compat in dev. Production nginx config (`deploy/nginx.conf`) now returns 404 for `/uploads/` on `api.competzy.com`, so signed URLs are the only public access path.
- **Cookie auth single-session caveat**: one browser → one session. Admins who used to keep admin + organizer tabs open simultaneously must now use two browsers or two profiles.
- **`docs/PROJECT_PLAN.md` and `docs/PROJECT_PLAN.docx`** are out-of-sync with this CLAUDE.md after Sprint 14–16. Treat CLAUDE.md as the source of truth; update PROJECT_PLAN later if needed for stakeholder reporting.
- **Brand rule (Sprint 20):** platform is Competzy-only — no user-visible "Eduversal" references. Internal dev artifacts (test fixture emails `admin@eduversal.com` / `organizer@eduversal.com`, historical-import script's `Eduversal_Database.xlsx` filename ref, migration header comments) are intentionally kept. See memory `feedback_brand_competzy_only.md`. When in doubt, ask before stripping.
- **EMC competition portal still on `/emc/*` paths** after Phase A; Phase C of Wave 1 generalizes to `/competitions/[slug]/*`. Until then, student/parent post-login routes to `/emc/dashboard`. After Phase C: `/competitions/emc-2026/dashboard`.

---

## Session Workflow

- Tasks tracked in `docs/PROJECT_PLAN.md` — update status there as work completes.
- Commit after each logical unit of work with a descriptive message.
- Before context runs out: ask Claude to summarize session and update this CLAUDE.md.
- When starting fresh: read this file + `git log --oneline -10` + `git status` to orient.
