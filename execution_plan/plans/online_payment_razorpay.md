# Online Payments — Razorpay Integration (Phase 6B)

> **Scope**: Everything that requires Razorpay — gateway-based resident fee payments (with auto-reconciliation), convenience fee handling, KYC-based society onboarding, Razorpay Route (direct settlement), webhook handler, and Razorpay Subscriptions for platform billing.
>
> **Prerequisite**: Phase 6A (UPI QR flow) must be fully deployed before starting this phase. The UPI QR flow is the primary path; Razorpay is additive.
>
> **Activation**: All Razorpay features are **disabled by default** and only activate when Super Admin configures the required environment variables.

---

## Environment Variables

```env
# ─── Razorpay Gateway (Flow 1: Resident fees via gateway) ───────────
RAZORPAY_KEY_ID=rzp_test_xxxxx              # Test mode key
RAZORPAY_KEY_SECRET=xxxxx                    # Test mode secret
RAZORPAY_WEBHOOK_SECRET=xxxxx                # Webhook HMAC-SHA256 signature key

# ─── Razorpay Live (Production) ─────────────────────────────────────
RAZORPAY_LIVE_KEY_ID=rzp_live_xxxxx          # Live mode key
RAZORPAY_LIVE_KEY_SECRET=xxxxx               # Live mode secret
RAZORPAY_LIVE_WEBHOOK_SECRET=xxxxx           # Live webhook secret

# ─── Razorpay Subscriptions (Flow 2: Platform subscription billing) ─
RAZORPAY_SUBSCRIPTION_KEY_ID=rzp_xxxxx
RAZORPAY_SUBSCRIPTION_KEY_SECRET=xxxxx

# ─── Mode Toggle ────────────────────────────────────────────────────
RAZORPAY_MODE=test                           # "test" or "live"
```

### UI Behavior When Razorpay Is Not Configured

| Location                                       | Behavior                                                        |
| ---------------------------------------------- | --------------------------------------------------------------- |
| Admin → Settings → Payment Setup               | Razorpay section shows "Coming soon" badge with disabled toggle |
| Resident → Pay Fee screen                      | Only shows UPI QR option; no "Pay online" button                |
| Admin → Fee Tracker → Generate Payment Link    | Button disabled with tooltip "Online payments not configured"   |
| Super Admin → Society Detail → Online Payments | Shows "Razorpay not configured — add env variables to enable"   |
| Super Admin → Platform Billing                 | Shows UPI QR only; Razorpay auto-billing shows "Coming soon"    |

**When env vars are absent**: All Razorpay UI sections show "Coming soon" badge. No code paths can call Razorpay APIs. `paymentConfig.razorpayEnabled` is `false`.

---

## Feature Detection (`src/lib/config/payment.ts`)

This file was created in Phase 6A. Phase 6B requires the full object — all fields below:

```typescript
export const paymentConfig = {
  razorpayEnabled: !!(
    process.env.RAZORPAY_KEY_ID &&
    process.env.RAZORPAY_KEY_SECRET &&
    process.env.RAZORPAY_WEBHOOK_SECRET
  ),
  razorpayMode: (process.env.RAZORPAY_MODE ?? "test") as "test" | "live",
  razorpayKeyId:
    process.env.RAZORPAY_MODE === "live"
      ? process.env.RAZORPAY_LIVE_KEY_ID
      : process.env.RAZORPAY_KEY_ID,
  razorpayKeySecret:
    process.env.RAZORPAY_MODE === "live"
      ? process.env.RAZORPAY_LIVE_KEY_SECRET
      : process.env.RAZORPAY_KEY_SECRET,
  razorpayWebhookSecret:
    process.env.RAZORPAY_MODE === "live"
      ? process.env.RAZORPAY_LIVE_WEBHOOK_SECRET
      : process.env.RAZORPAY_WEBHOOK_SECRET,
  subscriptionBillingEnabled: !!(
    process.env.RAZORPAY_SUBSCRIPTION_KEY_ID && process.env.RAZORPAY_SUBSCRIPTION_KEY_SECRET
  ),
};
```

---

## Flow 1 — Resident Fee Payments via Razorpay Gateway

### Architecture: Razorpay Route with Direct Settlement

Resident money **never touches the platform's bank account**. The platform uses Razorpay Route to create a "linked account" for each society. When a resident pays via the gateway, the full fee amount settles directly into the RWA's linked bank account. The platform only handles the convenience fee (if applicable).

```
Platform (Master Razorpay Account)
  ├── Linked Account: Eden Estate RWA    acc_xxxxx → SBI A/C ****1234
  ├── Linked Account: Green Valley RWA   acc_yyyyy → HDFC A/C ****5678
  └── Linked Account: Sunrise Apts RWA  acc_zzzzz → ICICI A/C ****9012

Payment flow:
  Resident pays ₹2,053 (₹2,000 fee + ₹53 convenience fee)
    → Razorpay processes transaction
    → Transfer: ₹2,000 → acc_xxxxx (Eden Estate linked account)
    → Razorpay deducts ₹53 from resident's payment
    → Eden Estate's bank receives ₹2,000 exactly
    → Platform receives: nothing (Razorpay Route, not Split)
```

### Society Onboarding — KYC Flow

```
Admin → Settings → Payment Setup → Online Payments Section
```

**Status machine**:

```
NOT_SETUP → SUBMITTED → KYC_PENDING → KYC_VERIFIED → ACTIVE
                                    ↘ KYC_FAILED
ACTIVE → SUSPENDED (Razorpay compliance issue)
```

| Status         | Meaning                               | Online Payments |
| -------------- | ------------------------------------- | --------------- |
| `NOT_SETUP`    | Admin hasn't submitted bank details   | Disabled        |
| `SUBMITTED`    | Details sent to Razorpay Account API  | Disabled        |
| `KYC_PENDING`  | Razorpay reviewing documents          | Disabled        |
| `KYC_VERIFIED` | Approved — linked account `acc_xxxxx` | Enabled         |
| `KYC_FAILED`   | Rejected — admin must re-submit       | Disabled        |
| `SUSPENDED`    | Compliance suspension by Razorpay     | Disabled        |

### KYC Onboarding UI

```
┌─────────────────────────────────────────────────────┐
│  Online Payments (Razorpay)                          │
│─────────────────────────────────────────────────────│
│  Status: ⚪ Not set up                               │
│                                                      │
│  Business Name *                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │ Eden Estate Residents Welfare Association     │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  Business Type *                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │ Society / Trust                          ▾   │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  PAN *         IFSC Code *                           │
│  ┌──────────┐  ┌──────────────────────────────┐    │
│  │AABCT1234F│  │ HDFC0001234                   │    │
│  └──────────┘  └──────────────────────────────┘    │
│                                                      │
│  Bank Account Number *                               │
│  ┌──────────────────────────────────────────────┐   │
│  │ 123456789012                                  │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  Beneficiary Name *                                  │
│  ┌──────────────────────────────────────────────┐   │
│  │ Eden Estate RWA                               │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  GSTIN (optional)                                    │
│  ┌──────────────────────────────────────────────┐   │
│  │                                               │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  Gateway Fee Handling *                              │
│  (●) Add convenience fee for residents (recommended) │
│  ( ) Society absorbs gateway charges                 │
│                                                      │
│                      [Submit for KYC Verification]   │
│  ℹ Verification takes 2-3 business days.            │
│    UPI QR payments stay available during this time.  │
└─────────────────────────────────────────────────────┘
```

**After KYC_VERIFIED**: Admin sees `razorpayAccountStatus = KYC_VERIFIED | ACTIVE`, can toggle `online_payments_enabled`.

### Resident Checkout — Both Methods Side by Side

When both UPI QR and Razorpay are active for a society:

```
┌──────────────────────────────────┐
│  ← Pay fee                       │
│  Session: 2025-26                │
│  Amount due: ₹2,000              │
│                                  │
│  Choose payment method:          │
│                                  │
│  ┌────────────────────────────┐  │
│  │  📱 Scan UPI QR            │  │
│  │  Free — Pay ₹2,000        │  │
│  │  [Show QR & confirm]       │  │
│  └────────────────────────────┘  │
│                                  │
│  ┌────────────────────────────┐  │
│  │  💳 Pay online             │  │
│  │  UPI / Card / Net Banking  │  │
│  │  ₹2,000 + ₹53 convenience │  │
│  │  Total: ₹2,053             │  │
│  │  [Pay now]                 │  │
│  └────────────────────────────┘  │
│                                  │
│  UPI QR listed first (free).     │
│  Razorpay option shows exact     │
│  convenience fee breakdown.      │
└──────────────────────────────────┘
```

When only Razorpay (no UPI QR configured): Only "Pay online" option shown.
When only UPI QR (Razorpay not enabled): Only QR option shown (existing UPI flow).

### Convenience Fee Calculation

Full computation logic in `src/lib/utils/convenience-fee.ts`:

```
When gateway_fee_mode = CONVENIENCE_FEE:

  fee_amount          = ₹2,000.00
  gateway_rate        = 2.00%    (Razorpay platform fee)
  route_rate          = 0.25%    (Razorpay Route transfer fee)
  total_rate          = 2.25%
  gst_rate            = 18%

  raw_fee             = fee_amount × 2.25% = ₹45.00
  gst_on_fee          = ₹45.00 × 18%      = ₹8.10
  convenience_fee     = ₹45.00 + ₹8.10   = ₹53.10 → round to ₹53

  razorpay_order_amt  = ₹2,000 + ₹53     = ₹2,053
  route_transfer_amt  = ₹2,000 (to RWA's linked account)
  rwa_receives        = ₹2,000 exactly

When gateway_fee_mode = ABSORB:

  razorpay_order_amt  = ₹2,000
  route_transfer_amt  = ₹2,000 (attempted)
  razorpay_deduction  = ₹53 from settlement
  rwa_receives        = ₹1,947
  fee_payment records = ₹2,000 (fee is marked fully PAID)
  rwa_cost            = ₹53 operational expense
```

### Razorpay Charges Reference

| Payment Method          | MDR      | Razorpay Platform Fee | Route Fee | Total on ₹2,000 (before GST) |
| ----------------------- | -------- | --------------------- | --------- | ---------------------------- |
| UPI (bank account)      | 0% (RBI) | 2%                    | 0.25%     | ₹45.00                       |
| UPI (RuPay credit card) | ~1.1–2%  | 2.15%                 | 0.25%     | ₹48.00                       |
| Debit card (domestic)   | Included | 2%                    | 0.25%     | ₹45.00                       |
| Credit card (Visa/MC)   | Included | 2%                    | 0.25%     | ₹45.00                       |
| Net banking             | Included | 2%                    | 0.25%     | ₹45.00                       |
| Amex / Corporate / EMI  | Included | 3%                    | 0.25%     | ₹65.00                       |

