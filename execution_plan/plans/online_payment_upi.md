# Online Payments — UPI QR Flow (No Razorpay)

> **Scope**: Everything that can be built without Razorpay — UPI QR setup, resident payment claims, admin verification, subscription payment claims, and Super Admin platform QR setup. Zero external payment gateway dependency. Available on all plans.

---

## Overview

Two self-service UPI claim flows, both using the same pattern: user scans QR → makes payment → submits UTR → receiver verifies → system records.

| Flow                 | Payer     | Payee                | QR Set By   | Verified By |
| -------------------- | --------- | -------------------- | ----------- | ----------- |
| Resident Fee Payment | Resident  | RWA Society          | RWA Admin   | RWA Admin   |
| Subscription Payment | RWA Admin | Super Admin/Platform | Super Admin | Super Admin |

**Cost**: ₹0 on both flows. Direct bank-to-bank UPI transfer (NPCI rails, 0% MDR).

---

## Flow 1 — Resident Fee Payment via UPI QR

### Step-by-Step

```
1. Admin uploads society UPI QR in Settings → Payment Setup
2. Resident opens /r/payments/pay?feeId={id}
   → Sees amount due + society QR + UPI ID
3. Resident scans QR in GPay/PhonePe, enters amount, pays
4. Resident returns to app → taps "I've paid"
   → Opens /r/payments/confirm?feeId={id}
   → Enters UTR, payment date, optional screenshot
   → Submits claim
5. Admin sees pending claim in /admin/fees/claims (badge on sidebar)
   → Cross-checks UTR in bank statement
   → Clicks "Confirm" or "Reject with reason"
6. On confirm → fee_payment record created, receipt generated
   → WhatsApp sent to resident
7. On reject → WhatsApp sent with reason, resident can resubmit
```

### Admin UPI Setup Page — `/admin/settings/payment-setup`

```
┌─────────────────────────────────────────────────────┐
│  UPI Payment Setup                                   │
│─────────────────────────────────────────────────────│
│  Society UPI ID *                                    │
│  ┌──────────────────────────────────────────────┐   │
│  │ edenestate@sbi                                │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  UPI QR Code Image *                                 │
│  ┌──────────────────────────────────────────────┐   │
│  │  [Upload QR Image]  PNG/JPG, max 2MB          │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  QR Preview                                          │
│  ┌──────────────────┐                               │
│  │   [QR Image]     │  edenestate@sbi               │
│  │                  │  Eden Estate RWA              │
│  └──────────────────┘                               │
│                                                      │
│  Bank Account Name (optional, display only)          │
│  ┌──────────────────────────────────────────────┐   │
│  │ Eden Estate RWA                               │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ⚠ Use the society's official bank account only.    │
│                            [Save UPI Settings]       │
└─────────────────────────────────────────────────────┘
```

### Resident Pay Fee Page — `/r/payments/pay`

**Query param**: `?feeId={membershipFeeId}`

```
┌──────────────────────────────────┐
│  ← Pay fee                       │
│  Session: 2025-26                │
│  Annual fee: ₹2,000              │
│  Already paid: ₹0                │
│  ┌────────────────────────────┐  │
│  │     Amount to pay: ₹2,000  │  │
│  └────────────────────────────┘  │
│                                  │
│  ┌────────────────────────────┐  │
│  │    [Society QR Code]       │  │
│  │   edenestate@sbi           │  │
│  │   [📋 Tap to copy UPI ID]  │  │
│  └────────────────────────────┘  │
│                                  │
│  How to pay:                     │
│  1. Open GPay / PhonePe          │
│  2. Scan QR → Enter ₹2,000      │
│  3. Return here and confirm      │
│                                  │
│  [I've paid — confirm payment]   │
│  [Pay later]                     │
│                                  │
│  No convenience fee — pay        │
│  exactly ₹2,000                  │
└──────────────────────────────────┘
```

**If no UPI QR configured**: Shows "Your society hasn't set up online payments yet. Ask your admin to configure it in Settings."

### Resident Confirm Payment Page — `/r/payments/confirm`

**Query param**: `?feeId={membershipFeeId}`

```
┌──────────────────────────────────┐
│  ← Confirm payment               │
│  Amount paid: ₹2,000             │
│                                  │
│  UTR / Transaction ID *          │
│  ┌────────────────────────────┐  │
│  │ e.g. 425619876543          │  │
│  └────────────────────────────┘  │
│  Find this in GPay → History     │
│                                  │
│  Payment date *                  │
│  ┌────────────────────────────┐  │
│  │ 04 Apr 2026  [date picker] │  │
│  └────────────────────────────┘  │
│                                  │
│  Amount paid *                   │
│  ┌────────────────────────────┐  │
│  │ 2000                       │  │
│  └────────────────────────────┘  │
│                                  │
│  Screenshot (optional)           │
│  ┌────────────────────────────┐  │
│  │ [Tap to upload screenshot] │  │
│  └────────────────────────────┘  │
│                                  │
│  [Submit for verification]       │
│  Admin verifies within 24h.      │
└──────────────────────────────────┘
```

**After submit**: Redirects to `/r/payments` with toast "Claim submitted — admin will verify within 24 hours."
**Duplicate PENDING guard**: If a PENDING claim already exists for this `membershipFeeId`, show error "You already have a pending claim for this fee. Wait for admin to verify or reject it."

### Resident Payment History Page — `/r/payments` (extend existing)

