# Competzy — Project Plan & Task Board
**Version:** 1.0 · **Last updated:** May 2, 2026
**Instructions for Google Docs:** Copy each section below into a separate Tab in your Google Doc (General / Your Tasks / Teammate Tasks). In the task tables, edit the Status column as you work — change "☐ To Do" → "⏳ In Progress" → "✅ Done".

---

> ⚠ **This document is out of date for Sprints 14–18.**
> The canonical engineering source of truth is `CLAUDE.md` at the repo root.
> The CRITICAL / HIGH / MEDIUM / LOW task lists below reflect the May 2 plan; the
> current state (as of May 12, 2026) is:
>
> - Sprints 0 through 18 are complete locally; backend, mobile, and web for the
>   July 1 soft launch are shipped.
> - Manual rollout still pending: MinIO Docker on VPS, run migrations on VPS,
>   rename DB on VPS, DNS + SSL, Midtrans production keys, EAS init, App Store /
>   Play Store submission, api.co.id production key, legal review of
>   `/privacy` and `/terms`.
> - For full sprint-by-sprint detail (including Sprints 14 Audit & Compliance,
>   15 Launch 1 Polish, 16 School Portal Self-Signup, and 18 English UI Pass),
>   see the "Sprint Plan (Full Roadmap)" section in `CLAUDE.md`.
>
> Keep this file for stakeholder context; treat the lists below as the original
> plan, not as the live task board.

---
---

# TAB 1 — GENERAL: Project Overview

---

## What is Competzy?

Competzy is Indonesia's unified K-12 academic competition platform. It replaces a fragmented ecosystem where every competition (EMC, ISPO, OSEBI, Komodo, Owlypia, etc.) had its own separate website, login, and payment system. Students had to manage dozens of accounts across different platforms.

Competzy brings everything into one place:
- **Students** discover and register for competitions, pay, and track their results
- **Parents** monitor their children's registrations and pay on their behalf
- **Organizers** create competitions, review participants, and manage payouts
- **Schools** register students in bulk and pay as an institution
- **Country Reps** manage regional schools and consolidate payments
- **Referrals** promote competitions and earn commissions
- **Admins** operate the full platform

---

## Historical Data (from Excel database)

This is real competition data from previous years that will be imported into Competzy so past participants can claim their history.

| Dataset | Count | Notes |
|---|---|---|
| Total student-competition records | 63,365 | Across 54 competitions |
| Unique students (by email) | ~47,976 | ~8,188 registered for multiple competitions |
| Competitions | 54 | EMC, ISPO, OSEBI, Komodo, Owlypia, STEM Olympiad, Webinars |
| Schools | 21,144 | 19,371 from Indonesia + international |
| Parents linked | 29,321 | Already linked to students |
| Supervisors (teachers) | 28,918 | Guru, Dosen, Pembina |
| PAID students | 55,400 (87.4%) | Already paid in past |
| UNPAID students | 7,916 (12.5%) | Registered but never paid |
| Gold medals | 358 | |
| Silver medals | 649 | |
| Bronze medals | 982 | |
| Honorable Mentions | 1,341 | |
| Finalists (PASSED) | 26,007 | |

**Key challenge:** The Excel data has NO NISN numbers. Identity matching must be done via email (88.6% coverage) + WhatsApp (96.9% coverage) + name + school.

---

## Competitions in the Database

| Competition | Years | Total Participants |
|---|---|---|
| EMC (Mathematics) | 2019–2025 | ~34,120 |
| Komodo (Mathematics) | 2020–2026 | ~8,510 |
| ISPO (Science Project) | 2017–2026 | ~7,138 |
| OSEBI (Arts & Culture) | 2019–2026 | ~5,797 |
| STEM Olympiad | 2026 | ~1,610 |
| Owlypia | 2024–2026 | ~464 |
| Webinars (EMC/ISPO/OSEBI) | 2021–2025 | ~5,314 |

---

## Platform Architecture

```
competzy/
├── app/        React Native (Expo) — mobile app
│               Roles: Student, Parent, Teacher (light)
│
├── web/        Next.js 14 — web portals
│               Roles: Admin, Organizer, School, Country Rep, Referral
│
└── backend/    Express.js + PostgreSQL — shared backend
                Single API for both app and web
                Port 3000 (dev)
```

