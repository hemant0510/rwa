# Super Admin Portal — Improvements Plan

**Status:** Planned
**Scope:** API security, audit logging, settings, dashboard analytics, society lifecycle, audit viewer, GOD-mode society deep-dive, platform-wide operational views, cross-society search
**Last Updated:** 2026-03-30

---

## Why This Exists

The super admin portal (`/sa/*`) handles platform-level management (societies, plans, discounts, billing) but has **two categories of critical gaps**:

1. **Security & infrastructure gaps** — API authorization missing, zero audit logging, no settings page, basic dashboard.
2. **GOD-mode visibility gap** — The super admin is the platform owner and should see **everything** any RWA admin or resident can see, across every society. Currently, the SA can only see 3 stat numbers per society (resident count, fees collected, balance). They have **zero visibility** into residents, fees, expenses, events, petitions, broadcasts, reports, governing body, or migration history for any society. The SA is supposed to be the GOD of this platform — but right now they're flying blind.

This plan addresses both categories in priority order.

---

## Current State Summary

### Platform-Level Gaps

| Area                | Status         | Issue                                                                                   |
| ------------------- | -------------- | --------------------------------------------------------------------------------------- |
| API Authorization   | **CRITICAL**   | All 15+ SA API routes have zero role checks — any authenticated user can call them      |
| Proxy Middleware    | Partial        | Checks authentication only, not super admin role                                        |
| SA Layout           | Client-only    | No server-side gating; relies on frontend routing                                       |
| Audit Logging       | Missing for SA | 42 action types exist for society-level, but zero SA-specific actions logged            |
| Settings Page       | Missing        | Sidebar links to `/sa/settings` but page doesn't exist                                  |
| Audit Log Viewer    | Missing        | DB table + `logAudit()` function exist, but no UI to view logs                          |
| Dashboard Analytics | Basic          | Only 4 static number cards + recent societies list — no trends, charts, or revenue data |
| Society Offboarding | Incomplete     | Status dropdown exists but no workflow (no reason, no notification, no grace period)    |

### GOD-Mode Visibility Gaps (Society Deep-Dive)

The RWA admin has **11 major sections** with 100+ features. The SA can currently see almost none of them:

| RWA Admin Feature  | What Admin Sees                                                                     | What SA Currently Sees            | Gap         |
| ------------------ | ----------------------------------------------------------------------------------- | --------------------------------- | ----------- |
| **Residents**      | Full list, details, approve/reject, documents, deactivation, search                 | Only total count (1 number)       | **MASSIVE** |
| **Fees**           | Collection table, payment recording, exemptions, session history                    | Only total amount (1 number)      | **MASSIVE** |
| **Expenses**       | Full ledger, categories, receipt uploads, 24h edit, reversal                        | Only balance (1 number)           | **MASSIVE** |
| **Events**         | Create, publish, complete, cancel, registrations, finances, settle                  | **ZERO visibility**               | **TOTAL**   |
| **Petitions**      | Create, publish, submit, close, signatures, PDF docs, compiled reports              | **ZERO visibility**               | **TOTAL**   |
| **Reports**        | 5 report types (PDF + Excel): collection, expenses, directory, summary, outstanding | **ZERO capability**               | **TOTAL**   |
| **Broadcasts**     | Send WhatsApp to residents, view history                                            | **ZERO visibility**               | **TOTAL**   |
| **Governing Body** | Manage designations, assign members                                                 | **ZERO visibility**               | **TOTAL**   |
| **Migration**      | Bulk Excel import wizard, history                                                   | **ZERO visibility**               | **TOTAL**   |
| **Settings**       | Fee config, sessions, email verification                                            | Partial (edit page only)          | Moderate    |
| **Dashboard**      | Stats, collection progress, expense breakdown, quick actions                        | Basic "View Dashboard" proxy link | Moderate    |

### Platform-Wide Operational Gaps

| Area                            | Status  | Issue                                                         |
| ------------------------------- | ------- | ------------------------------------------------------------- |
| Total residents platform-wide   | Missing | SA has no view of all residents across all societies          |
| Platform-wide fee collection    | Missing | No aggregate fee collection metrics across societies          |
| Cross-society event activity    | Missing | No visibility into events happening across all societies      |
| Cross-society petition activity | Missing | No visibility into petitions across all societies             |
| Platform-wide search            | Missing | Cannot search for a resident/transaction across all societies |
| Society health scoring          | Missing | No composite metric to identify societies needing attention   |
| SA-to-Admin communication       | Missing | SA cannot send messages/announcements to society admins       |

---

## Phase 1: API Authorization Middleware (CRITICAL)

### Problem

Every `/api/v1/super-admin/*` route proceeds directly to database queries without verifying the caller is a super admin. The `forbiddenError()` helper exists in `src/lib/api-helpers.ts` but is never used.

**Attack scenario:** Any authenticated resident or RWA admin can directly call:

```
POST /api/v1/super-admin/plans
{ "name": "Free Plan", "pricePerUnit": 0 }
```

...and successfully create/modify platform plans, discounts, billing, and societies.

### Solution

Create a `requireSuperAdmin()` helper that wraps route handlers. It extracts the Supabase auth user from the request, checks the `super_admins` table, and returns 403 if the caller is not a super admin.

### New File: `src/lib/auth-guard.ts`

```typescript
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { forbiddenError, unauthorizedError } from "@/lib/api-helpers";

interface SuperAdminContext {
  superAdminId: string;
  authUserId: string;
  email: string;
}

/**
 * Verify the caller is an active super admin.
 * Returns the SA context on success, or a NextResponse error on failure.
 */
export async function requireSuperAdmin(): Promise<
  { data: SuperAdminContext; error: null } | { data: null; error: Response }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: unauthorizedError() };
  }

  const superAdmin = await prisma.superAdmin.findUnique({
    where: { authUserId: user.id },
    select: { id: true, authUserId: true, email: true, isActive: true },
  });

  if (!superAdmin || !superAdmin.isActive) {
    return { data: null, error: forbiddenError("Super admin access required") };
  }

  return {
    data: {
      superAdminId: superAdmin.id,
      authUserId: superAdmin.authUserId,
      email: superAdmin.email,
    },
    error: null,
  };
}
```

### Usage Pattern (apply to every SA route)

Before:

```typescript
// src/app/api/v1/super-admin/stats/route.ts
export async function GET() {
  const [total, active] = await Promise.all([...]);
  return NextResponse.json({ total, active });
}
```

After:

```typescript
import { requireSuperAdmin } from "@/lib/auth-guard";

export async function GET() {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  const [total, active] = await Promise.all([...]);
  return NextResponse.json({ total, active });
}
```

### Routes to Protect (16 files)

| Route File                                                     | Methods            |
| -------------------------------------------------------------- | ------------------ |
| `api/v1/super-admin/stats/route.ts`                            | GET                |
| `api/v1/super-admin/plans/route.ts`                            | GET, POST          |
| `api/v1/super-admin/plans/[id]/route.ts`                       | GET, PATCH, DELETE |
| `api/v1/super-admin/plans/[id]/billing-options/route.ts`       | GET, POST          |
| `api/v1/super-admin/plans/[id]/billing-options/[bid]/route.ts` | PUT, DELETE        |
| `api/v1/super-admin/plans/reorder/route.ts`                    | POST               |
| `api/v1/super-admin/discounts/route.ts`                        | GET, POST          |
| `api/v1/super-admin/discounts/[id]/route.ts`                   | GET, PATCH, DELETE |
| `api/v1/super-admin/discounts/validate/route.ts`               | POST               |
| `api/v1/super-admin/billing/dashboard/route.ts`                | GET                |
| `api/v1/super-admin/billing/subscriptions/route.ts`            | GET                |
| `api/v1/super-admin/billing/invoices/route.ts`                 | GET                |
| `api/v1/super-admin/billing/payments/route.ts`                 | GET, POST          |
| `api/v1/super-admin/billing/expiring/route.ts`                 | GET                |
| `api/v1/super-admin/billing/send-reminder/route.ts`            | POST               |
| `api/v1/super-admin/billing/send-bulk-reminders/route.ts`      | POST               |

### Proxy Enhancement

Add super admin role check in `src/proxy.ts` for API routes:

```typescript
// Inside the API route block (line 54-61 of proxy.ts):
// After the generic auth check, add SA-specific check:
if (pathname.startsWith("/api/v1/super-admin/") && user) {
  // Role check happens inside route handlers via requireSuperAdmin()
  // But we can add SA-specific inactivity timeout here too
}
```

The primary protection is in the route handlers (defense in depth), not the proxy — because the proxy runs in Edge Runtime and cannot access Prisma directly.

### SA Layout Server-Side Check

Add a server-side redirect in `src/app/sa/layout.tsx` so that even if a non-SA user navigates to `/sa/*`, they get bounced before any client code loads. This requires converting to a server component wrapper or adding a server-side check at the top.

---

## Phase 2: Super Admin Audit Logging

### Problem

When a super admin creates a plan, modifies a discount, suspends a society, or records a payment — **zero audit trail is created**. The `logAudit()` function and `AuditLog` table exist but are only used for society-level actions.

### New Audit Action Types

Add to `src/lib/audit.ts`:

```typescript
// Super Admin actions
| "SA_LOGIN"
| "SA_LOGOUT"
| "SA_PLAN_CREATED"
| "SA_PLAN_UPDATED"
| "SA_PLAN_ARCHIVED"
| "SA_PLAN_REORDERED"
| "SA_BILLING_OPTION_CREATED"
| "SA_BILLING_OPTION_UPDATED"
| "SA_BILLING_OPTION_DELETED"
| "SA_DISCOUNT_CREATED"
| "SA_DISCOUNT_UPDATED"
| "SA_DISCOUNT_DEACTIVATED"
| "SA_SOCIETY_CREATED"
| "SA_SOCIETY_UPDATED"
| "SA_SOCIETY_SUSPENDED"
| "SA_SOCIETY_OFFBOARDED"
| "SA_SOCIETY_REACTIVATED"
| "SA_ADMIN_ACTIVATED"
| "SA_SUBSCRIPTION_ASSIGNED"
| "SA_PAYMENT_RECORDED"
| "SA_REMINDER_SENT"
| "SA_BULK_REMINDERS_SENT"
| "SA_SETTINGS_UPDATED"
// Support request actions
| "SUPPORT_REQUEST_CREATED"
| "SUPPORT_REQUEST_STATUS_CHANGED"
| "SUPPORT_REQUEST_MESSAGE_SENT"
| "SUPPORT_REQUEST_REOPENED"
| "SUPPORT_REQUEST_AUTO_CLOSED"
```

**Total: 27 new action types.**

### Schema Change

The `AuditLog.actionType` column is `VarChar(20)` — some new action names exceed 20 characters (e.g., `SA_BILLING_OPTION_CREATED` is 25). Needs migration to `VarChar(50)`.

### Logging Pattern

The `requireSuperAdmin()` helper returns `superAdminId` — pass this as `userId` when calling `logAudit()`:

```typescript
const auth = await requireSuperAdmin();
if (auth.error) return auth.error;

// ... perform action ...

await logAudit({
  actionType: "SA_PLAN_CREATED",
  userId: auth.data.superAdminId,
  entityType: "PlatformPlan",
  entityId: plan.id,
  newValue: { name: plan.name, slug: plan.slug },
});
```

### AuditLog.societyId Handling

