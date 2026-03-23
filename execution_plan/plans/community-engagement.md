# Community Engagement Module

**Status:** Planned — post-MVP
**Features:** Community Events & Activities + Collective Petitions / Complaints

---

## Why This Exists

The RWA app currently manages fees, expenses, and notifications but has no way to:

1. **Organize community events** (Diwali, Holi, sports days, workshops) and track who wants to participate — with optional participation fees for some activities.
2. **Collect collective signatures** on complaint letters or petitions before sending them to authorities (e.g., a complaint to the municipality about a broken road).

Both features are absent from the existing MVP and full-spec plans. They are designed to be built as a standalone post-MVP module.

---

## Feature 1: Community Events & Activities

### What it does

- Admin creates an event with details: title, description, category, date, location, optional fee, optional max participants, registration deadline.
- Admin publishes the event → all residents get a WhatsApp notification.
- Residents browse upcoming events and register/RSVP.
- Admin can see who registered, manage capacity, record fees collected.
- Admin marks the event as completed after it happens, or cancels it with a reason.

### Event States

```
DRAFT → PUBLISHED → COMPLETED
                 ↘ CANCELLED
```

- **DRAFT** — created by admin, not visible to residents yet.
- **PUBLISHED** — visible to residents; registration is open (until deadline or max participants reached).
- **COMPLETED** — event has happened; registrations closed.
- **CANCELLED** — admin cancelled; residents are notified.

### Event Categories

`FESTIVAL` · `SPORTS` · `WORKSHOP` · `CULTURAL` · `MEETING` · `OTHER`

### Registration & Payment Flow

**Free event:**
Resident clicks Register → instantly `CONFIRMED`.

**Paid event (offline collection):**
Resident clicks Register → status is `PENDING_PAYMENT` (resident is registered but fee not yet collected).
Admin collects fee in person (cash / UPI) and records the payment in the app.
Status changes to `CONFIRMED` and a receipt is generated (e.g. `EVT-EDT-2025-00042`).

> Same offline-first payment approach as existing membership fees. No online payment gateway needed.

### Admin — What the admin can do

| Action                            | Where                                                                   |
| --------------------------------- | ----------------------------------------------------------------------- |
| Create event                      | Admin → Events → "Create Event" button                                  |
| Edit event details                | Admin → Events → select event                                           |
| Publish event                     | Admin → Events → select event → Publish                                 |
| Cancel event (with reason)        | Admin → Events → select event → Cancel                                  |
| Mark completed                    | Admin → Events → select event → Complete                                |
| View registrant list              | Admin → Events → select event → Registrations tab                       |
| Record fee payment for a resident | Admin → Events → Registrations → "Record Payment" against pending entry |

### Resident — What a resident can do

| Action                                              | Where                                                     |
| --------------------------------------------------- | --------------------------------------------------------- |
| Browse upcoming events                              | Resident → Events page                                    |
| See event details (date, location, fee, spots left) | Resident → Events → click event card                      |
| Register for an event                               | Resident → Events → Register button                       |
| Cancel registration                                 | Resident → Events → Cancel Registration (before deadline) |

---

## Feature 2: Collective Petitions & Complaints

### What it does

- Admin creates a petition/complaint: title, description, type (Complaint / Petition / Notice), who it is addressed to (e.g., "Municipal Corporation"), optional minimum signature target, optional deadline.
- Admin uploads the document (PDF) — the actual letter/complaint that residents will be signing.
- Admin publishes → all residents get a WhatsApp notification.
- Residents open the petition, read the PDF document, and sign digitally.
- Signing options: **draw signature on screen** or **upload a signature image**.
- Admin sees signature collection progress and can download a compiled PDF report listing all signatories with their signatures.
- Admin marks petition as "Submitted" once it is sent to the authority.

### Petition States

```
DRAFT → PUBLISHED → SUBMITTED
                 ↘ CLOSED
```