**All three share one database. There is no separate backend for the web.**

---

## Portal Map

| Portal | Platform | Phase | Target Date | Status |
|---|---|---|---|---|
| Student app | Mobile (Expo) | Phase 1 | July 10, 2026 | 🔨 In Progress |
| Parent app | Mobile (Expo) | Phase 1 | July 10, 2026 | 🔨 In Progress |
| Teacher (light view) | Mobile (Expo) | Phase 1 | July 10, 2026 | 🔨 In Progress |
| Admin portal | Web (Next.js) | Phase 1 | July 10, 2026 | 🔨 In Progress |
| Organizer portal | Web (Next.js) | Phase 1 | July 10, 2026 | ❌ Not started |
| School portal | Web (Next.js) | Phase 2 | ~Aug 2026 | ❌ Not started |
| Country Rep portal | Web (Next.js) | Phase 3 | ~Sep 2026 | ❌ Not started |
| Referral portal | Web (Next.js) | Phase 3 | ~Sep 2026 | ❌ Not started |

---

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Mobile app | React Native + Expo + TypeScript | Expo Router (file-based) |
| Web portals | Next.js 14 App Router + TypeScript | All portals in one Next.js project |
| Backend | Express.js 5 + TypeScript | Runs on Node.js |
| Database | PostgreSQL | Self-hosted on VPS |
| Auth | JWT (7-day) + Email OTP + Phone OTP (Twilio) | |
| Payments | Midtrans Snap | GoPay, OVO, Dana, Bank VA, QRIS |
| File storage | Currently local disk → needs S3/MinIO | **Critical to fix before launch** |
| Push notifications | Expo Push Service | For mobile only |
| Email | Nodemailer (SMTP) | OTP, invitations, receipts |
| Error tracking | Sentry | Backend |
| Hosting | Self-hosted VPS | No Supabase/Neon/RDS |

---

## Current Backend API Routes

| Group | Prefix | Key Endpoints |
|---|---|---|
| Auth | `/api/auth` | signup, login, OTP (email + phone) |
| Registrations | `/api/registrations` | create, list, detail, cancel |
| Payments | `/api/payments` | Midtrans Snap, webhook, proof upload |
| Competitions | `/api/competitions` | list, search, detail |
| Bulk Registration | `/api/bulk-registration` | CSV upload, job status |
| Admin | `/api/admin` | competitions, schools, users, registrations, notifications broadcast |
| Teachers | `/api/teachers` | analytics, students, metrics |
| Parents | `/api/parents` | invite, accept, link management |
| Users | `/api/users` | profile, update |
| Schools | `/api/schools` | NPSN search, create |
| Documents | `/api/documents` | upload, list, delete |
| Notifications | `/api/notifications` | list, mark read |
| Regions | `/api/regions` | provinces, regencies (external API) |
| Favorites | `/api/favorites` | add, remove, list |

---

## Database Tables (current)

`users` · `students` · `parents` · `teachers` · `competitions` · `competition_rounds` · `registrations` · `payments` · `documents` · `notifications` · `otp_codes` · `invitations` · `parent_student_links` · `bulk_registration_jobs` · `favorites` · `schools`

---

## Phase 1 Launch Checklist (July 10, 2026)

- [ ] Student portal (mobile): register, pay, track, claim history
- [ ] Parent portal (mobile): monitor child, pay on behalf
- [ ] Organizer portal (web): create competitions, review participants, see revenue
- [ ] Admin portal (web): manage all competitions, users, approve registrations
- [ ] Payment end-to-end (Midtrans production, not sandbox)
- [ ] Historical data imported and claimable
- [ ] File storage on S3/MinIO (not local disk)
- [ ] Post-payment redirect for internal competitions (EMC, ISPO, OSEBI, Komodo)
- [ ] Mobile app submitted to App Store / Play Store

---
---

# TAB 2 — YOUR TASKS (Mobile App + Backend)

**Your role:** You own the mobile app (React Native/Expo) and the shared backend (Express/PostgreSQL).
Write the API contracts for any endpoint your teammate needs, then build them. Your teammate calls your APIs.

