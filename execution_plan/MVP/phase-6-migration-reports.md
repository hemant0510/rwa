# MVP Phase 6 — Data Migration & Reports

**Duration**: ~1 week
**Goal**: Bulk resident import via Excel with validation. 5 downloadable reports (PDF + Excel).
**Depends on**: Phase 3 (fee data), Phase 4 (expense data)

---

## Task 6.1 — Excel Template Download

### Backend

- API: `GET /api/v1/societies/[id]/migration/template` (returns .xlsx)
- Template dynamically generated based on society type:
  - Apartment Complex → Tower/Block, Floor No, Flat No columns
  - Builder Floors → House No, Floor Level columns
  - Gated Community → Villa No, Street/Phase columns
  - Independent Sector → House No, Street/Gali, Sector/Block columns
  - Plotted Colony → Plot No, Lane No, Phase columns

### Excel Template Structure (Independent Sector example)

```
┌───────────────────────────────────────────────────────────────────┐
│ A          │ B       │ C        │ D            │ E      │ F      │
│────────────│─────────│──────────│──────────────│────────│────────│
│ Full Name* │ Mobile* │ House No*│ Street/Gali* │ Sector*│ Owner/ │
│            │         │          │              │        │Tenant* │
│────────────│─────────│──────────│──────────────│────────│────────│
│ Hemant K.  │98765432 │ 245      │ Street 7     │ 22     │ Owner  │
│ Rajesh S.  │98765433 │ 110      │ Street 3     │ 22     │ Owner  │
│ Priya S.   │98765434 │ 301      │ Street 9     │ 22     │ Tenant │
│            │         │          │              │        │        │
│────────────│─────────│──────────│──────────────│────────│────────│
│ G          │ H       │ I                                         │
│────────────│─────────│──────────────────────────────────────────│
│ Fee Status │ Last    │ Email                                     │
│ (Paid/     │ Payment │ (optional)                                │
│ Pending)*  │ Date    │                                           │
│────────────│─────────│──────────────────────────────────────────│
│ Paid       │15/03/26 │ hemant@email.com                         │
│ Pending    │         │                                           │
│ Paid       │01/02/26 │ priya@email.com                          │
└───────────────────────────────────────────────────────────────────┘
```

**Implementation**: Use `xlsx` or `exceljs` package to generate template with:

- Header row (bold, colored)
- Column dropdowns for Ownership Type (Owner/Tenant) and Fee Status (Paid/Pending)
- Data validation rules embedded in the Excel file
- Instructions sheet with field descriptions

**Acceptance**: Template downloads as .xlsx. Columns match society type. Dropdowns work in Excel.

---

## Task 6.2 — Upload & Validation

### Backend

- API: `POST /api/v1/societies/[id]/migration/validate` (accepts .xlsx, returns validation report)
- API: `POST /api/v1/societies/[id]/migration/import` (imports validated data)

### Validation Rules

| Rule                        | Error Message                                                        |
| --------------------------- | -------------------------------------------------------------------- |
| Full Name blank             | "Row X: Full Name is required"                                       |
| Mobile blank                | "Row X: Mobile Number is required"                                   |
| Mobile not 10 digits        | "Row X: Invalid mobile number (must be 10 digits starting with 6-9)" |
| Duplicate mobile in file    | "Row X: Duplicate mobile — same as Row Y"                            |
| Mobile already registered   | "Row X: Mobile 98765xxxx already registered in this society"         |
| Unit fields blank           | "Row X: House No is required"                                        |
| Ownership not Owner/Tenant  | "Row X: Ownership must be 'Owner' or 'Tenant'"                       |
| Fee Status not Paid/Pending | "Row X: Fee Status must be 'Paid' or 'Pending'"                      |
| Invalid date format         | "Row X: Last Payment Date must be DD/MM/YYYY format"                 |

### UI Screen: `/admin/migration`

```
┌─────────────────────────────────────────────────────────────┐
│  [Sidebar]  │  Bulk Resident Import                         │
│             │────────────────────────────────────────────────│
│  Dashboard  │                                                │
│  Residents  │  Step 1: Download Template                     │
│  Fees       │  ─────────────────────────                     │
│  Expenses   │                                                │
│  Reports    │  Download the Excel template pre-configured    │
│  Broadcast  │  for your society type (Independent Sector).   │
│  Migration←│                                                │
│             │  [📥 Download Template]                        │
│             │                                                │
│             │  Step 2: Upload Filled File                    │
│             │  ──────────────────────────                    │
│             │                                                │
│             │  ┌────────────────────────────────────────┐   │
│             │  │                                        │   │
│             │  │   📎 Drop Excel file or click to       │   │
│             │  │      upload (.xlsx only, max 5MB)      │   │
│             │  │                                        │   │
│             │  └────────────────────────────────────────┘   │
│             │                                                │
│             │                              [Validate File]   │
└─────────────┴───────────────────────────────────────────────┘
```

