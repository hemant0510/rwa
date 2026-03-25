# MVP Implementation Status

**Date:** 2026-03-20
**Project:** Eden Estate RWA — Next.js 16 / React 19 / TypeScript / Tailwind v4 / Prisma / Supabase

---

## Overall Progress: ~99% Complete

| Phase   | Description                                   | Status             | % Done   |
| ------- | --------------------------------------------- | ------------------ | -------- |
| Phase 0 | Foundation (DB, Auth, Layouts, Design System) | **Complete**       | **100%** |
| Phase 1 | Super Admin Portal                            | **Complete**       | **100%** |
| Phase 2 | Resident Registration                         | **Complete**       | **100%** |
| Phase 3 | Fee Management                                | **Complete**       | **100%** |
| Phase 4 | Expense Ledger                                | **Complete**       | **100%** |
| Phase 5 | WhatsApp Notifications                        | Partially complete | 40%      |
| Phase 6 | Data Migration & Reports                      | **Complete**       | **100%** |
| Phase 7 | Security & Launch Hardening                   | **Complete**       | **100%** |

---

## Phase-by-Phase Detail

---

### Phase 0 — Foundation (100% ✅)

**Done:**

- Database schema — all 22 tables via Prisma
- Email/password authentication (Supabase Auth) with 3 clients (browser, server, admin)
- Email verification — custom tokens, branded HTML emails, 24h expiry, resend with 120s cooldown
- Password reset — custom tokens, 1h expiry, Supabase admin API updates password
- 3 layout shells: Super Admin (`sa/`), RWA Admin (`admin/`), Resident (`r/`)
- Design system: shadcn/ui + custom components (StatusBadge, PageHeader, EmptyState, LoadingSkeleton)
- Zod validation schemas (societies, residents, fees, expenses)
- TanStack Query provider and query key factory
- Error boundaries (`error.tsx`), loading states, 404 page
- Global styles + design tokens (Tailwind v4)
- `src/middleware.ts` — centralized route protection; unauthenticated users on `/admin`, `/sa`, `/r` are redirected to `/login` (or `/super-admin-login` for `/sa/*`)
- `useIdleTimeout` hook — 8h inactivity timeout for admin sessions with 15-min warning toast; integrated into admin layout and SA layout

---

### Phase 1 — Super Admin Portal (100% ✅)

**Done:**

- Super Admin dashboard (platform stats, recent activity)
- Society onboarding — 3-step wizard (details, fees, admin)
- Real-time Society Code uniqueness check (debounced)
- Society list with search, filter, pagination
- Society detail page — stats row (Total Residents, Fees Collected, Current Balance)
- Admin Team card — shows Primary + Supporting admin with role badges, login status, "No login" badge
- Admin activation sheet — mode toggle (New Admin / Existing Resident), permission selector (Primary/Supporting)
- Admin activation API (`POST /api/v1/societies/[id]/admins`) — full Supabase auth account creation, DB user, admin term, rollback on failure
- Admin receives welcome/verification email on activation (or auto-verified when verification not required)
- Plans management pages (`sa/plans/`)
- Discounts management pages (`sa/discounts/`)
- Billing dashboard pages (`sa/billing/`)
- 23 unit tests for admin activation API (100% branch coverage)

---

### Phase 2 — Resident Registration (100% ✅)

**Done:**

