# Full Spec Phase 3 — Financial Advanced

**Duration**: ~4 weeks
**Goal**: Festival fund lifecycle, recurring expense templates, resident expense queries, and advanced financial reports.
**Depends on**: Phase 2 (Core MVP shipped)
**Source**: Full Spec v3.0 Sections 9, 10, 19.7-19.10

---

## Task 3.1 — Festival Fund Creation & Management

### Backend

- API: `POST /api/v1/societies/[id]/festivals` — Create festival
- API: `GET /api/v1/societies/[id]/festivals` — List all festivals
- API: `GET /api/v1/societies/[id]/festivals/[festivalId]` — Detail with stats
- API: `PATCH /api/v1/societies/[id]/festivals/[festivalId]` — Update (only in DRAFT)
- API: `POST /api/v1/societies/[id]/festivals/[festivalId]/publish` — DRAFT → COLLECTING

### Festival ID Format

`[SocietyCode]-F-[Year]-[Seq]` — e.g., `EDENESTATE-F-2025-003`

### Festival Status Lifecycle

```
DRAFT → COLLECTING → CLOSED → COMPLETED
                  ↘ CANCELLED (at any active state)
```

### UI Screen: `/admin/festivals`

```
┌─────────────────────────────────────────────────────────────┐
│  [Sidebar]  │  Festival Funds                                │
│             │────────────────────────────────────────────────│
│  Dashboard  │                                                │
│  Residents  │  [+ Create Festival]                           │
│  Fees       │                                                │
│  Expenses   │  Active Festivals                              │
│  Festivals←│  ┌────────────────────────────────────────┐    │
│  Reports    │  │ 🎆 Diwali 2025                        │    │
│  Broadcast  │  │ Target: ₹50,000  Collected: ₹32,000   │    │
│             │  │ ████████████████░░░░░░ 64%             │    │
│             │  │ Status: COLLECTING  Ends: 25 Oct       │    │
│             │  │           [View Detail] [Record Payment]│    │
│             │  ├────────────────────────────────────────┤    │
│             │  │ 🎊 Republic Day Celebration             │    │
│             │  │ Target: ₹15,000  Collected: ₹15,000   │    │
│             │  │ ████████████████████ 100%              │    │
│             │  │ Status: CLOSED  Settlement pending     │    │
│             │  │           [View Detail] [Settle]       │    │
│             │  └────────────────────────────────────────┘    │
│             │                                                │
│             │  Past Festivals                                │
│             │  ┌────────────────────────────────────────┐   │
│             │  │ Name         │ Target  │ Status   │ Year│   │
│             │  │──────────────│─────────│──────────│─────│   │
│             │  │ Holi 2025    │ ₹20,000 │ COMPLETED│ 2025│   │
│             │  │ Dussehra '24 │ ₹30,000 │ CANCELLED│ 2024│   │
│             │  └────────────────────────────────────────┘   │
└─────────────┴───────────────────────────────────────────────┘
```

### UI: Create Festival Dialog

```
┌─────────────────────────────────────────────────┐
│  Create Festival Fund                      [✕]  │
│  ───────────────────────────────────────────     │
│                                                  │
│  Festival Name *                                 │
│  ┌────────────────────────────────────────┐     │
│  │ Diwali Celebration 2025               │     │
│  └────────────────────────────────────────┘     │
│                                                  │
│  Event Date *                                    │
│  ┌────────────────────────────────────────┐     │
│  │ 📅 20/10/2025                          │     │
│  └────────────────────────────────────────┘     │
│                                                  │
│  Target Amount (₹) *                             │
│  ┌────────────────────────────────────────┐     │
│  │ 50,000                                 │     │
│  └────────────────────────────────────────┘     │
│                                                  │
│  Collection Period *                             │
│  ┌──────────────────┐  ┌──────────────────┐    │
│  │ 📅 01/09/2025    │  │ 📅 15/10/2025    │    │
│  │ Start            │  │ End              │    │
│  └──────────────────┘  └──────────────────┘    │
│                                                  │
│  Description                                     │
│  ┌────────────────────────────────────────┐     │
│  │ Society-wide Diwali celebration with   │     │
│  │ decorations, puja, and community dinner│     │
│  └────────────────────────────────────────┘     │
│                                                  │
│  Publish to residents?                           │
│  (○) Save as Draft  (●) Publish immediately     │
│                                                  │
│               [Cancel]  [Create Festival]        │
└─────────────────────────────────────────────────┘
```