### UI: After Validation (with errors)

```
┌─────────────────────────────────────────────────────────────┐
│  [Sidebar]  │  Validation Report                            │
│             │────────────────────────────────────────────────│
│             │                                                │
│  Migration←│  📊 File: eden_residents.xlsx                   │
│             │                                                │
│             │  ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│             │  │ Total:105│ │✅ Valid:98│ │❌ Errors:7│      │
│             │  └──────────┘ └──────────┘ └──────────┘      │
│             │                                                │
│             │  ⚠ 7 rows have errors. Fix in Excel and       │
│             │  re-upload to proceed.                         │
│             │                                                │
│             │  Errors                                        │
│             │  ┌───────────────────────────────────────────┐│
│             │  │ Row │ Field        │ Error                 ││
│             │  │─────│──────────────│───────────────────────││
│             │  │  12 │ Mobile       │ Invalid: must be 10   ││
│             │  │     │              │ digits starting 6-9   ││
│             │  │  23 │ Mobile       │ Duplicate: same as    ││
│             │  │     │              │ Row 5                 ││
│             │  │  31 │ Full Name    │ Required field empty  ││
│             │  │  45 │ Ownership    │ Must be Owner or      ││
│             │  │     │              │ Tenant                ││
│             │  │  67 │ Mobile       │ Already registered    ││
│             │  │     │              │ in this society       ││
│             │  │  78 │ Fee Status   │ Must be Paid or       ││
│             │  │     │              │ Pending               ││
│             │  │  91 │ House No     │ Required field empty  ││
│             │  └───────────────────────────────────────────┘│
│             │                                                │
│             │  [Re-upload Fixed File]  [Import 98 Valid Rows]│
└─────────────┴───────────────────────────────────────────────┘
```

### UI: After Validation (all valid)

```
┌─────────────────────────────────────────────────────────────┐
│  [Sidebar]  │  Validation Report                            │
│             │────────────────────────────────────────────────│
│             │                                                │
│  Migration←│  📊 File: eden_residents.xlsx                   │
│             │                                                │
│             │  ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│             │  │Total: 105│ │✅Valid:105│ │❌Errors: 0│      │
│             │  └──────────┘ └──────────┘ └──────────┘      │
│             │                                                │
│             │  ✅ All rows validated successfully!           │
│             │                                                │
│             │  Preview (first 5 rows)                        │
│             │  ┌───────────────────────────────────────────┐│
│             │  │ Name         │ Mobile     │ Unit    │Type  ││
│             │  │──────────────│────────────│─────────│──────││
│             │  │ Hemant Kumar │ 98765xxxxx │S22-H245 │Owner ││
│             │  │ Rajesh S.    │ 98765xxxxx │S22-H110 │Owner ││
│             │  │ Priya Singh  │ 98765xxxxx │S22-H301 │Tenant││
│             │  │ Amit Verma   │ 98765xxxxx │S22-H88  │Owner ││
│             │  │ Neha Gupta   │ 98765xxxxx │S22-H55  │Owner ││
│             │  └───────────────────────────────────────────┘│
│             │  ... and 100 more                              │
│             │                                                │
│             │  This will:                                    │
│             │  • Create 105 resident accounts                │
│             │  • Auto-generate 105 RWAIDs                   │
│             │  • Set fee status as imported                  │
│             │  • Queue WhatsApp activation messages          │
│             │                                                │
│             │             [Cancel]  [Confirm Import]         │
└─────────────┴───────────────────────────────────────────────┘
```

### UI: Import Progress & Complete

```
┌─────────────────────────────────────────────────┐
│  Import Progress                                 │
│  ───────────────                                 │
│                                                  │
│  ████████████████████████████░░░░  85%           │
│  Importing 89 of 105 residents...                │
│                                                  │
│  ✅ Accounts created: 89                         │
│  ✅ RWAIDs generated: 89                         │
│  ⏳ WhatsApp queued: 89                          │
└─────────────────────────────────────────────────┘

→ On completion:

┌─────────────────────────────────────────────────┐
│  ✅ Import Complete                              │
│  ───────────────                                 │
│                                                  │
│  105 residents imported successfully!            │
│                                                  │
│  ┌────────────────────────────────────────┐     │
│  │ Accounts created:     105              │     │
│  │ RWAIDs generated:     105              │     │
│  │ Fee status Paid:       72              │     │
│  │ Fee status Pending:    33              │     │
│  │ WhatsApp queued:      105              │     │
│  └────────────────────────────────────────┘     │
│                                                  │
│  Residents who don't activate within 30 days     │
│  will receive a reminder. After 60 days they     │
│  become Dormant (but are never deleted).         │
│                                                  │
│  [View Imported Residents]  [Done]               │
└─────────────────────────────────────────────────┘
```

