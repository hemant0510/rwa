# Counsellor Role — Design & Implementation Plan

> **Status:** Draft spec, ready for review
> **Author:** Architecture working doc
> **Scope:** New platform role sitting between Super Admin and RWA Admin
> **Impact guarantee:** Zero change to existing RWA Admin, Resident, or Super Admin flows. All new surfaces live behind a new `/counsellor/*` route prefix and new `/api/v1/counsellor/*` APIs. No existing tables are altered destructively (only additive columns + new tables).

---

## 1. Overview

A **Counsellor** is a trusted human advisor who oversees a **portfolio of societies** (between 1 and 1,000 societies). They are _not_ an employee of any one society — they are a platform-appointed adjudicator who sees resident details and handles _escalated_ tickets across many societies. Think of them as a **district-level ombudsperson** for the RWA Connect platform.

### Hierarchy & Terminology

The user-facing tier name is **"Great Admin"**; the canonical technical name is **"Counsellor"**. Both refer to the same role. We standardise on `Counsellor` in code, schema, routes, and types; `Great Admin` is used only in UI copy where a more prestigious label is desirable.

```
┌────────────────────────────────────────────────────┐
│  SUPER ADMIN  — GOD tier                           │
│  • Creates, suspends, deletes Counsellors          │
│  • Assigns / revokes societies to Counsellors      │
│  • Full read/write on every table                  │
└──────────────────────┬─────────────────────────────┘
                       │ creates & delegates
┌──────────────────────▼─────────────────────────────┐
│  COUNSELLOR (aka Great Admin) — portfolio tier     │
│  • Sees only societies assigned by SA              │
│  • Sees resident directory of those societies      │
│  • Sees only escalated tickets                     │
│  • Cannot edit society data, fees, or residents    │
└──────────────────────┬─────────────────────────────┘
                       │ advises
┌──────────────────────▼─────────────────────────────┐
│  RWA ADMIN — society tier (unchanged)              │
│  • Full admin of their own society                 │
│  • Can escalate tickets to Counsellor              │
└──────────────────────┬─────────────────────────────┘
                       │ serves
┌──────────────────────▼─────────────────────────────┐
│  RESIDENT (unchanged)                              │
│  • Can vote to escalate a ticket to Counsellor     │
│  • 10-vote threshold (configurable per society)    │
└────────────────────────────────────────────────────┘
```

### Why a new role exists

1. **Scaling governance.** A single ombudsperson can mediate disputes across dozens of societies, bringing pattern-recognition (e.g. "three societies in the same complex all complain about the same cleaning vendor").
2. **Neutrality.** Residents and RWA Admins sometimes deadlock. A Counsellor is an outside, platform-approved voice.
3. **Scoped trust.** Super Admin is too privileged (can see finances, subscriptions, PII across the whole platform). The Counsellor sees only what's needed for resident welfare — no billing, no subscription data, no platform metadata.

---

## 2. What a Counsellor Can and Cannot See / Do

### ✅ Can See

| Surface                    | Scope                                       | Read | Write |
| -------------------------- | ------------------------------------------- | ---- | ----- |
| Society list               | Only societies assigned to them             | ✅   | ❌    |
| Society profile & settings | Read-only (name, address, type, unit count) | ✅   | ❌    |
| Resident directory         | Full roster per assigned society            | ✅   | ❌    |
| Resident profile           | Name, unit, contact, status, household      | ✅   | ❌    |
| **Escalated** tickets only | Tickets flagged for counsellor attention    | ✅   | ✅\*  |
| Ticket conversation        | All messages (excluding admin `isInternal`) | ✅   | ✅\*  |
| Ticket attachments         | Signed URLs, 1-hour expiry                  | ✅   | ❌    |
| Petition linked to ticket  | Read-only summary card                      | ✅   | ❌    |
| Governing body list        | Per assigned society                        | ✅   | ❌    |
| Announcements              | Published society announcements             | ✅   | ❌    |
| Cross-portfolio analytics  | Aggregated ticket metrics across societies  | ✅   | ❌    |

`*` = Counsellor writes are constrained — they can post advisory messages on escalated tickets only, and can only change ticket status to a new `COUNSELLOR_REVIEWING`, `COUNSELLOR_RESOLVED`, or `COUNSELLOR_DEFERRED` value. They cannot close tickets that were escalated by resident vote without RWA Admin acknowledgement.

### ❌ Cannot See / Do

- Financial data (fees, expenses, payments, subscription, billing)
- Any resident-sensitive documents (ID proof, ownership proof URLs)
- Other Counsellors' portfolios
- Platform config, plans, discounts, audit logs (SA only)
- Create, edit, or delete residents / units / fees / expenses
- Post messages visible to residents — only advisory messages to RWA Admin
- Access societies not explicitly assigned to them (enforced at DB query + middleware level)

