# MVP Phase 3 — Fee Management & Payment Recording

**Duration**: ~2 weeks
**Goal**: Admin can calculate pro-rata fees, record payments, generate receipts, and track all fee statuses. Residents see their payment history.
**Depends on**: Phase 2 (residents must exist to charge fees)

---

## Task 3.1 — Fee Dashboard (Admin)

### Backend

- API: `GET /api/v1/societies/[id]/fees/dashboard`
- Returns: Total due, total collected, total outstanding, collection percentage
- Breakdown by status: Paid, Pending, Overdue, Partial, Exempted
- Session-aware: `?session=2025-26` (defaults to current session)

### UI Screen: `/admin/fees`

```
┌─────────────────────────────────────────────────────────────┐
│  [Sidebar]  │  Fee Management — Session 2025-26  [2024-25 ▾]│
│             │────────────────────────────────────────────────│
│  Dashboard  │                                                │
│  Residents  │  ┌───────────┐ ┌───────────┐ ┌─────────────┐ │
│  Fees    ←  │  │ Total Due │ │ Collected │ │ Outstanding │ │
│  Expenses   │  │ ₹50,400   │ │ ₹38,400   │ │ ₹12,000     │ │
│  Reports    │  │ 42 members│ │ 76% ████░░│ │ 10 pending  │ │
│  Broadcast  │  └───────────┘ └───────────┘ └─────────────┘ │
│             │                                                │
│             │  ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│             │  │🟢 Paid   │ │🟡 Pending│ │🔴 Overdue│      │
│             │  │   32     │ │    5     │ │    3     │      │
│             │  └──────────┘ └──────────┘ └──────────┘      │
│             │  ┌──────────┐ ┌──────────┐                    │
│             │  │🟠 Partial│ │🔵 Exempt │                    │
│             │  │    1     │ │    1     │                    │
│             │  └──────────┘ └──────────┘                    │
│             │                                                │
│             │  Quick Actions                                 │
│             │  [Record Payment] [Send Fee Reminder] [Export] │
│             │                                                │
│             │  Fee Tracker                    Search: [____] │
│             │  ─────────────────────────────────────────     │
│             │  Status: [All ▾]  Ownership: [All ▾]           │
│             │                                                │
│             │  ┌────────────────────────────────────────┐   │
│             │  │ Resident       │ Unit  │ Due    │Status │   │
│             │  │────────────────│───────│────────│───────│   │
│             │  │ Hemant Kumar   │S22-H245│₹1,200│🟢 Paid│   │
│             │  │ Rajesh Sharma  │S22-H110│₹1,200│🟢 Paid│   │
│             │  │ Priya Singh    │S22-H301│₹1,000│🟠 ₹200│   │
│             │  │ Amit Verma     │S22-H88 │₹1,200│🔴 Over│   │
│             │  │ Neha Gupta     │S22-H55 │  —   │🔵 Free│   │
│             │  └────────────────────────────────────────┘   │
│             │  Showing 1-10 of 42        [< 1 2 3 4 5 >]   │
└─────────────┴───────────────────────────────────────────────┘
```

**Components to build**:

- `FeesDashboard` — Full page with stats + tracker table
- `FeeStatsRow` — Row of StatCards (Total Due, Collected, Outstanding)
- `FeeStatusBreakdown` — Clickable status count cards (filter table on click)
- `FeeTrackerTable` — DataTable with resident fee status per session
- `StatusBadge` — Reuse from Phase 0 (Paid/Pending/Overdue/Partial/Exempted)
- `SessionSelector` — Dropdown to switch between financial sessions
- Use shadcn `Card`, `Badge`, `Table`, `Select`, `Input`

**Acceptance**: Dashboard shows real aggregated data. Status counts match table. Clicking a status card filters the table. Session switcher works.

---

## Task 3.2 — Pro-Rata Calculation Engine

### Backend

- API: `GET /api/v1/societies/[id]/fees/calculate-prorate?approvalMonth=[1-12]`
- Formula: `First Payment = Joining Fee + (Annual Fee ÷ 12 × Remaining Months)`
- Session runs April (month 4) to March (month 3). The remaining months lookup:

| Approval Month | Month # | Remaining Months | Example (₹1,200/yr) |
| -------------- | ------- | ---------------- | ------------------- |
| April          | 4       | 12 (full year)   | ₹1,200              |
| May            | 5       | 11               | ₹1,100              |
| June           | 6       | 10               | ₹1,000              |
| July           | 7       | 9                | ₹900                |
| August         | 8       | 8                | ₹800                |
| September      | 9       | 7                | ₹700                |
| October        | 10      | 6                | ₹600                |
| November       | 11      | 5                | ₹500                |
| December       | 12      | 4                | ₹400                |
| January        | 1       | 3                | ₹300                |
| February       | 2       | 2                | ₹200                |
| March          | 3       | 1                | ₹100                |

- **Formula** (generic for any session start month):
  ```
  if approvalMonth >= sessionStartMonth:
    remainingMonths = 12 - (approvalMonth - sessionStartMonth)
  else:
    remainingMonths = sessionStartMonth - approvalMonth
  ```
- Returns: `{ joiningFee, annualFee, monthlyRate, remainingMonths, proRataAmount, totalFirstPayment }`

### Logic (used at resident approval time)

```
Resident approved in July (month 7):
  Remaining months = 12 - (7 - 4) = 9
  Monthly rate = ₹1,200 ÷ 12 = ₹100
  Pro-rata = ₹100 × 9 = ₹900
  Total first payment = ₹1,000 (joining) + ₹900 = ₹1,900
```

### UI: Pro-Rata Preview (shown during resident approval)

```
┌─────────────────────────────────────────────────┐
│  Fee Calculation Preview                         │
│  ───────────────────────────────────────────     │
│                                                  │
│  Approval Month: July 2025                       │
│  Session: 2025-26 (Apr 2025 — Mar 2026)         │
│                                                  │
│  ┌────────────────────────────────────────┐     │
│  │ Joining Fee (one-time)      ₹1,000     │     │
│  │ ──────────────────────────────────     │     │
│  │ Annual Fee               ₹1,200/year   │     │
│  │ Monthly Rate             ₹100/month    │     │
│  │ Remaining Months              9        │     │
│  │ Pro-rata Amount              ₹900      │     │
│  │ ──────────────────────────────────     │     │
│  │ Total First Payment         ₹1,900     │     │
│  └────────────────────────────────────────┘     │
│                                                  │
│  ℹ Next session (2026-27): ₹1,200 full year     │
└─────────────────────────────────────────────────┘
```

**Implementation notes**:

- Pro-rata calculated at approval time and stored on `membership_fees` record
- If approval crosses session boundary (applied March, approved April), April rate applies
- Calculation uses society's current `joining_fee` and `annual_fee` columns
- `ProRataCalculator` — Pure function in `src/lib/fee-calculator.ts` (shared between server & client)

**Components to build**:

- `ProRataPreview` — Display component showing the breakdown (reused from Phase 1 society wizard)
- `FeeCalculator` utility function in `src/lib/fee-calculator.ts`

**Acceptance**: Pro-rata correct for all 12 months. April = full year. March = 1 month. Boundary cases handled (approved in April after March application).

---

## Task 3.3 — Record Payment Flow

### Backend

- API: `POST /api/v1/societies/[id]/fees/[feeId]/payments`
- Body: `{ amount, paymentMode, referenceNumber, paymentDate, notes }`
- Receipt number auto-generated: `[SOCIETYCODE]-[YEAR]-R[SEQ]` (e.g., `EDENESTATE-2025-R0042`)
- Updates fee status: Pending→Paid (if full), Pending→Partial (if short)
- Triggers WhatsApp notification (Phase 5) with receipt

### UI: Record Payment Dialog (from fee tracker or resident detail page)