- Invite-link registration page (`/register/[societyCode]`)
- Dynamic unit address fields per society type (5 types: Apartment, Builder Floors, Villas, Independent Sector, Plotted Colony)
- Registration form: name, email, password, mobile (optional), unit, ownership type, ID proof upload (drag-drop, max 5MB)
- Registration confirmation screen
- Admin approval/rejection workflow with UI
- RWAID string generation (format: `RWA-HR-GGN-122001-0001-2025-0089`)
- Unit record creation with display labels
- **Bulk upload API** (`POST /api/v1/residents/bulk-upload`) — up to 100 rows per batch, validates email/mobile/ownershipType, deduplication, creates Supabase Auth account + DB user + unit, sends "Create your password" welcome email (best-effort, email failure does not fail the row)
- **Welcome email template** (`src/lib/email-templates/welcome-setup.ts`) — branded HTML email with "Create My Password" button, 7-day link expiry notice
- **Account setup token** — reuses password reset token infrastructure with 7-day expiry (`ACCOUNT_SETUP_TOKEN_EXPIRY_HOURS = 168`) so bulk-imported residents set their own password via email link
- **"Send Setup Email" button** on resident detail page — admin can resend the welcome/password setup email at any time for residents who have an email address
- **`POST /api/v1/residents/[id]/send-setup-email`** — generates 7-day token, sends welcome email; returns 404 if not found, 400 if no email
- **Pro-rata preview dialog** in admin approval flow — before confirming approval, admin sees session year, joining fee, pro-rata months/amount, and total first payment
- **`GET /api/v1/residents/[id]/approve`** — returns `{ proRata, sessionYear }` preview without any DB writes; returns 400 if resident is not `PENDING_APPROVAL`
- Test coverage: 100% for all new API routes and service functions (approve GET/PATCH, send-setup-email, bulk-upload email flow, service layer)

---

### Phase 3 — Fee Management (100% ✅)

**Done:**

- Fee dashboard (total due, collected, outstanding, collection %)
- Fee status breakdown (Paid, Pending, Overdue, Partial, Exempted, Not Yet Due)
- Pro-rata calculation engine (monthly, remaining months, first payment)
- Record payment dialog (amount, mode: Cash/UPI/Bank Transfer/Other, reference, date, notes)
- Receipt number generation (e.g. `EDENESTATE-2025-R0042`)
- Payment success confirmation with receipt info
- Fee tracker table with filtering, search, pagination
- Fee status lifecycle & transitions
- Grant fee exemption
- **Payment correction** (`PATCH /fees/[feeId]/payments/[paymentId]`) — within 48-hour window, updates amount/mode/reference, recalculates fee and user status
- **Payment reversal** (`POST /fees/[feeId]/payments/[paymentId]/reverse`) — marks original reversed, creates reversal entry, recalculates fee and user status
- **`NOT_YET_DUE → PENDING` cron** (`POST /api/cron/fee-status-activate`) — runs daily, flips fees where `sessionStart ≤ today`
- **`PENDING → OVERDUE` cron** (`POST /api/cron/fee-overdue-check`) — runs daily, flips fees where `gracePeriodEnd < today`
- **`recordedBy` bug fixed** — payment recorder now uses actual admin ID from `getCurrentUser` instead of resident ID
- Test coverage: 100% for all new and modified routes (record payment, correction, reversal, both cron jobs)

---

### Phase 4 — Expense Ledger (100% ✅)

**Done:**

- Expense ledger dashboard (running balance, totals, category breakdown)
- Running balance = Total Collected − Total Expenses
- Category breakdown — horizontal CSS bars (no external library) on both admin and resident views
- Add expense form (date, amount, category, description)
- Receipt / invoice upload (JPG/PNG/PDF, max 5MB) — Supabase Storage `expense-receipts` bucket
- Balance impact preview — live calculation shown in Add Expense dialog
- 9 expense categories: Maintenance, Security, Cleaning, Staff Salary, Infrastructure, Utilities, Emergency, Administrative, Other
- **Expense correction** (`PATCH /expenses/[id]`) — edit amount, category, description within 24h window; `EditExpenseDialog` opens from `ExpenseDetailSheet`; `CorrectionWindowBadge` shows remaining time
- **Expense reversal** (`POST /expenses/[id]/reverse`) — marks original `REVERSED` (struck-through in table), creates negative-amount reversal entry (double-entry audit trail), sets `reversedBy` + `reversedAt`
- `ExpenseDetailSheet` — side sheet on row click; shows all details, receipt link, correction window badge, Edit / Reverse action buttons
- Reversed rows visually struck-through with muted opacity in admin table
- Date range filter (From / To inputs) on admin expenses table
- Resident expense view: read-only, 3-card summary (Collected / Expenses / Balance), category bars
- Test coverage: 29 service + validation tests, 32 admin page tests, 23 resident page tests (all passing)

---

### Phase 5 — WhatsApp Notifications (40%)

**Done:**

