# Full Spec Phase 4 — Election & Admin Lifecycle

**Duration**: ~3 weeks
**Goal**: Admin term management, election transitions, property transfers, and full resident status lifecycle.
**Depends on**: Phase 2 (Core MVP shipped)
**Source**: Full Spec v3.0 Sections 8, 11, 19.2, 19.3, 19.16

---

## Task 4.1 — Admin Term Management

### Schema Upgrade (v3.0 enums replacing MVP's 2-level model)

```sql
CREATE TYPE admin_position AS ENUM (
  'PRESIDENT', 'VICE_PRESIDENT', 'SECRETARY', 'JOINT_SECRETARY', 'TREASURER', 'EXECUTIVE_MEMBER'
);
CREATE TYPE admin_permission AS ENUM (
  'FULL_ACCESS',        -- President: everything
  'FINANCIAL_WRITE',    -- Treasurer: fees + expenses + reports
  'OPERATIONAL_WRITE',  -- Secretary / Joint Sec: registrations + broadcasts + expenses
  'LIMITED_WRITE',      -- VP / Executive: broadcasts + read all
  'READ_NOTIFY'         -- Read-only + send notifications
);
CREATE TYPE admin_term_status AS ENUM ('ACTIVE', 'EXPIRED', 'EXTENDED', 'VACATED', 'ARCHIVED');
```

### Backend

- `POST /api/v1/societies/[id]/admin-terms` — Super Admin creates term
- `GET /api/v1/societies/[id]/admin-terms` — List (filterable by status)
- `GET /api/v1/societies/[id]/admin-terms/active` — Current active admins
- `PATCH /api/v1/societies/[id]/admin-terms/[termId]` — Update dates, permission
- Validation: one PRESIDENT per society at a time, max 7 active admins
- Default permission matrix: PRESIDENT=FULL_ACCESS, TREASURER=FINANCIAL_WRITE (both locked), others configurable within bounds

### UI: `/super-admin/societies/[id]/admin-terms`

```
+---------------------------------------------------------------+
| [Sidebar]  | Admin Term Management — Eden Estate               |
|            |---------------------------------------------------+
| Dashboard  |                                                   |
| Societies  | Active Committee                [+ Assign Admin]  |
| Elections< | +-----------------------------------------------+ |
| Transfers  | | Pos.       | Name          | Ends    | Days   | |
|            | |------------|---------------|---------|--------| |
|            | | PRESIDENT  | Hemant Kumar  | 31 Mar 27| [=green]|
|            | | TREASURER  | Rajesh Sharma | 31 Mar 27| [=green]|
|            | | SECRETARY  | Priya Singh   | 31 Mar 27| [=green]|
|            | | EXEC_MBR   | Amit Verma    | 31 Mar 27| [=green]|
|            | +-----------------------------------------------+ |
|            | Term History                    [Filter \/]       |
|            | +-----------------------------------------------+ |
|            | | Suresh Goel | PRESIDENT | 2023-2025 | ARCHIVED| |
|            | +-----------------------------------------------+ |
+---------------------------------------------------------------+
```

### Term Status Lifecycle

```
ACTIVE ──> EXPIRED ──> ARCHIVED
  │            │
  │            └──> EXTENDED ──> EXPIRED (re-enters cycle)
  │
  └──> VACATED ──> ARCHIVED
```

### Components

- `AdminTermDashboard` — Active committee with countdown bars
- `AssignAdminDialog` — Select resident, set position, dates, permission
- `TermCountdownBar` — Visual days remaining (green >90d, yellow 30-90d, red <30d)
- `PermissionBadge` — Shows permission level with tooltip
- `PositionBadge` — Color-coded position display

### Acceptance Criteria

- [ ] Super Admin can create admin terms with position, permission, start/end dates
- [ ] Only one PRESIDENT per society at any time (validation enforced)
- [ ] Maximum 7 active admins per society enforced
- [ ] Permission matrix defaults applied on position selection; overrides within bounds
- [ ] Countdown bar shows green (>90d), yellow (30-90d), red (<30d)
- [ ] Term history list with status filtering
- [ ] Admin permissions enforced on all API routes (middleware check)

---

## Task 4.2 — Election Reminder System

### Backend

- Daily cron checks ACTIVE terms for upcoming expirations
- Reminder schedule: 90, 60, 30, 7, 1 days before `term_end`
- `term_reminders` table tracks sent/pending reminders (idempotent per term per day-mark)

### Notification Matrix

