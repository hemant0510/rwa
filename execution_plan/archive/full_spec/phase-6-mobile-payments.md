# Full Spec Phase 6 — Mobile App & Payments

**Duration**: ~6 weeks
**Goal**: React Native mobile app for residents and admins, Razorpay payment gateway integration with auto-reconciliation, payment links, biometric auth, offline capabilities.
**Depends on**: Phase 2 (Core MVP) + Phase 5 (Notifications — push notifications)

---

## Task 6.1 — React Native App Setup

### Technology

| Decision   | Choice                   | Reason                                    |
| ---------- | ------------------------ | ----------------------------------------- |
| Framework  | React Native + Expo      | Faster dev, OTA updates, managed workflow |
| Navigation | React Navigation (v7)    | Standard, well-maintained                 |
| State      | TanStack Query + Zustand | Same as web — shared mental model         |
| Forms      | React Hook Form + Zod    | Same validation schemas as web            |
| Storage    | expo-secure-store        | Encrypted local storage for tokens        |
| Push       | expo-notifications + FCM | Integrated with Phase 5 FCM setup         |

### Monorepo Structure

```
rwa/
├── apps/
│   ├── web/                 # Next.js web app (existing)
│   └── mobile/              # React Native / Expo app (new)
│       ├── app/             # Expo Router file-based routing
│       │   ├── (auth)/      # Login, OTP, PIN screens
│       │   ├── (resident)/  # Resident tab screens
│       │   └── (admin)/     # Admin screens
│       ├── components/      # Mobile-specific components
│       └── lib/             # Mobile-specific utils
├── packages/
│   ├── shared-types/        # TypeScript types + enums (shared)
│   ├── shared-validations/  # Zod schemas (shared)
│   └── shared-constants/    # Enum labels, config (shared)
└── package.json             # Workspace root
```

### Shared Code

| Package              | Content                               | Used By      |
| -------------------- | ------------------------------------- | ------------ |
| `shared-types`       | All TypeScript interfaces, enum types | Web + Mobile |
| `shared-validations` | All Zod schemas                       | Web + Mobile |
| `shared-constants`   | Enum labels, status colors, config    | Web + Mobile |

### API Client

Mobile app consumes the same `/api/v1/*` endpoints as the web app. No separate API needed.

```typescript
// packages/shared-types/src/api.ts
export interface ApiResponse<T> {
  data: T;
  error?: { code: string; message: string; status: number };
}

// Mobile uses the same TanStack Query hooks:
// useResidentProfile(), usePaymentHistory(), useFeeStatus(), etc.
```

**Acceptance**: Expo app builds for iOS and Android. Shared packages compile. API calls work from mobile. Navigation structure mirrors web portals.

---

## Task 6.2 — Resident Portal Screens (Mobile)

### Screen Map

```
Tab Navigation (Resident)
├── Home         — RWAID, fee status, quick actions
├── Payments     — Payment history, online pay button
├── Expenses     — Society expense ledger (read-only)
├── Festivals    — Active festivals, contributions
└── Profile      — Settings, preferences, RWAID card
```

### Home Screen

```
┌──────────────────────────────────┐
│  Eden Estate RWA        [🔔 3]  │
│──────────────────────────────────│
│                                  │
│  ┌────────────────────────────┐  │
│  │  RWAID: RWA-HR-GUR-122001 │  │
│  │         -001-2025-0042     │  │
│  │  Hemant Kumar              │  │
│  │  Tower A, 3rd Floor, 302   │  │
│  │  Status: ● Active Paid     │  │
│  │           [Show QR Code]   │  │
│  └────────────────────────────┘  │
│                                  │
│  Fee Status — 2025-26            │
│  ┌────────────────────────────┐  │
│  │  Amount Due    ₹12,000     │  │
│  │  Amount Paid   ₹12,000     │  │
│  │  Balance       ₹0          │  │
│  │  Status        ✅ PAID      │  │
│  └────────────────────────────┘  │
│                                  │
│  Quick Actions                   │
│  ┌──────┐  ┌──────┐  ┌──────┐  │
│  │ 💰   │  │ 📋   │  │ 🎉   │  │
│  │ Pay  │  │ Exp  │  │ Fest │  │
│  │ Now  │  │ View │  │ View │  │
│  └──────┘  └──────┘  └──────┘  │
│                                  │
│──────────────────────────────────│
│  🏠    💰    📋    🎉    👤     │
└──────────────────────────────────┘
```

### Payments Screen