- Notification service layer architecture
- 7 message templates defined:
  1. Registration submitted → resident
  2. Registration approved → resident (with RWAID)
  3. Registration rejected → resident (with reason)
  4. Payment recorded → resident (with receipt)
  5. New registration → admin alert
  6. Fee reminder (March 1) → all residents
  7. Fee overdue (April 16) → overdue residents only
- Broadcast UI page (`admin/broadcast/`)
- Broadcast history API

**Pending:**

- WATI / Interakt API not connected — client structure exists but credentials and HTTP calls not wired
- All 7 automated notification triggers not wired to their respective events
- Retry logic for failed notifications (3 attempts, 5-min intervals) not implemented
- Delivery tracking / status update webhook not implemented

---

### Phase 6 — Data Migration & Reports (100% ✅)

**Done:**

- **Excel template download** (`GET /api/v1/societies/[id]/migration/template`) — society-type-specific column headers, sample row, instructions sheet; `src/services/migration.ts` triggers browser download
- **Excel validation** (`POST /api/v1/societies/[id]/migration/validate`) — parses xlsx, validates all fields (name, email, mobile, ownershipType, feeStatus), checks duplicates within file and against existing DB records, returns `{ total, valid, invalid, errors, preview }`
- **Bulk import** (`POST /api/v1/societies/[id]/migration/import`) — per-record: Supabase auth creation/reuse, RWAID generation, `prisma.$transaction` creating User + Unit + UserUnit + MembershipFee; sends welcome setup email (best-effort); returns `{ results, summary }`
- **Migration UI** (`admin/migration/`) — 3-step wizard (upload → validate/preview → done), file drag-drop, validation error table, import progress, reset to re-upload
- **5 report download routes** — all support PDF (`@react-pdf/renderer`) and Excel (`xlsx`) output:
  1. `GET /reports/paid-list` — paid members list with payment date
  2. `GET /reports/pending-list` — pending/overdue members list
  3. `GET /reports/directory` — full resident directory with contact details
  4. `GET /reports/expense-summary` — session-filtered expense ledger
  5. `GET /reports/collection-summary` — income vs expense financial summary
- **Reports summary** (`GET /reports/summary?session=`) — live counts (paidCount, pendingCount, totalCollected, totalExpenses, balance) via `Promise.all`
- **Reports UI** (`admin/reports/`) — session selector, live summary cards (paid/pending counts, collected, expenses, balance with color), 5 report cards with PDF + Excel buttons, `useQuery` for live data
- **Service layer** (`src/services/migration.ts`, `src/services/reports.ts`) — full API wiring with blob download trigger
- **Test coverage** — 114 test files, 1648 tests, 100% pass rate:
  - `tests/api/migration/` — template (9), validate (17), import (17) = 43 tests
  - `tests/api/reports/` — paid-list (9), pending-list (9), directory (7), expense-summary (7), collection-summary (7), summary (8) = 47 tests
  - `tests/services/migration.test.ts` (9), `reports.test.ts` (9) = 18 tests
  - `tests/app/admin/migration/page.test.tsx` (19), `reports/page.test.tsx` (14) = 33 tests

---

### Phase 7 — Security & Launch Hardening (100% ✅)

**Done:**