| Days | Recipients                  | Channels        |
| ---- | --------------------------- | --------------- |
| 90   | Primary Admin + Super Admin | WhatsApp        |
| 60   | Primary Admin               | WhatsApp + Push |
| 30   | All active admins           | WhatsApp + Push |
| 7    | Primary Admin + Super Admin | WhatsApp + Push |
| 1    | All admins + Super Admin    | WhatsApp + Push |

Dashboard integration: countdown timer on admin header (visible when <90d). Colors: green >90d, yellow 30-90d, orange 7-30d, red <7d.

### Acceptance Criteria

- [ ] Cron job runs daily and identifies terms within 90 days of expiry
- [ ] WhatsApp notifications sent at 90, 60, 30, 7, 1 day marks
- [ ] Push notifications sent at 60, 30, 7, 1 day marks
- [ ] Primary Admin and Super Admin both receive 90-day and 7-day reminders
- [ ] 30-day reminder broadcasts to all active admins (not just Primary)
- [ ] Dashboard countdown visible on admin header when < 90 days
- [ ] Countdown color transitions: green -> yellow -> orange -> red
- [ ] Duplicate reminders prevented (idempotent per term per day-mark)

---

## Task 4.3 — Term Expiry & Auto-Downgrade

### Downgrade Rules

- **Supporting admins** (VP, Secretary, Joint Sec, Treasurer, Exec Member): immediate downgrade on `term_end`. Status=EXPIRED, role reverted to original resident role, write permissions revoked atomically. 30-day read-only window, then ARCHIVED.
- **Primary Admin** (PRESIDENT): 7-day grace period post `term_end`. Grace period: READ_NOTIFY only. After grace: full downgrade, role reverted, status=ARCHIVED.

### Notifications

- Supporting expired: notify the admin + Primary Admin
- President grace starts: notify President ("7-day grace period active")
- President grace ends: notify President + Super Admin ("No active President, action required")

### Downgrade Flow (Supporting)

```
term_end reached -> status=EXPIRED -> role=original_resident_role
  -> permissions revoked (atomic) -> notification sent
  -> 30-day read-only window -> status=ARCHIVED
```

### Downgrade Flow (President)

```
term_end reached -> status=EXPIRED -> permissions=READ_NOTIFY only
  -> 7-day grace -> daily reminder "Grace ends in X days"
  -> grace_end -> role=original_resident_role -> all access revoked
  -> notification to President + Super Admin -> status=ARCHIVED
```

### Acceptance Criteria

- [ ] Supporting admins auto-downgraded on exact `term_end` date
- [ ] President gets 7-day grace period with READ_NOTIFY only
- [ ] All write permissions revoked atomically (single DB transaction)
- [ ] User role reverted to original resident role (RESIDENT_OWNER, etc.)
- [ ] Notifications sent to affected admin, Primary Admin, and Super Admin
- [ ] Grace period countdown visible on President's dashboard
- [ ] After 30-day read-only window, expired terms auto-archived

---

## Task 4.4 — Term Extension

### Backend

- `POST /api/v1/societies/[id]/admin-terms/[termId]/extend` — Super Admin only
- Body: `{ extensionDays: 30, reason: string }`
- Max 2 extensions per term (2 x 30 = 60 days max). Tracked by `extension_count`.
- Status changes to EXTENDED. New `term_end` = old + 30 days. Reminder cycle resets.
- Extension possible during President's grace period.
- Audit table: `term_extension_logs` (term_id, extension_number, previous_end, new_end, reason, granted_by)

### Acceptance Criteria

- [ ] Super Admin can grant 30-day extension via API and UI
- [ ] Maximum 2 extensions enforced (`extension_count <= 2`)
- [ ] Extension reason mandatory and stored in `term_extension_logs`
- [ ] Term status changes to EXTENDED
- [ ] New `term_end` = old `term_end` + 30 days
- [ ] Reminder cycle resets based on new `term_end`
- [ ] Extension possible during President's 7-day grace period
- [ ] Notification sent to the admin and all committee members

---

## Task 4.5 — Mid-Term Vacancy

### Flow

1. President requests removal -> `POST /api/v1/societies/[id]/admin-terms/[termId]/vacate`
2. Super Admin notified, must confirm within 48 hours
3. On confirm: status=VACATED, role reverted, permissions revoked, all admins notified
4. Optional: promote replacement resident -> `POST /api/v1/societies/[id]/admin-terms/promote`
5. Replacement term gets `by_election=true` flag, inherits remaining duration (or custom end)