```
┌─────────────────────────────────────────────────┐
│  Record Payment                            [✕]  │
│  ───────────────────────────────────────────     │
│                                                  │
│  Resident: Hemant Kumar                          │
│  Unit: S22-St7-H245                              │
│  Session: 2025-26                                │
│                                                  │
│  Fee Due                                         │
│  ┌────────────────────────────────────────┐     │
│  │ Annual Fee           ₹1,200            │     │
│  │ Previously Paid      ₹0                │     │
│  │ Balance Due           ₹1,200           │     │
│  └────────────────────────────────────────┘     │
│                                                  │
│  Amount (₹) *                                    │
│  ┌────────────────────────────────────────┐     │
│  │ 1,200                                  │     │
│  └────────────────────────────────────────┘     │
│  ℹ Pre-filled with balance due. Edit for partial │
│                                                  │
│  Payment Mode *                                  │
│  (●) Cash  (○) UPI  (○) Bank Transfer  (○) Other│
│                                                  │
│  Reference Number                                │
│  ┌────────────────────────────────────────┐     │
│  │                                        │     │
│  └────────────────────────────────────────┘     │
│  Required for UPI & Bank Transfer                │
│                                                  │
│  Payment Date *                                  │
│  ┌────────────────────────────────────────┐     │
│  │ 📅 04/03/2026                          │     │
│  └────────────────────────────────────────┘     │
│  Defaults to today. Backdate up to 30 days.      │
│                                                  │
│  Notes (optional)                                │
│  ┌────────────────────────────────────────┐     │
│  │                                        │     │
│  └────────────────────────────────────────┘     │
│                                                  │
│  ┌────────────────────────────────────────┐     │
│  │ Payment Summary                        │     │
│  │ Amount: ₹1,200                         │     │
│  │ Mode: Cash                             │     │
│  │ Status after payment: ✅ PAID           │     │
│  └────────────────────────────────────────┘     │
│                                                  │
│                   [Cancel]  [Record Payment]     │
└─────────────────────────────────────────────────┘
```

### UI: After Successful Payment

```
┌─────────────────────────────────────────────────┐
│  ✅ Payment Recorded Successfully                │
│  ───────────────────────────────────────────     │
│                                                  │
│  Receipt: EDENESTATE-2025-R0042                  │
│  Amount: ₹1,200                                  │
│  Resident: Hemant Kumar (S22-St7-H245)           │
│                                                  │
│  WhatsApp receipt sent to 98765xxxxx             │
│                                                  │
│  [Download Receipt PDF]  [Record Another]  [Done]│
└─────────────────────────────────────────────────┘
```

**Components to build**:

- `RecordPaymentDialog` — Sheet/dialog with payment form
- `PaymentSummaryCard` — Live preview of what will happen on submit
- `PaymentSuccessCard` — Success state with receipt info + actions
- `PaymentModeSelector` — Radio group (Cash, UPI, Bank Transfer, Other)
- `AmountInput` — Currency input with ₹ prefix and formatting
- Use shadcn `Dialog`, `Form`, `Input`, `RadioGroup`, `DatePicker`, `Button`

**Acceptance**: Payment recorded. Receipt number generated. Fee status auto-updates. Success card shows correct info. Form validates reference number requirement for non-cash modes.

---

## Task 3.4 — Fee Status Lifecycle & Transitions

### Backend

- Status transitions enforced server-side:
  ```
  NOT_YET_DUE → PENDING (when session opens: April 1)
  PENDING → PAID (full payment received)
  PENDING → PARTIAL (partial payment received)
  PENDING → OVERDUE (past April 15 grace period, no payment)
  PARTIAL → PAID (remaining balance paid)
  PARTIAL → OVERDUE (past grace, still incomplete)
  OVERDUE → PAID (full payment received late)
  OVERDUE → PARTIAL (partial payment received late)
  Any → EXEMPTED (admin grants exemption)
  ```
- Cron job (or Next.js cron route): runs daily at midnight IST
  - April 1: All `NOT_YET_DUE` → `PENDING`
  - April 16: All `PENDING` with zero payment → `OVERDUE`

### UI: Fee Status Badges (used across all screens)

```
┌───────────────────────────────────────────────┐
│  Status Badge Reference                        │
│                                                │
│  ┌──────────┐  Paid: #16A34A (green-600)      │
│  │ 🟢 Paid  │  Full payment received           │
│  └──────────┘                                  │
│                                                │
│  ┌──────────┐  Pending: #CA8A04 (yellow-600)  │
│  │ 🟡 Pend. │  Within grace period             │
│  └──────────┘                                  │
│                                                │
│  ┌──────────┐  Overdue: #DC2626 (red-600)     │
│  │ 🔴 Over  │  Past grace, unpaid              │
│  └──────────┘                                  │
│                                                │
│  ┌──────────┐  Partial: #EA580C (orange-600)  │
│  │ 🟠 ₹800  │  Shows outstanding amount        │
│  └──────────┘                                  │
│                                                │
│  ┌──────────┐  Exempted: #2563EB (blue-600)   │
│  │ 🔵 Free  │  Admin exempted with reason       │
│  └──────────┘                                  │
│                                                │
│  ┌──────────┐  Not Yet Due: #6B7280 (gray-500)│
│  │ ⚪ NYD   │  New member, session not started  │
│  └──────────┘                                  │
└───────────────────────────────────────────────┘
```

