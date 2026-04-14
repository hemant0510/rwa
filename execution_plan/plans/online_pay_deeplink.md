# UPI Deep Link (UPI Intent) — Payment Mode Plan

**Module**: Phase 6A — Online Payments (Native UPI)
**Status**: Planning
**Depends on**: Phase 3 (Fee Management — manual payment recording already exists)
**Complements**: `online_payment_plans.md` (Phase 6A UPI QR, Phase 6B Razorpay Route)
**Owner**: Hemant

---

## 1. What This Is

A **zero-fee, gateway-less payment mode** where residents tap "Pay via UPI app" and the browser automatically launches an installed UPI app (Google Pay, PhonePe, Paytm, BHIM, Amazon Pay, etc.) with all payment details pre-filled. The user confirms with their UPI PIN, NPCI settles bank-to-bank directly to the RWA's account, and reconciliation happens via UTR confirmation.

This is the **NPCI-standard UPI Intent / Deep Link** flow defined in the `upi://pay?...` URI scheme. It is distinct from:

- **Razorpay gateway** (Phase 6B) — has webhook-based auto-reconciliation but carries ~2% platform fee
- **Static UPI QR** (Phase 6A sibling) — works on desktop, requires manual camera scan
- **Manual UPI entry** (Phase 3, already built) — admin records payment post-hoc

### Why This Mode Matters

| Aspect                       | Value                                    |
| ---------------------------- | ---------------------------------------- |
| **Cost to RWA**              | Zero (no gateway, no platform fee)       |
| **Cost to resident**         | Zero (UPI is free below ₹1L/txn)         |
| **UX on mobile**             | Best-in-class — 3 taps to complete       |
| **Settlement**               | Direct bank-to-bank via NPCI (T+0)       |
| **GST exposure to platform** | Zero — money never touches our accounts  |
| **Ideal for**                | Any RWA on mobile, any society plan tier |

### Why This Cannot Be Our Only Mode

| Limitation                                                      | Impact                                    | Mitigation                                                        |
| --------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------- |
| `upi://` URIs do not work on desktop browsers                   | Desktop users see broken link             | Feature-detect mobile; show QR fallback on desktop                |
| No webhook — server doesn't know payment succeeded              | Auto-reconciliation impossible            | Resident confirms with UTR; admin verifies against bank statement |
| iOS chooser UX is inconsistent across versions                  | Some iOS users may see "No app available" | Show QR fallback button as secondary option                       |
| Reconciliation depends on resident honesty until admin verifies | Risk of false "paid" claims               | Fee status stays PENDING_VERIFICATION until admin matches UTR     |

---

## 2. The End-to-End Flow

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│   Resident   │   │   Our API    │   │   Browser    │   │   UPI apps   │
│   taps       │──▶│   creates    │──▶│   handles    │──▶│   chooser    │
│   Pay via    │   │   intent     │   │   upi://     │   │   opens      │
│   UPI app    │   │   record     │   │   scheme     │   │  (Android)   │
└──────────────┘   └──────────────┘   └──────────────┘   └──────────────┘
                                                                 │
                                                                 ▼
                                                         ┌──────────────┐
                                                         │   User       │
                                                         │   confirms   │
                                                         │   in UPI app │
                                                         │   (PIN)      │
                                                         └──────────────┘
                                                                 │
                                                                 ▼
                                                         ┌──────────────┐
                                                         │   NPCI       │
                                                         │   settles    │
                                                         │   bank→bank  │
                                                         └──────────────┘
                                                                 │
                                                                 ▼
                                                         ┌──────────────┐
                                                         │   Credit to  │
                                                         │   RWA bank   │
                                                         │   account    │
                                                         │   (UTR gen)  │
                                                         └──────────────┘
                                                                 │
                        ┌────────────────────────────────────────┤
                        ▼                                        ▼
                 ┌──────────────┐                       ┌──────────────┐
                 │   Resident   │                       │   Admin      │
                 │   returns,   │                       │   reconciles │
                 │   pastes UTR │◀──────────────────────│   UTR vs     │
                 │   + screenshot│   Admin sees pending │   bank stmt  │
                 └──────────────┘                       └──────────────┘
                        │                                        │
                        └────────────────────┬───────────────────┘
                                             ▼
                                      ┌──────────────┐
                                      │  Fee marked  │
                                      │     PAID     │
                                      │  Receipt PDF │
                                      │  WhatsApp    │
                                      └──────────────┘
