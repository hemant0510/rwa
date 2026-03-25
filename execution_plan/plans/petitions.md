# Collective Petitions & Complaints

**Status:** Deferred — will be built after Community Events module is complete
**Last Updated:** 2026-03-25

> This spec was extracted from `community-engagement.md` to keep scope focused. Build Events first, then pick this up.

---

## What it does

- Admin creates a petition/complaint: title, description, type (Complaint / Petition / Notice), who it is addressed to (e.g., "Municipal Corporation"), optional minimum signature target, optional deadline.
- Admin uploads the document (PDF) — the actual letter/complaint that residents will be signing.
- Admin publishes → all residents get a WhatsApp notification.
- Residents open the petition, read the PDF document, and sign digitally.
- Signing options: **draw signature on screen** or **upload a signature image**.
- Admin sees signature collection progress and can download a compiled PDF report listing all signatories with their signatures.
- Admin marks petition as "Submitted" once it is sent to the authority.

---

## Petition States

```
PetitionStatus:  DRAFT | PUBLISHED | SUBMITTED | CLOSED
```

```
DRAFT → PUBLISHED → SUBMITTED
                  ↘ CLOSED
```

- **DRAFT** — admin is composing the petition; not yet visible to residents.
- **PUBLISHED** — open for signatures; visible to all residents.
- **SUBMITTED** — admin has submitted the petition to the target authority.
- **CLOSED** — closed without submission (deadline passed / admin decision).

## Petition Types

```
PetitionType:  COMPLAINT | PETITION | NOTICE
```

## Signature Options

```
SignatureMethod:  DRAWN | UPLOADED
```

| Method         | How it works                                                            |
| -------------- | ----------------------------------------------------------------------- |
| Draw on screen | Resident draws their signature using a fingertip/stylus on a canvas pad |
| Upload image   | Resident uploads a photo of their handwritten signature (JPG/PNG)       |

Each resident can sign a petition only once (unique constraint on petition_id + user_id). The signature image is stored in Supabase Storage (private bucket `petition-signatures`). Admin views signatures via time-limited signed URLs.

---

## Admin Actions

| Action                       | Where                                                                     |
| ---------------------------- | ------------------------------------------------------------------------- |
| Create petition              | Admin → Petitions → "Create Petition" button                              |
| Upload/replace PDF document  | Admin → Petitions → select petition → Upload Document                     |
| Publish petition             | Admin → Petitions → select petition → Publish                             |
| View signature progress      | Admin → Petitions → select petition (shows "47 of 100 target signatures") |
| View signatories list        | Admin → Petitions → select petition → Signatures tab                      |
| Download compiled PDF report | Admin → Petitions → select petition → Download Report                     |
| Mark as Submitted            | Admin → Petitions → select petition → Submit                              |

## Resident Actions

| Action                             | Where                                               |
| ---------------------------------- | --------------------------------------------------- |
| Browse active petitions            | Resident → Petitions page                           |
| Read the petition document (PDF)   | Resident → Petitions → click petition card          |
| Sign the petition (draw or upload) | Resident → Petitions → petition detail page         |
| See if they've already signed      | Resident → Petitions → "You signed on [date]" badge |

---

## Digital Signature Technical Approach

**New dependency:** `react-signature-canvas` + `@types/react-signature-canvas`

**New components:**

- `SignaturePad.tsx` — Canvas-based drawing pad; exports PNG as base64 data URL.
- `SignatureUpload.tsx` — File input (image); converts to base64 via FileReader.

**API sign route:** Receives `{ method: "DRAWN"|"UPLOADED", signatureDataUrl: string }`.

- Converts base64 → Buffer.
- Uploads to Supabase Storage at `petition-signatures/{societyId}/{petitionId}/{userId}.png`.
- Stores the storage path in DB `signatureUrl` field.
- Returns success with `signedAt` timestamp.

**Admin report PDF:** Uses `@react-pdf/renderer` (already in package.json) to generate a PDF with:

- Petition title, description, submission date.
- Table of signatories: name, unit/flat, date signed, signature image inline.
- Page numbers and total signature count.

