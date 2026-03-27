# Collective Petitions & Complaints

**Status:** Planned — post-MVP (build after Community Events module)
**Scope:** Petitions with digital signatures, PDF document management, and compiled report generation
**Sidebar Label:** Petitions
**Last Updated:** 2026-03-27

---

## Why This Exists

The RWA app lets admins manage fees, expenses, events, and broadcasts — but has no way for the community to collectively voice concerns. When the society wants to file a complaint with the municipal corporation about water supply, or petition the builder about pending maintenance, the admin currently has to collect signatures on paper, scan them, and submit manually.

This module digitizes that: admin drafts the petition, uploads the formal letter (PDF), publishes it to residents, collects digital signatures, and downloads a compiled report with all signatures inline — ready to submit to the authority.

> **Note:** This spec was extracted from `community-engagement.md` to keep scope focused. Events was built first; this is next.

---

## What It Does

- Admin creates a petition/complaint: title, description, type (Complaint / Petition / Notice), who it is addressed to (e.g., "Municipal Corporation"), optional minimum signature target, optional deadline.
- Admin uploads the document (PDF) — the actual letter/complaint that residents will be signing.
- Admin publishes → all residents get a WhatsApp notification.
- Residents open the petition, read the PDF document, and sign digitally.
- Signing options: **draw signature on screen** or **upload a signature image**.
- Residents can **revoke their signature** while the petition is still PUBLISHED.
- Admin sees signature collection progress and can download a compiled PDF report listing all signatories with their signatures.
- Admin marks petition as "Submitted" once it is sent to the authority → signatories get WhatsApp notification.

---

## Petition States

```
PetitionStatus:  DRAFT | PUBLISHED | SUBMITTED | CLOSED
```

```
DRAFT → PUBLISHED → SUBMITTED
                  ↘ CLOSED
```

- **DRAFT** — Admin is composing the petition; not yet visible to residents. Can be edited, document can be uploaded/replaced, and the petition can be deleted.
- **PUBLISHED** — Open for signatures; visible to all residents. No editing allowed (title, description, document, type — all frozen). Only status transitions (submit/close) are permitted. Residents can sign and revoke signatures.
- **SUBMITTED** — Admin has submitted the petition to the target authority. No more signatures accepted. Existing signatures and document are preserved read-only. Signatories are notified via WhatsApp.
- **CLOSED** — Closed without submission (admin decision). A reason is required. No more signatures accepted. Existing signatures are preserved.

**Important:** There is no automatic deadline enforcement. The `deadline` field is purely informational — a display hint for residents ("Signing open until 15 Apr"). Residents can still sign after the deadline. Admin must manually close or submit the petition when ready. This keeps the system simple with no cron dependency.

**Important:** Editing is NOT allowed after PUBLISHED. If admin needs to change the content, they must close the petition and create a new one. This prevents the scenario where residents signed based on content that was later changed.

---

## Petition Types

```
PetitionType:  COMPLAINT | PETITION | NOTICE
```

Just a label for filtering/display. No business logic attached to types.

---

## Signature Options

```
SignatureMethod:  DRAWN | UPLOADED
```

| Method         | How it works                                                            |
| -------------- | ----------------------------------------------------------------------- |
| Draw on screen | Resident draws their signature using a fingertip/stylus on a canvas pad |
| Upload image   | Resident uploads a photo of their handwritten signature (JPG/PNG)       |

Each resident can sign a petition only once (unique constraint on petition_id + user_id). The signature image is stored in Supabase Storage (private bucket `petition-signatures`). Admin views signatures via time-limited signed URLs (60 minutes expiry).

**Signature revocation:** Residents can revoke their signature while the petition is PUBLISHED. Revoking deletes the signature image from Supabase Storage and removes the DB record. Once the petition is SUBMITTED or CLOSED, signatures cannot be revoked.

---

## Resident Privacy

Residents see **signature count only** — "47 of 100 signed" — but NOT individual signatory names. This protects privacy since some residents may not want others to know they signed a complaint. Only admin can view the full signatories list with names and signature images.

---

## Create Petition Form — Fields