For platform-wide SA actions (plans, discounts, settings), `societyId` is `null`. For society-scoped SA actions (society update, suspension, admin activation), `societyId` is set to the target society's ID.

---

## Phase 3: Settings Page

### Problem

Sidebar links to `/sa/settings` but the page doesn't exist. Super admin has no way to manage their profile, change password, or configure platform-wide settings.

### Page: `/sa/settings`

Tab-based layout with 3 sections:

#### Tab 1: Profile

| Field      | Editable  | Notes                                  |
| ---------- | --------- | -------------------------------------- |
| Name       | Yes       | Text input, 2-100 chars                |
| Email      | Read-only | Display only (linked to Supabase Auth) |
| Created At | Read-only | Display date                           |
| Last Login | Read-only | From Supabase auth metadata            |

#### Tab 2: Security

| Feature         | Description                                                             |
| --------------- | ----------------------------------------------------------------------- |
| Change Password | Current password + new password + confirm. Uses Supabase `updateUser()` |
| Active Sessions | List of active sessions from Supabase Auth (if available via admin API) |

#### Tab 3: Platform Config

Platform-wide settings stored in a new `PlatformConfig` table (key-value):

| Key                      | Type   | Default | Purpose                                |
| ------------------------ | ------ | ------- | -------------------------------------- |
| `trial_duration_days`    | number | 30      | Default trial period for new societies |
| `trial_unit_limit`       | number | 50      | Max units during trial                 |
| `session_timeout_hours`  | number | 8       | Admin inactivity timeout               |
| `default_fee_grace_days` | number | 15      | Days before fee marked overdue         |
| `support_email`          | string | —       | Displayed in admin/resident UI         |
| `support_phone`          | string | —       | Displayed in admin/resident UI         |

### Database: New Model

```prisma
model PlatformConfig {
  key       String   @id @db.VarChar(100)
  value     String   @db.Text
  type      String   @default("string") @db.VarChar(20)  // string, number, boolean
  label     String   @db.VarChar(200)
  updatedAt DateTime @updatedAt @map("updated_at")
  updatedBy String?  @map("updated_by") @db.Uuid

  @@map("platform_configs")
}
```

### API Routes

| Method | Endpoint                                       | Action               |
| ------ | ---------------------------------------------- | -------------------- |
| GET    | `/api/v1/super-admin/settings/profile`         | Get SA profile       |
| PATCH  | `/api/v1/super-admin/settings/profile`         | Update SA name       |
| POST   | `/api/v1/super-admin/settings/change-password` | Change password      |
| GET    | `/api/v1/super-admin/settings/platform-config` | Get all config keys  |
| PATCH  | `/api/v1/super-admin/settings/platform-config` | Update config values |

---

## Phase 4: Audit Log Viewer

### Problem

The `audit_logs` table captures 42+ action types but there is no UI to view them. Super admin has no visibility into who did what and when across the platform.

### Page: `/sa/audit-logs`

Full-page data table with:

#### Filters

| Filter      | Type         | Options                                         |
| ----------- | ------------ | ----------------------------------------------- |
| Date Range  | Date picker  | From / To (default: last 7 days)                |
| Society     | Dropdown     | All societies + "Platform-wide"                 |
| Action Type | Multi-select | All 42+ action types, grouped by category       |
| User        | Search input | Fuzzy search by name or email                   |
| Entity Type | Dropdown     | Society, User, PlatformPlan, PlanDiscount, etc. |

#### Table Columns

| Column    | Content                                                                                 |
| --------- | --------------------------------------------------------------------------------------- |
| Timestamp | `createdAt` formatted as `dd MMM yyyy HH:mm`                                            |
| User      | Name + email (resolved from `userId`)                                                   |
| Action    | Action type with color-coded badge (green=create, blue=update, red=delete, yellow=auth) |
| Entity    | Entity type + ID (link to entity if applicable)                                         |
| Society   | Society name or "Platform" for SA-level actions                                         |
| Details   | Expandable row showing `oldValue` → `newValue` diff                                     |

#### Features

- **Pagination**: Server-side, 50 per page
- **Export CSV**: Download filtered results as CSV
- **Auto-refresh**: Optional toggle to poll every 30 seconds
- **Detail drawer**: Click a row to see full audit entry with old/new value JSON diff

### API Route

| Method | Endpoint                                | Action                                 |
| ------ | --------------------------------------- | -------------------------------------- |
| GET    | `/api/v1/super-admin/audit-logs`        | List with filters, pagination, sorting |
| GET    | `/api/v1/super-admin/audit-logs/export` | CSV export of filtered results         |

#### Query Parameters

```
?page=1
&limit=50
&from=2026-03-01
&to=2026-03-30
&societyId=uuid (or "platform" for SA-level)
&actionType=SA_PLAN_CREATED,SA_DISCOUNT_CREATED
&userId=uuid
&entityType=PlatformPlan
&sort=createdAt
&order=desc
```

### Sidebar Update

Add new nav item in `SuperAdminSidebar.tsx`:

```typescript
{ href: "/sa/audit-logs", label: "Audit Logs", icon: ScrollText },
```

Position: between Discounts and Settings.

---

## Phase 5: Dashboard Analytics

### Problem

The dashboard shows 4 static number cards and a recent societies list. No trends, revenue data, charts, or actionable insights.

### Enhanced Dashboard Layout

```
┌─────────────────────────────────────────────────────────┐
│ Row 1: KPI Cards (existing 4 + 4 new)                  │
│ [Total] [Active] [Trial] [Suspended]                    │
│ [MRR] [Expiring 30d] [Overdue Payments] [Total Revenue] │
├─────────────────────────────────────────────────────────┤
│ Row 2: Charts (2 columns)                               │
│ [Society Growth — line chart]  [Plan Distribution — pie] │
├─────────────────────────────────────────────────────────┤
│ Row 3: Tables (2 columns)                               │
│ [Recently Onboarded]  [Expiring Subscriptions]          │
├─────────────────────────────────────────────────────────┤
│ Row 4: Quick Actions                                    │
│ [Onboard Society] [Send Bulk Reminder] [View Audit Log] │
└─────────────────────────────────────────────────────────┘
```

### New KPI Cards

| Card                            | Source                                  | Calculation                                                      |
| ------------------------------- | --------------------------------------- | ---------------------------------------------------------------- |
| MRR (Monthly Recurring Revenue) | `SocietySubscription` + `BillingOption` | Sum of `finalPrice / billingMonths` for all ACTIVE subscriptions |
| Expiring in 30 Days             | `SocietySubscription`                   | Count where `currentPeriodEnd` is within 30 days                 |
| Overdue Payments                | `SubscriptionInvoice`                   | Count where status = `OVERDUE`                                   |
| Total Revenue (This Month)      | `SubscriptionPayment`                   | Sum of `amount` where `paidAt` is in current month               |

### Charts

**Society Growth (Line Chart):**

- X-axis: Last 12 months
- Y-axis: Cumulative society count
- Data: Count of societies by `onboardingDate` month, grouped cumulatively
- Library: `recharts` (lightweight, React-native, good Next.js SSR support)

**Plan Distribution (Donut/Pie Chart):**

- Segments: One per active plan
- Data: Count of ACTIVE subscriptions per `planId`
- Shows plan name + count + percentage

### New API Endpoints

| Method | Endpoint                                      | Returns                                      |
| ------ | --------------------------------------------- | -------------------------------------------- |
| GET    | `/api/v1/super-admin/stats/revenue`           | MRR, total revenue this month, overdue count |
| GET    | `/api/v1/super-admin/stats/growth`            | Monthly society counts for last 12 months    |
| GET    | `/api/v1/super-admin/stats/plan-distribution` | Active subscription counts per plan          |

### New Dependency

| Package    | Purpose                           | Size   |
| ---------- | --------------------------------- | ------ |
| `recharts` | Charting library (line, bar, pie) | ~200KB |

---

## Phase 6: Society Lifecycle Workflows

### Problem

Society status changes are just a dropdown in the edit form — no process, no reason, no notification, no grace period.

### Suspension Workflow

**Trigger:** Super admin clicks "Suspend" on society detail page.

**Flow:**

1. SA clicks "Suspend Society" → modal opens
2. SA enters:
   - **Reason** (required, 10-500 chars) — e.g., "Non-payment for 3 consecutive months"
   - **Grace Period** (optional, 0-30 days, default: 7) — days before access is restricted
   - **Notify Admin** (checkbox, default: checked) — send WhatsApp/email to society's primary admin
3. SA confirms → API call
4. Backend:
   - Sets `society.status = SUSPENDED`
   - Stores reason + suspension date in a new `SocietyStatusChange` record
   - If grace period > 0: sets `gracePeriodEnd` — society retains read-only access until then
   - If notify: sends notification to primary admin
   - Logs `SA_SOCIETY_SUSPENDED` audit entry

### Reactivation Workflow

**Trigger:** SA clicks "Reactivate" on a suspended society.

**Flow:**

1. SA clicks "Reactivate" → confirmation modal
2. SA enters optional note
3. Backend:
   - Sets `society.status = ACTIVE`
   - Creates `SocietyStatusChange` record
   - Notifies primary admin
   - Logs `SA_SOCIETY_REACTIVATED`

### Offboarding Workflow

**Trigger:** SA clicks "Offboard" on society detail page.

**Flow:**

1. SA clicks "Offboard Society" → multi-step confirmation
2. Step 1: Review society stats (residents, pending fees, active subscription)
3. Step 2: SA enters reason + confirms data retention policy acknowledgement
4. Step 3: Type society code to confirm (destructive action guard)
5. Backend:
   - Sets `society.status = OFFBOARDED`
   - Cancels active subscription
   - Creates `SocietyStatusChange` record
   - Sends final notification to primary admin
   - Logs `SA_SOCIETY_OFFBOARDED`

**Important:** Offboarding is a soft status change, NOT data deletion. All resident data, payments, and history are preserved for compliance. Only access is revoked.

### Database: New Model

```prisma
model SocietyStatusChange {
  id              String        @id @default(uuid()) @db.Uuid
  societyId       String        @map("society_id") @db.Uuid
  fromStatus      SocietyStatus @map("from_status")
  toStatus        SocietyStatus @map("to_status")
  reason          String        @db.Text
  note            String?       @db.Text
  gracePeriodEnd  DateTime?     @map("grace_period_end")
  notifiedAdmin   Boolean       @default(false) @map("notified_admin")
  performedBy     String        @map("performed_by") @db.Uuid
  createdAt       DateTime      @default(now()) @map("created_at")

  society         Society       @relation(fields: [societyId], references: [id])

  @@map("society_status_changes")
}
```

### API Routes

| Method | Endpoint                                            | Action                             |
| ------ | --------------------------------------------------- | ---------------------------------- |
| POST   | `/api/v1/super-admin/societies/[id]/suspend`        | Suspend with reason + grace period |
| POST   | `/api/v1/super-admin/societies/[id]/reactivate`     | Reactivate with optional note      |
| POST   | `/api/v1/super-admin/societies/[id]/offboard`       | Offboard with confirmation         |
| GET    | `/api/v1/super-admin/societies/[id]/status-history` | List all status changes            |

### UI Changes

**Society detail page** (`/sa/societies/[id]`):

- Replace generic "Edit" status dropdown with dedicated action buttons:
  - ACTIVE → "Suspend" (orange button) + "Offboard" (red button)
  - TRIAL → "Activate" (green button) + "Suspend" (orange button)
  - SUSPENDED → "Reactivate" (green button) + "Offboard" (red button)
  - OFFBOARDED → Read-only badge, no actions