---

## 3. Additional Capabilities We Suggest

Features the user asked us to brainstorm (prompt §5):

| Capability                                | Rationale                                                                                              |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Portfolio dashboard**                   | One screen showing all assigned societies, open escalations, SLA timers                                |
| **Cross-society ticket analytics**        | "Which ticket type is trending across my portfolio?"                                                   |
| **Counsellor notes (private)**            | Visible only to the Counsellor + SA — for case history across societies                                |
| **Advisory-only messages**                | A separate message type `ADVISORY` on tickets, visible only to RWA Admins                              |
| **Read-only governing body view**         | Know who the office-bearers of each society are                                                        |
| **Periodic digest notifications**         | Daily or weekly email summarising new escalations (prevents alert fatigue)                             |
| **SLA tracking**                          | Default 72-hour counsellor SLA per escalation, surfaced as a timer badge                               |
| **Signed, time-bound escalation URL**     | RWA Admin can generate a one-click link to loop in the Counsellor                                      |
| **"Counsellor Advisory" broadcast**       | A short summary the Counsellor can publish to RWA Admins of a society                                  |
| **Portfolio transfer**                    | SA-initiated bulk reassignment when a Counsellor leaves / is replaced                                  |
| **Two-factor authentication (mandatory)** | Higher privilege than RWA Admin, lower than SA — but reads PII across societies, so MFA is required    |
| **Session IP / device audit log**         | Every Counsellor login + action is recorded for accountability                                         |
| **Conflict-of-interest declaration**      | Counsellor cannot be a resident or RWA Admin of any society they oversee — enforced at assignment time |

---

## 4. Escalation Model — How a Ticket Reaches the Counsellor

A `ResidentTicket` is **not visible** to a Counsellor by default. It becomes visible only when it is _escalated_ through one of two channels.

### Channel A — RWA Admin Escalates

An RWA Admin (with `adminPermission = FULL_ACCESS`) clicks **"Escalate to Counsellor"** on a ticket. This:

1. Creates a `ResidentTicketEscalation` row with `source = ADMIN_ASSIGN`.
2. Adds the ticket to the Counsellor's inbox.
3. Posts a system message on the ticket: _"This ticket has been escalated to your Counsellor by [Admin Name]. Reason: [note]."_
4. Notifies the assigned Counsellor (email + in-app).

RWA Admin can also use a lighter **"Notify Counsellor"** action, which flags the ticket as `NOTIFIED` (Counsellor sees it in a separate tab) without formally escalating it.

### Channel B — Resident Vote

Residents can press **"Support escalation to Counsellor"** on any open ticket in their society.

- Default threshold: **10 distinct resident votes** (configurable per society via `Society.counsellorEscalationThreshold`, range 5–50, SA-editable only).
- One vote per resident per ticket.
- When the threshold is reached, the escalation is created automatically with `source = RESIDENT_VOTE`.
- The voting count is visible to all residents and the RWA Admin in real time (polling, not WebSocket for MVP).
- An RWA Admin cannot _un-escalate_ a vote-driven escalation — only SA can.

### Escalation Lifecycle

```
PENDING            -- escalation created, counsellor not yet acted
ACKNOWLEDGED       -- counsellor opened the ticket
REVIEWING          -- counsellor is working on it
RESOLVED_BY_COUNSELLOR -- counsellor has given their advisory
DEFERRED_TO_ADMIN  -- counsellor returns it to RWA Admin
WITHDRAWN          -- SA or originator withdrew the escalation
```

The underlying `ResidentTicket.status` is _not_ altered by escalation — RWA Admin still owns the final resolution. The escalation lifecycle is orthogonal.

---

## 5. Login & Account Provisioning

Counsellors are provisioned by Super Admin only. There is no self-registration.

### Creation Flow (SA-driven)

1. SA visits `/sa/counsellors/new`.
2. SA enters: name, email, mobile, national ID (optional), bio / qualifications, address, a short public-facing profile blurb.
3. On submit:
   - A Supabase Auth user is created (`supabase.auth.admin.createUser`) with `email_confirm = false` and a random one-time password.
   - A `Counsellor` row is inserted with `authUserId` linked, `isActive = true`, `mfaRequired = true`.
   - An email is dispatched with a **password-setup magic link** (reuses the existing password-reset infrastructure, new template).
4. The Counsellor clicks the link, sets a password, completes **MFA enrollment** (TOTP via Supabase MFA), and is routed to `/counsellor/onboarding`.
5. Onboarding: Counsellor completes profile, accepts code-of-conduct, and lands at an empty dashboard (no societies assigned yet).

