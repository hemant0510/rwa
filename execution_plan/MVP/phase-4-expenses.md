# MVP Phase 4 — Expense Ledger

**Duration**: ~1 week
**Goal**: Admin can log expenses with categories, upload receipts, and maintain a running balance visible to all residents.
**Depends on**: Phase 3 (fee collection data needed for running balance)

---

## Task 4.1 — Expense Ledger Dashboard (Admin)

### Backend

- API: `GET /api/v1/societies/[id]/expenses` (paginated, filterable)
- API: `GET /api/v1/societies/[id]/expenses/summary`
  - Returns: Total expenses (current session), category breakdown, running balance
  - Running Balance = Total Fees Collected (current session) − Total Expenses
- Query params: `?category=&from=&to=&page=&limit=`

### UI Screen: `/admin/expenses`

```
┌─────────────────────────────────────────────────────────────┐
│  [Sidebar]  │  Expense Ledger — Session 2025-26             │
│             │────────────────────────────────────────────────│
│  Dashboard  │                                                │
│  Residents  │  ┌───────────────┐ ┌──────────┐ ┌──────────┐ │
│  Fees       │  │ Balance in Hand│ │ Total    │ │ Total    │ │
│  Expenses ← │  │ ₹24,000       │ │ Collected│ │ Expenses │ │
│  Reports    │  │ ▲ Healthy      │ │ ₹38,400  │ │ ₹14,400  │ │
│  Broadcast  │  └───────────────┘ └──────────┘ └──────────┘ │
│             │                                                │
│             │  Category Breakdown                            │
│             │  ┌──────────────────────────────────────┐     │
│             │  │ ████████████ Security     ₹4,800 33% │     │
│             │  │ ████████     Staff Salary ₹3,600 25% │     │
│             │  │ ██████       Maintenance  ₹2,400 17% │     │
│             │  │ ████         Cleaning     ₹1,800 13% │     │
│             │  │ ███          Utilities    ₹1,200  8% │     │
│             │  │ ██           Other          ₹600  4% │     │
│             │  └──────────────────────────────────────┘     │
│             │                                                │
│             │  [+ Add Expense]                               │
│             │                                                │
│             │  Expenses          Search: [________________]  │
│             │  Category: [All ▾]  From: [____] To: [____]   │
│             │  ┌───────────────────────────────────────────┐│
│             │  │ Date     │Category    │Desc       │Amount  ││
│             │  │──────────│────────────│───────────│────────││
│             │  │ 03 Mar   │Security    │Guard Feb  │₹4,800  ││
│             │  │ 01 Mar   │Cleaning    │Monthly    │₹1,800  ││
│             │  │ 28 Feb   │Maintenance │Pipe repair│₹2,400  ││
│             │  │ 25 Feb   │Utilities   │Electricity│₹1,200  ││
│             │  │ 20 Feb   │Staff Salary│Gardener   │₹1,800  ││
│             │  │ ̶1̶5̶ ̶F̶e̶b̶   │ ̶M̶a̶i̶n̶t̶.̶     │ ̶W̶r̶o̶n̶g̶     │ ̶-̶₹̶5̶0̶0̶  ││
│             │  │          │            │(Reversed) │        ││
│             │  └───────────────────────────────────────────┘│
│             │  Showing 1-10 of 24        [< 1 2 3 >]       │
└─────────────┴───────────────────────────────────────────────┘
```

**Components to build**:

- `ExpenseDashboard` — Full page with balance + category chart + table
- `RunningBalanceCard` — Prominent card showing balance in hand (green if positive, red if negative)
- `CategoryBreakdownChart` — Horizontal bar chart (use simple CSS bars, no chart library for MVP)
- `ExpenseTable` — DataTable with date, category, description, amount, actions
- `ReversedExpenseRow` — Struck-through styling for reversed entries
- Use shadcn `Card`, `Table`, `Badge`, `Input`, `Select`, `DatePicker`

**Acceptance**: Running balance calculated correctly. Category breakdown matches expenses. Reversed entries show struck-through. Filters work.

---

## Task 4.2 — Add Expense Form

### Backend

- API: `POST /api/v1/societies/[id]/expenses`
- Body: `{ date, amount, category, description, receiptFile? }`
- Categories (MVP fixed list):
  ```
  MAINTENANCE, SECURITY, CLEANING, STAFF_SALARY,
  INFRASTRUCTURE, UTILITIES, EMERGENCY, ADMINISTRATIVE, OTHER
  ```