```

**Key insight**: the flow has **two asynchronous completion points**:

1. NPCI settlement completes in ~5 seconds (bank credit confirmed)
2. Our system learns about it only when resident confirms UTR OR admin reconciles with bank statement

The fee stays in a new `PENDING_VERIFICATION` state during this gap.

---

## 3. The UPI URI Specification

### Canonical Format

```
upi://pay
  ?pa=<payee-vpa>
  &pn=<payee-name>
  &am=<amount>
  &cu=INR
  &tn=<transaction-note>
  &tr=<transaction-ref-id>
```

### Parameters

| Param | Required           | Description                         | Example                  |
| ----- | ------------------ | ----------------------------------- | ------------------------ |
| `pa`  | **Yes**            | Payee VPA (virtual payment address) | `edenestate@hdfc`        |
| `pn`  | **Yes**            | Payee name (URL-encoded)            | `Eden%20Estate%20RWA`    |
| `am`  | **Yes** for intent | Amount (2-decimal string)           | `12000.00`               |
| `cu`  | No (default INR)   | Currency code                       | `INR`                    |
| `tn`  | Recommended        | Transaction note/purpose            | `Annual%20Fee%202025-26` |
| `tr`  | **Critical**       | Our unique reference ID             | `RWA-EDN-2025-0042`      |

### The `tr` Parameter Is Everything

The `tr` (transaction reference) is the **only thread tying a real-world bank credit back to our system**. It travels through:

1. Our intent URI generation
2. The UPI app's payment screen
3. The NPCI settlement message
4. The RWA's bank statement narration

A disciplined `tr` format enables fast admin reconciliation. Use:

```
RWA-<SOCIETY_CODE>-<YYYY>-<SEQ>
e.g. RWA-EDNEST-2025-0042
```

Keep it under 35 characters (UPI spec limit) and uppercase alphanumeric with hyphens only.

### Security Note

The URI is generated server-side and signed. The signature is an HMAC of `(feeId, amount, tr)` that the client sends back during UTR confirmation to prove the intent was genuinely issued by us — this prevents residents from fabricating UTRs for intents that were never created.

---

## 4. Database Schema Changes

### 4.1 Extend `PaymentMode` Enum

```prisma
enum PaymentMode {
  CASH
  UPI                // existing — used for manual UPI entries by admin
  UPI_INTENT         // NEW — deep-link flow (mobile native)
  UPI_QR             // NEW — static QR scan flow
  BANK_TRANSFER
  ONLINE             // existing — reserved for Razorpay gateway (Phase 6B)
  OTHER
}
```

Migration: `npx prisma migrate dev --name add_upi_intent_payment_mode`

### 4.2 New `FeeStatus` Value

```prisma
enum FeeStatus {
  NOT_YET_DUE
  PENDING
  PENDING_VERIFICATION    // NEW — resident claims paid, awaiting admin match
  OVERDUE
  PARTIAL
  PAID
  EXEMPTED
}
```

`PENDING_VERIFICATION` sits between `PENDING` and `PAID`. It's shown to:

- Resident as "Payment submitted, awaiting confirmation"
- Admin as a queue item requiring action

### 4.3 New Model — `UpiIntentRequest`

```prisma
/// Tracks each UPI intent URI we generate, its lifecycle, and UTR confirmation.
model UpiIntentRequest {
  id              String              @id @default(uuid()) @db.Uuid
  societyId       String              @map("society_id") @db.Uuid
  userId          String              @map("user_id") @db.Uuid
  feeId           String              @map("fee_id") @db.Uuid

  // Intent details
  transactionRef  String              @unique @map("transaction_ref") @db.VarChar(40)
  amount          Decimal             @db.Decimal(10, 2)
  payeeVpa        String              @map("payee_vpa") @db.VarChar(100)
  payeeName       String              @map("payee_name") @db.VarChar(200)
  note            String?             @db.VarChar(200)
  signature       String              @db.VarChar(128)  // HMAC for anti-forgery

  // Lifecycle
  status          UpiIntentStatus     @default(GENERATED)
  generatedAt     DateTime            @default(now()) @map("generated_at")
  launchedAt      DateTime?           @map("launched_at")       // user clicked the link
  claimedAt       DateTime?           @map("claimed_at")        // resident submitted UTR
  verifiedAt      DateTime?           @map("verified_at")       // admin matched UTR
  expiredAt       DateTime?           @map("expired_at")

  // Resident-provided proof
  claimedUtr      String?             @map("claimed_utr") @db.VarChar(50)
  claimedAppName  String?             @map("claimed_app_name") @db.VarChar(50)  // "Google Pay", "PhonePe"
  screenshotUrl   String?             @map("screenshot_url") @db.VarChar(500)   // Supabase Storage

  // Admin verification
  verifiedBy      String?             @map("verified_by") @db.Uuid
  bankTxnId       String?             @map("bank_txn_id") @db.VarChar(50)       // from bank statement
  rejectionReason String?             @map("rejection_reason") @db.Text

  // Link to final payment
  feePaymentId    String?             @unique @map("fee_payment_id") @db.Uuid

  createdAt       DateTime            @default(now()) @map("created_at")
  updatedAt       DateTime            @updatedAt @map("updated_at")

  society         Society             @relation(fields: [societyId], references: [id])
  user            User                @relation(fields: [userId], references: [id])
  fee             MembershipFee       @relation(fields: [feeId], references: [id])
  verifier        User?               @relation("UpiIntentVerifier", fields: [verifiedBy], references: [id])
  feePayment      FeePayment?         @relation(fields: [feePaymentId], references: [id])

  @@index([societyId, status])
  @@index([userId, status])
  @@index([transactionRef])
  @@map("upi_intent_requests")
}