### Suspension / Deletion

- SA can **suspend** a Counsellor → `isActive = false`. All sessions invalidated at next request. Societies stay assigned but Counsellor cannot log in.
- SA can **remove** a Counsellor → hard-deletes `Counsellor` row (assignments cascade), Auth user disabled. Societies become unassigned (not auto-reassigned) and SA is prompted to bulk-reassign.
- SA can **transfer portfolio** → bulk reassign all of Counsellor A's societies to Counsellor B in one action.

### Authentication Surface

- Login URL: `/counsellor/login` (separate from `/login` and `/sa/login` to keep flows distinct).
- Route prefix: `/counsellor/*`.
- API prefix: `/api/v1/counsellor/*`.
- Auth guard: new `requireCounsellor()` helper in `src/lib/auth-guard.ts`, mirrors `requireSuperAdmin()`.

---

## 6. Society Assignment — How SA Connects Societies to a Counsellor

### Assignment UI (SA-side)

**Page:** `/sa/counsellors/[id]`
**Tab:** _Societies_

- Shows two panes: **Assigned** (currently linked) and **Available** (unassigned to this counsellor).
- SA can multi-select from Available → **Assign** button → confirmation dialog showing count + list.
- SA can multi-select from Assigned → **Revoke** button → warning: _"Revoking will hide all current escalations from this counsellor's inbox. Open escalations will be returned to the RWA Admin."_
- Filter/search by society name, code, city, plan tier.
- Bulk assign from CSV upload: `counsellor_assignments.csv` with one `society_code` per line.

### Assignment Rules

- A society can be assigned to **multiple** Counsellors (primary + secondary) for redundancy. First-added counsellor is marked `isPrimary = true`.
- A Counsellor can oversee **up to 1,000** societies (soft cap — configurable via `PlatformConfig.maxSocietiesPerCounsellor`).
- **Conflict of interest check** (enforced at assignment time): the Counsellor's email / mobile / national ID must not match any `User` in that society. If matched, assignment is blocked with a clear error.
- Assignment is **instant** — no approval loop. Audit log entry written.
- An RWA Admin of a society sees in their settings: _"Your assigned counsellor: [Name] ([email])"_ — purely informational, no action they can take from there.

### Assignment Data Model

A single junction table `CounsellorSocietyAssignment` with fields:

| Field          | Type      | Notes                                              |
| -------------- | --------- | -------------------------------------------------- |
| `id`           | UUID      | PK                                                 |
| `counsellorId` | UUID      | FK → `Counsellor.id`                               |
| `societyId`    | UUID      | FK → `Society.id`                                  |
| `assignedById` | UUID      | FK → `SuperAdmin.id`                               |
| `assignedAt`   | DateTime  |                                                    |
| `isPrimary`    | Boolean   | First-assigned counsellor for that society         |
| `isActive`     | Boolean   | Soft-revoke flag                                   |
| `revokedAt`    | DateTime? |                                                    |
| `revokedById`  | UUID?     | FK → `SuperAdmin.id`                               |
| `notes`        | Text?     | SA-only note ("assigned to cover east-Delhi zone") |

Unique constraint: `(counsellorId, societyId)` — idempotent re-assignment.

---

## 7. Schema Design

### New Enums

```prisma
enum EscalationSource {
  ADMIN_ASSIGN        // RWA Admin escalated manually
  ADMIN_NOTIFY        // RWA Admin notified (lighter weight)
  RESIDENT_VOTE       // 10+ residents voted to escalate
  SUPER_ADMIN_FORCE   // SA force-escalated
}

enum EscalationStatus {
  PENDING
  ACKNOWLEDGED
  REVIEWING
  RESOLVED_BY_COUNSELLOR
  DEFERRED_TO_ADMIN
  WITHDRAWN
}

enum CounsellorMessageKind {
  ADVISORY_TO_ADMIN   // Only RWA Admins see this
  PRIVATE_NOTE        // Only Counsellor + SA see this
}
```

### New Models