Add 18% GST on total fee. Standard UPI/Card: ₹45 + ₹8.10 = **₹53.10** → displayed as ₹53.

### Payment Flow (Full)

```
1. Resident clicks "Pay now" (Razorpay option)
2. Client calls POST /api/v1/payments/create-order
   → Auth: resident session
   → Body: { membershipFeeId, societyId }
   → Server:
       a. Fetch MembershipFee → amountDue
       b. Fetch Society → razorpayAccountId, gatewayFeeMode
       c. Calculate convenience_fee (if CONVENIENCE_FEE mode)
       d. Create Razorpay order:
          {
            amount: (amountDue + convenience_fee) * 100,   // paise
            currency: "INR",
            transfers: [{
              account: society.razorpayAccountId,          // acc_xxxxx
              amount: amountDue * 100,                     // paise
              currency: "INR"
            }]
          }
       e. Store order in DB (pending)
       f. Return { orderId, amount, currency, keyId }

3. Client opens Razorpay checkout (Razorpay.js SDK):
   {
     key: keyId,
     order_id: orderId,
     amount: amount,
     name: "RWA Connect",
     description: "Fee payment — 2025-26",
     prefill: { name, email, contact }
   }

4. Resident completes payment (UPI/Card/NetBanking)

5. Razorpay fires webhook: POST /api/v1/webhooks/razorpay
   → event: payment.captured
   → Server:
       a. Verify HMAC-SHA256 signature (X-Razorpay-Signature header)
       b. Find pending order → membershiFeeId, societyId
       c. Create FeePayment record:
          { paymentMode: ONLINE_GATEWAY, gatewayTransferId, convenienceFee, gatewayTotal }
       d. Update MembershipFee (amountPaid, status)
       e. Send WhatsApp to resident
       f. Audit: RAZORPAY_PAYMENT_RECEIVED
   → Return 200 immediately (Razorpay retries on non-200)

6. Client polls /api/v1/payments/verify or receives real-time update
   → Redirects to /r/payments with "Payment successful" toast
```

---

## Flow 2 — Platform Subscription Billing via Razorpay Subscriptions

### When It Applies

Only when `RAZORPAY_SUBSCRIPTION_KEY_ID` and `RAZORPAY_SUBSCRIPTION_KEY_SECRET` are set. Otherwise, admin uses UPI QR claim flow (Phase 6A).

### How Razorpay Subscriptions Works

```
1. Super Admin creates Razorpay Plans (one per platform plan × billing period)
2. When RWA subscribes, backend creates Razorpay Subscription:
   → Links admin's saved payment method
   → Razorpay auto-charges on each billing cycle
3. Webhook fires on successful charge:
   → System extends subscription period
   → Creates SubscriptionPayment record
   → Sends WhatsApp to admin
```

### SA Settings — Automated Billing Section

```
┌─────────────────────────────────────────────────────┐
│  Automated Billing (Razorpay Subscriptions)          │
│─────────────────────────────────────────────────────│
│  When NOT configured:                                │
│  ┌──────────────────────────────────────────────┐   │
│  │  🔜 Coming Soon                               │   │
│  │  Auto-billing via Razorpay Subscriptions.     │   │
│  │  Use UPI QR above for manual collection.      │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  When configured:                                    │
│  Status: 🟢 Connected  |  Mode: Test               │
│  Plans synced: 6/6                                   │
│  [Sync Plans with Razorpay]  [View Dashboard]        │
└─────────────────────────────────────────────────────┘
```

---

## Plan-Based Feature Matrix

| Feature                           | Basic | Basic+ | Community | Pro | Enterprise AI | Flex | Trial |
| --------------------------------- | ----- | ------ | --------- | --- | ------------- | ---- | ----- |
| Razorpay gateway (auto-reconcile) | ❌    | ❌     | ✅        | ✅  | ✅            | ❌   | ❌    |
| Payment links (shareable)         | ❌    | ❌     | ✅        | ✅  | ✅            | ❌   | ❌    |
| Bulk payment link generation      | ❌    | ❌     | ❌        | ✅  | ✅            | ❌   | ❌    |
| Dynamic QR per payment            | ❌    | ❌     | ❌        | ✅  | ✅            | ❌   | ❌    |
| Convenience fee configuration     | ❌    | ❌     | ✅        | ✅  | ✅            | ❌   | ❌    |
| Reconciliation dashboard          | ❌    | ❌     | ✅        | ✅  | ✅            | ❌   | ❌    |

**Note**: Even when a plan supports Razorpay, it only activates if env vars are set. Without env vars → "Coming soon" on all plans.

---

## Database Schema

### Enum Update: `PaymentMode`

Phase 6A added `UPI_CLAIM`. Phase 6B adds `ONLINE_GATEWAY`:

```prisma
enum PaymentMode {
  CASH
  UPI
  BANK_TRANSFER
  UPI_CLAIM        // Phase 6A
  ONLINE_GATEWAY   // Phase 6B: payment via Razorpay Gateway
}
```

SQL migration:

```sql
ALTER TYPE "PaymentMode" ADD VALUE 'ONLINE_GATEWAY';
```

### New Fields on `societies`

Phase 6B adds Razorpay-specific fields on top of the UPI fields from Phase 6A:

```prisma
// Add to Society model (Razorpay fields):
razorpayAccountId      String?  @map("razorpay_account_id") @db.VarChar(50)
razorpayAccountStatus  String   @default("NOT_SETUP") @map("razorpay_account_status") @db.VarChar(20)
razorpayBankIfsc       String?  @map("razorpay_bank_ifsc") @db.VarChar(11)
razorpayBankLast4      String?  @map("razorpay_bank_last4") @db.VarChar(4)
razorpayBusinessName   String?  @map("razorpay_business_name") @db.VarChar(200)
razorpayPan            String?  @map("razorpay_pan") @db.VarChar(10)
onlinePaymentsEnabled  Boolean  @default(false) @map("online_payments_enabled")
gatewayFeeMode         String   @default("CONVENIENCE_FEE") @map("gateway_fee_mode") @db.VarChar(20)
```

SQL migration:

```sql
ALTER TABLE societies ADD COLUMN razorpay_account_id VARCHAR(50);
ALTER TABLE societies ADD COLUMN razorpay_account_status VARCHAR(20) DEFAULT 'NOT_SETUP';
ALTER TABLE societies ADD COLUMN razorpay_bank_ifsc VARCHAR(11);
ALTER TABLE societies ADD COLUMN razorpay_bank_last4 VARCHAR(4);
ALTER TABLE societies ADD COLUMN razorpay_business_name VARCHAR(200);
ALTER TABLE societies ADD COLUMN razorpay_pan VARCHAR(10);
ALTER TABLE societies ADD COLUMN online_payments_enabled BOOLEAN DEFAULT false;
ALTER TABLE societies ADD COLUMN gateway_fee_mode VARCHAR(20) DEFAULT 'CONVENIENCE_FEE';
```

### New Fields on `fee_payments`

Phase 6A added `payment_claim_id`. Phase 6B adds Razorpay gateway fields:

```prisma
// Add to FeePayment model:
gatewayTransferId  String?  @map("gateway_transfer_id") @db.VarChar(100)
convenienceFee     Decimal? @map("convenience_fee") @db.Decimal(10, 2)
gatewayTotal       Decimal? @map("gateway_total") @db.Decimal(10, 2)
```

SQL migration:

```sql
ALTER TABLE fee_payments ADD COLUMN gateway_transfer_id VARCHAR(100);
ALTER TABLE fee_payments ADD COLUMN convenience_fee DECIMAL(10,2);
ALTER TABLE fee_payments ADD COLUMN gateway_total DECIMAL(10,2);
```

### New Table: `razorpay_orders` (Phase 6B only)

Tracks Razorpay orders between creation and webhook confirmation. Prevents duplicate webhook processing.

```sql
CREATE TABLE razorpay_orders (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razorpay_order_id VARCHAR(50) UNIQUE NOT NULL,
  society_id       UUID NOT NULL REFERENCES societies(id),
  membership_fee_id UUID NOT NULL REFERENCES membership_fees(id),
  user_id          UUID NOT NULL REFERENCES users(id),
  amount_paise     INTEGER NOT NULL,
  fee_amount_paise INTEGER NOT NULL,
  convenience_fee_paise INTEGER NOT NULL DEFAULT 0,
  status           VARCHAR(20) NOT NULL DEFAULT 'CREATED',  -- CREATED / PAID / FAILED / EXPIRED
  razorpay_payment_id VARCHAR(50),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rzp_orders_society ON razorpay_orders(society_id);
CREATE INDEX idx_rzp_orders_status ON razorpay_orders(status);
```

Prisma model:

```prisma
model RazorpayOrder {
  id                   String    @id @default(uuid()) @db.Uuid
  razorpayOrderId      String    @unique @map("razorpay_order_id") @db.VarChar(50)
  societyId            String    @map("society_id") @db.Uuid
  membershipFeeId      String    @map("membership_fee_id") @db.Uuid
  userId               String    @map("user_id") @db.Uuid
  amountPaise          Int       @map("amount_paise")
  feeAmountPaise       Int       @map("fee_amount_paise")
  convenienceFeePaise  Int       @default(0) @map("convenience_fee_paise")
  status               String    @default("CREATED") @db.VarChar(20)
  razorpayPaymentId    String?   @map("razorpay_payment_id") @db.VarChar(50)
  createdAt            DateTime  @default(now()) @map("created_at")
  updatedAt            DateTime  @updatedAt @map("updated_at")

  society       Society       @relation(fields: [societyId], references: [id])
  membershipFee MembershipFee @relation(fields: [membershipFeeId], references: [id])
  user          User          @relation(fields: [userId], references: [id])

  @@map("razorpay_orders")
}
```

### `platform_settings` New Keys (Phase 6B)

Add to `supabase/seed-master.ts`:

```typescript
await prisma.platformSetting.createMany({
  data: [
    { settingKey: "razorpay_gateway_enabled", settingValue: "false" },
    { settingKey: "razorpay_subscription_billing_enabled", settingValue: "false" },
  ],
  skipDuplicates: true,
});
```

---

## API Endpoints

### Razorpay Society Onboarding (Admin)

| Method | Endpoint                                                | Description                      |
| ------ | ------------------------------------------------------- | -------------------------------- |
| POST   | `/api/v1/societies/[id]/payment-setup/razorpay`         | Submit bank details for KYC      |
| GET    | `/api/v1/societies/[id]/payment-setup/razorpay/status`  | Get KYC status + account details |
| PATCH  | `/api/v1/societies/[id]/payment-setup/gateway-fee-mode` | Toggle CONVENIENCE_FEE / ABSORB  |