---

## Database — New Tables & Enums

### Enums

```prisma
enum PetitionType {
  COMPLAINT
  PETITION
  NOTICE
}

enum PetitionStatus {
  DRAFT
  PUBLISHED
  SUBMITTED
  CLOSED
}

enum SignatureMethod {
  DRAWN
  UPLOADED
}
```

### Table: `petitions`

| Column           | Type           | Nullable | Default | Notes                         |
| ---------------- | -------------- | -------- | ------- | ----------------------------- |
| id               | UUID           | No       | auto    | PK                            |
| society_id       | UUID           | No       | —       | FK → societies                |
| title            | varchar(200)   | No       | —       |                               |
| description      | text           | Yes      | —       |                               |
| type             | PetitionType   | No       | —       | COMPLAINT / PETITION / NOTICE |
| document_url     | varchar(500)   | Yes      | —       | Supabase Storage path to PDF  |
| target_authority | varchar(200)   | Yes      | —       |                               |
| min_signatures   | int            | Yes      | null    | Target (display-only)         |
| deadline         | date           | Yes      | null    |                               |
| status           | PetitionStatus | No       | DRAFT   |                               |
| submitted_at     | timestamptz    | Yes      | —       |                               |
| created_by       | UUID           | No       | —       | FK → users                    |
| published_at     | timestamptz    | Yes      | —       |                               |
| created_at       | timestamptz    | No       | now()   |                               |
| updated_at       | timestamptz    | No       | auto    |                               |

### Table: `petition_signatures`

| Column        | Type            | Nullable | Default | Notes                 |
| ------------- | --------------- | -------- | ------- | --------------------- |
| id            | UUID            | No       | auto    | PK                    |
| petition_id   | UUID            | No       | —       | FK → petitions        |
| user_id       | UUID            | No       | —       | FK → users            |
| society_id    | UUID            | No       | —       | FK → societies        |
| method        | SignatureMethod | No       | —       | DRAWN / UPLOADED      |
| signature_url | varchar(500)    | No       | —       | Supabase Storage path |
| signed_at     | timestamptz     | No       | now()   |                       |

**Unique constraint:** `(petition_id, user_id)`

---

## Supabase Storage Buckets

| Bucket                | Purpose                         |
| --------------------- | ------------------------------- |
| `petition-docs`       | Uploaded petition PDF documents |
| `petition-signatures` | Resident signature images (PNG) |

---

## API Routes

### Admin

```
GET/POST   /api/v1/societies/[id]/petitions
GET/PATCH  /api/v1/societies/[id]/petitions/[petitionId]
POST       /api/v1/societies/[id]/petitions/[petitionId]/publish
POST       /api/v1/societies/[id]/petitions/[petitionId]/document
POST       /api/v1/societies/[id]/petitions/[petitionId]/submit
POST       /api/v1/societies/[id]/petitions/[petitionId]/close
GET        /api/v1/societies/[id]/petitions/[petitionId]/signatures
GET        /api/v1/societies/[id]/petitions/[petitionId]/report
```

### Resident

```
GET   /api/v1/residents/me/petitions
GET   /api/v1/residents/me/petitions/[petitionId]
POST  /api/v1/residents/me/petitions/[petitionId]/sign
```

---

## Pages

```
/admin/petitions               → List + Create
/admin/petitions/[petitionId]  → Detail + Signatures + PDF viewer + Report
/r/petitions                   → Browse active petitions
/r/petitions/[petitionId]      → Read PDF + Sign (draw/upload)
```

---

## Verification Scenarios

- [ ] Admin creates petition → uploads PDF → publishes → WhatsApp sent.
- [ ] Resident opens petition → views PDF → draws signature → submits → stored in Supabase Storage.
- [ ] Resident uploads signature image instead of drawing → same result.
- [ ] Resident tries to sign again → 409 error (unique constraint).
- [ ] Admin views signatories table with signature thumbnails (via signed URLs).
- [ ] Admin downloads compiled PDF report with all signatures inline.
- [ ] Admin marks petition as submitted → status changes, submittedAt set.
