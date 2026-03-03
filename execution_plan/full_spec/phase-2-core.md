# Full Spec Phase 2 — Core MVP

**Duration**: ~8 weeks
**Goal**: Ship the first production-ready version of RWA Connect — society onboarding, resident registration, fee management, expense ledger, WhatsApp notifications, data migration, and reports.
**Depends on**: Phase 1 (Foundation & Setup — DB, auth, layouts, design system, i18n scaffold)

---

## Relationship to MVP Plan

This phase consolidates **all 7 MVP phases** (1-7) into a single phase reference within the full product roadmap. It covers the same scope but includes full-spec additions that the MVP plan deferred:

| Area                 | MVP Plan                 | Full Spec Addition in This Phase                                                          |
| -------------------- | ------------------------ | ----------------------------------------------------------------------------------------- |
| Society types        | `INDEPENDENT_SECTOR`     | `INDEPENDENT_SECTOR_COLONY` (renamed for clarity)                                         |
| Admin positions      | 2 (Primary + Supporting) | All 6: President, Vice President, Secretary, Joint Secretary, Treasurer, Executive Member |
| Registration timeout | No auto-expire           | 14-day auto-expire with 7-day reminder to admins                                          |
| Ownership detection  | Basic Owner/Tenant       | Joint ownership detection on registration                                                 |
| NRI support          | Not included             | NRI/NRO flag on resident profile                                                          |
| Billing              | Not tracked              | Subscription plan tracking (Basic/Standard/Premium/Enterprise/Trial)                      |
| Ownership types      | Owner / Tenant           | Owner / Owner-NRO / Joint Owner / Tenant                                                  |

**Build order**: Follow the MVP phase sequence (Super Admin first, then Registration, Fees, Expenses, Notifications, Migration, Reports, Security) but with the additions above woven in from day one.

---

## Task 2.1 — Super Admin Portal

### 2.1.1 Backend APIs

| Method  | Endpoint                              | Purpose                                                                       |
| ------- | ------------------------------------- | ----------------------------------------------------------------------------- |
| `GET`   | `/api/v1/super-admin/stats`           | Dashboard aggregates: total societies, active, suspended, trial, by plan tier |
| `POST`  | `/api/v1/societies`                   | Create society (generates Society ID, creates admin, generates QR poster)     |
| `GET`   | `/api/v1/societies/check-code?code=X` | Real-time Society Code uniqueness check                                       |
| `GET`   | `/api/v1/societies`                   | Paginated society list with search/filter                                     |
| `GET`   | `/api/v1/societies/[id]`              | Society detail with stats (residents, fees, balance)                          |
| `PATCH` | `/api/v1/societies/[id]`              | Update society (fees, details)                                                |
| `GET`   | `/api/v1/societies/[id]/qr-poster`    | Generate QR poster PDF                                                        |
| `POST`  | `/api/v1/societies/[id]/admins`       | Activate admin (any of 6 positions)                                           |
| `PATCH` | `/api/v1/societies/[id]/subscription` | Update subscription plan and billing                                          |

**Society ID format**: `RWA-[STATE]-[CITY3]-[PINCODE]-[SEQ]` (SEQ = zero-padded 4-digit count per pincode).

**Society Code**: Admin-chosen, 4-8 alphanumeric uppercase, unique across platform.

**Subscription tracking**: Every society gets a `subscription_plan` (BASIC/STANDARD/PREMIUM/ENTERPRISE/TRIAL), `subscription_status`, `trial_start_date`, and `trial_end_date`. Trial = 60 days. Tracked from creation.

### 2.1.2 UI Screens

**Super Admin Dashboard** (`/super-admin/dashboard`):

```
+-----------------------------------------------------+
|  [Sidebar]  |  RWA Connect -- Super Admin             |
|             |------------------------------------------
|  Dashboard  |                                          |
|  Societies  |  +----------+ +----------+ +-----------+ |
|  Billing    |  | Total: 8 | | Active: 5| | Trial: 3  | |
|  Settings   |  +----------+ +----------+ +-----------+ |
|             |  +----------+ +----------+               |
|             |  | Susp.: 0 | | Revenue  |               |
|             |  |          | | Rs12,994 |               |
|             |  +----------+ +----------+               |
|             |                                          |
|             |  Plan Distribution                       |
|             |  Basic: 2 | Standard: 2 | Premium: 1    |
|             |  Enterprise: 0 | Trial: 3               |
|             |                                          |
|             |  Recent Activity                         |
|             |  --------------------------              |
|             |  * Eden Estate onboarded -- 2 days ago   |
|             |  * Admin activated for Green Valley      |
|             |  * Trial expiring: DLF Phase 4 (5 days)  |
|             |                                          |
|             |  [+ Onboard New Society]                 |
+-------------+------------------------------------------+
```

**Society Onboarding Wizard** (`/super-admin/societies/new`) -- 4-step form:

```
+-----------------------------------------------------+
|  Onboard New Society                     Step 1 of 4 |
|  --------------------------------------------------- |
|                                                       |
|  Society Name *                                       |
|  +-----------------------------------------------+   |
|  | Eden Estate Resident Welfare Association       |   |
|  +-----------------------------------------------+   |
|                                                       |
|  State *              City *            Pincode *     |
|  +-----------+   +------------+  +----------+         |
|  | HR v      |   | Gurgaon    |  | 122001   |         |
|  +-----------+   +------------+  +----------+         |
|                                                       |
|  Society Type *                                       |
|  +-----------------------------------------------+   |
|  | Independent Sector Colony  v                   |   |
|  +-----------------------------------------------+   |
|  i This determines the address fields for residents   |
|                                                       |
|  Society Code *                 [check] Available     |
|  +--------------------------+                         |
|  | EDENESTATE               |  (checked in real-time) |
|  +--------------------------+                         |
|  4-8 characters, letters & numbers only               |
|                                                       |
|                                        [Next ->]      |
+-------------------------------------------------------+

Step 2: Fee Configuration
  -- Joining Fee (Rs) + Annual Fee (Rs)
  -- Session period display (Apr 1 -- Mar 31)
  -- Pro-rata preview based on current date

Step 3: Subscription Plan
  -- Plan selector: Basic / Standard / Premium / Enterprise / Trial
  -- Limits display (resident cap, WhatsApp quota)
  -- Trial = 60 days, no credit card required

Step 4: Primary Admin + Summary
  -- Admin Name, Mobile, Position (President by default)
  -- Full summary card with all details
  -- [Create Society] button
```

**Society List** (`/super-admin/societies`):

```
+-----------------------------------------------------------+
|  Societies                             [+ Onboard New]     |
|  --------------------------------------------------------- |
|  Search: [________________]   Status: [All v]              |
|  Plan: [All v]                                             |
|                                                             |
|  +-------------------------------------------------------+ |
|  | Name              | Code      | Type    | Plan  |Status| |
|  |-------------------+-----------+---------+-------+------| |
|  | Eden Estate RWA   | EDENESTATE| Colony  | Std   |Active| |
|  | DLF Phase 4       | DLFP4     | Apt     | Trial |Trial | |
|  | Green Valley      | GRNVLY    | Villa   | Basic |Active| |
|  +-------------------------------------------------------+ |
|  Showing 1-3 of 3                                           |
+-------------------------------------------------------------+
```

**Society Detail** (`/super-admin/societies/[id]`):