Extend existing payment history to show claim statuses:

```
┌──────────────────────────────────────────┐
│  Session 2025-26   [PENDING CLAIM 🟡]    │
│  Amount Due: ₹2,000 | Paid: ₹0          │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │  Claim submitted: 04 Apr 2026    │   │
│  │  UTR: 425619876543               │   │
│  │  Status: Awaiting admin review   │   │
│  └──────────────────────────────────┘   │
│                                          │
│  [Pay / Re-submit]                       │
└──────────────────────────────────────────┘
```

Claim status display:

- `PENDING` → yellow badge "Awaiting verification"
- `VERIFIED` → green badge "Payment confirmed" (fee_payment appears)
- `REJECTED` → red badge "Rejected: {reason}" + "Re-submit" button

### Admin Pending Claims Page — `/admin/fees/claims`

```
┌──────────────────────────────────────────────────────┐
│  Fee Management — Pending Claims [3]                  │
│  Filter: [All] [Pending] [Verified] [Rejected]        │
│──────────────────────────────────────────────────────│
│  ┌────────────────────────────────────────────────┐  │
│  │ Hemant Kumar — Flat 302                        │  │
│  │ Claimed: ₹2,000 via UPI  | Date: 04 Apr 2026  │  │
│  │ UTR: 425619876543                              │  │
│  │ Screenshot: [View]                             │  │
│  │                                                │  │
│  │ [✅ Confirm]   [❌ Reject]                     │  │
│  └────────────────────────────────────────────────┘  │
│                                                       │
│  ┌────────────────────────────────────────────────┐  │
│  │ Priya Singh — Flat 105                         │  │
│  │ Claimed: ₹2,000 via UPI  | Date: 03 Apr 2026  │  │
│  │ UTR: 428712345678                              │  │
│  │ Screenshot: [View]                             │  │
│  │                                                │  │
│  │ [✅ Confirm]   [❌ Reject]                     │  │
│  └────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

**Reject flow**: Dialog opens requiring `rejectionReason` (min 10 chars). E.g. "UTR not found in bank statement" or "Amount mismatch — paid ₹1,500, claimed ₹2,000".

**On Confirm**:

1. `PaymentClaim.status` → `VERIFIED`, `verifiedBy`, `verifiedAt` set
2. Create `FeePayment` record: `paymentMode: UPI_CLAIM`, `entryType: PAYMENT`, `paymentClaimId` linked
3. Recalculate `MembershipFee.amountPaid` and `status`
4. WhatsApp notification to resident
5. Audit log: `PAYMENT_CLAIM_VERIFIED`

### Admin Sidebar Badge

Extend `AdminSidebar` to show pending claims count badge on the **Fees** nav item:

```typescript
// In AdminSidebar nav items, Fees entry:
{
  href: "/admin/fees",
  label: "Fees",
  icon: CreditCard,
  badge: pendingClaimsCount  // fetched via useQuery(['fees-pending-count', societyId])
}
// Fetches: GET /api/v1/societies/[id]/payment-claims/pending-count
// Badge hidden when count is 0
```

### Edge Cases

| Case                                   | Handling                                                               |
| -------------------------------------- | ---------------------------------------------------------------------- |
| Duplicate UTR for same society         | DB unique index; API returns 409 "This UTR has already been used"      |
| Resident already has PENDING claim     | API returns 400 "Claim already pending for this fee"                   |
| No UPI QR configured                   | Pay page shows notice; claim submit API returns 400                    |
| Wrong amount paid                      | Admin rejects with reason; resident resubmits                          |
| Admin doesn't verify in 24h            | Cron sends reminder notification at 24h and 48h                        |
| Claim pending, fee due date passes     | Claim stays PENDING; fee status remains PENDING/OVERDUE until verified |
| Admin changed QR/UPI after claims made | Old claims still valid — UTR is the source of truth, not QR            |

---

## Flow 2 — Subscription Payment via UPI QR

### Overview

When an RWA admin needs to pay subscription fees to the platform, they use the platform's UPI QR (set up by Super Admin). Admin scans, pays, submits UTR, SA verifies.

> **Distinction**: The existing `SubscriptionPayment` model is SA-recorded (SA manually enters payment). The new `SubscriptionPaymentClaim` is admin self-service (admin submits UTR → SA verifies). Separate model, separate table, separate routes.

### SA Platform UPI Setup — `/sa/settings/payments`

```
┌─────────────────────────────────────────────────────┐
│  Platform Payment Collection                         │
│─────────────────────────────────────────────────────│
│  Platform UPI ID *                                   │
│  ┌──────────────────────────────────────────────┐   │
│  │ rwaconnect@icici                              │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  Platform UPI QR Code *                              │
│  ┌──────────────────────────────────────────────┐   │
│  │ [Upload QR Image]  PNG/JPG, max 2MB           │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  Account Holder Name                                 │
│  ┌──────────────────────────────────────────────┐   │
│  │ RWA Connect Technologies Pvt Ltd              │   │
│  └──────────────────────────────────────────────┘   │
│                                          [Save]      │
└─────────────────────────────────────────────────────┘
```

**Storage**: `platform/upi-qr.png` in Supabase Storage bucket `platform-assets`.
**Data stored**: `platform_settings` table, keys `platform_upi_id`, `platform_upi_qr_url`, `platform_upi_account_name`.

### Admin Subscription Payment Page — `/admin/settings/subscription` (extend)

Extend the existing subscription page with a "Pay Subscription" section that appears when payment is due:

```
┌─────────────────────────────────────────────────────┐
│  Subscription Payment Due                            │
│  Plan: Community | Monthly | ₹1,799                 │
│  Due: 15 Apr 2026 | Status: 🟡 Pending              │
│─────────────────────────────────────────────────────│
│  ┌──────────────────────────────────────────────┐   │
│  │        [Platform UPI QR Code]                 │   │
│  │        rwaconnect@icici                        │   │
│  │        RWA Connect Technologies Pvt Ltd        │   │
│  │        [📋 Tap to copy UPI ID]                │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  1. Open GPay / PhonePe                              │
│  2. Scan QR and pay ₹1,799                          │
│  3. Come back and confirm below                      │
│                                                      │
│  [I've paid — confirm payment]                       │
│  No convenience fee — pay exactly ₹1,799            │
│─────────────────────────────────────────────────────│
│  Previous Payments                                   │
│  ┌─────────────────────────────────────────────┐    │
│  │ ₹1,799 — Mar 2026 — ✅ Verified             │    │
│  │ ₹1,799 — Feb 2026 — ✅ Verified             │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

On "I've paid": Opens a dialog/sheet to enter UTR, date, amount, screenshot.

### SA Subscription Claims Page — `/sa/billing/payments` (extend)

Extend existing SA billing page to include a "Pending Claims" tab:

```
┌─────────────────────────────────────────────────────────────┐
│  [Recorded Payments]  [Pending Claims (5)]                   │
│─────────────────────────────────────────────────────────────│
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Eden Estate RWA — Community Plan                       │ │
│  │ Amount: ₹1,799 | Claimed: 04 Apr 2026                 │ │
│  │ UTR: 428756123456 | Screenshot: [View]                 │ │
│  │                                                        │ │
│  │ [✅ Confirm Payment]   [❌ Reject]                     │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**On SA Confirm**:

1. `SubscriptionPaymentClaim.status` → `VERIFIED`
2. Creates `SubscriptionPayment` record (existing model) for bookkeeping
3. Extends subscription period (`periodStart`/`periodEnd` from claim)
4. WhatsApp to admin: "Subscription payment of ₹1,799 confirmed"
5. Audit: `SUBSCRIPTION_CLAIM_VERIFIED`

---

## Database Schema

### Enum Update: `PaymentMode`

Add to existing `PaymentMode` enum in `supabase/schema.prisma`:

```prisma
enum PaymentMode {
  CASH
  UPI
  BANK_TRANSFER
  UPI_CLAIM      // ← ADD: fee_payment created from admin-verified resident UPI claim
}
```

### New Fields on `societies` (Prisma model update)

```prisma
// Add to Society model:
upiId           String?  @map("upi_id") @db.VarChar(100)
upiQrUrl        String?  @map("upi_qr_url") @db.VarChar(500)
upiAccountName  String?  @map("upi_account_name") @db.VarChar(200)
paymentClaims   PaymentClaim[]
```

SQL migration:

```sql
ALTER TABLE societies ADD COLUMN upi_id VARCHAR(100);
ALTER TABLE societies ADD COLUMN upi_qr_url VARCHAR(500);
ALTER TABLE societies ADD COLUMN upi_account_name VARCHAR(200);
```

### New Fields on `fee_payments` (Prisma model update)

```prisma
// Add to FeePayment model:
paymentClaimId  String?       @map("payment_claim_id") @db.Uuid
paymentClaim    PaymentClaim? @relation(fields: [paymentClaimId], references: [id])
```

SQL migration:

```sql
ALTER TABLE fee_payments ADD COLUMN payment_claim_id UUID REFERENCES payment_claims(id);
```

### New Table: `payment_claims`

```sql
CREATE TABLE payment_claims (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id        UUID NOT NULL REFERENCES societies(id),
  user_id           UUID NOT NULL REFERENCES users(id),
  membership_fee_id UUID NOT NULL REFERENCES membership_fees(id),
  claimed_amount    DECIMAL(10,2) NOT NULL,
  utr_number        VARCHAR(50) NOT NULL,
  payment_date      DATE NOT NULL,
  screenshot_url    VARCHAR(500),
  status            VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  verified_by       UUID REFERENCES users(id),
  verified_at       TIMESTAMPTZ,
  rejection_reason  TEXT,
  fee_payment_id    UUID REFERENCES fee_payments(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_claims_utr_society ON payment_claims(utr_number, society_id);
CREATE INDEX idx_claims_society_status ON payment_claims(society_id, status);
CREATE INDEX idx_claims_user ON payment_claims(user_id);
```

RLS:

```sql
ALTER TABLE payment_claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY society_isolation ON payment_claims
  USING (society_id = (
    SELECT society_id FROM users WHERE auth_user_id = auth.uid()
  ));
```

### New Table: `subscription_payment_claims`

```sql
CREATE TABLE subscription_payment_claims (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id       UUID NOT NULL REFERENCES societies(id),
  subscription_id  UUID NOT NULL REFERENCES society_subscriptions(id),
  amount           DECIMAL(10,2) NOT NULL,
  utr_number       VARCHAR(50) NOT NULL,
  payment_date     DATE NOT NULL,
  screenshot_url   VARCHAR(500),
  status           VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  verified_by      VARCHAR(100),
  verified_at      TIMESTAMPTZ,
  rejection_reason TEXT,
  period_start     DATE,
  period_end       DATE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_sub_claims_utr ON subscription_payment_claims(utr_number);
CREATE INDEX idx_sub_claims_society_status ON subscription_payment_claims(society_id, status);
CREATE INDEX idx_sub_claims_status ON subscription_payment_claims(status);
```

### New Table: `platform_settings`

```sql
CREATE TABLE platform_settings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key   VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### Prisma Model Additions

```prisma
model PaymentClaim {
  id              String    @id @default(uuid()) @db.Uuid
  societyId       String    @map("society_id") @db.Uuid
  userId          String    @map("user_id") @db.Uuid
  membershipFeeId String    @map("membership_fee_id") @db.Uuid
  claimedAmount   Decimal   @map("claimed_amount") @db.Decimal(10, 2)
  utrNumber       String    @map("utr_number") @db.VarChar(50)
  paymentDate     DateTime  @map("payment_date") @db.Date
  screenshotUrl   String?   @map("screenshot_url") @db.VarChar(500)
  status          String    @default("PENDING") @db.VarChar(20)
  verifiedBy      String?   @map("verified_by") @db.Uuid
  verifiedAt      DateTime? @map("verified_at")
  rejectionReason String?   @map("rejection_reason")
  feePaymentId    String?   @map("fee_payment_id") @db.Uuid
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  society       Society       @relation(fields: [societyId], references: [id])
  user          User          @relation(fields: [userId], references: [id])
  membershipFee MembershipFee @relation(fields: [membershipFeeId], references: [id])
  feePayment    FeePayment?   @relation(fields: [feePaymentId], references: [id])
  verifier      User?         @relation("ClaimVerifier", fields: [verifiedBy], references: [id])

  @@unique([utrNumber, societyId])
  @@map("payment_claims")
}

model SubscriptionPaymentClaim {
  id              String    @id @default(uuid()) @db.Uuid
  societyId       String    @map("society_id") @db.Uuid
  subscriptionId  String    @map("subscription_id") @db.Uuid
  amount          Decimal   @db.Decimal(10, 2)
  utrNumber       String    @map("utr_number") @db.VarChar(50)
  paymentDate     DateTime  @map("payment_date") @db.Date
  screenshotUrl   String?   @map("screenshot_url") @db.VarChar(500)
  status          String    @default("PENDING") @db.VarChar(20)
  verifiedBy      String?   @map("verified_by") @db.VarChar(100)
  verifiedAt      DateTime? @map("verified_at")
  rejectionReason String?   @map("rejection_reason")
  periodStart     DateTime? @map("period_start") @db.Date
  periodEnd       DateTime? @map("period_end") @db.Date
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  society      Society             @relation(fields: [societyId], references: [id])
  subscription SocietySubscription @relation(fields: [subscriptionId], references: [id])

  @@unique([utrNumber])
  @@map("subscription_payment_claims")
}

model PlatformSetting {
  id           String   @id @default(uuid()) @db.Uuid
  settingKey   String   @unique @map("setting_key") @db.VarChar(100)
  settingValue String   @map("setting_value")
  updatedAt    DateTime @updatedAt @map("updated_at")

  @@map("platform_settings")
}
```

### Seed Data (`supabase/seed-master.ts`)

```typescript
// Add to seed-master.ts (upsert, safe to re-run)
await prisma.platformSetting.createMany({
  data: [
    { settingKey: "platform_upi_id", settingValue: "" },
    { settingKey: "platform_upi_qr_url", settingValue: "" },
    { settingKey: "platform_upi_account_name", settingValue: "" },
  ],
  skipDuplicates: true,
});
```

---

## API Endpoints

### Auth Conventions

| Actor    | Auth Method                    | Society Context                   |
| -------- | ------------------------------ | --------------------------------- |
| Resident | Supabase JWT, resident session | Derived from `resident.societyId` |
| Admin    | Supabase JWT, admin session    | `?sid=` query param (middleware)  |
| SA       | `requireSuperAdmin()` guard    | None (cross-society)              |

### UPI Setup (Admin)

| Method | Endpoint                                             | Description                         |
| ------ | ---------------------------------------------------- | ----------------------------------- |
| GET    | `/api/v1/societies/[id]/payment-setup`               | Get UPI settings for society        |
| PATCH  | `/api/v1/societies/[id]/payment-setup/upi`           | Update UPI ID, QR URL, account name |
| POST   | `/api/v1/societies/[id]/payment-setup/upi/upload-qr` | Upload QR image → Supabase Storage  |

### Payment Claims — Resident

| Method | Endpoint                                                | Description                              |
| ------ | ------------------------------------------------------- | ---------------------------------------- |
| POST   | `/api/v1/residents/me/payment-claims`                   | Submit claim (UTR + optional screenshot) |
| GET    | `/api/v1/residents/me/payment-claims`                   | List own claims with status              |
| POST   | `/api/v1/residents/me/payment-claims/upload-screenshot` | Upload screenshot → returns URL          |

### Payment Claims — Admin

| Method | Endpoint                                                 | Description                          |
| ------ | -------------------------------------------------------- | ------------------------------------ |
| GET    | `/api/v1/societies/[id]/payment-claims`                  | List all claims (filter: `?status=`) |
| GET    | `/api/v1/societies/[id]/payment-claims/pending-count`    | Count PENDING claims (for badge)     |
| PATCH  | `/api/v1/societies/[id]/payment-claims/[claimId]/verify` | Confirm → creates fee_payment        |
| PATCH  | `/api/v1/societies/[id]/payment-claims/[claimId]/reject` | Reject with reason                   |

### Subscription Payment Claims — Admin

| Method | Endpoint                                             | Description                      |
| ------ | ---------------------------------------------------- | -------------------------------- |
| POST   | `/api/v1/societies/[id]/subscription-payment-claims` | Admin submits sub payment claim  |
| GET    | `/api/v1/societies/[id]/subscription-payment-claims` | View own society's claim history |

### Subscription Payment Claims — Super Admin

| Method | Endpoint                                                           | Description                          |
| ------ | ------------------------------------------------------------------ | ------------------------------------ |
| GET    | `/api/v1/super-admin/subscription-payment-claims`                  | List all claims (`?status=`)         |
| GET    | `/api/v1/super-admin/subscription-payment-claims/pending-count`    | Count for SA sidebar badge           |
| PATCH  | `/api/v1/super-admin/subscription-payment-claims/[claimId]/verify` | Verify → creates SubscriptionPayment |
| PATCH  | `/api/v1/super-admin/subscription-payment-claims/[claimId]/reject` | Reject with reason                   |

### Platform Payment Setup (SA)

| Method | Endpoint                                               | Description                           |
| ------ | ------------------------------------------------------ | ------------------------------------- |
| GET    | `/api/v1/super-admin/platform-payment-setup`           | Get platform UPI settings             |
| PATCH  | `/api/v1/super-admin/platform-payment-setup/upi`       | Update platform UPI ID / account      |
| POST   | `/api/v1/super-admin/platform-payment-setup/upload-qr` | Upload platform QR → Supabase Storage |

### Feature Configuration (Public)

| Method | Endpoint                          | Description                     |
| ------ | --------------------------------- | ------------------------------- |
| GET    | `/api/v1/config/payment-features` | Returns feature flags (no auth) |

```json
{
  "upiQrEnabled": true,
  "razorpayGatewayEnabled": false,
  "razorpaySubscriptionBillingEnabled": false,
  "razorpayMode": null
}
```

---

## Validation Schemas (`src/lib/validations/payment-claim.ts`)

```typescript
import { z } from "zod";

const today = () => new Date().toISOString().split("T")[0];

export const paymentClaimSchema = z.object({
  membershipFeeId: z.string().uuid(),
  claimedAmount: z.number().positive().max(999999),
  utrNumber: z
    .string()
    .min(10, "UTR must be at least 10 characters")
    .max(50, "UTR too long")
    .regex(/^[A-Z0-9]+$/i, "UTR must contain only letters and numbers"),
  paymentDate: z
    .string()
    .date()
    .refine((d) => d <= today(), "Payment date cannot be in the future"),
  screenshotUrl: z.string().url().optional(),
});

export const rejectClaimSchema = z.object({
  rejectionReason: z.string().min(10, "Reason must be at least 10 characters").max(500),
});

export const subscriptionClaimSchema = z.object({
  amount: z.number().positive(),
  utrNumber: z
    .string()
    .min(10)
    .max(50)
    .regex(/^[A-Z0-9]+$/i),
  paymentDate: z
    .string()
    .date()
    .refine((d) => d <= today(), "Date cannot be in the future"),
  screenshotUrl: z.string().url().optional(),
  periodStart: z.string().date().optional(),
  periodEnd: z.string().date().optional(),
});
```

## Validation Schemas (`src/lib/validations/payment-setup.ts`)

```typescript
import { z } from "zod";

export const upiSetupSchema = z.object({
  upiId: z
    .string()
    .regex(/^[a-zA-Z0-9._-]+@[a-zA-Z]+$/, "Invalid UPI ID format (e.g. society@sbi)"),
  upiQrUrl: z.string().url().optional(),
  upiAccountName: z.string().max(200).optional(),
});

export const platformUpiSchema = z.object({
  platformUpiId: z.string().regex(/^[a-zA-Z0-9._-]+@[a-zA-Z]+$/),
  platformUpiQrUrl: z.string().url().optional(),
  platformUpiAccountName: z.string().max(200).optional(),
});
```

---

## TypeScript Types (`src/types/payment.ts`)

```typescript
export type ClaimStatus = "PENDING" | "VERIFIED" | "REJECTED";

export interface PaymentClaim {
  id: string;
  societyId: string;
  userId: string;
  membershipFeeId: string;
  claimedAmount: number;
  utrNumber: string;
  paymentDate: string;
  screenshotUrl: string | null;
  status: ClaimStatus;
  verifiedBy: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  feePaymentId: string | null;
  createdAt: string;
  updatedAt: string;
  // joins
  user?: { name: string; unitNumber: string };
  membershipFee?: { sessionYear: string; amountDue: number };
}

export interface SubscriptionPaymentClaim {
  id: string;
  societyId: string;
  subscriptionId: string;
  amount: number;
  utrNumber: string;
  paymentDate: string;
  screenshotUrl: string | null;
  status: ClaimStatus;
  verifiedBy: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
  // joins
  society?: { name: string };
  subscription?: { planName: string };
}

export interface UpiSettings {
  upiId: string | null;
  upiQrUrl: string | null;
  upiAccountName: string | null;
}

export interface PlatformUpiSettings {
  platformUpiId: string | null;
  platformUpiQrUrl: string | null;
  platformUpiAccountName: string | null;
}
```

---

## Client Services (`src/services/`)

### `src/services/payment-claims.ts`

```typescript
import type { PaymentClaim } from "@/types/payment";

export async function submitPaymentClaim(data: {
  membershipFeeId: string;
  claimedAmount: number;
  utrNumber: string;
  paymentDate: string;
  screenshotUrl?: string;
}): Promise<{ claim: PaymentClaim }> {
  const res = await fetch("/api/v1/residents/me/payment-claims", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ claim: PaymentClaim }>;
}

export async function getMyPaymentClaims(): Promise<{ claims: PaymentClaim[] }> {
  const res = await fetch("/api/v1/residents/me/payment-claims");
  if (!res.ok) throw new Error("Failed to fetch claims");
  return res.json() as Promise<{ claims: PaymentClaim[] }>;
}

export async function uploadClaimScreenshot(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/v1/residents/me/payment-claims/upload-screenshot", {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error("Upload failed");
  return res.json() as Promise<{ url: string }>;
}

export async function getPaymentClaimsPendingCount(societyId: string): Promise<{ count: number }> {
  const res = await fetch(`/api/v1/societies/${societyId}/payment-claims/pending-count`);
  if (!res.ok) throw new Error("Failed to fetch count");
  return res.json() as Promise<{ count: number }>;
}
```

### `src/services/payment-setup.ts`

```typescript
import type { UpiSettings, PlatformUpiSettings } from "@/types/payment";

export async function getPaymentSetup(societyId: string): Promise<UpiSettings> {
  const res = await fetch(`/api/v1/societies/${societyId}/payment-setup`);
  if (!res.ok) throw new Error("Failed to fetch payment setup");
  return res.json() as Promise<UpiSettings>;
}

export async function getPlatformPaymentSetup(): Promise<PlatformUpiSettings> {
  const res = await fetch("/api/v1/super-admin/platform-payment-setup");
  if (!res.ok) throw new Error("Failed to fetch platform payment setup");
  return res.json() as Promise<PlatformUpiSettings>;
}
```

---

## Components

### `src/components/features/payments/UpiQrDisplay.tsx`

Props: `upiQrUrl: string | null`, `upiId: string | null`, `accountName: string | null`, `amount: number`

Behaviour:

- Displays QR image full-width in a bordered card
- Shows UPI ID with a "copy" button (copies to clipboard via `navigator.clipboard`)
- Shows account name below UPI ID
- Shows amount prominently above QR
- If `upiQrUrl` is null: shows "QR not configured" placeholder

### `src/components/features/payments/PaymentClaimForm.tsx`

Props: `membershipFeeId: string`, `amountDue: number`, `onSuccess: () => void`

Behaviour:

- React Hook Form + Zod (`paymentClaimSchema`)
- UTR field: uppercase-transform on input
- Date field: defaults to today, no future dates
- Amount field: pre-filled with `amountDue`, editable (resident may pay partial)
- Screenshot: file input → calls `uploadClaimScreenshot` → stores URL in form
- Submit: calls `submitPaymentClaim`, shows success toast, calls `onSuccess`
- Error: shows inline validation + API errors

### `src/components/features/payments/PendingClaimCard.tsx`

Props: `claim: PaymentClaim`, `onVerify: (id: string) => void`, `onReject: (id: string, reason: string) => void`, `isPending: boolean`

Behaviour:

- Card showing resident name, flat, claimed amount, UTR, date
- "View screenshot" link opens in new tab
- "Confirm" button calls `onVerify`
- "Reject" button opens inline reason textarea, submit calls `onReject`
- Both buttons disabled when `isPending`

### `src/components/features/settings/PaymentSetupForm.tsx`

Props: `societyId: string`, `initialValues: UpiSettings`

Behaviour:

- React Hook Form + Zod (`upiSetupSchema`)
- UPI ID text input with format hint
- QR image upload: drag-drop or click, preview shown on upload
- Account name optional text input
- On save: PATCH `/api/v1/societies/[id]/payment-setup/upi`

### `src/components/features/subscription/SubscriptionPaymentClaimForm.tsx`

Props: `societyId: string`, `subscriptionId: string`, `amountDue: number`, `onSuccess: () => void`

Behaviour:

- Dialog/Sheet triggered by "I've paid" button
- Fields: UTR (required), amount (pre-filled), date (today default), screenshot (optional)
- On submit: POST `/api/v1/societies/[id]/subscription-payment-claims`
- Shows "Your payment claim has been submitted. SA will verify within 2 business days."

---

## WhatsApp Notifications (WATI)

All notifications use `src/lib/whatsapp.ts` → `sendWhatsApp(mobile, templateName, params)`.

| Event                          | Recipient       | Template Name                  | Params                                          |
| ------------------------------ | --------------- | ------------------------------ | ----------------------------------------------- |
| Resident submits claim         | Admin           | `admin_payment_claim_received` | `residentName`, `flatNo`, `amount`, `utrNumber` |
| Admin verifies claim           | Resident        | `resident_payment_confirmed`   | `amount`, `receiptNo`                           |
| Admin rejects claim            | Resident        | `resident_payment_rejected`    | `amount`, `rejectionReason`                     |
| Claim pending 24h (reminder)   | Admin           | `admin_claim_reminder_24h`     | `pendingCount`                                  |
| Claim pending 48h (escalation) | Admin           | `admin_claim_reminder_48h`     | `pendingCount`                                  |
| Admin submits sub claim        | SA (email only) | —                              | `societyName`, `amount`, `utrNumber`            |
| SA verifies sub claim          | Admin           | `admin_sub_payment_confirmed`  | `amount`, `periodStart`, `periodEnd`            |
| SA rejects sub claim           | Admin           | `admin_sub_payment_rejected`   | `amount`, `rejectionReason`                     |

> WATI templates must be created and approved before deployment. Names above are proposed — use exact approved names.

---

## Cron Job — Claim Reminders

**Route**: `GET /api/cron/payment-claim-reminders`
**Schedule** (add to `vercel.json`):

```json
{
  "crons": [
    {
      "path": "/api/cron/payment-claim-reminders",
      "schedule": "0 9 * * *"
    }
  ]
}
```

**Logic**:

1. Verify `CRON_SECRET` header (use `src/lib/cron-auth.ts` pattern)
2. Find all `PaymentClaim` with `status = PENDING`, `createdAt` between 24h and 48h ago → send `admin_claim_reminder_24h`
3. Find all `PaymentClaim` with `status = PENDING`, `createdAt` > 48h ago → send `admin_claim_reminder_48h`
4. Group by society → one notification per society (include count)

---

## Audit Actions (add to `src/lib/audit.ts`)

```typescript
| "PAYMENT_CLAIM_SUBMITTED"
| "PAYMENT_CLAIM_VERIFIED"
| "PAYMENT_CLAIM_REJECTED"
| "UPI_SETUP_UPDATED"
| "SUBSCRIPTION_CLAIM_SUBMITTED"
| "SUBSCRIPTION_CLAIM_VERIFIED"
| "SUBSCRIPTION_CLAIM_REJECTED"
| "PLATFORM_PAYMENT_SETUP_UPDATED"
```

---

## UI Pages Summary

| Page                            | Path                            | Who      | Status |
| ------------------------------- | ------------------------------- | -------- | ------ |
| Payment Setup (UPI)             | `/admin/settings/payment-setup` | Admin    | New    |
| Pending Claims Dashboard        | `/admin/fees/claims`            | Admin    | New    |
| Subscription Settings (extend)  | `/admin/settings/subscription`  | Admin    | Extend |
| Pay Fee (QR display)            | `/r/payments/pay`               | Resident | New    |
| Confirm Payment (UTR form)      | `/r/payments/confirm`           | Resident | New    |
| Payment History (extend claims) | `/r/payments`                   | Resident | Extend |
| Platform Payment Setup          | `/sa/settings/payments`         | SA       | New    |
| Subscription Claims (extend)    | `/sa/billing/payments`          | SA       | Extend |

---

## Key Files

| File                                                                               | Purpose                                    |
| ---------------------------------------------------------------------------------- | ------------------------------------------ |
| `src/lib/config/payment.ts`                                                        | Feature detection (Razorpay env var flags) |
| `src/lib/validations/payment-claim.ts`                                             | Zod schemas for claims                     |
| `src/lib/validations/payment-setup.ts`                                             | Zod schemas for UPI setup                  |
| `src/types/payment.ts`                                                             | TypeScript interfaces                      |
| `src/services/payment-claims.ts`                                                   | Client fetch wrappers                      |
| `src/services/payment-setup.ts`                                                    | Client fetch wrappers for setup            |
| `src/components/features/payments/UpiQrDisplay.tsx`                                | QR + UPI ID display                        |
| `src/components/features/payments/PaymentClaimForm.tsx`                            | UTR entry form                             |
| `src/components/features/payments/PendingClaimCard.tsx`                            | Admin verify/reject card                   |
| `src/components/features/settings/PaymentSetupForm.tsx`                            | Admin UPI setup form                       |
| `src/components/features/subscription/SubscriptionPaymentClaimForm.tsx`            | Admin sub payment claim form               |
| `src/app/api/v1/societies/[id]/payment-setup/route.ts`                             | GET/PATCH UPI settings                     |
| `src/app/api/v1/societies/[id]/payment-setup/upi/upload-qr/route.ts`               | QR image upload                            |
| `src/app/api/v1/residents/me/payment-claims/route.ts`                              | Resident submit + list claims              |
| `src/app/api/v1/residents/me/payment-claims/upload-screenshot/route.ts`            | Screenshot upload                          |
| `src/app/api/v1/societies/[id]/payment-claims/route.ts`                            | Admin list all claims                      |
| `src/app/api/v1/societies/[id]/payment-claims/pending-count/route.ts`              | Badge count                                |
| `src/app/api/v1/societies/[id]/payment-claims/[claimId]/verify/route.ts`           | Admin verify                               |
| `src/app/api/v1/societies/[id]/payment-claims/[claimId]/reject/route.ts`           | Admin reject                               |
| `src/app/api/v1/societies/[id]/subscription-payment-claims/route.ts`               | Admin submit sub claim                     |
| `src/app/api/v1/super-admin/subscription-payment-claims/route.ts`                  | SA list claims                             |
| `src/app/api/v1/super-admin/subscription-payment-claims/[claimId]/verify/route.ts` | SA verify                                  |
| `src/app/api/v1/super-admin/subscription-payment-claims/[claimId]/reject/route.ts` | SA reject                                  |
| `src/app/api/v1/super-admin/platform-payment-setup/route.ts`                       | SA GET/PATCH platform UPI                  |
| `src/app/api/v1/super-admin/platform-payment-setup/upload-qr/route.ts`             | SA upload platform QR                      |
| `src/app/api/v1/config/payment-features/route.ts`                                  | Public feature flags                       |
| `src/app/api/cron/payment-claim-reminders/route.ts`                                | Daily reminder cron                        |
| `src/app/admin/fees/claims/page.tsx`                                               | Admin claims page                          |
| `src/app/admin/settings/payment-setup/page.tsx`                                    | Admin UPI setup page                       |
| `src/app/r/payments/pay/page.tsx`                                                  | Resident pay fee page                      |
| `src/app/r/payments/confirm/page.tsx`                                              | Resident confirm payment page              |
| `src/app/sa/settings/payments/page.tsx`                                            | SA platform payment setup                  |

---

## Test Coverage Requirements (100% for all new files)

| Test File                                        | Key Scenarios                                                                                                       |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `tests/api/payment-claims.test.ts`               | Submit (valid, duplicate UTR, no QR, already pending), verify (creates fee_payment), reject (no reason → 400), list |
| `tests/api/payment-setup.test.ts`                | GET (unauthenticated → 401), PATCH (valid UPI ID, invalid format), upload-qr (file too large → 400)                 |
| `tests/api/subscription-payment-claims.test.ts`  | Admin submit, SA verify (creates SubscriptionPayment), SA reject, duplicate UTR                                     |
| `tests/api/platform-payment-setup.test.ts`       | GET/PATCH as SA, as non-SA → 403                                                                                    |
| `tests/api/config-payment-features.test.ts`      | Returns correct flags for each env var combination                                                                  |
| `tests/api/cron-payment-claim-reminders.test.ts` | No CRON_SECRET → 401; 24h/48h batches send correct templates                                                        |
| `tests/components/UpiQrDisplay.test.tsx`         | Renders QR image, copy button, null QR placeholder                                                                  |
| `tests/components/PaymentClaimForm.test.tsx`     | Validation (UTR regex, future date → error), submit calls service                                                   |
| `tests/components/PendingClaimCard.test.tsx`     | Confirm fires onVerify, reject requires reason, loading disables buttons                                            |
| `tests/lib/validations/payment-claim.test.ts`    | All schema branches: UTR regex, date not future, amount positive                                                    |
| `tests/lib/validations/payment-setup.test.ts`    | UPI ID regex cases, platform UPI schema                                                                             |

**Pattern reminders**:

- API tests: use `vi.hoisted()` for Prisma mock (see `MEMORY.md`)
- Component tests: wrap in `QueryClientProvider`, mock services with `vi.hoisted()`

---

## Tax Implications Summary

| Scenario                                      | GST Liability For Platform | Notes                                        |
| --------------------------------------------- | -------------------------- | -------------------------------------------- |
| Resident pays ₹2,000 via UPI QR to RWA        | ₹0                         | Money never touches platform; direct P2M UPI |
| RWA pays ₹1,799 subscription via UPI QR to SA | GST on ₹1,799              | Platform's revenue — GST applicable          |

**Key principle**: Resident fee payments go directly from the resident's bank to the RWA's bank via NPCI UPI rails (0% MDR). The platform never holds or receives these funds. Subscription payments (Flow 2) are the platform's revenue and attract GST.

---

## Implementation Order (Phase 6A)

1. **Schema migration**: Add UPI fields to `societies`; add `payment_claim_id` to `fee_payments`; create `payment_claims`, `subscription_payment_claims`, `platform_settings` tables; add `UPI_CLAIM` to `PaymentMode` enum; add `PaymentClaim`, `SubscriptionPaymentClaim`, `PlatformSetting` Prisma models; add relations to `Society`, `FeePayment`, `User`, `MembershipFee`, `SocietySubscription`
2. Run `npm run db:generate`
3. Seed `platform_settings` in `seed-master.ts`
4. `src/lib/config/payment.ts` (feature detection, returns `razorpayEnabled: false` without env vars)
5. `src/lib/validations/payment-claim.ts` + `payment-setup.ts`
6. `src/types/payment.ts`
7. Admin payment setup API (`payment-setup` GET/PATCH + upload-qr)
8. `PaymentSetupForm` component + admin payment setup page
9. Resident pay fee page: fetch UPI settings + `UpiQrDisplay` component
10. Resident confirm page: `PaymentClaimForm` component + screenshot upload API
11. Resident claim submit API (`/residents/me/payment-claims` POST)
12. Admin claims list API + pending-count API
13. `PendingClaimCard` component + `/admin/fees/claims` page
14. Admin verify/reject API endpoints (create fee_payment on verify)
15. Admin sidebar Fees badge (pending-count useQuery)
16. Platform UPI setup API (SA) + `/sa/settings/payments` page
17. `SubscriptionPaymentClaimForm` component + admin submit API
18. SA subscription claims list/verify/reject APIs
19. SA billing page extension (pending claims tab)
20. Extend resident `/r/payments` to show claim statuses
21. Cron job for 24h/48h reminders
22. WhatsApp notifications for each event
23. Audit logging for each action (all 8 new action types)
24. RLS migration for `payment_claims`
25. Write all tests (100% coverage)
26. `npm run lint` + `npm run build` — zero errors before commit
