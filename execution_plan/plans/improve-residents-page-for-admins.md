# Plan: Residents Page Improvements

## Context

The `/admin/residents` page is the core admin tool for managing society residents. Currently it has:

- Basic search by name/mobile only (though API also searches RWAID)
- Status filter only
- Hard-coded 20-per-page prev/next pagination (hidden when ≤ 20 records)
- No email verification action from admin side
- No bulk import capability

This plan adds: enhanced filters, admin-triggered verification email, numbered pagination with page size selector, RWAID year filter, and a full bulk import flow (CSV/Excel/XLS).

---

## Feature Breakdown

### 1. Enhanced Search & Filters

**API changes** (`src/app/api/v1/residents/route.ts`):

- Add `email` to the OR search clause (`{ email: { contains: search, mode: "insensitive" } }`)
- Add `emailVerified` param → maps to `where.isEmailVerified: true/false`
- Add `ownershipType` param → maps to `where.ownershipType`
- Add `year` param → `where.rwaid = { contains: \`-${year}-\` }`(e.g.`-2026-` is unique in RWAID format)
- `limit` param already accepted; no change needed

**Service changes** (`src/services/residents.ts`):

- Extend `getResidents` params type: add `limit`, `emailVerified`, `ownershipType`, `year`
- Pass new params as query string args

**Page changes** (`src/app/admin/residents/page.tsx`):

- Update search placeholder → `"Search by name, mobile, email, or RWAID..."`
- Add state: `emailVerifiedFilter` ("all" | "true" | "false"), `ownershipFilter` ("all" | "OWNER" | "TENANT"), `yearFilter` ("all" | "2020" ... current year)
- Add 3 new filter dropdowns in the filter row (Email Verified / Ownership Type / RWAID Year)
- Reset page to 1 on any filter change

---

### 2. Send Verification Email (Admin-Triggered)

**New API route** (`src/app/api/v1/residents/[id]/send-verification/route.ts`):

- `POST /api/v1/residents/[id]/send-verification`
- Fetch user by ID + societyId, verify `isEmailVerified === false`
- Call `sendVerificationEmail(user.id, user.email, user.name)` from `src/lib/verification.ts` — no cooldown check (admin bypass)
- Return `{ success: true, message: "Verification email sent" }`

**Service changes** (`src/services/residents.ts`):

- Add `sendResidentVerificationEmail(id: string): Promise<{ success: boolean }>`

**Page changes** (`src/app/admin/residents/page.tsx`):

- In the Email Verified column: when `isEmailVerified === false`, show a small `<Button size="sm" variant="ghost">` with mail icon inline next to the "Not Verified" badge
- Clicking triggers `sendVerificationMutation` — shows loading spinner and success/error toast
- Button is disabled while the mutation is pending

---

### 3. Pagination: Numbered Pages + Page Size Selector

**Page changes** (`src/app/admin/residents/page.tsx`):

- Add `limit` state (default `20`, options: `20`, `50`)
- Add page size dropdown: "Show: 20 / 50" — resets page to 1 on change
- Replace prev/next-only with smart numbered pagination:
  - Show up to 7 page numbers with `...` truncation (e.g. `1 2 3 ... 8 9 10`)
  - Keep `<` and `>` arrows on sides
  - Highlight current page
- Show pagination bar always (not just when `total > 20`)
- Fix display: `Showing {(page-1)*limit + 1}–{Math.min(page*limit, total)} of {total}`

**Service changes** (`src/services/residents.ts`):

- Accept `limit` in params and pass as `limit=N` to API

---

### 4. RWAID Year Dropdown Filter

Already included in Feature 1 (`year` filter). Extra detail:

- Year options generated dynamically: `Array.from({length: currentYear - 2019}, (_, i) => 2020 + i)` plus `currentYear + 1`
- Placed as a 4th filter dropdown labelled "RWA Year"
- Works independently of text search (not mutually exclusive)

---

### 5. Bulk Import: CSV / Excel / XLS

**New packages to install:**

- `papaparse` + `@types/papaparse` — CSV parsing (client-side)
- `xlsx` — Excel/XLS parsing (client-side)

**Sample template file** (`public/templates/residents-import-template.csv`):

```
Full Name,Email,Mobile,Ownership Type,Flat/Unit Number,Block/Tower,Floor Level,Registration Year
John Doe,john@example.com,9876543210,OWNER,A-101,A,FIRST,2021
Jane Smith,jane@example.com,9123456780,TENANT,B-202,B,SECOND,
```

- Downloadable via static link `/templates/residents-import-template.csv`
- Columns: Full Name*, Email*, Mobile*, Ownership Type* (OWNER/TENANT), Flat/Unit Number, Block/Tower, Floor Level, Registration Year (optional, 4-digit, e.g. `2021`)
- If `Registration Year` is blank → defaults to current year (2026)
- If `Registration Year` is provided → RWAID uses that historical year

**New bulk upload API** (`src/app/api/v1/residents/bulk-upload/route.ts`):

```
POST /api/v1/residents/bulk-upload
Body: { societyCode: string, records: BulkResidentRecord[] }
```

BulkResidentRecord includes: `{ fullName, email, mobile, ownershipType, unitAddress?, registrationYear? }`

**Processing logic (per record):**