**Components to build**:

- `MigrationWizard` — Multi-step: download template → upload → validate → import
- `TemplateDownloadButton` — Downloads society-type-specific Excel template
- `FileUploadDropzone` — Excel file upload (max 5MB, .xlsx only)
- `ValidationReportCard` — Shows total/valid/error counts
- `ValidationErrorTable` — Row-by-row error listing
- `ImportPreviewTable` — First 5 rows preview before confirming
- `ImportProgressBar` — Real-time progress during import
- `ImportCompleteCard` — Summary of imported data
- Use shadcn `Card`, `Table`, `Progress`, `Button`, `Alert`

**Acceptance**: Template downloads with correct columns per society type. Validation catches all error types. Import creates accounts + RWAIDs. WhatsApp activation messages queued. Progress shown during import.

---

## Task 6.3 — Report: Paid Members List

### Backend

- API: `GET /api/v1/societies/[id]/reports/paid-list?session=2025-26&format=pdf|xlsx`
- Returns all residents with `PAID` fee status for the session

### PDF Report Layout

```
┌──────────────────────────────────────────────────────┐
│                                                       │
│           Eden Estate RWA — Paid Members List         │
│           Session: 2025-26 (Apr 2025 — Mar 2026)     │
│           Generated: 04 March 2026 by Hemant Kumar    │
│           Society ID: RWA-HR-GGN-122001-0001          │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │ # │ Name         │ Unit    │ Amount │ Date │Rcpt │ │
│  │───│──────────────│─────────│────────│──────│─────│ │
│  │ 1 │ Hemant Kumar │S22-H245 │₹1,200 │04 Mar│R0042│ │
│  │ 2 │ Rajesh Sharma│S22-H110 │₹1,200 │02 Mar│R0041│ │
│  │ 3 │ Sita Devi    │S22-H67  │₹1,200 │28 Feb│R0040│ │
│  │ ..│ ...          │...      │...     │...   │...  │ │
│  │32 │ Vikram Rao   │S22-H12  │₹1,200 │15 Apr│R0011│ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  Total Paid: 32 of 42 residents                       │
│  Total Amount Collected: ₹38,400                      │
│                                                       │
│  ─────────────────────────────────────────────────── │
│  CONFIDENTIAL — Eden Estate RWA                       │
│  Watermark: RWA-HR-GGN-122001-0001 | 04 Mar 2026    │
└──────────────────────────────────────────────────────┘
```

---

## Task 6.4 — Report: Pending / Overdue List

### Backend

- API: `GET /api/v1/societies/[id]/reports/pending-list?session=2025-26&format=pdf|xlsx`
- Returns all residents with `PENDING`, `OVERDUE`, or `PARTIAL` status

### PDF Report Layout

```
┌──────────────────────────────────────────────────────┐
│                                                       │
│      Eden Estate RWA — Pending / Overdue List         │
│      Session: 2025-26 (Apr 2025 — Mar 2026)          │
│      Generated: 04 March 2026 by Hemant Kumar         │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │ # │ Name       │ Unit   │ Due    │ Paid │Status  │ │
│  │───│────────────│────────│────────│──────│────────│ │
│  │ 1 │ Amit Verma │S22-H88 │₹1,200 │  ₹0 │OVERDUE │ │
│  │ 2 │ Deepak M.  │S22-H44 │₹1,200 │  ₹0 │PENDING │ │
│  │ 3 │ Priya Singh│S22-H301│₹1,000 │₹800 │PARTIAL │ │
│  │ ..│ ...        │...     │...    │...   │...     │ │
│  │10 │ Kavita J.  │S22-H99 │₹1,200 │  ₹0 │OVERDUE │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  Summary:                                             │
│  Pending: 5  │  Overdue: 3  │  Partial: 2            │
│  Total Outstanding: ₹12,000                           │
│                                                       │
│  ─────────────────────────────────────────────────── │
│  Watermark: RWA-HR-GGN-122001-0001 | 04 Mar 2026    │
└──────────────────────────────────────────────────────┘
```