- **DRAFT** — admin is composing the petition; not yet visible to residents.
- **PUBLISHED** — open for signatures; visible to all residents.
- **SUBMITTED** — admin has submitted the petition to the target authority.
- **CLOSED** — closed without submission (deadline passed / admin decision).

### Petition Types

`COMPLAINT` · `PETITION` · `NOTICE`

### Signature Options

| Method         | How it works                                                            |
| -------------- | ----------------------------------------------------------------------- |
| Draw on screen | Resident draws their signature using a fingertip/stylus on a canvas pad |
| Upload image   | Resident uploads a photo of their handwritten signature (JPG/PNG)       |

Each resident can sign a petition only once. The signature is stored securely in Supabase Storage (private — not publicly accessible). Admin can view signatures via time-limited signed URLs.

### Admin — What the admin can do

| Action                       | Where                                                                     |
| ---------------------------- | ------------------------------------------------------------------------- |
| Create petition              | Admin → Petitions → "Create Petition" button                              |
| Upload/replace PDF document  | Admin → Petitions → select petition → Upload Document                     |
| Publish petition             | Admin → Petitions → select petition → Publish                             |
| View signature progress      | Admin → Petitions → select petition (shows "47 of 100 target signatures") |
| View signatories list        | Admin → Petitions → select petition → Signatures tab                      |
| Download compiled PDF report | Admin → Petitions → select petition → Download Report                     |
| Mark as Submitted            | Admin → Petitions → select petition → Submit                              |

### Resident — What a resident can do

| Action                             | Where                                               |
| ---------------------------------- | --------------------------------------------------- |
| Browse active petitions            | Resident → Petitions page                           |
| Read the petition document (PDF)   | Resident → Petitions → click petition card          |
| Sign the petition (draw or upload) | Resident → Petitions → petition detail page         |
| See if they've already signed      | Resident → Petitions → "You signed on [date]" badge |

---

## Database — New Tables

### `community_events`

Stores event details.

| Column                  | Type          | Notes                                   |
| ----------------------- | ------------- | --------------------------------------- |
| id                      | UUID          | PK                                      |
| society_id              | UUID          | FK → societies                          |
| title                   | varchar(200)  |                                         |
| description             | text          | optional                                |
| category                | EventCategory | FESTIVAL, SPORTS, WORKSHOP, etc.        |
| event_date              | timestamptz   |                                         |
| location                | varchar(200)  | optional                                |
| registration_deadline   | timestamptz   | optional                                |
| fee_amount              | decimal(10,2) | null = free event                       |
| max_participants        | int           | null = unlimited                        |
| status                  | EventStatus   | DRAFT → PUBLISHED → COMPLETED/CANCELLED |
| cancellation_reason     | text          | set when cancelled                      |
| created_by              | UUID          | FK → users (admin)                      |
| published_at            | timestamptz   | set when published                      |
| created_at / updated_at | timestamptz   |                                         |

### `event_registrations`

Who registered for which event.

| Column            | Type                | Notes                                   |
| ----------------- | ------------------- | --------------------------------------- |
| id                | UUID                | PK                                      |
| event_id          | UUID                | FK → community_events                   |
| user_id           | UUID                | FK → users                              |
| society_id        | UUID                | FK → societies                          |
| status            | RegistrationStatus  | CONFIRMED / PENDING_PAYMENT / CANCELLED |
| cancelled_at      | timestamptz         | optional                                |
| cancellation_note | text                | optional                                |
| registered_at     | timestamptz         |                                         |
| **Unique**        | (event_id, user_id) | one registration per resident per event |

### `event_payments`

Fee payment record for a paid event registration.

| Column          | Type          | Notes                                                          |
| --------------- | ------------- | -------------------------------------------------------------- |
| id              | UUID          | PK                                                             |
| registration_id | UUID          | FK → event_registrations (unique — 1 payment per registration) |
| user_id         | UUID          | FK → users                                                     |
| society_id      | UUID          | FK → societies                                                 |
| amount          | decimal(10,2) |                                                                |
| payment_mode    | PaymentMode   | CASH / UPI / BANK_TRANSFER / OTHER                             |
| reference_no    | varchar(50)   | UPI transaction ID etc.                                        |
| receipt_no      | varchar(50)   | unique, format: `EVT-{code}-{year}-{seq}`                      |
| payment_date    | date          |                                                                |
| notes           | text          | optional                                                       |
| recorded_by     | UUID          | FK → users (admin who recorded)                                |
| created_at      | timestamptz   |                                                                |