**Components to build**:

- `FestivalListPage` — Active + past festivals
- `FestivalCard` — Progress bar, stats, actions
- `CreateFestivalDialog` — Creation form
- `FestivalProgressBar` — Visual collection progress
- `FestivalStatusBadge` — DRAFT/COLLECTING/CLOSED/COMPLETED/CANCELLED

**Acceptance**: Festival created. Status transitions work. Multiple simultaneous festivals supported. Collection period enforced.

---

## Task 3.2 — Festival Contribution Recording

### Backend

- API: `POST /api/v1/societies/[id]/festivals/[festivalId]/contributions`
- Contribution is voluntary — no minimum
- Multiple contributions from same resident allowed and accumulated
- Receipt number: `[SocietyCode]-F-[Year]-[Seq]-C[ContribSeq]`

### UI: Record Contribution (from festival detail page)

```
┌─────────────────────────────────────────────────┐
│  Record Contribution                       [✕]  │
│  ───────────────────────────────────────────     │
│                                                  │
│  Festival: Diwali 2025                           │
│  Target: ₹50,000  │  Collected: ₹32,000         │
│                                                  │
│  Resident *                                      │
│  ┌────────────────────────────────────────┐     │
│  │ 🔍 Search by name or RWAID...         │     │
│  └────────────────────────────────────────┘     │
│  Selected: Hemant Kumar (#0089)                  │
│  Previous contributions: ₹500 (1 entry)         │
│                                                  │
│  Amount (₹) *                                    │
│  ┌────────────────────────────────────────┐     │
│  │ 1,000                                  │     │
│  └────────────────────────────────────────┘     │
│                                                  │
│  Payment Mode *                                  │
│  (●) Cash  (○) UPI  (○) Bank Transfer           │
│                                                  │
│  Date: Today (04/03/2026)                        │
│                                                  │
│            [Cancel]  [Record Contribution]       │
└─────────────────────────────────────────────────┘
```

### UI: Festival Detail Page