**Implementation**:

- `StatusBadge` component from Phase 0 design system handles all 6 states
- Partial badge shows outstanding amount inline
- Overdue badge can optionally show "X days" overdue count

**Acceptance**: All 6 statuses display correctly. Transitions enforced (cannot go from Paid back to Pending). Cron updates statuses on schedule.

---

## Task 3.5 — Receipt PDF Generation

### Backend

- API: `GET /api/v1/societies/[id]/fees/[feeId]/payments/[paymentId]/receipt`
- Returns PDF (Content-Type: application/pdf)
- Receipt generated on payment creation, stored in Supabase Storage
- Permanent URL: can be re-downloaded anytime

### Receipt PDF Layout

```
┌──────────────────────────────────────────────────┐
│                                                   │
│               Eden Estate RWA                     │
│          Gurgaon, Haryana — 122001                │
│          Society ID: RWA-HR-GGN-122001-0001       │
│                                                   │
│  ─────────────────────────────────────────────── │
│                 PAYMENT RECEIPT                    │
│  ─────────────────────────────────────────────── │
│                                                   │
│  Receipt No:    EDENESTATE-2025-R0042             │
│  Date:          04 March 2026                     │
│                                                   │
│  ─────────────────────────────────────────────── │
│                                                   │
│  Received From:                                   │
│  Name:          Hemant Kumar                      │
│  RWAID:         #0089                             │
│  Unit:          S22-St7-H245                      │
│  Type:          Owner                             │
│                                                   │
│  ─────────────────────────────────────────────── │
│                                                   │
│  Payment Details:                                 │
│  ┌─────────────────────────────────────────┐     │
│  │ Description          │ Amount            │     │
│  │──────────────────────│───────────────────│     │
│  │ Annual Fee 2025-26   │ ₹1,200            │     │
│  │──────────────────────│───────────────────│     │
│  │ Total Paid           │ ₹1,200            │     │
│  └─────────────────────────────────────────┘     │
│                                                   │
│  Payment Mode:   Cash                             │
│  Reference:      —                                │
│  Status:         PAID IN FULL                     │
│                                                   │
│  ─────────────────────────────────────────────── │
│                                                   │
│  Recorded by: Admin Name                          │
│  Recorded on: 04 March 2026 at 14:32 IST         │
│                                                   │
│  ─────────────────────────────────────────────── │
│  This is a digitally generated receipt.           │
│  Verify at: rwaconnect.in/verify/EDENESTATE-     │
│  2025-R0042                                       │
│                                                   │
│  Powered by RWA Connect                           │
└──────────────────────────────────────────────────┘
```

**Implementation**: `@react-pdf/renderer` — A4 portrait, print-ready.

**Components to build**:

- `ReceiptPDF` — React-PDF document component
- `DownloadReceiptButton` — Triggers PDF download
- Receipt stored in Supabase Storage: `receipts/[societyId]/[receiptNo].pdf`

**Acceptance**: Receipt PDF downloads. All fields populated correctly. Print-quality formatting. Verification URL included.

---

## Task 3.6 — Fee Exemption & Correction

### Backend

- Exemption: `POST /api/v1/societies/[id]/fees/[feeId]/exempt`
  - Body: `{ reason }` — reason is mandatory
  - Sets status to `EXEMPTED`, stores reason in `exemption_reason` column
  - Audit log entry created
- Fee correction (within 48h): `PATCH /api/v1/societies/[id]/fees/[feeId]/payments/[paymentId]`
  - Only amount, mode, reference, notes can be edited
  - Audit log captures before/after values
- Fee reversal (after 48h): `POST /api/v1/societies/[id]/fees/[feeId]/payments/[paymentId]/reverse`
  - Creates a reversal entry (negative amount)
  - Original entry marked as reversed (struck through in UI)
  - Reason required
  - Admin records correct payment as new entry

### UI: Exemption Dialog

```
┌─────────────────────────────────────────────────┐
│  Grant Fee Exemption                       [✕]  │
│  ───────────────────────────────────────────     │
│                                                  │
│  Resident: Neha Gupta                            │
│  Unit: S22-St7-H55                               │
│  Session: 2025-26                                │
│  Amount Being Exempted: ₹1,200                   │
│                                                  │
│  ⚠ This will mark the resident as EXEMPTED for  │
│  the entire session. This action is logged.       │
│                                                  │
│  Reason for Exemption *                          │
│  ┌────────────────────────────────────────┐     │
│  │ Senior citizen above 80 years, society │     │
│  │ resolution dated 15 Jan 2025.          │     │
│  └────────────────────────────────────────┘     │
│  Minimum 10 characters required                  │
│                                                  │
│                 [Cancel]  [Grant Exemption]       │
└─────────────────────────────────────────────────┘
```