```
+-----------------------------------------------------------+
|  <- Back to Societies                                      |
|                                                             |
|  Eden Estate RWA                          [Active]         |
|  RWA-HR-GGN-122001-0001     Plan: Standard (Rs1,999/mo)   |
|  --------------------------------------------------------- |
|                                                             |
|  +-------------+ +-------------+ +-------------+          |
|  | Residents:42| | Fees: 78%   | | Balance:    |          |
|  | (3 pending) | | collected   | | Rs38,400    |          |
|  +-------------+ +-------------+ +-------------+          |
|                                                             |
|  Society Details          Admin Team (6 positions)         |
|  ----------------         ----------------------------     |
|  Code: EDENESTATE         President: Hemant Kumar          |
|  Type: Colony             Secretary: Rajesh Sharma         |
|  Pincode: 122001          Treasurer: (vacant)              |
|  Joining: Rs1,000         Vice Pres: (vacant)              |
|  Annual: Rs1,200          Jt. Secy: (vacant)               |
|                           Exec Member: (vacant)            |
|                                                             |
|  [Download QR] [Activate Admin] [Edit Society] [Billing]   |
+-------------------------------------------------------------+
```

**Admin Activation** -- supports all 6 positions:

```
+------------------------------------------+
|  Activate Admin                          |
|  --------------------------------------- |
|                                           |
|  Position *                               |
|  +-----------------------------------+   |
|  | President                       v  |   |
|  +-----------------------------------+   |
|  Options: President, Vice President,      |
|  Secretary, Joint Secretary,              |
|  Treasurer, Executive Member              |
|                                           |
|  Permission Level (auto-set):             |
|  President/Secretary/Treasurer = Full     |
|  Others = Configurable                    |
|                                           |
|  Search Existing Resident                 |
|  +-------------------------------+       |
|  | Search by name or mobile...   |       |
|  +-------------------------------+       |
|  No match? Create new:                    |
|                                           |
|  Full Name *                              |
|  +-------------------------------+       |
|  |                               |       |
|  +-------------------------------+       |
|  Mobile (WhatsApp) *                      |
|  +-------------------------------+       |
|  |                               |       |
|  +-------------------------------+       |
|                                           |
|               [Cancel]  [Activate Admin]  |
+-------------------------------------------+
```

### 2.1.3 Components to Build

- `StatCard` -- Reusable stat card (icon, label, value, trend)
- `ActivityFeed` -- Chronological event list with relative timestamps
- `SocietyOnboardingWizard` -- 4-step form (details, fees, subscription, admin)
- `SocietyCodeInput` -- Input with debounced real-time uniqueness check
- `ProRataPreview` -- Live calculation display
- `SubscriptionPlanSelector` -- Plan cards with limits display
- `StepIndicator` -- Step 1/2/3/4 progress dots
- `QRPosterPDF` -- `@react-pdf/renderer` document (A4 portrait, print-ready)
- `DownloadQRButton` -- Triggers PDF generation and download
- `SocietyListTable` -- DataTable with search, filter by status/plan, pagination
- `SocietyDetailCard` -- Profile card with all society fields
- `AdminTeamCard` -- Shows all 6 positions with vacancy indicators
- `ActivateAdminSheet` -- Sheet with position selector + search/create form
- `BillingCard` -- Subscription plan, usage, billing history

### 2.1.4 Acceptance Criteria

- [ ] Super Admin dashboard shows stats with real data, including plan distribution
- [ ] Society onboarding: 4-step wizard creates society in < 5 minutes
- [ ] Society ID auto-generated correctly (`RWA-[STATE]-[CITY3]-[PIN]-[SEQ]`)
- [ ] Society Code: admin-chosen, 4-8 chars, real-time uniqueness check
- [ ] All 5 society types available: APARTMENT_COMPLEX, BUILDER_FLOORS, GATED_COMMUNITY_VILLAS, INDEPENDENT_SECTOR_COLONY, PLOTTED_COLONY
- [ ] Subscription plan assigned at creation (defaults to TRIAL)
- [ ] QR poster PDF downloads with scannable QR code
- [ ] Society list: search, filter by status and plan, pagination
- [ ] Society detail: all fields, stats, full 6-position admin team displayed
- [ ] Admin activation supports all 6 positions with correct permission defaults
- [ ] Admin receives WhatsApp OTP on activation
- [ ] All UI responsive: desktop + tablet + mobile

---

## Task 2.2 — Resident Registration

### 2.2.1 Backend APIs

| Method  | Endpoint                            | Purpose                                                              |
| ------- | ----------------------------------- | -------------------------------------------------------------------- |
| `GET`   | `/api/v1/societies/by-code/[code]`  | Validate code, return society name + type                            |
| `POST`  | `/api/v1/residents/register`        | Create pending registration                                          |
| `POST`  | `/api/v1/upload/id-proof`           | Upload to Supabase Storage (private bucket)                          |
| `GET`   | `/api/v1/residents?status=PENDING`  | List pending registrations                                           |
| `PATCH` | `/api/v1/residents/[id]/approve`    | Approve + trigger RWAID generation                                   |
| `PATCH` | `/api/v1/residents/[id]/reject`     | Reject with reason                                                   |
| `GET`   | `/api/v1/residents/[id]/rwaid-card` | Generate RWAID card PDF                                              |
| `GET`   | `/api/v1/rwaid/[signed-token]`      | Public RWAID verification                                            |
| `POST`  | `/api/cron/registration-expiry`     | Daily: expire 14-day-old pending registrations, 7-day admin reminder |

**5 society types with dynamic address fields**:

| Type                      | Fields                                       |
| ------------------------- | -------------------------------------------- |
| APARTMENT_COMPLEX         | Tower/Block + Floor No + Flat No             |
| BUILDER_FLOORS            | House No + Floor Level (GF/1F/2F/3F/Terrace) |
| GATED_COMMUNITY_VILLAS    | Villa No + Street/Phase                      |
| INDEPENDENT_SECTOR_COLONY | House No + Street/Gali + Sector/Block        |
| PLOTTED_COLONY            | Plot No + Lane No + Phase                    |

**Joint ownership detection**: On registration approval, if a unit already exists with a different owner, system flags the new registrant as `JOINT_OWNER` and alerts admin for review. The existing owner is kept as-is; the new registrant gets `ownership_type = JOINT_OWNER`.

**NRI/NRO flag**: Registration form includes an optional "I currently reside outside India" checkbox. When checked, ownership type becomes `OWNER_NRO` instead of `OWNER`. NRO residents have the same rights but may have different fee exemption eligibility.

**Registration timeout**: Pending registrations auto-expire after 14 days. At day 7, a WhatsApp reminder is sent to admin(s) about stale registrations. At day 14, status changes to `EXPIRED` and the applicant receives a notification to re-apply.

**RWAID format**: `RWA-[STATE]-[CITY3]-[PINCODE]-[SOCIETYSEQ]-[YEAR]-[RESIDENTSEQ]`
Short display: `#0089`

**Unit display labels**:

| Type          | Input                          | Display Label  |
| ------------- | ------------------------------ | -------------- |
| Apartment     | Tower B, Floor 12, Flat 1204   | `B-12-1204`    |
| Builder Floor | House 42, First Floor          | `42-1F`        |
| Gated Villa   | Villa 17, Phase 2              | `Villa-17-P2`  |
| Colony        | House 245, Street 7, Sector 22 | `S22-St7-H245` |
| Plotted       | Plot 89, Lane 4                | `Plot-89-L4`   |

### 2.2.2 UI Screens

**Registration Form** (`/register/[societyCode]`):

