# Super Admin — Subscription Billing & Payment Management

## Overview

Extend the Super Admin (SA) portal with full subscription billing capabilities: payment recording, expiry tracking, invoice management, email reminders, and automated cron jobs. Mirrors the RWA Admin payment recording UX but adapted for platform-level subscription billing.

---

## 1. New Database Tables

### 1.1 `SubscriptionPayment`

Records each payment made by a society for their subscription.

```prisma
model SubscriptionPayment {
  id                String   @id @default(uuid()) @db.Uuid
  societyId         String   @db.Uuid
  subscriptionId    String   @db.Uuid
  amount            Decimal  @db.Decimal(12, 2)
  paymentMode       SubscriptionPaymentMode
  referenceNo       String?
  invoiceNo         String   @unique
  invoiceUrl        String?
  paymentDate       DateTime @db.Date
  notes             String?
  recordedBy        String   @db.Uuid   // SuperAdmin ID
  isReversal        Boolean  @default(false)
  reversalOf        String?  @db.Uuid
  reversalReason    String?
  isReversed        Boolean  @default(false)
  correctionWindowEnds DateTime?
  createdAt         DateTime @default(now())

  society           Society              @relation(fields: [societyId], references: [id])
  subscription      SocietySubscription  @relation(fields: [subscriptionId], references: [id])
  reversalPayment   SubscriptionPayment? @relation("ReversalRef", fields: [reversalOf], references: [id])
  reversedBy        SubscriptionPayment? @relation("ReversalRef")

  @@map("subscription_payments")
}
```

### 1.2 `SubscriptionInvoice`

Tracks invoices generated for each billing period (paid or unpaid).

```prisma
model SubscriptionInvoice {
  id              String   @id @default(uuid()) @db.Uuid
  societyId       String   @db.Uuid
  subscriptionId  String   @db.Uuid
  invoiceNo       String   @unique
  periodStart     DateTime
  periodEnd       DateTime
  planName        String
  billingCycle    BillingCycle
  baseAmount      Decimal  @db.Decimal(12, 2)
  discountAmount  Decimal  @default(0) @db.Decimal(12, 2)
  finalAmount     Decimal  @db.Decimal(12, 2)
  status          InvoiceStatus @default(UNPAID)
  dueDate         DateTime
  paidAt          DateTime?
  paidVia         SubscriptionPaymentMode?
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  society         Society              @relation(fields: [societyId], references: [id])
  subscription    SocietySubscription  @relation(fields: [subscriptionId], references: [id])

  @@map("subscription_invoices")
}
```

### 1.3 New Enums

```prisma
enum SubscriptionPaymentMode {
  CASH
  UPI
  BANK_TRANSFER
  CHEQUE
  RAZORPAY       // future online payments
  OTHER
}

enum InvoiceStatus {
  UNPAID
  PAID
  PARTIALLY_PAID
  OVERDUE
  WAIVED
  CANCELLED
}
```

---

## 2. SA Subscription Dashboard (`/sa/billing`)

### 2.1 Dashboard Overview Cards

| Card                | Data                                                 |
| ------------------- | ---------------------------------------------------- |
| Total Active        | Count of societies with `ACTIVE` status              |
| Expiring Soon (30d) | Societies where `currentPeriodEnd` ≤ today + 30 days |
| Expired             | Societies with `EXPIRED` status                      |
| Trial Ending (7d)   | Societies where `trialEndsAt` ≤ today + 7 days       |
| Revenue This Month  | Sum of `SubscriptionPayment.amount` this month       |
| Pending Invoices    | Count of invoices with status `UNPAID` or `OVERDUE`  |

### 2.2 Subscription List Table

Filterable, sortable table of all societies with subscription info.

**Columns**:

- Society Name / Code
- Plan Name
- Billing Cycle
- Status (badge: TRIAL / ACTIVE / EXPIRED / SUSPENDED / CANCELLED)
- Period End Date
- Amount Due
- Last Payment Date
- Actions (View / Record Payment / Send Reminder)

