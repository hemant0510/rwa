# MVP Implementation Status

**Date:** 2026-03-20
**Project:** Eden Estate RWA — Next.js 16 / React 19 / TypeScript / Tailwind v4 / Prisma / Supabase

---

## Overall Progress: ~95% Complete

| Phase   | Description                                   | Status             | % Done   |
| ------- | --------------------------------------------- | ------------------ | -------- |
| Phase 0 | Foundation (DB, Auth, Layouts, Design System) | **Complete**       | **100%** |
| Phase 1 | Super Admin Portal                            | **Complete**       | **100%** |
| Phase 2 | Resident Registration                         | **Complete**       | **100%** |
| Phase 3 | Fee Management                                | **Complete**       | **100%** |
| Phase 4 | Expense Ledger                                | **Complete**       | **100%** |
| Phase 5 | WhatsApp Notifications                        | Partially complete | 40%      |
| Phase 6 | Data Migration & Reports                      | **Complete**       | **100%** |
| Phase 7 | Security & Launch Hardening                   | Not started        | 10%      |

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

### Phase 7 — Security & Launch Hardening (10%)

**Done:**

- `audit_logs` table exists in DB schema
- Rate limiting headers defined in API response patterns
- Zod validation on all route handlers (client + server)

**Pending:**

- **Row-Level Security (RLS)** — Supabase/PostgreSQL RLS policies not configured; cross-society data leakage risk
- **Rate limiting** — Upstash Redis integration not wired to any route
- **Audit logging** — `audit_logs` table exists but no code writes to it
- **Session inactivity timeout** — 8h for admins, 30d for residents — not enforced
- **Password reset email** — Supabase Auth email template not configured
- **Mobile number masking** in UI — not implemented
- **DPDP compliance** (India data privacy) — privacy policy, terms of service, consent checkboxes partially present

---

## What to Build Next (Priority Order)

### Tier 1 — High Value, Core Functionality

| #   | Task                                             | Why                                                                       |
| --- | ------------------------------------------------ | ------------------------------------------------------------------------- |
| 1   | ~~**Reports generation** (Phase 6)~~             | ✅ Complete — all 5 report types (PDF + Excel) + summary API implemented  |
| 2   | **WhatsApp API integration** (Phase 5)           | Core communication feature; templates already done; just needs API wiring |
| 3   | **Email verification + invite link** (Phase 0/2) | Required for real resident onboarding to work end-to-end                  |

### Tier 2 — Security (Required Before Production)

| #   | Task                              | Why                                                       |
| --- | --------------------------------- | --------------------------------------------------------- |
| 4   | **Supabase RLS policies**         | Prevent cross-society data access — critical security gap |
| 5   | **Rate limiting** (Upstash Redis) | Prevent abuse on auth and public routes                   |
| 6   | **Audit logging**                 | Wire `audit_logs` writes to all admin operations          |
| 7   | **Session timeout enforcement**   | Auth security requirement                                 |

### Tier 3 — Polish & Completion

| #   | Task                          | Why                        |
| --- | ----------------------------- | -------------------------- |
| 8   | **Import progress streaming** | Better UX for bulk uploads |
| 9   | **Mobile number masking**     | Privacy / DPDP compliance  |

---

## Key File Locations

| Area                   | Path                    |
| ---------------------- | ----------------------- |
| All coding standards   | `.claude/core_rules.md` |
| DB schema              | `prisma/schema.prisma`  |
| Zod validation schemas | `src/lib/validations/`  |
| API client services    | `src/services/`         |
| UI components          | `src/components/`       |
| MVP execution plan     | `execution_plan/MVP/`   |
| Super Admin pages      | `src/app/sa/`           |
| Admin pages            | `src/app/admin/`        |
| Resident pages         | `src/app/r/`            |
| Auth pages             | `src/app/(auth)/`       |
| API routes             | `src/app/api/v1/`       |
| Cron routes            | `src/app/api/cron/`     |