enum UpiIntentStatus {
  GENERATED           // URI created, link shown to user
  LAUNCHED            // user tapped the link (browser handed to UPI app)
  CLAIMED             // resident came back and submitted UTR
  VERIFIED            // admin matched UTR against bank statement → creates FeePayment
  REJECTED            // admin couldn't verify (fake UTR, amount mismatch)
  EXPIRED             // 24h passed with no claim
}
```

### 4.4 Society Configuration

Add to `Society` model:

```prisma
model Society {
  // ... existing fields

  // UPI Intent configuration (Phase 6A)
  upiIntentEnabled     Boolean   @default(false) @map("upi_intent_enabled")
  upiVpa               String?   @map("upi_vpa") @db.VarChar(100)
  upiPayeeName         String?   @map("upi_payee_name") @db.VarChar(200)
  upiIntentConfiguredAt DateTime? @map("upi_intent_configured_at")
}
```

Admin configures this once during society setup. Until configured, the "Pay via UPI app" button stays disabled with a tooltip prompting admin to set up UPI.

---

## 5. API Endpoints

### 5.1 Generate Intent

```
POST /api/v1/payments/upi-intent/generate

Headers: Authorization: Bearer <resident-jwt>
Body: {
  feeId: string (uuid)
}

Response 200: {
  intentId: string (uuid),
  uri: string,                    // "upi://pay?pa=...&tr=..."
  transactionRef: string,         // "RWA-EDNEST-2025-0042"
  amount: number,
  payeeVpa: string,
  payeeName: string,
  expiresAt: string (ISO),        // 24h from generation
  supported: {
    mobile: boolean,              // device detection result
    recommendedFallback: "QR" | "RAZORPAY" | null
  }
}