**Filters**:

- Status: All / Trial / Active / Expired / Suspended
- Expiry Range: All / Expiring in 7 days / 30 days / 60 days / Already expired
- Plan: All / Basic / Basic+ / Community / Pro / Enterprise AI / Flex
- Payment Status: All / Paid / Unpaid / Overdue
- Search by society name/code

**Sorting**: By expiry date, society name, plan, last payment

### 2.3 Quick Action Panels

1. **Expiring Soon** — Dedicated tab showing societies expiring in next 30 days, sorted by urgency
2. **Overdue** — Societies past expiry with no renewal payment
3. **Trial Ending** — Trials ending in next 7 days, with option to bulk-email reminders

---

## 3. Payment Recording Flow

### 3.1 Record Payment Dialog

Triggered from SA Billing dashboard or Society Detail page.

**Form Fields**:

| Field        | Type        | Validation                                  | Required    |
| ------------ | ----------- | ------------------------------------------- | ----------- |
| Society      | Pre-filled  | Read-only (from context)                    | Yes         |
| Plan / Cycle | Pre-filled  | Shows current subscription details          | Yes         |
| Amount       | Number      | Positive, ≤ invoice amount                  | Yes         |
| Payment Mode | Select      | CASH / UPI / BANK_TRANSFER / CHEQUE / OTHER | Yes         |
| Reference No | Text        | Required for UPI, BANK_TRANSFER, CHEQUE     | Conditional |
| Payment Date | Date Picker | Cannot be future, max 30 days in past       | Yes         |
| Notes        | Textarea    | Max 500 chars                               | No          |

### 3.2 Payment Processing Logic

```
1. Validate payment amount against outstanding invoice
2. Generate invoice number: INV-{YYYY}-{sequential_number}
3. Create SubscriptionPayment record
4. Update SubscriptionInvoice status (PAID / PARTIALLY_PAID)
5. If fully paid:
   a. Update SocietySubscription status → ACTIVE
   b. Set currentPeriodStart = paymentDate (or invoice.periodStart)
   c. Set currentPeriodEnd = periodStart + billingCycleDuration
   d. Update Society.subscriptionExpiresAt
6. Log to SocietySubscriptionHistory (changeType: PAYMENT_RECORDED)
7. Set correctionWindowEnds = now + 48 hours
8. Send payment confirmation email to RWA admin (optional toggle)
```

### 3.3 Payment Correction (48-hour window)

Same pattern as RWA Admin fee corrections:

- **Edit**: Modify amount, payment mode, reference, notes within 48 hours
- **Reverse**: Full reversal with reason, creates reverse SubscriptionPayment, reverts subscription status to previous state
- After 48 hours: Locked, SA must contact support or use admin override

### 3.4 Renewal Payment

When a society's subscription is `EXPIRED` and SA records a renewal payment:

1. Generate new invoice for the next period
2. Record payment against that invoice
3. Create new SocietySubscription record (or update existing) with status `ACTIVE`
4. Set new period dates based on billing cycle
5. Log `PLAN_RESTORED` in SocietySubscriptionHistory

---

## 4. Invoice Management

### 4.1 Auto-Invoice Generation

Invoices are generated when:

- A plan is first assigned to a society
- A subscription period is about to end (30 days before for ANNUAL+, 7 days before for MONTHLY)
- SA manually generates an invoice for a society
- A plan switch occurs (pro-rata invoice)

### 4.2 Invoice Details View

Each invoice shows:

- Invoice number, date, due date
- Society details (name, code, address)
- Plan name, billing cycle, period covered
- Base amount, discount applied, final amount
- Payment status and payment history against this invoice
- Download as PDF (using `@react-pdf/renderer` already in deps)

### 4.3 Invoice Statuses

