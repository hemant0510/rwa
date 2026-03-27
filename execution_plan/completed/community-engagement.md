# Community Events

**Status:** Planned — post-MVP
**Scope:** Community Events with full financial lifecycle (Petitions deferred → see `petitions.md`)
**Sidebar Label:** Events
**Last Updated:** 2026-03-25

---

## Why This Exists

The RWA app currently manages fees, expenses, and notifications but has no way to organize community events (Diwali, Holi, sports days, workshops), track participation, collect event-specific fees, record event expenses, and show residents where their money went.

This is a standalone post-MVP module absent from the existing MVP and full-spec plans.

> **Note:** The existing `Festival` and `FestivalContribution` models in `schema.prisma` (Phase 2 stubs) are superseded by the new `CommunityEvent` system which is more versatile. Those old models will be deprecated once this module is live.

---

## The Core Problem

Different events have fundamentally different pricing needs:

| Real-World Event          | How Pricing Works                                                                                                                                                                        |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Holi celebration**      | RWA sets a budget (₹50K for DJ + colors + food). First gauge interest — how many people want to join? If 100 join → ₹500/person. If only 50 → ₹1,000/person. Price depends on headcount. |
| **Mata ki Chowki**        | No fixed fee. Anyone contributes what they wish — ₹500 or ₹50,000. It's a voluntary donation.                                                                                            |
| **Yoga Workshop**         | Fixed price: ₹200/person regardless of how many sign up.                                                                                                                                 |
| **AGM / General Meeting** | Free. Just need to know who's attending.                                                                                                                                                 |

A single "fixed fee" field cannot handle all of these. We need **four distinct fee models**.

And after the event, the admin needs to:

- Record what was spent (DJ, food, decorations, etc.)
- Show residents the full financial picture (collected vs spent)
- Handle surplus or deficit (transfer to society fund, carry forward, etc.)

---

## The 4 Fee Models

```
FeeModel:  FREE | FIXED | FLEXIBLE | CONTRIBUTION
```

### 1. FREE — No money, just RSVP

- Admin creates event → publishes → residents tap "I'm In" → done.
- No payment flow at all. Just attendance tracking.
- Can still have expenses (paid from society fund) — e.g., AGM snacks ₹2,000.
- **Examples:** AGM, general body meeting, community cleanup drive.

### 2. FIXED — Price set upfront by admin

- Admin sets the price when creating the event (e.g., ₹200/person).
- Price does NOT change based on how many people register.
- Residents see the price, register, and then pay (offline — admin records payment).
- **Examples:** Workshop, sports tournament entry, swimming pool pass.

### 3. FLEXIBLE — Poll first, set price later based on interest

- **Phase 1 (Poll):** Admin creates event and publishes it as an interest check. No price set yet. Residents express interest ("I'm in, 4 family members"). Admin sees a live interest counter.
- **Phase 2 (Payment):** Once admin sees enough interest, they set the final price (e.g., ₹500/person) and trigger payment. All interested residents get notified with the price. Admin then collects and records payments.
- The per-person price can be calculated by admin: `budget ÷ interested people = price per head`.
- **Examples:** Holi celebration, community dinner, Diwali party, New Year's Eve, picnic.

### 4. CONTRIBUTION — Open voluntary donation

- No fixed fee. Residents contribute any amount they wish.
- Admin publishes event → residents indicate participation → admin records each contribution with the actual amount given.
- ₹500 from one household, ₹5,000 from another — all tracked individually.
- Admin can optionally set a `suggestedAmount` as a hint (not enforced).
- **Examples:** Mata ki Chowki, Satyanarayan Puja, charity collection, temple renovation fund.

---

## Charge Unit — Per Person vs Per Household

```
ChargeUnit:  PER_PERSON | PER_HOUSEHOLD
```

Admin selects this when creating an event. It determines how fees are calculated.

| Charge Unit       | How it works                                                                             | When to use                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **PER_PERSON**    | Resident selects how many family members will attend (1–10). Fee = price × member count. | Holi (each person eats, plays), workshop (individual seats), picnic (per head catering).   |
| **PER_HOUSEHOLD** | One fee per flat/unit regardless of family size.                                         | Diwali decoration charge, society anniversary, Mata ki Chowki (one contribution per home). |

**How it applies per fee model:**

| Fee Model        | chargeUnit effect                                                                                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FIXED**        | Determines fee calculation: PER_PERSON = feeAmount × memberCount, PER_HOUSEHOLD = feeAmount flat.                                                                                           |
| **FLEXIBLE**     | Same as FIXED (after price is set). During polling, determines whether member count selector is shown.                                                                                      |
| **CONTRIBUTION** | Determines registration type: PER_PERSON = resident selects member count (for headcount), PER_HOUSEHOLD = one registration per flat. Does NOT affect payment amount (always admin-entered). |
| **FREE**         | chargeUnit is always `PER_HOUSEHOLD` (auto-set, not shown in form). One RSVP per flat, no member count selector. Keeps it simple — just "I'm in."                                           |

---

## Complete Event Lifecycle

Every event goes through these phases:

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│   Step 1: CREATE & PUBLISH                                           │
│   Admin fills in event details, picks fee model, publishes.          │
│   Residents see the event and respond.                               │
│                                                                      │
│          ↓                                                           │
│                                                                      │
│   Step 2: TRIGGER PAYMENT  (FLEXIBLE only — skipped for others)      │
│   Admin reviews interest count, sets the final per-head price,       │
│   clicks "Set Price & Notify". All interested residents get          │
│   notified with the amount due.                                      │
│                                                                      │
│          ↓                                                           │
│                                                                      │
│   Step 3: COLLECT & TRACK                                            │
│   Resident pays offline (cash/UPI). Admin opens the app,             │
│   finds the resident, taps "Record Payment", enters mode             │
│   and reference. Receipt auto-generated.                             │
│                                                                      │
│          ↓                                                           │
│                                                                      │
│   Step 4: COMPLETE & ADD EXPENSES                                    │
│   Admin marks event as completed after it happens.                   │
│   Admin records all expenses (DJ, food, decorations, etc.)           │
│   linked to this event. Can add expenses before/during/after event.  │
│                                                                      │
│          ↓                                                           │
│                                                                      │
│   Step 5: SETTLE                                                     │
│   Admin reviews financial summary (collected vs spent).              │
│   Records what happens to surplus/deficit.                           │
│   Residents can now see the full financial breakdown.                │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Event States

```
EventStatus:  DRAFT | PUBLISHED | COMPLETED | CANCELLED
```

```
DRAFT → PUBLISHED → COMPLETED
                  ↘ CANCELLED
```

- **DRAFT** — Created by admin, not visible to residents. Can be edited freely.
- **PUBLISHED** — Visible to residents. Accepting registrations/interest.
  - For FLEXIBLE events: this is the "polling phase" until admin triggers payment.
  - For FIXED events: residents can register and payment collection is immediately open.
  - For FREE events: residents RSVP.
  - For CONTRIBUTION events: residents indicate participation, admin records contributions.
- **COMPLETED** — Event has happened. No more registrations. Admin adds expenses and settles.
- **CANCELLED** — Admin cancelled the event with a reason. All registrants are notified.

**Important:** There is NO separate "POLLING" state. The polling phase for FLEXIBLE events is determined by: `status === PUBLISHED && feeModel === FLEXIBLE && feeAmount === null`. When admin sets the price (triggers payment), `feeAmount` gets set — that's what transitions the event from polling to payment collection. This keeps the state machine simple.

**Important:** There is NO separate "SETTLED" state. Settlement is tracked via the `settledAt` field on the event. An event can be COMPLETED but not yet settled (expenses still being added) or COMPLETED and settled (financial picture finalized).

---

## Event Categories

```
EventCategory:  FESTIVAL | SPORTS | WORKSHOP | CULTURAL | MEETING | OTHER
```

Just a label for filtering/display. No business logic attached to categories.

---

## Create Event Form — Fields Per Fee Model

When admin selects a fee model, the form shows/hides fields dynamically:

