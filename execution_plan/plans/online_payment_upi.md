# Online Payments — UPI QR Flow

> **Scope**: UPI QR setup, resident payment claims, admin verification, subscription payment claims, and Super Admin platform QR setup. Zero external payment gateway dependency. Available on all plans. Implement this before the Razorpay gateway (`online_payment_razorpay.md`) — Razorpay is optional and additive on top of this.

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

1. `PaymentClaim.status` → `VERIFIED`, `verifiedBy` (admin userId), `verifiedAt` set
2. Create `FeePayment` record: `feeId`, `paymentMode: UPI_CLAIM`, `recordedBy: adminUserId`, `paymentClaimId` linked, receipt number generated
3. Recalculate `MembershipFee.amountPaid` and `status` (PAID or PARTIAL)
4. Update `User.status` → `ACTIVE_PAID` or `ACTIVE_PARTIAL` (same as existing payment flow)
5. WhatsApp notification to resident
6. Audit log: `PAYMENT_CLAIM_VERIFIED`

### Mobile UX Notes

Resident portal is mobile-first. Key UX specifications:

| Element           | Spec                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| QR image size     | Min 200×200px, max 300×300px. Use `next/image` with `width={250} height={250} style={{ objectFit: "contain" }}`.   |
| Copy UPI ID       | On tap: show brief inline toast "Copied!" (use `toast()` from shadcn, 1.5s duration). Button text: "📋 Copy UPI"   |
| Confirm page form | Full-screen card. UTR field: `inputMode="text" autoCapitalize="characters"` for automatic uppercase on iOS/Android |
| Submit button     | 48px tap height minimum. Shows spinner while submitting. Disabled during inflight request.                         |
| Back navigation   | `← Back` at top left of both pay and confirm pages                                                                 |

### Admin Sidebar Badge

Extend `AdminSidebar.tsx` (`src/components/layout/AdminSidebar.tsx`) to show a pending claims count badge on the **Fees** nav item.

The existing `navItems` array is static. Follow the existing announcements badge pattern already in `SidebarContent` — add a `useQuery` for the pending count and conditionally render the badge on the Fees item:

```typescript
// Inside SidebarContent() in AdminSidebar.tsx — add alongside existing announcements query
const { data: pendingClaimsData } = useQuery({
  queryKey: ["fees-pending-count", societyId],
  queryFn: () =>
    fetch(`/api/v1/societies/${societyId}/payment-claims/pending-count`)
      .then((r) => r.json() as Promise<{ count: number }>),
  staleTime: 30_000,
  enabled: !!societyId,
});
const pendingClaimsCount = pendingClaimsData?.count ?? 0;

// In the nav item render loop, add badge for Fees (same pattern as unreadCount for Announcements):
{item.href.includes("/admin/fees") && pendingClaimsCount > 0 && (
  <span className="ml-auto rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground">
    {pendingClaimsCount}
  </span>
)}
```

> `societyId` is already available in `SidebarContent` props (passed from `AdminSidebar` via the `queryString`). Extract it by parsing `?sid=` from `queryString` or pass it as a direct prop.

### Edge Cases

| Case                                   | Handling                                                                                                                                                                                                                                              |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Duplicate UTR for same society         | DB unique index; API returns `{ error: "UTR_DUPLICATE", message: "This UTR has already been used" }` (HTTP 409)                                                                                                                                       |
| Resident already has PENDING claim     | API returns `{ error: "CLAIM_ALREADY_PENDING", message: "You already have a pending claim for this fee" }` (HTTP 400)                                                                                                                                 |
| No UPI QR configured                   | Pay page shows notice; claim submit API returns `{ error: "UPI_NOT_CONFIGURED", message: "Society has not set up UPI payments" }` (HTTP 400)                                                                                                          |
| Wrong amount paid                      | Admin rejects with reason; resident sees "Rejected" + reason + "Re-submit" button                                                                                                                                                                     |
| Partial amount claimed                 | If `claimedAmount < amountDue`, claim is accepted as-is. On verify: `FeePayment.amount = claimedAmount`; `MembershipFee.status → PARTIAL`. Resident can submit another claim for the remaining balance.                                               |
| Admin doesn't verify in 24h            | Cron sends reminder notification at 24h and 48h                                                                                                                                                                                                       |
| Claim pending, fee due date passes     | Claim stays PENDING; fee status remains PENDING/OVERDUE until verified                                                                                                                                                                                |
| Admin changed QR/UPI after claims made | Old claims still valid — UTR is the source of truth, not QR                                                                                                                                                                                           |
| Two admins verify same claim           | Concurrent guard: verify endpoint uses Prisma `$transaction` to atomically check `status = PENDING` before updating. Second admin gets `{ error: "CLAIM_ALREADY_PROCESSED", message: "This claim has already been verified or rejected" }` (HTTP 409) |
| Rejected claim resubmission            | Resident can create a NEW claim for the same `membershipFeeId` only after existing claim is `REJECTED`. Endpoint checks: no existing `PENDING` claim exists.                                                                                          |

### PaymentClaim Status Machine