```
+-----------------------------------------------------+
|                                                       |
|          [RWA Connect Logo]                           |
|                                                       |
|     Register for Eden Estate RWA                      |
|                                                       |
|  Full Name *                                          |
|  +-----------------------------------------------+   |
|  |                                               |   |
|  +-----------------------------------------------+   |
|                                                       |
|  Mobile Number (WhatsApp) *                           |
|  +-----------------------------------------------+   |
|  | +91                                           |   |
|  +-----------------------------------------------+   |
|                                                       |
|  -- Your Address (Dynamic per society type) --------- |
|                                                       |
|  [COLONY TYPE SHOWN:]                                 |
|  House No. *              Street / Gali No.           |
|  +----------------+      +-------------------+        |
|  | 245            |      | Street 7          |        |
|  +----------------+      +-------------------+        |
|  Sector / Block                                       |
|  +-----------------------------------------------+   |
|  | Sector 22                                     |   |
|  +-----------------------------------------------+   |
|                                                       |
|  I am a: *                                            |
|  (*) Owner    ( ) Tenant                              |
|                                                       |
|  [ ] I currently reside outside India (NRI/NRO)       |
|      (shown only when Owner is selected)              |
|                                                       |
|  -- Optional ---------------------------------        |
|  Email / Photo ID / Secondary Mobile                  |
|                                                       |
|  [check] I consent to receive WhatsApp notifications  |
|                                                       |
|  [Submit Registration ->]                             |
+-------------------------------------------------------+
```

**Admin Approval Queue** (`/admin/residents` -- Pending tab):

```
+-----------------------------------------------------------+
|  Residents                                                  |
|  --------------------------------------------------------- |
|  [All (42)]  [Pending Approval (3)]  [Active (39)]          |
|                                                             |
|  -- Pending Approval (auto-expire in 14 days) ----------   |
|                                                             |
|  +-------------------------------------------------------+ |
|  |  Raj Kumar                        Registered 2h ago    | |
|  |  9876543210  House 245, St 7, S22  Owner               | |
|  |  [View ID Proof]                                       | |
|  |  Joint Owner Detected: Same unit as RWAID #0012        | |
|  |                                                        | |
|  |  [Approve]  [Approve as Joint Owner]  [Reject v]       | |
|  +-------------------------------------------------------+ |
|                                                             |
|  +-------------------------------------------------------+ |
|  |  Priya Sharma                    Registered 12d ago    | |
|  |  8765432109  House 112, St 3, S22  Tenant              | |
|  |  [!] Expires in 2 days                                 | |
|  |  [No ID Proof uploaded]                                | |
|  |                                                        | |
|  |  [Approve]                         [Reject v]          | |
|  +-------------------------------------------------------+ |
+-------------------------------------------------------------+
```

**RWAID Card PDF** (A6 landscape):

```
+----------------------------------------------+
|  Eden Estate Resident Welfare Association      |
|  RWA-HR-GGN-122001-0001                        |
| ---------------------------------------------- |
|                                                 |
|  +--------+   Raj Kumar                         |
|  | [Photo]|   House 245, St 7, Sector 22        |
|  |   or   |   Owner | NRO                        |
|  |silhouet|                                      |
|  +--------+   #0089                              |
|               RWA-HR-GGN-122001-0001-2025-0089   |
|                                                 |
|  Status: Active          +----------+           |
|  Since: March 2026       | [QR Code]|           |
|                          +----------+           |
|                          Scan to verify          |
| ---------------------------------------------- |
|  Powered by RWA Connect                         |
+--------------------------------------------------+
```

### 2.2.3 Edge Cases

| Edge Case                       | Detection                   | Behavior                                              |
| ------------------------------- | --------------------------- | ----------------------------------------------------- |
| Duplicate mobile (same society) | DB check                    | Error: "This mobile is already registered"            |
| Duplicate mobile (diff society) | No check                    | Allowed -- one person, multiple societies             |
| Blacklisted mobile              | `blacklisted_numbers` check | Generic error: "Unable to process"                    |
| Invalid/suspended society code  | Code lookup                 | "Society code not found" / "Society unavailable"      |
| File too large (>5MB)           | Client + server             | Inline error under upload                             |
| Invalid file type               | MIME check                  | Inline error: "Only PDF, JPG, PNG accepted"           |
| Joint owner detected            | Same unit, different mobile | Flag for admin review; offer "Approve as Joint Owner" |
| NRO owner                       | Checkbox selected           | Sets `ownership_type = OWNER_NRO`                     |
| Registration expired (14 days)  | Cron job                    | Status -> EXPIRED; notification to applicant          |

### 2.2.4 Components to Build

- `SocietyCodeVerifier` -- Code input with verify + society confirmation
- `DynamicUnitFields` -- Renders address fields based on society type
- `NRICheckbox` -- Conditional checkbox (visible only for Owner)
- `FileUploadInput` -- Drag-and-drop, 5MB limit, type validation
- `RegistrationForm` -- React Hook Form + Zod, all 5 society types
- `RegistrationConfirmation` -- Success state with WhatsApp info
- `PendingRegistrationCard` -- Card with resident info, joint-owner alert, expiry warning, actions
- `RejectDialog` -- Reason dropdown (5 standard reasons)
- `JointOwnerAlert` -- Inline alert when joint ownership detected
- `ExpiryBadge` -- Shows days remaining before auto-expire
- `RWAIDCardPDF` -- `@react-pdf/renderer` (A6 landscape, QR code)
- `RWAIDCardPreview` -- In-browser HTML card preview
- `ResidentDirectoryTable` -- DataTable with search, filter, sort, pagination

### 2.2.5 Acceptance Criteria

- [ ] Registration form works for all 5 society types with correct dynamic fields
- [ ] NRI/NRO checkbox appears for Owner type, sets correct ownership
- [ ] Joint ownership detected when same unit registered by different mobile
- [ ] Admin sees joint-owner alert with "Approve as Joint Owner" option
- [ ] 14-day auto-expire: 7-day reminder to admins, 14-day expiry notification to applicant
- [ ] All 9 edge cases handled with user-friendly messages
- [ ] RWAID generated correctly on approval (format verified for all types)
- [ ] RWAID card PDF generates with QR code; QR scans to public verify page
- [ ] Rejection requires reason; WhatsApp sent for both outcomes
- [ ] Admin resident directory: search, filter, sort, paginate
- [ ] All screens responsive (360px mobile to 1280px desktop)

---

## Task 2.3 — Fee Management

### 2.3.1 Backend APIs

| Method  | Endpoint                                                           | Purpose                                                        |
| ------- | ------------------------------------------------------------------ | -------------------------------------------------------------- |
| `GET`   | `/api/v1/societies/[id]/fees/dashboard`                            | Aggregates: due, collected, outstanding, by status             |
| `GET`   | `/api/v1/societies/[id]/fees/calculate-prorate?approvalMonth=N`    | Pro-rata calculation                                           |
| `POST`  | `/api/v1/societies/[id]/fees/[feeId]/payments`                     | Record payment                                                 |
| `GET`   | `/api/v1/societies/[id]/fees/[feeId]/payments/[paymentId]/receipt` | Receipt PDF                                                    |
| `POST`  | `/api/v1/societies/[id]/fees/[feeId]/exempt`                       | Grant exemption (reason mandatory)                             |
| `PATCH` | `/api/v1/societies/[id]/fees/[feeId]/payments/[paymentId]`         | Correction (within 48h)                                        |
| `POST`  | `/api/v1/societies/[id]/fees/[feeId]/payments/[paymentId]/reverse` | Reversal (after 48h)                                           |
| `GET`   | `/api/v1/societies/[id]/fees/sessions`                             | List all fee sessions                                          |
| `POST`  | `/api/v1/societies/[id]/fees/sessions/open`                        | Open new session (April 1)                                     |
| `GET`   | `/api/v1/residents/[id]/payments`                                  | Resident's own payment history                                 |
| `POST`  | `/api/cron/fee-status-transitions`                                 | Daily: NOT_YET_DUE->PENDING (Apr 1), PENDING->OVERDUE (Apr 16) |