```
┌──────────────────────────────────┐
│  ← Payments                      │
│──────────────────────────────────│
│                                  │
│  Current Session: 2025-26        │
│  Balance: ₹0 (Paid ✅)           │
│                                  │
│  [Pay Online — ₹12,000]  (if    │
│                           unpaid)│
│                                  │
│  Payment History                 │
│  ┌────────────────────────────┐  │
│  │ Mar 15, 2025               │  │
│  │ ₹12,000 via UPI            │  │
│  │ Ref: UPI-9876543210        │  │
│  │ Receipt: RCP-2025-0089     │  │
│  │ [Download Receipt]         │  │
│  ├────────────────────────────┤  │
│  │ Apr 5, 2024                │  │
│  │ ₹11,000 via Cash           │  │
│  │ Receipt: RCP-2024-0042     │  │
│  │ [Download Receipt]         │  │
│  └────────────────────────────┘  │
│                                  │
│──────────────────────────────────│
│  🏠    💰    📋    🎉    👤     │
└──────────────────────────────────┘
```

### Components

| Component            | Description                                  |
| -------------------- | -------------------------------------------- |
| `RWAIDCard`          | Styled card with QR code, resident info      |
| `FeeStatusCard`      | Current session fee summary                  |
| `PaymentHistoryList` | Paginated payment list with receipt download |
| `QuickActionGrid`    | Grid of action buttons                       |
| `ExpenseLedger`      | Read-only expense list with category icons   |
| `FestivalCard`       | Festival status, contribution progress       |
| `ProfileScreen`      | Settings, preferences, RWAID card download   |

**Acceptance**: All resident screens render. Fee status shows correct data. Payment history paginated. Receipt PDF downloads. QR code scannable. Offline profile data cached.

---

## Task 6.3 — Admin Portal Screens (Mobile)

### Screen Map

```
Tab Navigation (Admin)
├── Dashboard    — Key metrics, pending actions
├── Members      — Registration approvals, member list
├── Finances     — Quick payment recording, fee overview
├── Broadcast    — Quick broadcast composer
└── More         — Reports, settings, expenses
```

### Dashboard Screen

```
┌──────────────────────────────────┐
│  Eden Estate          [🔔 5]    │
│──────────────────────────────────│
│                                  │
│  ┌──────┐  ┌──────┐  ┌──────┐  │
│  │  42  │  │ ₹4.2L│  │  3   │  │
│  │ Total│  │Collec│  │Pend- │  │
│  │Membs │  │ ted  │  │ ing  │  │
│  └──────┘  └──────┘  └──────┘  │
│                                  │
│  Pending Actions                 │
│  ┌────────────────────────────┐  │
│  │ ⏳ 3 registrations pending │  │
│  │ ⏳ 5 fees overdue          │  │
│  │ ⏳ 1 expense query open    │  │
│  └────────────────────────────┘  │
│                                  │
│  Quick Actions                   │
│  ┌──────────┐  ┌──────────┐    │
│  │ 💰 Record│  │ ✅ Approve│    │
│  │  Payment │  │ Members  │    │
│  └──────────┘  └──────────┘    │
│  ┌──────────┐  ┌──────────┐    │
│  │ 📢 Send  │  │ 📋 Add   │    │
│  │Broadcast │  │ Expense  │    │
│  └──────────┘  └──────────┘    │
│──────────────────────────────────│
│  📊    👥    💰    📢    ≡     │
└──────────────────────────────────┘
```

### Key Flows

- **Record Payment**: Select resident → enter amount + mode + reference → confirm → receipt auto-generated
- **Approve Registration**: View pending list → tap → review details → approve/reject
- **Quick Broadcast**: Compose → select recipients → preview → send

### Push Notifications for Admin

| Event                | Notification                                    |
| -------------------- | ----------------------------------------------- |
| New registration     | "New registration from Priya Sharma — Flat 302" |
| Payment via gateway  | "₹12,000 received from Hemant Kumar via UPI"    |
| Expense query raised | "New expense query on Security — ₹4,800"        |
| Term expiry reminder | "Your term expires in 30 days"                  |

**Acceptance**: Admin dashboard loads key metrics. Quick payment recording works. Registration approval flow works from mobile. Push notifications for key events.

---

## Task 6.4 — Razorpay Payment Gateway Integration

### Overview

Residents can pay fees online via Razorpay. Supports UPI, Credit/Debit Card, Net Banking, Wallets.