- `logged_by` auto-set to current admin user
- Receipt uploaded to Supabase Storage: `expenses/[societyId]/[expenseId].[ext]`

### UI: Add Expense Dialog

```
┌─────────────────────────────────────────────────┐
│  Add Expense                               [✕]  │
│  ───────────────────────────────────────────     │
│                                                  │
│  Date *                                          │
│  ┌────────────────────────────────────────┐     │
│  │ 📅 04/03/2026                          │     │
│  └────────────────────────────────────────┘     │
│  Defaults to today. Backdate up to 90 days.      │
│                                                  │
│  Amount (₹) *                                    │
│  ┌────────────────────────────────────────┐     │
│  │ 4,800                                  │     │
│  └────────────────────────────────────────┘     │
│                                                  │
│  Category *                                      │
│  ┌────────────────────────────────────────┐     │
│  │ Security                            ▾  │     │
│  └────────────────────────────────────────┘     │
│                                                  │
│  Description *                                   │
│  ┌────────────────────────────────────────┐     │
│  │ Security guard salary for February     │     │
│  │ 2026. 2 guards x ₹2,400 each.         │     │
│  └────────────────────────────────────────┘     │
│  Minimum 5 characters                            │
│                                                  │
│  Receipt / Invoice (optional)                    │
│  ┌────────────────────────────────────────┐     │
│  │  📎 Drop file or click to upload       │     │
│  │     JPG, PNG, or PDF — Max 5MB         │     │
│  └────────────────────────────────────────┘     │
│                                                  │
│  ┌────────────────────────────────────────┐     │
│  │ Impact on Balance                      │     │
│  │ Current Balance: ₹28,800               │     │
│  │ This Expense:   −₹4,800               │     │
│  │ New Balance:     ₹24,000               │     │
│  └────────────────────────────────────────┘     │
│                                                  │
│                    [Cancel]  [Add Expense]        │
└─────────────────────────────────────────────────┘
```

**Components to build**:

- `AddExpenseDialog` — Sheet/dialog with expense form
- `CategorySelector` — Dropdown with all 9 expense categories
- `ReceiptUpload` — File dropzone (max 5MB, JPG/PNG/PDF only)
- `BalanceImpactPreview` — Live calculation showing how balance will change
- `AmountInput` — Currency input with ₹ prefix (reuse from Phase 3)
- Use shadcn `Dialog`, `Form`, `Input`, `Select`, `Textarea`, `Button`

**Acceptance**: Expense created. Category saved. Receipt uploaded. Balance impact shown live. Form validates all fields.

---

## Task 4.3 — Expense Correction & Reversal

### Backend

- Correction (within 24h): `PATCH /api/v1/societies/[id]/expenses/[expenseId]`
  - Only amount, category, description can be edited
  - Audit log captures before/after values + editor + timestamp
- Reversal (after 24h): `POST /api/v1/societies/[id]/expenses/[expenseId]/reverse`
  - Creates a reversal entry (negative amount, links to original)
  - Original entry marked `is_reversed = true` (struck through in UI)
  - Reason required
  - New corrected entry created separately if needed
- No permanent deletion — ever

### UI: Expense Detail / Actions

```
┌─────────────────────────────────────────────────┐
│  Expense Detail                            [✕]  │
│  ───────────────────────────────────────────     │
│                                                  │
│  Date:        03 March 2026                      │
│  Amount:      ₹4,800                             │
│  Category:    Security                           │
│  Description: Security guard salary for Feb 2026 │
│  Receipt:     📎 guard_salary_feb.pdf [View]     │
│  Logged By:   Hemant Kumar                       │
│  Logged At:   03 Mar 2026 at 09:15              │
│                                                  │
│  ⏱ Correction window: 14h remaining             │
│                                                  │
│  [Edit Expense]  [Reverse Expense]               │
└─────────────────────────────────────────────────┘
```

### UI: Reverse Expense Dialog

```
┌─────────────────────────────────────────────────┐
│  Reverse Expense                           [✕]  │
│  ───────────────────────────────────────────     │
│                                                  │
│  Original Expense:                               │
│  ┌────────────────────────────────────────┐     │
│  │ 15 Feb 2026 │ Maintenance │ ₹500       │     │
│  │ Desc: Wrong entry for pipe repair      │     │
│  └────────────────────────────────────────┘     │
│                                                  │
│  This will:                                      │
│  • Mark original as REVERSED (struck-through)    │
│  • Create a reversal entry (−₹500)              │
│  • Running balance will increase by ₹500         │
│  • Both entries remain visible for audit          │
│                                                  │
│  Reason for Reversal *                           │
│  ┌────────────────────────────────────────┐     │
│  │ Duplicate entry — already recorded on  │     │
│  │ 10 Feb for the same repair.            │     │
│  └────────────────────────────────────────┘     │
│                                                  │
│             [Cancel]  [Confirm Reversal]         │
└─────────────────────────────────────────────────┘
```