---

## Task 6.5 — Report: Full Resident Directory

### Backend

- API: `GET /api/v1/societies/[id]/reports/directory?format=pdf|xlsx`
- All active residents with status indicators
- Filterable: `?ownership=OWNER&block=22`

### PDF Report Layout

```
┌──────────────────────────────────────────────────────┐
│                                                       │
│        Eden Estate RWA — Resident Directory           │
│        Total Active: 42 (30 Owners, 12 Tenants)      │
│        Generated: 04 March 2026                       │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │ # │ RWAID │ Name         │ Unit    │ Type │ Fee  │ │
│  │───│───────│──────────────│─────────│──────│──────│ │
│  │ 1 │ #0001 │ Hemant Kumar │S22-H245 │Owner │ Paid │ │
│  │ 2 │ #0002 │ Rajesh Sharma│S22-H110 │Owner │ Paid │ │
│  │ 3 │ #0003 │ Priya Singh  │S22-H301 │Tenant│ Part.│ │
│  │ ..│ ...   │ ...          │ ...     │ ...  │ ...  │ │
│  │42 │ #0042 │ Kavita Jain  │S22-H99  │Owner │ Over │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  Watermark: RWA-HR-GGN-122001-0001 | 04 Mar 2026    │
└──────────────────────────────────────────────────────┘
```

---

## Task 6.6 — Report: Expense Summary

### Backend

- API: `GET /api/v1/societies/[id]/reports/expense-summary?session=2025-26&format=pdf|xlsx`

### PDF Report Layout

```
┌──────────────────────────────────────────────────────┐
│                                                       │
│        Eden Estate RWA — Expense Summary              │
│        Session: 2025-26 (Apr 2025 — Mar 2026)        │
│        Generated: 04 March 2026                       │
│                                                       │
│  Category Breakdown                                   │
│  ┌─────────────────────────────────────────────────┐ │
│  │ Category       │ Count │ Total     │ % of Total  │ │
│  │────────────────│───────│───────────│─────────────│ │
│  │ Security       │   12  │ ₹57,600  │    33%      │ │
│  │ Staff Salary   │   12  │ ₹43,200  │    25%      │ │
│  │ Maintenance    │    8  │ ₹28,800  │    17%      │ │
│  │ Cleaning       │   12  │ ₹21,600  │    13%      │ │
│  │ Utilities      │   11  │ ₹13,200  │     8%      │ │
│  │ Other          │    3  │  ₹7,200  │     4%      │ │
│  │────────────────│───────│───────────│─────────────│ │
│  │ TOTAL          │   58  │₹1,71,600 │   100%      │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  Financial Summary                                    │
│  ┌─────────────────────────────────────────────────┐ │
│  │ Total Fees Collected     ₹1,95,600              │ │
│  │ Total Expenses           ₹1,71,600              │ │
│  │ Balance in Hand           ₹24,000               │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  Watermark: RWA-HR-GGN-122001-0001 | 04 Mar 2026    │
└──────────────────────────────────────────────────────┘
```

---

## Task 6.7 — Report: Fee Collection Summary

### Backend

- API: `GET /api/v1/societies/[id]/reports/collection-summary?session=2025-26&format=pdf|xlsx`

### PDF Report Layout

```
┌──────────────────────────────────────────────────────┐
│                                                       │
│     Eden Estate RWA — Fee Collection Summary          │
│     Session: 2025-26 (Apr 2025 — Mar 2026)           │
│     Generated: 04 March 2026                          │
│                                                       │
│  Overview                                             │
│  ┌─────────────────────────────────────────────────┐ │
│  │ Total Members:            42                    │ │
│  │ Annual Fee:               ₹1,200 per member    │ │
│  │ Total Due:                ₹50,400              │ │
│  │ Total Collected:          ₹38,400   (76%)      │ │
│  │ Total Outstanding:        ₹12,000   (24%)      │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  Status Breakdown                                     │
│  ┌─────────────────────────────────────────────────┐ │
│  │ Status    │ Count │ Amount     │ % of Total     │ │
│  │───────────│───────│────────────│────────────────│ │
│  │ Paid      │   32  │ ₹38,400   │     76%        │ │
│  │ Pending   │    5  │  ₹6,000   │     12%        │ │
│  │ Overdue   │    3  │  ₹3,600   │      7%        │ │
│  │ Partial   │    1  │    ₹200   │    <1%         │ │
│  │ Exempted  │    1  │  ₹1,200   │      2%        │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  Collection Progress: ████████████████░░░░░ 76%      │
│                                                       │
│  Watermark: RWA-HR-GGN-122001-0001 | 04 Mar 2026    │
└──────────────────────────────────────────────────────┘
```