### Payment Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Resident │     │ Our API  │     │ Razorpay │     │ Webhook  │
│ clicks   │────▶│ creates  │────▶│ checkout │────▶│ confirms │
│ "Pay Now"│     │ order    │     │ opens    │     │ payment  │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
                                       │                  │
                                       ▼                  ▼
                                  ┌──────────┐     ┌──────────┐
                                  │ Resident │     │ Auto-    │
                                  │ pays via │     │ reconcile│
                                  │ UPI/Card │     │ + receipt│
                                  └──────────┘     └──────────┘
```

### Payment Flow UI (Mobile)

```
┌──────────────────────────────────┐
│  ← Pay Fee                       │
│──────────────────────────────────│
│                                  │
│  Session: 2025-26                │
│  Amount Due: ₹12,000             │
│                                  │
│  ┌────────────────────────────┐  │
│  │  Paying: ₹12,000           │  │
│  │  To: Eden Estate RWA       │  │
│  │  For: Annual Fee 2025-26   │  │
│  │                            │  │
│  │  Pay via:                  │  │
│  │  ○ UPI (GPay, PhonePe)    │  │
│  │  ○ Credit/Debit Card      │  │
│  │  ○ Net Banking            │  │
│  │  ○ Wallets                │  │
│  └────────────────────────────┘  │
│                                  │
│  [Proceed to Pay — ₹12,000]     │
│                                  │
│  🔒 Secured by Razorpay         │
│──────────────────────────────────│
│  🏠    💰    📋    🎉    👤     │
└──────────────────────────────────┘
```

### Backend Implementation

**Order Creation API**:

```
POST /api/v1/payments/create-order
Body: { membership_fee_id, amount }
Response: { razorpay_order_id, amount, currency, key_id }
```

**Payment Verification API**:

```
POST /api/v1/payments/verify
Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
Response: { success, receipt_number, receipt_url }
```

**Webhook Handler**:

```
POST /api/v1/webhooks/razorpay
  → Verify signature (HMAC-SHA256)
  → Find matching order
  → Create fee_payment record
  → Update membership_fee status
  → Generate receipt
  → Send WhatsApp notification
```

### Configuration

```env
RAZORPAY_KEY_ID=rzp_test_xxxxx        # Test mode
RAZORPAY_KEY_SECRET=xxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxx
RAZORPAY_LIVE_KEY_ID=rzp_live_xxxxx   # Production
RAZORPAY_LIVE_KEY_SECRET=xxxxx
```

### Fee Payment Record (Gateway)

```sql
INSERT INTO fee_payments (
  membership_fee_id, society_id, user_id,
  amount, payment_mode, entry_type,
  gateway_order_id, gateway_payment_id, gateway_signature,
  receipt_number, recorded_by, recorded_at
) VALUES (
  :fee_id, :society_id, :user_id,
  12000, 'ONLINE', 'PAYMENT',
  'order_xxx', 'pay_xxx', 'sig_xxx',
  'RCP-2025-0090', :user_id, NOW()
);
```

**Acceptance**: Razorpay checkout opens. UPI payment completes. Card payment completes. Webhook fires and creates fee_payment. Receipt auto-generated. WhatsApp notification sent. Test + live mode configurable.

---

## Task 6.5 — Auto-Reconciliation

### Reconciliation Flow

```
Razorpay Webhook received
  ├── Verify HMAC-SHA256 signature
  ├── Extract: order_id, payment_id, amount, status
  ├── Find fee_payment by gateway_order_id
  │   ├── FOUND:
  │   │   ├── Update: gateway_payment_id, gateway_signature
  │   │   ├── Update membership_fee: amount_paid += amount, recalc balance
  │   │   ├── Update fee status: PAID (if balance = 0) / PARTIAL (if balance > 0)
  │   │   ├── Generate receipt PDF
  │   │   └── Send WhatsApp notification with receipt
  │   └── NOT FOUND:
  │       └── Log as UNMATCHED → admin reviews manually
  └── Respond 200 OK (always, to prevent retries)