**Pro-rata formula**:

```
First Payment = Joining Fee + (Annual Fee / 12 * Remaining Months)
Remaining Months = months left until March 31 from approval date
```

**Fee statuses (full spec -- 8 states)**:
`NOT_YET_DUE`, `PENDING`, `OVERDUE`, `PARTIAL`, `PAID`, `EXEMPTED`, `ADVANCE_PAID`, `LIFETIME`

**Payment modes (full spec -- 5 modes)**:
`CASH`, `UPI`, `BANK_TRANSFER`, `CHEQUE`, `ONLINE` (ONLINE reserved for Phase 6 gateway)

**Receipt number format**: `[SOCIETYCODE]-[YEAR]-R[SEQ]` (e.g., `EDENESTATE-2025-R0042`)

**Fee status transitions**:

```
NOT_YET_DUE -> PENDING (April 1)
PENDING -> PAID / PARTIAL / OVERDUE / EXEMPTED / LIFETIME
PARTIAL -> PAID / OVERDUE
OVERDUE -> PAID / PARTIAL
Any -> EXEMPTED (admin grants)
Any -> LIFETIME (Super Admin only, irreversible)
Any -> ADVANCE_PAID (payment tagged to future session)
```

### 2.3.2 UI Screens

**Fee Dashboard** (`/admin/fees`):

```
+--------------------------------------------------------------+
|  [Sidebar]  |  Fee Management -- Session 2025-26  [2024-25 v] |
|             |----------------------------------------------- --|
|  Dashboard  |                                                  |
|  Residents  |  +-----------+ +-----------+ +-------------+    |
|  Fees    <- |  | Total Due | | Collected | | Outstanding |    |
|  Expenses   |  | Rs50,400  | | Rs38,400  | | Rs12,000    |    |
|  Reports    |  | 42 members| | 76%       | | 10 pending  |    |
|  Broadcast  |  +-----------+ +-----------+ +-------------+    |
|             |                                                  |
|             |  +--------+ +--------+ +--------+               |
|             |  | Paid   | | Pend.  | | Overdue|               |
|             |  |   32   | |    5   | |    3   |               |
|             |  +--------+ +--------+ +--------+               |
|             |  +--------+ +--------+ +--------+ +--------+   |
|             |  | Partial| | Exempt | |Advance | |Lifetime|   |
|             |  |    1   | |    1   | |    0   | |    0   |   |
|             |  +--------+ +--------+ +--------+ +--------+   |
|             |                                                  |
|             |  [Record Payment] [Send Reminder] [Export]       |
|             |                                                  |
|             |  Fee Tracker (table with search/filter)          |
|             |  +--------------------------------------------+ |
|             |  | Resident     | Unit    | Due    | Status    | |
|             |  |--------------+---------+--------+-----------| |
|             |  | Hemant Kumar | S22-H245| Rs1200 | Paid      | |
|             |  | Priya Singh  | S22-H301| Rs1000 | Partial   | |
|             |  | Amit Verma   | S22-H88 | Rs1200 | Overdue   | |
|             |  +--------------------------------------------+ |
+-------------+--------------------------------------------------+
```

**Record Payment Dialog**:

```
+--------------------------------------------------+
|  Record Payment                             [X]   |
|  ------------------------------------------------ |
|                                                    |
|  Resident: Hemant Kumar                            |
|  Unit: S22-St7-H245   Session: 2025-26            |
|                                                    |
|  Fee Due                                           |
|  +----------------------------------------------+ |
|  | Annual Fee           Rs1,200                  | |
|  | Previously Paid      Rs0                      | |
|  | Balance Due          Rs1,200                  | |
|  +----------------------------------------------+ |
|                                                    |
|  Amount (Rs) *                                     |
|  +----------------------------------------------+ |
|  | 1,200                                        | |
|  +----------------------------------------------+ |
|                                                    |
|  Payment Mode *                                    |
|  (*) Cash  ( ) UPI  ( ) Bank  ( ) Cheque  ( ) Othr|
|                                                    |
|  Reference Number (required for UPI/Bank/Cheque)   |
|  +----------------------------------------------+ |
|  |                                              | |
|  +----------------------------------------------+ |
|                                                    |
|  Payment Date * (backdate up to 30 days)           |
|  +----------------------------------------------+ |
|  | 04/03/2026                                   | |
|  +----------------------------------------------+ |
|                                                    |
|  +----------------------------------------------+ |
|  | Payment Summary                              | |
|  | Amount: Rs1,200  Mode: Cash                  | |
|  | Status after payment: PAID                   | |
|  +----------------------------------------------+ |
|                                                    |
|                    [Cancel]  [Record Payment]      |
+----------------------------------------------------+
```

**Receipt PDF** (A4 portrait, print-ready):

- Society header (name, address, ID)
- Receipt number, date
- Received from: name, RWAID, unit, type
- Payment details table (description, amount)
- Payment mode, reference
- Status (PAID IN FULL / PARTIAL)
- Recorded by, timestamp
- Verification URL
- Watermark with Society ID

### 2.3.3 Components to Build

- `FeesDashboard` -- Full page with stats + 8-status breakdown + tracker table
- `FeeStatsRow` -- Row of StatCards (Total Due, Collected, Outstanding)
- `FeeStatusBreakdown` -- Clickable status count cards (filter table on click)
- `FeeTrackerTable` -- DataTable with resident fee status per session
- `SessionSelector` -- Dropdown to switch between financial sessions
- `RecordPaymentDialog` -- Sheet with payment form
- `PaymentModeSelector` -- Radio group (Cash, UPI, Bank, Cheque, Other)
- `PaymentSummaryCard` -- Live preview of what happens on submit
- `AmountInput` -- Currency input with Rs prefix and formatting
- `ReceiptPDF` -- `@react-pdf/renderer` document component
- `ExemptionDialog` -- Reason textarea (min 10 chars)
- `PaymentCorrectionDialog` -- Side-by-side original vs corrected (48h window)
- `PaymentReversalDialog` -- Confirmation with reason (post-48h)
- `CorrectionWindowBadge` -- Shows remaining time
- `ProRataPreview` -- Breakdown display (reused from onboarding)
- `FeeCalculator` -- Pure function in `src/lib/fee-calculator.ts`
- `CurrentFeeCard` -- Resident-facing current session status
- `PaymentHistoryList` -- Resident-facing chronological payment list
- `SessionManager` -- Admin section for current + next session config

### 2.3.4 Acceptance Criteria

- [ ] Fee dashboard shows real aggregated stats per session with 8 status types
- [ ] Pro-rata calculation correct for all 12 months (April = full, March = 1 month)
- [ ] Payment recording: Cash (no ref), UPI/Bank/Cheque (ref required)
- [ ] Receipt number auto-generated; receipt PDF downloads with all fields
- [ ] Fee status transitions enforced server-side (no invalid state changes)
- [ ] Daily cron: NOT_YET_DUE -> PENDING (Apr 1), PENDING -> OVERDUE (Apr 16)
- [ ] ADVANCE_PAID and LIFETIME statuses supported
- [ ] Exemption with mandatory reason, audit-logged
- [ ] Correction within 48h edits in place; reversal after 48h creates reversal entry
- [ ] Resident portal: current status + full payment history + receipt downloads
- [ ] Session management: view current, configure next session fee

---