- `audit_logs` table exists in DB schema; `logAudit()` now wired to all admin operations (resident approved/rejected, payment recorded/reversed, expense created/reversed, broadcast sent)
- **Auth guards** — `getFullAccessAdmin()` enforced on all admin API routes that were missing it: `GET /residents`, `POST /residents/bulk-upload`, `POST /residents/[id]/send-verification`; society-scoped `403` returned on cross-society requests
- **Rate limiting** — in-memory `checkRateLimit()` active on `forgot-password` (3/email/hour) and `register-society` (5/IP/hour); `checkRateLimitAsync()` added for async-capable routes with future Upstash Redis path
- **Login rate limit proxy** — `POST /api/v1/auth/login` server-side route enforces 5 attempts/email/15min before delegating to Supabase; login page updated to call the proxy instead of Supabase directly; 429 toast shown to user
- **RWAID race condition** — bulk upload retries up to 3× on Prisma `P2002` unique constraint violation with incremented sequence
- **Supabase auth orphan cleanup** — if `prisma.$transaction` fails after a new Supabase auth user was created, `supabaseAdmin.auth.admin.deleteUser()` is called to prevent ghost accounts
- **Session inactivity timeout** — `src/middleware.ts` enforces 8-hour admin inactivity timeout via `admin-last-activity` cookie; expired sessions redirect to `/login?reason=session_expired`
- **Security headers + CSP** — `next.config.ts` `headers()` sets `X-Frame-Options`, `X-Content-Type-Options`, `X-XSS-Protection`, `Referrer-Policy`, `Permissions-Policy`, and a full `Content-Security-Policy` covering Supabase + Sentry origins
- **Sentry error monitoring** — `@sentry/nextjs` installed; `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `src/instrumentation.ts` configured; `next.config.ts` wrapped with `withSentryConfig`; set `NEXT_PUBLIC_SENTRY_DSN` env var to enable
- **Row-Level Security (RLS)** — `supabase/migrations/20260320000000_enable_rls_policies.sql` created with `ENABLE ROW LEVEL SECURITY` on all society-scoped tables and all isolation/read/write policies; deploy with `supabase db push`
- **Privacy Policy & Terms of Service** — `/privacy` (9 sections, DPDP Act 2023) and `/terms` (11 sections, Indian law) pages; linked from login page footer and register-society consent checkbox
- **Mobile number masking** — `maskMobile()` utility masks first 5 digits (`9876543210` → `XXXXX 43210`); applied to residents list, resident detail (with Eye/EyeOff reveal toggle), fees page, governing body page
- **Import progress streaming (SSE)** — `POST /api/v1/societies/[id]/migration/import-stream` streams real-time per-record progress via SSE; `processSingleRecord()` extracted to `src/lib/migration-processor.ts`; migration page shows live progress bar with `processed X of Y · N imported · N failed`
- **E2E critical path tests (Playwright)** — 5 spec files: admin login (incl. rate limit), resident registration (masking + validation), approval flow, payment recording, cross-society isolation; `playwright.config.ts` + `npm run test:e2e`
- **URL state persistence** — residents page filter state stored in URL params via `useSearchParams` + `router.replace`; page wrapped in `<Suspense>` per Next.js App Router requirement
- Zod validation on all route handlers (unchanged)
- Test coverage: 1690+ tests, all passing — lines ≥99%, branches ≥95%, functions ≥97%, statements ≥98%

**Pending:**

- Nothing — Phase 7 is complete. WhatsApp (Phase 5) is intentionally deferred to a later sprint.

---

## What to Build Next (Priority Order)

### Tier 1 — Only Remaining Item

| #   | Task                                   | Why                                                                                    |
| --- | -------------------------------------- | -------------------------------------------------------------------------------------- |
| 1   | **WhatsApp API integration** (Phase 5) | Core communication feature; templates + DB schema done; needs WATI/Interakt API wiring |

### Pre-launch Checklist

| Item                          | Status                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------- |
| Set `NEXT_PUBLIC_SENTRY_DSN`  | ⏳ env var — set in Vercel/prod config                                                      |
| Run RLS migration             | ⏳ `supabase db push` on prod                                                               |
| Set `SENTRY_AUTH_TOKEN` in CI | ⏳ for source map uploads                                                                   |
| Install Playwright browsers   | ⏳ `npx playwright install chromium`                                                        |
| Set E2E test env vars         | ⏳ `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD`                                                |
| Upstash Redis (optional)      | ⏳ set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` for multi-instance rate limits |

---

## Key File Locations

| Area                   | Path                     |
| ---------------------- | ------------------------ |
| All coding standards   | `.claude/core_rules.md`  |
| DB schema              | `supabase/schema.prisma` |
| Zod validation schemas | `src/lib/validations/`   |
| API client services    | `src/services/`          |
| UI components          | `src/components/`        |
| MVP execution plan     | `execution_plan/MVP/`    |
| Super Admin pages      | `src/app/sa/`            |
| Admin pages            | `src/app/admin/`         |
| Resident pages         | `src/app/r/`             |
| Auth pages             | `src/app/(auth)/`        |
| API routes             | `src/app/api/v1/`        |
| Cron routes            | `src/app/api/cron/`      |