```

### Edge Cases

| Case                    | Handling                                               |
| ----------------------- | ------------------------------------------------------ |
| Duplicate webhook       | Idempotent — check if payment_id already exists        |
| Partial gateway payment | Create PARTIAL_PAYMENT entry, update balance           |
| Refund webhook          | Create REFUND entry, reverse fee status                |
| Amount mismatch         | Log warning, create payment for actual amount received |
| Webhook timeout         | Razorpay retries up to 8 times over 24 hours           |
| Order expired           | Mark order as expired, no fee update                   |

### Reconciliation Dashboard (Admin)

```
┌─────────────────────────────────────────────────────────┐
│  Payment Reconciliation                                  │
│─────────────────────────────────────────────────────────│
│                                                          │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐       │
│  │  156   │  │  152   │  │   2    │  │   2    │       │
│  │ Total  │  │Matched │  │Pending │  │Unmatched│       │
│  │        │  │  ✅    │  │  ⏳    │  │  ⚠️    │       │
│  └────────┘  └────────┘  └────────┘  └────────┘       │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Date       │ Resident    │ Amount │ Gateway │ Match│ │
│  │────────────│─────────────│────────│─────────│──────│ │
│  │ Mar 4      │ Hemant K.   │₹12,000 │ pay_xxx │  ✅  │ │
│  │ Mar 4      │ Priya S.    │₹12,000 │ pay_yyy │  ✅  │ │
│  │ Mar 3      │ Unknown     │ ₹6,000 │ pay_zzz │  ⚠️  │ │
│  │ Mar 3      │ Rajesh P.   │₹12,000 │ pending │  ⏳  │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  Unmatched payments require manual matching by admin.    │
└─────────────────────────────────────────────────────────┘
```

### API Endpoints

| Method | Endpoint                            | Description        |
| ------ | ----------------------------------- | ------------------ |
| POST   | `/api/v1/webhooks/razorpay`         | Webhook handler    |
| GET    | `/api/v1/reconciliation`            | Dashboard data     |
| GET    | `/api/v1/reconciliation/unmatched`  | Unmatched payments |
| POST   | `/api/v1/reconciliation/:id/match`  | Manual match       |
| POST   | `/api/v1/reconciliation/:id/refund` | Initiate refund    |

**Acceptance**: Webhook auto-reconciles 95%+ of payments. Unmatched payments visible to admin. Manual matching works. Duplicate webhooks handled idempotently. Refund flow works.

---

## Task 6.6 — Payment Links & QR Payments

### Admin Generates Payment Link

```
┌─────────────────────────────────────────────────────────┐
│  Generate Payment Link                                   │
│─────────────────────────────────────────────────────────│
│                                                          │
│  Resident:  [Hemant Kumar — Flat 302    ▾]              │
│  Session:   [2025-26                     ▾]              │
│  Amount:    [₹12,000                      ]              │
│  Expires:   [7 days                      ▾]              │
│                                                          │
│  [Generate Link]                                         │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Link: https://pay.rwaconnect.in/p/abc123xyz     │   │
│  │  [Copy Link]  [Send via WhatsApp]  [Show QR]    │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Payment Link Flow

```
Admin generates link
  → System creates Razorpay payment link
  → Short URL generated (pay.rwaconnect.in/p/xxx)
  → QR code generated for the URL
  → Admin shares via WhatsApp (auto-compose message)
  → Resident clicks link → Razorpay checkout → pays
  → Webhook fires → auto-reconcile → receipt → notification
```

### Bulk Payment Links

Admin can generate payment links for all overdue residents at once:

- Click "Generate Links for Overdue" → creates links for all overdue fees
- Click "Send via WhatsApp" → broadcasts payment links to each resident with personalized amount

### Payment Link Tracking

| Status    | Meaning                         |
| --------- | ------------------------------- |
| CREATED   | Link generated, not yet opened  |
| CLICKED   | Resident opened the link        |
| PAID      | Payment completed               |
| EXPIRED   | Link expired (past expiry date) |
| CANCELLED | Admin cancelled the link        |

### API Endpoints

| Method | Endpoint                       | Description                |
| ------ | ------------------------------ | -------------------------- |
| POST   | `/api/v1/payment-links`        | Create payment link        |
| POST   | `/api/v1/payment-links/bulk`   | Bulk create for overdue    |
| GET    | `/api/v1/payment-links`        | List all links with status |
| DELETE | `/api/v1/payment-links/:id`    | Cancel link                |
| GET    | `/api/v1/payment-links/:id/qr` | Get QR code image          |

**Acceptance**: Payment link generates. Short URL works. QR code scannable. WhatsApp share works. Link expiry enforced. Bulk generation for overdue works. Payment via link auto-reconciles.

---

## Task 6.7 — Biometric Authentication

### Setup Flow

```
First OTP login (mobile app)
  → "Set up quick access?"
  → Resident sets 4-digit PIN (same as web)
  → "Enable fingerprint/face unlock?"
  → If YES: Register biometric → store auth token in SecureStore
  → Next launch: Biometric prompt → auto-login

Biometric fails 3x
  → Fallback to PIN entry
  → PIN fails 5x
  → Require full OTP re-verification
```