## Task 2.4 — Expense Ledger

### 2.4.1 Backend APIs

| Method  | Endpoint                                       | Purpose                                               |
| ------- | ---------------------------------------------- | ----------------------------------------------------- |
| `GET`   | `/api/v1/societies/[id]/expenses`              | Paginated expense list (filterable by category, date) |
| `GET`   | `/api/v1/societies/[id]/expenses/summary`      | Total expenses, category breakdown, running balance   |
| `POST`  | `/api/v1/societies/[id]/expenses`              | Add expense                                           |
| `PATCH` | `/api/v1/societies/[id]/expenses/[id]`         | Correct expense (within 24h)                          |
| `POST`  | `/api/v1/societies/[id]/expenses/[id]/reverse` | Reverse expense (after 24h)                           |
| `GET`   | `/api/v1/societies/[id]/expenses/public`       | Resident read-only view                               |

**9 MVP expense categories**: MAINTENANCE, SECURITY, CLEANING, STAFF_SALARY, INFRASTRUCTURE, UTILITIES, EMERGENCY, ADMINISTRATIVE, OTHER

(Full spec adds FESTIVAL and LEGAL in Phase 3.)

**Running Balance** = Total Fees Collected (current session) - Total Expenses

**Correction/Reversal rules**:

- Within 24h: edit amount, category, description in place. Audit log captures before/after.
- After 24h: reversal only. Creates negative-amount entry linked to original. Original marked as reversed (struck-through in UI).
- No permanent deletion -- ever.

### 2.4.2 UI Screens

**Expense Ledger** (`/admin/expenses`):

```
+--------------------------------------------------------------+
|  [Sidebar]  |  Expense Ledger -- Session 2025-26              |
|             |----------------------------------------------- --|
|  Dashboard  |                                                  |
|  Residents  |  +---------------+ +----------+ +----------+    |
|  Fees       |  | Balance in Hnd| | Total    | | Total    |    |
|  Expenses<- |  | Rs24,000      | | Collected| | Expenses |    |
|  Reports    |  | (Healthy)     | | Rs38,400 | | Rs14,400 |    |
|  Broadcast  |  +---------------+ +----------+ +----------+    |
|             |                                                  |
|             |  Category Breakdown                              |
|             |  +--------------------------------------------+ |
|             |  | ============ Security      Rs4,800  33%    | |
|             |  | ========     Staff Salary  Rs3,600  25%    | |
|             |  | ======       Maintenance   Rs2,400  17%    | |
|             |  | ====         Cleaning      Rs1,800  13%    | |
|             |  | ===          Utilities     Rs1,200   8%    | |
|             |  | ==           Other           Rs600   4%    | |
|             |  +--------------------------------------------+ |
|             |                                                  |
|             |  [+ Add Expense]                                 |
|             |                                                  |
|             |  Expenses (table with filters)                   |
|             |  Category: [All v]  From: [___] To: [___]        |
|             |  +--------------------------------------------+ |
|             |  | Date   | Category   | Desc       | Amount  | |
|             |  |--------+------------+------------+---------| |
|             |  | 03 Mar | Security   | Guard Feb  | Rs4,800 | |
|             |  | 01 Mar | Cleaning   | Monthly    | Rs1,800 | |
|             |  | ~15Feb~| ~Maint.~   | ~Wrong~    | ~-Rs500~| |
|             |  |        |            | (Reversed) |         | |
|             |  +--------------------------------------------+ |
+-------------+--------------------------------------------------+
```

**Add Expense Dialog**: Date, amount, category dropdown (9 options), description (min 5 chars), receipt upload (optional, max 5MB), balance impact preview.

**Resident Expense View** (`/resident/expenses`): Read-only mobile-optimized card layout showing balance, category summary bars, and recent expenses list.

### 2.4.3 Components to Build

- `ExpenseDashboard` -- Full page with balance + category chart + table
- `RunningBalanceCard` -- Prominent card (green positive, red negative)
- `CategoryBreakdownChart` -- Horizontal CSS bars per category
- `ExpenseTable` -- DataTable with date, category, description, amount, actions
- `ReversedExpenseRow` -- Struck-through styling
- `AddExpenseDialog` -- Sheet with form + balance impact preview
- `CategorySelector` -- Dropdown (9 categories)
- `ReceiptUpload` -- File dropzone (max 5MB, JPG/PNG/PDF)
- `BalanceImpactPreview` -- Live calculation (current - expense = new)
- `EditExpenseDialog` -- Pre-filled form (active within 24h only)
- `ReverseExpenseDialog` -- Confirmation with reason
- `ExpenseDetailSheet` -- Side sheet with full details + actions
- `ResidentExpenseView` -- Read-only page with card layout
- `BalanceSummaryCard` -- Collected vs spent vs balance
- `CategorySummaryBars` -- Simple horizontal bars
- `ExpenseListCard` -- Mobile-friendly card list

### 2.4.4 Acceptance Criteria

- [ ] Admin can add expenses with all 9 categories
- [ ] Receipt upload works (max 5MB, JPG/PNG/PDF)
- [ ] Running balance: Fees Collected - Expenses = Balance (displayed prominently)
- [ ] Category breakdown shown with visual bars
- [ ] Correction within 24h: edit in place with audit log
- [ ] Reversal after 24h: reversal entry created, original struck-through
- [ ] No expense permanently deletable
- [ ] Resident expense view: read-only, mobile-optimized
- [ ] Expense table: sortable, filterable by category and date range

---

## Task 2.5 — WhatsApp Notifications & Broadcast

### 2.5.1 Backend Setup

- **BSP**: WATI (recommended) or Interakt
- **Account Model**: Platform-level single WhatsApp Business Account ("RWA Connect" sender)
- **Notification queue**: BullMQ with Upstash Redis (serverless-compatible)
- **Retry logic**: 3 attempts, 5-minute intervals
- **Fallback chain**: WhatsApp -> (wait 60s) -> SMS
- **Delivery tracking**: Webhook from WATI for status callbacks

### 2.5.2 7 Message Templates

| #   | Template                 | Trigger                  | Recipient                    | Mandatory |
| --- | ------------------------ | ------------------------ | ---------------------------- | --------- |
| 1   | `registration_submitted` | Registration form submit | Resident                     | Yes       |
| 2   | `registration_approved`  | Admin approves           | Resident (RWAID + card link) | Yes       |
| 3   | `registration_rejected`  | Admin rejects            | Resident (with reason)       | Yes       |
| 4   | `payment_recorded`       | Payment saved            | Resident (receipt link)      | Yes       |
| 5   | `admin_new_registration` | Registration submitted   | Admin(s) (review link)       | Yes       |
| 6   | `fee_reminder_annual`    | Cron: March 1            | All active residents         | Optional  |
| 7   | `fee_overdue`            | Cron: post-April 15      | Overdue residents            | Optional  |

Plus 2 new full-spec triggers (integrated into existing cron infrastructure):

| #   | Template                      | Trigger               | Recipient | Mandatory |
| --- | ----------------------------- | --------------------- | --------- | --------- |
| 8   | `registration_expiring_admin` | Cron: 7 days pending  | Admin(s)  | Yes       |
| 9   | `registration_expired`        | Cron: 14 days pending | Applicant | Yes       |

### 2.5.3 UI Screens

**Broadcast Composer** (`/admin/broadcast`):