```
+-----------------------------------------------+
| Request Admin Removal                    [X]   |
| -------------------------------------------   |
| Admin: Amit Verma (EXECUTIVE_MEMBER)           |
| Term: 01 Apr 2025 - 31 Mar 2027               |
|                                                |
| Reason for removal *                           |
| +-------------------------------------------+ |
| | Relocating out of society premises.        | |
| +-------------------------------------------+ |
|                                                |
| Note: Super Admin must confirm within 48h.     |
|            [Cancel]  [Submit Request]          |
+-----------------------------------------------+
```

### Acceptance Criteria

- [ ] President can request removal of any supporting admin
- [ ] Super Admin must confirm vacancy within 48 hours
- [ ] Admin status changes to VACATED on confirmation
- [ ] User role reverted and permissions revoked atomically
- [ ] Super Admin can promote existing resident as replacement
- [ ] By-election flag set on replacement term record
- [ ] Replacement term end defaults to vacated term's end (configurable)
- [ ] All committee members notified of vacancy and replacement
- [ ] 48-hour timeout escalation handled (stays pending, not auto-approved)

---

## Task 4.6 — Election Transition Flow

### Backend

- `POST /api/v1/societies/[id]/elections/transition` — Atomic transition
- `GET /api/v1/societies/[id]/elections/transition/preview` — Preview changes

### Atomic Steps

1. Validate: all new admins are active residents, exactly 1 PRESIDENT
2. Archive all current ACTIVE/EXTENDED terms (status=ARCHIVED)
3. Revert outgoing admin roles to resident
4. Create new terms, set incoming roles (PRIMARY/SUPPORTING)
5. Send notifications, log in audit trail
6. Optional 7-day overlap: old admins get READ_NOTIFY, new admins full permissions

### UI: Election Transition Wizard (4 steps)

```
+---------------------------------------------------------------+
| Election Transition — Review & Confirm               Step 4/4 |
| -----------------------------------------------------------   |
| Outgoing (archived)                                            |
| +-----------------------------------------------------------+ |
| | Suresh Goel  | PRESIDENT | Apr 2023-Mar 2025 | ARCHIVED   | |
| | Kavita Devi  | TREASURER | Apr 2023-Mar 2025 | ARCHIVED   | |
| +-----------------------------------------------------------+ |
|                                                                |
| Incoming (new committee)                                       |
| +-----------------------------------------------------------+ |
| | Hemant Kumar | PRESIDENT | Apr 2025-Mar 2027 | FULL_ACCESS| |
| | Priya Singh  | SECRETARY | Apr 2025-Mar 2027 | OPS_WRITE  | |
| +-----------------------------------------------------------+ |
|                                                                |
| Data Continuity: [OK] 142 residents, 38 payments, 12 expenses |
| [ ] Enable 7-day overlap period                                |
|                      [Back]  [Confirm Transition]              |
+---------------------------------------------------------------+
```

Wizard steps: (1) Verify current committee, (2) Assign new members via resident search, (3) Set term dates, (4) Review with data continuity check + confirm.

### Data Continuity

- All society data persists: residents, fees, expenses, payments, reports
- No data deleted or modified during transition
- Outgoing admins become regular residents with full history
- New admins see all historical data from day one

### Acceptance Criteria

- [ ] Super Admin can initiate election transition via multi-step wizard
- [ ] Wizard validates: exactly 1 PRESIDENT, all users are active residents
- [ ] All outgoing terms archived atomically (single DB transaction)
- [ ] All incoming terms created with correct positions and permissions
- [ ] User roles updated: outgoing -> resident, incoming -> admin
- [ ] Data continuity check confirms zero data loss before confirmation
- [ ] Optional 7-day overlap period with read-only for outgoing admins
- [ ] Notifications sent to all outgoing and incoming admins
- [ ] Transition logged in audit trail with full before/after snapshot

---

## Task 4.7 — Property Transfer Scenarios

Uses `property_transfers` table + `transfer_type` enum (OWNERSHIP_SALE, TENANT_DEPARTURE, BUILDER_FLOOR_PARTIAL, INHERITANCE).

### Backend

- `POST /api/v1/societies/[id]/transfers` — Initiate transfer
- `GET /api/v1/societies/[id]/transfers` — List all transfers (filterable by type)
- `GET /api/v1/societies/[id]/transfers/[transferId]` — Transfer detail with fee snapshot
- `POST /api/v1/societies/[id]/transfers/[transferId]/complete` — Finalize transfer

### Four Transfer Types