```prisma
/// Counsellor — platform ombudsperson overseeing a portfolio of societies.
model Counsellor {
  id             String   @id @default(uuid()) @db.Uuid
  authUserId     String   @unique @map("auth_user_id") @db.Uuid
  email          String   @unique @db.VarChar(100)
  mobile         String?  @db.VarChar(15)
  name           String   @db.VarChar(100)
  nationalId     String?  @map("national_id") @db.VarChar(30)
  photoUrl       String?  @map("photo_url") @db.VarChar(500)
  bio            String?  @db.Text
  publicBlurb    String?  @map("public_blurb") @db.VarChar(500)
  isActive       Boolean  @default(true) @map("is_active")
  mfaRequired    Boolean  @default(true) @map("mfa_required")
  mfaEnrolledAt  DateTime? @map("mfa_enrolled_at")
  lastLoginAt    DateTime? @map("last_login_at")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  assignments    CounsellorSocietyAssignment[]
  escalations    ResidentTicketEscalation[]   @relation("EscalationCounsellor")
  messages       ResidentTicketMessage[]      @relation("CounsellorMessages")

  @@map("counsellors")
}

/// CounsellorSocietyAssignment — many-to-many between Counsellors and Societies.
model CounsellorSocietyAssignment {
  id            String    @id @default(uuid()) @db.Uuid
  counsellorId  String    @map("counsellor_id") @db.Uuid
  societyId     String    @map("society_id") @db.Uuid
  assignedById  String    @map("assigned_by_id") @db.Uuid
  assignedAt    DateTime  @default(now()) @map("assigned_at")
  isPrimary     Boolean   @default(false) @map("is_primary")
  isActive      Boolean   @default(true) @map("is_active")
  revokedAt     DateTime? @map("revoked_at")
  revokedById   String?   @map("revoked_by_id") @db.Uuid
  notes         String?   @db.Text

  counsellor Counsellor @relation(fields: [counsellorId], references: [id], onDelete: Cascade)
  society    Society    @relation(fields: [societyId], references: [id], onDelete: Cascade)

  @@unique([counsellorId, societyId])
  @@index([societyId])
  @@index([counsellorId])
  @@map("counsellor_society_assignments")
}

/// ResidentTicketEscalation — records when & why a ticket became visible to a Counsellor.
model ResidentTicketEscalation {
  id              String           @id @default(uuid()) @db.Uuid
  ticketId        String           @map("ticket_id") @db.Uuid
  counsellorId    String           @map("counsellor_id") @db.Uuid
  source          EscalationSource
  status          EscalationStatus @default(PENDING)
  reason          String?          @db.Text
  createdById     String?          @map("created_by_id") @db.Uuid   // user who escalated (nullable for vote-driven)
  acknowledgedAt  DateTime?        @map("acknowledged_at")
  resolvedAt      DateTime?        @map("resolved_at")
  withdrawnAt     DateTime?        @map("withdrawn_at")
  withdrawnReason String?          @map("withdrawn_reason") @db.Text
  slaDeadline     DateTime?        @map("sla_deadline")
  createdAt       DateTime         @default(now()) @map("created_at")
  updatedAt       DateTime         @updatedAt @map("updated_at")

  ticket     ResidentTicket @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  counsellor Counsellor     @relation("EscalationCounsellor", fields: [counsellorId], references: [id])
  votes      ResidentTicketEscalationVote[]

  @@unique([ticketId, counsellorId])
  @@index([counsellorId, status])
  @@index([ticketId])
  @@map("resident_ticket_escalations")
}

/// ResidentTicketEscalationVote — resident vote to escalate a ticket.
model ResidentTicketEscalationVote {
  id           String   @id @default(uuid()) @db.Uuid
  ticketId     String   @map("ticket_id") @db.Uuid
  voterId      String   @map("voter_id") @db.Uuid
  escalationId String?  @map("escalation_id") @db.Uuid
  createdAt    DateTime @default(now()) @map("created_at")

  ticket     ResidentTicket             @relation(fields: [ticketId], references: [id], onDelete: Cascade)
  voter      User                       @relation("TicketEscalationVoter", fields: [voterId], references: [id])
  escalation ResidentTicketEscalation?  @relation(fields: [escalationId], references: [id], onDelete: SetNull)

  @@unique([ticketId, voterId])
  @@index([ticketId])
  @@map("resident_ticket_escalation_votes")
}
```

### Additive Changes to Existing Models

```prisma
model Society {
  // ...existing fields unchanged...
  counsellorEscalationThreshold Int @default(10) @map("counsellor_escalation_threshold")
  counsellorAssignments CounsellorSocietyAssignment[]
}

model ResidentTicket {
  // ...existing fields unchanged...
  escalations ResidentTicketEscalation[]
  escalationVotes ResidentTicketEscalationVote[]
}

model ResidentTicketMessage {
  // ...existing fields unchanged...
  kind           CounsellorMessageKind? @map("kind")          // NULL for normal resident↔admin messages
  counsellorId   String?                @map("counsellor_id") @db.Uuid
  counsellor     Counsellor?            @relation("CounsellorMessages", fields: [counsellorId], references: [id])
}

model User {
  // ...existing fields unchanged...
  escalationVotes ResidentTicketEscalationVote[] @relation("TicketEscalationVoter")
}
```