### UI: Payment Correction (within 48h)

```
┌─────────────────────────────────────────────────┐
│  Correct Payment                           [✕]  │
│  ───────────────────────────────────────────     │
│                                                  │
│  Receipt: EDENESTATE-2025-R0042                  │
│  Recorded: 04 March 2026 at 14:32               │
│  ⏱ Correction window: 46h remaining             │
│                                                  │
│  Original → Corrected                            │
│                                                  │
│  Amount (₹)                                      │
│  ┌──────────┐  →  ┌──────────┐                  │
│  │ 1,200    │     │ 1,100    │                  │
│  └──────────┘     └──────────┘                  │
│                                                  │
│  Mode                                            │
│  ┌──────────┐  →  ┌──────────┐                  │
│  │ Cash     │     │ UPI      │                  │
│  └──────────┘     └──────────┘                  │
│                                                  │
│  Reference                                       │
│  ┌──────────────────────────────────────┐       │
│  │ TXN123456789                         │       │
│  └──────────────────────────────────────┘       │
│                                                  │
│  Reason for Correction *                         │
│  ┌──────────────────────────────────────┐       │
│  │ Entered wrong mode, was UPI not cash │       │
│  └──────────────────────────────────────┘       │
│                                                  │
│               [Cancel]  [Save Correction]        │
└─────────────────────────────────────────────────┘
```

### UI: Payment Reversal (after 48h)

```
┌─────────────────────────────────────────────────┐
│  Reverse Payment                           [✕]  │
│  ───────────────────────────────────────────     │
│                                                  │
│  Receipt: EDENESTATE-2025-R0042                  │
│  Recorded: 01 March 2026 at 10:15               │
│  ⚠ Past 48h correction window — reversal only   │
│                                                  │
│  Original Payment:                               │
│  ┌────────────────────────────────────────┐     │
│  │ Amount: ₹1,200  │  Mode: Cash         │     │
│  │ Resident: Hemant Kumar (S22-H245)      │     │
│  └────────────────────────────────────────┘     │
│                                                  │
│  This will:                                      │
│  • Mark this payment as REVERSED                 │
│  • Create a reversal entry (−₹1,200)            │
│  • Resident's fee status returns to previous     │
│  • Original entry shown struck-through           │
│                                                  │
│  Reason for Reversal *                           │
│  ┌────────────────────────────────────────┐     │
│  │ Payment was recorded for wrong resident│     │
│  └────────────────────────────────────────┘     │
│                                                  │
│             [Cancel]  [Confirm Reversal]         │
└─────────────────────────────────────────────────┘
```

**Components to build**:

- `ExemptionDialog` — Dialog with reason textarea
- `PaymentCorrectionDialog` — Side-by-side original vs corrected fields
- `PaymentReversalDialog` — Confirmation with reason
- `CorrectionWindowBadge` — Shows remaining time for direct correction

**Acceptance**: Exemption sets status + logs reason. Correction within 48h edits in place. Reversal after 48h creates reversal entry. All actions audit-logged. Reversed payments show struck-through.

---

## Task 3.7 — Resident Payment History View

### Backend

- API: `GET /api/v1/residents/[id]/payments` (resident sees own data)
- Returns all fee records + payments for the resident, across sessions

### UI Screen: `/resident/payments`

```
┌─────────────────────────────────────────────────────┐
│  RWA Connect — Eden Estate                           │
│─────────────────────────────────────────────────────│
│                                                      │
│  My Payments                                         │
│                                                      │
│  Current Status                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │  Session 2025-26          🟢 PAID            │    │
│  │  Annual Fee: ₹1,200                          │    │
│  │  Paid: ₹1,200 on 04 Mar 2026                │    │
│  │  Receipt: EDENESTATE-2025-R0042              │    │
│  │                        [Download Receipt]     │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  First Payment (Joining)                             │
│  ┌─────────────────────────────────────────────┐    │
│  │  Joining Fee + Pro-rata    🟢 PAID           │    │
│  │  Joining Fee: ₹1,000                         │    │
│  │  Pro-rata (9 months): ₹900                   │    │
│  │  Total: ₹1,900 on 15 Jul 2025               │    │
│  │  Receipt: EDENESTATE-2025-R0001              │    │
│  │                        [Download Receipt]     │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  Payment History                                     │
│  ───────────────                                     │
│  04 Mar 2026  ₹1,200  Cash    EDENESTATE-2025-R0042 │
│  15 Jul 2025  ₹1,900  UPI     EDENESTATE-2025-R0001 │
│                                                      │
│─────────────────────────────────────────────────────│
│  [🏠 Home]  [💰 Payments]  [📊 Expenses]  [👤 Profile]│
└─────────────────────────────────────────────────────┘
```