- New "Status History" tab showing timeline of all status changes with reasons

---

## Phase 7: Notification Center (Post-Core)

### Problem

Super admin has no centralized view of system alerts or platform health signals. Billing reminders, expiring trials, and failed notifications are scattered across different pages.

### Page: `/sa/notifications`

A lightweight notification feed showing system-generated alerts:

#### Alert Types

| Alert                        | Trigger                                | Priority |
| ---------------------------- | -------------------------------------- | -------- |
| Trial expiring               | Society trial ends in 3 days           | High     |
| Subscription expired         | `currentPeriodEnd` passed, not renewed | High     |
| Payment overdue              | Invoice past due date by 7+ days       | Medium   |
| New society registered       | Self-registration completed            | Low      |
| Admin activated              | New RWA admin activated for a society  | Low      |
| Notification delivery failed | WhatsApp/SMS delivery failed 3+ times  | Medium   |

#### Implementation Approach

**Option A (Simple — recommended for V1):** Server-computed alerts. No new database table. The `/sa/notifications` page calls a single API endpoint that computes alerts on the fly from existing data:

```
GET /api/v1/super-admin/notifications
```

Queries:

- `SocietySubscription WHERE status = TRIAL AND currentPeriodEnd < now() + 3 days`
- `SocietySubscription WHERE status = EXPIRED AND currentPeriodEnd > now() - 30 days`
- `SubscriptionInvoice WHERE status = OVERDUE`
- `Society WHERE createdAt > now() - 7 days`

Returns a unified list sorted by priority + date.

**Option B (Future):** Persistent notification table with read/unread state, allowing badge counts in sidebar. Build this when real-time alerts become necessary.

### Sidebar Update

```typescript
{ href: "/sa/notifications", label: "Alerts", icon: Bell },
```

Position: after Dashboard (top of sidebar for visibility).

---

## Phase 8: Society Deep-Dive — GOD Mode (Read-Only)

### The Core Problem

When SA clicks on a society today, they see a summary card with 3 numbers and some metadata. To see actual operations (residents, fees, expenses, events, petitions), they must click "View Dashboard" which opens the admin dashboard as a proxy — but even that doesn't show events or petitions to the SA because those pages are gated by society-scoped auth.

The super admin is the **platform owner**. They should see everything any admin or resident can see, for any society, without needing to "impersonate" or "log in as" an admin. This is **read-only access** — SA observes but does not interfere with day-to-day operations.

### Design Principle: Read-Only Observation

SA deep-dive is **read-only by design**. The SA can view all data but cannot:

- Approve/reject residents (that's the society admin's job)
- Record fee payments (admin's job)
- Create/edit expenses (admin's job)
- Create/publish events or petitions (admin's job)
- Send broadcasts (admin's job)

Exception: SA can **intervene** in exceptional cases (see Phase 6 for suspension/offboarding). But routine operations remain the admin's responsibility.

### Redesigned Society Detail Page: `/sa/societies/[id]`

Replace the current flat page with a **tabbed layout** — 11 tabs matching the admin's 11 sections:

```
┌──────────────────────────────────────────────────────────────────┐
│ [Society Name]  •  [Code: RWA-HR-GGN-122001-001]  •  [ACTIVE]  │
│ Plan: Community (Annual)  •  Admin: Rajesh Kumar                 │
├──────────────────────────────────────────────────────────────────┤
│ Overview | Residents | Fees | Expenses | Events | Petitions |    │
│ Reports | Broadcasts | Governing Body | Migrations | Settings   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│                    [Tab Content Area]                             │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Tab 1: Overview (existing, enhanced)

Current society detail content, restructured:

**Row 1: KPI Cards (6 cards)**
| Card | Data |
|------|------|
| Total Residents | Count of all non-rejected residents |
| Active & Paid | Count with status `ACTIVE_PAID` |
| Pending Approval | Count with status `PENDING_APPROVAL` |
| Fees Collected (This Session) | Sum of payments for current fee session |
| Collection Rate | `collected / totalDue × 100` |
| Balance in Hand | Fees collected - Total expenses |

**Row 2: Subscription Status Card** (existing)

**Row 3: Admin Team Card** (existing)

**Row 4: Registration Link** (existing)

**Row 5: Quick Action Buttons**

- Suspend / Reactivate / Offboard (from Phase 6)
- Status History timeline

### Tab 2: Residents

Read-only view of all residents in this society.

**Displayed Data:**

- Searchable, filterable data table (mirrors admin's `/admin/residents` but read-only)
- Columns: RWAID, Name, Email, Mobile (masked), Unit, Ownership Type, Status, Registration Date
- Filters: by status, by joining year, text search
- Pagination: server-side, 20 per page

**Resident Detail Drawer** (click a row):

- All personal details (name, email, mobile, RWAID, unit, ownership)
- Document status (ID proof uploaded? Ownership proof uploaded?)
- Fee history across all sessions (amount due, amount paid, status per session)
- Payment records (mode, reference, date, receipt)
- Event registrations (which events, status)
- Petition signatures (which petitions signed)
- Designation (if governing body member)

**What SA sees that admin also sees:** Everything — full resident profile, fee records, document status.
**What SA CANNOT do:** Approve, reject, deactivate, edit, send setup emails. These buttons are not rendered.

### Tab 3: Fees

Read-only view of fee collection for this society.

**Summary Cards:**

- Total Due (all outstanding this session)
- Total Collected (this session)
- Collection Rate (%)
- Overdue Count

**Fee Session Selector:** Dropdown to pick any fee session (current year, past years).

**Fee Collection Table:**

- Columns: Resident Name, RWAID, Unit, Amount Due, Amount Paid, Status, Last Payment Date
- Status badges: PAID (green), PENDING (yellow), OVERDUE (red), PARTIAL (orange), EXEMPTED (blue)
- Sortable by any column
- Filters: by status
- Pagination

**Individual Payment History** (expandable row or drawer):

- All payments for this resident's fee: amount, mode, reference, date, receipt link

### Tab 4: Expenses

Read-only view of expense ledger for this society.

**Summary Cards:**

- Total Expenses (all time or filtered period)
- Balance in Hand (collected - expenses)
- Top Category (highest spend category)

**Category Breakdown:** Bar chart or horizontal bars showing spend per category with percentages.

**Expense Table:**

- Columns: Date, Category (badge), Description, Amount, Logged By, Status
- Status: Active, Reversed, Reversal Entry
- Filters: by category, by date range, by scope (general / event)
- Pagination
- Receipt link (if uploaded)

### Tab 5: Events

Read-only view of all community events for this society.

**Event List:**

- Card or table view of all events (DRAFT, PUBLISHED, COMPLETED, CANCELLED)
- Columns: Title, Category, Date, Status, Fee Model, Registered Count
- Filters: by status, by category
- Search by title

**Event Detail Drawer** (click):

- Full event details (title, description, dates, location, category)
- Fee model info (FREE / FIXED ₹X / FLEXIBLE / CONTRIBUTION)
- Registration stats: total registered, confirmed, pending, cancelled
- **Registrations table:** Resident name, status, members count, amount (if paid)
- **Financial summary** (for completed/settled events):
  - Total collected
  - Total expenses (event-specific)
  - Net surplus/deficit
  - Settlement disposition
- **Event expenses** list (event-scoped expenses from expense ledger)

### Tab 6: Petitions

Read-only view of all petitions/complaints/notices for this society.

**Petition List:**

- Card or table view of all petitions (DRAFT, PUBLISHED, SUBMITTED, CLOSED)
- Columns: Title, Type (badge), Status, Signature Count / Target, Created Date
- Filters: by status, by type
- Search by title

**Petition Detail Drawer** (click):

- Full details: title, description, type, target authority, deadline
- Status badge with dates (created, published, submitted, closed)
- Closed reason (if closed)
- **Document viewer:** Embedded PDF (same signed-URL approach as admin view)
- **Signature progress:** Count + progress bar (X of Y target)
- **Signatories table** (SA sees everything admin sees):
  - Resident name, unit, method (Drawn/Uploaded), date signed
  - Signature image preview (via signed URL)
- **Download compiled PDF report** (same as admin can do)

### Tab 7: Reports

SA can generate any of the 5 report types for this society, using the same report generation engine the admin uses.

**Available Reports:**

1. Fee Collection Report (per session)
2. Expense Ledger (per session)
3. Resident Directory
4. Financial Summary (per session)
5. Outstanding Dues (per session)

**UI:**

- Report type selector (radio buttons or cards)
- Session selector (for session-scoped reports)
- Format selector: PDF or Excel
- Generate + Download button

**Implementation:** Reuse the existing report generation APIs (`/api/v1/admin/reports/[type]`) but add SA authorization. The existing APIs are society-scoped — SA passes the society ID.

### Tab 8: Broadcasts

Read-only view of WhatsApp broadcast history for this society.

**Broadcast History Table:**

- Columns: Date/Time, Message Preview (truncated), Recipient Filter (All/Pending/Overdue), Recipients Count, Sent By (admin name)
- Expandable row to see full message text
- Pagination

**What SA CANNOT do:** Send broadcasts. That remains the admin's responsibility.

### Tab 9: Governing Body

Read-only view of the society's committee/governing body.

**Designations List:**

- All defined designations (Chairperson, Secretary, Treasurer, etc.)
- Sort order

**Members Table:**

- Columns: Designation, Member Name, Mobile (masked), Email, Assigned Date
- Shows vacant positions (designation with no member)

### Tab 10: Migrations

Read-only view of bulk import history for this society.

**Migration Batch Table:**

- Columns: Date, File Name, Total Rows, Imported, Failed, Status, Initiated By
- Expandable row for error details (row number, field, error message)

### Tab 11: Settings (Read-Only)

Display the society's current configuration:

**Society Info:** Name, code, type, state, city, pincode
**Fee Config:** Joining fee, annual fee, grace period, session start month
**Email Verification:** Enabled/disabled
**Fee Sessions:** Table of all sessions (year, fees, start/end dates, status)
**Subscription:** Current plan, billing cycle, price, renewal date

**What SA CANNOT do here:** Edit settings. Use the existing Edit Society page for that.

### API Routes for Society Deep-Dive

All routes under `/api/v1/super-admin/societies/[id]/`:

| Method | Endpoint                     | Returns                                                           |
| ------ | ---------------------------- | ----------------------------------------------------------------- |
| GET    | `.../residents`              | Paginated resident list with filters                              |
| GET    | `.../residents/[rid]`        | Full resident detail (profile, fees, payments, events, petitions) |
| GET    | `.../fees`                   | Fee collection table for a session                                |
| GET    | `.../fees/summary`           | Collection summary cards                                          |
| GET    | `.../expenses`               | Paginated expense ledger with filters                             |
| GET    | `.../expenses/summary`       | Expense summary + category breakdown                              |
| GET    | `.../events`                 | Paginated event list with filters                                 |
| GET    | `.../events/[eid]`           | Event detail + registrations + finances                           |
| GET    | `.../petitions`              | Paginated petition list with filters                              |
| GET    | `.../petitions/[pid]`        | Petition detail + signatories                                     |
| GET    | `.../petitions/[pid]/report` | Download compiled PDF report                                      |
| GET    | `.../reports/[type]`         | Generate report (reuse existing engine)                           |
| GET    | `.../broadcasts`             | Paginated broadcast history                                       |
| GET    | `.../governing-body`         | Designations + members                                            |
| GET    | `.../migrations`             | Migration batch history                                           |
| GET    | `.../settings`               | Full society config + fee sessions                                |

**Total: 16 new GET-only API routes** (read-only, no mutations).

All routes use `requireSuperAdmin()` guard from Phase 1.

### Implementation Approach

These API routes will largely **reuse existing Prisma queries** from the admin API routes (`/api/v1/admin/*`). The difference:

- Admin routes use `getFullAccessAdmin()` which validates the caller is an admin of that specific society.
- SA routes use `requireSuperAdmin()` which validates the caller is a platform super admin, then accepts any `societyId` as a path param.

The business logic (query structure, data shaping, pagination) can be extracted into shared service functions called by both admin and SA routes.

### SA-Specific Enhancements (Beyond What Admin Sees)

Since SA has a platform-wide view, add these extras to the deep-dive tabs:

| Tab       | SA-Only Enhancement                                                             |
| --------- | ------------------------------------------------------------------------------- |
| Overview  | **Health Score** — composite metric (see Phase 9)                               |
| Residents | **Cross-society flag** — if a resident's email/mobile exists in another society |
| Fees      | **Benchmark** — this society's collection rate vs. platform average             |
| Expenses  | **Benchmark** — expense per resident vs. platform average                       |
| Events    | **Engagement rate** — % of residents who register for events                    |
| Petitions | **Participation rate** — avg signatures as % of total residents                 |

---

## Phase 9: Platform-Wide Operational Views

### The Problem

SA can currently only see operational data one-society-at-a-time (after Phase 8). But as the platform grows to 50+ societies, the SA needs **aggregated views** to spot patterns, outliers, and health signals across the entire platform.

### Page: `/sa/residents`

Platform-wide resident directory.

**KPI Cards:**

- Total Residents (all societies)
- Active & Paid
- Pending Approval (across all)
- Overdue (across all)

**Data Table:**

- Columns: Name, Email, Mobile (masked), Society, Unit, Status, Registration Date
- Filters: by society, by status, text search
- Sortable, paginated (server-side, 50 per page)
- Click row → navigates to `/sa/societies/[societyId]` Residents tab with that resident selected

**Use Case:** SA gets a support call from a resident — searches by name or phone, instantly finds them across any society.

### Page: `/sa/operations`

Platform-wide operational dashboard (aggregate metrics).

**Row 1: Platform KPIs**
| Card | Calculation |
|------|-------------|
| Total Residents (all societies) | Sum of all non-rejected residents |
| Platform Fee Collection Rate | `totalCollected / totalDue × 100` across all societies |
| Total Expenses (this month) | Sum of all expenses across all societies this month |
| Active Events (all societies) | Count of PUBLISHED events across platform |
| Active Petitions (all societies) | Count of PUBLISHED petitions across platform |
| Broadcasts Sent (this month) | Total broadcasts across platform this month |

**Row 2: Society Health Table**
A ranked table of all societies with composite metrics:

| Column           | Data                                  |
| ---------------- | ------------------------------------- |
| Society Name     | Link to society detail                |
| Status           | ACTIVE / TRIAL / SUSPENDED badge      |
| Residents        | Total active count                    |
| Collection Rate  | Fee collection % this session         |
| Balance          | Current balance in hand               |
| Events (30d)     | Events created in last 30 days        |
| Petitions (30d)  | Petitions created in last 30 days     |
| Last Admin Login | When the primary admin last logged in |
| Health Score     | Composite score (see below)           |

**Health Score** (0-100):

```
health = (
  collectionRate × 0.30          // 30% weight: fee collection %
  + adminActivityScore × 0.25    // 25% weight: admin logged in recently?
  + residentGrowthScore × 0.15   // 15% weight: new residents joining?
  + engagementScore × 0.15       // 15% weight: events + petitions created
  + balanceScore × 0.15          // 15% weight: positive balance?
)
```

Color coding: 80-100 green, 50-79 yellow, 0-49 red.

**Row 3: Recent Activity Feed**
Chronological feed of notable events across all societies:

- "Eden Estate approved 5 new residents" (2 hours ago)
- "Green Valley created event: Holi Celebration" (5 hours ago)
- "Sunrise Towers collection rate dropped below 50%" (1 day ago)
- "Palm Heights admin hasn't logged in for 14 days" (alert)

### API Routes

| Method | Endpoint                                  | Returns                       |
| ------ | ----------------------------------------- | ----------------------------- |
| GET    | `/api/v1/super-admin/residents`           | Platform-wide resident search |
| GET    | `/api/v1/super-admin/operations/summary`  | Platform KPIs                 |
| GET    | `/api/v1/super-admin/operations/health`   | Society health table          |
| GET    | `/api/v1/super-admin/operations/activity` | Recent activity feed          |

---

## Phase 10: Platform-Wide Search

### The Problem

SA manages 50+ societies, thousands of residents, hundreds of transactions. They need a way to quickly find anything across the entire platform.

### Feature: Global Search Bar

Add a search bar to the SA header/layout (always visible):

```
┌──────────────────────────────────────────────┐
│ 🔍 Search residents, societies, transactions │
└──────────────────────────────────────────────┘
```

**Search Targets:**

| Category  | Searchable Fields                | Result Display                     |
| --------- | -------------------------------- | ---------------------------------- |
| Societies | Name, code, city                 | Name + code + status badge         |
| Residents | Name, email, mobile, RWAID       | Name + society + status            |
| Payments  | Reference number, receipt number | Amount + resident + society + date |
| Events    | Title                            | Title + society + status           |
| Petitions | Title                            | Title + society + status           |

**Behavior:**

- Debounced search (300ms delay)
- Results grouped by category
- Max 5 results per category
- Click result → navigates to the relevant detail page
- Keyboard shortcut: `Ctrl+K` or `/` to focus search

### API Route

| Method | Endpoint                            | Returns                               |
| ------ | ----------------------------------- | ------------------------------------- |
| GET    | `/api/v1/super-admin/search?q=term` | Grouped results across all categories |

### Implementation

Single API route that runs parallel queries:

```typescript
const [societies, residents, payments, events, petitions] = await Promise.all([
  prisma.society.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { societyCode: { contains: q, mode: "insensitive" } },
      ],
    },
    take: 5,
  }),
  prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { mobile: { contains: q } },
        { rwaid: { contains: q, mode: "insensitive" } },
      ],
    },
    take: 5,
    include: { society: { select: { name: true } } },
  }),
  // ... payments, events, petitions similarly
]);
```

---

## Phase 11: SA-to-Admin Communication

### The Problem

SA has no way to communicate with society admins through the platform. If a subscription is expiring or a compliance issue needs attention, SA must use external channels (email, phone).

### Feature: Platform Announcements

**Page: `/sa/announcements`**

SA can send messages to society admins:

**Types:**
| Type | Recipients | Use Case |
|------|-----------|----------|
| Platform-wide | All primary admins | Feature updates, maintenance windows, policy changes |
| Targeted | Specific society's admin(s) | Billing issues, compliance warnings, support responses |

**Announcement Form:**

- Subject (required, 5-200 chars)
- Message body (required, 10-5000 chars, markdown supported)
- Scope: All societies / Select societies (multi-select)
- Priority: Normal / Urgent (urgent shows persistent banner in admin dashboard)
- Send via: In-app only / In-app + Email / In-app + WhatsApp

**Admin-Side Display:**

- Banner at top of admin dashboard for unread announcements
- Notification icon in admin sidebar with unread count
- Announcement list page accessible from banner

### Database: New Model

```prisma
model PlatformAnnouncement {
  id          String    @id @default(uuid()) @db.Uuid
  subject     String    @db.VarChar(200)
  body        String    @db.Text
  priority    String    @default("NORMAL") @db.VarChar(10)   // NORMAL, URGENT
  scope       String    @default("ALL") @db.VarChar(10)      // ALL, TARGETED
  societyIds  String[]  @map("society_ids") @db.Uuid         // empty = all
  sentVia     String[]  @map("sent_via")                     // ["IN_APP", "EMAIL", "WHATSAPP"]
  createdBy   String    @map("created_by") @db.Uuid
  createdAt   DateTime  @default(now()) @map("created_at")

  @@map("platform_announcements")
}

model AnnouncementRead {
  id              String   @id @default(uuid()) @db.Uuid
  announcementId  String   @map("announcement_id") @db.Uuid
  userId          String   @map("user_id") @db.Uuid
  readAt          DateTime @default(now()) @map("read_at")

  announcement    PlatformAnnouncement @relation(fields: [announcementId], references: [id])
  user            User                 @relation(fields: [userId], references: [id])

  @@unique([announcementId, userId])
  @@map("announcement_reads")
}
```

### API Routes

| Method | Endpoint                                 | Action                           |
| ------ | ---------------------------------------- | -------------------------------- |
| GET    | `/api/v1/super-admin/announcements`      | List all announcements           |
| POST   | `/api/v1/super-admin/announcements`      | Create + send announcement       |
| GET    | `/api/v1/super-admin/announcements/[id]` | Detail + read stats              |
| GET    | `/api/v1/admin/announcements`            | Admin: list unread announcements |
| POST   | `/api/v1/admin/announcements/[id]/read`  | Admin: mark as read              |

---

## Phase 12: Support Requests (Admin → Super Admin)

### The Problem

RWA admins have no way to contact the super admin through the platform. If they have a billing question, a bug report, a feature request, or need technical help, they must use external channels (phone, email). There's no tracking, no status visibility, and no audit trail of support interactions.

### What It Does

- RWA admin raises a **service request** (ticket) from their admin panel — choosing a type, priority, subject, and description.
- Super admin sees all requests in a centralized **support queue** with filters and status management.
- Both sides can exchange **messages** on a ticket (threaded conversation).
- Tickets move through a defined **lifecycle** with statuses visible to both parties.
- Admin gets notified when SA responds; SA gets notified when a new request arrives.

### Request Types

```
ServiceRequestType:
  BUG_REPORT          — Something isn't working
  FEATURE_REQUEST     — Request a new feature or improvement
  BILLING_INQUIRY     — Subscription, invoice, or payment questions
  TECHNICAL_SUPPORT   — Help with setup, configuration, or usage
  ACCOUNT_ISSUE       — Admin access, password, or login problems
  DATA_REQUEST        — Export, correction, or deletion of data
  COMPLIANCE          — Legal, privacy, or regulatory questions
  OTHER               — Anything that doesn't fit above
```

### Request Priority

```
ServiceRequestPriority:  LOW | MEDIUM | HIGH | URGENT
```

| Priority | SLA Expectation (display-only, not enforced) | Use Case                                      |
| -------- | -------------------------------------------- | --------------------------------------------- |
| LOW      | 5 business days                              | Feature requests, minor UI issues             |
| MEDIUM   | 2 business days                              | Non-blocking bugs, billing clarifications     |
| HIGH     | 1 business day                               | Broken functionality, payment failures        |
| URGENT   | Same day                                     | Society locked out, data loss, security issue |

**Important:** SLA is display-only — a hint for SA to prioritize. No automated escalation or enforcement.

### Request Statuses

```
ServiceRequestStatus:
  OPEN              — Newly created, waiting for SA to pick up
  IN_PROGRESS       — SA is investigating / working on it
  AWAITING_ADMIN    — SA responded, waiting for admin to provide info
  AWAITING_SA       — Admin responded, waiting for SA to follow up
  RESOLVED          — SA marked as resolved (admin can reopen within 7 days)
  CLOSED            — Permanently closed (no reopen)
```

```
State machine:

OPEN → IN_PROGRESS → AWAITING_ADMIN ↔ AWAITING_SA → RESOLVED → CLOSED
                   → RESOLVED (skip back-and-forth if quick fix)
                   → CLOSED (SA closes directly if spam/duplicate)

RESOLVED → OPEN (admin reopens within 7 days)
```

**Auto-close rule:** Requests in RESOLVED status for 7+ days auto-transition to CLOSED via cron. Once CLOSED, admin must create a new request.

### Admin Side

#### New Sidebar Item

```typescript
{ href: "/admin/support", label: "Support", icon: LifeBuoy },
```

#### Page: `/admin/support`

**Create Request Button** → opens a form:

| Field       | Required | Validation                                                                              |
| ----------- | -------- | --------------------------------------------------------------------------------------- |
| Type        | Yes      | One of 8 types                                                                          |
| Priority    | Yes      | LOW / MEDIUM / HIGH / URGENT (default: MEDIUM)                                          |
| Subject     | Yes      | 5-200 chars                                                                             |
| Description | Yes      | 20-5000 chars, markdown supported                                                       |
| Attachments | No       | Up to 3 files, max 5MB each (screenshots, PDFs). Stored in `support-attachments` bucket |

**Request List:**

- Table view with filters:
  - By status (open, in-progress, awaiting, resolved, closed)
  - By type
  - By priority
- Columns: ID (#), Subject, Type (badge), Priority (color-coded), Status, Last Updated, Messages Count
- Sorted by: last updated descending (most recent activity first)
- Pagination: 20 per page

**Request Detail** (`/admin/support/[requestId]`):

- Header: Subject, type badge, priority badge, status badge, created date
- **Conversation thread:** chronological list of messages from both sides
  - Each message shows: author (admin name or "Super Admin"), timestamp, content (markdown rendered), attachments
  - Admin can post a new message (text + optional attachments)
  - If status is AWAITING_ADMIN: prominent "Reply" prompt
  - If status is RESOLVED: "Reopen" button (only within 7 days) + "This resolved my issue" confirmation
  - If status is CLOSED: read-only, no new messages
- **Status timeline:** sidebar showing status transitions with dates

### Super Admin Side

#### New Sidebar Item

```typescript
{ href: "/sa/support", label: "Support", icon: LifeBuoy },
```

#### Page: `/sa/support`

**Support Queue Dashboard:**

**KPI Cards:**
| Card | Data |
|------|------|
| Open | Count of OPEN requests |
| In Progress | Count of IN_PROGRESS |
| Awaiting SA | Count of AWAITING_SA (SA needs to respond) |
| Resolved (7d) | Count resolved in last 7 days |
| Avg Resolution Time | Average time from OPEN to RESOLVED (last 30 days) |

**Request List:**

- All requests from all societies
- Columns: ID, Society Name, Subject, Type (badge), Priority (color-coded), Status, Admin Name, Last Updated, Messages
- Filters: by society, by status, by type, by priority, text search
- Sort: by priority (urgent first) then by last updated
- Pagination: 50 per page

**Color coding by priority:** URGENT = red row highlight, HIGH = orange text, MEDIUM = default, LOW = muted

#### Request Detail (`/sa/support/[requestId]`)

Same conversation thread as admin side, plus:

**SA Actions:**
| Action | When Available | Effect |
|--------|---------------|--------|
| Pick Up | Status is OPEN | Sets to IN_PROGRESS |
| Reply | Any non-CLOSED status | Posts message, sets status to AWAITING_ADMIN |
| Request Info | IN_PROGRESS | Posts message, sets status to AWAITING_ADMIN |
| Resolve | Any non-CLOSED status | Sets to RESOLVED, admin gets notified |
| Close | Any status | Sets to CLOSED (no reopen). Requires reason if no prior messages. |
| Add Internal Note | Any status | Private note visible only to SA (not shown to admin) |

**Internal Notes:** SA can add private notes that are not visible to the admin. Useful for tracking investigation progress, linking to internal issues, or noting workarounds tried. Displayed with a distinct "internal" badge and background color in the SA view.

### Database: New Models

```prisma
enum ServiceRequestType {
  BUG_REPORT
  FEATURE_REQUEST
  BILLING_INQUIRY
  TECHNICAL_SUPPORT
  ACCOUNT_ISSUE
  DATA_REQUEST
  COMPLIANCE
  OTHER
}

enum ServiceRequestPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum ServiceRequestStatus {
  OPEN
  IN_PROGRESS
  AWAITING_ADMIN
  AWAITING_SA
  RESOLVED
  CLOSED
}

model ServiceRequest {
  id            String                  @id @default(uuid()) @db.Uuid
  societyId     String                  @map("society_id") @db.Uuid
  requestNumber Int                     @unique @default(autoincrement()) @map("request_number")
  type          ServiceRequestType
  priority      ServiceRequestPriority  @default(MEDIUM)
  status        ServiceRequestStatus    @default(OPEN)
  subject       String                  @db.VarChar(200)
  description   String                  @db.Text
  createdBy     String                  @map("created_by") @db.Uuid
  resolvedAt    DateTime?               @map("resolved_at")
  closedAt      DateTime?               @map("closed_at")
  closedReason  String?                 @map("closed_reason") @db.Text
  createdAt     DateTime                @default(now()) @map("created_at")
  updatedAt     DateTime                @updatedAt @map("updated_at")

  society       Society                 @relation(fields: [societyId], references: [id])
  createdByUser User                    @relation(fields: [createdBy], references: [id])
  messages      ServiceRequestMessage[]

  @@index([societyId])
  @@index([status])
  @@index([priority, updatedAt(sort: Desc)])
  @@map("service_requests")
}

model ServiceRequestMessage {
  id              String          @id @default(uuid()) @db.Uuid
  requestId       String          @map("request_id") @db.Uuid
  authorId        String          @map("author_id") @db.Uuid
  authorRole      String          @map("author_role") @db.VarChar(20)  // "ADMIN" or "SUPER_ADMIN"
  content         String          @db.Text
  isInternal      Boolean         @default(false) @map("is_internal")  // SA-only private notes
  attachments     String[]        @default([])                         // Storage paths
  createdAt       DateTime        @default(now()) @map("created_at")

  request         ServiceRequest  @relation(fields: [requestId], references: [id], onDelete: Cascade)

  @@index([requestId, createdAt])
  @@map("service_request_messages")
}
```

### Supabase Storage

| Bucket                | Access  | Purpose                                                                                        |
| --------------------- | ------- | ---------------------------------------------------------------------------------------------- |
| `support-attachments` | Private | Screenshots, PDFs attached to service requests. Max 5MB per file. Signed URLs (60-min expiry). |

### API Routes — Admin Side

All under `/api/v1/admin/support/`:

| Method | Endpoint                              | Action                                             |
| ------ | ------------------------------------- | -------------------------------------------------- |
| GET    | `/api/v1/admin/support`               | List my society's requests (paginated, filterable) |
| POST   | `/api/v1/admin/support`               | Create a new service request                       |
| GET    | `/api/v1/admin/support/[id]`          | Request detail + all messages (non-internal only)  |
| POST   | `/api/v1/admin/support/[id]/messages` | Post a reply message (+ optional attachments)      |
| POST   | `/api/v1/admin/support/[id]/reopen`   | Reopen a RESOLVED request (within 7 days)          |
| GET    | `/api/v1/admin/support/unread-count`  | Count of requests with new SA replies (for badge)  |

### API Routes — Super Admin Side

All under `/api/v1/super-admin/support/`:

| Method | Endpoint                                       | Action                                                     |
| ------ | ---------------------------------------------- | ---------------------------------------------------------- |
| GET    | `/api/v1/super-admin/support`                  | List all requests across societies (paginated, filterable) |
| GET    | `/api/v1/super-admin/support/stats`            | Queue KPIs (open, in-progress, awaiting, avg resolution)   |
| GET    | `/api/v1/super-admin/support/[id]`             | Request detail + ALL messages (including internal notes)   |
| POST   | `/api/v1/super-admin/support/[id]/messages`    | Post reply or internal note                                |
| PATCH  | `/api/v1/super-admin/support/[id]/status`      | Change status (pick up, resolve, close)                    |
| POST   | `/api/v1/super-admin/support/[id]/attachments` | Upload attachment to a message                             |

### Notifications

| Trigger                      | Recipient         | Channel                | Content                                               |
| ---------------------------- | ----------------- | ---------------------- | ----------------------------------------------------- |
| New request created          | SA                | In-app alert (Phase 7) | "New {priority} {type} from {society}: {subject}"     |
| SA replies / status change   | Admin who created | WhatsApp + in-app      | "Your request #{number} has been updated: {status}"   |
| Admin replies                | SA                | In-app alert           | "Admin replied on #{number}: {subject}"               |
| Request auto-closed (7 days) | Admin who created | WhatsApp               | "Your request #{number} has been closed after 7 days" |

### Audit Actions

Add to `src/lib/audit.ts`:

```
| "SUPPORT_REQUEST_CREATED"
| "SUPPORT_REQUEST_STATUS_CHANGED"
| "SUPPORT_REQUEST_MESSAGE_SENT"
| "SUPPORT_REQUEST_REOPENED"
| "SUPPORT_REQUEST_AUTO_CLOSED"
```

### Cron Job: Auto-Close Resolved Requests

New cron endpoint:

```
POST /api/cron/support-auto-close
```

Runs daily. Finds all requests with `status = RESOLVED` and `resolvedAt < now() - 7 days`, transitions them to CLOSED, and sends WhatsApp notification to the admin.

### Edge Cases & Rules

1. **Admin can only see their society's requests** — scoped by `societyId` via `getFullAccessAdmin()`.
2. **Both READ_NOTIFY and FULL_ACCESS admins can create requests** — support is not restricted to primary admin.
3. **SA internal notes are never exposed** — filtered out in admin-side API responses (`WHERE isInternal = false`).
4. **Attachments per message:** Max 3 files, max 5MB each. Allowed types: JPG, PNG, PDF, WEBP.
5. **Reopen window:** Admin can reopen a RESOLVED request within 7 days. After that, they must create a new request. The button disappears after 7 days.
6. **Duplicate detection:** No automated duplicate detection. SA can manually close duplicates with reason "Duplicate of #X".
7. **Request number:** Auto-incrementing integer for easy reference in conversations ("Request #42"). Uses Prisma `@default(autoincrement())`.
8. **Markdown in messages:** Both admin and SA can use markdown in messages. Rendered with a safe markdown renderer (no raw HTML).
9. **Empty queue state:** When SA has zero open requests, show a congratulatory empty state: "All caught up! No open requests."
10. **Priority escalation:** SA can change priority on any request (e.g., admin filed as LOW but SA bumps to HIGH after investigation).

---

## Files to Create

### Phase 1-7 Files (Platform-Level)

| File                                                                | Purpose                                            |
| ------------------------------------------------------------------- | -------------------------------------------------- |
| `src/lib/auth-guard.ts`                                             | `requireSuperAdmin()` authorization helper         |
| `src/app/sa/settings/page.tsx`                                      | Settings page (profile, security, platform config) |
| `src/app/sa/audit-logs/page.tsx`                                    | Audit log viewer with filters                      |
| `src/app/sa/notifications/page.tsx`                                 | Notification center / alerts feed                  |
| `src/app/api/v1/super-admin/audit-logs/route.ts`                    | Audit log list + filter API                        |
| `src/app/api/v1/super-admin/audit-logs/export/route.ts`             | CSV export                                         |
| `src/app/api/v1/super-admin/settings/profile/route.ts`              | SA profile CRUD                                    |
| `src/app/api/v1/super-admin/settings/change-password/route.ts`      | Password change                                    |
| `src/app/api/v1/super-admin/settings/platform-config/route.ts`      | Platform config CRUD                               |
| `src/app/api/v1/super-admin/stats/revenue/route.ts`                 | Revenue metrics                                    |
| `src/app/api/v1/super-admin/stats/growth/route.ts`                  | Society growth data                                |
| `src/app/api/v1/super-admin/stats/plan-distribution/route.ts`       | Plan distribution data                             |
| `src/app/api/v1/super-admin/societies/[id]/suspend/route.ts`        | Suspension endpoint                                |
| `src/app/api/v1/super-admin/societies/[id]/reactivate/route.ts`     | Reactivation endpoint                              |
| `src/app/api/v1/super-admin/societies/[id]/offboard/route.ts`       | Offboarding endpoint                               |
| `src/app/api/v1/super-admin/societies/[id]/status-history/route.ts` | Status change history                              |
| `src/app/api/v1/super-admin/notifications/route.ts`                 | Computed alerts API                                |
| `src/services/audit-logs.ts`                                        | Client fetch wrappers for audit log API            |
| `src/services/sa-settings.ts`                                       | Client fetch wrappers for settings API             |
| `src/services/sa-notifications.ts`                                  | Client fetch wrappers for notifications API        |
| `src/lib/validations/sa-settings.ts`                                | Zod schemas for settings + password change         |
| `src/lib/validations/society-lifecycle.ts`                          | Zod schemas for suspend/offboard                   |
| `src/components/features/audit/AuditLogTable.tsx`                   | Audit log data table with expandable rows          |
| `src/components/features/dashboard/RevenueCards.tsx`                | Revenue KPI cards                                  |
| `src/components/features/dashboard/SocietyGrowthChart.tsx`          | Line chart component                               |
| `src/components/features/dashboard/PlanDistributionChart.tsx`       | Pie/donut chart component                          |
| `src/components/features/societies/SuspendModal.tsx`                | Suspension confirmation modal                      |
| `src/components/features/societies/OffboardWizard.tsx`              | Multi-step offboarding dialog                      |
| `src/components/features/societies/StatusTimeline.tsx`              | Status change history timeline                     |

### Phase 8 Files (Society Deep-Dive — GOD Mode)

| File                                                                        | Purpose                                      |
| --------------------------------------------------------------------------- | -------------------------------------------- |
| `src/app/api/v1/super-admin/societies/[id]/residents/route.ts`              | Paginated resident list                      |
| `src/app/api/v1/super-admin/societies/[id]/residents/[rid]/route.ts`        | Full resident detail                         |
| `src/app/api/v1/super-admin/societies/[id]/fees/route.ts`                   | Fee collection table                         |
| `src/app/api/v1/super-admin/societies/[id]/fees/summary/route.ts`           | Fee summary cards                            |
| `src/app/api/v1/super-admin/societies/[id]/expenses/route.ts`               | Expense ledger                               |
| `src/app/api/v1/super-admin/societies/[id]/expenses/summary/route.ts`       | Expense summary + categories                 |
| `src/app/api/v1/super-admin/societies/[id]/events/route.ts`                 | Event list                                   |
| `src/app/api/v1/super-admin/societies/[id]/events/[eid]/route.ts`           | Event detail + registrations + finances      |
| `src/app/api/v1/super-admin/societies/[id]/petitions/route.ts`              | Petition list                                |
| `src/app/api/v1/super-admin/societies/[id]/petitions/[pid]/route.ts`        | Petition detail + signatories                |
| `src/app/api/v1/super-admin/societies/[id]/petitions/[pid]/report/route.ts` | Download compiled PDF                        |
| `src/app/api/v1/super-admin/societies/[id]/reports/[type]/route.ts`         | Generate report (PDF/Excel)                  |
| `src/app/api/v1/super-admin/societies/[id]/broadcasts/route.ts`             | Broadcast history                            |
| `src/app/api/v1/super-admin/societies/[id]/governing-body/route.ts`         | Designations + members                       |
| `src/app/api/v1/super-admin/societies/[id]/migrations/route.ts`             | Migration batch history                      |
| `src/app/api/v1/super-admin/societies/[id]/settings/route.ts`               | Society config + fee sessions                |
| `src/components/features/sa-society/SocietyTabs.tsx`                        | Tab container for society deep-dive          |
| `src/components/features/sa-society/OverviewTab.tsx`                        | Enhanced overview with KPIs                  |
| `src/components/features/sa-society/ResidentsTab.tsx`                       | Read-only residents table + detail drawer    |
| `src/components/features/sa-society/FeesTab.tsx`                            | Read-only fee collection view                |
| `src/components/features/sa-society/ExpensesTab.tsx`                        | Read-only expense ledger                     |
| `src/components/features/sa-society/EventsTab.tsx`                          | Read-only events list + detail drawer        |
| `src/components/features/sa-society/PetitionsTab.tsx`                       | Read-only petitions + signatories            |
| `src/components/features/sa-society/ReportsTab.tsx`                         | Report generation UI                         |
| `src/components/features/sa-society/BroadcastsTab.tsx`                      | Read-only broadcast history                  |
| `src/components/features/sa-society/GoverningBodyTab.tsx`                   | Read-only committee view                     |
| `src/components/features/sa-society/MigrationsTab.tsx`                      | Read-only migration history                  |
| `src/components/features/sa-society/SettingsTab.tsx`                        | Read-only society config                     |
| `src/services/sa-society-deep-dive.ts`                                      | Client fetch wrappers for all deep-dive APIs |

### Phase 9 Files (Platform-Wide Operational Views)

| File                                                        | Purpose                                   |
| ----------------------------------------------------------- | ----------------------------------------- |
| `src/app/sa/residents/page.tsx`                             | Platform-wide resident directory          |
| `src/app/sa/operations/page.tsx`                            | Platform-wide operational dashboard       |
| `src/app/api/v1/super-admin/residents/route.ts`             | Cross-society resident search             |
| `src/app/api/v1/super-admin/operations/summary/route.ts`    | Platform KPIs                             |
| `src/app/api/v1/super-admin/operations/health/route.ts`     | Society health scores                     |
| `src/app/api/v1/super-admin/operations/activity/route.ts`   | Recent activity feed                      |
| `src/components/features/operations/SocietyHealthTable.tsx` | Health score ranked table                 |
| `src/components/features/operations/ActivityFeed.tsx`       | Platform activity timeline                |
| `src/services/sa-operations.ts`                             | Client fetch wrappers for operations APIs |

### Phase 10 Files (Global Search)

| File                                                    | Purpose                         |
| ------------------------------------------------------- | ------------------------------- |
| `src/app/api/v1/super-admin/search/route.ts`            | Cross-entity global search API  |
| `src/components/features/sa-search/GlobalSearchBar.tsx` | Search bar component (Ctrl+K)   |
| `src/components/features/sa-search/SearchResults.tsx`   | Grouped search results dropdown |

### Phase 11 Files (SA-to-Admin Communication)

| File                                                           | Purpose                           |
| -------------------------------------------------------------- | --------------------------------- |
| `src/app/sa/announcements/page.tsx`                            | SA announcement management page   |
| `src/app/api/v1/super-admin/announcements/route.ts`            | Create + list announcements       |
| `src/app/api/v1/super-admin/announcements/[id]/route.ts`       | Detail + read stats               |
| `src/app/api/v1/admin/announcements/route.ts`                  | Admin: fetch unread announcements |
| `src/app/api/v1/admin/announcements/[id]/read/route.ts`        | Admin: mark as read               |
| `src/components/features/announcements/AnnouncementBanner.tsx` | Admin dashboard banner            |
| `src/services/announcements.ts`                                | Client fetch wrappers             |
| `src/lib/validations/announcement.ts`                          | Zod schemas                       |

### Phase 12 Files (Support Requests)

| File                                                           | Purpose                                         |
| -------------------------------------------------------------- | ----------------------------------------------- |
| `src/app/admin/support/page.tsx`                               | Admin: support request list + create            |
| `src/app/admin/support/[requestId]/page.tsx`                   | Admin: request detail + conversation thread     |
| `src/app/sa/support/page.tsx`                                  | SA: support queue dashboard + request list      |
| `src/app/sa/support/[requestId]/page.tsx`                      | SA: request detail + conversation + actions     |
| `src/app/api/v1/admin/support/route.ts`                        | Admin: list + create requests                   |
| `src/app/api/v1/admin/support/[id]/route.ts`                   | Admin: request detail                           |
| `src/app/api/v1/admin/support/[id]/messages/route.ts`          | Admin: post reply                               |
| `src/app/api/v1/admin/support/[id]/reopen/route.ts`            | Admin: reopen resolved request                  |
| `src/app/api/v1/admin/support/unread-count/route.ts`           | Admin: badge count                              |
| `src/app/api/v1/super-admin/support/route.ts`                  | SA: list all requests                           |
| `src/app/api/v1/super-admin/support/stats/route.ts`            | SA: queue KPIs                                  |
| `src/app/api/v1/super-admin/support/[id]/route.ts`             | SA: request detail (with internal notes)        |
| `src/app/api/v1/super-admin/support/[id]/messages/route.ts`    | SA: post reply or internal note                 |
| `src/app/api/v1/super-admin/support/[id]/status/route.ts`      | SA: change status                               |
| `src/app/api/v1/super-admin/support/[id]/attachments/route.ts` | SA: upload attachment                           |
| `src/app/api/cron/support-auto-close/route.ts`                 | Cron: auto-close resolved requests after 7 days |
| `src/components/features/support/ConversationThread.tsx`       | Shared message thread component                 |
| `src/components/features/support/RequestForm.tsx`              | Admin: create request form                      |
| `src/components/features/support/StatusBadge.tsx`              | Color-coded status badge                        |
| `src/components/features/support/PriorityBadge.tsx`            | Color-coded priority indicator                  |
| `src/components/features/support/InternalNote.tsx`             | SA-only private note display                    |
| `src/components/features/support/StatusTimeline.tsx`           | Status transition history                       |
| `src/services/support.ts`                                      | Client fetch wrappers (admin + SA)              |
| `src/lib/validations/support.ts`                               | Zod schemas for request, message, status change |

## Files to Modify

| File                                          | Change                                                                                                                                                                                              |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/audit.ts`                            | Add 22 new SA audit action types                                                                                                                                                                    |
| `src/lib/api-helpers.ts`                      | No changes needed (already has `forbiddenError()`)                                                                                                                                                  |
| `src/proxy.ts`                                | Add SA-specific inactivity timeout for `/sa` routes (matching `/admin` pattern)                                                                                                                     |
| `src/components/layout/SuperAdminSidebar.tsx` | Add Audit Logs, Alerts, Residents, Operations, Announcements nav items                                                                                                                              |
| `src/app/sa/layout.tsx`                       | Add server-side SA role check + global search bar in header                                                                                                                                         |
| `src/app/sa/dashboard/page.tsx`               | Add revenue cards, charts, quick actions                                                                                                                                                            |
| `src/app/sa/societies/[id]/page.tsx`          | **Complete rewrite** — flat page → tabbed deep-dive (11 tabs)                                                                                                                                       |
| `src/components/layout/AdminSidebar.tsx`      | Add announcement notification badge                                                                                                                                                                 |
| `src/app/admin/dashboard/page.tsx`            | Add announcement banner for unread platform messages                                                                                                                                                |
| `src/components/layout/AdminSidebar.tsx`      | Add "Support" nav item with unread badge                                                                                                                                                            |
| `supabase/schema.prisma`                      | Add `PlatformConfig`, `SocietyStatusChange`, `PlatformAnnouncement`, `AnnouncementRead`, `ServiceRequest`, `ServiceRequestMessage` models + 3 new enums; widen `AuditLog.actionType` to VarChar(50) |
| All 16 SA API route files                     | Add `requireSuperAdmin()` guard at top of every handler                                                                                                                                             |

---

## New Dependencies

| Package    | Purpose                                         | Size   |
| ---------- | ----------------------------------------------- | ------ |
| `recharts` | Charts for dashboard analytics (line, pie, bar) | ~200KB |

No other new dependencies required.

---

## Database Migrations

### Migration 1: Auth & Audit Fix

```sql
-- Widen actionType column for longer SA action names
ALTER TABLE audit_logs ALTER COLUMN action_type TYPE VARCHAR(50);
```

### Migration 2: Platform Config

```sql
CREATE TABLE platform_configs (
  key         VARCHAR(100) PRIMARY KEY,
  value       TEXT NOT NULL,
  type        VARCHAR(20) NOT NULL DEFAULT 'string',
  label       VARCHAR(200) NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID REFERENCES super_admins(id)
);

-- Seed default values
INSERT INTO platform_configs (key, value, type, label) VALUES
  ('trial_duration_days', '30', 'number', 'Trial Duration (days)'),
  ('trial_unit_limit', '50', 'number', 'Trial Unit Limit'),
  ('session_timeout_hours', '8', 'number', 'Admin Session Timeout (hours)'),
  ('default_fee_grace_days', '15', 'number', 'Fee Grace Period (days)'),
  ('support_email', '', 'string', 'Support Email'),
  ('support_phone', '', 'string', 'Support Phone');
```

### Migration 3: Society Status Changes

```sql
CREATE TABLE society_status_changes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id        UUID NOT NULL REFERENCES societies(id),
  from_status       society_status NOT NULL,
  to_status         society_status NOT NULL,
  reason            TEXT NOT NULL,
  note              TEXT,
  grace_period_end  TIMESTAMPTZ,
  notified_admin    BOOLEAN NOT NULL DEFAULT false,
  performed_by      UUID NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_society_status_changes_society ON society_status_changes(society_id);
CREATE INDEX idx_society_status_changes_created ON society_status_changes(created_at DESC);
```

### Migration 4: Platform Announcements

```sql
CREATE TABLE platform_announcements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject     VARCHAR(200) NOT NULL,
  body        TEXT NOT NULL,
  priority    VARCHAR(10) NOT NULL DEFAULT 'NORMAL',
  scope       VARCHAR(10) NOT NULL DEFAULT 'ALL',
  society_ids UUID[] DEFAULT '{}',
  sent_via    TEXT[] DEFAULT '{IN_APP}',
  created_by  UUID NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE announcement_reads (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id  UUID NOT NULL REFERENCES platform_announcements(id),
  user_id          UUID NOT NULL REFERENCES users(id),
  read_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(announcement_id, user_id)
);

CREATE INDEX idx_announcement_reads_user ON announcement_reads(user_id);
```

### Migration 5: Service Requests

```sql
-- Enums
CREATE TYPE service_request_type AS ENUM (
  'BUG_REPORT', 'FEATURE_REQUEST', 'BILLING_INQUIRY', 'TECHNICAL_SUPPORT',
  'ACCOUNT_ISSUE', 'DATA_REQUEST', 'COMPLIANCE', 'OTHER'
);
CREATE TYPE service_request_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE service_request_status AS ENUM (
  'OPEN', 'IN_PROGRESS', 'AWAITING_ADMIN', 'AWAITING_SA', 'RESOLVED', 'CLOSED'
);

-- Tables
CREATE TABLE service_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id      UUID NOT NULL REFERENCES societies(id),
  request_number  SERIAL UNIQUE,
  type            service_request_type NOT NULL,
  priority        service_request_priority NOT NULL DEFAULT 'MEDIUM',
  status          service_request_status NOT NULL DEFAULT 'OPEN',
  subject         VARCHAR(200) NOT NULL,
  description     TEXT NOT NULL,
  created_by      UUID NOT NULL REFERENCES users(id),
  resolved_at     TIMESTAMPTZ,
  closed_at       TIMESTAMPTZ,
  closed_reason   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE service_request_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id      UUID NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  author_id       UUID NOT NULL,
  author_role     VARCHAR(20) NOT NULL,
  content         TEXT NOT NULL,
  is_internal     BOOLEAN NOT NULL DEFAULT false,
  attachments     TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_service_requests_society ON service_requests(society_id);
CREATE INDEX idx_service_requests_status ON service_requests(status);
CREATE INDEX idx_service_requests_priority_updated ON service_requests(priority, updated_at DESC);
CREATE INDEX idx_service_request_messages_request ON service_request_messages(request_id, created_at);
```

---

## Implementation Order

### Phase 1: Security (do first — blocks everything else)

1. Create `src/lib/auth-guard.ts` with `requireSuperAdmin()`.
2. Add `requireSuperAdmin()` to all 16 SA API route files (every handler).
3. Add SA-specific inactivity timeout in `src/proxy.ts`.
4. Add server-side SA role check in `src/app/sa/layout.tsx`.
5. Test: verify a regular user gets 403 on all SA API endpoints.

### Phase 2: Audit Logging

6. Run migration to widen `AuditLog.actionType` to VarChar(50).
7. Add 22 new action types to `src/lib/audit.ts`.
8. Add `logAudit()` calls to all SA mutation routes (create/update/delete handlers).
9. Test: verify audit entries are created for all SA mutations.

### Phase 3: Settings Page

10. Run migration to create `platform_configs` table + seed defaults.
11. Add `PlatformConfig` model to `schema.prisma`.
12. Create settings API routes (profile, password, platform config).
13. Create `/sa/settings/page.tsx` with 3 tabs.
14. Create `src/lib/validations/sa-settings.ts` + `src/services/sa-settings.ts`.

### Phase 4: Audit Log Viewer

15. Create audit log API route with filters + pagination.
16. Create CSV export route.
17. Create `AuditLogTable.tsx` component.
18. Create `/sa/audit-logs/page.tsx`.
19. Create `src/services/audit-logs.ts`.
20. Update `SuperAdminSidebar.tsx` — add Audit Logs nav item.

### Phase 5: Dashboard Analytics

21. Install `recharts`.
22. Create 3 new stats API routes (revenue, growth, plan-distribution).
23. Create chart components (`SocietyGrowthChart`, `PlanDistributionChart`, `RevenueCards`).
24. Update `/sa/dashboard/page.tsx` — add revenue cards, charts, quick actions.

### Phase 6: Society Lifecycle

25. Run migration to create `society_status_changes` table.
26. Add `SocietyStatusChange` model to `schema.prisma`.
27. Create lifecycle API routes (suspend, reactivate, offboard, status-history).
28. Create `src/lib/validations/society-lifecycle.ts`.
29. Create modal/wizard components (`SuspendModal`, `OffboardWizard`, `StatusTimeline`).
30. Update `/sa/societies/[id]/page.tsx` — replace dropdown with workflow buttons.

### Phase 7: Notification Center

31. Create notifications API route (computed alerts).
32. Create `/sa/notifications/page.tsx`.
33. Create `src/services/sa-notifications.ts`.
34. Update `SuperAdminSidebar.tsx` — add Alerts nav item.

### Phase 8: Society Deep-Dive (GOD Mode)

35. **Rewrite `/sa/societies/[id]/page.tsx`** — flat page → tabbed layout (11 tabs).
36. Create `SocietyTabs.tsx` tab container component.
37. Create 16 new API routes for society deep-dive (`/api/v1/super-admin/societies/[id]/residents`, `/fees`, `/expenses`, `/events`, `/petitions`, `/reports/[type]`, `/broadcasts`, `/governing-body`, `/migrations`, `/settings`).
38. Create `src/services/sa-society-deep-dive.ts` client wrappers.
39. Create 11 tab components:
    - `OverviewTab.tsx` — enhanced KPIs + subscription + admin team
    - `ResidentsTab.tsx` — data table + detail drawer (profile, fees, payments, events, petitions)
    - `FeesTab.tsx` — collection summary + table + payment history
    - `ExpensesTab.tsx` — summary + category breakdown + expense table
    - `EventsTab.tsx` — event list + detail drawer (registrations, finances)
    - `PetitionsTab.tsx` — petition list + detail drawer (signatories, PDF, report download)
    - `ReportsTab.tsx` — report type/session selector + generate/download
    - `BroadcastsTab.tsx` — broadcast history table
    - `GoverningBodyTab.tsx` — designations + members
    - `MigrationsTab.tsx` — migration batch history
    - `SettingsTab.tsx` — read-only society config + fee sessions
40. Test: SA clicks a society → sees all 11 tabs with real data.

### Phase 9: Platform-Wide Operational Views

41. Create `/sa/residents/page.tsx` — platform-wide resident directory.
42. Create `/sa/operations/page.tsx` — operational dashboard.
43. Create 4 API routes (residents search, operations summary, health scores, activity feed).
44. Create `SocietyHealthTable.tsx` + `ActivityFeed.tsx` components.
45. Create `src/services/sa-operations.ts` client wrappers.
46. Update sidebar — add "Residents" and "Operations" nav items.

### Phase 10: Global Search

47. Create `/api/v1/super-admin/search` API route (parallel queries across entities).
48. Create `GlobalSearchBar.tsx` component (Ctrl+K shortcut, debounced, grouped results).
49. Create `SearchResults.tsx` dropdown component.
50. Add search bar to SA layout header.

### Phase 11: SA-to-Admin Communication

51. Run migration to create `platform_announcements` + `announcement_reads` tables.
52. Add Prisma models.
53. Create SA announcement page + API routes (list, create, detail).
54. Create admin-side API routes (fetch unread, mark read).
55. Create `AnnouncementBanner.tsx` for admin dashboard.
56. Add announcement notification badge to admin sidebar.
57. Create `src/services/announcements.ts` + `src/lib/validations/announcement.ts`.

### Phase 12: Support Requests

58. Run migration to create `service_requests` + `service_request_messages` tables + 3 enums.
59. Add Prisma models + back-relations on Society, User.
60. Create Supabase Storage bucket `support-attachments` (private).
61. Create `src/lib/validations/support.ts` — Zod schemas for request creation, message, status change.
62. Create `src/services/support.ts` — client fetch wrappers.
63. Create admin API routes: list, create, detail, post message, reopen, unread count.
64. Create SA API routes: list, stats, detail, post message/internal note, status change, upload attachment.
65. Create shared components: `ConversationThread`, `RequestForm`, `StatusBadge`, `PriorityBadge`, `InternalNote`, `StatusTimeline`.
66. Create admin pages: `/admin/support` (list + create) + `/admin/support/[requestId]` (detail + thread).
67. Create SA pages: `/sa/support` (queue dashboard + list) + `/sa/support/[requestId]` (detail + actions).
68. Add "Support" nav item to `AdminSidebar.tsx` with unread badge.
69. Add "Support" nav item to `SuperAdminSidebar.tsx`.
70. Create cron route `/api/cron/support-auto-close` — auto-close RESOLVED requests after 7 days.
71. Add 5 new audit action types for support lifecycle.
72. Add WhatsApp notification for SA reply and auto-close events.
73. Test: full flow — admin creates request → SA picks up → exchange messages → SA resolves → auto-close after 7 days.

---

## Updated Sidebar Navigation

### Super Admin Sidebar (after all phases):

```typescript
const navItems = [
  { href: "/sa/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sa/notifications", label: "Alerts", icon: Bell },
  { href: "/sa/societies", label: "Societies", icon: Building2 },
  { href: "/sa/residents", label: "Residents", icon: Users },
  { href: "/sa/operations", label: "Operations", icon: Activity },
  { href: "/sa/support", label: "Support", icon: LifeBuoy },
  { href: "/sa/billing", label: "Billing", icon: ReceiptIndianRupee },
  { href: "/sa/plans", label: "Plans", icon: Layers },
  { href: "/sa/discounts", label: "Discounts", icon: Tag },
  { href: "/sa/announcements", label: "Announcements", icon: Megaphone },
  { href: "/sa/audit-logs", label: "Audit Logs", icon: ScrollText },
  { href: "/sa/settings", label: "Settings", icon: Settings },
];
```

### Admin Sidebar (new items only):

```typescript
// Add to existing admin sidebar nav items:
{ href: "/admin/support", label: "Support", icon: LifeBuoy },
// AnnouncementBanner appears at top of dashboard (not a sidebar item)
```

---

## What's NOT in V1

- No real-time WebSocket notifications (polling only)
- No multi-super-admin support (single SA account per platform)
- No role-based SA permissions (all SA actions are full access)
- No API key management or external API access
- No 2FA / MFA for super admin (Supabase Auth default only)
- No white-labeling or theme customization per SA
- No automated society deactivation (all lifecycle actions are manual)
- No revenue forecasting or predictive analytics
- No custom report builder (only pre-built dashboard charts)
- No webhook integrations for external systems
- No email digest / daily summary for SA
- No mobile-responsive charts (desktop-first for analytics)
- No SA write operations on society data (read-only deep-dive by design)
- No SA impersonation / "login as admin" feature (observes, does not impersonate)
- No inter-society data comparison UI (e.g., side-by-side society comparison)
- No resident-facing announcements from SA (only admin-facing)
- No announcement scheduling (immediate send only)
- No push notifications (only in-app + email + WhatsApp)
- No drill-down from platform-wide charts to society-specific data (navigate manually)
- No SLA enforcement or automated escalation for support requests (display-only hints)
- No support request assignment to multiple SA users (single SA per platform)
- No knowledge base or FAQ linked to support (admin writes free-text requests)
- No canned/template responses for SA (types from scratch each time)
- No support satisfaction rating (no "How was your experience?" after resolution)
- No support request categories beyond the 8 defined types
- No file preview in support messages (download only, no inline rendering)
- No resident-to-SA support channel (residents go through their admin)

---

## Verification Scenarios

### Phase 1: API Authorization

- [ ] Authenticated resident calls `GET /api/v1/super-admin/stats` → 403 Forbidden
- [ ] Authenticated RWA admin calls `POST /api/v1/super-admin/plans` → 403 Forbidden
- [ ] Unauthenticated request to any SA API → 401 Unauthorized
- [ ] Inactive super admin (`isActive: false`) calls SA API → 403 Forbidden
- [ ] Active super admin calls SA API → 200 OK, data returned
- [ ] Non-SA user navigates to `/sa/dashboard` → redirected to `/super-admin-login`
- [ ] SA session expires after inactivity → redirected to `/super-admin-login`

### Phase 2: Audit Logging

- [ ] SA creates a plan → `SA_PLAN_CREATED` entry in audit_logs with plan details
- [ ] SA updates a discount → `SA_DISCOUNT_UPDATED` entry with old + new values
- [ ] SA suspends a society → `SA_SOCIETY_SUSPENDED` entry with reason
- [ ] SA logs in → `SA_LOGIN` entry with IP address and user agent
- [ ] Audit entries visible in audit log viewer with correct filters

### Phase 3: Settings

- [ ] SA updates their name → profile updated, audit logged
- [ ] SA changes password → Supabase auth updated, old sessions invalidated
- [ ] SA updates trial duration → `platform_configs` row updated, audit logged
- [ ] Invalid password (too short) → validation error, no change

### Phase 4: Audit Log Viewer

- [ ] Filter by date range → only matching entries shown
- [ ] Filter by society → scoped to that society's actions
- [ ] Filter by action type → correct subset
- [ ] Expand row → old/new value JSON diff displayed
- [ ] Export CSV → downloads file with all filtered results
- [ ] Pagination → 50 per page, correct total count

### Phase 5: Dashboard

- [ ] MRR card shows correct monthly recurring revenue
- [ ] Society growth chart shows 12-month trend
- [ ] Plan distribution pie shows current breakdown
- [ ] Quick action buttons navigate to correct pages

### Phase 6: Society Lifecycle

- [ ] SA suspends society with reason → status changes, reason stored, admin notified
- [ ] SA suspends with 7-day grace → society retains read-only access for 7 days
- [ ] SA reactivates suspended society → status restored to ACTIVE, admin notified
- [ ] SA offboards society → multi-step confirmation, status set, subscription cancelled
- [ ] Status history tab shows timeline of all changes with reasons
- [ ] Offboard requires typing society code → prevents accidental offboarding

### Phase 7: Notifications

- [ ] Page shows trials expiring within 3 days
- [ ] Page shows expired subscriptions from last 30 days
- [ ] Page shows overdue invoices
- [ ] Page shows recently registered societies
- [ ] Alerts sorted by priority (high → medium → low), then date

### Phase 8: Society Deep-Dive (GOD Mode)

- [ ] Society detail page shows tabbed layout with 11 tabs
- [ ] Overview tab shows 6 KPI cards + subscription + admin team
- [ ] Residents tab shows paginated resident table with search + status filter
- [ ] Click resident row → drawer shows full profile, fee history, payments, event registrations, petition signatures
- [ ] Fees tab shows collection summary + per-resident fee table with session selector
- [ ] Expenses tab shows summary cards + category breakdown + full expense ledger
- [ ] Events tab shows all events (DRAFT through CANCELLED) with registration counts
- [ ] Click event → drawer shows registrations table + financial summary (for settled events)
- [ ] Petitions tab shows all petitions with signature counts
- [ ] Click petition → drawer shows full detail + signatories with signature previews + PDF document viewer
- [ ] SA can download compiled petition PDF report (same as admin)
- [ ] Reports tab lets SA generate any of 5 report types (PDF/Excel) for this society
- [ ] Broadcasts tab shows full broadcast history with message content
- [ ] Governing Body tab shows designations + assigned members
- [ ] Migrations tab shows bulk import history with success/failure counts
- [ ] Settings tab shows read-only society config + all fee sessions
- [ ] All tabs are read-only — no edit/create/delete buttons rendered
- [ ] All API routes use `requireSuperAdmin()` guard

### Phase 9: Platform-Wide Operations

- [ ] `/sa/residents` shows all residents across all societies with search
- [ ] Can filter by society, status, text search (name/email/phone/RWAID)
- [ ] Click resident → navigates to society deep-dive with resident selected
- [ ] `/sa/operations` shows platform KPIs (total residents, collection rate, expenses, active events, active petitions)
- [ ] Society health table ranks all societies with composite health score
- [ ] Health score correctly weighs: collection rate, admin activity, growth, engagement, balance
- [ ] Societies with health < 50 shown in red
- [ ] Activity feed shows recent notable events across all societies
- [ ] "Admin hasn't logged in for 14 days" alert surfaces for inactive societies

### Phase 10: Global Search

- [ ] Search bar visible in SA header on all pages
- [ ] Ctrl+K focuses the search bar
- [ ] Typing shows debounced results grouped by category (societies, residents, payments, events, petitions)
- [ ] Max 5 results per category
- [ ] Clicking a result navigates to the correct detail page
- [ ] Empty search shows nothing (no default results)
- [ ] Search by resident phone number returns correct match across any society

### Phase 11: Announcements

- [ ] SA creates a platform-wide announcement → all admin dashboards show banner
- [ ] SA creates targeted announcement for specific societies → only those admins see it
- [ ] Urgent priority shows persistent red banner in admin dashboard
- [ ] Admin clicks "dismiss" → marks as read, banner disappears
- [ ] SA sees read stats (X of Y admins read the announcement)
- [ ] Old announcements (30+ days) stop showing as banners but remain in list

### Phase 12: Support Requests

**Creation Flow:**

- [ ] Admin creates a service request with type, priority, subject, description → status = OPEN
- [ ] Admin attaches screenshot (JPG, max 5MB) → stored in `support-attachments` bucket
- [ ] Request gets auto-incremented number (#1, #2, #3...)
- [ ] SA sees the new request in their support queue immediately
- [ ] SA alert (Phase 7) shows "New URGENT bug report from Eden Estate"

**Conversation Flow:**

- [ ] SA picks up request → status changes to IN_PROGRESS
- [ ] SA posts reply → status changes to AWAITING_ADMIN, admin gets WhatsApp notification
- [ ] Admin replies → status changes to AWAITING_SA
- [ ] SA adds internal note → note visible only in SA view, NOT shown to admin
- [ ] Both sides see full conversation thread in chronological order
- [ ] Messages render markdown correctly

**Status Management:**

- [ ] SA resolves request → status = RESOLVED, `resolvedAt` set, admin notified
- [ ] Admin reopens within 7 days → status back to OPEN
- [ ] Admin tries to reopen after 7 days → button not shown, must create new request
- [ ] SA closes directly (spam/duplicate) → requires reason, status = CLOSED permanently
- [ ] Cron auto-closes RESOLVED requests after 7 days → CLOSED, admin notified via WhatsApp

**Queue Dashboard (SA):**

- [ ] KPI cards show correct counts: Open, In Progress, Awaiting SA, Resolved (7d)
- [ ] Avg Resolution Time calculates correctly over last 30 days
- [ ] Queue sorted by priority (URGENT first) then by last updated
- [ ] URGENT requests highlighted with red row
- [ ] Filters work: by society, by status, by type, by priority

**Admin Side:**

- [ ] Admin sees only their own society's requests
- [ ] Both FULL_ACCESS and READ_NOTIFY admins can create requests
- [ ] Sidebar shows "Support" with unread count badge (requests with new SA replies)
- [ ] Request list sorted by last updated

**Edge Cases:**

- [ ] Admin with READ_NOTIFY permission creates request → allowed
- [ ] Attachment upload exceeds 5MB → 400 error
- [ ] More than 3 attachments per message → 400 error
- [ ] SA changes priority from LOW to URGENT → priority updated, visible to admin
- [ ] Request with zero messages closed by SA → requires reason
- [ ] Concurrent replies (admin + SA reply at same time) → both messages saved, status reflects the latest