| Field            | Required | Validation                                                 |
| ---------------- | -------- | ---------------------------------------------------------- |
| Title            | Yes      | 3–200 characters                                           |
| Description      | No       | Max 5000 characters                                        |
| Type             | Yes      | COMPLAINT / PETITION / NOTICE                              |
| Target Authority | No       | Max 200 characters (e.g., "Municipal Corporation Ward 42") |
| Min Signatures   | No       | Integer ≥ 1. Display-only target, not enforced.            |
| Deadline         | No       | Must be in the future. Display-only, not enforced.         |

**Document upload is separate** — admin creates the petition first (DRAFT), then uploads the PDF document via the document upload action. The document can be replaced any number of times while in DRAFT.

---

## Publish Validation

Publishing fails if:

- Status is not DRAFT
- `document_url` is null — **a PDF document is required before publishing**. A petition without a document for residents to read is incomplete.

---

## Digital Signature Technical Approach

**New dependency:** `react-signature-canvas` + `@types/react-signature-canvas`

**New components:**

- `SignaturePad.tsx` — Canvas-based drawing pad; exports PNG as base64 data URL. Includes "Clear" button to redraw. Validates that canvas is not blank (pure white PNG) before submission.
- `SignatureUpload.tsx` — File input (JPG/PNG only, max 2MB); compresses and converts to base64 via the existing `compress-image.ts` utility.

**Data flow:** Base64 via API.

1. Resident draws on canvas OR uploads an image.
2. Client converts to base64 data URL (PNG).
3. For uploaded images: compress using existing `compress-image.ts` (max 1024px width, 0.8 quality).
4. POST to sign API with `{ method: "DRAWN"|"UPLOADED", signatureDataUrl: string }`.
5. API validates: base64 string present, max 2MB payload, petition is PUBLISHED, resident hasn't already signed.
6. API converts base64 → Buffer → uploads to Supabase Storage at `petition-signatures/{societyId}/{petitionId}/{userId}.png`.
7. API stores the storage path in DB `signatureUrl` field.
8. Returns success with `signedAt` timestamp.

**Blank signature check:** The `SignaturePad.tsx` component uses the `isEmpty()` method from `react-signature-canvas` to prevent submitting a blank canvas. The API does NOT re-validate blankness — client-side check is sufficient.

**Admin report PDF:** Uses `@react-pdf/renderer` (already in package.json) to generate a PDF **on-demand** (fresh each download, not cached):

- Petition title, description, type, target authority.
- Submission date (if submitted).
- Total signature count.
- Table of signatories: name, unit/flat, date signed, signature image inline (fetched via signed URLs at generation time).
- Page numbers.
- For large petitions (200+ signatures): the report may take 10-30 seconds. Show a loading spinner on the download button.

---

## Admin — Complete Action List

| Action                       | Where                                           | Conditions                                         |
| ---------------------------- | ----------------------------------------------- | -------------------------------------------------- |
| Create petition              | Petitions list → "Create Petition"              | Always available                                   |
| Edit petition details        | Petition detail → Edit                          | Only when DRAFT                                    |
| Delete petition              | Petition detail → Delete                        | Only when DRAFT (no signatures exist)              |
| Upload/replace PDF document  | Petition detail → Upload Document               | Only when DRAFT                                    |
| Publish petition             | Petition detail → Publish                       | Only when DRAFT and document_url is not null       |
| View signature progress      | Petition detail header                          | Always (shows "47 of 100 target signatures")       |
| View signatories list        | Petition detail → Signatures tab                | Always (shows name, unit, date, signature preview) |
| Remove a signature           | Petition detail → Signatures tab → row → Remove | When PUBLISHED (resident requested removal)        |
| Download compiled PDF report | Petition detail → Download Report               | When at least 1 signature exists                   |
| Mark as Submitted            | Petition detail → Submit                        | When PUBLISHED                                     |
| Close petition               | Petition detail → Close                         | When PUBLISHED (requires reason)                   |

---

## Resident — Complete Action List