1. Validate fields (same as register route)
2. Determine `year = registrationYear ?? currentYear`
3. Create user with `status: "ACTIVE_PENDING"` (bypass approval step)
4. Set `joiningFeePaid: true` — bulk-imported residents have already paid their joining fee at the time they originally joined; no joining fee should be collected again
5. Generate RWAID immediately: count existing RWAIDs containing `-${year}-` for this society → assign next sequential number
   - Process records with same year **sequentially** within a batch to avoid RWAID counter race conditions
6. Set `approvedAt = now()`, `activatedAt = now()` (since admin is doing the import)
7. Returns `{ results: Array<{ rowIndex: number, success: boolean, rwaid?: string, error?: string }> }`

**New component** (`src/components/residents/BulkUploadDialog.tsx`):

- Triggered by "Import Residents" button in page header (next to "Add Resident")

**Upload flow (5 steps):**

1. **Drop zone**: Drag-and-drop or click to select `.csv`, `.xlsx`, `.xls`
   - "Download sample template" link below the drop zone

2. **Parse & validate (client-side)**:
   - Parse file using `papaparse` (CSV) or `xlsx` (Excel/XLS)
   - Validate each row: required fields, email format, 10-digit mobile, OWNER/TENANT
   - Show summary: `"Found 500 records — 497 valid, 3 invalid"`
   - Show invalid rows in a compact table (row #, field, error)
   - "Download invalid records as CSV" button (client-side generation)

3. **Confirm**: "Proceed with 497 valid records" primary button

4. **Processing**: Send valid records to API in batches of 10
   - Progress bar: `"Processing... batch 12 of 50"`
   - On batch failure: collect server-side errors (e.g., duplicate email)

5. **Results summary**:
   - `"✓ 490 residents added (with RWAID assigned), 7 failed"`
   - For successes: show assigned RWAID per row (with original year)
   - List any server-side failures (e.g., duplicate email)
   - "Download failed records as CSV" button (preserves original row data + error message)
   - "Close" button → invalidates `["residents"]` query

**Historical year handling summary:**

- `Registration Year` in CSV is optional (4-digit year, e.g. `2021`, `2022`)
- Blank → current year used
- Server uses year to slot the RWAID counter correctly per-year
- Example: 2 residents from 2021 + 3 new (2026) → RWAID counter is tracked independently per year
- Client-side validation: year must be between 2010 and current year + 1 if provided

---

### 6. Additional Suggestions (bonus, implement if time permits)

| Improvement                    | Why                                                 | Effort |
| ------------------------------ | --------------------------------------------------- | ------ |
| **Ownership type column**      | At a glance, know Owner vs Tenant                   | Low    |
| **Unit/flat number in table**  | Most useful info for admin (already in `userUnits`) | Low    |
| **Sort options**               | Sort by name, date registered, status               | Medium |
| **Export current list as CSV** | For offline use / reporting                         | Medium |
| **URL-based filter state**     | Shareable filtered views, survives refresh          | Medium |
| **Summary stats bar**          | "45 total · 5 pending · 3 unverified" above filters | Low    |
| **Clickable rows**             | Whole row navigates to detail, not just name link   | Low    |

---

## Files to Create

| File                                                       | Purpose                                  |
| ---------------------------------------------------------- | ---------------------------------------- |
| `src/app/api/v1/residents/[id]/send-verification/route.ts` | Admin-bypass verification email endpoint |
| `src/app/api/v1/residents/bulk-upload/route.ts`            | Batch resident registration endpoint     |
| `src/components/residents/BulkUploadDialog.tsx`            | Full bulk import UI component            |
| `public/templates/residents-import-template.csv`           | Sample download template                 |

## Files to Modify

| File                                | Changes                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------- |
| `src/app/admin/residents/page.tsx`  | All UI changes: filters, pagination, send-email button, import button           |
| `src/services/residents.ts`         | Add limit/emailVerified/ownershipType/year params, add sendVerificationEmail fn |
| `src/app/api/v1/residents/route.ts` | Add email to search OR, add emailVerified/ownershipType/year filters            |

## Key Reuse

- `sendVerificationEmail()` from `src/lib/verification.ts` — reused in new send-verification route
- `sendEmail()` from `src/lib/email.ts` — already used by above
- Existing registration logic from `src/app/api/v1/residents/register/route.ts` — reuse validation pattern in bulk-upload route
- `RESIDENT_STATUS_LABELS` from `src/types/user.ts`
- `useSocietyId` hook, `useQuery`/`useMutation` patterns from React Query — consistent with current page

## New Dependencies

```bash
npm install papaparse xlsx
npm install --save-dev @types/papaparse
```

## Verification Plan

1. Run `npm run dev` — navigate to `/admin/residents`
2. Test search: type an email → resident with that email appears
3. Test email verified filter: select "Not Verified" → only unverified residents shown
4. Test ownership filter: select "Tenant" → only tenants shown
5. Test year filter: select current year → only residents with RWAID containing that year
6. Test send verification email: find unverified resident → click mail button → toast appears → check SMTP logs
7. Test page size: switch to 50 → 50 records load; numbered pages show correctly
8. Test bulk upload: upload sample CSV with 1 valid + 1 invalid row → see error table → download invalid → proceed with valid → verify resident appears in list
9. Run `npm run lint` — no errors
