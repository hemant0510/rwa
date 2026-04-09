# Resident-to-RWA-Admin Support Ticket System

## Context

The platform already has a working Admin-to-SuperAdmin support ticket system (`ServiceRequest` / `ServiceRequestMessage` models, `/admin/support` and `/sa/support` pages). Residents currently have no way to raise issues, complaints, or requests to their RWA committee through the app.

This plan replicates the existing ticket system for a **Resident-to-RWA-Admin** flow using separate Prisma models, with two additions: **optional petition linking** and **society-wide ticket visibility**.

---

## Design Decisions

### Ticket Types (Resident-focused, not platform-focused)

```
MAINTENANCE_ISSUE     -- Water leak, broken light, elevator
SECURITY_CONCERN      -- Gate issue, CCTV, guard complaint
NOISE_COMPLAINT       -- Loud parties, construction noise
PARKING_ISSUE         -- Unauthorized parking, space dispute
CLEANLINESS           -- Common area hygiene, garbage
BILLING_QUERY         -- Fee question, payment dispute
AMENITY_REQUEST       -- Pool, gym, clubhouse access
NEIGHBOR_DISPUTE      -- Interpersonal issue needing mediation
SUGGESTION            -- Improvement idea, not a complaint
OTHER                 -- Catch-all
```

### Priority

Residents do NOT set priority. It defaults to MEDIUM on creation. Admin assigns priority during triage. Residents see the priority as read-only.

### Status Lifecycle

```
OPEN              -> IN_PROGRESS, CLOSED
IN_PROGRESS       -> AWAITING_RESIDENT, RESOLVED, CLOSED
AWAITING_RESIDENT -> AWAITING_ADMIN, RESOLVED, CLOSED
AWAITING_ADMIN    -> AWAITING_RESIDENT, IN_PROGRESS, RESOLVED, CLOSED
RESOLVED          -> OPEN (reopen by creator, 7-day window), CLOSED
```

### Society-Wide Visibility

All residents in the society can see ALL tickets raised by any resident. The list shows "Raised by: [Name]". Residents can read any ticket's conversation but can ONLY post messages on their own tickets. This promotes transparency -- a resident can see if their neighbor already reported the same issue.

### Petition/Complaint Linking and Creation

Two features work together:

**1. Link existing petition:** One-way optional FK from ticket to Petition. Admin sets it via dropdown on the ticket detail page. When linked, the ticket detail shows a card with the petition title + status + type. Purely informational -- no business logic triggered. Admin can unlink at any time.

**2. Create new petition from ticket:** Admin can click "Create Petition" or "Create Complaint" directly from the ticket detail page. This opens the existing petition create flow (same as `/admin/petitions`) but pre-fills the title from the ticket subject and the description from the ticket description. After the petition is created, it is automatically linked to the ticket via the `petitionId` FK. This saves admin from manually copying ticket details into a new petition.

The existing `PetitionType` enum already supports: `COMPLAINT`, `PETITION`, `NOTICE` -- so the admin can create any of these from a ticket context.

### Internal Notes