1. **Ownership Sale**: outgoing user -> TRANSFERRED_DEACTIVATED. Outstanding fees become "Transferred Arrears" (linked to unit). Unit marked vacant. New buyer registers fresh.
2. **Tenant Departure**: outgoing user -> TENANT_DEPARTED. Fees settled or written off. Unit reverts to owner-only occupancy.
3. **Builder Floor Partial**: scoped to single floor/unit. Other floors of same owner unaffected. New buyer registers for specific floor.
4. **Inheritance**: outgoing user -> DECEASED. Heir registers as new owner. Arrears: INHERIT (heir pays) or WRITE_OFF (admin closes).

### Outstanding Fee Disposition

| Option              | Use Case                                       |
| ------------------- | ---------------------------------------------- |
| Transferred Arrears | Sale — new buyer may inherit unit debt         |
| Closed Arrears      | Departure — tenant settles before leaving      |
| Write-Off           | Deceased, irrecoverable — admin records reason |

### UI: Property Transfer Dialog

```
+---------------------------------------------------------------+
| Initiate Property Transfer                             [X]    |
| -----------------------------------------------------------   |
| Unit: [Search... | A-101 (Hemant Kumar - Owner)        ]      |
|                                                                |
| Transfer Type *                                                |
| (o) Ownership Sale  (o) Tenant Departure                      |
| (o) Builder Floor   (o) Inheritance                            |
|                                                                |
| Outstanding Fees: Rs.4,500                                     |
| (o) Transferred Arrears  (o) Write off  (o) Settled            |
|                                                                |
| Write-off Reason: [________________________________]           |
| Transfer Date:    [calendar 04/03/2026             ]           |
| Notes:            [Property sold. Registry complete.]          |
|                                                                |
| WARNING: Outgoing resident will be deactivated.                |
|                   [Cancel]  [Initiate Transfer]                |
+---------------------------------------------------------------+
```

### Acceptance Criteria

- [ ] Admin can initiate all 4 transfer types from unit detail or transfer page
- [ ] Ownership Sale: outgoing user TRANSFERRED_DEACTIVATED, fees become Transferred Arrears
- [ ] Tenant Departure: outgoing user TENANT_DEPARTED, fees settled or written off
- [ ] Builder Floor Partial: only the specific unit affected, other units intact
- [ ] Inheritance: outgoing user DECEASED, heir can inherit arrears or admin writes off
- [ ] Outstanding fee snapshot recorded at time of transfer
- [ ] Unit marked vacant after outgoing user deactivated
- [ ] Transfer history visible on unit detail page
- [ ] New registration for the unit links to transfer record
- [ ] Full audit trail: who initiated, when, type, fee disposition, notes

---

## Task 4.8 — Resident Status Management

### 14 Statuses (v3.0 — adds ACTIVE_LIFETIME and MIGRATED_DORMANT over MVP's 12)

Active: ACTIVE_PAID, ACTIVE_PENDING, ACTIVE_OVERDUE, ACTIVE_PARTIAL, ACTIVE_EXEMPTED, ACTIVE_LIFETIME.
Inactive: MIGRATED_PENDING, MIGRATED_DORMANT.
Archived: TRANSFERRED_DEACTIVATED, TENANT_DEPARTED, DECEASED.
Restricted: SUSPENDED, BLACKLISTED.

### Key Transition Rules

```
ACTIVE_PAID     -> SUSPENDED, TRANSFERRED_DEACTIVATED, TENANT_DEPARTED, DECEASED, BLACKLISTED
ACTIVE_PENDING  -> ACTIVE_PAID, ACTIVE_OVERDUE, ACTIVE_PARTIAL, ACTIVE_EXEMPTED, ACTIVE_LIFETIME, SUSPENDED
ACTIVE_OVERDUE  -> ACTIVE_PAID, ACTIVE_PARTIAL, ACTIVE_EXEMPTED, SUSPENDED, BLACKLISTED
ACTIVE_PARTIAL  -> ACTIVE_PAID, ACTIVE_OVERDUE, ACTIVE_EXEMPTED, SUSPENDED
ACTIVE_EXEMPTED -> ACTIVE_PENDING (next session), SUSPENDED
ACTIVE_LIFETIME -> SUSPENDED, DECEASED (cannot be downgraded by RWA Admin)
MIGRATED_PEND.  -> ACTIVE_PENDING (activation), MIGRATED_DORMANT (auto 60d)
MIGRATED_DORM.  -> ACTIVE_PENDING (late activation), BLACKLISTED
SUSPENDED       -> ACTIVE_PENDING (reinstate), BLACKLISTED (escalate)
```