```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Festivals                                         │
│                                                              │
│  🎆 Diwali 2025                    Status: COLLECTING       │
│  EDENESTATE-F-2025-003                                       │
│  ─────────────────────────────────────────────────────────── │
│                                                              │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │
│  │ Target       │ │ Collected    │ │ Contributors │        │
│  │ ₹50,000      │ │ ₹32,000     │ │ 28 of 42    │        │
│  └──────────────┘ └──────────────┘ └──────────────┘        │
│  ████████████████░░░░░░ 64%                                 │
│                                                              │
│  [Record Contribution]  [View Non-Contributors]              │
│                                                              │
│  Contributors                                                │
│  ┌───────────────────────────────────────────────────┐      │
│  │ Resident       │ Total    │ Entries │ Last Date   │      │
│  │────────────────│──────────│─────────│─────────────│      │
│  │ Hemant Kumar   │ ₹1,500   │ 2       │ 04 Mar      │      │
│  │ Rajesh Sharma  │ ₹2,000   │ 1       │ 02 Mar      │      │
│  │ Priya Singh    │ ₹500     │ 1       │ 28 Feb      │      │
│  └───────────────────────────────────────────────────┘      │
│                                                              │
│  Expenses Against This Festival                              │
│  ┌───────────────────────────────────────────────────┐      │
│  │ No expenses recorded yet.  [+ Add Expense]        │      │
│  └───────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

**Acceptance**: Contributions recorded. Multiple per resident accumulated. Non-contributor list available. Expenses linkable to festival.

---

## Task 3.3 — Festival Settlement & Cancellation

### Backend

- Settlement: `POST /api/v1/societies/[id]/festivals/[festivalId]/settle`
  - Body: `{ surplusDisposal: 'CARRY_FORWARD' | 'TRANSFER_TO_SOCIETY' | 'REFUND_CONTRIBUTORS' }`
  - Generates settlement report (PDF)
- Cancellation: `POST /api/v1/societies/[id]/festivals/[festivalId]/cancel`
  - Body: `{ reason, disposal: 'REFUND' | 'TRANSFER' | 'CARRY_FORWARD' }`

### UI: Settlement Dialog

```
┌─────────────────────────────────────────────────┐
│  Settle Festival Fund                      [✕]  │
│  ───────────────────────────────────────────     │
│                                                  │
│  Diwali 2025 — Final Settlement                  │
│                                                  │
│  ┌────────────────────────────────────────┐     │
│  │ Total Collected:     ₹50,000           │     │
│  │ Total Expenses:      ₹47,200           │     │
│  │ ─────────────────────────────          │     │
│  │ Surplus:             ₹2,800            │     │
│  └────────────────────────────────────────┘     │
│                                                  │
│  How to handle the surplus? *                    │
│  (●) Carry forward to next festival              │
│  (○) Transfer to society's main fund             │
│  (○) Refund proportionally to contributors       │
│                                                  │
│  Notes                                           │
│  ┌────────────────────────────────────────┐     │
│  │ Surplus carried to Holi 2026 fund.     │     │
│  └────────────────────────────────────────┘     │
│                                                  │
│  ⚠ This publishes the settlement report to all  │
│  residents and marks the festival as COMPLETED.   │
│                                                  │
│            [Cancel]  [Publish Settlement]         │
└─────────────────────────────────────────────────┘
```

**Acceptance**: Surplus/deficit calculated. Disposal options work. Settlement report generated (PDF). Cancellation with reason and disposal. Reports visible to residents.

---

## Task 3.4 — Recurring Expense Templates

### Backend

- API: `POST /api/v1/societies/[id]/recurring-expenses` — Create template
- API: `GET /api/v1/societies/[id]/recurring-expenses` — List templates
- API: `PATCH /api/v1/societies/[id]/recurring-expenses/[id]` — Edit/deactivate
- Cron: Daily check for templates due today → create expense entry → notify admin to confirm or skip

### UI Screen: `/admin/expenses/recurring`

```
┌─────────────────────────────────────────────────────────────┐
│  Recurring Expenses                  [+ Add Template]       │
│  ─────────────────────────────────────────────────────────  │
│                                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Template          │Category  │ Amount │Day │ Status    │  │
│  │───────────────────│──────────│────────│────│───────────│  │
│  │ Security guard    │ Security │₹4,800  │ 1  │ ✅ Active │  │
│  │ Sweeper salary    │ Cleaning │₹1,800  │ 1  │ ✅ Active │  │
│  │ Electricity bill  │ Utilities│₹1,200  │ 15 │ ✅ Active │  │
│  │ Gardener          │ Staff    │₹1,800  │ 5  │ ⏸ Paused │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ℹ Active templates auto-create expense entries on the      │
│  specified day. You'll be asked to confirm or skip each.     │
└─────────────────────────────────────────────────────────────┘
```

### UI: Admin Confirmation (when template triggers)

```
┌─────────────────────────────────────────────────┐
│  📋 Recurring Expense Due                        │
│  ───────────────────────────────────────────     │
│                                                  │
│  Security guard salary — ₹4,800 (Security)      │
│  Due: 1st of every month                         │
│                                                  │
│  [✅ Confirm & Log]  [⏭ Skip This Month]        │
└─────────────────────────────────────────────────┘
```

**Acceptance**: Templates created. Auto-triggers on schedule. Admin confirms or skips. Skipped months logged. Pausing/deactivating works.

---

## Task 3.5 — Resident Expense Query & Dispute

### Backend

- API: `POST /api/v1/societies/[id]/expenses/[expenseId]/queries` — Resident raises query
- API: `GET /api/v1/societies/[id]/expense-queries` — Admin sees all queries
- API: `PATCH /api/v1/societies/[id]/expense-queries/[id]/respond` — Admin responds
- API: `POST /api/v1/societies/[id]/expense-queries/[id]/escalate` — Resident escalates to Super Admin
- Status flow: `OPEN → RESPONDED → RESOLVED` or `OPEN → ESCALATED → UNDER_REVIEW → RESOLVED`
- 7-day response deadline for admin

### UI: Resident raises query (from expense view)

```
┌─────────────────────────────────────────────────┐
│  Ask About This Expense                    [✕]  │
│  ───────────────────────────────────────────     │
│                                                  │
│  Expense: ₹4,800 — Security (03 Mar 2026)       │
│                                                  │
│  Your Question *                                 │
│  ┌────────────────────────────────────────┐     │
│  │ Why has the security cost increased    │     │
│  │ from ₹3,600 to ₹4,800 this month?     │     │
│  └────────────────────────────────────────┘     │
│                                                  │
│               [Cancel]  [Submit Query]           │
└─────────────────────────────────────────────────┘
```

### UI: Admin query dashboard

```
┌─────────────────────────────────────────────────────────────┐
│  Expense Queries                    3 Open  │  2 Resolved   │
│  ───────────────────────────────────────────────────────── │
│  ┌────────────────────────────────────────────────────┐    │
│  │ 🔴 Hemant Kumar asked about Security (₹4,800)      │    │
│  │ "Why has the security cost increased..."            │    │
│  │ Asked: 2 days ago  │  Status: OPEN                  │    │
│  │                              [Respond]              │    │
│  ├────────────────────────────────────────────────────┤    │
│  │ 🟡 Priya Singh asked about Infrastructure (₹8,000) │    │
│  │ "What was this infrastructure expense for?"         │    │
│  │ Asked: 5 days ago  │  Status: OPEN  ⚠ Due in 2 days│    │
│  │                              [Respond]              │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