Response 409: Fee already paid or in verification
Response 403: Society hasn't configured UPI Intent
```

**Server-side logic:**

1. Validate resident owns this `feeId`
2. Validate fee is in `PENDING` or `OVERDUE` status (not already paid)
3. Validate society has `upiIntentEnabled = true` and `upiVpa` set
4. Check for existing active intent for this fee — if `GENERATED` or `LAUNCHED` within last 30 min, return that one (idempotent)
5. Generate `transactionRef` via a sequence per society
6. Build URI with URL-encoded params
7. Compute HMAC signature: `HMAC-SHA256(secret, feeId + amount + transactionRef)`
8. Insert `UpiIntentRequest` with status `GENERATED`
9. Return URI + metadata

### 5.2 Mark as Launched (Optional Beacon)

```
POST /api/v1/payments/upi-intent/:intentId/launched

Body: { appDetected?: string }    // optional hint from user agent

Response 200: { ok: true }
```

Fires when user actually taps the `<a href="upi://...">`. Purely for analytics and timeout tracking — not required for flow to work. Browser may not fire this reliably since clicking the link navigates away from our page.

### 5.3 Submit UTR (Resident Claim)

```
POST /api/v1/payments/upi-intent/:intentId/claim

Body: {
  utr: string (min 12, max 22 chars),
  appName?: string,               // "Google Pay", "PhonePe", etc.
  screenshotBase64?: string       // optional, stored in Supabase Storage
}

Response 200: { status: "CLAIMED", verificationEta: "Usually within 24 hours" }
Response 404: Intent not found or expired
Response 409: Already claimed
```

**Server-side logic:**

1. Validate intent exists, belongs to this resident, not expired
2. Validate UTR format (alphanumeric, 12–22 chars)
3. If screenshot provided, upload to Supabase Storage at `upi-proofs/<societyId>/<intentId>.jpg`
4. Update `UpiIntentRequest` — status `CLAIMED`, set `claimedUtr`, `claimedAt`, `claimedAppName`
5. Update `MembershipFee.status` to `PENDING_VERIFICATION`
6. Notify admin via WhatsApp: "Hemant Kumar submitted payment of ₹12,000 — UTR 241008123456. Please verify."

### 5.4 Admin Reconciliation — List Pending

```
GET /api/v1/admin/upi-intent/pending
Query: ?societyId=<uuid>&page=1&limit=20

Response 200: {
  items: [
    {
      intentId, resident: { id, name, unit },
      amount, transactionRef, claimedUtr, claimedAppName,
      screenshotUrl, claimedAt, generatedAt
    }
  ],
  total, page, limit
}
```

### 5.5 Admin Reconciliation — Verify

```
POST /api/v1/admin/upi-intent/:intentId/verify

Body: {
  bankTxnId: string,              // admin types this from bank statement
  notes?: string
}

Response 200: { feePaymentId: string, receiptNumber: string }
```

**Server-side logic:**

1. Validate intent is in `CLAIMED` status
2. Create `FeePayment` record (mode `UPI_INTENT`, ref = `claimedUtr`, bank ref = `bankTxnId`)
3. Update `MembershipFee` — amount_paid, status → `PAID` or `PARTIAL`
4. Generate receipt PDF
5. Update `UpiIntentRequest` — status `VERIFIED`, link to `feePayment`, set `verifiedBy`, `verifiedAt`
6. Send WhatsApp notification + receipt to resident
7. Audit log the verification

### 5.6 Admin Reconciliation — Reject

```
POST /api/v1/admin/upi-intent/:intentId/reject

Body: { reason: string (min 20 chars) }