### Razorpay Gateway — Resident

| Method | Endpoint                        | Auth     | Description                               |
| ------ | ------------------------------- | -------- | ----------------------------------------- |
| POST   | `/api/v1/payments/create-order` | Resident | Create Razorpay order with Route transfer |
| POST   | `/api/v1/payments/verify`       | Resident | Client-side callback verification         |

### Webhooks

| Method | Endpoint                    | Auth        | Description                                           |
| ------ | --------------------------- | ----------- | ----------------------------------------------------- |
| POST   | `/api/v1/webhooks/razorpay` | HMAC verify | Auto-reconciliation: payment.captured, payment.failed |

**Webhook signature verification**:

```typescript
import crypto from "crypto";

function verifyRazorpaySignature(body: string, signature: string, secret: string): boolean {
  const expectedSignature = crypto.createHmac("sha256", secret).update(body).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}
```

**Webhook must return 200 immediately**. Process asynchronously if needed. Razorpay retries for up to 24h on non-200 responses. Use idempotency key (`razorpay_payment_id`) to prevent duplicate processing.

### Reconciliation (Admin)

| Method | Endpoint                             | Description              |
| ------ | ------------------------------------ | ------------------------ |
| GET    | `/api/v1/reconciliation`             | Dashboard data           |
| GET    | `/api/v1/reconciliation/unmatched`   | Payments not yet matched |
| POST   | `/api/v1/reconciliation/[id]/match`  | Manual match to fee      |
| POST   | `/api/v1/reconciliation/[id]/refund` | Initiate refund via API  |

### Razorpay Subscriptions (SA — Platform Billing)

| Method | Endpoint                                                         | Description                            |
| ------ | ---------------------------------------------------------------- | -------------------------------------- |
| POST   | `/api/v1/super-admin/platform-payment-setup/razorpay/sync-plans` | Sync platform plans → Razorpay plans   |
| GET    | `/api/v1/super-admin/platform-payment-setup/razorpay/status`     | Razorpay connection + plan sync status |
| POST   | `/api/v1/webhooks/razorpay/subscription`                         | Subscription billing webhook           |

---

## Validation Schemas (`src/lib/validations/payment-setup.ts` — Phase 6B additions)

```typescript
// Razorpay KYC submission
export const razorpayKycSchema = z.object({
  businessName: z.string().min(3).max(200),
  businessType: z.enum(["SOCIETY", "TRUST", "NGO", "COMPANY", "PARTNERSHIP"]),
  pan: z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format"),
  bankAccount: z
    .string()
    .min(9)
    .max(18)
    .regex(/^[0-9]+$/, "Must be numeric"),
  ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC format"),
  beneficiaryName: z.string().min(3).max(200),
  gstin: z
    .string()
    .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/)
    .optional(),
  gatewayFeeMode: z.enum(["CONVENIENCE_FEE", "ABSORB"]),
});

// Create order
export const createOrderSchema = z.object({
  membershipFeeId: z.string().uuid(),
  societyId: z.string().uuid(),
});
```

---

## TypeScript Types (`src/types/payment.ts` — Phase 6B additions)

```typescript
// Add to existing types/payment.ts:

export type RazorpayAccountStatus =
  | "NOT_SETUP"
  | "SUBMITTED"
  | "KYC_PENDING"
  | "KYC_VERIFIED"
  | "KYC_FAILED"
  | "ACTIVE"
  | "SUSPENDED";

export type GatewayFeeMode = "CONVENIENCE_FEE" | "ABSORB";

export interface RazorpaySettings {
  razorpayAccountId: string | null;
  razorpayAccountStatus: RazorpayAccountStatus;
  razorpayBankLast4: string | null;
  razorpayBankIfsc: string | null;
  razorpayBusinessName: string | null;
  onlinePaymentsEnabled: boolean;
  gatewayFeeMode: GatewayFeeMode;
}

export interface ConvenienceFeeResult {
  feeAmount: number;
  convenienceFee: number;
  total: number;
  gatewayFeeMode: GatewayFeeMode;
}

export interface CreateOrderResponse {
  orderId: string;
  amount: number; // total in paise (fee + convenience fee)
  currency: "INR";
  keyId: string;
}
```

---

## Utility: Convenience Fee (`src/lib/utils/convenience-fee.ts`)

```typescript
// These rates are fixed Razorpay rates — do not make them configurable
const GATEWAY_RATE = 0.02; // 2%
const ROUTE_RATE = 0.0025; // 0.25%
const GST_RATE = 0.18; // 18% on fees

export function calculateConvenienceFee(
  feeAmount: number,
  mode: "CONVENIENCE_FEE" | "ABSORB",
): {
  convenienceFee: number;
  totalAmount: number;
  routeTransferAmount: number;
} {
  if (mode === "ABSORB") {
    return {
      convenienceFee: 0,
      totalAmount: feeAmount,
      routeTransferAmount: feeAmount,
    };
  }

  const rawFee = feeAmount * (GATEWAY_RATE + ROUTE_RATE);
  const gst = rawFee * GST_RATE;
  const convenienceFee = Math.round(rawFee + gst);

  return {
    convenienceFee,
    totalAmount: feeAmount + convenienceFee,
    routeTransferAmount: feeAmount,
  };
}
```

---