### `petitions`

Stores petition/complaint metadata and document link.

| Column                  | Type           | Notes                                 |
| ----------------------- | -------------- | ------------------------------------- |
| id                      | UUID           | PK                                    |
| society_id              | UUID           | FK → societies                        |
| title                   | varchar(200)   |                                       |
| description             | text           | optional                              |
| type                    | PetitionType   | COMPLAINT / PETITION / NOTICE         |
| document_url            | varchar(500)   | Supabase Storage path to PDF          |
| target_authority        | varchar(200)   | "Municipal Corporation of Delhi" etc. |
| min_signatures          | int            | optional target                       |
| deadline                | date           | optional                              |
| status                  | PetitionStatus | DRAFT → PUBLISHED → SUBMITTED/CLOSED  |
| submitted_at            | timestamptz    | set when submitted                    |
| created_by              | UUID           | FK → users (admin)                    |
| published_at            | timestamptz    |                                       |
| created_at / updated_at | timestamptz    |                                       |

### `petition_signatures`

Each resident's digital signature.

| Column        | Type                   | Notes                                   |
| ------------- | ---------------------- | --------------------------------------- |
| id            | UUID                   | PK                                      |
| petition_id   | UUID                   | FK → petitions                          |
| user_id       | UUID                   | FK → users                              |
| society_id    | UUID                   | FK → societies                          |
| method        | SignatureMethod        | DRAWN / UPLOADED                        |
| signature_url | varchar(500)           | Supabase Storage path (private bucket)  |
| signed_at     | timestamptz            |                                         |
| **Unique**    | (petition_id, user_id) | one signature per resident per petition |

---

## Pages & Navigation

### Admin Side

```
/admin/events              → Event list + Create Event
/admin/events/[id]         → Event detail + Registrant management
/admin/petitions           → Petition list + Create Petition
/admin/petitions/[id]      → Petition detail + Signatures + PDF viewer + Download Report
```

New sidebar entries: **Events** (Calendar icon) · **Petitions** (FileSignature icon)

### Resident Side

```
/r/events                  → Browse upcoming events + Register/Cancel
/r/petitions               → Browse active petitions + Signature progress
/r/petitions/[id]          → Read PDF + Sign (draw or upload)
```

New sidebar entries: **Events** (CalendarDays icon) · **Petitions** (FileText icon)

---

## Notifications

| Trigger            | Recipients                              | Template             |
| ------------------ | --------------------------------------- | -------------------- |
| Event published    | All active residents (WhatsApp consent) | `event_published`    |
| Petition published | All active residents (WhatsApp consent) | `petition_published` |

---

## API Routes

### Events (Admin)

```
GET    /api/v1/societies/[id]/events                                → list all events
POST   /api/v1/societies/[id]/events                                → create event
GET    /api/v1/societies/[id]/events/[eventId]                      → event detail
PATCH  /api/v1/societies/[id]/events/[eventId]                      → update event
POST   /api/v1/societies/[id]/events/[eventId]/publish              → publish + WhatsApp
POST   /api/v1/societies/[id]/events/[eventId]/cancel               → cancel
POST   /api/v1/societies/[id]/events/[eventId]/complete             → mark complete
GET    /api/v1/societies/[id]/events/[eventId]/registrations        → list registrants
POST   /api/v1/societies/[id]/events/[eventId]/registrations/[regId]/payment  → record fee
```

### Events (Resident)

```
GET    /api/v1/residents/me/events                                  → browse events
POST   /api/v1/residents/me/events/[eventId]/register               → register
DELETE /api/v1/residents/me/events/[eventId]/register               → cancel registration
```

### Petitions (Admin)