All additions are **nullable or defaulted** — no existing data migration required beyond `prisma db push`. The existing `UserRole` enum is _not_ modified (Counsellor is a separate model like `SuperAdmin`).

---

## 8. API Endpoints

All Counsellor-facing routes live under `/api/v1/counsellor/*` and all require `requireCounsellor()`. SA-facing counsellor-management routes live under `/api/v1/super-admin/counsellors/*`.

### Super Admin — Counsellor Management

| Method | Endpoint                                                       | Action                                       |
| ------ | -------------------------------------------------------------- | -------------------------------------------- |
| GET    | `/api/v1/super-admin/counsellors`                              | List all counsellors (paginated, searchable) |
| POST   | `/api/v1/super-admin/counsellors`                              | Create counsellor + invite email             |
| GET    | `/api/v1/super-admin/counsellors/[id]`                         | Counsellor detail + assignments              |
| PATCH  | `/api/v1/super-admin/counsellors/[id]`                         | Edit profile / suspend / reactivate          |
| DELETE | `/api/v1/super-admin/counsellors/[id]`                         | Remove (soft-delete + cascade revoke)        |
| POST   | `/api/v1/super-admin/counsellors/[id]/assignments`             | Assign societies (batch)                     |
| DELETE | `/api/v1/super-admin/counsellors/[id]/assignments/[societyId]` | Revoke one assignment                        |
| POST   | `/api/v1/super-admin/counsellors/[id]/transfer-portfolio`      | Bulk transfer to another counsellor          |
| POST   | `/api/v1/super-admin/counsellors/[id]/resend-invite`           | Resend setup email                           |

### Counsellor — Self APIs

| Method | Endpoint                                            | Action                                    |
| ------ | --------------------------------------------------- | ----------------------------------------- |
| GET    | `/api/v1/counsellor/me`                             | Current counsellor profile                |
| PATCH  | `/api/v1/counsellor/me`                             | Update own profile + blurb                |
| GET    | `/api/v1/counsellor/dashboard`                      | Portfolio summary + open escalation count |
| GET    | `/api/v1/counsellor/societies`                      | List assigned societies                   |
| GET    | `/api/v1/counsellor/societies/[id]`                 | Society profile (read-only)               |
| GET    | `/api/v1/counsellor/societies/[id]/residents`       | Resident directory of that society        |
| GET    | `/api/v1/counsellor/societies/[id]/residents/[rid]` | Resident profile (read-only)              |
| GET    | `/api/v1/counsellor/societies/[id]/governing-body`  | Governing body (read-only)                |
| GET    | `/api/v1/counsellor/tickets`                        | All escalated tickets across portfolio    |
| GET    | `/api/v1/counsellor/tickets/[id]`                   | Escalated ticket detail                   |
| POST   | `/api/v1/counsellor/tickets/[id]/acknowledge`       | Move escalation → ACKNOWLEDGED            |
| POST   | `/api/v1/counsellor/tickets/[id]/messages`          | Post advisory / private note              |
| POST   | `/api/v1/counsellor/tickets/[id]/resolve`           | Mark escalation RESOLVED_BY_COUNSELLOR    |
| POST   | `/api/v1/counsellor/tickets/[id]/defer`             | Defer back to RWA Admin                   |
| GET    | `/api/v1/counsellor/analytics/portfolio`            | Cross-society ticket metrics              |

### Residents — Voting

| Method | Endpoint                                 | Action                           |
| ------ | ---------------------------------------- | -------------------------------- |
| POST   | `/api/v1/tickets/[id]/escalation-vote`   | Cast / withdraw vote to escalate |
| GET    | `/api/v1/tickets/[id]/escalation-status` | Current vote count + threshold   |

### RWA Admin — Escalate

| Method | Endpoint                                       | Action                              |
| ------ | ---------------------------------------------- | ----------------------------------- |
| POST   | `/api/v1/admin/tickets/[id]/escalate`          | Escalate (ADMIN_ASSIGN)             |
| POST   | `/api/v1/admin/tickets/[id]/notify-counsellor` | Lightweight notify (ADMIN_NOTIFY)   |
| DELETE | `/api/v1/admin/tickets/[id]/escalation`        | Withdraw admin-initiated escalation |

All new endpoints use existing `api-helpers.ts` patterns (`ok()`, `unauthorizedError()`, `forbiddenError()`, `validationError()`, `notFoundError()`) and Zod schemas in `src/lib/validations/counsellor.ts`, `src/lib/validations/escalation.ts`.

---

## 9. UI Routes & Pages

### New `/counsellor/*` Tree (Counsellor-only)