```
                    ┌───────────────┐
  Resident submits  │               │
  ─────────────────▶│    PENDING    │
                    │               │
                    └───────┬───────┘
                            │
              ┌─────────────┴─────────────┐
              │                           │
         Admin confirms              Admin rejects
              │                           │
              ▼                           ▼
        ┌──────────┐               ┌──────────┐
        │ VERIFIED │               │ REJECTED │
        │          │               │          │
        │ FeePayment│              │ reason   │
        │ created  │               │ stored   │
        └──────────┘               └────┬─────┘
                                        │
                                Resident can submit
                                NEW claim (different claimId)
```

**Rules**:

- `PENDING → VERIFIED`: Creates `FeePayment`, updates `MembershipFee.amountPaid + status`, sends WhatsApp
- `PENDING → REJECTED`: Stores `rejectionReason`, sends WhatsApp with reason
- `VERIFIED / REJECTED → *`: No further transitions allowed
- After `REJECTED`: Resident may create a new `PaymentClaim` for the same fee (new row, new claimId)

### SA Sidebar Badge

Extend `SuperAdminSidebar.tsx` (`src/components/layout/SuperAdminSidebar.tsx`) to show a pending subscription claims count badge on the **Billing** nav item.

The existing `navItems` array is static `{ href, label, icon }` with no badge field. Follow the same pattern used in `AdminSidebar.tsx` for announcements — add a `useQuery` inside `SidebarContent` and render the badge conditionally for the Billing item only:

```typescript
// Inside SidebarContent() in SuperAdminSidebar.tsx
const { data: pendingSubClaimsData } = useQuery({
  queryKey: ["sa-sub-claims-pending-count"],
  queryFn: () =>
    fetch("/api/v1/super-admin/subscription-payment-claims/pending-count")
      .then((r) => r.json() as Promise<{ count: number }>),
  staleTime: 30_000,
});
const pendingSubCount = pendingSubClaimsData?.count ?? 0;

// In the nav item render loop, add special case for Billing:
{navItems.map((item) => {
  const isActive = pathname?.includes(item.href);
  const badge = item.href === "/sa/billing" && pendingSubCount > 0 ? pendingSubCount : null;
  return (
    <Link key={item.href} href={item.href} className={cn(...)}>
      <item.icon className="h-4 w-4" />
      <span>{item.label}</span>
      {badge && (
        <span className="ml-auto rounded-full bg-destructive px-2 py-0.5 text-xs text-destructive-foreground">
          {badge}
        </span>
      )}
    </Link>
  );
})}
```

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

1. `SubscriptionPaymentClaim.status` → `VERIFIED`, `verifiedBy`, `verifiedAt` set
2. Creates `SubscriptionPayment` record (existing model) for bookkeeping, linked to claim.
   Use `paymentMode: SubscriptionPaymentMode.UPI` (the `SubscriptionPayment` model uses the `SubscriptionPaymentMode` enum — `CASH | UPI | BANK_TRANSFER | CHEQUE | RAZORPAY | OTHER` — **not** `PaymentMode`).
3. Extends subscription period:
   - `periodStart` and `periodEnd` are **required** on the claim for verification — if the admin did not provide them, the SA verify API must return `{ error: "PERIOD_REQUIRED", message: "Period start and end dates are required to verify a subscription payment" }` (HTTP 400)
   - Update `SocietySubscription.currentPeriodEnd = claim.periodEnd`
   - Create `SocietySubscriptionHistory` entry with `changeType: PAYMENT_RECORDED` (use this existing enum value — `RENEWED` does not exist in `SubscriptionChangeType`)
4. WhatsApp to admin: "Subscription payment of ₹1,799 confirmed for period {periodStart} to {periodEnd}"
5. Email to SA inbox (Resend/SMTP): `societyName`, `amount`, `utrNumber`, `verifiedAt` — internal record only
6. Audit: `SUBSCRIPTION_CLAIM_VERIFIED`

---

## Database Schema

### Enum Update: `PaymentMode`

Add to existing `PaymentMode` enum in `supabase/schema.prisma`:

```prisma
enum PaymentMode {
  CASH
  UPI
  BANK_TRANSFER
  OTHER          // ← keep existing
  UPI_CLAIM      // ← ADD: fee_payment created from admin-verified resident UPI claim
}
```

> **Important**: Current schema has `OTHER` as the 4th value. Do NOT remove it — existing `FeePayment` records may use it. Only ADD `UPI_CLAIM`.

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
// Add to FeePayment model — FK lives here (FeePayment is the child):
paymentClaimId  String?       @map("payment_claim_id") @db.Uuid
paymentClaim    PaymentClaim? @relation(fields: [paymentClaimId], references: [id])
```

> **FK ownership**: The FK is on `FeePayment` (`payment_claim_id` column). `PaymentClaim` holds only a Prisma back-relation `feePayment FeePayment?` — NOT a separate stored `feePaymentId` column. Remove `feePaymentId` from the `PaymentClaim` model — it was specified in error. One FK only.

SQL migration:

```sql
-- payment_claims must be created BEFORE this ALTER (no circular dependency)
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
  admin_notes       TEXT,                              -- internal notes by admin (not shown to resident)
  -- NOTE: No fee_payment_id here. FK lives on fee_payments.payment_claim_id (see below).
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_claims_utr_society ON payment_claims(utr_number, society_id);
CREATE INDEX idx_claims_society_status ON payment_claims(society_id, status);
CREATE INDEX idx_claims_user ON payment_claims(user_id);

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_payment_claims_updated_at
  BEFORE UPDATE ON payment_claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
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