| Action                        | Where                                 | Conditions                                                    |
| ----------------------------- | ------------------------------------- | ------------------------------------------------------------- |
| Browse active petitions       | Petitions page                        | Only PUBLISHED + SUBMITTED petitions shown                    |
| View petition detail          | Petitions → tap card                  | Any PUBLISHED/SUBMITTED petition                              |
| Read the PDF document         | Petition detail → embedded PDF viewer | Always available on PUBLISHED/SUBMITTED                       |
| Sign the petition             | Petition detail → "Sign" button       | PUBLISHED only, not already signed                            |
| Revoke signature              | Petition detail → "Revoke Signature"  | PUBLISHED only, must have an existing signature               |
| See signature count           | Petition detail                       | Shows "47 of 100 signed" — count only, no individual names    |
| See own signature status      | Petition detail                       | "You signed on [date]" badge if signed                        |
| View petition after SUBMITTED | Petition detail                       | Read-only — shows status "Submitted to [authority] on [date]" |

---

## PDF Document Viewing

Residents need to read the petition PDF before signing. The viewing approach:

- **Desktop:** Inline `<iframe>` with the PDF URL (Supabase Storage signed URL, 60-minute expiry). Most browsers render PDFs natively in iframes.
- **Mobile fallback:** If iframe rendering fails, show a "Download PDF" button that opens the signed URL in a new tab (browser's native PDF viewer or download).
- **Max PDF file size:** 10MB. Validated on upload. Larger documents should be compressed before uploading.
- **Allowed MIME types:** `application/pdf` only.

When admin replaces the PDF document (in DRAFT), the old file is deleted from the `petition-docs` bucket before uploading the new one.

---

## Edge Cases & Rules

1. **DRAFT deletion:** Admin can delete a petition in DRAFT state. The petition record and any uploaded PDF document in storage are both deleted. Delete button appears only on DRAFT petitions.

2. **Close requires reason:** When admin closes a PUBLISHED petition, a reason is required (min 3 characters, max 1000). The reason is stored in a `closedReason` field. No WhatsApp notification is sent on close.

3. **Submit with zero signatures:** Allowed. Admin may want to submit a notice that doesn't need signatures. The submit action does NOT validate signature count.

4. **Signing a SUBMITTED/CLOSED petition:** Returns 400 error. Only PUBLISHED petitions accept signatures.

5. **Revocation after SUBMITTED:** Not allowed. Once submitted, all signatures are locked.

6. **Admin removes a signature:** Admin can remove a single signature from the Signatures tab while the petition is PUBLISHED. This deletes the signature image from storage and removes the DB record. Use case: resident contacts admin and asks for removal.

7. **Concurrent signing:** The unique constraint `(petition_id, user_id)` prevents duplicate signatures. If two requests race, one succeeds and the other gets a 409 conflict error.

8. **Signature storage failure:** If Supabase Storage upload fails, the API returns 500 and does NOT create the signature DB record. Resident can retry.

9. **Large report generation:** For petitions with 200+ signatures, report PDF generation fetches all signature images from storage (via signed URLs) and renders them inline. This can take 10-30 seconds. The API streams the response. Show a loading spinner on the client.

10. **Replacing PDF in DRAFT:** When admin uploads a new PDF, the old file at the existing `document_url` path is deleted from `petition-docs` before the new one is stored. The `document_url` is updated to the new path.

11. **Petition list default sort:** PUBLISHED first (by published_at descending), then DRAFT (by created_at descending), then SUBMITTED/CLOSED (by updated_at descending).

12. **No editing after PUBLISHED:** If admin realizes a mistake after publishing, they must close the petition (with reason "Content correction needed") and create a new one. This is intentional — residents signed based on the original content.

---

## Database — New Tables & Enums

### New Enums

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

**Total new enums: 3**

### Table: `petitions`

| Column           | Type           | Nullable | Default | Notes                               |
| ---------------- | -------------- | -------- | ------- | ----------------------------------- |
| id               | UUID           | No       | auto    | PK                                  |
| society_id       | UUID           | No       | —       | FK → societies                      |
| title            | varchar(200)   | No       | —       | Petition title                      |
| description      | text           | Yes      | —       | Optional long description           |
| type             | PetitionType   | No       | —       | COMPLAINT / PETITION / NOTICE       |
| document_url     | varchar(500)   | Yes      | —       | Supabase Storage path to PDF        |
| target_authority | varchar(200)   | Yes      | —       | Who petition is addressed to        |
| min_signatures   | int            | Yes      | null    | Target (display-only, not enforced) |
| deadline         | date           | Yes      | null    | Display-only, not enforced          |
| status           | PetitionStatus | No       | DRAFT   | Current state                       |
| closed_reason    | text           | Yes      | —       | Required when closing               |
| submitted_at     | timestamptz    | Yes      | —       | Set when submitted                  |
| created_by       | UUID           | No       | —       | FK → users (admin who created)      |
| published_at     | timestamptz    | Yes      | —       | Set when published                  |
| created_at       | timestamptz    | No       | now()   | —                                   |
| updated_at       | timestamptz    | No       | auto    | —                                   |

**Indexes:** society_id, status.

### Table: `petition_signatures`

| Column        | Type            | Nullable | Default | Notes                            |
| ------------- | --------------- | -------- | ------- | -------------------------------- |
| id            | UUID            | No       | auto    | PK                               |
| petition_id   | UUID            | No       | —       | FK → petitions                   |
| user_id       | UUID            | No       | —       | FK → users (resident who signed) |
| society_id    | UUID            | No       | —       | FK → societies (denormalized)    |
| method        | SignatureMethod | No       | —       | DRAWN / UPLOADED                 |
| signature_url | varchar(500)    | No       | —       | Supabase Storage path to PNG     |
| signed_at     | timestamptz     | No       | now()   | —                                |

**Unique constraint:** `(petition_id, user_id)` — one signature per resident per petition.
**Indexes:** petition_id, user_id, society_id.

### Back-Relations to Add

**On `Society` model:** Add relations to `Petition`, `PetitionSignature`.

**On `User` model:** Add relations for:

- `petitionsCreated` — petitions they created (as admin)
- `petitionSignatures` — petitions they signed (as resident)

---

## Supabase Storage Buckets

| Bucket                | Access  | Purpose                                             |
| --------------------- | ------- | --------------------------------------------------- |
| `petition-docs`       | Private | Uploaded petition PDF documents. Max 10MB per file. |
| `petition-signatures` | Private | Resident signature images (PNG). Max 2MB per file.  |

Both buckets use signed URLs (60-minute expiry) for access. No public URLs.

---

## API Routes

### Events — Admin Routes

All under `/api/v1/societies/[id]/petitions/`

```
GET    /api/v1/societies/[id]/petitions
       → List all petitions for this society.
       → Query params: ?status=PUBLISHED&type=COMPLAINT&page=1&limit=20
       → Returns: { data: Petition[], total, page, limit }
       → Each petition includes: _count of signatures, signature progress vs target.

POST   /api/v1/societies/[id]/petitions
       → Create a new petition (DRAFT status).
       → Body: { title, description?, type, targetAuthority?, minSignatures?, deadline? }
       → Returns: created petition.

GET    /api/v1/societies/[id]/petitions/[petitionId]
       → Petition detail with signature count and document URL.
       → Returns: petition + signatureCount + signedUrl for document (if exists).

PATCH  /api/v1/societies/[id]/petitions/[petitionId]
       → Update petition details. Only allowed when status = DRAFT.
       → Body: any editable field (title, description, type, targetAuthority, minSignatures, deadline).

DELETE /api/v1/societies/[id]/petitions/[petitionId]
       → Delete a DRAFT petition. Hard-deletes petition record + PDF from storage.
       → Only allowed when status = DRAFT.
       → Returns: { message: "Petition deleted" }

POST   /api/v1/societies/[id]/petitions/[petitionId]/document
       → Upload/replace the PDF document.
       → Only allowed when status = DRAFT.
       → Accepts: multipart/form-data with "file" field (application/pdf, max 10MB).
       → If previous document exists, deletes old file from storage first.
       → Returns: { documentUrl: string }

POST   /api/v1/societies/[id]/petitions/[petitionId]/publish
       → Transition DRAFT → PUBLISHED. Sets publishedAt.
       → Validates: document_url is not null.
       → Sends WhatsApp notification to all active residents with consent.
       → Returns: updated petition.

POST   /api/v1/societies/[id]/petitions/[petitionId]/submit
       → Transition PUBLISHED → SUBMITTED. Sets submittedAt.
       → Sends WhatsApp notification to all signatories.
       → Returns: updated petition.

POST   /api/v1/societies/[id]/petitions/[petitionId]/close
       → Transition PUBLISHED → CLOSED.
       → Body: { reason: string } (required, 3–1000 chars)
       → Sets closedReason. No notification sent.
       → Returns: updated petition.

GET    /api/v1/societies/[id]/petitions/[petitionId]/signatures
       → List all signatures for this petition.
       → Query params: ?page=1&limit=50
       → Returns: signatures with user name, unit info, method, signedAt,
                  and time-limited signed URL for signature image.

DELETE /api/v1/societies/[id]/petitions/[petitionId]/signatures/[signatureId]
       → Admin removes a signature. Deletes image from storage + DB record.
       → Only allowed when petition is PUBLISHED.
       → Returns: { message: "Signature removed" }

GET    /api/v1/societies/[id]/petitions/[petitionId]/report
       → Generate and stream compiled PDF report (on-demand, not cached).
       → Returns: application/pdf stream.
       → Includes: petition info, all signatories with inline signature images.
```

### Events — Resident Routes

All under `/api/v1/residents/me/petitions/`

```
GET    /api/v1/residents/me/petitions
       → List PUBLISHED + SUBMITTED petitions for the resident's society.
       → Returns: petitions with signature count, resident's own signature status.
       → DRAFT and CLOSED petitions are NOT shown to residents.

GET    /api/v1/residents/me/petitions/[petitionId]
       → Petition detail with document signed URL and resident's signature status.
       → Returns: petition + documentSignedUrl + mySignature (if signed).

POST   /api/v1/residents/me/petitions/[petitionId]/sign
       → Sign the petition.
       → Body: { method: "DRAWN"|"UPLOADED", signatureDataUrl: string }
       → Validates: petition is PUBLISHED, not already signed, base64 present, payload ≤ 2MB.
       → Uploads signature to storage, creates DB record.
       → Returns: { signedAt: string }

DELETE /api/v1/residents/me/petitions/[petitionId]/sign
       → Revoke signature.
       → Allowed only when petition is PUBLISHED.
       → Deletes signature image from storage + DB record.
       → Returns: { message: "Signature revoked" }
```

---

## Pages & Navigation

### Admin Side

```
/admin/petitions                  → Petition list (table with filters) + "Create Petition" button
/admin/petitions/[petitionId]     → Petition detail with 3 tabs: Document | Signatures | Details
```

New sidebar entry: **Petitions** (FileSignature icon)

### Resident Side

```
/r/petitions                      → Card grid of active petitions (PUBLISHED + SUBMITTED)
```

Petition detail opens as Sheet/Drawer — no separate page. Shows PDF viewer + sign action.

New sidebar entry: **Petitions** (FileSignature icon)

---

## Admin Detail Page — Tab Structure

### Tab: Document

- Inline PDF viewer (`<iframe>` with signed URL)
- Download PDF button
- If DRAFT: "Upload/Replace Document" button

### Tab: Signatures

- Signature progress bar: "47 of 100 target" (or "47 signatures" if no target)
- Table: Name, Unit/Flat, Method (Drawn/Uploaded badge), Date Signed, Signature Preview (thumbnail via signed URL), Remove button (if PUBLISHED)
- Download Report button

### Tab: Details

- Read-only display of title, description, type, target authority, min signatures, deadline
- If DRAFT: Edit button, Delete button
- Status badge, published/submitted dates

---

## Notifications (WhatsApp)

| Trigger            | Recipients                                 | Template             | Content Includes                                 |
| ------------------ | ------------------------------------------ | -------------------- | ------------------------------------------------ |
| Petition published | All active residents with WhatsApp consent | `petition_published` | Petition title, type, target authority           |
| Petition submitted | All signatories of this petition           | `petition_submitted` | Petition title, target authority, submitted date |

Fire-and-forget fan-out matching existing notification pattern in `src/lib/whatsapp.ts`.

---

## Audit Log Actions

New action types to add in `src/lib/audit.ts`:

```
PETITION_CREATED
PETITION_UPDATED
PETITION_DELETED
PETITION_DOCUMENT_UPLOADED
PETITION_PUBLISHED
PETITION_SUBMITTED
PETITION_CLOSED
PETITION_SIGNED
PETITION_SIGNATURE_REVOKED
PETITION_SIGNATURE_REMOVED
```

---

## New Files to Create

| File                                                                                     | Purpose                                                   |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `src/lib/validations/petition.ts`                                                        | Zod schemas: create, update, close, sign                  |
| `src/services/petitions.ts`                                                              | Typed fetch wrappers for all petition API endpoints       |
| `src/components/features/petitions/SignaturePad.tsx`                                     | Canvas-based signature drawing component                  |
| `src/components/features/petitions/SignatureUpload.tsx`                                  | Image upload + compress for signature                     |
| `src/app/api/v1/societies/[id]/petitions/route.ts`                                       | GET (list) + POST (create)                                |
| `src/app/api/v1/societies/[id]/petitions/[petitionId]/route.ts`                          | GET (detail) + PATCH (update) + DELETE                    |
| `src/app/api/v1/societies/[id]/petitions/[petitionId]/document/route.ts`                 | POST (upload PDF)                                         |
| `src/app/api/v1/societies/[id]/petitions/[petitionId]/publish/route.ts`                  | POST                                                      |
| `src/app/api/v1/societies/[id]/petitions/[petitionId]/submit/route.ts`                   | POST                                                      |
| `src/app/api/v1/societies/[id]/petitions/[petitionId]/close/route.ts`                    | POST                                                      |
| `src/app/api/v1/societies/[id]/petitions/[petitionId]/signatures/route.ts`               | GET (list)                                                |
| `src/app/api/v1/societies/[id]/petitions/[petitionId]/signatures/[signatureId]/route.ts` | DELETE (admin remove)                                     |
| `src/app/api/v1/societies/[id]/petitions/[petitionId]/report/route.ts`                   | GET (generate PDF)                                        |
| `src/app/api/v1/residents/me/petitions/route.ts`                                         | GET (list published petitions)                            |
| `src/app/api/v1/residents/me/petitions/[petitionId]/route.ts`                            | GET (detail with document URL)                            |
| `src/app/api/v1/residents/me/petitions/[petitionId]/sign/route.ts`                       | POST (sign) + DELETE (revoke)                             |
| `src/app/admin/petitions/page.tsx`                                                       | Admin petition list + create dialog                       |
| `src/app/admin/petitions/[petitionId]/page.tsx`                                          | Admin petition detail (3 tabs)                            |
| `src/app/r/petitions/page.tsx`                                                           | Resident petitions browse + sign + view financial summary |

## Files to Modify

| File                                        | Change                                                           |
| ------------------------------------------- | ---------------------------------------------------------------- |
| `supabase/schema.prisma`                    | Add 3 new enums + 2 new models + back-relations on Society, User |
| `supabase/dbinuse.prisma`                   | Update AFTER migration runs successfully                         |
| `src/lib/whatsapp.ts`                       | Add 2 new notification senders (published, submitted)            |
| `src/lib/audit.ts`                          | Add 10 new audit action types                                    |
| `src/components/layout/AdminSidebar.tsx`    | Add Petitions nav item                                           |
| `src/components/layout/ResidentSidebar.tsx` | Add Petitions nav item                                           |

---

## New Dependencies

| Package                         | Purpose                        |
| ------------------------------- | ------------------------------ |
| `react-signature-canvas`        | Canvas-based signature drawing |
| `@types/react-signature-canvas` | TypeScript types               |

---

## Implementation Order

### Phase 1: Database

1. Add 3 new enums to `schema.prisma` (PetitionType, PetitionStatus, SignatureMethod).
2. Add 2 new models (`Petition`, `PetitionSignature`) to `schema.prisma`.
3. Add back-relations on `Society` and `User` models.
4. Run migration.
5. Update `dbinuse.prisma` to match.

### Phase 2: Storage & Dependencies

6. Create Supabase Storage buckets: `petition-docs` (private), `petition-signatures` (private).
7. Install `react-signature-canvas` + `@types/react-signature-canvas`.

### Phase 3: Backend — Core

8. Create `src/lib/validations/petition.ts` — all Zod schemas.
9. Create `src/services/petitions.ts` — typed fetch wrappers.
10. Create petition API routes (admin): list, create, detail, update, delete.
11. Create petition API routes (admin): document upload, publish, submit, close.
12. Create petition API routes (admin): signatures list, signature removal, report generation.
13. Create petition API routes (resident): list, detail, sign, revoke.

### Phase 4: Frontend — Components

14. Create `SignaturePad.tsx` component (canvas drawing with clear button + empty check).
15. Create `SignatureUpload.tsx` component (file input with compress + preview).

### Phase 5: Frontend — Admin

16. Create admin petitions list page with create dialog.
17. Create admin petition detail page (3 tabs: Document, Signatures, Details).
18. Add Petitions to admin sidebar nav.

### Phase 6: Frontend — Resident

19. Create resident petitions page (card grid + sign flow via Sheet/Drawer).
20. Add Petitions to resident sidebar nav.

### Phase 7: Cross-Cutting

21. Add 2 WhatsApp notification senders.
22. Add 10 audit log action types.
23. End-to-end testing of all flows.

---

## What's NOT in V1

- No e-signature legal validity (community tool, not legally binding)
- No multi-page signatures (sign once per petition, not per page of the PDF)
- No anonymous signing (signature always linked to resident account)
- No public/shareable petition link (society members only)
- No petition categories/tags beyond the 3 types (COMPLAINT / PETITION / NOTICE)
- No comments or discussion threads on petitions
- No petition templates or pre-built types
- No resident-proposed petitions (only admin creates)
- No automatic deadline enforcement or cron jobs
- No batch signature removal (admin removes one at a time)
- No signature image editing or annotation
- No petition voting (up/down) — only signature collection
- No signature verification or comparison against ID proof
- No export of signatories list to Excel (only compiled PDF report)
- No notification when target signatures are reached
- No notification when deadline is approaching

---

## Verification Scenarios

### Core Flow

- [ ] Admin creates petition → uploads PDF → publishes → WhatsApp sent to all residents.
- [ ] Resident opens petition → views PDF inline → draws signature → submits → stored in Supabase Storage.
- [ ] Resident uploads signature image instead of drawing → compressed → same result.
- [ ] Resident tries to sign again → 409 error (unique constraint).
- [ ] Admin views signatories table with signature thumbnails (via signed URLs).
- [ ] Admin downloads compiled PDF report with all signatures inline.
- [ ] Admin marks petition as submitted → status changes, submittedAt set, signatories notified.

### State Transitions

- [ ] Admin tries to publish without uploading PDF → 400 error (document required).
- [ ] Admin tries to edit a PUBLISHED petition → 400 error (not DRAFT).
- [ ] Admin tries to delete a PUBLISHED petition → 400 error (not DRAFT).
- [ ] Admin closes PUBLISHED petition with reason → CLOSED, closedReason stored.
- [ ] Admin tries to close without reason → 422 validation error.
- [ ] Admin deletes DRAFT petition → petition + PDF from storage both deleted.

### Signatures

- [ ] Resident signs PUBLISHED petition → DRAWN method → signature stored, count incremented.
- [ ] Resident signs with UPLOADED method → image compressed → signature stored.
- [ ] Resident tries to submit blank canvas → client-side validation prevents submission.
- [ ] Resident revokes signature while PUBLISHED → storage image deleted, DB record removed, count decremented.
- [ ] Resident tries to revoke after SUBMITTED → 400 error.
- [ ] Resident tries to sign SUBMITTED petition → 400 error.
- [ ] Resident tries to sign CLOSED petition → 400 error.
- [ ] Admin removes a signature from Signatures tab → storage + DB cleaned up.
- [ ] Admin submits petition with 0 signatures → allowed (notice use case).

### Privacy & Display

- [ ] Resident sees "47 of 100 signed" but cannot see individual signatory names.
- [ ] Resident sees "You signed on [date]" badge if they signed.
- [ ] Resident sees SUBMITTED petition as read-only with "Submitted to [authority] on [date]".
- [ ] Admin sees full signatories list with names, units, and signature previews.

### Edge Cases

- [ ] Two residents sign at the exact same time → one succeeds, other gets 409.
- [ ] Supabase Storage upload fails during signing → 500 error, no DB record created, resident can retry.
- [ ] Admin replaces PDF in DRAFT → old file deleted, new file stored, document_url updated.
- [ ] Large petition (200+ signatures) report generation → completes (may take 10-30s), PDF streams to client.
- [ ] Signature payload exceeds 2MB → 400 error.
- [ ] PDF upload exceeds 10MB → 400 error.