| Page                      | Path                                         | Purpose                                    |
| ------------------------- | -------------------------------------------- | ------------------------------------------ |
| Login                     | `/counsellor/login`                          | Dedicated login + MFA                      |
| Set password (first time) | `/counsellor/set-password`                   | Password-setup magic-link handler          |
| Onboarding                | `/counsellor/onboarding`                     | Welcome + code-of-conduct acceptance       |
| Dashboard                 | `/counsellor`                                | Portfolio overview + open escalations      |
| Societies list            | `/counsellor/societies`                      | Assigned societies                         |
| Society detail            | `/counsellor/societies/[id]`                 | Read-only society profile                  |
| Residents of society      | `/counsellor/societies/[id]/residents`       | Resident directory                         |
| Resident detail           | `/counsellor/societies/[id]/residents/[rid]` | Read-only resident profile                 |
| Governing body            | `/counsellor/societies/[id]/governing-body`  | Office-bearers                             |
| Escalated tickets         | `/counsellor/tickets`                        | Filterable inbox across portfolio          |
| Ticket detail             | `/counsellor/tickets/[id]`                   | Conversation + advisory / private note UI  |
| Portfolio analytics       | `/counsellor/analytics`                      | Charts: ticket type × society, SLA timings |
| Profile                   | `/counsellor/profile`                        | Edit own profile + public blurb            |
| Settings                  | `/counsellor/settings`                       | Notification prefs, MFA reset              |

### New `/sa/counsellors/*` Pages (SA-side)

| Page               | Path                            | Purpose                                  |
| ------------------ | ------------------------------- | ---------------------------------------- |
| Counsellors list   | `/sa/counsellors`               | List with search + filter                |
| Create counsellor  | `/sa/counsellors/new`           | Form                                     |
| Counsellor detail  | `/sa/counsellors/[id]`          | Tabs: Profile, Assignments, Audit        |
| Bulk-assign wizard | `/sa/counsellors/[id]/assign`   | CSV upload + multi-select                |
| Portfolio transfer | `/sa/counsellors/[id]/transfer` | Reassign societies to another counsellor |

### Additions to Existing Admin / Resident Pages (minimal, non-breaking)

- Resident ticket detail page gains a **"Support escalation"** button with live vote count (only on OPEN/IN_PROGRESS tickets).
- RWA Admin ticket detail page gains **"Escalate to Counsellor"** and **"Notify Counsellor"** buttons (only when a counsellor is assigned to the society).
- RWA Admin settings page gains a read-only **"Your Counsellor"** card.
- Society settings (SA-only) gains a **Counsellor escalation threshold** numeric input.

---

## 10. Backward-Compatibility & Original-Behaviour Preservation

Explicit guarantees:

| Concern                                 | How it stays unchanged                                                                 |
| --------------------------------------- | -------------------------------------------------------------------------------------- |
| `UserRole` enum                         | Not modified. Counsellor is a new model, not a User variant.                           |
| Existing `/api/v1/*` routes             | Not modified. New endpoints added under `/api/v1/counsellor/*` and new sub-paths only. |
| Existing ticket flow (resident ↔ admin) | Unchanged. Escalation is orthogonal — adds rows, never mutates existing columns.       |
| Existing `requireSuperAdmin()` guard    | Not modified. New `requireCounsellor()` is added alongside it.                         |
| Existing tests                          | Must continue to pass with zero change. Counsellor tests are additive.                 |
| Existing RLS policies                   | Unchanged. New policies are added for new tables only.                                 |
| Resident / RWA Admin sessions           | Unchanged. Counsellor uses a separate login route.                                     |
| Society data migrations                 | Only column additions with safe defaults (`counsellorEscalationThreshold = 10`).       |
| Signed-URL helpers                      | Reused as-is for ticket attachments.                                                   |

**Release toggle.** The entire feature sits behind a `PlatformConfig` flag `counsellorRoleEnabled` (default `false` in production). When off:

- `/counsellor/*` returns 404.
- `/sa/counsellors/*` is hidden from the SA navigation.
- Resident / Admin UIs don't render the escalation buttons.

This lets us ship code incrementally and flip it on when ready.

---

## 11. Security, Privacy, Audit

- **MFA mandatory** — enforced at login. If not enrolled, user is redirected to `/counsellor/set-password` → MFA enrollment.
- **Session TTL**: 4 hours idle (vs 24 hours for RWA Admin) — reflects higher privilege.
- **PII handling**: Counsellor sees resident name, unit, status, flat-level contact number. They do **not** see `idProofUrl`, `ownershipProofUrl`, or financial data.
- **Audit log**: every counsellor action (view, message, escalation ack / resolve / defer) is written to a new `counsellor_audit_logs` table (mirrors existing `AuditLog` shape). SA can view per counsellor.
- **Rate limiting**: 120 reads/min, 20 writes/min per counsellor (Supabase edge function). Prevents scraping PII.
- **Conflict-of-interest DB constraint**: A check at assignment time joins `User` on `societyId` filtering by email / mobile and blocks matches.
- **Row-Level Security**: new Supabase RLS policies restrict `counsellor_society_assignments` so a Counsellor can only see rows where `counsellor_id = auth.jwt().sub`.