**How to use this table:** Change the Status cell as you work.
- `☐ To Do` → `⏳ In Progress` → `✅ Done`

---

## 🔴 CRITICAL — Must finish before Phase 1 (July 10)

| # | Task | Details | File(s) | Priority | Status |
|---|---|---|---|---|---|
| 1 | Fix file storage: local disk → S3/MinIO | Local `/uploads/` will be wiped on any server restart or redeployment. Set up MinIO on your VPS and migrate multer to use S3 SDK. Affects: payment proof, documents, profile photos. | `backend/src/services/storage.service.ts`, `payments.routes.ts`, `documents.routes.ts` | 🔴 Critical | ☐ To Do |
| 2 | Add `registration_number` to registrations | Generate human-readable IDs like `KMP-2026-00001` using a DB sequence. Shown on receipts, WA messages, and participant exports. | `backend/migrations/` (new), `backend/src/routes/registrations.routes.ts` | 🔴 Critical | ☐ To Do |
| 3 | Add `profile_snapshot` to registrations | When a student registers, snapshot their name/school/grade/NISN into a JSONB column. Prevents profile edits from changing historical registration data. | `backend/migrations/` (new), `backend/src/routes/registrations.routes.ts` | 🔴 Critical | ☐ To Do |
| 4 | Fix quota race condition in bulk processor | Currently two bulk jobs running at same time can both read quota=50 and both insert 30 students (total 60, exceeding quota). Fix: `UPDATE competitions SET quota = quota - 1 WHERE id = $1 AND quota > 0 RETURNING quota`. If 0 rows returned: quota exceeded, fail this row. | `backend/src/services/bulk-processor.service.ts` | 🔴 Critical | ☐ To Do |
| 5 | Build backend organizer routes | Your teammate builds the organizer portal UI. You build the API. See the "API Contract" section below for the exact endpoints needed. | `backend/src/routes/organizer.routes.ts` (new file) | 🔴 Critical | ☐ To Do |
| 6 | Add `organizer` role to backend auth | Update the role enum in users table to include `organizer`. Update `POST /api/auth/signup` to handle organizer role data (org name, logo, PIC, bank account). Add `organizerOnly` middleware. | `backend/migrations/` (new), `backend/src/middleware/`, `backend/src/routes/auth.routes.ts` | 🔴 Critical | ☐ To Do |
| 7 | Post-payment JWT redirect endpoint | After Midtrans `settlement` webhook fires for internal competitions (EMC, ISPO, OSEBI, Komodo): generate a signed JWT and include a redirect URL in the webhook response. JWT payload: `{ registration_id, competition_id, student_name, payment_status: 'paid', paid_at, expires_at (24h) }`. | `backend/src/routes/payments.routes.ts`, `backend/src/services/midtrans.service.ts` | 🔴 Critical | ☐ To Do |
| 8 | Rebrand app: "Beyond Classroom" → "Kompetix" → "Competzy" (final, May 8, 2026) | Update `app.json` (name, slug, scheme), splash screen text, and any hardcoded strings in the app. | `app/app.json`, any screen with prior brand text | 🔴 Critical | ✅ Done |
| 9 | Remove admin screens from mobile app | Admin work moves to the web. Remove admin tabs/screens from the mobile app's `_layout.tsx` tab routing. Admin users on mobile should see a message: "Use the web portal at admin.competzy.com". | `app/app/(tabs)/_layout.tsx`, `app/app/(tabs)/admin-*.tsx` | 🔴 Critical | ☐ To Do |
| 10 | Mobile: Show registration number on cards | After adding `registration_number` to backend, update the mobile registration list and detail screens to display it prominently (e.g. `KMP-2026-00001`). | `app/app/(tabs)/my-competitions.tsx`, `app/app/(tabs)/my-registration-details.tsx` | 🔴 Critical | ☐ To Do |

---

## 🟠 HIGH — Phase 1, finish before launch