| Status         | Meaning                                    |
| -------------- | ------------------------------------------ |
| UNPAID         | Generated, awaiting payment                |
| PAID           | Fully paid                                 |
| PARTIALLY_PAID | Partial amount received                    |
| OVERDUE        | Past due date, not fully paid              |
| WAIVED         | SA waived the payment (free/special grant) |
| CANCELLED      | Invoice cancelled (e.g., plan switch)      |

---

## 5. Email Notification System

### 5.1 New Email Templates

| Template                  | Trigger                                   | Recipients              |
| ------------------------- | ----------------------------------------- | ----------------------- |
| `subscription-expiry-30d` | 30 days before period end                 | RWA Admin(s) of society |
| `subscription-expiry-7d`  | 7 days before period end                  | RWA Admin(s) of society |
| `subscription-expiry-1d`  | 1 day before period end                   | RWA Admin(s) of society |
| `subscription-expired`    | On expiry date                            | RWA Admin(s) of society |
| `trial-ending-7d`         | 7 days before trial ends                  | RWA Admin(s) of society |
| `trial-ending-1d`         | 1 day before trial ends                   | RWA Admin(s) of society |
| `trial-expired`           | On trial expiry                           | RWA Admin(s) of society |
| `payment-received`        | After SA records payment                  | RWA Admin(s) of society |
| `invoice-generated`       | When new invoice is created               | RWA Admin(s) of society |
| `subscription-suspended`  | When SA suspends a society                | RWA Admin(s) of society |
| `subscription-restored`   | When SA restores a suspended subscription | RWA Admin(s) of society |

### 5.2 Manual Email Actions (SA UI)

SA can manually trigger emails from the billing dashboard:

- **Send Reminder** — Sends expiry/overdue reminder to selected society
- **Bulk Send Reminders** — Select multiple societies → send batch reminders
- **Resend Invoice** — Resend invoice email with PDF attachment

### 5.3 Email Template Structure

All templates use the same base layout (already established in `src/lib/email-templates/`):

```
Subject: [Template-specific subject]
Body:
  - Header with logo
  - Greeting: "Dear {Society Name} Admin,"
  - Template-specific content (expiry date, amount due, plan details)
  - CTA button (e.g., "View Invoice", "Contact Support")
  - Footer with support info
```

### 5.4 Email Sending Location

New file: `src/lib/email-templates/subscription.ts`

Contains all subscription-related email template generators following the same pattern as existing `verification.ts` and `password-reset.ts`.

---

## 6. Cron Jobs / Scheduled Tasks

### 6.1 Implementation Approach

Use **Vercel Cron Jobs** (via `vercel.json` cron config) since the app is deployed on Vercel. Each cron job is a Next.js API route protected by a `CRON_SECRET` header.

### 6.2 Cron Routes

| Route                                      | Schedule       | Purpose                                       |
| ------------------------------------------ | -------------- | --------------------------------------------- |
| `POST /api/cron/subscription-expiry-check` | Daily 8:00 AM  | Check for expiring/expired subscriptions      |
| `POST /api/cron/trial-expiry-check`        | Daily 8:00 AM  | Check for expiring/expired trials             |
| `POST /api/cron/invoice-generation`        | Daily 9:00 AM  | Generate invoices for upcoming renewals       |
| `POST /api/cron/overdue-invoice-check`     | Daily 10:00 AM | Mark unpaid invoices as OVERDUE past due date |

### 6.3 Subscription Expiry Check Logic

```
Daily at 8:00 AM IST:

1. Find subscriptions where currentPeriodEnd is:
   - 30 days away → send 30-day reminder (if not already sent)
   - 7 days away → send 7-day reminder
   - 1 day away → send 1-day reminder
   - Today → mark as EXPIRED, send expired notification
   - 7 days past → mark as SUSPENDED (grace period ended)

2. Find trials where trialEndsAt is:
   - 7 days away → send trial ending reminder
   - 1 day away → send trial ending reminder
   - Today → mark trial as EXPIRED, send expired notification

3. Log all actions to a notification_log table (prevent duplicates)
```