### Biometric Setup Screen

```
┌──────────────────────────────────┐
│                                  │
│        🔐 Quick Access           │
│                                  │
│   Enable fingerprint/face        │
│   unlock for faster login?       │
│                                  │
│        ┌──────────────┐          │
│        │              │          │
│        │   👆 Touch   │          │
│        │   sensor to  │          │
│        │   enable     │          │
│        │              │          │
│        └──────────────┘          │
│                                  │
│  [Enable]         [Skip]         │
│                                  │
└──────────────────────────────────┘
```

### Implementation

| Platform | API                       | Library                     |
| -------- | ------------------------- | --------------------------- |
| iOS      | Face ID / Touch ID        | `expo-local-authentication` |
| Android  | Fingerprint / Face Unlock | `expo-local-authentication` |

### Security

- Biometric unlocks locally stored encrypted refresh token
- Refresh token encrypted with device keychain (Keychain on iOS, Keystore on Android)
- Biometric required for: payment confirmation (Razorpay), profile changes
- Admin can disable biometric for their account
- Token expires after 30 days — re-verify with OTP

**Acceptance**: Biometric setup works on iOS + Android. Fingerprint unlocks app. Face ID unlocks app. Fallback to PIN works. Payment confirmation requires biometric. Token refresh works.

---

## Task 6.8 — Offline Capabilities

### Cached Data (Always Available Offline)

| Data               | Cache Strategy    | Refresh             |
| ------------------ | ----------------- | ------------------- |
| Resident profile   | Cache on login    | On app foreground   |
| RWAID card         | Cache permanently | On profile change   |
| Current fee status | Cache on login    | On payment          |
| Last 20 payments   | Cache on view     | On new payment      |
| Last 20 expenses   | Cache on view     | On new expense      |
| Notification list  | Cache on view     | On new notification |

### Offline Queue (Admin Only)

When admin is offline, these actions are queued:

- Record payment (amount, mode, reference)
- Approve/reject registration

```
Admin records payment offline
  → Saved to local queue (AsyncStorage)
  → "Payment saved offline — will sync when connected"
  → On reconnect:
    → POST to API
    → If success: remove from queue, show confirmation
    → If conflict: show conflict resolution dialog
```

### Offline Indicator

```
┌──────────────────────────────────┐
│  ⚠️ You are offline              │
│  Changes will sync when          │
│  connection is restored.         │
│  Queued actions: 2               │
└──────────────────────────────────┘
```

### Sync Strategy

- Use `@react-native-community/netinfo` for connection detection
- Queue: AsyncStorage with timestamp
- Sync order: FIFO (first in, first out)
- Conflict: Server wins, but admin notified of conflict
- Retry: 3 attempts with exponential backoff

**Acceptance**: Profile and fee data available offline. Admin can record payments offline. Offline queue syncs on reconnect. Conflict resolution works. Offline indicator visible.

---

## Phase 6 Definition of Done

- [ ] React Native app builds for iOS and Android via Expo
- [ ] Shared packages (types, validations, constants) work across web + mobile
- [ ] Resident home screen shows RWAID, fee status, quick actions
- [ ] Payment history loads with receipt download
- [ ] Expense ledger (read-only) works on mobile
- [ ] Festival contributions visible on mobile
- [ ] Admin dashboard shows key metrics on mobile
- [ ] Admin can record payments from mobile
- [ ] Admin can approve/reject registrations from mobile
- [ ] Razorpay checkout opens for UPI, Card, Net Banking, Wallets
- [ ] Webhook auto-reconciles payments (creates fee_payment, updates status, generates receipt)
- [ ] Duplicate webhooks handled idempotently
- [ ] Unmatched payments visible to admin for manual matching
- [ ] Refund flow works
- [ ] Payment links generated and shareable via WhatsApp
- [ ] QR code for payment works
- [ ] Bulk payment link generation for overdue residents
- [ ] Biometric auth (fingerprint/Face ID) unlocks app
- [ ] Biometric fallback to PIN, PIN fallback to OTP
- [ ] Biometric required for payment confirmation
- [ ] Critical data cached for offline access
- [ ] Admin offline queue syncs on reconnect
- [ ] Offline indicator visible when disconnected
- [ ] Push notifications work on mobile (from Phase 5)
- [ ] App passes App Store + Play Store review guidelines