```
+--------------------------------------------------------------+
|  [Sidebar]  |  Broadcast                                      |
|             |----------------------------------------------- --|
|  Dashboard  |  [Broadcast]  [Delivery Log]                     |
|  Residents  |                                                  |
|  Fees       |  Compose Broadcast                               |
|  Expenses   |  -------------------                             |
|  Reports    |                                                  |
|  Broadcast<-|  Recipients *                                    |
|             |  +------------------------------------------+    |
|             |  | All Active Residents                  v  |    |
|             |  +------------------------------------------+    |
|             |  Options: All Active / Fee Pending /              |
|             |  Fee Overdue / NRO Owners / Custom Selection      |
|             |  Selected: 42 residents                           |
|             |                                                  |
|             |  Message *                                        |
|             |  +------------------------------------------+    |
|             |  | Dear {Name},                             |    |
|             |  |                                          |    |
|             |  | Water supply will be disrupted on        |    |
|             |  | March 5 from 10 AM to 2 PM.              |    |
|             |  +------------------------------------------+    |
|             |                                                  |
|             |  Variables: [{Name}] [{HouseNo}] [{Amount}]      |
|             |  [{DueDate}]  -- click to insert                 |
|             |                                                  |
|             |  Preview (Hemant Kumar, S22-H245):                |
|             |  +------------------------------------------+    |
|             |  | Dear Hemant Kumar,                       |    |
|             |  | Water supply will be disrupted on ...    |    |
|             |  +------------------------------------------+    |
|             |                                                  |
|             |            [Cancel]  [Send to 42 Recipients]     |
+-------------+--------------------------------------------------+
```

**Delivery Log** (`/admin/broadcast` -- Delivery Log tab): Table with time, recipient, template, status (Delivered/Sent/Failed/SMS Fallback). Summary cards (Sent, Delivered, Failed).

**Broadcast History**: Past broadcasts with delivery stats per broadcast.

**Resident Notification Preferences** (within `/resident/profile`): Mandatory triggers always-on. Optional triggers (fee reminder, overdue, broadcasts) toggleable.

### 2.5.4 Components to Build

- `NotificationService` -- Orchestrates template selection, variable substitution, queue dispatch
- `WhatsAppClient` -- WATI API wrapper (send template, check delivery)
- `SMSClient` -- MSG91/Twilio wrapper
- `NotificationQueue` -- BullMQ job processor with retry logic
- `BroadcastComposer` -- Full composition form
- `RecipientFilter` -- Dropdown with filter options + count
- `VariableChips` -- Clickable variable insertion chips
- `MessagePreview` -- Live preview with sample resident data
- `BroadcastConfirmDialog` -- Confirmation before send
- `BroadcastSuccessCard` -- Post-send status
- `DeliveryLogTable` -- Notification delivery history
- `DeliveryStatusBadge` -- Delivered / Sent / Failed / SMS Fallback
- `BroadcastHistoryList` -- Past broadcasts with delivery stats
- `NotificationPreferences` -- Toggle switches for optional triggers

### 2.5.5 Acceptance Criteria

- [ ] WhatsApp Business API connected (WATI or Interakt)
- [ ] All 9 message templates (7 original + 2 registration expiry) functional
- [ ] All 5 mandatory triggers fire correctly on their events
- [ ] SMS fallback triggers after 60s WhatsApp failure
- [ ] 3 retries with 5-minute intervals before fallback
- [ ] Failed notifications logged with reason
- [ ] Delivery log shows all notifications with real-time status via webhook
- [ ] Broadcast composer: recipient filter, variables, preview, confirmation
- [ ] Broadcast history with per-broadcast delivery stats
- [ ] Resident preferences: opt-out for optional triggers; mandatory cannot be disabled

---

## Task 2.6 — Data Migration

### 2.6.1 Backend APIs

| Method | Endpoint                                    | Purpose                                            |
| ------ | ------------------------------------------- | -------------------------------------------------- |
| `GET`  | `/api/v1/societies/[id]/migration/template` | Download .xlsx template (dynamic per society type) |
| `POST` | `/api/v1/societies/[id]/migration/validate` | Upload + validate Excel                            |
| `POST` | `/api/v1/societies/[id]/migration/import`   | Import validated rows                              |

**Excel template columns** (vary by society type):

- Common: Full Name*, Mobile*, Ownership\* (Owner/Tenant), Fee Status (Paid/Pending), Last Payment Date, Email
- APARTMENT_COMPLEX: Tower/Block*, Floor No*, Flat No\*
- BUILDER_FLOORS: House No*, Floor Level*
- GATED_COMMUNITY_VILLAS: Villa No\*, Street/Phase
- INDEPENDENT_SECTOR_COLONY: House No*, Street/Gali*, Sector/Block\*
- PLOTTED_COLONY: Plot No\*, Lane No, Phase

**Validation rules**: Name required, mobile 10 digits starting 6-9, no duplicate mobiles in file or DB, ownership must be Owner/Tenant, fee status must be Paid/Pending, date format DD/MM/YYYY.

**Import behavior**: Creates resident accounts with status `MIGRATED_PENDING`. Auto-generates RWAIDs. Queues WhatsApp activation messages. Residents who do not activate within 60 days become `MIGRATED_DORMANT`.

### 2.6.2 UI Screens

**Migration Wizard** (`/admin/migration`):

```
+--------------------------------------------------------------+
|  [Sidebar]  |  Bulk Resident Import                           |
|             |----------------------------------------------- --|
|  Dashboard  |                                                  |
|  Residents  |  Step 1: Download Template                       |
|  Fees       |  ----------------------------                    |
|  Expenses   |  Download the Excel template pre-configured      |
|  Reports    |  for your society type (Colony).                 |
|  Broadcast  |                                                  |
|  Migration<-|  [Download Template]                             |
|             |                                                  |
|             |  Step 2: Upload Filled File                      |
|             |  ----------------------------                    |
|             |                                                  |
|             |  +------------------------------------------+    |
|             |  |                                          |    |
|             |  |   Drop Excel file or click to upload     |    |
|             |  |   (.xlsx only, max 5MB)                  |    |
|             |  |                                          |    |
|             |  +------------------------------------------+    |
|             |                                                  |
|             |                             [Validate File]      |
|             |                                                  |
|             |  --- After validation ---                        |
|             |                                                  |
|             |  +----------+ +----------+ +----------+          |
|             |  | Total:105| | Valid:98 | | Errors: 7|          |
|             |  +----------+ +----------+ +----------+          |
|             |                                                  |
|             |  Error Table (row, field, error)                 |
|             |  +------------------------------------------+    |
|             |  | Row 12 | Mobile | Invalid: not 10 digits |    |
|             |  | Row 23 | Mobile | Duplicate: same as R5  |    |
|             |  | Row 31 | Name   | Required field empty   |    |
|             |  +------------------------------------------+    |
|             |                                                  |
|             |  [Re-upload] [Import 98 Valid Rows]               |
+-------------+--------------------------------------------------+
```

**Import Progress**: Real-time progress bar with counts (accounts created, RWAIDs generated, WhatsApp queued).

**Import Complete**: Summary card with totals + dormant status note.

### 2.6.3 Components to Build

- `MigrationWizard` -- Multi-step: download -> upload -> validate -> import
- `TemplateDownloadButton` -- Society-type-specific Excel template
- `FileUploadDropzone` -- Excel upload (max 5MB, .xlsx only)
- `ValidationReportCard` -- Total/valid/error counts
- `ValidationErrorTable` -- Row-by-row error listing
- `ImportPreviewTable` -- First 5 rows preview
- `ImportProgressBar` -- Real-time progress
- `ImportCompleteCard` -- Summary of imported data

### 2.6.4 Acceptance Criteria