---

## Task 6.8 — Reports Dashboard (Admin)

### Backend

- All 5 report APIs accept `?format=pdf` and `?format=xlsx` query param
- PDF: Generated with `@react-pdf/renderer`, watermarked
- Excel: Generated with `exceljs` package

### UI Screen: `/admin/reports`

```
┌─────────────────────────────────────────────────────────────┐
│  [Sidebar]  │  Reports — Session 2025-26   [2024-25 ▾]     │
│             │────────────────────────────────────────────────│
│  Dashboard  │                                                │
│  Residents  │  Available Reports                             │
│  Fees       │  ─────────────────                             │
│  Expenses   │                                                │
│  Reports ←  │  ┌────────────────────────────────────────┐   │
│  Broadcast  │  │ 📄 Paid Members List                    │   │
│  Migration  │  │ All residents with Paid status          │   │
│             │  │ 32 paid out of 42 total                 │   │
│             │  │              [📥 PDF]  [📥 Excel]       │   │
│             │  ├────────────────────────────────────────┤   │
│             │  │ 📄 Pending / Overdue List               │   │
│             │  │ Residents with outstanding fees         │   │
│             │  │ 10 residents (₹12,000 outstanding)     │   │
│             │  │              [📥 PDF]  [📥 Excel]       │   │
│             │  ├────────────────────────────────────────┤   │
│             │  │ 📄 Full Resident Directory              │   │
│             │  │ Complete member list with status        │   │
│             │  │ 42 active residents                     │   │
│             │  │              [📥 PDF]  [📥 Excel]       │   │
│             │  ├────────────────────────────────────────┤   │
│             │  │ 📄 Expense Summary                      │   │
│             │  │ Expenses by category with totals        │   │
│             │  │ 58 entries, ₹1,71,600 total            │   │
│             │  │              [📥 PDF]  [📥 Excel]       │   │
│             │  ├────────────────────────────────────────┤   │
│             │  │ 📄 Fee Collection Summary               │   │
│             │  │ Collection progress and breakdown       │   │
│             │  │ 76% collected (₹38,400 of ₹50,400)    │   │
│             │  │              [📥 PDF]  [📥 Excel]       │   │
│             │  └────────────────────────────────────────┘   │
│             │                                                │
│             │  ℹ All reports include a watermark with your   │
│             │  Society ID, report date, and your name.       │
└─────────────┴───────────────────────────────────────────────┘
```

**Components to build**:

- `ReportsDashboard` — Page listing all available reports
- `ReportCard` — Card per report with description, live count, download buttons
- `ReportDownloadButton` — Downloads PDF or Excel with loading spinner
- `SessionSelector` — Reuse from Phase 3
- Use shadcn `Card`, `Button`, `Select`, `Spinner`

**PDF Implementation**:

- `@react-pdf/renderer` for all PDF reports
- Shared `ReportHeader` component (society name, session, date, admin name)
- Shared `ReportWatermark` component (society ID + date)
- A4 portrait, print-ready

**Excel Implementation**:

- `exceljs` package for .xlsx generation
- Formatted headers (bold, colored)
- Auto-column width
- Totals row at bottom

**Acceptance**: All 5 reports download as PDF and Excel. PDFs watermarked. Excel formatted with headers and totals. Session selector switches report data. Live counts shown before download.

---

## Phase 6 Definition of Done

- [ ] Migration Excel template downloads with correct columns per society type
- [ ] Upload validates: mandatory fields, mobile format, duplicates, ownership values
- [ ] Validation report shows row-by-row errors with clear messages
- [ ] Admin can import all valid rows (option to skip error rows)
- [ ] Import creates accounts + auto-generates RWAIDs
- [ ] Imported residents receive WhatsApp activation message
- [ ] Import progress shown in real-time
- [ ] Dormant status after 60 days of non-activation (never deleted)
- [ ] Paid Members List report: PDF + Excel, watermarked
- [ ] Pending/Overdue List report: PDF + Excel, with outstanding amounts
- [ ] Resident Directory report: PDF + Excel, filterable by type/status
- [ ] Expense Summary report: PDF + Excel, by category with totals
- [ ] Fee Collection Summary report: PDF + Excel, collection percentage
- [ ] All PDFs print-quality, A4 portrait
- [ ] All reports scoped to logged-in admin's society only
- [ ] Reports dashboard shows live counts before download