**Acceptance**: Resident raises query from expense view. Admin sees all queries with deadlines. Response sent to resident. Escalation to Super Admin works. Resolution marked by both parties.

---

## Task 3.6 — Advanced Reports

### Additional reports beyond MVP's 5:

| Report                          | Content                                   | Format      |
| ------------------------------- | ----------------------------------------- | ----------- |
| Festival Contributor List       | All contributors + amounts for a festival | PDF + Excel |
| Festival Non-Contributor List   | Residents who didn't contribute           | PDF + Excel |
| Festival Expense Breakdown      | Category-wise expenses for a festival     | PDF + Excel |
| Festival Settlement Report      | Final surplus/deficit + disposal          | PDF         |
| Session-over-Session Comparison | Fee collection % across sessions          | PDF         |

### UI: Reports page additions

```
┌──────────────────────────────────────────┐
│ Festival Reports                          │
│ ┌──────────────────────────────────────┐ │
│ │ 📄 Contributor List                  │ │
│ │ Festival: [Diwali 2025 ▾]           │ │
│ │ 28 contributors, ₹50,000 total      │ │
│ │            [📥 PDF]  [📥 Excel]     │ │
│ ├──────────────────────────────────────┤ │
│ │ 📄 Non-Contributor List              │ │
│ │ 14 residents not yet contributed     │ │
│ │            [📥 PDF]  [📥 Excel]     │ │
│ ├──────────────────────────────────────┤ │
│ │ 📄 Festival Expense Breakdown        │ │
│ │ 8 expenses totalling ₹47,200        │ │
│ │            [📥 PDF]  [📥 Excel]     │ │
│ ├──────────────────────────────────────┤ │
│ │ 📄 Settlement Report                 │ │
│ │ Surplus: ₹2,800 → Carried forward   │ │
│ │            [📥 PDF]                  │ │
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘
```

**Acceptance**: All 5 additional reports generate correctly. Festival selector works. Watermarked PDFs. Excel exports formatted.

---

## Phase 3 Definition of Done

- [ ] Festival creation with all fields (name, date, target, collection period)
- [ ] Festival status lifecycle: DRAFT → COLLECTING → CLOSED → COMPLETED
- [ ] Cancellation with reason and fund disposal
- [ ] Contribution recording: voluntary, multiple per resident, accumulated
- [ ] Non-contributor list available
- [ ] Festival expenses linked to festival ID
- [ ] Settlement: surplus/deficit calculation + disposal options
- [ ] Settlement report PDF generated and visible to all residents
- [ ] Recurring expense templates: create, auto-trigger, confirm/skip
- [ ] Resident expense query: raise, admin respond, escalate, resolve
- [ ] 7-day admin response deadline tracked
- [ ] 5 additional festival reports (PDF + Excel)
- [ ] Session comparison report
- [ ] All UI responsive with loading states and empty states