| # | Task | Details | File(s) | Priority | Status |
|---|---|---|---|---|---|
| 11 | Historical data import script | Write a Node.js/Python script that reads the Excel file and imports it into a new `historical_participants` table. Steps: (1) normalize WhatsApp numbers, (2) map school_ext_id to schools table, (3) normalize payment_method values, (4) deduplicate 420 exact (email, comp_id) pairs, (5) bulk INSERT. | `backend/src/db/import-historical.ts` (new), `backend/migrations/` (new schema) | 🟠 High | ☐ To Do |
| 12 | Create `historical_participants` DB schema | New table: `id, ext_student_id, name, email, grade, gender, school_ext_id, school_name, comp_ext_id, comp_name, comp_year, whatsapp, payment_status, participant_type, finalist_result, winner_medal, linked_user_id, link_method, link_confidence, linked_at, claim_status`. | `backend/migrations/` (new) | 🟠 High | ☐ To Do |
| 13 | Auto-link historical records at login | In `GET /api/auth/me`: after fetching the user, run `UPDATE historical_participants SET linked_user_id=userId, link_method='email', link_confidence=95 WHERE email=user.email AND linked_user_id IS NULL`. Same for phone after OTP verification. This is transparent to the user. | `backend/src/routes/auth.routes.ts` | 🟠 High | ☐ To Do |
| 14 | Build claim system API | Endpoints: `GET /api/historical/suggestions` (returns unlinked records matching user's name+school), `POST /api/historical/claim` (submit a claim, confidence scoring), `GET /api/historical/my-records` (return linked records for current user), `GET /api/admin/historical/claims` (admin review queue). | `backend/src/routes/historical.routes.ts` (new) | 🟠 High | ☐ To Do |
| 15 | Mobile: Historical claims UI | New screen in student profile tab: "Riwayat Kompetisi". Shows auto-linked records and potential matches. User can claim a record → triggers `POST /api/historical/claim`. Show medal badges (🥇🥈🥉) and PASSED/FAILED finalist results. | `app/app/(tabs)/profile/history.tsx` (new) | 🟠 High | ☐ To Do |
| 16 | Mobile: Competition post-payment redirect | After successful payment, if competition is "internal type" (EMC, ISPO, OSEBI, Komodo), show a "Go to competition platform" button that opens the redirect URL with the signed JWT token. | `app/app/(tabs)/my-registration-details.tsx` | 🟠 High | ☐ To Do |
| 17 | Bulk processor: concurrent job support | Replace `SELECT ... WHERE status='pending' LIMIT 1` with `SELECT ... FOR UPDATE SKIP LOCKED LIMIT 1` so multiple workers can process jobs simultaneously without conflicts. Prevents queue starvation with large CSV uploads. | `backend/src/services/bulk-processor.service.ts` | 🟠 High | ☐ To Do |
| 18 | VA expiry handling in payment webhook | When Midtrans sends `expire` status: reset `registration.status` back to `registered` (not deleted) so the student can pay again. Currently it just marks payment as `expired` but leaves the registration in limbo. | `backend/src/routes/payments.routes.ts` (webhook handler) | 🟠 High | ☐ To Do |

---

## 🟡 MEDIUM — Phase 2 (School Portal, ~August)

| # | Task | Details | File(s) | Priority | Status |
|---|---|---|---|---|---|
| 19 | Create `school_payment_batches` DB table | New table for school bulk payments: `id, school_user_id, comp_id, registration_ids[], total_amount, status, midtrans_order_id, snap_token, expires_at, paid_at`. Allows school to pay for all students in one transaction. | `backend/migrations/` (new) | 🟡 Medium | ✅ Done (T23 — `1746300000000_school-payment-batches.sql`, also adds `school_payment_batch_items`) |
| 20 | Build bulk payment endpoint | `POST /api/payments/school-batch`: takes `{ registrationIds[] }`, validates registrations belong to school, creates Snap token for total, persists batch + items. | `backend/src/routes/payments.routes.ts` | 🟡 Medium | ✅ Done (T23) |
| 21 | Mobile teacher: "Pay All" button | In teacher actions screen, after bulk registration completes: show a "Pay for all students" button that triggers the bulk payment flow. Shows breakdown: X students × Rp Y = Rp Z. | `app/app/(tabs)/teacher-actions.tsx` | 🟡 Medium | ☐ To Do |
| 22 | Mobile teacher: per-student payment status | In the teacher's student list, add a payment status column so they can see which students have paid vs. still pending. Color-coded: green=paid, yellow=pending, red=expired. | `app/app/(tabs)/teacher-students.tsx` | 🟡 Medium | ☐ To Do |
| 23 | Mobile teacher: remove heavy ops | Move bulk CSV upload out of mobile into a "use web portal" message. Keep lightweight views: student list, registration status, analytics. Heavy ops (CSV upload, bulk pay) belong on web. | `app/app/(tabs)/teacher-actions.tsx` | 🟡 Medium | ☐ To Do |
| 24 | Backend: add `referral_code` to registrations | Add `referral_code TEXT` column to `registrations` table. Set from cookie/query param when student registers. Needed for Phase 3 referral system. Add it now so data isn't lost retroactively. | `backend/migrations/` (new), `backend/src/routes/registrations.routes.ts` | 🟡 Medium | ✅ Done (T24 — `1746400000000_add-referral-code.sql`, captured in POST /api/registrations body) |
| 25 | Add admin refund endpoint | `POST /api/admin/payments/:id/refund`: calls Midtrans refund API, records refund transaction, updates registration status to `refunded`. | `backend/src/routes/admin.routes.ts` | 🟡 Medium | ✅ Done (T25 — refundPayment() in midtrans.service.ts + endpoint in admin.routes.ts) |

---

## 🟢 LOW — Improvements & Polish

| # | Task | Details | File(s) | Priority | Status |
|---|---|---|---|---|---|
| 26 | Mobile: Parent can pay for child | Parent sees child's unpaid registration → taps "Pay" → goes through full Midtrans payment flow, but payment is attributed to child's registration. Currently this button exists in the UI but needs backend validation that parent is actually linked to that student. | `backend/src/routes/payments.routes.ts`, `app/app/(tabs)/children.tsx` | 🟢 Low | ☐ To Do |
| 27 | Mobile: Competition detail — use profile snapshot | On the registration detail screen, display data from `profile_snapshot` (what was submitted) instead of the live user profile. Shows exactly what the organizer sees. | `app/app/(tabs)/my-registration-details.tsx` | 🟢 Low | ☐ To Do |
| 28 | Add WA notification after payment | After Midtrans `settlement`: send a WhatsApp message (via Twilio or Fonnte) to student and parent: "Your registration for [Competition] is confirmed. Registration number: KMP-2026-XXXXX." | `backend/src/routes/payments.routes.ts` (webhook) | 🟢 Low | ☐ To Do |
| 29 | Backend: drop orphaned `parent_school_id` columns | `students.parent_school_id` and `parents.parent_school_id` are leftover from an earlier design. The system now uses `parent_student_links`. Drop these columns in a migration to avoid confusion. | `backend/migrations/` (new) | 🟢 Low | ☐ To Do |
| 30 | Backend: competition `slug` field | Add `slug TEXT UNIQUE` to competitions table (e.g. `emc-2026-main`). Used in web URLs for SEO. Generate from name+year on create. | `backend/migrations/` (new), `backend/src/routes/admin.routes.ts` | 🟢 Low | ☐ To Do |

---

## 📋 API Contract (for Teammate)

These are the backend endpoints your teammate needs for the Organizer Portal. Build these in `backend/src/routes/organizer.routes.ts`. Tell your teammate when each group is ready.

| Endpoint | Method | Body / Query | Returns | Needed by (web page) |
|---|---|---|---|---|
| `/api/organizers/register` | POST | `{ org_name, pic_name, contact_email, contact_phone, bank_account }` | `{ token, organizer }` | Organizer onboarding |
| `/api/organizers/me` | GET | — | Organizer profile | Organizer dashboard header |
| `/api/organizers/competitions` | GET | `?page&limit&status` | `{ competitions[], pagination }` | Organizer competition list |
| `/api/organizers/competitions` | POST | Full competition form | Created competition | Create competition form |
| `/api/organizers/competitions/:id` | PUT | Partial update | Updated competition | Edit competition form |
| `/api/organizers/competitions/:id/publish` | POST | — | `{ status: 'live' }` | Publish button |
| `/api/organizers/competitions/:id/close` | POST | — | `{ status: 'closed' }` | Close registration button |
| `/api/organizers/competitions/:id/registrations` | GET | `?page&limit&status&search` | `{ registrations[], pagination }` | Participant list |
| `/api/organizers/registrations/:id/approve` | POST | — | `{ status: 'approved' }` | Participant list approve button |
| `/api/organizers/registrations/:id/reject` | POST | `{ reason }` | `{ status: 'rejected' }` | Participant list reject button |
| `/api/organizers/competitions/:id/export` | GET | — | CSV download | Export button |
| `/api/organizers/revenue` | GET | — | `{ total, by_competition[] }` | Revenue dashboard |

**Status on these routes:** ☐ To Do

---
---

# TAB 3 — TEAMMATE TASKS (Web Portals)

**Your role:** You own the web platform (Next.js 14). You call the backend APIs — you never touch the database directly. When you need a new API endpoint, ask your partner to build it (see the API Contract table in Tab 2).

**How to use this table:** Change the Status cell as you work.
- `☐ To Do` → `⏳ In Progress` → `✅ Done`

---

## Setup Reference

```bash
# Start web in dev mode
cd competzy/web && npm run dev
# Runs on http://localhost:3000 (Next.js)
# Proxies /api/* to http://localhost:3000 (backend)

# Backend must also be running:
cd competzy/backend && npm run dev
# Runs on http://localhost:3000

# ⚠️ Web runs on port 3001 by default when backend is on 3000
# Check web/.env.local — BACKEND_URL should point to backend port
```

**Key files to know:**
- `web/lib/api/index.ts` — all API calls (edit this to add new endpoints)
- `web/lib/auth/context.tsx` — auth state (localStorage-based JWT)
- `web/components/Sidebar.tsx` — nav menu (add new routes here)
- `web/app/(dashboard)/layout.tsx` — auth guard + sidebar wrapper
- `web/next.config.ts` — API proxy config (points to backend)

---

## 🔴 CRITICAL — Must finish before Phase 1 (July 10)

| # | Task | Details | File(s) | Priority | Status |
|---|---|---|---|---|---|
| 1 | Verify all existing admin pages work | Start backend + web, log in, test: Dashboard, Competitions (create/edit/delete), Schools (list/add), Users (list/filter), Notifications (send to schools). Fix any broken API calls. | `web/app/(dashboard)/**/page.tsx` | 🔴 Critical | ☐ To Do |
| 2 | Admin: Registration review page | New page: `/approvals`. Shows all `pending_review` registrations (student called `GET /api/admin/registrations/pending`). Each row: student name, competition, amount, date submitted. Click to open detail. | `web/app/(dashboard)/approvals/page.tsx` (new) | 🔴 Critical | ☐ To Do |
| 3 | Admin: Registration detail + proof viewer | New page: `/approvals/[id]`. Shows full student profile, competition info, payment proof image (inline viewer), approve/reject buttons. Call `POST /api/admin/registrations/:id/approve` or `/reject`. | `web/app/(dashboard)/approvals/[id]/page.tsx` (new) | 🔴 Critical | ☐ To Do |
| 4 | Admin: Stats dashboard | Replace the current link-grid Dashboard with real stats: total students, competitions, registrations, revenue. Call `GET /api/admin/stats`. Show 4 stat cards at the top. | `web/app/(dashboard)/page.tsx` | 🔴 Critical | ☐ To Do |
| 5 | Admin: Add "Approvals" to sidebar nav | Add the approvals link to `Sidebar.tsx`. Add a badge showing the count of pending registrations. | `web/components/Sidebar.tsx` | 🔴 Critical | ☐ To Do |
| 6 | Build Organizer Portal — Auth | New route group `web/app/(organizer)/`. Organizer login page at `/organizer/login`. After login, redirect to `/organizer/dashboard`. Auth is the same JWT system — just a different role (`organizer`). Organizer token stored as `organizer_token` in localStorage (separate from admin). | `web/app/(organizer)/login/page.tsx` (new), `web/lib/auth/organizer-context.tsx` (new) | 🔴 Critical | ☐ To Do |
| 7 | Build Organizer Portal — Dashboard | New layout with organizer-specific sidebar (Competitions, Participants, Revenue). Dashboard shows: total competitions, total registrations, revenue this month, recent activity. | `web/app/(organizer)/layout.tsx` (new), `web/app/(organizer)/page.tsx` (new) | 🔴 Critical | ☐ To Do |
| 8 | Build Organizer Portal — Competition List | Page: `/organizer/competitions`. Table of all competitions by this organizer. Columns: name, status (Draft/Live/Closed), registration count, revenue. Status badges with colors. "New Competition" button. | `web/app/(organizer)/competitions/page.tsx` (new) | 🔴 Critical | ☐ To Do |
| 9 | Build Organizer Portal — Create Competition | Multi-step form (or single long form): name, category, grade level, organizer, fee, quota, dates (reg open/close, event date), description, required documents. "Save as Draft" and "Publish" buttons. | `web/app/(organizer)/competitions/new/page.tsx` (new) | 🔴 Critical | ☐ To Do |
| 10 | Build Organizer Portal — Edit Competition | Same form as create but pre-filled. Fields that are locked after first registration (name, dates, fee) show a warning: "Cannot edit — students have registered." | `web/app/(organizer)/competitions/[id]/edit/page.tsx` (new) | 🔴 Critical | ☐ To Do |
| 11 | Build Organizer Portal — Participant List | Page: `/organizer/competitions/[id]/participants`. Table: student name, NISN, school, grade, payment status, submission date. Filter by status. Search by name. Approve/Reject buttons inline. Export CSV button. | `web/app/(organizer)/competitions/[id]/participants/page.tsx` (new) | 🔴 Critical | ☐ To Do |
| 12 | Build Organizer Portal — Participant Detail | Slide-in panel or modal: full student profile snapshot, attached documents (inline PDF/image viewer), payment receipt, approve/reject with reason form. | Component in participant list page | 🔴 Critical | ☐ To Do |
| 13 | Build Organizer Portal — Revenue Dashboard | Page: `/organizer/revenue`. Cards: total collected, Competzy fee (6%), net payout. Table per competition: name, registrations, amount, payout date. | `web/app/(organizer)/revenue/page.tsx` (new) | 🔴 Critical | ☐ To Do |
| 14 | Set up subdomain routing (organizer.competzy.com) | In `next.config.ts`, add middleware to route organizer subdomain requests to `/(organizer)` routes and admin subdomain to `/(dashboard)` routes. For local dev: use different ports or path-based routing. | `web/next.config.ts`, `web/middleware.ts` (new) | 🔴 Critical | ☐ To Do |
| 15 | Deploy web to production | Set up deployment on your VPS (or Vercel). Configure `BACKEND_URL` env var to point to production backend. Set up SSL for subdomains: `competzy.com`, `organizer.competzy.com`, `admin.competzy.com`. | `web/.env.production` (new), deployment config | 🔴 Critical | ☐ To Do |

---

## 🟠 HIGH — Phase 1, finish before launch

| # | Task | Details | File(s) | Priority | Status |
|---|---|---|---|---|---|
| 16 | Public competition catalog (SSR/SSG) | New route outside the dashboard: `web/app/competitions/page.tsx`. Server-rendered list of all published competitions. Filterable by category and grade level. Each card links to `/competitions/[slug]`. This is the SEO-facing public page. | `web/app/competitions/page.tsx` (new), `web/app/competitions/[slug]/page.tsx` (new) | 🟠 High | ☐ To Do |
| 17 | Admin: Competition registrations page | From the competitions list, clicking a competition shows all students registered. Table: student name, school, status, payment status, registered date. Same CSV export as the backend already provides. | `web/app/(dashboard)/competitions/[id]/registrations/page.tsx` (new) | 🟠 High | ☐ To Do |
| 18 | Admin: User detail page | Clicking a user in the Users table opens a detail panel: name, email, phone, role, city, registration history, linked parent/student accounts. | `web/app/(dashboard)/users/[id]/page.tsx` (new) | 🟠 High | ☐ To Do |
| 19 | Organizer: Onboarding flow | Before accessing the dashboard, a new organizer must complete: organization name, logo upload, PIC name, contact email/phone, bank account details, accept platform terms. Gate dashboard behind this completion check. | `web/app/(organizer)/onboarding/page.tsx` (new) | 🟠 High | ☐ To Do |
| 20 | Organizer: Bulk approve participants | On the participant list: "Select All (Paid + Complete)" checkbox → "Approve X registrations" button → confirmation dialog showing count → bulk approval. Call a batch approve endpoint (ask partner to add it). | Participant list page | 🟠 High | ☐ To Do |
| 21 | Mobile app banner for web | For features that are web-only (bulk upload, school management), show a banner in the mobile app: "This feature is available on competzy.com" with a link. Don't build these on mobile. | Various screens in `app/` | 🟠 High | ☐ To Do |

---

## 🟡 MEDIUM — Phase 2 (School Portal, ~August)

| # | Task | Details | File(s) | Priority | Status |
|---|---|---|---|---|---|
| 22 | School Portal — Auth & Onboarding | New route group `web/app/(school)/`. School coordinator logs in and completes onboarding: school NPSN, city/province, PIC name + phone. School must be approved by admin or invited by country rep. | `web/app/(school)/` (new) | 🟡 Medium | ☐ To Do |
| 23 | School Portal — Student Roster | List all students in the school. Columns: name, NISN, grade, active registrations, registration status. Search by name/NISN. Filter by grade. Import students from CSV (template downloadable). | `web/app/(school)/students/page.tsx` (new) | 🟡 Medium | ☐ To Do |
| 24 | School Portal — Bulk Registration UI | Select a competition → select multiple students from roster → review per-student docs from vault → summary before submit → trigger CSV bulk upload to `POST /api/bulk-registration/upload`. Show job progress in real-time (poll the job status endpoint). | `web/app/(school)/bulk-register/page.tsx` (new) | 🟡 Medium | ☐ To Do |
| 25 | School Portal — Bulk Payment UI | After bulk registration: "Pay for All Students" button shows total amount, student breakdown. Opens Midtrans Snap payment page. On success: all registrations updated to `paid`. Partner must build the `POST /api/payments/bulk-snap` endpoint first. | `web/app/(school)/bulk-pay/page.tsx` (new) | 🟡 Medium | ☐ To Do |
| 26 | School Portal — Registration Dashboard | Table: student name, competition, status, payment status, submission date. Filter by competition + status. Export CSV. Read-only — school cannot modify individual student registrations. | `web/app/(school)/registrations/page.tsx` (new) | 🟡 Medium | ☐ To Do |
| 27 | Admin: Historical claims review queue | New admin page: `/admin/claims`. Lists all `pending` claim requests from students trying to link historical competition records. Shows student's profile vs. the historical record side-by-side. Approve or reject with reason. Partner builds the backend endpoint (`GET /api/admin/historical/claims`). | `web/app/(dashboard)/claims/page.tsx` (new) | 🟡 Medium | ☐ To Do |

---

## 🟢 LOW — Phase 3 (Country Rep + Referral, ~September)

| # | Task | Details | File(s) | Priority | Status |
|---|---|---|---|---|---|
| 28 | Country Rep Portal | New portal at `rep.competzy.com`. Rep sees all schools in their region, active registrations, regional payment status. Can invite new schools, generate consolidated invoices. | `web/app/(rep)/` (new) | 🟢 Low | ☐ To Do |
| 29 | Referral Portal | New portal at `referral.competzy.com`. Affiliate marketer generates tracked links per competition, sees clicks and conversions, requests payouts when threshold reached. | `web/app/(referral)/` (new) | 🟢 Low | ☐ To Do |
| 30 | Referral link tracking (cookie) | On first visit to a competition page via `?ref=CODE`: set a 30-day cookie with the referral code. On registration submit: include `referral_code` in the request body. Partner adds `referral_code` column to registrations. | `web/middleware.ts`, competition detail page | 🟢 Low | ☐ To Do |

---

## 📌 Weekly Sync Checklist (Both of You)

At the start of each week, align on:
1. What API endpoints are ready from the backend (partner's status)
2. What web pages will be built this week and which APIs they need
3. Any blockers or schema changes that affect both sides
4. Update task statuses in this document

**Shared API Base URL:**
- Development: `http://localhost:3000`
- Production: `https://api.competzy.com` (or your VPS URL)

---

*Document maintained by: [Your name] & [Teammate name]*
*Last updated: May 2, 2026*