---

## 12. Notifications

| Event                                  | Channel        | Recipient                  |
| -------------------------------------- | -------------- | -------------------------- |
| Counsellor account created             | Email          | Counsellor                 |
| Society assigned                       | Email (digest) | Counsellor                 |
| Ticket escalated by Admin              | Email + in-app | Counsellor                 |
| Ticket escalated by 10 resident votes  | Email + in-app | Counsellor                 |
| Counsellor posts advisory              | In-app         | RWA Admin                  |
| Counsellor marks resolved              | In-app         | RWA Admin + ticket creator |
| Counsellor SLA breached (>72h PENDING) | Email          | Counsellor + SA            |

Digest emails are sent via a daily cron (reuses existing notification infrastructure); per-event emails are transactional.

---

## 13. Phased Implementation

Eight groups, each shippable and testable on its own. Every group ends with **all tests passing + per-file coverage ≥ 95%** and a clean `/quality-gate` run.

### Group 1 — Schema & Core Models

- Prisma additions: `Counsellor`, `CounsellorSocietyAssignment`, `ResidentTicketEscalation`, `ResidentTicketEscalationVote`, enums, additive columns.
- Migration applied via direct URL (see CLAUDE.md DB Conventions).
- Seed helper for dev counsellors in `supabase/seed.ts`.
- Types in `src/types/counsellor.ts`, `src/types/escalation.ts`.
- Zod schemas in `src/lib/validations/counsellor.ts`, `src/lib/validations/escalation.ts`.
- `requireCounsellor()` in `src/lib/auth-guard.ts` + unit tests.
- **Deliverable:** schema compiles, `npm run db:generate` clean, new guard tested.

### Group 2 — SA Counsellor Management (API + UI)

- Endpoints: list / create / detail / patch / delete / resend-invite.
- Create flow wires Supabase Auth admin API + magic-link email.
- Pages: `/sa/counsellors`, `/sa/counsellors/new`, `/sa/counsellors/[id]` (Profile tab).
- Components: `CounsellorCreateForm`, `CounsellorRow`, `CounsellorProfileCard`.
- **Deliverable:** SA can create, view, suspend, delete a Counsellor.

### Group 3 — Society Assignment

- Endpoints: assign / revoke / transfer-portfolio / conflict-of-interest check.
- Pages: Assignments tab on `/sa/counsellors/[id]`, `/sa/counsellors/[id]/assign` (bulk + CSV), `/sa/counsellors/[id]/transfer`.
- RWA Admin settings gains read-only "Your Counsellor" card.
- **Deliverable:** SA can attach / detach / bulk-transfer societies; COI enforced.

### Group 4 — Counsellor Login, MFA, Onboarding

- Pages: `/counsellor/login`, `/counsellor/set-password`, `/counsellor/onboarding`, `/counsellor/profile`, `/counsellor/settings`.
- MFA enrollment reused from Supabase Auth MFA.
- Middleware guard for `/counsellor/*` routes (redirect unauth users).
- **Deliverable:** Counsellor can set password, enrol MFA, log in, edit profile.

### Group 5 — Counsellor Read-Only Portfolio Views

- Endpoints: `me`, `dashboard`, `societies`, `societies/[id]`, `residents`, `residents/[rid]`, `governing-body`.
- Pages: `/counsellor`, `/counsellor/societies`, `/counsellor/societies/[id]`, residents + governing-body tabs.
- Shared read-only components: `SocietyProfileReadOnly`, `ResidentDirectoryReadOnly`.
- **Deliverable:** Counsellor sees portfolio and resident directory.

### Group 6 — Escalation Mechanisms

- Admin endpoints: `escalate`, `notify-counsellor`, `withdraw escalation`.
- Admin UI: two buttons on ticket detail page.
- Resident endpoints: `escalation-vote`, `escalation-status`.
- Resident UI: "Support escalation" button + live vote count.
- Auto-escalation when threshold hit (transactional, race-safe — DB unique index + SELECT…FOR UPDATE).
- Society settings field for threshold.
- **Deliverable:** tickets become escalated by either channel.

### Group 7 — Counsellor Ticket Handling