**Components to build**:

- `ExpenseDetailSheet` — Side sheet showing full expense details + actions
- `EditExpenseDialog` — Pre-filled form (only active within 24h)
- `ReverseExpenseDialog` — Confirmation dialog with reason field
- `CorrectionWindowBadge` — Shows remaining time (reuse pattern from Phase 3)

**Acceptance**: Edit works within 24h only. After 24h, only reversal available. Reversed entries struck-through. Audit trail complete. Running balance updated on both correction and reversal.

---

## Task 4.4 — Resident Expense View (Read-Only)

### Backend

- API: `GET /api/v1/societies/[id]/expenses/public` (authenticated residents only)
- Returns: All expenses for the society (current session), running balance
- Residents cannot create, edit, or reverse expenses

### UI Screen: `/resident/expenses`

```
┌─────────────────────────────────────────────────────┐
│  RWA Connect — Eden Estate                           │
│─────────────────────────────────────────────────────│
│                                                      │
│  Society Expenses                                    │
│  Session 2025-26                                     │
│                                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │  Balance in Hand                             │    │
│  │  ₹24,000                                     │    │
│  │  ──────────────────────────────────────      │    │
│  │  Collected: ₹38,400  │  Spent: ₹14,400      │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  Category Summary                                    │
│  ┌─────────────────────────────────────────────┐    │
│  │ Security        ████████████  ₹4,800         │    │
│  │ Staff Salary    ████████      ₹3,600         │    │
│  │ Maintenance     ██████        ₹2,400         │    │
│  │ Cleaning        ████          ₹1,800         │    │
│  │ Utilities       ███           ₹1,200         │    │
│  │ Other           ██              ₹600         │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  Recent Expenses                                     │
│  ───────────────                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │ 📋 03 Mar — Security                        │    │
│  │    Guard salary for February        ₹4,800   │    │
│  ├─────────────────────────────────────────────┤    │
│  │ 📋 01 Mar — Cleaning                        │    │
│  │    Monthly cleaning service         ₹1,800   │    │
│  ├─────────────────────────────────────────────┤    │
│  │ 📋 28 Feb — Maintenance                     │    │
│  │    Common area pipe repair          ₹2,400   │    │
│  ├─────────────────────────────────────────────┤    │
│  │ 📋 25 Feb — Utilities                       │    │
│  │    Common area electricity          ₹1,200   │    │
│  └─────────────────────────────────────────────┘    │
│                                                      │
│  [Load More]                                         │
│                                                      │
│─────────────────────────────────────────────────────│
│  [🏠 Home]  [💰 Payments]  [📊 Expenses]  [👤 Profile]│
└─────────────────────────────────────────────────────┘
```

**Components to build**:

- `ResidentExpenseView` — Full page, read-only expense display
- `BalanceSummaryCard` — Shows collected vs spent vs balance
- `CategorySummaryBars` — Simple horizontal bars per category
- `ExpenseListCard` — Mobile-friendly card list of expenses (not table)
- Use shadcn `Card`, `Badge`, `ScrollArea`

**Acceptance**: Resident sees all society expenses (current session). Running balance visible. Cannot create/edit. Category breakdown visible. Mobile-optimized card layout.

---

## Phase 4 Definition of Done

- [ ] Admin can add expenses with all 9 categories
- [ ] Receipt photo/PDF upload works (max 5MB)
- [ ] Running balance calculated: Fees Collected − Expenses = Balance
- [ ] Balance displayed prominently on admin and resident views
- [ ] Category breakdown shown with visual bars
- [ ] Expense correction within 24h: edit in place with audit log
- [ ] Expense reversal after 24h: reversal entry created, original struck-through
- [ ] No expense can be permanently deleted
- [ ] Resident expense view: read-only, mobile-optimized
- [ ] Expense table: sortable, filterable by category and date range
- [ ] Reversed entries visually distinct (struck-through)
- [ ] All UI responsive: desktop + tablet + mobile
- [ ] Loading skeletons on all data-fetching screens
- [ ] Empty states for new societies with no expenses