Response 200: { ok: true }
```

Resets `MembershipFee.status` back to `PENDING`/`OVERDUE`. Resident receives WhatsApp: "Your payment claim for ₹12,000 could not be verified. Reason: <reason>. Please try again or contact admin."

### 5.7 Expiry Cron

Runs hourly:

```
UPDATE upi_intent_requests
SET status = 'EXPIRED', expired_at = NOW()
WHERE status IN ('GENERATED', 'LAUNCHED')
  AND generated_at < NOW() - INTERVAL '24 hours';
```

---

## 6. UI Screens

### 6.1 Resident — Choose Payment Mode

```
┌────────────────────────────────────────────────┐
│  ←  Pay fee                                    │
├────────────────────────────────────────────────┤
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │ Session          2025-26                 │ │
│  │ Amount due       ₹12,000                 │ │
│  │ Payable to       Eden Estate RWA         │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  CHOOSE HOW TO PAY                             │
│                                                │
│  ╔══════════════════════════════════════════╗ │
│  ║ 📱  Pay via UPI app      [ZERO FEE]  ›   ║ │
│  ║     Opens GPay, PhonePe, Paytm          ║ │
│  ╚══════════════════════════════════════════╝ │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │ ▣  Scan QR code                     ›   │ │
│  │    Static QR, no gateway                │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │ 💳  Card, net banking, wallet       ›   │ │
│  │    Razorpay · small fee applies         │ │
│  └──────────────────────────────────────────┘ │
│                                                │
└────────────────────────────────────────────────┘
```

- "Pay via UPI app" is the **recommended default** (outlined with primary border + "ZERO FEE" badge)
- On desktop, this option is dimmed with a caption: "Open on your phone, or scan QR instead"
- Card option explicitly mentions "small fee applies" to set expectations

### 6.2 UPI App Chooser (System-Rendered)

```
┌────────────────────────────────────────────────┐
│  Complete action using                     ✕   │
├────────────────────────────────────────────────┤
│  Android shows this sheet automatically when  │
│  the upi:// link is triggered                 │
│                                                │
│   ┌────┐   ┌────┐   ┌────┐   ┌────┐           │
│   │ G  │   │ Pe │   │ Pt │   │ Bh │           │
│   └────┘   └────┘   └────┘   └────┘           │
│   GPay    PhonePe   Paytm    BHIM              │
│                                                │
│   ┌────┐   ┌────┐   ┌────┐   ┌────┐           │
│   │Am  │   │Cr  │   │Ic  │   │HD  │           │
│   └────┘   └────┘   └────┘   └────┘           │
│   Amazon   CRED    iMobile  HDFC Pay           │
│                                                │
│  ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐   │
│    IF ON DESKTOP BROWSER                      │
│    Fallback to QR scan                        │
│    (upi:// only works on mobile)              │
│  └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘   │
└────────────────────────────────────────────────┘
```

This screen is **not rendered by us** — it's the native Android/iOS app-picker. We only show a fallback card if the link fails to resolve (detected via blur/visibility timeout).

### 6.3 Post-Payment — Submit UTR

After user returns from UPI app, our "Pay Fee" screen updates to prompt UTR entry:

```
┌────────────────────────────────────────────────┐
│  ←  Confirm your payment                       │
├────────────────────────────────────────────────┤
│                                                │
│  ✓ Payment app opened                          │
│                                                │
│  Did you complete the payment? Please enter    │
│  the UPI reference (UTR) from your app to      │
│  help us confirm.                              │
│                                                │
│  UPI reference / UTR *                         │
│  ┌──────────────────────────────────────────┐ │
│  │ 241008123456                             │ │
│  └──────────────────────────────────────────┘ │
│  Usually 12 digits, shown as "UPI Ref No"     │
│                                                │
│  Screenshot (optional, recommended)            │
│  ┌──────────────────────────────────────────┐ │
│  │  📎 Upload success screenshot            │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  ℹ Your fee will show as "Verification        │
│    pending" until admin confirms (usually     │
│    within 24 hours).                          │
│                                                │
│  [ Cancel ]             [ Submit confirmation ]│
│                                                │
└────────────────────────────────────────────────┘
```

### 6.4 Admin — Reconciliation Queue

```
┌────────────────────────────────────────────────────────────────┐
│  UPI Payment Verification                                       │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [ 3 Pending ] [ 0 Claimed today ] [ 145 Verified this month ] │
│                                                                 │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │ Resident       Amount    UTR              Claimed    [ ] │ │
│  │───────────────────────────────────────────────────────── │ │
│  │ Hemant Kumar   ₹12,000   241008123456     2h ago    [›] │ │
│  │   Flat 302 · Annual Fee 2025-26 · GPay                  │ │
│  │                                                          │ │
│  │ Priya Sharma   ₹12,000   241008789012     4h ago    [›] │ │
│  │   Flat 104 · Annual Fee 2025-26 · PhonePe               │ │
│  │                                                          │ │
│  │ Rajesh Patel   ₹6,000    241008445566     1d ago    [›] │ │
│  │   Flat 205 · Annual Fee 2025-26 · Paytm                 │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