CREATE TRIGGER trg_sub_payment_claims_updated_at
  BEFORE UPDATE ON subscription_payment_claims
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

RLS:

```sql
ALTER TABLE subscription_payment_claims ENABLE ROW LEVEL SECURITY;
-- Admins (authenticated users) can only see their own society's sub claims
CREATE POLICY sub_claim_society_isolation ON subscription_payment_claims
  USING (society_id = (
    SELECT society_id FROM users WHERE auth_user_id = auth.uid()
  ));
-- Service role (used in SA API routes via requireSuperAdmin()) bypasses RLS by default
```

### New Table: `platform_settings`

```sql
CREATE TABLE platform_settings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key   VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_platform_settings_updated_at
  BEFORE UPDATE ON platform_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Supabase Storage Bucket Setup

Create `platform-assets` bucket before first SA QR upload (one-time setup, run in Supabase dashboard or migration):

```sql
-- Run in Supabase SQL editor (not via Prisma — storage API manages this)
INSERT INTO storage.buckets (id, name, public)
VALUES ('platform-assets', 'platform-assets', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: allow public read, restrict writes to authenticated users only
CREATE POLICY "Public read platform assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'platform-assets');

CREATE POLICY "SA-only write platform assets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'platform-assets' AND auth.role() = 'authenticated');
```

**Storage paths**:

- Society QR: `societies/{societyId}/upi-qr.png` in bucket `societies` (already exists for society documents; reuse)
- Platform QR: `platform/upi-qr.png` in bucket `platform-assets` (create above)
- Both stored as **public URLs** (not signed URLs) — no expiry, simpler to cache and display. `upiQrUrl` fields store the Supabase public URL directly (e.g. `https://{project}.supabase.co/storage/v1/object/public/platform-assets/platform/upi-qr.png`).

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
  adminNotes      String?   @map("admin_notes")  // internal notes, not shown to resident
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  society       Society       @relation(fields: [societyId], references: [id])
  user          User          @relation(fields: [userId], references: [id])
  membershipFee MembershipFee @relation(fields: [membershipFeeId], references: [id])
  // Back-relation only — FK lives on FeePayment.paymentClaimId, NOT stored here
  feePayments   FeePayment[]
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

**`upiQrEnabled` logic**: `true` when `society.upiId` is non-null and non-empty. The public config endpoint does NOT check per-society; it only reflects whether the feature is enabled platform-wide (UPI QR: always `true`). The pay page itself must still check if the society has a UPI ID configured and conditionally show the "not configured" notice.

### API Error Response Shape

All API errors use the existing `errorResponse()` from `src/lib/api-helpers.ts`. Shape:

```typescript
// from api-helpers.ts — use these helpers, do NOT hand-roll error responses
errorResponse({ code: string; message: string; status: number; details?: unknown })
// → returns NextResponse.json({ error: { code, message, status, details } }, { status })

// Common helpers already exported:
notFoundError("Claim not found")         // 404
unauthorizedError("Admin auth required") // 401
forbiddenError("No access")              // 403
internalError("Failed to record")        // 500
```

Examples of custom error responses for new endpoints:

```typescript
// 409 Duplicate UTR
return errorResponse({
  code: "UTR_DUPLICATE",
  message: "This UTR has already been used",
  status: 409,
});
// 400 Claim already pending
return errorResponse({
  code: "CLAIM_ALREADY_PENDING",
  message: "You already have a pending claim for this fee",
  status: 400,
});
// 409 Concurrent verify
return errorResponse({
  code: "CLAIM_ALREADY_PROCESSED",
  message: "This claim has already been verified or rejected",
  status: 409,
});
// 400 UPI not configured
return errorResponse({
  code: "UPI_NOT_CONFIGURED",
  message: "Society has not set up UPI payments",
  status: 400,
});
// 400 File too large
return errorResponse({ code: "FILE_TOO_LARGE", message: "File must be under 2MB", status: 400 });
```

### Admin Claims List — Pagination

`GET /api/v1/societies/[id]/payment-claims` supports:

- `?status=PENDING|VERIFIED|REJECTED` (default: all)
- `?page=1&pageSize=20` (default: page 1, 20 per page)
- Response: `{ claims: PaymentClaim[], total: number, page: number, pageSize: number }`

### Resident Endpoint — Society ID Derivation

For `/api/v1/residents/me/payment-claims/*`: use the existing `getCurrentUser("RESIDENT")` helper from `src/lib/get-current-user.ts` — it already handles Supabase auth + society scoping:

```typescript
import { getCurrentUser } from "@/lib/get-current-user";

const resident = await getCurrentUser("RESIDENT");
if (!resident) return unauthorizedError("Resident authentication required");
// resident.userId     — the User.id (uuid)
// resident.societyId — already resolved, scoped to active society cookie
```

### Upload Endpoints — Server-Side File Validation

Both `upload-qr` (admin) and `upload-screenshot` (resident) endpoints must validate:

```typescript
import { errorResponse } from "@/lib/api-helpers";

const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

if (file.size > MAX_FILE_SIZE_BYTES) {
  return errorResponse({ code: "FILE_TOO_LARGE", message: "File must be under 2MB", status: 400 });
}
const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
if (!allowedTypes.includes(file.type)) {
  return errorResponse({
    code: "INVALID_FILE_TYPE",
    message: "Only JPG, PNG, or WebP images allowed",
    status: 400,
  });
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

// Body is empty for verify (no extra fields needed); schema exists for future extensibility
export const verifyClaimSchema = z.object({
  adminNotes: z.string().max(1000).optional(),
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
  // Required — SA needs these to extend the subscription period on verify
  periodStart: z.string().date({ required_error: "Period start date is required" }),
  periodEnd: z
    .string()
    .date({ required_error: "Period end date is required" })
    .refine((d, ctx) => {
      const start = ctx.parent?.periodStart;
      return !start || d > start;
    }, "Period end must be after period start"),
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
// Const enum for type-safe status checks throughout the app
export const ClaimStatus = {
  PENDING: "PENDING",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
} as const;
export type ClaimStatus = (typeof ClaimStatus)[keyof typeof ClaimStatus];

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
  adminNotes: string | null;
  // No feePaymentId here — FK lives on FeePayment. Use feePayments[] join if needed.
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

### `src/services/admin-payment-claims.ts`

```typescript
import type { PaymentClaim } from "@/types/payment";

export async function getAdminPaymentClaims(
  societyId: string,
  params?: { status?: string; page?: number; pageSize?: number },
): Promise<{ claims: PaymentClaim[]; total: number; page: number; pageSize: number }> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
  const res = await fetch(`/api/v1/societies/${societyId}/payment-claims?${qs}`);
  if (!res.ok) throw new Error("Failed to fetch claims");
  return res.json();
}