### 6.4 Notification Dedup

New table to prevent duplicate emails:

```prisma
model NotificationLog {
  id          String   @id @default(uuid()) @db.Uuid
  societyId   String   @db.Uuid
  templateKey String   // e.g., "subscription-expiry-30d"
  periodKey   String   // e.g., "2026-04" (uniqueness per period)
  sentAt      DateTime @default(now())
  channel     String   @default("email") // email, whatsapp (future)

  @@unique([societyId, templateKey, periodKey])
  @@map("notification_logs")
}
```

### 6.5 Vercel Cron Configuration

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/subscription-expiry-check",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/trial-expiry-check",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/invoice-generation",
      "schedule": "0 3 * * *"
    },
    {
      "path": "/api/cron/overdue-invoice-check",
      "schedule": "0 4 * * *"
    }
  ]
}
```

Times in UTC — adjust for IST (UTC+5:30). `0 2 * * *` = 7:30 AM IST.

### 6.6 Cron Security

```typescript
// src/lib/cron-auth.ts
export function verifyCronSecret(request: Request): boolean {
  const secret = request.headers.get("authorization");
  return secret === `Bearer ${process.env.CRON_SECRET}`;
}
```

Each cron route checks this before executing. Vercel automatically sends the `CRON_SECRET` header for configured crons.

---

## 7. API Endpoints (New)

### 7.1 Billing Dashboard

| Method | Endpoint                                    | Action                              |
| ------ | ------------------------------------------- | ----------------------------------- |
| GET    | `/api/v1/super-admin/billing/dashboard`     | Dashboard stats (counts, revenue)   |
| GET    | `/api/v1/super-admin/billing/subscriptions` | List all subscriptions (filterable) |
| GET    | `/api/v1/super-admin/billing/expiring`      | Societies expiring within N days    |

### 7.2 Payments

| Method | Endpoint                                                           | Action                    |
| ------ | ------------------------------------------------------------------ | ------------------------- |
| POST   | `/api/v1/societies/[id]/subscription/payments`                     | Record payment            |
| GET    | `/api/v1/societies/[id]/subscription/payments`                     | List payments for society |
| PATCH  | `/api/v1/societies/[id]/subscription/payments/[paymentId]`         | Correct payment (48h)     |
| POST   | `/api/v1/societies/[id]/subscription/payments/[paymentId]/reverse` | Reverse payment           |

### 7.3 Invoices

| Method | Endpoint                                                       | Action                     |
| ------ | -------------------------------------------------------------- | -------------------------- |
| GET    | `/api/v1/societies/[id]/subscription/invoices`                 | List invoices for society  |
| POST   | `/api/v1/societies/[id]/subscription/invoices`                 | Generate invoice manually  |
| GET    | `/api/v1/societies/[id]/subscription/invoices/[invoiceId]`     | Invoice detail             |
| PATCH  | `/api/v1/societies/[id]/subscription/invoices/[invoiceId]`     | Update invoice (waive etc) |
| GET    | `/api/v1/societies/[id]/subscription/invoices/[invoiceId]/pdf` | Download invoice PDF       |

### 7.4 Email Actions

| Method | Endpoint                                          | Action                     |
| ------ | ------------------------------------------------- | -------------------------- |
| POST   | `/api/v1/super-admin/billing/send-reminder`       | Send reminder to 1 society |
| POST   | `/api/v1/super-admin/billing/send-bulk-reminders` | Send reminders to multiple |

### 7.5 Cron Routes

| Method | Endpoint                              | Action                   |
| ------ | ------------------------------------- | ------------------------ |
| POST   | `/api/cron/subscription-expiry-check` | Daily expiry check       |
| POST   | `/api/cron/trial-expiry-check`        | Daily trial expiry check |
| POST   | `/api/cron/invoice-generation`        | Daily invoice generation |
| POST   | `/api/cron/overdue-invoice-check`     | Daily overdue marking    |

---

## 8. UI Pages & Components

### 8.1 New Pages

| Page              | Path                         | Purpose                                     |
| ----------------- | ---------------------------- | ------------------------------------------- |
| Billing Dashboard | `/sa/billing`                | Overview cards + subscription list + alerts |
| Payment History   | `/sa/billing/payments`       | All payments across societies               |
| Invoice List      | `/sa/billing/invoices`       | All invoices across societies               |
| Society Billing   | `/sa/societies/[id]/billing` | Single society payment + invoice history    |

### 8.2 New Components

| Component                         | Location                                               | Purpose                                 |
| --------------------------------- | ------------------------------------------------------ | --------------------------------------- |
| `BillingDashboardStats`           | `src/components/features/billing/DashboardStats.tsx`   | Overview stat cards                     |
| `SubscriptionListTable`           | `src/components/features/billing/SubscriptionList.tsx` | Filterable subscription table           |
| `ExpiringSubscriptionsPanel`      | `src/components/features/billing/ExpiringPanel.tsx`    | Urgent expiry alerts                    |
| `RecordSubscriptionPaymentDialog` | `src/components/features/billing/RecordPayment.tsx`    | Payment recording form dialog           |
| `SubscriptionPaymentHistory`      | `src/components/features/billing/PaymentHistory.tsx`   | Payment history table for a society     |
| `InvoiceTable`                    | `src/components/features/billing/InvoiceTable.tsx`     | Invoice list with status badges         |
| `InvoiceDetailCard`               | `src/components/features/billing/InvoiceDetail.tsx`    | Single invoice detail view              |
| `InvoicePDF`                      | `src/components/features/billing/InvoicePDF.tsx`       | React-PDF template for invoice download |
| `SendReminderDialog`              | `src/components/features/billing/SendReminder.tsx`     | Manual email reminder dialog            |
| `BulkReminderSheet`               | `src/components/features/billing/BulkReminder.tsx`     | Select multiple societies + send        |

### 8.3 Updated Components

| Component                | Change                                                  |
| ------------------------ | ------------------------------------------------------- |
| `SubscriptionStatusCard` | Add "Record Payment" button + last payment info display |
| SA Sidebar Navigation    | Add "Billing" menu item with sub-items                  |
| Society Detail Page      | Add "Billing" tab alongside existing info               |

---

## 9. Validation Schemas (Zod)

### New File: `src/lib/validations/billing.ts`

```typescript
// Record subscription payment
recordSubscriptionPaymentSchema = z.object({
  amount: z.number().positive(),
  paymentMode: z.enum(["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "OTHER"]),
  referenceNo: z.string().optional(),  // required conditionally
  paymentDate: z.string().date(),      // YYYY-MM-DD, not future
  notes: z.string().max(500).optional(),
})

// Correct subscription payment (within 48h)
correctSubscriptionPaymentSchema = z.object({
  amount: z.number().positive().optional(),
  paymentMode: z.enum([...]).optional(),
  referenceNo: z.string().optional(),
  notes: z.string().max(500).optional(),
  reason: z.string().min(5),
})

// Reverse subscription payment
reverseSubscriptionPaymentSchema = z.object({
  reason: z.string().min(5).max(500),
})

// Generate invoice
generateInvoiceSchema = z.object({
  periodStart: z.string().date(),
  periodEnd: z.string().date(),
  dueDate: z.string().date(),
  notes: z.string().max(500).optional(),
})

// Send reminder
sendReminderSchema = z.object({
  societyId: z.string().uuid(),
  templateKey: z.enum(["expiry-reminder", "overdue-reminder", "trial-ending"]),
})

// Bulk send reminders
sendBulkRemindersSchema = z.object({
  societyIds: z.array(z.string().uuid()).min(1).max(100),
  templateKey: z.enum(["expiry-reminder", "overdue-reminder", "trial-ending"]),
})
```

---

## 10. Service Layer

### New File: `src/services/billing.ts`

```typescript
// Dashboard
getBillingDashboard();
getSubscriptionList(filters);
getExpiringSubscriptions(days);

// Payments
recordSubscriptionPayment(societyId, data);
getSubscriptionPayments(societyId);
correctSubscriptionPayment(societyId, paymentId, data);
reverseSubscriptionPayment(societyId, paymentId, data);

// Invoices
getInvoices(societyId);
generateInvoice(societyId, data);
getInvoiceDetail(societyId, invoiceId);
updateInvoice(societyId, invoiceId, data);
downloadInvoicePdf(societyId, invoiceId);

// Email actions
sendReminder(societyId, templateKey);
sendBulkReminders(societyIds, templateKey);
```

---

## 11. Implementation Phases

### Phase 1: Core Payment Recording (1-2 weeks)

1. Add `SubscriptionPayment` table to `dbinuse.prisma`
2. Add `SubscriptionPaymentMode` enum
3. Create payment recording API route
4. Create `RecordSubscriptionPaymentDialog` component
5. Add "Record Payment" button to `SubscriptionStatusCard`
6. Create payment correction and reversal routes
7. Add validation schemas
8. Create service functions

### Phase 2: Billing Dashboard (1 week)

1. Create `/sa/billing` page with dashboard stats
2. Build `SubscriptionListTable` with filters
3. Build `ExpiringSubscriptionsPanel`
4. Add billing API routes (dashboard, subscriptions list, expiring)
5. Add "Billing" to SA sidebar navigation

### Phase 3: Invoice System (1-2 weeks)

1. Add `SubscriptionInvoice` table and `InvoiceStatus` enum
2. Create invoice API routes (CRUD + PDF)
3. Build `InvoicePDF` component using `@react-pdf/renderer`
4. Build `InvoiceTable` and `InvoiceDetailCard`
5. Create `/sa/billing/invoices` page
6. Add invoice section to Society Detail billing tab

### Phase 4: Email Notifications (1 week)

1. Create subscription email templates in `src/lib/email-templates/subscription.ts`
2. Add manual "Send Reminder" and "Bulk Send" API routes
3. Build `SendReminderDialog` and `BulkReminderSheet` components
4. Add notification_log table for dedup

### Phase 5: Cron Jobs (1 week)

1. Create cron API routes with secret verification
2. Implement subscription expiry check logic
3. Implement trial expiry check logic
4. Implement invoice auto-generation logic
5. Implement overdue marking logic
6. Configure `vercel.json` cron schedules
7. Add `CRON_SECRET` to environment variables

### Phase 6: Razorpay Integration (Future)

1. Add Razorpay SDK dependency
2. Create payment link generation API
3. Build payment gateway checkout page for RWA admins
4. Add webhook handler for payment confirmation
5. Auto-record payment on successful gateway transaction
6. Update `SubscriptionPaymentMode` to include `RAZORPAY`

---

## 12. New Subscription History Change Types

Add to `SubscriptionChangeType` enum:

```prisma
enum SubscriptionChangeType {
  // existing...
  PAYMENT_RECORDED    // SA recorded a payment
  PAYMENT_CORRECTED   // SA corrected a payment within 48h
  PAYMENT_REVERSED    // SA reversed a payment
  INVOICE_GENERATED   // Invoice created
  INVOICE_WAIVED      // SA waived an invoice
  AUTO_EXPIRED        // Cron job expired the subscription
  AUTO_SUSPENDED      // Cron job suspended after grace period
}
```

---

## 13. Environment Variables (New)

| Variable      | Purpose                                           |
| ------------- | ------------------------------------------------- |
| `CRON_SECRET` | Auth header for Vercel cron job routes            |
| `APP_URL`     | Base URL for email template links (already used?) |

Razorpay (Phase 6 only):
| Variable | Purpose |
| ---------------------- | -------------------------- |
| `RAZORPAY_KEY_ID` | Razorpay API key |
| `RAZORPAY_KEY_SECRET` | Razorpay API secret |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook signature secret |

---

## 14. Key Design Decisions

1. **Manual-first approach**: SA records payments manually now; Razorpay is Phase 6. This matches the RWA admin pattern and avoids payment gateway complexity early on.

2. **Invoice as source of truth**: Every payment is linked to an invoice. No orphan payments. Invoices are auto-generated by cron or manually by SA.

3. **48-hour correction window**: Same as RWA admin fee payments. Prevents accidental permanent records while keeping an audit trail.

4. **Separate billing page vs. inline**: Billing gets its own `/sa/billing` section rather than cramming into `/sa/societies`. The society detail page links to its billing tab for per-society view.

5. **Notification dedup via log table**: Prevents sending the same reminder twice for the same period. Keyed on `(societyId, templateKey, periodKey)`.

6. **Grace period**: 7 days between EXPIRED and SUSPENDED. During grace period, society can still access the platform but sees a banner. After suspension, access is restricted.

7. **PDF invoices**: Reuse `@react-pdf/renderer` (already installed) for invoice PDF generation. Downloaded from API or attached to emails.

---

## 15. File Structure (New Files)

```
src/
├── app/
│   ├── sa/
│   │   └── billing/
│   │       ├── page.tsx                    # Billing dashboard
│   │       ├── payments/
│   │       │   └── page.tsx                # All payments
│   │       └── invoices/
│   │           └── page.tsx                # All invoices
│   └── api/
│       ├── v1/
│       │   ├── super-admin/
│       │   │   └── billing/
│       │   │       ├── dashboard/route.ts
│       │   │       ├── subscriptions/route.ts
│       │   │       ├── expiring/route.ts
│       │   │       ├── send-reminder/route.ts
│       │   │       └── send-bulk-reminders/route.ts
│       │   └── societies/
│       │       └── [id]/
│       │           └── subscription/
│       │               ├── payments/
│       │               │   ├── route.ts                    # GET, POST
│       │               │   └── [paymentId]/
│       │               │       ├── route.ts                # PATCH (correct)
│       │               │       └── reverse/route.ts        # POST
│       │               └── invoices/
│       │                   ├── route.ts                    # GET, POST
│       │                   └── [invoiceId]/
│       │                       ├── route.ts                # GET, PATCH
│       │                       └── pdf/route.ts            # GET (download)
│       └── cron/
│           ├── subscription-expiry-check/route.ts
│           ├── trial-expiry-check/route.ts
│           ├── invoice-generation/route.ts
│           └── overdue-invoice-check/route.ts
├── components/
│   └── features/
│       └── billing/
│           ├── DashboardStats.tsx
│           ├── SubscriptionList.tsx
│           ├── ExpiringPanel.tsx
│           ├── RecordPayment.tsx
│           ├── PaymentHistory.tsx
│           ├── InvoiceTable.tsx
│           ├── InvoiceDetail.tsx
│           ├── InvoicePDF.tsx
│           ├── SendReminder.tsx
│           └── BulkReminder.tsx
├── lib/
│   ├── cron-auth.ts
│   ├── email-templates/
│   │   └── subscription.ts
│   └── validations/
│       └── billing.ts
└── services/
    └── billing.ts
```

---

## 16. Cross-References

- [subscription_plans.md](subscription_plans.md) — Plan definitions, pricing, discount system, pro-rata logic
- [security-and-reliability-hardening.md](security-and-reliability-hardening.md) — Security patterns for API routes
- [DB Management](../DB/database-management.md) — Migration and deployment procedures