## Razorpay SDK Wrapper (`src/services/razorpay.ts`)

```typescript
// Server-side only — do not import in client components
import Razorpay from "razorpay";
import { paymentConfig } from "@/lib/config/payment";

let _instance: Razorpay | null = null;

export function getRazorpayInstance(): Razorpay {
  if (!paymentConfig.razorpayEnabled) {
    throw new Error("Razorpay is not configured");
  }
  if (!_instance) {
    _instance = new Razorpay({
      key_id: paymentConfig.razorpayKeyId!,
      key_secret: paymentConfig.razorpayKeySecret!,
    });
  }
  return _instance;
}

// Create order with Route transfer
export async function createOrderWithRoute(params: {
  amountPaise: number;
  feeAmountPaise: number;
  linkedAccountId: string;
  receiptId: string;
}): Promise<{ id: string; amount: number; currency: string }> {
  const rp = getRazorpayInstance();
  const order = await rp.orders.create({
    amount: params.amountPaise,
    currency: "INR",
    receipt: params.receiptId,
    transfers: [
      {
        account: params.linkedAccountId,
        amount: params.feeAmountPaise,
        currency: "INR",
      },
    ],
  });
  return order as { id: string; amount: number; currency: string };
}

// Create linked account for KYC
export async function createLinkedAccount(params: {
  businessName: string;
  businessType: string;
  pan: string;
  bankAccount: string;
  ifscCode: string;
  beneficiaryName: string;
  gstin?: string;
}): Promise<{ id: string }> {
  const rp = getRazorpayInstance();
  // Razorpay Route Account creation — see Razorpay Route API docs
  const account = await (
    rp as unknown as {
      accounts: { create: (data: Record<string, unknown>) => Promise<{ id: string }> };
    }
  ).accounts.create({
    email: `${params.businessName.replace(/\s+/g, "").toLowerCase()}@razorpay-kyc.com`,
    profile: {
      category: "others",
      subcategory: "residential_hoa",
      addresses: {
        registered: {
          street1: "NA",
          city: "NA",
          state: "NA",
          postal_code: "000000",
          country: "IN",
        },
      },
    },
    legal_info: {
      pan: params.pan,
      gst: params.gstin,
    },
    legal_business_name: params.businessName,
    business_type: params.businessType.toLowerCase(),
    bank_account: {
      name: params.beneficiaryName,
      account_number: params.bankAccount,
      ifsc: params.ifscCode,
    },
  });
  return account;
}
```

---

## Components

### `src/components/features/payments/RazorpayCheckout.tsx`

Props: `orderId: string`, `amount: number`, `keyId: string`, `prefill: { name: string; email?: string; contact?: string }`, `description: string`, `onSuccess: () => void`, `onFailure: (error: string) => void`

Behaviour:

- Loads Razorpay.js SDK via `<Script src="https://checkout.razorpay.com/v1/checkout.js" />`
- On mount, opens Razorpay checkout with the provided order details
- On `payment.success` → calls `POST /api/v1/payments/verify` → calls `onSuccess`
- On `payment.failed` → calls `onFailure` with the error description
- Shows loading spinner while SDK loads

### `src/components/features/payments/PaymentMethodSelector.tsx`

Props: `societyId: string`, `feeId: string`, `amountDue: number`, `upiQrUrl: string | null`, `upiId: string | null`, `razorpayEnabled: boolean`, `convenienceFee: number`

Behaviour:

- When both UPI and Razorpay available: renders two cards side by side
- UPI card: "Free" badge, links to `/r/payments/pay?feeId=`
- Razorpay card: shows convenience fee breakdown, "Pay now" → triggers `RazorpayCheckout`
- When only UPI: renders `UpiQrDisplay` directly (from Phase 6A)
- When only Razorpay: renders Razorpay card only
- When neither: shows "Contact your admin" message

### `src/components/features/settings/GatewayFeeToggle.tsx`

Props: `societyId: string`, `currentMode: "CONVENIENCE_FEE" | "ABSORB"`, `onModeChange: (mode: string) => void`

Behaviour:

- Radio group with two options
- On change: PATCH `/api/v1/societies/[id]/payment-setup/gateway-fee-mode`
- Shows fee breakdown example for the selected mode (`calculateConvenienceFee(2000, mode)`)

### `src/components/features/payments/ReconciliationDashboard.tsx`

Props: `societyId: string`

Behaviour:

- `useQuery` for `GET /api/v1/reconciliation`
- Summary cards: total collected, total settled to RWA, pending transfers, failed payments
- Table of recent Razorpay transactions with match status
- "Unmatch" tab for unmatched entries with manual match UI

---

## WhatsApp Notifications (Phase 6B additions)

| Event                                 | Recipient | Template Name                      | Params                                 |
| ------------------------------------- | --------- | ---------------------------------- | -------------------------------------- |
| Razorpay payment successful           | Resident  | `resident_online_payment_success`  | `amount`, `receiptNo`, `paymentMethod` |
| Razorpay payment failed               | Resident  | `resident_online_payment_failed`   | `amount`, `reason`                     |
| KYC submitted (awaiting verification) | Admin     | `admin_kyc_submitted`              | `businessName`, `estimatedDays: "2-3"` |
| KYC verified (gateway now active)     | Admin     | `admin_kyc_verified`               | `businessName`                         |
| KYC failed (re-submission needed)     | Admin     | `admin_kyc_failed`                 | `reason`                               |
| Razorpay subscription auto-charged    | Admin     | `admin_subscription_auto_charged`  | `amount`, `planName`, `periodEnd`      |
| Razorpay subscription charge failed   | Admin     | `admin_subscription_charge_failed` | `amount`, `reason`                     |