export async function verifyClaim(
  societyId: string,
  claimId: string,
  adminNotes?: string,
): Promise<{ claim: PaymentClaim }> {
  const res = await fetch(`/api/v1/societies/${societyId}/payment-claims/${claimId}/verify`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adminNotes }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function rejectClaim(
  societyId: string,
  claimId: string,
  rejectionReason: string,
): Promise<{ claim: PaymentClaim }> {
  const res = await fetch(`/api/v1/societies/${societyId}/payment-claims/${claimId}/reject`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rejectionReason }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

### `src/services/subscription-payment-claims.ts`

```typescript
import type { SubscriptionPaymentClaim } from "@/types/payment";

// Admin: fetch active subscription ID before showing the claim form
export async function getActiveSubscription(
  societyId: string,
): Promise<{
  subscriptionId: string;
  planName: string;
  amountDue: number;
  dueDate: string;
} | null> {
  const res = await fetch(`/api/v1/societies/${societyId}/subscription-payment-claims/active`);
  if (!res.ok) return null;
  return res.json();
}

export async function submitSubscriptionClaim(
  societyId: string,
  data: {
    amount: number;
    utrNumber: string;
    paymentDate: string;
    periodStart: string;
    periodEnd: string;
    screenshotUrl?: string;
  },
): Promise<{ claim: SubscriptionPaymentClaim }> {
  const res = await fetch(`/api/v1/societies/${societyId}/subscription-payment-claims`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getMySubscriptionClaims(
  societyId: string,
): Promise<{ claims: SubscriptionPaymentClaim[] }> {
  const res = await fetch(`/api/v1/societies/${societyId}/subscription-payment-claims`);
  if (!res.ok) throw new Error("Failed to fetch sub claims");
  return res.json();
}
```

> **`subscriptionId` derivation**: The admin does not need to pass `subscriptionId` explicitly from the UI — the POST endpoint derives it server-side from `societyId` (fetches the active `SocietySubscription` for the society). The `subscriptionId` prop is removed from `SubscriptionPaymentClaimForm` — the form only needs `societyId` and `amountDue`.

### `src/services/payment-setup.ts`

```typescript
import type { UpiSettings, PlatformUpiSettings } from "@/types/payment";

export async function getPaymentSetup(societyId: string): Promise<UpiSettings> {
  const res = await fetch(`/api/v1/societies/${societyId}/payment-setup`);
  if (!res.ok) throw new Error("Failed to fetch payment setup");
  return res.json() as Promise<UpiSettings>;
}

export async function updateUpiSetup(
  societyId: string,
  data: { upiId: string; upiQrUrl?: string; upiAccountName?: string },
): Promise<UpiSettings> {
  const res = await fetch(`/api/v1/societies/${societyId}/payment-setup/upi`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<UpiSettings>;
}

export async function uploadSocietyQr(societyId: string, file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`/api/v1/societies/${societyId}/payment-setup/upi/upload-qr`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ url: string }>;
}

export async function getPlatformPaymentSetup(): Promise<PlatformUpiSettings> {
  const res = await fetch("/api/v1/super-admin/platform-payment-setup");
  if (!res.ok) throw new Error("Failed to fetch platform payment setup");
  return res.json() as Promise<PlatformUpiSettings>;
}

export async function updatePlatformUpiSetup(data: {
  platformUpiId: string;
  platformUpiQrUrl?: string;
  platformUpiAccountName?: string;
}): Promise<PlatformUpiSettings> {
  const res = await fetch("/api/v1/super-admin/platform-payment-setup/upi", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<PlatformUpiSettings>;
}

export async function uploadPlatformQr(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/v1/super-admin/platform-payment-setup/upload-qr", {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ url: string }>;
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

### Admin Claims Card — Key Details to Show

The `PendingClaimCard` should also display `createdAt` so admin knows urgency:

```
│ Hemant Kumar — Flat 302                        │
│ Claimed: ₹2,000 via UPI  | Date: 04 Apr 2026  │
│ UTR: 425619876543                              │
│ Submitted: 04 Apr 2026 at 14:32  ← NEW        │  -- shows how old the claim is
│ Screenshot: [View]                             │
│ Notes: [add internal note]  ← NEW             │  -- admin internal notes (optional)
```

### Claim Verify — Prisma Transaction (Concurrency Safe)

The verify endpoint MUST use a Prisma `$transaction` to be atomic. **Match the existing payment recording pattern in `src/app/api/v1/societies/[id]/fees/[feeId]/payments/route.ts` exactly.**

```typescript
// src/app/api/v1/societies/[id]/payment-claims/[claimId]/verify/route.ts
import { generateReceiptNo } from "@/lib/fee-calculator"; // existing function — do NOT rewrite
import { getCurrentUser } from "@/lib/get-current-user"; // existing auth helper

// Auth: admin must have FULL_ACCESS
const admin = await getCurrentUser("RWA_ADMIN");
if (!admin) return unauthorizedError("Admin authentication required");

const result = await prisma.$transaction(async (tx) => {
  // 1. Lock-read the claim inside transaction
  const claim = await tx.paymentClaim.findUnique({
    where: { id: claimId },
    include: { society: true, membershipFee: true },
  });
  if (!claim || claim.societyId !== societyId) return notFoundError("Claim not found");
  if (claim.status !== "PENDING") {
    // Return early — cannot throw from inside $transaction without rolling back everything
    return { alreadyProcessed: true };
  }

  // 2. Mark claim verified
  const updated = await tx.paymentClaim.update({
    where: { id: claimId },
    data: { status: "VERIFIED", verifiedBy: admin.userId, verifiedAt: new Date(), adminNotes },
  });

  // 3. Generate receipt number — uses existing function (count-based, not MAX)
  const paymentCount = await tx.feePayment.count({ where: { societyId } });
  const receiptNo = generateReceiptNo(
    claim.society.societyCode,
    new Date().getFullYear(),
    paymentCount + 1,
  );

  // 4. Create FeePayment — note: feeId (not membershipFeeId), recordedBy required, no entryType field
  const feePayment = await tx.feePayment.create({
    data: {
      feeId: claim.membershipFeeId, // ← feeId, NOT membershipFeeId
      userId: claim.userId,
      societyId,
      amount: claim.claimedAmount,
      paymentMode: "UPI_CLAIM",
      referenceNo: claim.utrNumber, // store UTR as referenceNo for bank reconciliation
      receiptNo,
      paymentDate: claim.paymentDate,
      paymentClaimId: claim.id, // FK to claim
      recordedBy: admin.userId, // ← required NOT NULL — must be set
      correctionWindowEnds: new Date(Date.now() + 48 * 60 * 60 * 1000),
    },
  });

  // 5. Recalculate MembershipFee.amountPaid + status
  const newAmountPaid = Number(claim.membershipFee.amountPaid) + Number(claim.claimedAmount);
  const newFeeStatus = newAmountPaid >= Number(claim.membershipFee.amountDue) ? "PAID" : "PARTIAL";
  await tx.membershipFee.update({
    where: { id: claim.membershipFeeId },
    data: { amountPaid: newAmountPaid, status: newFeeStatus },
  });

  // 6. Update user.status to match fee status — same as existing payment flow
  const userStatus = newFeeStatus === "PAID" ? "ACTIVE_PAID" : "ACTIVE_PARTIAL";
  await tx.user.update({
    where: { id: claim.userId },
    data: { status: userStatus },
  });

  return { claim: updated, feePayment, receiptNo, alreadyProcessed: false };
});

// Check for concurrent verification (must handle outside transaction)
if (result.alreadyProcessed) {
  return errorResponse({
    code: "CLAIM_ALREADY_PROCESSED",
    message: "This claim has already been verified or rejected",
    status: 409,
  });
}

// 7. Send WhatsApp + audit log AFTER transaction commits (fire-and-forget)
```

### Receipt Generation Logic

`receiptNo` uses the **existing** `generateReceiptNo` from `src/lib/fee-calculator.ts` — do not rewrite it:

- Signature: `generateReceiptNo(societyCode: string, year: number, sequence: number): string`
- Format: `{societyCode}-{YYYY}-R{seq padded to 4 digits}` — e.g. `EE-2026-R0142`
- Sequence: `feePayment.count({ where: { societyId } }) + 1` (count-based, same as existing payments)
- `receiptUrl`: leave `null` — PDF generation is a future feature

### `src/components/features/settings/PlatformPaymentSetupForm.tsx`

Props: `initialValues: PlatformUpiSettings`

Behaviour:

- React Hook Form + Zod (`platformUpiSchema`)
- Platform UPI ID text input with format hint
- Platform QR image upload: drag-drop or click, preview shown on upload
- Account holder name optional text input
- On save: PATCH `/api/v1/super-admin/platform-payment-setup/upi`

### `src/components/features/subscription/SubscriptionPaymentClaimForm.tsx`

Props: `societyId: string`, `amountDue: number`, `periodStart: string`, `periodEnd: string`, `onSuccess: () => void`

> No `subscriptionId` prop — the POST endpoint derives the active subscription server-side from `societyId`.

Behaviour:

- Dialog/Sheet triggered by "I've paid" button
- Fields: UTR (required), amount (pre-filled from `amountDue`), payment date (today default), period start/end (pre-filled from billing cycle, editable), screenshot (optional)
- On submit: calls `submitSubscriptionClaim()` from `src/services/subscription-payment-claims.ts`
- Shows "Your payment claim has been submitted. SA will verify within 2 business days."

---

## WhatsApp Notifications (WATI)

All notifications use `src/lib/whatsapp.ts` → `sendWhatsApp(mobile, templateName, params)`.

| Event                          | Recipient | Channel        | Template Name                  | Params                                                             |
| ------------------------------ | --------- | -------------- | ------------------------------ | ------------------------------------------------------------------ |
| Resident submits claim         | Admin     | WhatsApp       | `admin_payment_claim_received` | `residentName`, `flatNo`, `amount`, `utrNumber`                    |
| Admin verifies claim           | Resident  | WhatsApp       | `resident_payment_confirmed`   | `amount`, `receiptNo`                                              |
| Admin rejects claim            | Resident  | WhatsApp       | `resident_payment_rejected`    | `amount`, `rejectionReason`                                        |
| Claim pending 24h (reminder)   | Admin     | WhatsApp       | `admin_claim_reminder_24h`     | `pendingCount`                                                     |
| Claim pending 48h (escalation) | Admin     | WhatsApp       | `admin_claim_reminder_48h`     | `pendingCount`                                                     |
| Admin submits sub claim        | SA        | Email (Resend) | —                              | `societyName`, `amount`, `utrNumber`, subject: "Sub Payment Claim" |
| SA verifies sub claim          | Admin     | WhatsApp       | `admin_sub_payment_confirmed`  | `amount`, `periodStart`, `periodEnd`                               |
| SA rejects sub claim           | Admin     | WhatsApp       | `admin_sub_payment_rejected`   | `amount`, `rejectionReason`                                        |

> WATI templates must be created and approved before deployment. Names above are proposed — use exact approved names.
> SA email for sub claim: use `src/lib/email.ts` → `sendEmail({ to: SA_EMAIL, subject: "...", html: "..." })`. `SA_EMAIL` from `process.env.SUPER_ADMIN_NOTIFICATION_EMAIL`.

---

## Cron Job — Claim Reminders

**Route**: `POST /api/cron/payment-claim-reminders`

> **Method**: All cron routes in this project export `async function POST` — match this pattern. Vercel cron jobs can be configured to call any HTTP method via the `method` key in `vercel.json`.

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

1. Verify `CRON_SECRET` using `verifyCronSecret(request)` from `src/lib/cron-auth.ts` (same import as all other cron routes)
2. Find all `PaymentClaim` with `status = PENDING`, `createdAt` between 24h and 48h ago → send `admin_claim_reminder_24h`
3. Find all `PaymentClaim` with `status = PENDING`, `createdAt` > 48h ago → send `admin_claim_reminder_48h`
4. Group by `societyId` → one notification per society (include count)
5. Return `successResponse({ notified24h: N, notified48h: M })`

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

| Page                            | Path                            | Who      | Status | Notes                                                      |
| ------------------------------- | ------------------------------- | -------- | ------ | ---------------------------------------------------------- |
| Payment Setup (UPI)             | `/admin/settings/payment-setup` | Admin    | New    | New sub-page under admin settings                          |
| Pending Claims Dashboard        | `/admin/fees/claims`            | Admin    | New    | New sub-page under `/admin/fees`                           |
| Subscription Settings (extend)  | `/admin/settings/subscription`  | Admin    | Extend | Extend existing page — add "Pay Subscription" section      |
| Pay Fee (QR display)            | `/r/payments/pay`               | Resident | New    | New sub-page under `/r/payments`                           |
| Confirm Payment (UTR form)      | `/r/payments/confirm`           | Resident | New    | New sub-page under `/r/payments`                           |
| Payment History (extend claims) | `/r/payments`                   | Resident | Extend | Extend existing page                                       |
| Platform Payment Setup          | `/sa/settings/payments`         | SA       | New    | New nested page under `/sa/settings` (existing page stays) |
| Subscription Claims (extend)    | `/sa/billing/payments`          | SA       | Extend | Extend existing `/sa/billing/payments` page with new tab   |

---

## Key Files

| File                                                                               | Purpose                                    |
| ---------------------------------------------------------------------------------- | ------------------------------------------ |
| `src/lib/config/payment.ts`                                                        | Feature detection (Razorpay env var flags) |
| `src/lib/validations/payment-claim.ts`                                             | Zod schemas for claims                     |
| `src/lib/validations/payment-setup.ts`                                             | Zod schemas for UPI setup                  |
| `src/types/payment.ts`                                                             | TypeScript interfaces                      |
| `src/services/payment-claims.ts`                                                   | Resident-side claim fetch wrappers         |
| `src/services/admin-payment-claims.ts`                                             | Admin-side claim list/verify/reject        |
| `src/services/subscription-payment-claims.ts`                                      | Admin sub claim submit + list              |
| `src/services/payment-setup.ts`                                                    | Client fetch wrappers for setup            |
| `src/components/features/payments/UpiQrDisplay.tsx`                                | QR + UPI ID display                        |
| `src/components/features/payments/PaymentClaimForm.tsx`                            | UTR entry form                             |
| `src/components/features/payments/PendingClaimCard.tsx`                            | Admin verify/reject card                   |
| `src/components/features/settings/PaymentSetupForm.tsx`                            | Admin UPI setup form                       |
| `src/components/features/settings/PlatformPaymentSetupForm.tsx`                    | SA platform UPI setup form                 |
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

| Test File                                            | Key Scenarios                                                                                                   |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `tests/api/resident-payment-claims.test.ts`          | Submit (valid, duplicate UTR, no QR, already pending), list own claims                                          |
| `tests/api/admin-payment-claims.test.ts`             | List (paginated, filtered), verify (Prisma TX, fee_payment created, concurrency 409), reject (no reason → 400)  |
| `tests/api/payment-setup.test.ts`                    | GET (unauthenticated → 401), PATCH (valid UPI ID, invalid format), upload-qr (file too large → 400)             |
| `tests/api/subscription-payment-claims.test.ts`      | Admin submit, SA verify (creates SubscriptionPayment), SA reject, duplicate UTR                                 |
| `tests/api/platform-payment-setup.test.ts`           | GET/PATCH as SA, as non-SA → 403                                                                                |
| `tests/api/config-payment-features.test.ts`          | Returns correct flags for each env var combination                                                              |
| `tests/api/cron-payment-claim-reminders.test.ts`     | No CRON_SECRET → 401; 24h/48h batches send correct templates                                                    |
| `tests/components/UpiQrDisplay.test.tsx`             | Renders QR image, copy button, null QR placeholder                                                              |
| `tests/components/PaymentClaimForm.test.tsx`         | Validation (UTR regex, future date → error), submit calls service                                               |
| `tests/components/PendingClaimCard.test.tsx`         | Confirm fires onVerify, reject requires reason, loading disables buttons                                        |
| `tests/lib/validations/payment-claim.test.ts`        | All schema branches: UTR regex, date not future, amount positive, `verifyClaimSchema` optional adminNotes       |
| `tests/lib/validations/payment-setup.test.ts`        | UPI ID regex cases, platform UPI schema                                                                         |
| `tests/components/PaymentSetupForm.test.tsx`         | Admin: renders UPI ID + QR upload, saves correctly, shows format error on bad UPI ID                            |
| `tests/components/PlatformPaymentSetupForm.test.tsx` | SA: renders platform UPI fields, uploads platform QR, shows preview                                             |
| `tests/lib/config/payment.test.ts`                   | All env var combinations → correct flags: no env = razorpay disabled; live key → mode "live"; test key → "test" |

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

## `lib/config/payment.ts` — Full Implementation

```typescript
// src/lib/config/payment.ts
// UPI QR flow only. Razorpay flags are false until Razorpay env vars are configured (see online_payment_razorpay.md).

export interface PaymentFeatureConfig {
  upiQrEnabled: boolean;
  razorpayGatewayEnabled: boolean;
  razorpaySubscriptionBillingEnabled: boolean;
  razorpayMode: "test" | "live" | null;
}

export function getPaymentFeatureConfig(): PaymentFeatureConfig {
  const razorpayKeyId = process.env.RAZORPAY_KEY_ID ?? "";
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET ?? "";
  const razorpayEnabled = razorpayKeyId.length > 0 && razorpayKeySecret.length > 0;

  return {
    upiQrEnabled: true, // always true; toggled per-society by whether society.upiId is set
    razorpayGatewayEnabled: razorpayEnabled,
    razorpaySubscriptionBillingEnabled:
      razorpayEnabled && (process.env.RAZORPAY_SUBSCRIPTION_ENABLED ?? "") === "true",
    razorpayMode: razorpayEnabled
      ? razorpayKeyId.startsWith("rzp_live_")
        ? "live"
        : "test"
      : null,
  };
}
```

---

## Implementation Order

### Migration File Naming

SQL migrations go in `supabase/migrations/` following the naming convention:

```
YYYYMMDDHHMMSS_<description>.sql
```

Example: `20260405000001_add_payment_claims.sql`

Single migration file for all schema changes in this plan (to keep migrations atomic).

### Quality Gate Rule

**Every group ends with a mandatory quality gate before moving to the next group:**

```
✅ Tests  — Write tests for every new file in this group. 95%+ coverage (branches, lines, functions, statements).
✅ Lint   — npm run lint — zero errors/warnings.
✅ Build  — npm run build — zero TypeScript errors.
→ Only commit and proceed to the next group after all 3 pass.
```

Do not defer tests to the end. Testing per group means bugs are caught while context is fresh, and each commit leaves the codebase in a stable, releasable state.

---

### Group 1 — Foundation

1. **Schema migration** (`supabase/migrations/20260405000001_add_payment_claims.sql`): Add UPI fields to `societies`; add `payment_claim_id` to `fee_payments`; create `payment_claims`, `subscription_payment_claims`, `platform_settings` tables; add `UPI_CLAIM` to `PaymentMode` enum (keep `OTHER`); add `updated_at` triggers for all 3 new tables; add RLS for `payment_claims` and `subscription_payment_claims`; add Supabase Storage bucket `platform-assets`. Update Prisma schema: add `PaymentClaim`, `SubscriptionPaymentClaim`, `PlatformSetting` models; add relations to `Society`, `FeePayment`, `User`, `MembershipFee`, `SocietySubscription`
2. Run `npm run db:generate`
3. Seed `platform_settings` in `seed-master.ts`
4. `src/lib/config/payment.ts` — full implementation as specified above
5. `src/lib/validations/payment-claim.ts` + `payment-setup.ts` (including `verifyClaimSchema`)
6. `src/types/payment.ts` (including `ClaimStatus` const enum, `adminNotes` field)

**Quality gate:**

- `tests/lib/config/payment.test.ts`
- `tests/lib/validations/payment-claim.test.ts`
- `tests/lib/validations/payment-setup.test.ts`
- `npm run lint` + `npm run build`

---

### Group 2 — Admin UPI Setup

7. Admin payment setup API: `GET /api/v1/societies/[id]/payment-setup`, `PATCH .../upi`, `POST .../upload-qr` (with server-side file size/type validation)
8. `PaymentSetupForm` component + `/admin/settings/payment-setup` page

**Quality gate:**

- `tests/api/payment-setup.test.ts`
- `tests/components/PaymentSetupForm.test.tsx`
- `npm run lint` + `npm run build`

---

### Group 3 — Resident Pay Flow

9. Resident pay fee page (`/r/payments/pay`) + `UpiQrDisplay` component (copy feedback + mobile sizing)
10. Resident confirm page (`/r/payments/confirm`) + `PaymentClaimForm` component + screenshot upload API
11. Resident claim submit + list API (`/residents/me/payment-claims` POST/GET, with `societyId` derivation from session)

**Quality gate:**

- `tests/api/resident-payment-claims.test.ts`
- `tests/components/UpiQrDisplay.test.tsx`
- `tests/components/PaymentClaimForm.test.tsx`
- `npm run lint` + `npm run build`

---

### Group 4 — Admin Claim Verification ← Flow 1 fully functional after this

12. Admin claims list API (paginated, `?status=`, `?page=`) + pending-count API
13. `PendingClaimCard` component (shows `createdAt`, `adminNotes` field) + `/admin/fees/claims` page
14. Admin verify API — Prisma `$transaction` with concurrency guard + receipt number generation
15. Admin reject API
16. Admin sidebar Fees badge (pending-count `useQuery`, inline with existing announcements pattern)

**Quality gate:**

- `tests/api/admin-payment-claims.test.ts`
- `tests/components/PendingClaimCard.test.tsx`
- `npm run lint` + `npm run build`

---

### Group 5 — Subscription Flow

17. Platform UPI setup API (SA): `GET/PATCH /api/v1/super-admin/platform-payment-setup` + `POST .../upload-qr` + `PlatformPaymentSetupForm` component + `/sa/settings/payments` page
18. `SubscriptionPaymentClaimForm` component + admin submit API (`POST /societies/[id]/subscription-payment-claims`) + SA email notification on submit
19. SA subscription claims list/verify/reject APIs (`GET/PATCH /super-admin/subscription-payment-claims`) — including subscription period extension (`currentPeriodEnd` update + `SocietySubscriptionHistory` with `PAYMENT_RECORDED`)
20. SA billing page extension — add "Pending Claims" tab to `/sa/billing/payments`
21. SA sidebar Billing badge (`SuperAdminSidebar.tsx`, inline `useQuery` for pending sub claims count)

**Quality gate:**

- `tests/api/subscription-payment-claims.test.ts`
- `tests/api/platform-payment-setup.test.ts`
- `tests/components/PlatformPaymentSetupForm.test.tsx`
- `npm run lint` + `npm run build`

---

### Group 6 — Resident History

22. Extend `/r/payments` page to show claim status badges (PENDING / VERIFIED / REJECTED) + "Re-submit" button for REJECTED claims

**Quality gate:**

- Extend existing resident payments tests to cover claim status display states
- `npm run lint` + `npm run build`

---

### Group 7 — Notifications & Infra

23. Cron job: `POST /api/cron/payment-claim-reminders` — 24h/48h pending claim reminders grouped by society (add to `vercel.json`)
24. WhatsApp notifications for all 8 events + SA email (Resend) for subscription claim submission
25. Audit logging for all 8 new action types (`src/lib/audit.ts`)

**Quality gate:**

- `tests/api/cron-payment-claim-reminders.test.ts`
- `tests/api/config-payment-features.test.ts`
- `npm run lint` + `npm run build`

---

### Final check before merge

- Full `npm run build` — production build must be clean
- Full `npm run lint` — zero issues across entire codebase
- Confirm overall test coverage ≥ 95% across the full test suite