**Components to build**:

- `CurrentFeeCard` — Prominent card showing current session status
- `PaymentHistoryList` — Chronological list of all payments
- `ReceiptDownloadButton` — Per-payment download button
- `JoiningFeeCard` — Special card for first-ever payment (shows breakdown)

**Acceptance**: Resident sees all their payments. Current session prominent. Receipt downloadable for each payment. Empty state when no payments yet.

---

## Task 3.8 — Fee Session Management

### Backend

- API: `GET /api/v1/societies/[id]/fees/sessions` — List all sessions
- API: `POST /api/v1/societies/[id]/fees/sessions/open` — Open new session (April 1)
- Auto-session creation: Cron job creates new session record on April 1
- When new session opens:
  1. Create `membership_fees` record for every active resident (status: `NOT_YET_DUE`)
  2. Status transitions to `PENDING` on April 1
  3. Grace period until April 15
  4. After April 15: uncollected fees → `OVERDUE`

### UI: Session Management (within Fee Dashboard)

```
┌─────────────────────────────────────────────────────┐
│  Session Management                                  │
│  ─────────────────                                   │
│                                                      │
│  Current Session: 2025-26 (Apr 2025 — Mar 2026)     │
│  Status: Active                                      │
│  Annual Fee: ₹1,200                                  │
│                                                      │
│  Next Session Fee (editable before April 1)          │
│  ┌────────────────────────────────────────────┐     │
│  │ Annual Fee for 2026-27 (₹) *               │     │
│  │ ┌────────────────────────┐                 │     │
│  │ │ 1,200                  │  Current: ₹1,200│     │
│  │ └────────────────────────┘                 │     │
│  │                                             │     │
│  │ ℹ Changing fee triggers auto-notification   │     │
│  │   to all residents 60 days before session   │     │
│  │                                             │     │
│  │                       [Save Fee for 2026-27]│     │
│  └────────────────────────────────────────────┘     │
│                                                      │
│  Past Sessions                                       │
│  ┌────────────────────────────────────────────┐     │
│  │ Session    │ Fee    │ Collected │ Rate      │     │
│  │────────────│────────│───────────│───────────│     │
│  │ 2025-26   │ ₹1,200 │ 76%       │ Ongoing   │     │
│  │ 2024-25   │ ₹1,000 │ 92%       │ Closed    │     │
│  └────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────┘
```

**Components to build**:

- `SessionManager` — Section showing current + next session config
- `NextSessionFeeForm` — Editable fee for upcoming session
- `PastSessionsTable` — Historical sessions with collection rates

**Acceptance**: Admin can set next session's fee. Fee change stored for future session. Past sessions viewable. Auto-notification on fee change noted.

---

## Phase 3 Definition of Done

- [ ] Fee dashboard shows real aggregated stats per session
- [ ] Status breakdown cards filter the table when clicked
- [ ] Pro-rata calculation correct for all 12 months
- [ ] Payment recording: Cash (no ref required), UPI/Bank (ref required)
- [ ] Receipt number auto-generated in correct format
- [ ] Receipt PDF downloads with all fields populated
- [ ] Fee status transitions enforced (no invalid state changes)
- [ ] Daily cron: NOT_YET_DUE → PENDING (Apr 1), PENDING → OVERDUE (Apr 16)
- [ ] Exemption with mandatory reason, logged in audit trail
- [ ] Correction (within 48h) edits in place with audit log
- [ ] Reversal (after 48h) creates reversal entry, original struck-through
- [ ] Resident portal: current fee status + full payment history
- [ ] Resident can download receipt PDF for any payment
- [ ] Session management: view current, configure next session fee
- [ ] All UI responsive: desktop + tablet + mobile
- [ ] Loading skeletons on all data-fetching screens