- Endpoints: list escalated tickets, detail, acknowledge, resolve, defer, post advisory / private note.
- Pages: `/counsellor/tickets`, `/counsellor/tickets/[id]`.
- Advisory messages surface on RWA Admin ticket page as a distinct message style.
- Notification fan-out on ack / resolve / defer.
- SLA timer badge + daily cron email for breaches.
- **Deliverable:** full counsellor workflow on an escalated ticket.

### Group 8 — Analytics, Audit, Feature Flag

- Endpoint: `analytics/portfolio`; page `/counsellor/analytics` (chart components).
- `counsellor_audit_logs` table + writes on every action.
- SA audit view per counsellor.
- `PlatformConfig.counsellorRoleEnabled` flag wired into all new UIs + route middleware.
- **Deliverable:** analytics dashboard, full audit trail, kill-switch.

---

## 14. Out of Scope (Explicit)

- Counsellor-to-counsellor messaging.
- Counsellor access to financial data (explicitly forbidden — will never be added without a separate RFC).
- Counsellor authorship of petitions or announcements visible to residents.
- Mobile push notifications (PWA push is planned in `pwa-level2.md`; counsellor notifications will hook into whatever that plan ships).
- Automated SLA penalties (human review only for MVP).
- Public counsellor directory for residents (deferred — requires legal review of public PII).

---

## 15. Key Files Reference (post-build)

| File                                                   | Purpose                                       |
| ------------------------------------------------------ | --------------------------------------------- |
| `supabase/schema.prisma`                               | `Counsellor`, assignments, escalations, votes |
| `src/lib/auth-guard.ts`                                | `requireCounsellor()`                         |
| `src/lib/validations/counsellor.ts`                    | Zod schemas                                   |
| `src/lib/validations/escalation.ts`                    | Zod schemas                                   |
| `src/types/counsellor.ts`                              | TS interfaces + label maps                    |
| `src/types/escalation.ts`                              | TS interfaces + label maps                    |
| `src/services/counsellors.ts`                          | SA-side client fetch wrappers                 |
| `src/services/counsellor-self.ts`                      | Counsellor-side client fetch wrappers         |
| `src/services/escalations.ts`                          | Admin + resident fetch wrappers               |
| `src/app/counsellor/*`                                 | All counsellor pages                          |
| `src/app/sa/counsellors/*`                             | SA counsellor-management pages                |
| `src/app/api/v1/counsellor/*`                          | Counsellor APIs                               |
| `src/app/api/v1/super-admin/counsellors/*`             | SA counsellor-management APIs                 |
| `src/app/api/v1/admin/tickets/[id]/escalate/route.ts`  | Admin escalate action                         |
| `src/app/api/v1/tickets/[id]/escalation-vote/route.ts` | Resident vote                                 |
| `src/components/features/counsellor/*`                 | Counsellor UI primitives                      |
| `src/components/features/sa-counsellors/*`             | SA management UI                              |
| `src/components/features/escalation/*`                 | Admin & resident escalation controls          |
| `supabase/migrations/<ts>_counsellor_role.sql`         | Raw SQL migration + RLS policies              |
| `tests/lib/auth-guard.test.ts`                         | Guard tests                                   |
| `tests/app/api/v1/counsellor/**`                       | API route tests                               |
| `tests/app/counsellor/**`                              | Page + component tests                        |

---

## 16. Open Questions for Product Sign-off

1. **Naming in the UI.** Do we call them _"Counsellor"_, _"Great Admin"_, or both (_"Counsellor (Great Admin)"_)? Recommend **"Counsellor"** everywhere external, **"Great Admin"** only in the SA console as the tier label.
2. **Vote threshold default.** 10 is the user's number; do we surface this to RWA Admin (society setting) or keep it SA-only? Recommend **SA-only** — otherwise admins might raise it to block escalations.
3. **Can a Counsellor _close_ an escalation unilaterally?** Recommend **no** — only RWA Admin closes the underlying ticket; Counsellor resolves/defers the escalation only.
4. **Portfolio cap.** User said up to 1,000. Recommend **enforce soft cap = 1,000, hard cap = 2,000** in `PlatformConfig`.
5. **National ID collection.** Useful for COI check; potentially sensitive. Recommend **optional, encrypted at rest**.
6. **Release order.** Recommend ship groups 1–5 to production behind the flag, run an internal-only pilot, then enable groups 6–8.

---

## 17. Self-Review

- [x] Every user requirement 1–6 is covered (Role definition §1, visibility §2, capabilities §3, login §5, additional suggestions §3, assignment §6).
- [x] No placeholders or TODOs.
- [x] Types / fields are consistent across schema, API, and services tables.
- [x] Explicit backward-compatibility guarantee (§10) — no destructive changes, feature flag present.
- [x] Every phase is individually shippable and testable.