---

## Audit Actions (add to `src/lib/audit.ts` — Phase 6B additions)

```typescript
| "RAZORPAY_KYC_SUBMITTED"
| "RAZORPAY_KYC_STATUS_UPDATED"
| "RAZORPAY_PAYMENT_RECEIVED"
| "RAZORPAY_PAYMENT_FAILED"
| "RAZORPAY_ORDER_CREATED"
| "RAZORPAY_GATEWAY_FEE_MODE_CHANGED"
| "RAZORPAY_SUBSCRIPTION_CHARGED"
| "RAZORPAY_SUBSCRIPTION_CHARGE_FAILED"
```

---

## API Endpoint Implementation Notes

### `POST /api/v1/payments/create-order`

```typescript
// Key steps:
// 1. Auth: resident session → societyId
// 2. Fetch MembershipFee → validate not already PAID
// 3. Fetch Society → validate online_payments_enabled, razorpayAccountStatus === "ACTIVE"
// 4. Check paymentConfig.razorpayEnabled
// 5. Calculate convenience fee
// 6. Create Razorpay order via createOrderWithRoute()
// 7. Insert RazorpayOrder row (status: CREATED)
// 8. Return { orderId, amount, currency, keyId }
```

### `POST /api/v1/webhooks/razorpay`

```typescript
// Key steps:
// 1. Read raw body as text (required for HMAC verification)
// 2. Verify X-Razorpay-Signature header
// 3. Parse event.event → handle "payment.captured" only
// 4. Idempotency check: if RazorpayOrder.status === "PAID" → return 200 (already processed)
// 5. Update RazorpayOrder.status → PAID, razorpayPaymentId set
// 6. Create FeePayment:
//    { paymentMode: ONLINE_GATEWAY, gatewayTransferId, convenienceFee, gatewayTotal }
// 7. Update MembershipFee (amountPaid, status)
// 8. Send WhatsApp to resident
// 9. Audit log
// IMPORTANT: Always return 200. Never throw inside webhook handler.
// Wrap entire body in try/catch — log errors but return 200 anyway.
```

### `POST /api/v1/societies/[id]/payment-setup/razorpay`

```typescript
// Key steps:
// 1. Auth: admin session
// 2. Validate paymentConfig.razorpayEnabled → 503 if not
// 3. Validate razorpayKycSchema
// 4. Call createLinkedAccount() → razorpayAccountId
// 5. Update Society: razorpayAccountId, razorpayAccountStatus: "SUBMITTED",
//    razorpayBankLast4, razorpayBankIfsc, razorpayBusinessName, razorpayPan
// 6. Audit log
// 7. WhatsApp: admin_kyc_submitted
```

---

## UI Pages Summary (Phase 6B — new or extended)

| Page                            | Path                            | Who      | Status |
| ------------------------------- | ------------------------------- | -------- | ------ |
| Payment Setup (extend — KYC)    | `/admin/settings/payment-setup` | Admin    | Extend |
| Reconciliation Dashboard        | `/admin/fees/reconciliation`    | Admin    | New    |
| Pay Fee (extend — both methods) | `/r/payments/pay`               | Resident | Extend |
| SA Platform Billing (extend)    | `/sa/settings/payments`         | SA       | Extend |
| SA Billing — Auto Subscriptions | `/sa/billing/payments`          | SA       | Extend |

---

## Key Files

| File                                                                             | Purpose                                          |
| -------------------------------------------------------------------------------- | ------------------------------------------------ |
| `src/lib/config/payment.ts`                                                      | Full Razorpay feature detection                  |
| `src/lib/utils/convenience-fee.ts`                                               | Fee calculation with Razorpay rate constants     |
| `src/lib/validations/payment-setup.ts`                                           | `razorpayKycSchema`, `createOrderSchema`         |
| `src/types/payment.ts`                                                           | `RazorpaySettings`, `ConvenienceFeeResult`, etc. |
| `src/services/razorpay.ts`                                                       | Razorpay SDK wrapper (server-side)               |
| `src/components/features/payments/RazorpayCheckout.tsx`                          | Razorpay JS checkout component                   |
| `src/components/features/payments/PaymentMethodSelector.tsx`                     | UPI vs Razorpay selector                         |
| `src/components/features/settings/GatewayFeeToggle.tsx`                          | Convenience fee mode toggle                      |
| `src/components/features/payments/ReconciliationDashboard.tsx`                   | Reconciliation UI                                |
| `src/app/api/v1/payments/create-order/route.ts`                                  | Razorpay order creation with Route               |
| `src/app/api/v1/payments/verify/route.ts`                                        | Client-side callback verification                |
| `src/app/api/v1/webhooks/razorpay/route.ts`                                      | HMAC-verified webhook handler                    |
| `src/app/api/v1/societies/[id]/payment-setup/razorpay/route.ts`                  | KYC submission                                   |
| `src/app/api/v1/societies/[id]/payment-setup/razorpay/status/route.ts`           | KYC status poll                                  |
| `src/app/api/v1/societies/[id]/payment-setup/gateway-fee-mode/route.ts`          | Fee mode toggle                                  |
| `src/app/api/v1/reconciliation/route.ts`                                         | Reconciliation dashboard data                    |
| `src/app/api/v1/reconciliation/unmatched/route.ts`                               | Unmatched entries                                |
| `src/app/api/v1/reconciliation/[id]/match/route.ts`                              | Manual match                                     |
| `src/app/api/v1/reconciliation/[id]/refund/route.ts`                             | Refund initiation                                |
| `src/app/api/v1/super-admin/platform-payment-setup/razorpay/sync-plans/route.ts` | Sync plans to Razorpay                           |
| `src/app/api/v1/webhooks/razorpay/subscription/route.ts`                         | Razorpay Subscriptions webhook                   |
| `src/app/admin/fees/reconciliation/page.tsx`                                     | Reconciliation page                              |