| Field                 | FREE                        | FIXED            | FLEXIBLE                       | CONTRIBUTION     |
| --------------------- | --------------------------- | ---------------- | ------------------------------ | ---------------- |
| Title                 | ✅                          | ✅               | ✅                             | ✅               |
| Description           | ✅                          | ✅               | ✅                             | ✅               |
| Category              | ✅                          | ✅               | ✅                             | ✅               |
| Event Date            | ✅                          | ✅               | ✅                             | ✅               |
| Location              | ✅                          | ✅               | ✅                             | ✅               |
| Charge Unit           | Hidden (auto PER_HOUSEHOLD) | ✅               | ✅                             | ✅               |
| Fee Amount            | Hidden                      | ✅ Required, > 0 | Hidden (set later via trigger) | Hidden           |
| Estimated Budget      | Hidden                      | Hidden           | ✅ Optional, > 0               | Hidden           |
| Min Participants      | Hidden                      | Hidden           | ✅ Optional, ≥ 1               | Hidden           |
| Max Participants      | ✅ Optional                 | ✅ Optional      | ✅ Optional                    | ✅ Optional      |
| Suggested Amount      | Hidden                      | Hidden           | Hidden                         | ✅ Optional, > 0 |
| Registration Deadline | ✅ Optional                 | ✅ Optional      | ✅ Optional                    | ✅ Optional      |

**Validation rules for event creation:**

- `title`: required, 3–200 characters.
- `category`: required, must be valid EventCategory.
- `eventDate`: required, must be in the future.
- `registrationDeadline`: if set, must be before `eventDate`.
- `feeAmount`: required and > 0 for FIXED; must be null/absent for FREE, FLEXIBLE, CONTRIBUTION.
- `estimatedBudget`: if provided, must be > 0. Only meaningful for FLEXIBLE.
- `minParticipants`: if provided, must be ≥ 1. Only meaningful for FLEXIBLE.
- `maxParticipants`: if provided, must be ≥ 1. For PER_PERSON events, this is total people (not registrations).
- `suggestedAmount`: if provided, must be > 0. Only meaningful for CONTRIBUTION.

---

## Registration States

```
RegistrationStatus:  INTERESTED | PENDING | CONFIRMED | CANCELLED
```

```
INTERESTED → PENDING → CONFIRMED
                    ↘ CANCELLED
```

The registration state depends on the fee model:

| Fee Model        | Register                    | After Admin Triggers Payment  | After Payment Recorded                 |
| ---------------- | --------------------------- | ----------------------------- | -------------------------------------- |
| **FREE**         | → `CONFIRMED` (immediately) | N/A                           | N/A                                    |
| **FIXED**        | → `PENDING`                 | N/A (payment open from start) | → `CONFIRMED`                          |
| **FLEXIBLE**     | → `INTERESTED`              | → `PENDING` (bulk transition) | → `CONFIRMED`                          |
| **CONTRIBUTION** | → `CONFIRMED` (immediately) | N/A                           | N/A (contribution recorded separately) |

**Details:**

- **INTERESTED** — Resident has expressed interest but no price has been set yet. Only used for FLEXIBLE events during the polling phase. The resident has also submitted their `memberCount`.
- **PENDING** — Resident is registered and owes money. Waiting for admin to record their payment.
  - For FIXED: set immediately upon registration.
  - For FLEXIBLE: set when admin triggers payment (bulk transition from INTERESTED → PENDING for all interested residents).
- **CONFIRMED** — Fully confirmed. Either payment recorded (FIXED/FLEXIBLE) or no payment needed (FREE/CONTRIBUTION).
- **CANCELLED** — Resident cancelled their registration, or admin cancelled it. `cancelledAt` timestamp is set.

**Member count is immutable after registration.** Once a resident submits their member count, it cannot be changed. If they need to adjust (e.g., said 4 but only 2 are coming), they must cancel their registration (if allowed — INTERESTED or PENDING status) and re-register with the correct count. This prevents mid-flow amount recalculations and keeps the system simple.

---

## Detailed Flow Per Fee Model

### FREE Event Flow

```
Admin: Create event → Publish
Resident: See event → Tap "I'm In" → CONFIRMED
Admin: See RSVP list → Mark completed after event
Admin: Add expenses (snacks ₹2,000, chair rental ₹1,500) → Settle
Financial summary: Collected ₹0, Spent ₹3,500, Deficit ₹3,500 — from society fund
```

No money collected, but expenses still tracked. Deficit covered from society fund.

### FIXED Event Flow

```
Admin: Create event (set ₹200/person, PER_PERSON) → Publish
Resident: See event with price → Tap "Register" → Select 3 family members → PENDING (₹600 due)
Resident: Pay ₹600 cash/UPI to admin offline
Admin: Open event → Find resident → "Record Payment" (₹600, UPI, ref: xyz123) → CONFIRMED
Receipt auto-generated: EVT-EDEN-2026-00042
Admin: Mark completed → Add expenses → Settle
Financial summary: Collected ₹5,000, Spent ₹4,200, Surplus ₹800 → transferred to society fund
```

### FLEXIBLE Event Flow (Holi Example)

```
Phase 1 — Polling:
  Admin: Create event (FLEXIBLE, PER_PERSON, budget ₹50,000, min 100 people) → Publish
  Resident A: See event → "I'm Interested" → Select 4 members → INTERESTED
  Resident B: See event → "I'm Interested" → Select 2 members → INTERESTED
  ...more residents respond...
  Admin dashboard shows: "73 people interested from 38 households"

Phase 2 — Trigger Payment:
  Admin decides: 73 people is enough. ₹50,000 ÷ 73 ≈ ₹685/person.
  Admin clicks "Set Price & Notify" → enters ₹685/person → confirms.
  System: Sets feeAmount = 685 on the event.
  System: Bulk-transitions all INTERESTED registrations → PENDING.
  System: Calculates amount due per registration (₹685 × memberCount).
  System: Sends WhatsApp notification to all: "Holi confirmed! ₹685/person."

  Resident A: Now sees "₹2,740 due (4 members × ₹685)"
  Resident B: Now sees "₹1,370 due (2 members × ₹685)"

Phase 3 — Collect:
  Admin: Records payments as residents pay in cash/UPI.
  Dashboard: "Paid: 45/73 people · ₹30,825 collected"

Phase 4 — Complete & Expenses:
  Admin: Marks event completed.
  Admin: Adds expenses: DJ ₹15,000, Colors ₹8,000, Food ₹18,000, Decor ₹5,000, Cleanup ₹3,000.

Phase 5 — Settle:
  Admin: Reviews financial summary → Collected ₹50,005, Spent ₹49,000, Surplus ₹1,005.
  Admin: Settles → "Transfer surplus to society fund."
  Residents: Can now see full expense breakdown on event detail.

Late joiners:
  After payment is triggered, new residents CAN still register.
  They register directly as PENDING (not INTERESTED) since the price is already set.
```

### CONTRIBUTION Event Flow (Mata ki Chowki Example)

```
Admin: Create event (CONTRIBUTION, PER_HOUSEHOLD, suggested ₹500) → Publish
Resident: See event → "I'm Participating" → CONFIRMED
Admin: Sharma (A-101) gives ₹2,000 cash → Record Payment (₹2,000, CASH)
Admin: Kumar (A-102) gives ₹500 UPI → Record Payment (₹500, UPI, ref: xyz)
Admin: Gupta (B-201) gives ₹5,000 cash → Record Payment (₹5,000, CASH)
Dashboard: "Total collected: ₹7,500 from 3 households"

Admin: Marks completed → Adds expenses: Pandit ₹5,000, Prasad ₹15,000 → Settle
Financial summary: Collected ₹42,500, Spent ₹20,000, Surplus ₹22,500 → carry forward
```

For CONTRIBUTION: registration is `CONFIRMED` immediately (participation is not gated by payment). Payments are recorded separately and are voluntary. A resident can participate without contributing — their registration is still CONFIRMED.

---

## Amount Calculation Logic

When admin records a payment, the expected amount depends on the fee model:

| Fee Model                    | How amount is determined                                                     |
| ---------------------------- | ---------------------------------------------------------------------------- |
| **FREE**                     | No payment.                                                                  |
| **FIXED + PER_PERSON**       | `event.feeAmount × registration.memberCount`                                 |
| **FIXED + PER_HOUSEHOLD**    | `event.feeAmount` (flat, regardless of members)                              |
| **FLEXIBLE + PER_PERSON**    | `event.feeAmount × registration.memberCount` (feeAmount set at trigger time) |
| **FLEXIBLE + PER_HOUSEHOLD** | `event.feeAmount` (set at trigger time)                                      |
| **CONTRIBUTION**             | Admin enters any amount at recording time. No pre-calculated "due" amount.   |

The `amountDue` is NOT stored in the database — it's computed on the fly:

- `amountDue = (chargeUnit === PER_PERSON) ? feeAmount * memberCount : feeAmount`
- For CONTRIBUTION: `amountDue = null` (no fixed expectation)

---

## Post-Event Financial Lifecycle

### How Expenses Link to Events

The app already has a full `Expense` model (categories, amounts, receipts, recorded-by, reversal). Instead of building a parallel "event expense" system, we **add an optional `eventId` FK to the existing `Expense` table**.