Click a row → drawer opens with resident info, claimed UTR, screenshot (if provided), original transaction ref, and two buttons: **[Verify & Mark Paid]** and **[Reject]**.

---

## 7. React Component — `<UpiIntentButton>`

Single-responsibility component for the resident portal.

```tsx
// src/components/features/payments/UpiIntentButton.tsx
"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Smartphone, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/useIsMobile";
import { generateUpiIntent } from "@/services/payments";
import type { UpiIntentResponse } from "@/types/payments";

interface UpiIntentButtonProps {
  feeId: string;
  amount: number;
  onIntentGenerated: (intent: UpiIntentResponse) => void;
  disabled?: boolean;
}

export function UpiIntentButton({
  feeId,
  amount,
  onIntentGenerated,
  disabled,
}: UpiIntentButtonProps) {
  const isMobile = useIsMobile();
  const [launchAttempted, setLaunchAttempted] = useState(false);

  const generateMutation = useMutation({
    mutationFn: () => generateUpiIntent(feeId),
    onSuccess: (intent) => {
      onIntentGenerated(intent);
      if (isMobile) {
        // Direct window.location works better than <a> for upi:// on mobile
        setLaunchAttempted(true);
        window.location.href = intent.uri;

        // After 2s, if user is still here, show UTR entry screen
        setTimeout(() => {
          void fetch(`/api/v1/payments/upi-intent/${intent.intentId}/launched`, {
            method: "POST",
          });
        }, 2_000);
      }
    },
  });

  if (!isMobile) {
    return (
      <div className="border-border text-muted-foreground rounded-md border p-4 text-sm">
        UPI apps only work on mobile. Open this page on your phone, or scan the QR code below.
      </div>
    );
  }

  return (
    <Button
      size="lg"
      className="w-full"
      onClick={() => generateMutation.mutate()}
      disabled={disabled || generateMutation.isPending}
    >
      <Smartphone className="mr-2 h-4 w-4" />
      {generateMutation.isPending
        ? "Opening UPI app..."
        : launchAttempted
          ? "Reopen UPI app"
          : `Pay ₹${amount.toLocaleString("en-IN")} via UPI app`}
      <ExternalLink className="ml-2 h-3 w-3 opacity-60" />
    </Button>
  );
}
```

### Mobile Detection Hook

```tsx
// src/hooks/useIsMobile.ts
"use client";

import { useEffect, useState } from "react";

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    const isMobileUA = /mobile|android|iphone|ipod|blackberry|iemobile|opera mini/.test(ua);
    const isSmallScreen = window.innerWidth < 768;
    setIsMobile(isMobileUA || isSmallScreen);
  }, []);

  return isMobile;
}
```

### Service Layer