```
GET    /api/v1/societies/[id]/petitions                             → list petitions
POST   /api/v1/societies/[id]/petitions                             → create petition
GET    /api/v1/societies/[id]/petitions/[petitionId]                → petition detail
PATCH  /api/v1/societies/[id]/petitions/[petitionId]                → update
POST   /api/v1/societies/[id]/petitions/[petitionId]/publish        → publish + WhatsApp
POST   /api/v1/societies/[id]/petitions/[petitionId]/document       → upload PDF
POST   /api/v1/societies/[id]/petitions/[petitionId]/submit         → mark submitted
GET    /api/v1/societies/[id]/petitions/[petitionId]/signatures     → list signatures
GET    /api/v1/societies/[id]/petitions/[petitionId]/report         → download PDF report
```

### Petitions (Resident)

```
GET    /api/v1/residents/me/petitions                               → browse petitions
GET    /api/v1/residents/me/petitions/[petitionId]                  → petition detail + doc URL
POST   /api/v1/residents/me/petitions/[petitionId]/sign             → submit signature
```

---

## New Files to Create

| File                                            | Purpose                                            |
| ----------------------------------------------- | -------------------------------------------------- |
| `src/lib/validations/event.ts`                  | Zod schemas for event create/update/cancel/payment |
| `src/lib/validations/petition.ts`               | Zod schemas for petition create/update/sign        |
| `src/services/events.ts`                        | Typed fetch wrappers for event APIs                |
| `src/services/petitions.ts`                     | Typed fetch wrappers for petition APIs             |
| `src/components/features/SignaturePad.tsx`      | Canvas-based draw-signature component              |
| `src/components/features/SignatureUpload.tsx`   | Image upload signature component                   |
| `src/app/api/v1/societies/[id]/events/...`      | All admin event API routes                         |
| `src/app/api/v1/residents/me/events/...`        | Resident event API routes                          |
| `src/app/api/v1/societies/[id]/petitions/...`   | All admin petition API routes                      |
| `src/app/api/v1/residents/me/petitions/...`     | Resident petition API routes                       |
| `src/app/admin/events/page.tsx`                 | Admin events list + create                         |
| `src/app/admin/events/[eventId]/page.tsx`       | Admin event detail + registrants                   |
| `src/app/admin/petitions/page.tsx`              | Admin petitions list + create                      |
| `src/app/admin/petitions/[petitionId]/page.tsx` | Admin petition detail + signatures + report        |
| `src/app/r/events/page.tsx`                     | Resident events browse + register                  |
| `src/app/r/petitions/page.tsx`                  | Resident petitions browse                          |
| `src/app/r/petitions/[petitionId]/page.tsx`     | Resident petition detail + sign                    |

## Files to Modify

| File                                        | Change                                                                     |
| ------------------------------------------- | -------------------------------------------------------------------------- |
| `supabase/schema.prisma`                    | ✅ Done — 5 new models + 6 enums added                                     |
| `src/lib/whatsapp.ts`                       | Add `sendEventPublishedNotification` + `sendPetitionPublishedNotification` |
| `src/lib/audit.ts`                          | Add new audit action types for events + petitions                          |
| `src/components/layout/AdminSidebar.tsx`    | Add Events + Petitions nav items                                           |
| `src/components/layout/ResidentSidebar.tsx` | Add Events + Petitions nav items                                           |

---

## New Dependency

```
react-signature-canvas        (for draw-signature canvas pad)
@types/react-signature-canvas (dev)
```

---

## Implementation Order

1. `prisma migrate dev` — create the 5 new tables
2. Event validation + API routes + service layer
3. Admin Events pages (list + detail)
4. Resident Events page
5. Petition validation + API routes (including PDF upload to Supabase Storage)
6. `SignaturePad` + `SignatureUpload` components
7. Admin Petitions pages (list + detail with PDF viewer + signature report)
8. Resident Petitions pages (list + detail with signing UI)
9. WhatsApp notification senders + audit log actions
10. Sidebar nav updates for admin + resident