This means:

- When admin records a Holi DJ expense (₹15,000), they link it to the Holi event.
- That expense shows up in **both** the society's general expense list AND the event's financial summary.
- No new table, no duplicate logic, single source of truth for all money flowing out.
- The event detail page shows a filtered view: all expenses where `eventId` = this event.

**Important — Society balance calculation:** Event-linked expenses (where `eventId IS NOT NULL`) must be **excluded** from the society's general balance calculation. The society balance formula is:

```
Society Balance = SUM(membership_fee_payments) - SUM(expenses WHERE eventId IS NULL AND status = ACTIVE)
```

Event finances are self-contained:

```
Event Net = SUM(event_payments for this event) - SUM(expenses WHERE eventId = this event AND status = ACTIVE)
```

If we included event expenses in the society balance but not event income, the balance would look artificially low. Keeping them separate is cleaner. When surplus is "transferred to society fund," it's an informational record — the money was always in the same bank account.

### Impact on Existing Expenses Page

The existing society Expenses page (`/admin/expenses`) needs minor updates:

- **Event badge on linked expenses:** Expenses with `eventId` show a small badge: "[Holi 2026]" or "[Event: Mata ki Chowki]" next to the description.
- **Filter addition:** Add a filter toggle: "All expenses" / "General only" / "Event only" (default: "All expenses").
- **"Link to Event" dropdown on expense creation:** When creating an expense from the general Expenses page, show an optional "Link to Event" dropdown listing PUBLISHED and COMPLETED events. If selected, the expense's `eventId` is set.
- **Balance display:** The society balance at the top of the Expenses page should exclude event-linked expenses (as per formula above). A tooltip or footnote can clarify: "Event expenses are tracked separately under each event."

### When Can Admin Add Expenses?

- **Before the event** — advance deposits, material purchases, venue booking.
- **During the event** — day-of expenses.
- **After COMPLETED** — final payments, cleanup costs, vendor settlements.
- **After SETTLED** — admin can still add/edit if they forgot something (settlement is re-opened automatically).
- No hard time restriction. Admin adds expenses whenever they come in.

### Adding Expenses from Event Detail

On the admin event detail page → "Finances" tab → "Add Expense" button:

```
┌─────────────────────────────────────────────┐
│  Add Event Expense                           │
│                                              │
│  Description:  [ DJ & Sound System        ]  │
│  Amount:       [ ₹15,000                  ]  │
│  Category:     [ OTHER                 ▾  ]  │
│  Date:         [ 15-03-2026               ]  │
│  Receipt:      [ Upload receipt image  📎 ]  │
│                                              │
│              [ Cancel ]  [ Save ]            │
└─────────────────────────────────────────────┘
```

This creates a regular `Expense` record in the existing expenses table with `eventId` set to this event. The expense uses the existing `ExpenseCategory` enum (MAINTENANCE, SECURITY, CLEANING, STAFF_SALARY, INFRASTRUCTURE, UTILITIES, EMERGENCY, ADMINISTRATIVE, OTHER).

Admin can also add event expenses from the normal Expenses page and optionally select an event from a "Link to Event" dropdown. Both paths create the same record.

### Financial Summary

The event detail page shows a "Finances" section with live-calculated numbers:

```
totalCollected  = SUM(event_payments.amount) WHERE event's registrations
totalExpenses   = SUM(expenses.amount) WHERE eventId = this event AND status = ACTIVE
netAmount       = totalCollected - totalExpenses
```

- Positive net = surplus (collected more than spent)
- Negative net = deficit (spent more than collected)
- Zero = perfectly balanced

### Settlement — What Happens to Surplus/Deficit

After admin has added all expenses, they click **"Settle Event"**:

```
┌─────────────────────────────────────────────────┐
│  Settle Event — Holi 2026                        │
│                                                   │
│  Collected:    ₹50,005                           │
│  Spent:        ₹49,000                           │
│  Surplus:      ₹1,005                            │
│                                                   │
│  What to do with the surplus?                    │
│  ○ Transfer to society general fund              │
│  ○ Carry forward for next event                  │
│  ○ Refund to participants                        │
│                                                   │
│  Notes: [ Added to Q1 2026 society fund       ]  │
│                                                   │
│              [ Cancel ]  [ Confirm Settlement ]  │
└─────────────────────────────────────────────────┘
```

**Surplus options** (reuse existing `DisposalType` enum already in schema):

- `TRANSFERRED_TO_FUND` — Most common. Surplus goes to society's general fund.
- `CARRIED_FORWARD` — Saved for next similar event (e.g., "Diwali fund").
- `REFUNDED` — Proportional refund to participants. Admin handles actual refund offline. System just records the decision.

**Deficit scenario** (spent more than collected):

- Same dialog but shows "Deficit: ₹3,000" instead of "Surplus."
- Disposition options for deficit:
  - `FROM_SOCIETY_FUND` — Society general fund absorbs it (most common).
  - `ADDITIONAL_COLLECTION` — Admin will collect more from participants (rare, handled offline).
- In practice, deficit is almost always covered from society fund.

**After settlement:**

- `settledAt` timestamp is set on the event.
- `surplusAmount` stored (positive = surplus, negative = deficit).
- `surplusDisposal` stored (DisposalType — reuse existing enum).
- `settlementNotes` stored (optional text).
- Settlement is **informational, not a hard lock**. Admin can still add/edit expenses after settling. If they do, settlement data becomes stale — the UI shows a warning: "Expenses changed since last settlement. Consider re-settling." Admin can re-settle to update the numbers.

### Deficit Disposition

The existing `DisposalType` enum covers surplus scenarios. For deficit we add one new enum:

```
DeficitDisposition:  FROM_SOCIETY_FUND | ADDITIONAL_COLLECTION
```

We store surplus and deficit disposition in separate fields so the type system is clean:

- Surplus → uses `DisposalType` (existing enum: REFUNDED, TRANSFERRED_TO_FUND, CARRIED_FORWARD)
- Deficit → uses `DeficitDisposition` (new enum: FROM_SOCIETY_FUND, ADDITIONAL_COLLECTION)
- Only one is applicable per event (can't have both surplus and deficit).

---

## What the Admin Sees — Dashboard Views

### Event List Page (`/admin/events`)

- Table/card list of all events with: name, date, category badge, fee model badge, status badge, registrant count.
- Filters: by status (DRAFT / PUBLISHED / COMPLETED / CANCELLED), by category.
- **Default sort:** PUBLISHED events first (by event date ascending), then DRAFT, then COMPLETED (by event date descending), then CANCELLED.
- "Create Event" button.
- For COMPLETED events: shows "Settled ✓" or "Pending settlement" badge.
- Nudge badge on page header: "3 events pending settlement" if there are COMPLETED unsettled events.

### Event Detail Page (`/admin/events/[eventId]`)

The detail page has **3 tabs**: **Registrations** | **Finances** | **Details**

**Header section (always visible):**

- Event name, date, location, category, description.
- Status badge. Fee model badge. Charge unit badge.
- Action buttons: Edit (if DRAFT), Delete (if DRAFT), Publish (if DRAFT), Cancel (if PUBLISHED), Complete (if PUBLISHED).

---

#### Tab: Registrations

**During POLLING phase (FLEXIBLE + feeAmount is null):**

```
┌──────────────────────────────────────────────────────────┐
│  Holi 2026 · 15 Mar · Club House           POLLING      │
│  FLEXIBLE · PER_PERSON · Budget: ₹50,000                │
│  Minimum: 100 people                                     │
│                                                          │
│  Interested: 73 people from 38 households                │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━ 73/100 minimum             │
│  Estimated per-person: ₹685 (₹50,000 ÷ 73)             │
│                                                          │
│  ┌────────┬────────────┬─────────┬───────────┐          │
│  │ Flat   │ Name       │ Members │ Status    │          │
│  ├────────┼────────────┼─────────┼───────────┤          │
│  │ A-101  │ Sharma     │ 4       │ Interested│          │
│  │ A-102  │ Kumar      │ 2       │ Interested│          │
│  │ B-201  │ Gupta      │ —       │ No reply  │          │
│  └────────┴────────────┴─────────┴───────────┘          │
│                                                          │
│  [ Set Price & Trigger Payment ]                         │
└──────────────────────────────────────────────────────────┘
```

**"Set Price & Trigger Payment" dialog:**

- Input: "Price per person/household: ₹\_\_\_"
- Shows: "This will notify X residents. Total expected collection: ₹Y."
- Confirm button.

**During PAYMENT phase (FIXED, or FLEXIBLE after trigger):**

```
┌──────────────────────────────────────────────────────────┐
│  Holi 2026 · 15 Mar · Club House          COLLECTING    │
│  ₹685/person · PER_PERSON                               │
│                                                          │
│  Paid: 45/73 people · ₹30,825 / ₹50,005 collected      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━ 62%                        │
│                                                          │
│  ┌────────┬────────┬──────┬──────────┬────────────────┐ │
│  │ Flat   │ Name   │ Ppl  │ Due      │ Status         │ │
│  ├────────┼────────┼──────┼──────────┼────────────────┤ │
│  │ A-101  │ Sharma │ 4    │ ₹2,740   │ ✅ PAID (UPI)  │ │
│  │ A-102  │ Kumar  │ 2    │ ₹1,370   │ ⏳ UNPAID      │ │
│  │ A-103  │ Verma  │ 3    │ ₹2,055   │ ⏳ UNPAID      │ │
│  └────────┴────────┴──────┴──────────┴────────────────┘ │
│                                          [Record Payment]│
└──────────────────────────────────────────────────────────┘
```

**"Record Payment" dialog (opened per resident):**

- Shows: Resident name, flat, member count, amount due.
- Inputs: Payment mode (CASH / UPI / BANK_TRANSFER / OTHER), Reference No (optional), Notes (optional).
- For CONTRIBUTION events: amount is an editable input (not pre-filled).
- For FIXED/FLEXIBLE: amount is pre-filled (feeAmount × memberCount) and read-only.
- Confirm button → receipt generated, status → CONFIRMED.

**For CONTRIBUTION events:**

```
┌──────────────────────────────────────────────────────────┐
│  Mata ki Chowki · 8 Apr · Community Hall   PUBLISHED    │
│  CONTRIBUTION · PER_HOUSEHOLD · Suggested: ₹500         │
│                                                          │
│  Total collected: ₹42,500 from 28 households            │
│  Participants: 45 households                             │
│                                                          │
│  ┌────────┬────────────┬────────────┬────────────────┐  │
│  │ Flat   │ Name       │ Contributed│ Status         │  │
│  ├────────┼────────────┼────────────┼────────────────┤  │
│  │ A-101  │ Sharma     │ ₹2,000    │ ✅ Contributed  │  │
│  │ A-102  │ Kumar      │ ₹500      │ ✅ Contributed  │  │
│  │ B-201  │ Gupta      │ —         │ Participating  │  │
│  └────────┴────────────┴────────────┴────────────────┘  │
│                                     [Record Contribution]│
└──────────────────────────────────────────────────────────┘
```

**For FREE events:**

```
┌──────────────────────────────────────────────────────────┐
│  Annual General Meeting · 20 Apr · Hall    PUBLISHED     │
│  FREE                                                    │
│                                                          │
│  Attending: 52 residents from 42 households              │
│                                                          │
│  ┌────────┬────────────┬───────────┐                    │
│  │ Flat   │ Name       │ Status    │                    │
│  ├────────┼────────────┼───────────┤                    │
│  │ A-101  │ Sharma     │ ✅ Going   │                    │
│  │ A-102  │ Kumar      │ ✅ Going   │                    │
│  │ B-201  │ Gupta      │ No reply  │                    │
│  └────────┴────────────┴───────────┘                    │
└──────────────────────────────────────────────────────────┘
```

---

#### Tab: Finances

Visible for all events (even FREE events can have expenses). Shows live-calculated numbers.

**Before settlement:**

```
┌──────────────────────────────────────────────────────────┐
│  Finances                                    Not Settled │
│                                                          │
│  Collection                                              │
│  Total Collected:     ₹50,005  (73 residents paid)      │
│  Still Pending:       ₹1,370   (2 residents unpaid)     │
│                                                          │
│  Expenses                            [+ Add Expense]    │
│  ┌───────────────────┬──────────┬─────────────────────┐ │
│  │ Description       │ Amount   │ Date                │ │
│  ├───────────────────┼──────────┼─────────────────────┤ │
│  │ DJ & Sound        │ ₹15,000  │ 15 Mar 2026        │ │
│  │ Colors & Balloons │ ₹8,000   │ 14 Mar 2026        │ │
│  │ Food & Drinks     │ ₹18,000  │ 15 Mar 2026        │ │
│  │ Decorations       │ ₹5,000   │ 15 Mar 2026        │ │
│  │ Cleanup Crew      │ ₹3,000   │ 16 Mar 2026        │ │
│  └───────────────────┴──────────┴─────────────────────┘ │
│  Total Expenses:      ₹49,000                           │
│                                                          │
│  ─────────────────────────────────                      │
│  Net Surplus:         ₹1,005  ✅                        │
│                                                          │
│  [ Settle Event ]                                        │
└──────────────────────────────────────────────────────────┘
```

**After settlement:**

```
┌──────────────────────────────────────────────────────────┐
│  Finances                               Settled ✓       │
│                                         25 Mar 2026     │
│                                                          │
│  Collection                                              │
│  Total Collected:     ₹50,005                           │
│                                                          │
│  Expenses                                                │
│  DJ & Sound           ₹15,000                           │
│  Colors & Balloons    ₹8,000                            │
│  Food & Drinks        ₹18,000                           │
│  Decorations          ₹5,000                            │
│  Cleanup Crew         ₹3,000                            │
│  Total Expenses:      ₹49,000                           │
│                                                          │
│  ─────────────────────────────────                      │
│  Surplus:             ₹1,005                            │
│  Disposition:         Transferred to society fund       │
│  Notes:               Added to Q1 2026 fund             │
│                                                          │
│                                     [+ Add Expense]     │
│                                     [Re-settle]         │
└──────────────────────────────────────────────────────────┘
```

**For FREE events (expenses only, no collection):**

```
┌──────────────────────────────────────────────────────────┐
│  Finances                                                │
│                                                          │
│  Collection: N/A (free event)                            │
│                                                          │
│  Expenses                            [+ Add Expense]    │
│  Snacks & Tea         ₹2,000                            │
│  Chair Rental         ₹1,500                            │
│  Total Expenses:      ₹3,500                            │
│                                                          │
│  ─────────────────────────────────                      │
│  Deficit:             ₹3,500                            │
│  Disposition:         From society fund                  │
└──────────────────────────────────────────────────────────┘
```

---

#### Tab: Details

Shows the event creation fields (title, description, category, fee model, charge unit, date, location, deadline, budget, min/max participants, suggested amount). Read-only after PUBLISHED.

---

## What the Resident Sees

### Events Page (`/r/events`)

- Card grid of upcoming published events.
- Each card shows: event name, date, location, category badge, fee model badge.
- Fee display varies:
  - FREE: "Free Event"
  - FIXED: "₹200/person" or "₹500/household"
  - FLEXIBLE (polling): "Interest check — pricing TBD" + "73 interested"
  - FLEXIBLE (payment open): "₹685/person"
  - CONTRIBUTION: "Open contribution (suggested ₹500)"
- Spots badge if maxParticipants is set: "12 spots left"
- Registration deadline if set.
- Status badge if already registered: "You're interested" / "Payment due: ₹2,740" / "Confirmed"
- COMPLETED events with settlement show a "View Summary" link.

### Event Detail (opens as a Sheet/Drawer from the card, not a separate page)

Shows full event details + the action button:

| Fee Model + Phase       | Button                   | After tap                                                                           |
| ----------------------- | ------------------------ | ----------------------------------------------------------------------------------- |
| FREE                    | "I'm In"                 | Instantly CONFIRMED. Button changes to "Going ✓"                                    |
| FIXED                   | "Register (₹200/person)" | Member count selector → confirm → PENDING. Shows "₹600 due — pay admin"             |
| FLEXIBLE (polling)      | "I'm Interested"         | Member count selector → confirm → INTERESTED. Shows "You're interested (4 members)" |
| FLEXIBLE (payment open) | "₹2,740 due"             | Read-only status. Shows "Pay admin and they'll record it."                          |
| CONTRIBUTION            | "I'm Participating"      | Instantly CONFIRMED. Shows "Participating ✓"                                        |
| Already registered      | "Cancel Registration"    | Cancels. Only available before event date.                                          |

**Member count selector (PER_PERSON events):**

- Simple stepper: "How many family members? [−] 4 [+]" (min 1, max 10)
- Shows calculated amount for FIXED: "4 × ₹200 = ₹800"
- Only shown for PER_PERSON events. PER_HOUSEHOLD events don't show this.

### Financial Summary for Residents (after COMPLETED + SETTLED)

After an event is completed and settled, residents see a "Financial Summary" section on the event detail:

```
┌──────────────────────────────────────────────┐
│  Holi 2026 — Financial Summary               │
│                                               │
│  Total Collected:    ₹50,005                 │
│  Total Expenses:     ₹49,000                 │
│  Surplus:            ₹1,005                  │
│  Disposition:        Added to society fund    │
│                                               │
│  Expense Breakdown:                           │
│  DJ & Sound          ₹15,000                 │
│  Colors              ₹8,000                  │
│  Food & Drinks       ₹18,000                 │
│  Decorations         ₹5,000                  │
│  Cleanup             ₹3,000                  │
└──────────────────────────────────────────────┘
```

**Residents see:** Description and amount for each expense.
**Residents do NOT see:** Receipt images, admin notes, vendor details, internal expense IDs. Just the description and amount — enough for transparency without exposing operational details.

**Visibility rules:**

- During PUBLISHED: Residents see collection progress only (who paid, total collected). No expenses.
- After COMPLETED but NOT settled: Residents see "Event completed. Financial summary coming soon."
- After COMPLETED + SETTLED: Residents see full financial summary with expense breakdown.

---

## Admin — Complete Action List

| Action                      | Where                                                                | Conditions                                                                          |
| --------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Create event                | Events list → "Create Event"                                         | Always available                                                                    |
| Edit event details          | Event detail → Details tab → Edit                                    | Only when DRAFT                                                                     |
| Delete event                | Event detail → Delete                                                | Only when DRAFT (no registrations)                                                  |
| Publish event               | Event detail → Publish                                               | Only when DRAFT                                                                     |
| Set price & trigger payment | Event detail → Registrations tab → "Set Price & Notify"              | Only for FLEXIBLE events in polling phase                                           |
| Record payment              | Event detail → Registrations tab → registrant row → "Record Payment" | PENDING registrations (FIXED/FLEXIBLE) or any CONFIRMED registration (CONTRIBUTION) |
| Cancel event (with reason)  | Event detail → Cancel                                                | When PUBLISHED (not COMPLETED)                                                      |
| Mark completed              | Event detail → Complete                                              | When PUBLISHED                                                                      |
| Add expense to event        | Event detail → Finances tab → "Add Expense"                          | When PUBLISHED or COMPLETED                                                         |
| View financial summary      | Event detail → Finances tab                                          | Always (shows live numbers)                                                         |
| Settle event                | Event detail → Finances tab → "Settle Event"                         | When COMPLETED and at least one expense exists (or event has collections)           |
| Re-settle event             | Event detail → Finances tab → "Re-settle"                            | When already settled but expenses changed                                           |
| View registrant list        | Event detail → Registrations tab                                     | Always (shows different columns per phase)                                          |

---

## Resident — Complete Action List

| Action                     | Where                                                      | Conditions                                           |
| -------------------------- | ---------------------------------------------------------- | ---------------------------------------------------- |
| Browse events              | Events page                                                | Only PUBLISHED + COMPLETED events shown              |
| View event details         | Events → tap card                                          | Any published/completed event                        |
| Express interest           | Event detail → "I'm Interested"                            | FLEXIBLE events in polling phase, not yet registered |
| Register                   | Event detail → "Register" / "I'm In" / "I'm Participating" | FIXED/FREE/CONTRIBUTION events, not yet registered   |
| Select family member count | Registration flow                                          | PER_PERSON events only                               |
| Cancel registration        | Event detail → "Cancel"                                    | Before event date, not yet CONFIRMED with payment    |
| View financial summary     | Event detail → after settled                               | COMPLETED + SETTLED events only                      |

---

## Edge Cases & Rules

1. **Late joiners (FLEXIBLE events):** After admin triggers payment, new residents can still register. They go directly to `PENDING` (not `INTERESTED`) since the price is already set. They see the same price as everyone else.

2. **Drop-outs after interest:** During polling phase, a resident can cancel their interest. After payment is triggered, a PENDING resident can also cancel (but admin should be aware the per-person math may change). The system does NOT auto-recalculate prices — admin decides if adjustment is needed.

3. **Max participants:** If `maxParticipants` is set and reached, the "Register" / "I'm Interested" button is disabled. Shows "Event full" message. For PER_PERSON events, `maxParticipants` counts total people (sum of all memberCount), not registrations.

4. **Registration deadline:** If `registrationDeadline` has passed, registration buttons are disabled. Shows "Registration closed" message.

5. **Cancelling a PUBLISHED event:** Admin provides a cancellation reason (required text field). All registrants receive a WhatsApp notification. All registrations are soft-cancelled (status → CANCELLED). No automatic refund handling — admin manages refunds offline if needed.

6. **Editing events:** Only allowed in DRAFT state. Once published, only cancellation or completion is allowed — no editing event details. This prevents confusion (e.g., changing date after people registered).

7. **Contribution + no registration:** For CONTRIBUTION events, admin can record a payment even for a resident who didn't formally register (they just walked up and contributed). In this case, a registration is auto-created with status CONFIRMED + payment recorded.

8. **Receipt number format:** `EVT-{societyCode}-{year}-{sequence}`. Example: `EVT-EDEN-2026-00042`. Global sequence per society, not per event.

9. **Expenses before completion:** Admin can add expenses linked to an event even while the event is still PUBLISHED (advance payments, booking deposits). The Finances tab shows them immediately.

10. **Re-settlement:** If admin adds an expense after settling, the UI shows a warning: "Expenses changed since settlement on [date]. Financial summary may be outdated." Admin can click "Re-settle" to update surplusAmount and disposition.

11. **Expenses from general Expenses page:** When admin creates an expense from the regular Expenses page, they see an optional "Link to Event" dropdown listing all PUBLISHED and COMPLETED events. If selected, the expense's `eventId` is set.

12. **Reversed expenses:** If an event-linked expense is reversed (existing reversal flow), it's excluded from the financial summary (only ACTIVE expenses are counted).

13. **FREE events with expenses:** An AGM might cost ₹3,500 in snacks/chairs but collect ₹0. The financial summary shows a deficit. Settlement records it as "From society fund."

14. **Unsettled old events:** Not enforced — settlement is optional. A gentle badge on the Events list ("3 events pending settlement") nudges the admin but doesn't block anything.

15. **Deleting DRAFT events:** Admin can delete an event in DRAFT state (no registrations exist). Once published, deletion is NOT allowed — only cancellation. The delete button appears only on DRAFT events in the event detail header.

16. **Trigger-payment requires interest:** The "Set Price & Trigger Payment" action validates that at least 1 INTERESTED registration exists. Admin cannot trigger payment on a FLEXIBLE event with zero interest — there's no one to notify.

17. **Late payments after COMPLETED:** Admin can still record payments for PENDING registrations after the event is COMPLETED. This handles "resident paid on the day of the event but admin recorded it the next day." The Registrations tab remains functional in COMPLETED state, but new registrations are NOT allowed.

18. **Zero net at settlement:** If collected exactly equals spent (net = ₹0), the settlement dialog shows "Balanced: ₹0" with no disposition options (nothing to dispose of). Admin just adds optional notes and confirms.

19. **Member count for PER_HOUSEHOLD events:** `member_count` is always set to 1 for PER_HOUSEHOLD events. The member count selector is NOT shown during registration. The field exists in the DB but is unused for fee calculation.

20. **Receipt sequence generation:** The `{seq}` in `EVT-{societyCode}-{year}-{seq}` is a zero-padded 5-digit auto-incrementing number, scoped per society per calendar year. Generated by: `SELECT COALESCE(MAX(seq), 0) + 1` from event_payments for that society and year, inside the payment recording transaction. This matches the existing `FeePayment` receipt generation pattern.

---

## What's NOT in V1

- Event templates / pre-built event types
- Resident-proposed events (only admin creates)
- Online payment gateway (offline collection only, matching existing fee approach)
- Refund tracking (admin handles offline)
- Partial payments (pay full or don't pay)
- Recurring / repeating events
- Event photo gallery or post-event content
- Comments or discussion on events
- Waitlist when event is full
- Automated payment reminders (admin nudges manually)
- Export registrant list to Excel
- Family member names (just count — we don't track who the 4 members are)
- Collective Petitions & Complaints (deferred — see `petitions.md`)
- Expense approval workflow for events (admin just records directly, like existing expense flow)
- Budget vs actual comparison charts (just show the numbers, no graphs in V1)

---

## Database — New Tables & Enums

### New Enums

```prisma
enum EventStatus {
  DRAFT
  PUBLISHED
  COMPLETED
  CANCELLED
}

enum EventCategory {
  FESTIVAL
  SPORTS
  WORKSHOP
  CULTURAL
  MEETING
  OTHER
}

enum EventFeeModel {
  FREE
  FIXED
  FLEXIBLE
  CONTRIBUTION
}

enum EventChargeUnit {
  PER_PERSON
  PER_HOUSEHOLD
}

enum RegistrationStatus {
  INTERESTED
  PENDING
  CONFIRMED
  CANCELLED
}

enum DeficitDisposition {
  FROM_SOCIETY_FUND
  ADDITIONAL_COLLECTION
}
```

**Total new enums: 6**

**Reused existing enums:** `PaymentMode` (for event payments), `DisposalType` (for surplus disposition), `ExpenseCategory` + `ExpenseStatus` (for event expenses via existing Expense model).

### Table: `community_events`

Stores all event details. One row per event.

| Column                | Type               | Nullable | Default    | Notes                                                                                                |
| --------------------- | ------------------ | -------- | ---------- | ---------------------------------------------------------------------------------------------------- |
| id                    | UUID               | No       | auto       | PK                                                                                                   |
| society_id            | UUID               | No       | —          | FK → societies                                                                                       |
| title                 | varchar(200)       | No       | —          | Event name                                                                                           |
| description           | text               | Yes      | —          | Optional long description                                                                            |
| category              | EventCategory      | No       | —          | FESTIVAL, SPORTS, etc.                                                                               |
| fee_model             | EventFeeModel      | No       | —          | FREE, FIXED, FLEXIBLE, CONTRIBUTION                                                                  |
| charge_unit           | EventChargeUnit    | No       | PER_PERSON | PER_PERSON or PER_HOUSEHOLD                                                                          |
| event_date            | timestamptz        | No       | —          | When the event happens                                                                               |
| location              | varchar(200)       | Yes      | —          | Where (e.g., "Club House", "Community Park")                                                         |
| registration_deadline | timestamptz        | Yes      | —          | After this, no new registrations                                                                     |
| fee_amount            | decimal(10,2)      | Yes      | null       | Set upfront (FIXED) or set later (FLEXIBLE). Null for FREE/CONTRIBUTION and FLEXIBLE during polling. |
| estimated_budget      | decimal(10,2)      | Yes      | null       | Admin's total budget estimate (FLEXIBLE events). Display-only.                                       |
| min_participants      | int                | Yes      | null       | Minimum people needed (FLEXIBLE events). Display-only, not enforced.                                 |
| max_participants      | int                | Yes      | null       | Cap on registrations. Null = unlimited. For PER_PERSON: counts total members.                        |
| suggested_amount      | decimal(10,2)      | Yes      | null       | Hint for CONTRIBUTION events. Not enforced.                                                          |
| status                | EventStatus        | No       | DRAFT      | Current state                                                                                        |
| cancellation_reason   | text               | Yes      | —          | Required when cancelling                                                                             |
| created_by            | UUID               | No       | —          | FK → users (admin who created)                                                                       |
| published_at          | timestamptz        | Yes      | —          | Set when published                                                                                   |
| payment_triggered_at  | timestamptz        | Yes      | —          | Set when admin triggers payment (FLEXIBLE events)                                                    |
| settled_at            | timestamptz        | Yes      | —          | Set when admin settles the event financials                                                          |
| surplus_amount        | decimal(10,2)      | Yes      | null       | Positive = surplus, negative = deficit. Set at settlement.                                           |
| surplus_disposal      | DisposalType       | Yes      | null       | How surplus is handled. Uses existing enum. Null if deficit or not settled.                          |
| deficit_disposition   | DeficitDisposition | Yes      | null       | How deficit is covered. Null if surplus or not settled.                                              |
| settlement_notes      | text               | Yes      | —          | Optional admin notes about the settlement                                                            |
| created_at            | timestamptz        | No       | now()      | —                                                                                                    |
| updated_at            | timestamptz        | No       | auto       | —                                                                                                    |

**Indexes:** society_id, status, event_date.

### Table: `event_registrations`

One row per resident per event. Tracks interest, registration, and payment status.

| Column            | Type               | Nullable | Default | Notes                                                                                     |
| ----------------- | ------------------ | -------- | ------- | ----------------------------------------------------------------------------------------- |
| id                | UUID               | No       | auto    | PK                                                                                        |
| event_id          | UUID               | No       | —       | FK → community_events                                                                     |
| user_id           | UUID               | No       | —       | FK → users (resident)                                                                     |
| society_id        | UUID               | No       | —       | FK → societies (denormalized for query efficiency)                                        |
| status            | RegistrationStatus | No       | —       | INTERESTED / PENDING / CONFIRMED / CANCELLED                                              |
| member_count      | int                | No       | 1       | Number of family members attending. Min 1, max 10. Only meaningful for PER_PERSON events. |
| cancelled_at      | timestamptz        | Yes      | —       | When registration was cancelled                                                           |
| cancellation_note | text               | Yes      | —       | Optional reason for cancellation                                                          |
| registered_at     | timestamptz        | No       | now()   | When they first registered/expressed interest                                             |

**Unique constraint:** `(event_id, user_id)` — one registration per resident per event.
**Indexes:** event_id, user_id, society_id, status.

### Table: `event_payments`

One payment record per registration. Admin records this when resident pays.

| Column          | Type          | Nullable | Default | Notes                                                                                  |
| --------------- | ------------- | -------- | ------- | -------------------------------------------------------------------------------------- |
| id              | UUID          | No       | auto    | PK                                                                                     |
| registration_id | UUID          | No       | —       | FK → event_registrations. **Unique** — one payment per registration.                   |
| user_id         | UUID          | No       | —       | FK → users (resident who paid)                                                         |
| society_id      | UUID          | No       | —       | FK → societies                                                                         |
| amount          | decimal(10,2) | No       | —       | Actual amount paid. Pre-calculated for FIXED/FLEXIBLE, admin-entered for CONTRIBUTION. |
| payment_mode    | PaymentMode   | No       | —       | CASH / UPI / BANK_TRANSFER / OTHER (reuse existing enum)                               |
| reference_no    | varchar(50)   | Yes      | —       | UPI transaction ID, cheque number, etc.                                                |
| receipt_no      | varchar(50)   | No       | —       | **Unique.** Auto-generated: `EVT-{societyCode}-{year}-{seq}`                           |
| payment_date    | date          | No       | —       | When the payment was made                                                              |
| notes           | text          | Yes      | —       | Optional admin notes                                                                   |
| recorded_by     | UUID          | No       | —       | FK → users (admin who recorded)                                                        |
| created_at      | timestamptz   | No       | now()   | —                                                                                      |

**Unique constraint:** `registration_id` — one payment per registration.
**Unique constraint:** `receipt_no` — globally unique receipts.

### Modification to Existing Table: `expenses`

Add one optional field to link expenses to events:

| Column   | Type | Nullable | Default | Notes                                                                                      |
| -------- | ---- | -------- | ------- | ------------------------------------------------------------------------------------------ |
| event_id | UUID | Yes      | null    | FK → community_events. Null = general society expense. Set = expense linked to this event. |

Add relation: `event CommunityEvent? @relation(fields: [eventId], references: [id])`.

**No changes to any existing expense fields.** The event link is purely additive.

### Back-Relations to Add

**On `Society` model:** Add relations to `CommunityEvent`, `EventRegistration`, `EventPayment`.

**On `User` model:** Add relations for:

- `eventRegistrations` — events they registered for
- `eventPayments` — event payments (as payer)
- `eventsCreated` — events they created (as admin)
- `eventPaymentsRecorded` — event payments they recorded (as admin)

**On `CommunityEvent` model:** Add relation to `Expense[]` (expenses linked to this event).

---

## API Routes

### Events — Admin Routes

All under `/api/v1/societies/[id]/events/`

```
GET    /api/v1/societies/[id]/events
       → List all events for this society.
       → Query params: ?status=PUBLISHED&category=FESTIVAL&page=1&limit=20
       → Returns: { data: Event[], total, page, limit }
       → Each event includes: _count of registrations by status, total collected, total expenses, settled flag.

POST   /api/v1/societies/[id]/events
       → Create a new event (DRAFT status).
       → Body: { title, description?, category, feeModel, chargeUnit, eventDate,
                 location?, registrationDeadline?, feeAmount?, estimatedBudget?,
                 minParticipants?, maxParticipants?, suggestedAmount? }
       → Validates: feeAmount required for FIXED, null for FREE/FLEXIBLE/CONTRIBUTION.
       → Returns: created event.

GET    /api/v1/societies/[id]/events/[eventId]
       → Event detail with all registrations, payment info, and financial summary.
       → Returns: event + registrations (with user name, unit info) + payment status
                  + expenses list + summary (totalCollected, totalExpenses, net).

PATCH  /api/v1/societies/[id]/events/[eventId]
       → Update event details. Only allowed when status = DRAFT.
       → Body: any editable field.

DELETE /api/v1/societies/[id]/events/[eventId]
       → Delete a DRAFT event. Only allowed when status = DRAFT.
       → Hard-deletes the event record (no soft-delete needed for drafts).
       → Returns: { message: "Event deleted" }

POST   /api/v1/societies/[id]/events/[eventId]/publish
       → Transition DRAFT → PUBLISHED. Sets publishedAt.
       → Sends WhatsApp notification to all active residents with consent.
       → Returns: updated event.

POST   /api/v1/societies/[id]/events/[eventId]/trigger-payment
       → FLEXIBLE events only. Sets feeAmount on the event. Sets paymentTriggeredAt.
       → Body: { feeAmount: number } (must be > 0)
       → Validates: event is PUBLISHED, feeModel is FLEXIBLE, feeAmount is currently null,
         and at least 1 INTERESTED registration exists.
       → Bulk-transitions all INTERESTED registrations → PENDING.
       → Sends WhatsApp notification to all interested residents with the price.
       → Returns: updated event + count of transitioned registrations.

POST   /api/v1/societies/[id]/events/[eventId]/cancel
       → Transition PUBLISHED → CANCELLED.
       → Body: { reason: string } (required)
       → Sets cancellationReason. Bulk-cancels all active registrations.
       → Sends WhatsApp notification to all registered residents.
       → Returns: updated event.

POST   /api/v1/societies/[id]/events/[eventId]/complete
       → Transition PUBLISHED → COMPLETED.
       → No notification sent (event already happened).
       → Returns: updated event.

GET    /api/v1/societies/[id]/events/[eventId]/registrations
       → List all registrations for this event with user details.
       → Query params: ?status=PENDING&page=1&limit=50
       → Returns: registrations with user name, email, mobile, unit info, memberCount, payment info.

POST   /api/v1/societies/[id]/events/[eventId]/registrations/[regId]/payment
       → Record a payment for a registration.
       → Body: { amount, paymentMode, referenceNo?, paymentDate, notes? }
       → For FIXED/FLEXIBLE: validates amount = expected (feeAmount × memberCount or feeAmount).
       → For CONTRIBUTION: accepts any amount > 0.
       → Generates receipt number (EVT-{code}-{year}-{seq}).
       → Transitions registration PENDING → CONFIRMED.
       → For CONTRIBUTION: creates payment on already-CONFIRMED registration.
       → Returns: payment record with receiptNo.

POST   /api/v1/societies/[id]/events/[eventId]/expenses
       → Add an expense linked to this event.
       → Body: { amount, description, category, date, receiptUrl? }
       → Creates an Expense record with eventId = this event.
       → Allowed when event is PUBLISHED or COMPLETED.
       → Returns: created expense.

GET    /api/v1/societies/[id]/events/[eventId]/finances
       → Financial summary for this event.
       → Returns: {
           totalCollected (sum of event_payments),
           pendingAmount (sum of unpaid registrations × feeAmount),
           totalExpenses (sum of linked ACTIVE expenses),
           netAmount (totalCollected - totalExpenses),
           expenses: Expense[] (linked expenses list),
           isSettled, settledAt, surplusAmount, surplusDisposal,
           deficitDisposition, settlementNotes
         }

POST   /api/v1/societies/[id]/events/[eventId]/settle
       → Record settlement for the event.
       → Body: { surplusDisposal?, deficitDisposition?, notes? }
       → Calculates surplusAmount from current collections and expenses.
       → Sets settledAt, surplusAmount, surplusDisposal/deficitDisposition, settlementNotes.
       → Returns: updated event with settlement info.
```

### Events — Resident Routes

All under `/api/v1/residents/me/events/`

```
GET    /api/v1/residents/me/events
       → List PUBLISHED + COMPLETED events for the resident's society.
       → Returns: events with fee info + resident's own registration status (if any).
       → COMPLETED+SETTLED events include financial summary (collected, spent, net, disposition).
       → Filters: ?upcoming=true (only future events, default), ?all=true (includes completed).

POST   /api/v1/residents/me/events/[eventId]/register
       → Register for an event / express interest.
       → Body: { memberCount?: number } (default 1, only for PER_PERSON events)
       → Logic:
         - FREE → create registration as CONFIRMED.
         - FIXED → create as PENDING.
         - FLEXIBLE (polling phase, feeAmount null) → create as INTERESTED.
         - FLEXIBLE (payment phase, feeAmount set) → create as PENDING (late joiner).
         - CONTRIBUTION → create as CONFIRMED.
       → Validates: not already registered, event is PUBLISHED, not past deadline, not full.
       → Returns: registration record.

DELETE /api/v1/residents/me/events/[eventId]/register
       → Cancel registration.
       → Allowed if: event is PUBLISHED AND (status is INTERESTED or PENDING).
       → Not allowed if: CONFIRMED with payment (admin must handle refund offline).
       → Sets status = CANCELLED, cancelledAt = now().
       → Returns: updated registration.

GET    /api/v1/residents/me/events/[eventId]/finances
       → Financial summary for a COMPLETED+SETTLED event (resident view).
       → Returns: { totalCollected, totalExpenses, netAmount, disposition,
                    expenses: { description, amount }[] }
       → Only returns description and amount for expenses (no receipts, no admin notes).
       → Returns 403 if event is not yet settled.
```

---

## Pages & Navigation

### Admin Side

```
/admin/events                  → Event list (table with filters) + "Create Event" button
/admin/events/[eventId]        → Event detail with 3 tabs: Registrations | Finances | Details
```

New sidebar entry: **Events** (Calendar icon)

### Resident Side

```
/r/events                      → Card grid of events (upcoming + recent completed)
```

Event detail opens as Sheet/Drawer — no separate page. Financial summary shown inline for settled events.

New sidebar entry: **Events** (CalendarDays icon)

---

## Notifications (WhatsApp)

| Trigger                      | Recipients                                 | Template                  | Content Includes                        |
| ---------------------------- | ------------------------------------------ | ------------------------- | --------------------------------------- |
| Event published              | All active residents with WhatsApp consent | `event_published`         | Event name, date, location, fee info    |
| Payment triggered (FLEXIBLE) | All INTERESTED registrants for that event  | `event_payment_triggered` | Event name, per-person price, total due |
| Event cancelled              | All registered residents for that event    | `event_cancelled`         | Event name, cancellation reason         |

Fire-and-forget fan-out matching existing notification pattern in `src/lib/whatsapp.ts`.

---

## Audit Log Actions

New action types to add in `src/lib/audit.ts`:

```
EVENT_CREATED
EVENT_UPDATED
EVENT_DELETED
EVENT_PUBLISHED
EVENT_PAYMENT_TRIGGERED
EVENT_CANCELLED
EVENT_COMPLETED
EVENT_REGISTRATION_CREATED
EVENT_REGISTRATION_CANCELLED
EVENT_PAYMENT_RECORDED
EVENT_EXPENSE_ADDED
EVENT_SETTLED
```

---

## New Files to Create

| File                                                                                    | Purpose                                                                                                      |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/lib/validations/event.ts`                                                          | Zod schemas: createEvent, updateEvent, triggerPayment, recordPayment, registerEvent, addExpense, settleEvent |
| `src/services/events.ts`                                                                | Typed fetch wrappers for all event API endpoints                                                             |
| `src/app/api/v1/societies/[id]/events/route.ts`                                         | GET (list) + POST (create)                                                                                   |
| `src/app/api/v1/societies/[id]/events/[eventId]/route.ts`                               | GET (detail) + PATCH (update)                                                                                |
| `src/app/api/v1/societies/[id]/events/[eventId]/publish/route.ts`                       | POST                                                                                                         |
| `src/app/api/v1/societies/[id]/events/[eventId]/trigger-payment/route.ts`               | POST                                                                                                         |
| `src/app/api/v1/societies/[id]/events/[eventId]/cancel/route.ts`                        | POST                                                                                                         |
| `src/app/api/v1/societies/[id]/events/[eventId]/complete/route.ts`                      | POST                                                                                                         |
| `src/app/api/v1/societies/[id]/events/[eventId]/registrations/route.ts`                 | GET                                                                                                          |
| `src/app/api/v1/societies/[id]/events/[eventId]/registrations/[regId]/payment/route.ts` | POST                                                                                                         |
| `src/app/api/v1/societies/[id]/events/[eventId]/expenses/route.ts`                      | POST (add event expense)                                                                                     |
| `src/app/api/v1/societies/[id]/events/[eventId]/finances/route.ts`                      | GET (financial summary)                                                                                      |
| `src/app/api/v1/societies/[id]/events/[eventId]/settle/route.ts`                        | POST (settle event)                                                                                          |
| `src/app/api/v1/residents/me/events/route.ts`                                           | GET (list published events)                                                                                  |
| `src/app/api/v1/residents/me/events/[eventId]/register/route.ts`                        | POST + DELETE                                                                                                |
| `src/app/api/v1/residents/me/events/[eventId]/finances/route.ts`                        | GET (resident financial summary)                                                                             |
| `src/app/admin/events/page.tsx`                                                         | Admin events list + create dialog                                                                            |
| `src/app/admin/events/[eventId]/page.tsx`                                               | Admin event detail (3 tabs: Registrations, Finances, Details)                                                |
| `src/app/r/events/page.tsx`                                                             | Resident events browse + register + financial summary                                                        |

## Files to Modify

| File                                                              | Change                                                                                                                  |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `supabase/schema.prisma`                                          | Add 6 new enums + 3 new models + `eventId` on Expense + back-relations on Society, User, CommunityEvent                 |
| `supabase/dbinuse.prisma`                                         | Update AFTER migration runs successfully                                                                                |
| `src/lib/whatsapp.ts`                                             | Add 3 new notification senders (event published, payment triggered, event cancelled)                                    |
| `src/lib/audit.ts`                                                | Add 12 new audit action types                                                                                           |
| `src/app/admin/expenses/page.tsx`                                 | Add event badge on linked expenses, add "General/Event/All" filter, exclude event expenses from society balance display |
| `src/app/api/v1/societies/[id]/expenses/route.ts` (or equivalent) | Accept optional `eventId` in expense creation body                                                                      |
| `src/components/layout/AdminSidebar.tsx`                          | Add Events nav item                                                                                                     |
| `src/components/layout/ResidentSidebar.tsx`                       | Add Events nav item                                                                                                     |

---

## New Dependencies

None. All required packages are already in the project.

---

## Implementation Order

### Phase 1: Database (do first, blocks everything)

1. Add 6 new enums to `schema.prisma` (EventStatus, EventCategory, EventFeeModel, EventChargeUnit, RegistrationStatus, DeficitDisposition).
2. Add 3 new models (`CommunityEvent`, `EventRegistration`, `EventPayment`) to `schema.prisma`.
3. Add optional `eventId` FK to existing `Expense` model.
4. Add back-relations on `Society`, `User`, and `CommunityEvent` models.
5. Run `npx prisma migrate dev --name add_community_events`.
6. Verify migration succeeded.
7. Update `dbinuse.prisma` to match.

### Phase 2: Events Backend — Core

8. Create `src/lib/validations/event.ts` — all Zod schemas (create, update, triggerPayment, recordPayment, register, addExpense, settle).
9. Create `src/services/events.ts` — typed fetch wrappers.
10. Create event API routes (admin): list, create, detail, update.
11. Create event API routes (admin): publish, trigger-payment, cancel, complete.
12. Create event API routes (admin): registrations list, record payment.
13. Create event API routes (resident): list, register, cancel registration.

### Phase 3: Events Backend — Finances

14. Create event expense route: POST add expense linked to event.
15. Create event finances route: GET financial summary (collected, spent, net).
16. Create event settle route: POST record settlement.
17. Create resident finances route: GET financial summary (resident view — description + amount only).
18. Update existing expense creation API to support optional `eventId` field ("Link to Event").
19. Update existing society balance calculation to exclude event-linked expenses (`WHERE eventId IS NULL`).

### Phase 4: Events Frontend — Admin

20. Create admin events list page (`/admin/events`): table, filters, create event dialog (with conditional fields per fee model), settlement badges, default sorting.
21. Create admin event detail page (`/admin/events/[eventId]`) — Registrations tab: polling dashboard, payment tracker, record payment dialog.
22. Create admin event detail page — Finances tab: expense list, add expense dialog, financial summary, settle dialog, re-settle.
23. Create admin event detail page — Details tab: read-only event info, delete DRAFT, edit DRAFT.
24. Update existing Expenses page: event badge on linked expenses, "General/Event/All" filter, exclude event expenses from balance display.
25. Add Events to admin sidebar nav.

### Phase 5: Events Frontend — Resident

26. Create resident events page (`/r/events`): card grid, register/interest flow, event detail Sheet/Drawer (with member count selector for PER_PERSON).
27. Add financial summary section to event detail for COMPLETED+SETTLED events.
28. Add Events to resident sidebar nav.

### Phase 6: Cross-Cutting

29. Add 3 WhatsApp notification senders to `src/lib/whatsapp.ts`.
30. Add 12 audit log action types to `src/lib/audit.ts`.
31. End-to-end testing of all flows.

---

## Verification Scenarios

### Registration & Payment

- [ ] Admin creates a FREE event → publishes → resident RSVPs → shows as CONFIRMED in list.
- [ ] Admin creates a FIXED event (₹200/person, PER_PERSON) → publishes → resident registers with 3 members → shows PENDING with ₹600 due → admin records payment → CONFIRMED, receipt generated.
- [ ] Admin creates a FIXED event (₹500/household, PER_HOUSEHOLD) → resident registers → shows PENDING with ₹500 due regardless of member count.
- [ ] Admin creates a FLEXIBLE event → publishes → 5 residents express interest → admin sees interest count → admin triggers payment at ₹400/person → all INTERESTED become PENDING → WhatsApp sent → admin records payments.
- [ ] FLEXIBLE event: after payment triggered, a new resident registers → goes directly to PENDING (late joiner flow).
- [ ] Admin creates a CONTRIBUTION event → publishes → resident participates (CONFIRMED immediately) → admin records ₹2,000 contribution → admin records ₹500 from another → dashboard shows total.
- [ ] CONTRIBUTION event: admin records payment for a resident who didn't register → auto-creates registration as CONFIRMED.
- [ ] Resident tries to register twice for same event → 409 error (unique constraint).
- [ ] Resident cancels INTERESTED registration → status CANCELLED.
- [ ] Resident tries to cancel CONFIRMED registration with payment → rejected.
- [ ] Admin cancels a PUBLISHED event → all registrations cancelled → WhatsApp sent with reason.
- [ ] Max participants reached → registration button disabled for new residents.
- [ ] Registration deadline passed → registration button disabled.

### Expenses & Finances

- [ ] Admin adds expense to a PUBLISHED event (advance payment) → shows in Finances tab immediately.
- [ ] Admin adds multiple expenses to COMPLETED event → total expenses calculated correctly.
- [ ] Finances tab shows correct totals: collected from event_payments, spent from linked expenses, net = collected - spent.
- [ ] FREE event with ₹3,500 in expenses → Finances shows: Collected ₹0, Spent ₹3,500, Deficit ₹3,500.
- [ ] Admin creates expense from general Expenses page with "Link to Event" → shows in event's Finances tab.
- [ ] Reversed expense (status = REVERSED) is excluded from financial summary.

### Settlement

- [ ] Admin settles event with surplus → surplusAmount positive, surplusDisposal set (TRANSFERRED_TO_FUND).
- [ ] Admin settles event with deficit → surplusAmount negative, deficitDisposition set (FROM_SOCIETY_FUND).
- [ ] After settlement, resident can see financial summary with expense breakdown (description + amount only).
- [ ] Before settlement, resident sees "Financial summary coming soon" for COMPLETED events.
- [ ] Admin adds expense after settlement → UI shows "Expenses changed since settlement" warning.
- [ ] Admin re-settles → surplusAmount and disposition updated to reflect new numbers.
- [ ] Events list shows "Settled ✓" badge for settled events and "Pending settlement" for unsettled COMPLETED events.

### Edge Cases & Validation

- [ ] Admin deletes a DRAFT event → event removed.
- [ ] Admin tries to delete a PUBLISHED event → rejected (400).
- [ ] Admin tries to trigger payment on FLEXIBLE event with 0 interested → rejected.
- [ ] Admin records late payment for PENDING registration after event is COMPLETED → works, receipt generated.
- [ ] New registration attempt on COMPLETED event → rejected.
- [ ] Member count selector hidden for PER_HOUSEHOLD events; member_count = 1 in DB.
- [ ] Create FIXED event without feeAmount → validation error.
- [ ] Create FLEXIBLE event with feeAmount → validation error (must be null).
- [ ] Event-linked expenses excluded from society balance calculation on Expenses page.
- [ ] Expenses page shows event badge for linked expenses; filter "General only" hides them.
- [ ] Settle event with exactly ₹0 net → "Balanced" shown, no disposition needed.
- [ ] CONTRIBUTION event: chargeUnit = PER_PERSON → member count selector shown for headcount tracking.