- [ ] Template downloads with correct columns per society type
- [ ] Validation catches all error types with clear row-level messages
- [ ] Admin can import all valid rows (option to skip error rows)
- [ ] Import creates accounts + auto-generates RWAIDs
- [ ] Imported residents get `MIGRATED_PENDING` status
- [ ] WhatsApp activation messages queued
- [ ] Progress shown during import
- [ ] 60-day dormant auto-transition for non-activations

---

## Task 2.7 — Reports

### 2.7.1 Backend APIs

| Method | Endpoint                                                      | Format      |
| ------ | ------------------------------------------------------------- | ----------- |
| `GET`  | `/api/v1/societies/[id]/reports/paid-list?session=X`          | PDF / Excel |
| `GET`  | `/api/v1/societies/[id]/reports/pending-list?session=X`       | PDF / Excel |
| `GET`  | `/api/v1/societies/[id]/reports/directory`                    | PDF / Excel |
| `GET`  | `/api/v1/societies/[id]/reports/expense-summary?session=X`    | PDF / Excel |
| `GET`  | `/api/v1/societies/[id]/reports/collection-summary?session=X` | PDF / Excel |

**5 reports**:

1. **Paid Members List** -- All residents with PAID status. Columns: #, Name, Unit, Amount, Date, Receipt.
2. **Pending/Overdue List** -- Residents with PENDING, OVERDUE, or PARTIAL status. Columns: #, Name, Unit, Due, Paid, Status.
3. **Full Resident Directory** -- All active residents. Columns: #, RWAID, Name, Unit, Type, Fee Status.
4. **Expense Summary** -- Category breakdown with count, total, percentage. Financial summary (collected vs expenses vs balance).
5. **Fee Collection Summary** -- Overview (members, fee, due, collected, outstanding). Status breakdown with counts and amounts.

All PDFs: `@react-pdf/renderer`, A4 portrait, watermarked with Society ID + date + admin name.
All Excel: `exceljs`, formatted headers, auto-column width, totals row.

### 2.7.2 UI Screen

**Reports Dashboard** (`/admin/reports`):

```
+--------------------------------------------------------------+
|  [Sidebar]  |  Reports -- Session 2025-26   [2024-25 v]       |
|             |----------------------------------------------- --|
|  Dashboard  |                                                  |
|  Residents  |  Available Reports                               |
|  Fees       |  -------------------                             |
|  Expenses   |                                                  |
|  Reports <- |  +----------------------------------------------+|
|  Broadcast  |  | Paid Members List                            ||
|  Migration  |  | 32 paid out of 42 total                     ||
|             |  |                         [PDF]  [Excel]       ||
|             |  |----------------------------------------------||
|             |  | Pending / Overdue List                       ||
|             |  | 10 residents (Rs12,000 outstanding)          ||
|             |  |                         [PDF]  [Excel]       ||
|             |  |----------------------------------------------||
|             |  | Full Resident Directory                      ||
|             |  | 42 active (30 owners, 12 tenants)            ||
|             |  |                         [PDF]  [Excel]       ||
|             |  |----------------------------------------------||
|             |  | Expense Summary                              ||
|             |  | 58 entries, Rs1,71,600 total                 ||
|             |  |                         [PDF]  [Excel]       ||
|             |  |----------------------------------------------||
|             |  | Fee Collection Summary                       ||
|             |  | 76% collected (Rs38,400 of Rs50,400)         ||
|             |  |                         [PDF]  [Excel]       ||
|             |  +----------------------------------------------+|
+-------------+--------------------------------------------------+
```

### 2.7.3 Components to Build

- `ReportsDashboard` -- Page listing all 5 reports
- `ReportCard` -- Card per report with description, live count, download buttons
- `ReportDownloadButton` -- PDF or Excel with loading spinner
- `SessionSelector` -- Reuse from fees
- `ReportHeader` -- Shared PDF component (society name, session, date, admin)
- `ReportWatermark` -- Shared PDF component (society ID + date)
- PDF components: `PaidListPDF`, `PendingListPDF`, `DirectoryPDF`, `ExpenseSummaryPDF`, `CollectionSummaryPDF`

### 2.7.4 Acceptance Criteria

- [ ] All 5 reports download as PDF and Excel
- [ ] PDFs watermarked with Society ID + date + admin name
- [ ] Excel formatted with headers, auto-width, totals row
- [ ] Session selector switches report data
- [ ] Live counts shown before download
- [ ] All reports scoped to logged-in admin's society only
- [ ] PDF generation under 3 seconds

---

## Task 2.8 — Security & Launch Readiness

### 2.8.1 Row-Level Security (RLS)

Every society-scoped table gets an RLS policy at the PostgreSQL layer:

| Table               | Policy                               |
| ------------------- | ------------------------------------ |
| `societies`         | Super Admin sees all; Admin sees own |
| `users`             | Same society only                    |
| `units`             | Same society only                    |
| `user_units`        | Via units -> society                 |
| `membership_fees`   | Same society only                    |
| `fee_payments`      | Via fee records -> society           |
| `expenses`          | Same society only                    |
| `notifications`     | Own notifications only               |
| `audit_logs`        | Admin sees society logs only         |
| `migration_batches` | Admin sees own imports only          |

Super Admin bypasses RLS for aggregate reports only (never individual resident data). Implemented via Supabase service role key (server-side only).

### 2.8.2 API Security

**Rate limiting** (Upstash Redis):

| Endpoint                | Limit      | Window           |
| ----------------------- | ---------- | ---------------- |
| `POST /auth/otp/send`   | 3 req      | per phone/hour   |
| `POST /auth/otp/verify` | 5 attempts | per phone/15 min |
| `POST /auth/pin/verify` | 5 attempts | then require OTP |
| `POST /register/*`      | 5 req      | per IP/hour      |
| `GET /api/v1/*`         | 100 req    | per user/minute  |
| `POST /api/v1/*`        | 50 req     | per user/minute  |
| `POST /broadcasts`      | 5 req      | per admin/hour   |

**Input validation**: Zod schemas on all inputs. Prisma ORM parameterizes queries. React auto-escapes XSS. Next.js App Router CSRF protection. File upload: max 5MB, MIME type check.

**Auth hardening**: JWT 1h access / 7d refresh. 8h admin inactivity timeout. 30-day resident trusted device. Super Admin TOTP 2FA enforced. PIN lockout after 5 failures.

### 2.8.3 Audit Trail

Every create/update/delete on key entities logged to `audit_logs`:

| Action | Entity           | Logged                  |
| ------ | ---------------- | ----------------------- |
| CREATE | resident         | Registration details    |
| UPDATE | resident         | Status change + reason  |
| CREATE | fee_payment      | Amount, mode, receipt   |
| UPDATE | fee_payment      | Correction before/after |
| CREATE | fee_reversal     | Reason + linked payment |
| CREATE | expense          | Expense details         |
| UPDATE | expense          | Correction before/after |
| CREATE | expense_reversal | Reason                  |
| UPDATE | fee_status       | Exemption reason        |
| CREATE | broadcast        | Message, count, admin   |
| UPDATE | admin_role       | Activated/deactivated   |
| UPDATE | subscription     | Plan change, billing    |

### 2.8.4 Error Monitoring & Performance

- **Sentry** for error tracking (source maps uploaded)
- **UptimeRobot** for availability monitoring
- **Performance targets**: LCP < 2.5s, FID < 100ms, CLS < 0.1, API p95 < 500ms, PDF gen < 3s
- **Bundle optimization**: Dynamic imports for PDF generators, `@next/bundle-analyzer`
- **Database indexes**: On `society_id`, `user_id`, `status`, `created_at`
- **Pagination**: All list endpoints max 50 per page

### 2.8.5 Go-Live Checklist

