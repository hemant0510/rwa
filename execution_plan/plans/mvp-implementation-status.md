# MVP Implementation Status

**Date:** 2026-03-20
**Project:** Eden Estate RWA — Next.js 16 / React 19 / TypeScript / Tailwind v4 / Prisma / Supabase

---

## Overall Progress: ~75% Complete

| Phase   | Description                                   | Status             | % Done   |
| ------- | --------------------------------------------- | ------------------ | -------- |
| Phase 0 | Foundation (DB, Auth, Layouts, Design System) | **Complete**       | **100%** |
| Phase 1 | Super Admin Portal                            | **Complete**       | **100%** |
| Phase 2 | Resident Registration                         | Mostly complete    | 75%      |
| Phase 3 | Fee Management                                | Mostly complete    | 95%      |
| Phase 4 | Expense Ledger                                | **Complete**       | 100%     |
| Phase 5 | WhatsApp Notifications                        | Partially complete | 40%      |
| Phase 6 | Data Migration & Reports                      | Partially complete | 50%      |
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

### Phase 2 — Resident Registration (75%)

**Done:**

- Invite-link registration page (`/register/[societyCode]`)
- Dynamic unit address fields per society type (5 types: Apartment, Builder Floors, Villas, Independent Sector, Plotted Colony)
- Registration form: name, email, password, mobile (optional), unit, ownership type, ID proof upload (drag-drop, max 5MB)
- Registration confirmation screen
- Admin approval/rejection workflow with UI
- RWAID string generation (format: `RWA-HR-GGN-122001-0001-2025-0089`)
- Unit record creation with display labels

**Pending:**

- Email verification flow — pages exist (`/check-email`, `/verify-email`) but email delivery not wired
- Invite-link token generation from admin side not fully wired end-to-end
- Edge case handling: expired token, duplicate email — basic validation present, needs strengthening

---

### Phase 3 — Fee Management (95%)

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
- Payment correction and reversal

**Pending:**

- Cron jobs for automatic fee status transitions:
  - `NOT_YET_DUE → PENDING` on April 1 (cron route exists, logic not implemented)
  - `PENDING → OVERDUE` on April 16 (cron route exists, logic not implemented)

---

### Phase 4 — Expense Ledger (100% ✅)

**Done:**

- Expense ledger dashboard (running balance, totals, category breakdown)
- Running balance = Total Collected − Total Expenses
- Category breakdown (horizontal bar chart, no external library)
- Add expense form (date, amount, category, description, receipt upload)
- 9 expense categories: Maintenance, Security, Cleaning, Staff Salary, Infrastructure, Utilities, Emergency, Administrative, Other
- Expense correction (edit within 24h window)
- Expense reversal (after 24h — creates negative entry, original struck-through)
- Balance impact preview (live calculation)
- Expense list with filters, search, pagination

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

### Phase 6 — Data Migration & Reports (50%)

**Done:**

- Bulk upload dialog UI (drag-drop Excel, max 5MB, `admin/migration/`)
- Validation framework: required fields, mobile format, duplicate detection, ownership type, fee status
- Validation error UI (error list, count breakdown)

**Pending:**

- Excel template download — society-type-specific column layout not complete
- Import progress streaming (UI exists, real-time updates not wired)
- **5 reports not generated** (reports page exists, no actual output):
  1. Paid Members List (PDF + Excel)
  2. Pending/Overdue Members List (PDF + Excel)
  3. Full Resident Directory (PDF + Excel)
  4. Expense Summary (PDF + Excel)
  5. Fee Collection Summary (PDF + Excel)

> Note: `@react-pdf` is already installed (used for subscription invoices) — reuse for reports.

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

| #   | Task                                             | Why                                                                        |
| --- | ------------------------------------------------ | -------------------------------------------------------------------------- |
| 1   | **Reports generation** (Phase 6)                 | High user value; `@react-pdf` already available; reports page shell exists |
| 2   | **WhatsApp API integration** (Phase 5)           | Core communication feature; templates already done; just needs API wiring  |
| 3   | **Email verification + invite link** (Phase 0/2) | Required for real resident onboarding to work end-to-end                   |
| 4   | **Fee cron jobs** (Phase 3)                      | Needed for autonomous operation; routes exist, just needs logic            |

### Tier 2 — Security (Required Before Production)

| #   | Task                              | Why                                                       |
| --- | --------------------------------- | --------------------------------------------------------- |
| 5   | **Supabase RLS policies**         | Prevent cross-society data access — critical security gap |
| 6   | **Rate limiting** (Upstash Redis) | Prevent abuse on auth and public routes                   |
| 7   | **Audit logging**                 | Wire `audit_logs` writes to all admin operations          |
| 8   | **Session timeout enforcement**   | Auth security requirement                                 |

### Tier 3 — Polish & Completion

| #   | Task                                  | Why                              |
| --- | ------------------------------------- | -------------------------------- |
| 9   | **Excel template download**           | Complete the bulk migration flow |
| 10  | **Import progress streaming**         | Better UX for bulk uploads       |
| 11  | **Pro-rata preview in approval flow** | QoL improvement for admins       |
| 12  | **Mobile number masking**             | Privacy / DPDP compliance        |

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