---

## Test Coverage Requirements (100% for all new files)

| Test File                                              | Key Scenarios                                                                                                                                                                 |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/api/payments-create-order.test.ts`              | No env vars → 503; fee already PAID → 400; valid → returns orderId; convenience fee calculated correctly for both modes                                                       |
| `tests/api/webhooks-razorpay.test.ts`                  | Invalid signature → 400; valid signature + payment.captured → creates fee_payment; idempotency (already PAID → 200 no duplicate); payment.failed event → updates order status |
| `tests/api/payment-setup-razorpay.test.ts`             | Razorpay not configured → 503; valid KYC data → calls createLinkedAccount; invalid PAN → 400                                                                                  |
| `tests/api/reconciliation.test.ts`                     | Returns dashboard data; unmatched entries; manual match; refund call                                                                                                          |
| `tests/lib/convenience-fee.test.ts`                    | CONVENIENCE_FEE mode: ₹2000 → ₹53; ABSORB mode → ₹0; ₹0 fee → ₹0; rounding                                                                                                    |
| `tests/lib/validations/payment-setup-razorpay.test.ts` | PAN regex (valid/invalid), IFSC regex, GSTIN optional but validated, bankAccount numeric                                                                                      |
| `tests/services/razorpay.test.ts`                      | Not configured → throws; getInstance returns same instance; createOrderWithRoute passes correct paise                                                                         |
| `tests/components/RazorpayCheckout.test.tsx`           | Loads Razorpay script; renders loading state; onSuccess called on success event                                                                                               |
| `tests/components/PaymentMethodSelector.test.tsx`      | Both methods: renders two cards; UPI only: no Razorpay card; neither: shows contact message                                                                                   |
| `tests/components/GatewayFeeToggle.test.tsx`           | Radio selection, shows correct fee preview, calls PATCH on change                                                                                                             |

**API test pattern**: Mock `getRazorpayInstance()` with `vi.hoisted()`. Never call real Razorpay API in tests.
**Webhook tests**: Pass raw body string + compute valid HMAC signature to test both valid/invalid paths.

---

## Implementation Order (Phase 6B)

1. Extend `paymentConfig` in `src/lib/config/payment.ts` with full Razorpay fields (update existing file)
2. Schema migration: add `ONLINE_GATEWAY` to `PaymentMode`; add Razorpay fields to `societies`; add gateway fields to `fee_payments`; create `razorpay_orders` table + Prisma model
3. Run `npm run db:generate`
4. `src/lib/utils/convenience-fee.ts` — fee calculation
5. `src/services/razorpay.ts` — SDK wrapper (server-only)
6. Add `razorpayKycSchema` and `createOrderSchema` to validation file
7. Add Razorpay TypeScript types to `src/types/payment.ts`
8. Admin payment setup — KYC form + status display (extend existing page + API)
9. `GatewayFeeToggle` component + gateway-fee-mode API
10. `POST /api/v1/payments/create-order` API route
11. `RazorpayCheckout.tsx` component
12. `PaymentMethodSelector.tsx` component
13. Extend resident `/r/payments/pay` to show method selector when both options available
14. `POST /api/v1/payments/verify` route (client-side callback)
15. `POST /api/v1/webhooks/razorpay` — HMAC verify + auto-reconcile
16. KYC status poll route (`/payment-setup/razorpay/status`)
17. "Coming soon" UI guards in all pages when `razorpayEnabled = false`
18. Reconciliation dashboard (API + page)
19. Razorpay Subscriptions sync-plans API
20. Razorpay Subscriptions webhook
21. SA billing page extension for auto-subscription status
22. WhatsApp notifications for all Razorpay events
23. Audit logging for all Razorpay actions
24. All tests (100% coverage)
25. `npm run lint` + `npm run build` — zero errors before commit

---

## Tax Implications Summary

| Scenario                                  | GST Liability For Platform | Notes                                                          |
| ----------------------------------------- | -------------------------- | -------------------------------------------------------------- |
| Resident pays ₹2,053 via Razorpay to RWA  | ₹0                         | Razorpay Route: direct settlement to RWA's linked bank account |
| Razorpay fees (₹53 convenience fee)       | N/A                        | Deducted by Razorpay; not platform's revenue                   |
| RWA pays ₹1,799 via Razorpay Subscription | GST on ₹1,799              | Platform's revenue — GST applicable                            |
| Razorpay subscription fee (~2% + 0.99%)   | N/A                        | Platform's cost of doing business; deducted from settlement    |

**Key principle**: Resident fee payments settled via Razorpay Route go directly to the RWA's linked bank account — the platform never holds these funds. Only subscription revenue (Flow 2) is the platform's income and attracts GST.