Admin can post internal notes (matching SA's `isInternal` pattern). Internal notes are visible only to admins, never to residents. Internal notes do NOT trigger status change or notification.

### Reopen Behavior

Residents can reopen RESOLVED tickets within 7 days (matching existing admin pattern). After 7 days, they must create a new ticket.

---

## Schema Design

### New Enums

```prisma
enum ResidentTicketType {
  MAINTENANCE_ISSUE
  SECURITY_CONCERN
  NOISE_COMPLAINT
  PARKING_ISSUE
  CLEANLINESS
  BILLING_QUERY
  AMENITY_REQUEST
  NEIGHBOR_DISPUTE
  SUGGESTION
  OTHER
}

enum ResidentTicketPriority {
  LOW
  MEDIUM
  HIGH
  URGENT
}

enum ResidentTicketStatus {
  OPEN
  IN_PROGRESS
  AWAITING_RESIDENT
  AWAITING_ADMIN
  RESOLVED
  CLOSED
}
```

### New Models

```prisma
model ResidentTicket {
  id            String                 @id @default(uuid()) @db.Uuid
  societyId     String                 @map("society_id") @db.Uuid
  ticketNumber  Int                    @unique @default(autoincrement()) @map("ticket_number")
  type          ResidentTicketType
  priority      ResidentTicketPriority @default(MEDIUM)
  status        ResidentTicketStatus   @default(OPEN)
  subject       String                 @db.VarChar(200)
  description   String                 @db.Text
  createdBy     String                 @map("created_by") @db.Uuid
  petitionId    String?                @map("petition_id") @db.Uuid
  resolvedAt    DateTime?              @map("resolved_at")
  closedAt      DateTime?              @map("closed_at")
  closedReason  String?                @map("closed_reason") @db.Text
  createdAt     DateTime               @default(now()) @map("created_at")
  updatedAt     DateTime               @updatedAt @map("updated_at")

  society       Society                @relation(fields: [societyId], references: [id])
  createdByUser User                   @relation("ResidentTicketCreatedBy", fields: [createdBy], references: [id])
  petition      Petition?              @relation(fields: [petitionId], references: [id], onDelete: SetNull)
  messages      ResidentTicketMessage[]

  @@index([societyId])
  @@index([status])
  @@index([createdBy])
  @@index([priority, updatedAt(sort: Desc)])
  @@map("resident_tickets")
}

model ResidentTicketMessage {
  id          String   @id @default(uuid()) @db.Uuid
  ticketId    String   @map("ticket_id") @db.Uuid
  authorId    String   @map("author_id") @db.Uuid
  authorRole  String   @map("author_role") @db.VarChar(20)  // "RESIDENT" or "ADMIN"
  content     String   @db.Text
  isInternal  Boolean  @default(false) @map("is_internal")
  attachments String[] @default([])
  createdAt   DateTime @default(now()) @map("created_at")

  ticket ResidentTicket @relation(fields: [ticketId], references: [id], onDelete: Cascade)

  @@index([ticketId, createdAt])
  @@map("resident_ticket_messages")
}
```

### Back-Relations to Add

- **Society**: `residentTickets ResidentTicket[]`
- **User**: `residentTicketsCreated ResidentTicket[] @relation("ResidentTicketCreatedBy")`
- **Petition**: `linkedTickets ResidentTicket[]`

---

## Reference Files (Existing Patterns to Follow)

| Pattern                   | Reference File                                                   |
| ------------------------- | ---------------------------------------------------------------- |
| Ticket API routes (admin) | `src/app/api/v1/admin/support/route.ts`                          |
| Ticket API routes (SA)    | `src/app/api/v1/super-admin/support/route.ts`                    |
| Ticket detail route       | `src/app/api/v1/admin/support/[requestId]/route.ts`              |
| Messages route            | `src/app/api/v1/admin/support/[requestId]/messages/route.ts`     |
| Status change route       | `src/app/api/v1/super-admin/support/[requestId]/status/route.ts` |
| Validation schemas        | `src/lib/validations/support.ts`                                 |
| Service layer             | `src/services/support.ts`                                        |
| Admin list page           | `src/app/admin/support/page.tsx`                                 |
| Admin detail page         | `src/app/admin/support/[requestId]/page.tsx`                     |
| SA list page              | `src/app/sa/support/page.tsx`                                    |
| SA detail page            | `src/app/sa/support/[requestId]/page.tsx`                        |
| Conversation component    | `src/components/features/support/ConversationThread.tsx`         |
| Shared Prisma mock        | `tests/__mocks__/prisma.ts`                                      |
| Admin support test        | `tests/api/admin/support/route.test.ts`                          |

---

## Group 1 -- Schema, Validations, and Foundation

### Deliverables

1. **Prisma migration**: Add 3 enums + 2 models + back-relations on Society, User, Petition
2. Run `npm run db:generate`
3. **`src/lib/validations/resident-support.ts`** -- Zod schemas:
   - `createResidentTicketSchema` (type, subject 5-200 chars, description 20-5000 chars -- NO priority)
   - `createResidentTicketMessageSchema` (content 1-5000 chars, isInternal boolean default false)
   - `changeResidentTicketStatusSchema` (status enum, reason optional 0-1000 chars)
   - `changeResidentTicketPrioritySchema` (priority enum)
   - `linkPetitionSchema` (petitionId: uuid | null)
   - `VALID_TRANSITIONS` map + `isValidTransition()` function
   - Const arrays: `RESIDENT_TICKET_TYPES`, `RESIDENT_TICKET_PRIORITIES`, `RESIDENT_TICKET_STATUSES` with label maps
4. **`src/types/resident-support.ts`** -- TypeScript interfaces for API responses
5. **Update `tests/__mocks__/prisma.ts`**: Add `residentTicket` and `residentTicketMessage` model entries
6. Add audit action types to `src/lib/audit.ts`: `RESIDENT_TICKET_CREATED`, `RESIDENT_TICKET_STATUS_CHANGED`, `RESIDENT_TICKET_MESSAGE_SENT`, `RESIDENT_TICKET_REOPENED`, `RESIDENT_TICKET_PRIORITY_CHANGED`, `RESIDENT_TICKET_PETITION_LINKED`

### Tests

- `tests/lib/validations/resident-support.test.ts` -- schema validation, transitions

### Quality Gate

`npm run lint` + `npx tsc --noEmit`

---

## Group 2 -- Resident API Routes

### Deliverables

7. **`src/app/api/v1/residents/me/support/route.ts`** -- GET (list) + POST (create)
   - GET: society-wide listing, filters (status, type, mine), pagination
   - POST: create with status=OPEN, priority=MEDIUM, createdBy=current resident
8. **`src/app/api/v1/residents/me/support/[id]/route.ts`** -- GET (detail)
   - Messages excluding isInternal, createdByUser name
   - Any resident in the society can view (society-scoped)
9. **`src/app/api/v1/residents/me/support/[id]/messages/route.ts`** -- POST (reply)
   - Only ticket creator can post
   - Auto-transition AWAITING_RESIDENT -> AWAITING_ADMIN
   - Cannot post on CLOSED tickets
10. **`src/app/api/v1/residents/me/support/[id]/reopen/route.ts`** -- POST
    - Only ticket creator, only RESOLVED, 7-day window
11. **`src/app/api/v1/residents/me/support/unread-count/route.ts`** -- GET
    - Count own tickets in AWAITING_RESIDENT status

### Tests

- `tests/api/residents/support/route.test.ts`
- `tests/api/residents/support/detail.test.ts`
- `tests/api/residents/support/messages.test.ts`
- `tests/api/residents/support/reopen.test.ts`
- `tests/api/residents/support/unread-count.test.ts`

### Quality Gate

`npm run lint` + `npx tsc --noEmit` + per-file 95% coverage

---

## Group 3 -- Admin API Routes

### Deliverables

12. **`src/app/api/v1/admin/resident-support/route.ts`** -- GET (list)
    - Society-scoped, filters (status, type, priority), pagination
    - Include createdByUser name + unit, \_count.messages
13. **`src/app/api/v1/admin/resident-support/stats/route.ts`** -- GET (KPIs)
    - open, inProgress, awaitingAdmin, resolved7d, avgResolutionHours
14. **`src/app/api/v1/admin/resident-support/[id]/route.ts`** -- GET (detail)
    - ALL messages including internal, full resident info
15. **`src/app/api/v1/admin/resident-support/[id]/messages/route.ts`** -- POST
    - Non-internal: auto-transition to AWAITING_RESIDENT
    - Internal: no status change or notification
16. **`src/app/api/v1/admin/resident-support/[id]/status/route.ts`** -- PATCH
    - Validate transitions, set resolvedAt/closedAt/closedReason
17. **`src/app/api/v1/admin/resident-support/[id]/priority/route.ts`** -- PATCH
18. **`src/app/api/v1/admin/resident-support/[id]/link-petition/route.ts`** -- PATCH
    - Validate petition belongs to same society
    - Body: `{ petitionId: string | null }` (null to unlink)
19. **`src/app/api/v1/admin/resident-support/[id]/create-petition/route.ts`** -- POST
    - Creates a new Petition (DRAFT status) pre-filled from ticket subject + description
    - Body: `{ type: "COMPLAINT" | "PETITION" | "NOTICE" }` (admin picks the type)
    - Auto-links the created petition to the ticket (sets `petitionId` on the ticket)
    - Reuses existing petition creation logic from `src/app/api/v1/societies/[id]/petitions/route.ts`
    - Returns: created petition + updated ticket
20. **`src/app/api/v1/admin/resident-support/unread-count/route.ts`** -- GET
    - Count tickets in AWAITING_ADMIN status

### Tests

- `tests/api/admin/resident-support/route.test.ts`
- `tests/api/admin/resident-support/stats.test.ts`
- `tests/api/admin/resident-support/detail.test.ts`
- `tests/api/admin/resident-support/messages.test.ts`
- `tests/api/admin/resident-support/status.test.ts`
- `tests/api/admin/resident-support/priority.test.ts`
- `tests/api/admin/resident-support/link-petition.test.ts`
- `tests/api/admin/resident-support/create-petition.test.ts`
- `tests/api/admin/resident-support/unread-count.test.ts`

### Quality Gate

`npm run lint` + `npx tsc --noEmit` + per-file 95% coverage

---

## Group 4 -- Service Layer and Shared Components

### Deliverables

20. **`src/services/resident-support.ts`** -- Typed fetch wrappers:
    - Resident: `getResidentTickets`, `createResidentTicket`, `getResidentTicketDetail`, `postResidentTicketMessage`, `reopenResidentTicket`, `getResidentUnreadCount`
    - Admin: `getAdminResidentTickets`, `getAdminResidentStats`, `getAdminResidentTicketDetail`, `postAdminResidentMessage`, `changeAdminResidentTicketStatus`, `changeAdminResidentTicketPriority`, `linkTicketPetition`, `getAdminResidentUnreadCount`
21. **`src/components/features/resident-support/ResidentTicketStatusBadge.tsx`**
    - Color maps: OPEN=blue, IN_PROGRESS=indigo, AWAITING_RESIDENT=orange, AWAITING_ADMIN=purple, RESOLVED=green, CLOSED=gray
22. **`src/components/features/resident-support/ResidentTicketTypeBadge.tsx`**
    - Label formatting: MAINTENANCE_ISSUE -> "Maintenance", SECURITY_CONCERN -> "Security", etc.
23. **`src/components/features/resident-support/ResidentConversationThread.tsx`**
    - Adapted from existing ConversationThread with "Resident"/"Admin" labels
    - `showInternal` prop (true for admin, false for resident)

### Tests

- `tests/services/resident-support.test.ts`
- `tests/components/features/resident-support/*.test.tsx` (one per component)

### Quality Gate

`npm run lint` + `npx tsc --noEmit` + per-file 95% coverage

---

## Group 5 -- Resident UI Pages

### Deliverables

24. **`src/app/r/support/page.tsx`** -- Ticket list page
    - PageHeader "Support" + "New Ticket" button
    - Create ticket dialog/inline form: type dropdown, subject, description (NO priority)
    - Filter bar: status, type, "My Tickets Only" toggle
    - List with: ticket#, subject, type badge, status badge, "Raised by [Name]", time ago
    - Own tickets subtly highlighted
    - Pagination
25. **`src/app/r/support/[ticketId]/page.tsx`** -- Ticket detail page
    - Header: ticket#, subject, status badge, type badge, priority badge (read-only)
    - "Raised by [Name]" attribution
    - Description card
    - Status-specific prompt banners (yellow for AWAITING_RESIDENT, green for RESOLVED)
    - ResidentConversationThread (showInternal=false)
    - Reply form (only for ticket creator, disabled if CLOSED)
    - Reopen button (creator only, RESOLVED, 7-day window)
    - Sidebar: Details card (type, priority, status, dates)
26. **Update `src/components/layout/ResidentSidebar.tsx`**
    - Add `{ href: "/r/support", label: "Support", icon: LifeBuoy }` nav item
    - Add unread badge showing count of own tickets in AWAITING_RESIDENT status (resident needs to reply)

### Tests

- `tests/app/r/support/page.test.tsx`
- `tests/app/r/support/detail-page.test.tsx`

### Quality Gate

`npm run lint` + `npx tsc --noEmit` + per-file 95% coverage

---

## Group 6 -- Admin UI Pages and Notifications

### Deliverables

27. **`src/app/admin/resident-support/page.tsx`** -- Ticket queue page
    - KPI cards: Open, In Progress, Awaiting Admin (red highlight), Resolved (7d), Avg Resolution
    - Filter bar: status, type, priority
    - Table: ticket#, resident name + unit, subject, type, priority (URGENT row red), status, updated, msgs
    - Pagination
28. **`src/app/admin/resident-support/[ticketId]/page.tsx`** -- Ticket detail page
    - Header: ticket#, subject, resident name + unit
    - ResidentConversationThread (showInternal=true)
    - Reply form with internal note toggle (matching SA support pattern)
    - Sidebar:
      - Actions card: status transition buttons (context-aware per current status)
      - Priority card: dropdown to change
      - Petition card: two actions available:
        - "Link Existing" dropdown to search and link/unlink an existing petition
        - "Create Complaint" / "Create Petition" / "Create Notice" buttons — opens type picker, creates new petition pre-filled from ticket, auto-links it
        - When linked: shows petition title, type badge, status badge, link to petition detail
      - Details card: type, status, priority, resident, dates
29. **Update `src/components/layout/AdminSidebar.tsx`**
    - Add nav item for Resident Support (near existing "Support" entry, use `HeadphonesIcon` or `MessageCircle`)
    - Add unread badge showing count of tickets in AWAITING_ADMIN status (matching existing announcement badge pattern with `useQuery` + red badge)
30. **WhatsApp notifications** (add to `src/lib/whatsapp.ts`):
    - `sendResidentTicketCreated(mobile, residentName, ticketSubject, ticketType)` -- notify admins
    - `sendResidentTicketResolved(mobile, residentName, ticketSubject)` -- notify ticket creator
    - `sendResidentTicketReply(mobile, residentName, ticketSubject)` -- notify ticket creator
31. **Wire notifications** into API routes:
    - Ticket creation -> notify all society admins with WhatsApp consent
    - Status changed to RESOLVED -> notify ticket creator
    - Admin non-internal message -> notify ticket creator

### Tests

- `tests/app/admin/resident-support/page.test.tsx`
- `tests/app/admin/resident-support/detail-page.test.tsx`

### Quality Gate

`npm run lint` + `npx tsc --noEmit` + `npm run build` (final production build)

---

## Additional Smaller Items (Cross-Cutting)

These are smaller pieces that span across groups and should be handled alongside them:

1. **Unread badge in ResidentSidebar** (Group 5): Query `getResidentUnreadCount()` and show red badge on "Support" nav item when count > 0. Pattern: follow AdminSidebar's existing announcement badge (`useQuery` + conditional Badge).

2. **Unread badge in AdminSidebar** (Group 6): Query `getAdminResidentUnreadCount()` and show red badge on "Resident Support" nav item. Distinguishes from the existing "Support" (admin-to-SA) entry.

3. **Resident ticket count on admin dashboard** (Group 6): If an admin dashboard page exists, add a KPI card or widget showing open resident ticket count. This ensures admins don't miss tickets.

4. **Ticket detail shows linked petition info to residents** (Group 5): When a ticket has a linked petition, the resident ticket detail page should show a small read-only card: "Related: [Petition Title] (COMPLAINT/PETITION/NOTICE) — [Status]". Residents can click through to the petition in `/r/petitions` if it's published.

5. **Duplicate ticket awareness** (Group 5): When a resident creates a new ticket, show a soft warning if similar open tickets exist in the society (based on subject similarity or same type). No blocking — just informational: "Similar open tickets in your society: [Ticket #42: Elevator broken]". This reduces duplicate submissions.

6. **Audit logging** (Groups 2, 3): All ticket lifecycle actions (create, status change, message, reopen, priority change, petition link) should create an `AuditLog` entry. Pattern: follow existing `logAudit()` calls in the admin support routes.

7. **Ticket auto-close stale tickets** (NOT in V1 but schema-ready): The `updatedAt` timestamp supports future auto-close rules (e.g., close RESOLVED tickets after 30 days). No implementation needed now — just ensure `updatedAt` is properly maintained on every action.

8. **READ_NOTIFY admin access** (Group 3): Admins with `READ_NOTIFY` permission should be able to view resident tickets (read-only) but NOT change status, priority, or post messages. Pattern: check `adminPermission` and scope actions to `FULL_ACCESS` only, but allow GET for both.

---

## Edge Cases and Security

| Scenario                                                       | Handling                                                                                       |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Resident from society A tries to view ticket from society B    | 404 -- society scoping on all queries                                                          |
| Non-creator resident tries to post message                     | 403 -- only ticket creator can reply                                                           |
| Non-creator resident tries to reopen                           | 403                                                                                            |
| Resident tries to set priority                                 | Field not in create schema -- silently ignored                                                 |
| Admin links petition from different society                    | 400 -- validate `petition.societyId === ticket.societyId`                                      |
| Concurrent status change                                       | DB-level status check prevents invalid transitions                                             |
| Reopen after 7 days                                            | 400 -- compare `resolvedAt` timestamp                                                          |
| CLOSED ticket interaction                                      | 400 -- no messages, no reopen, no status change                                                |
| Internal notes visibility                                      | Resident GET always filters `isInternal: false`                                                |
| Deactivated resident                                           | `getCurrentUser("RESIDENT")` returns null -- 401/403                                           |
| READ_NOTIFY admin tries to change status                       | 403 -- only FULL_ACCESS can modify                                                             |
| Admin creates petition from ticket                             | Creates DRAFT petition, auto-links it, returns both                                            |
| Admin creates petition from ticket that already has one linked | Replaces the link (petitionId updated)                                                         |
| Ticket linked to a petition that gets deleted                  | `petitionId` FK should use SET NULL on delete, not CASCADE                                     |
| Resident views ticket with linked petition                     | Shows petition info card; links to `/r/petitions/[id]` only if petition is PUBLISHED/SUBMITTED |

---

## NOT in V1 (Future Scope)

- File attachments on messages (schema column exists, unused)
- SLA tracking or deadline enforcement
- Auto-assignment to specific admin users
- Ticket merge (combining duplicates)
- Satisfaction rating after resolution
- Email notifications (WhatsApp only)
- Ticket export to CSV/Excel
- Auto-close after N days of inactivity
- Ticket categories/tags beyond the 10 types
- Public kanban board view
