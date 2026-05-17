# Competzy — Project Plan & Status

**Version:** 2.0 · **Last updated:** May 17, 2026
**Status:** Build complete — Sprints 0–32 and the EMC Port (Waves 1–13) all shipped. What remains is the production rollout (see "Remaining Work").

> This is the stakeholder-facing summary. The canonical, blow-by-blow
> engineering record is **`CLAUDE.md`** at the repo root — its "Sprint Plan
> (Full Roadmap)" section has every sprint and every EMC-port wave in detail.
> This document is the higher-level overview kept in sync with it.
> `docs/PROJECT_PLAN.docx` is an older copy and is **out of date** — treat this
> `.md` and `CLAUDE.md` as current.

---

# TAB 1 — Project Overview

## What is Competzy?

Competzy is Indonesia's unified K-12 academic competition platform. It replaces a fragmented ecosystem where every competition (EMC, ISPO, OSEBI, Komodo, Owlypia, etc.) had its own separate website, login, and payment system.

It brings everything into one place:
- **Students** discover and register for competitions, pay, sit online exams, and track results
- **Parents** monitor their children's registrations and pay on their behalf
- **Teachers** monitor the students they supervise (monitoring-only — heavy operations are on the web)
- **Organizers** create competitions, build the question bank, run exams, and manage revenue
- **Schools** register students in bulk and pay as an institution
- **Admins** operate the full platform

---

## Current Status (May 17, 2026)

**The platform is feature-complete.** Sprints 0–32 are done, and the **EMC Port** — porting the full legacy `eduversal-team/emc` feature set onto Competzy's stack — is complete through **Wave 13**:

| Wave | Delivered |
|---|---|
| 1 | De-brand to Competzy-only, production-grade unified login + forgot-password, slug-routed competition portals, the 31-table multi-tenant EMC schema |
| 2 | Professional web UI/UX unification — every web surface on one shared design system (Tailwind v4 + shadcn/ui + recharts); `web/` upgraded to Next.js 16 / React 19 |
| 3 | Mobile app re-theme on the competzy.com brand identity |
| 4 | `/competitions` catalog + a per-competition config-driven step-flow engine |
| 5 | Affiliated competitions — register + pay on Competzy, then compete on an external site via issued credentials |
| 6 | The question bank — subject/topic taxonomy, MC + short-answer questions, the draft→submitted→approved review workflow |
| 7 | Exam delivery — online + paper, the exam builder, online attempts, manual grading |
| 8 | Test centers, areas, and best-effort webcam proctoring |
| 9 | Commerce — registration-fee vouchers, a merchandise store, orders |
| 10 | Marketing — affiliate referrals, announcements, study materials, feedback |
| 11 | Mobile rollout of the student exam / voucher / announcements / materials / feedback surfaces |
| 12 | Certificates — auto-issued PDF certificates with QR + Code128 barcode verification |
| 13 | The mobile merchandise store (catalog / cart / checkout / order history) |

Wave 14 (a legacy `kompetisi.net` MySQL import) was investigated and **found unnecessary** — no MySQL dump exists, and Sprint 4's historical import already covers every competition. **The EMC port is complete at Wave 13.**

---

## Portal Map

| Portal | Platform | Status |
|---|---|---|
| Student / Parent / Teacher app | Mobile (Expo SDK 52) | ✅ Built |
| Admin portal | Web (Next.js 16) | ✅ Built |
| Organizer portal | Web | ✅ Built |
| School portal | Web | ✅ Built |
| Student competition portal | Web | ✅ Built |
| Question-bank / operator workspace | Web | ✅ Built |

Country-rep and referral functions were folded into the existing surfaces — regional schools live in the `schools` directory; affiliate referrals are managed inside the operator workspace (Wave 10) — rather than shipped as separate portals.

---

## Platform Architecture

```
competzy/
├── app/        React Native (Expo SDK 52) — student, parent, teacher (light)
├── web/        Next.js 16 App Router + React 19 — admin, organizer, school,
│               student competition portals + the operator workspace
└── backend/    Express.js 5 + PostgreSQL — one shared API (port 3000)
```

**All three share one database. There is no separate backend for the web.**

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile app | React Native + Expo SDK 52 + TypeScript (Expo Router) |
| Web portals | Next.js 16 App Router + React 19 + TypeScript + Tailwind v4 + shadcn/ui |
| Backend | Express.js 5 + TypeScript + node-pg (raw SQL, no ORM) |
| Database | PostgreSQL — self-hosted on VPS |
| Auth | JWT (7-day) — httpOnly cookie on web, Bearer token on mobile; Email + Phone OTP |
| Payments | Midtrans Snap (GoPay, OVO, Dana, Bank VA, QRIS) |
| File storage | Local disk in dev → MinIO/S3 in production (signed URLs) |
| Push / Email | Expo Push Service / Nodemailer (SMTP) |
| Error tracking | Sentry (backend) |
| Hosting | Self-hosted VPS — no managed DBaaS |