```tsx
// src/services/payments.ts
import type { UpiIntentResponse, UpiClaimRequest } from "@/types/payments";

export async function generateUpiIntent(feeId: string): Promise<UpiIntentResponse> {
  const res = await fetch("/api/v1/payments/upi-intent/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ feeId }),
  });
  if (!res.ok) throw new Error("Failed to generate UPI intent");
  return res.json();
}

export async function claimUpiIntent(intentId: string, body: UpiClaimRequest): Promise<void> {
  const res = await fetch(`/api/v1/payments/upi-intent/${intentId}/claim`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Failed to submit UTR");
}
```

---

## 8. Server-Side URI Builder

```ts
// src/lib/payments/upi-uri-builder.ts
import crypto from "crypto";

interface BuildUpiIntentParams {
  payeeVpa: string;
  payeeName: string;
  amount: number;
  transactionRef: string;
  note: string;
}

export function buildUpiIntentUri(params: BuildUpiIntentParams): string {
  const { payeeVpa, payeeName, amount, transactionRef, note } = params;

  const query = new URLSearchParams({
    pa: payeeVpa,
    pn: payeeName,
    am: amount.toFixed(2),
    cu: "INR",
    tn: note,
    tr: transactionRef,
  });

  return `upi://pay?${query.toString()}`;
}

export function signIntent(feeId: string, amount: number, transactionRef: string): string {
  const secret = process.env.UPI_INTENT_SECRET;
  if (!secret) throw new Error("UPI_INTENT_SECRET not configured");

  return crypto
    .createHmac("sha256", secret)
    .update(`${feeId}:${amount.toFixed(2)}:${transactionRef}`)
    .digest("hex");
}