**Legal**: Privacy Policy, Terms of Service, DPDP consent forms, India data residency (AWS Mumbai).

**WhatsApp**: Meta Business verified, all templates submitted (5 mandatory approved minimum), test broadcast confirmed, SMS fallback tested.

**Security**: HTTPS, DB encryption, storage encryption, Super Admin 2FA, OTP rate limiting, PIN lockout, RLS active, no PII in logs.

**Infrastructure**: Production Supabase, production env vars, Vercel deployment, custom domain, Sentry active, UptimeRobot configured, daily DB backups.

**Data**: Production DB migrated, Super Admin seeded, demo data cleaned.

**Functional**: End-to-end flow tested (Society -> Admin -> Resident -> Payment -> Receipt -> Expense -> Report). Pro-rata for all 12 months. Bulk import 100+ rows. All 5 reports. All 5 society types.

### 2.8.6 Acceptance Criteria

- [ ] RLS policies on all society-scoped tables; cross-society access returns empty/403
- [ ] Rate limiting on all sensitive endpoints; returns 429 with Retry-After
- [ ] All key operations audit-logged with before/after values
- [ ] Sentry capturing errors with readable stack traces
- [ ] Lighthouse > 90 on all portals
- [ ] All 15 critical path test scenarios pass
- [ ] Mobile responsive on 360px+ screens
- [ ] Cross-browser tested (Chrome, Safari, Firefox, mobile browsers)
- [ ] Accessibility: keyboard nav, focus indicators, WCAG AA contrast
- [ ] Full go-live checklist completed
- [ ] First real society onboarded successfully

---

## Full Spec Additions Summary

These items are woven into the tasks above but called out here for quick reference -- things this phase includes that the MVP plan did not:

### 1. Society Type: INDEPENDENT_SECTOR_COLONY

The MVP uses `INDEPENDENT_SECTOR`. The full spec renames this to `INDEPENDENT_SECTOR_COLONY` for clarity. Same address fields (House No + Street/Gali + Sector/Block). Update the enum, all UI labels, and Excel template column headers.

### 2. Admin Positions: All 6

| Position           | Default Permission | Notes                          |
| ------------------ | ------------------ | ------------------------------ |
| `PRESIDENT`        | FULL_ACCESS        | Equivalent to MVP "Primary"    |
| `VICE_PRESIDENT`   | FULL_ACCESS        | Can act in President's absence |
| `SECRETARY`        | FULL_ACCESS        | Day-to-day operations          |
| `JOINT_SECRETARY`  | CONFIGURABLE       | Defaults to READ_NOTIFY        |
| `TREASURER`        | FULL_ACCESS        | Financial operations           |
| `EXECUTIVE_MEMBER` | READ_NOTIFY        | Advisory, broadcast only       |

Configurable permissions per society will come in Phase 4 (Elections). For Phase 2, each position has a fixed default permission level.

### 3. Registration Timeout: 14-Day Auto-Expire

- Day 0: Registration submitted, status = `PENDING_APPROVAL`
- Day 7: If still pending, WhatsApp reminder sent to admin(s) -- "3 registrations pending for 7+ days"
- Day 14: Status changes to `EXPIRED`. Applicant receives WhatsApp: "Your registration has expired. Please re-apply."
- Expired registrations remain in DB for audit but are hidden from admin's pending queue.

### 4. Joint Ownership Detection

On registration approval, the system checks:

1. Does a unit with the same address already exist in this society?
2. If yes, is the existing owner a different person (different mobile)?
3. If yes, flag as potential joint owner.

Admin sees an alert: "This unit is already registered to [Name] (#RWAID). Approve as Joint Owner?"

If approved as joint owner:

- `ownership_type = JOINT_OWNER`
- `user_role = RESIDENT_JOINT_OWNER`
- Both owners linked to the same unit
- Both receive independent fee records

### 5. NRI/NRO Flag

Registration form shows "I currently reside outside India" checkbox when Owner is selected.

When checked:

- `ownership_type = OWNER_NRO`
- `user_role = RESIDENT_OWNER_NRO`
- RWAID card shows "NRO" label
- Admin can filter directory by NRO owners
- NRO owners may have different fee exemption eligibility (admin discretion)

### 6. Billing & Subscription Tracking

Every society has:

| Field                  | Type    | Purpose                                         |
| ---------------------- | ------- | ----------------------------------------------- |
| `subscription_plan`    | ENUM    | BASIC / STANDARD / PREMIUM / ENTERPRISE / TRIAL |
| `subscription_status`  | ENUM    | ACTIVE / TRIAL / LAPSED / CANCELLED             |
| `trial_start_date`     | DATE    | When trial began                                |
| `trial_end_date`       | DATE    | 60 days after start                             |
| `billing_cycle_day`    | INTEGER | Day of month for billing                        |
| `next_billing_date`    | DATE    | Next payment due                                |
| `whatsapp_quota_used`  | INTEGER | Current month usage                             |
| `whatsapp_quota_limit` | INTEGER | Per-plan limit                                  |

**Plan limits**:

| Plan       | Price/mo | Residents       | WhatsApp/mo    | Features                    |
| ---------- | -------- | --------------- | -------------- | --------------------------- |
| Basic      | Rs999    | <=100           | 0 (email only) | Core membership + fees      |
| Standard   | Rs1,999  | <=500           | 500            | + WhatsApp + broadcast      |
| Premium    | Rs3,999  | Unlimited       | 2,000          | + API access + custom RWAID |
| Enterprise | Custom   | Multi-society   | Unlimited      | + White-label + support     |
| Trial      | Free/60d | Standard limits | --             | No credit card required     |

Super Admin dashboard shows plan distribution and revenue. Society detail page shows billing card. Trial expiry warnings at 7 days and 1 day before expiration.

Payment gateway for subscription billing is NOT in this phase (manual tracking only). Automated billing comes in Phase 6.

---

## Phase 2 Definition of Done

- [ ] **Super Admin**: Dashboard with plan distribution, society CRUD, 4-step onboarding wizard
- [ ] **Societies**: All 5 types, admin-chosen codes, configurable fees, subscription tracking
- [ ] **Admin Team**: All 6 positions activatable with correct default permissions
- [ ] **QR Poster**: PDF downloads with scannable QR for each society
- [ ] **Registration**: Dynamic forms for all 5 types, NRI/NRO flag, joint ownership detection
- [ ] **Registration Timeout**: 14-day auto-expire with 7-day admin reminder
- [ ] **RWAID**: Generated on approval, digital card PDF with QR, public verify page
- [ ] **Fees**: Pro-rata calculation, payment recording (5 modes), receipt PDF, 8 statuses
- [ ] **Fee Lifecycle**: Exemption, correction (48h), reversal (post-48h), session management
- [ ] **Expenses**: 9 categories, running balance, correction (24h), reversal, resident read-only view
- [ ] **WhatsApp**: 9 templates (7 original + 2 expiry), bulk broadcast, SMS fallback, delivery tracking
- [ ] **Migration**: Excel template per type, validation, import with progress, dormant auto-transition
- [ ] **Reports**: 5 reports (PDF + Excel), watermarked, session-scoped
- [ ] **Security**: RLS, rate limiting, audit trail, encryption, DPDP compliance
- [ ] **Performance**: Lighthouse > 90, API p95 < 500ms, PDF < 3s
- [ ] **Testing**: All 15 critical paths pass, mobile responsive, cross-browser, accessibility
- [ ] **Billing**: Subscription plan tracked per society, trial expiry warnings
- [ ] **Launch**: Go-live checklist complete, first real society onboarded