---

## Historical Data (imported ✅)

63,365 real past-participant records were imported (Sprint 4) into the `historical_participants` table. Past participants auto-link their records at login (email/phone match) or claim them manually in the app.

| Competition | Records in the table |
|---|---|
| EMC (Mathematics) | 37,649 |
| OSEBI (Arts & Culture) | 11,568 |
| ISPO (Science Project) | 11,361 |
| Komodo (Mathematics) | 8,659 |
| STEM Olympiad | 1,610 |
| Owlypia | 728 |

Identity matching is by email (88.6% coverage) + phone (96.9%) — the legacy data has no NISN.

---

## Database

The schema is **56 tables** — the core platform (users, students, parents, teachers, competitions, registrations, payments, documents, schools, audit_log, …) plus the **31-table multi-tenant EMC schema** (the question bank, exam delivery, venues, commerce, marketing, config) and the Wave 4+ additions (`competition_flows`, `certificates`). Schema in `backend/src/db/schema.sql`; migrations in `backend/migrations/` (latest: `1749900000000_certificates.sql`).

---

# TAB 2 — Delivery Log

The original May-2 task board listed ~60 to-do items across the backend, mobile app, and web portals. **All Phase 1 and Phase 2 scope shipped** — and well beyond it, via the 14-wave EMC port. Highlights:

**Backend & mobile (Sprints 0–11):** S3/MinIO storage migration; `registration_number` + `profile_snapshot`; the bulk-registration processor (quota-safe); the `organizer` role + the 12 organizer endpoints; the post-payment Midtrans flow + VA-expiry handling; the Beyond Classroom → Kompetix → **Competzy** rebrand; admin screens removed from mobile (web-portal redirect); the historical-data import + auto-link + claim system; teacher roster scoping (monitoring-only on mobile).

**Compliance & launch polish (Sprints 13–20):** the `audit_log` + soft-delete + retention cron; signed file URLs; the httpOnly-cookie auth migration; webhook idempotency; Privacy/Terms drafts; Person-KID; payer attribution; the school self-signup + verification flow; the achievement PDF; the cross-comp KPI dashboard; production infra templates (nginx/pm2/EAS/k6/runbook); the unified login + forgot-password.

**EMC port (Waves 1–13):** see the wave table above and `CLAUDE.md` for per-phase detail.

For the full sprint-by-sprint and wave-by-wave record — including every file touched, every migration, and the per-phase commit log — see the **"Sprint Plan (Full Roadmap)"** section of `CLAUDE.md`.

---

## Phase 1 Launch Checklist (target July 10, 2026)

**Built (✅):**
- [x] Student / parent / teacher mobile app — register, pay, exams, certificates, store, claim history
- [x] Admin, organizer, school, and student competition web portals
- [x] Payment flow end-to-end (Midtrans — currently on **sandbox** keys)
- [x] Historical data imported and claimable
- [x] Signed-URL file storage (S3/MinIO-ready)
- [x] Affiliated-competition post-payment credentials + external redirect

**Pending — see Remaining Work below:**
- [ ] Production deployment to the VPS
- [ ] Midtrans **production** keys
- [ ] Mobile app submitted to the App Store / Play Store

---

# TAB 3 — Remaining Work (Production Rollout)

The codebase is complete; what remains is deployment, which runs on the owner's VPS and external accounts. From `CLAUDE.md` "Manual rollout still required":

- **VPS database** — run all migrations (`1746500000000`–`1749900000000`) on the VPS; rename the VPS database to `competzy`; update `DATABASE_URL`.
- **File storage** — stand up MinIO via Docker on the VPS and set the 5 `MINIO_*` env vars.
- **Deploy** — `deploy/nginx.conf` + `deploy/pm2.config.js`; build `backend/` and `web/`; see `docs/RUNBOOK.md`.
- **DNS + SSL** — A records for `competzy.com`, `api.`, `admin.`, `organizer.`, `partner.`, `compete.` subdomains; `certbot`.
- **Midtrans** — switch to production keys; set the webhook URL to `https://api.competzy.com/api/payments/webhook`.
- **Mobile** — `eas init`; fill `appleId` / `ascAppId` / `appleTeamId`; submit to the App Store + Play Console.
- **api.co.id** — production `API_CO_ID_KEY` for school search.
- **Legal** — counsel review of the DRAFT `/privacy` and `/terms` pages.
- **Load test** — run `loadtest/k6-registration.js` against staging.

**Verification still recommended:** an Expo smoke test of the Wave 12 (certificates) and Wave 13 (store) mobile screens — they are typecheck-verified but not yet confirmed on a device/simulator.

---

*Source of truth: `CLAUDE.md`. This document is the stakeholder summary, updated May 17, 2026.*