export function verifySignature(
  feeId: string,
  amount: number,
  transactionRef: string,
  signature: string,
): boolean {
  const expected = signIntent(feeId, amount, transactionRef);
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function generateTransactionRef(societyCode: string, sequence: number): string {
  const year = new Date().getFullYear();
  const padded = sequence.toString().padStart(4, "0");
  return `RWA-${societyCode.toUpperCase()}-${year}-${padded}`;
}
```

---

## 9. Environment Variables

Add to `.env.example`:

```bash
# UPI Intent payment mode (Phase 6A)
UPI_INTENT_ENABLED=true
UPI_INTENT_SECRET=<32-char-random-string>     # For HMAC signatures
UPI_INTENT_EXPIRY_HOURS=24
```

Feature gating: if `UPI_INTENT_ENABLED=false`, the "Pay via UPI app" option is hidden from all users entirely (useful for staging or for societies that haven't opted in).

---

## 10. WhatsApp Notification Templates

Three new templates to register with Meta (via WATI/Interakt):

### 10.1 Admin — New UTR Submitted

```
{{admin_name}}, a payment claim needs your verification.

Resident: {{resident_name}} ({{unit}})
Amount: ₹{{amount}}
UTR: {{utr}}
App used: {{app_name}}

Please verify against your bank statement and confirm in RWA Connect.
→ {{verification_link}}
```

### 10.2 Resident — Claim Received

```
Thanks {{resident_name}}!

Your payment of ₹{{amount}} (UTR: {{utr}}) has been recorded and is awaiting admin verification.

You'll receive a receipt via WhatsApp once confirmed — usually within 24 hours.
```

### 10.3 Resident — Claim Verified (after admin approves)

```
✓ Payment confirmed!

Amount: ₹{{amount}}
Receipt: {{receipt_number}}
Session: {{session_year}}

Thank you for your timely payment. Download receipt: {{receipt_url}}
```

### 10.4 Resident — Claim Rejected

```
Hi {{resident_name}},

We couldn't verify your payment claim for ₹{{amount}} (UTR: {{utr}}).

Reason: {{rejection_reason}}

Please contact your RWA admin or try the payment again.
```

---

## 11. Acceptance Criteria

### Resident flow

- [ ] Resident on mobile sees "Pay via UPI app" as primary option on fee page
- [ ] Resident on desktop sees same option dimmed with clear "open on mobile" message
- [ ] Tapping the button generates URI and launches the OS UPI app chooser
- [ ] After returning, UTR entry form appears
- [ ] Submitting UTR updates fee to `PENDING_VERIFICATION`
- [ ] Resident sees correct status on dashboard
- [ ] Screenshot upload is optional and works up to 5MB

### Admin flow

- [ ] Admin sees a Pending Verification count on dashboard
- [ ] Admin reconciliation page lists all pending claims sorted by oldest first
- [ ] Clicking a claim shows resident details, UTR, screenshot, transaction ref
- [ ] Verify action creates `FeePayment`, updates fee status to `PAID`, generates receipt
- [ ] Reject action requires minimum 20-char reason, resets fee to `PENDING`
- [ ] Both actions trigger correct WhatsApp notifications

### System

- [ ] Idempotency: generating intent twice for same fee returns existing active intent
- [ ] HMAC signature prevents claim forgery
- [ ] 24h expiry cron correctly marks stale intents
- [ ] Transaction ref is unique per society per year
- [ ] Feature flag `UPI_INTENT_ENABLED` fully hides feature when off
- [ ] Society-level `upiIntentEnabled` gates per-society access
- [ ] All state transitions audit-logged

### Edge cases

- [ ] Resident submits wrong UTR → admin rejects → resident can resubmit
- [ ] Resident claims but admin never verifies → auto-reminder after 48h
- [ ] Amount mismatch between claim and bank statement → admin can adjust on verify (PARTIAL status)
- [ ] Duplicate UTR across two intents → admin sees warning in verify UI
- [ ] Society changes VPA mid-cycle → existing unclaimed intents remain valid (URI already has old VPA)

---

## 12. Build Sequence

| Step | Deliverable                                              | Depends on       |
| ---- | -------------------------------------------------------- | ---------------- |
| 1    | DB migration — enum additions + `UpiIntentRequest` model | Schema finalized |
| 2    | Society setup — VPA + payee name form in admin settings  | Migration        |
| 3    | URI builder + HMAC signing library                       | Env vars         |
| 4    | `POST /generate` + `POST /claim` API routes              | Builder          |
| 5    | `<UpiIntentButton>` + `useIsMobile` hook                 | API              |
| 6    | UTR entry screen + claim submission flow                 | Button           |
| 7    | Admin reconciliation page + verify/reject APIs           | Claim flow       |
| 8    | WhatsApp template registration + trigger hooks           | Phase 5 infra    |
| 9    | 24h expiry cron                                          | Vercel cron      |
| 10   | E2E test — full happy path on Android device             | All              |

**Estimated build time**: 5–7 days for one developer, assuming Phase 3 (manual payments) and Phase 5 (WhatsApp) are already shipped.

---

## 13. Open Questions

1. **Should we offer admin-side bulk UTR import?** — Some admins download their bank statement as CSV. We could accept a CSV upload that auto-matches UTRs against pending claims. Low priority for v1.

2. **Auto-verify if UTR format matches a specific bank API?** — SBI and HDFC offer paid APIs to verify UTR authenticity. Premium tier feature for Phase 6B+.

3. **Two-hop intent — send resident a WhatsApp with a payment link that opens intent?** — Useful for overdue chase workflows. Can be added as a sibling feature once this ships.

4. **iOS coverage** — iOS 17+ supports `upi://` but UX varies. Should we show iOS users a QR code first and UPI app launcher second? Needs real-device testing.

---

## 14. Reference Material

- NPCI UPI Linking Specification: https://www.npci.org.in/what-we-do/upi/product-overview
- UPI Deep Linking docs (search "UPI deep linking NPCI PDF")
- Google Pay for India Merchant Integration: https://developers.google.com/pay/india

---

_End of plan. Ready for review and implementation._