Terminal (no exit): TRANSFERRED_DEACTIVATED, TENANT_DEPARTED, DECEASED.
BLACKLISTED: Super Admin only can unblock -> ACTIVE_PENDING.
All transitions validated server-side; invalid transitions return 400 with reason.

### Admin Action Permissions

| Action                                          | Required Role    | Notes                     |
| ----------------------------------------------- | ---------------- | ------------------------- |
| Suspend / Reinstate / Blacklist / Mark Deceased | Primary Admin    | Reason mandatory          |
| Grant Lifetime                                  | Super Admin only | Irreversible by RWA Admin |
| Unblock (from BLACKLISTED)                      | Super Admin only | --                        |
| Bulk status change                              | Primary Admin    | Up to 100 residents       |

### Backend

- `PATCH /api/v1/societies/[id]/residents/[residentId]/status` — Change status (validates transition)
- `GET /api/v1/societies/[id]/residents/[residentId]/status-history` — Timeline
- `POST /api/v1/societies/[id]/residents/bulk-status` — Bulk (up to 100 residents)
- Audit: `status_change_logs` table (user_id, previous_status, new_status, reason, changed_by, effective_date)

### UI: Resident Status Management

```
+---------------------------------------------------------------+
| [Sidebar]  | Resident Status Management                       |
|            |---------------------------------------------------+
| Dashboard  | Filter: [All Statuses \/]  [Search...         ]  |
| Residents  |                                                   |
| Status Mgmt| Summary: PAID:87 | PENDING:12 | OVERDUE:8 | ...  |
|            |                                                   |
|            | [Bulk Actions \/]  Selected: 0                    |
|            | +-----------------------------------------------+ |
|            | |[ ] Name          | Status      | Since | Act. | |
|            | |----|-------------|-------------|-------|------| |
|            | |[ ] Hemant Kumar  | ACTIVE_PAID | 01 Apr| [...|| |
|            | |[ ] Rajesh Sharma | ACT_OVERDUE | 15 Apr| [...|| |
|            | |[ ] Priya Singh   | SUSPENDED   | 22 Feb| [...|| |
|            | +-----------------------------------------------+ |
|            |                                                   |
|            | [...] -> Suspend | Blacklist | Mark Deceased |     |
|            |          View History | Initiate Transfer          |
+---------------------------------------------------------------+
```

Status change dialog: shows current status, dropdown with only valid transitions, mandatory reason field, effective date, impact preview, confirmation.

Components: `StatusManagementPage`, `StatusSummaryCards`, `StatusDropdown` (valid transitions only), `StatusChangeDialog`, `StatusHistoryTimeline`, `BulkStatusDialog`.

### Acceptance Criteria

- [ ] All 14 v3.0 statuses supported
- [ ] Status transitions validated: only allowed transitions permitted per rules above
- [ ] Invalid transitions return clear error message with allowed alternatives
- [ ] Admin actions enforce role requirements (ACTIVE_LIFETIME requires Super Admin)
- [ ] Reason mandatory for all status changes
- [ ] Every status change logged in `status_change_logs` with before/after/who/when/why
- [ ] Bulk status operations work for up to 100 residents at once
- [ ] Status change triggers notification to the affected resident
- [ ] Status history timeline viewable per resident (chronological)
- [ ] BLACKLISTED blocks the mobile number from re-registration system-wide
- [ ] Terminal statuses cannot be changed by RWA Admin (only Super Admin for BLACKLISTED)

---

## Phase 4 Definition of Done

- [ ] 6 admin positions with 5 permission levels, configurable per society
- [ ] Term countdown dashboard with color-coded bars (green/yellow/orange/red)
- [ ] Automated reminders at 90/60/30/7/1 days via WhatsApp + Push
- [ ] Supporting admin auto-downgrade on term end; President gets 7-day grace
- [ ] All permissions revoked atomically on downgrade
- [ ] Term extension: max 2 x 30 days, Super Admin only, full audit trail
- [ ] Mid-term vacancy: request -> confirm (48h) -> vacate -> optional replacement
- [ ] Election transition wizard: atomic, zero data loss, optional overlap period
- [ ] Property transfers: all 4 types with correct status changes and fee handling
- [ ] Transfer history tracked per unit with audit trail
- [ ] 14 resident statuses with validated transition rules
- [ ] Status change audit log with who/when/why for every change
- [ ] Bulk status operations and role-based action permissions
- [ ] All notifications sent per spec (term events, transfers, status changes)
- [ ] All UI screens responsive with loading, empty, and error states
