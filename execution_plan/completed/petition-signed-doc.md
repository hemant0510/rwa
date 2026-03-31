# Petition — Signed Document & Resident Consent

**Status:** Completed
**Depends on:** Existing petitions module (Phase 6)
**Last Updated:** 2026-03-28

---

## Overview

Two enhancements to the existing petitions module:

1. **Resident Consent Gate** — Before a resident can submit their signature, they must confirm via a checkbox that they have read the petition document.
2. **Signed Document PDF** — Admin gets a new "Signed Doc" button that downloads a single combined PDF: the original petition letter/document followed by additional pages listing all signatories (with signature images inline), ready to physically submit to an authority.

---

## Feature 1 — Resident Consent Checkbox

### Problem

Currently a resident can sign a petition without ever opening or reading the document. For legal and procedural integrity (especially for complaints to municipal authorities), signatories should confirm they have read the content they are signing.

### UX Flow

1. Resident opens the petition detail sheet.
2. Resident clicks **Sign Petition**.
3. The signing UI (draw/upload tabs) is shown **but disabled**.
4. Above the tabs, a checkbox appears:
   > `☐ I have read the petition document and agree to sign`
5. Once the checkbox is ticked, the draw/upload UI becomes active.
6. Resident draws or uploads signature → submits.

### What Changes

**`src/app/r/petitions/page.tsx`**

- Add a `consentGiven` boolean state (`useState(false)`) inside the signing section.
- Reset it to `false` when `signMode` is set to null (cancel).
- Render a checkbox + label above the `<Tabs>` signing block.
- Pass `disabled={!consentGiven || signMutation.isPending}` to both `<SignaturePad>` and `<SignatureUpload>`.

> **No backend/DB change required.** Consent is a UI gate only — it is already implied by the act of signing. The `signedAt` timestamp on the `PetitionSignature` record is sufficient legal evidence. A separate `consentGiven` DB column adds complexity with no meaningful value.

### Checkbox Component

Use Shadcn `<Checkbox>` with `<Label>` already available in the project:

```tsx
<div className="flex items-start gap-2 rounded-md border p-3 text-sm">
  <Checkbox id="consent" checked={consentGiven} onCheckedChange={(v) => setConsentGiven(!!v)} />
  <Label htmlFor="consent" className="text-muted-foreground cursor-pointer leading-snug">
    I have read the petition document and agree to add my signature
  </Label>
</div>
```

---

## Feature 2 — Signed Document PDF

### Problem

Currently "Download Report" on the admin petition detail page generates a PDF listing signatories in a text table. The authority receiving the petition often requires the **actual petition letter** combined with signatures in a single document — not a separate summary sheet.

### What the Output PDF Looks Like

```
┌─────────────────────────────────┐
│  Page 1..N  (original petition  │
│  letter/document uploaded by    │
│  admin — verbatim, unmodified)  │
├─────────────────────────────────┤
│  Page N+1   Signature Page      │
│                                 │
│  Eden Estate RWA                │
│  Petition: [Title]              │
│  Generated: 28 Mar 2026         │
│  ─────────────────────────────  │
│                                 │
│  #  Name         Unit  Date     │
│  1  Gaurav Gupta A-101 28 Mar   │
│  2  Hemant Bhagat B-202 28 Mar  │
│  ...                            │
│                                 │
│  (each row has signature image  │
│   inline in a "Signature" col)  │
│                                 │
│  Total Signatures: N            │
│  ─────────────────────────────  │
│  Eden Estate RWA — Confidential │
└─────────────────────────────────┘
```

If signatures overflow one page, additional pages are added automatically.

### Signature Page Table Columns

| #   | Column      | Source                                                             |
| --- | ----------- | ------------------------------------------------------------------ |
| 1   | Sr. No.     | Row index                                                          |
| 2   | Name        | `PetitionSignature.user.name`                                      |
| 3   | Unit        | `user.userUnits[0].unit.displayLabel`                              |
| 4   | Method      | `DRAWN` / `UPLOADED` (badge)                                       |
| 5   | Date Signed | `PetitionSignature.signedAt`                                       |
| 6   | Signature   | Image fetched from Supabase storage (`petition-signatures` bucket) |

---

## API — New Endpoint

```
GET /api/v1/societies/[id]/petitions/[petitionId]/signed-doc
```

**Auth:** `RWA_ADMIN` only
**Response:** `application/pdf` binary
**Content-Disposition:** `attachment; filename="signed-doc-[safe-title].pdf"`

### Endpoint Logic (step by step)

```
1. Auth check — getCurrentUser("RWA_ADMIN")
2. Load petition from DB (title, documentUrl, societyId, status)
3. Guard: petition must exist and belong to this society
4. Guard: petition.documentUrl must exist (no original PDF → 400 NO_DOCUMENT)
5. Guard: at least 1 signature must exist (→ 400 NO_SIGNATURES)
6. Load all signatures with user name, unit, signedAt, method, signatureUrl
7. Download original petition PDF bytes from Supabase storage (petition-docs bucket)
8. For each signature, fetch signature image bytes from Supabase storage (petition-signatures bucket)
9. Generate signature page(s) PDF using @react-pdf/renderer → buffer
10. Merge: original PDF bytes + signature-page buffer using pdf-lib
11. Return merged PDF
```

### PDF Merge Strategy

Use **`pdf-lib`** (already likely in the dependency tree via react-pdf; if not, add it):

```ts
import { PDFDocument } from "pdf-lib";

// Load original petition PDF
const originalDoc = await PDFDocument.load(originalPdfBytes);

// Generate signature pages PDF via @react-pdf/renderer
const sigPageBuffer = await renderSignaturePagesToBuffer(signatories);
const sigPageDoc = await PDFDocument.load(sigPageBuffer);

// Merge: copy all pages from sigPageDoc into originalDoc
const copiedPages = await originalDoc.copyPages(sigPageDoc, sigPageDoc.getPageIndices());
copiedPages.forEach((p) => originalDoc.addPage(p));

const mergedBytes = await originalDoc.save();
```

### Signature Images in the PDF

Each signature image (PNG) is fetched from Supabase storage as a `Uint8Array` and embedded in the react-pdf `<Image>` component using a base64 data URL:

```ts
const imageBytes = await supabase.storage.from("petition-signatures").download(sig.signatureUrl);
const base64 = Buffer.from(await imageBytes.data.arrayBuffer()).toString("base64");
const dataUrl = `data:image/png;base64,${base64}`;
// → pass to <Image src={dataUrl} /> in react-pdf
```

Signatures that fail to fetch (deleted/missing) should fall back to a placeholder text "Signature unavailable" rather than failing the whole request.

---

## UI Changes — Admin Petition Detail Page

**File:** `src/app/admin/petitions/[petitionId]/page.tsx`

### New Button: "Signed Doc"

Location: The **Signatures tab** content, next to the existing "Download Report" button.

```
[ 2 signatures ]                    [ Download Report ] [ Signed Doc ]
```

Conditions to show the button (same as "Download Report"):

- `petition.status` is `PUBLISHED`, `SUBMITTED`, or `CLOSED`
- `petition.documentUrl` is not null (original document exists)
- `signatureCount > 0`

The button is disabled with a loading spinner while the download is in progress.

### Handler

```ts
async function handleDownloadSignedDoc() {
  try {
    const blob = await downloadSignedDoc(societyId, petitionId);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `signed-doc-${petitionId}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Failed to download signed document");
  }
}
```

---

## Service Function

**File:** `src/services/petitions.ts`

```ts
export async function downloadSignedDoc(societyId: string, petitionId: string) {
  const res = await fetch(`/api/v1/societies/${societyId}/petitions/${petitionId}/signed-doc`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || "Failed to download signed document");
  }
  return res.blob();
}
```

---

## New Files to Create

```
src/app/api/v1/societies/[id]/petitions/[petitionId]/
  signed-doc/
    route.ts                  ← new API route
    signature-page-document.tsx  ← react-pdf component for signature pages
```

---

## Dependencies

| Package               | Purpose                              | Already installed? |
| --------------------- | ------------------------------------ | ------------------ |
| `pdf-lib`             | Merge original PDF + signature pages | **No — add**       |
| `@react-pdf/renderer` | Render signature pages PDF           | Yes                |

Add `pdf-lib`:

```bash
npm install pdf-lib
```

---

## Error Cases & Guards

| Condition                              | HTTP | Error Code                   |
| -------------------------------------- | ---- | ---------------------------- |
| Not authenticated as admin             | 401  | —                            |
| Petition not found / wrong society     | 404  | —                            |
| Petition has no uploaded document      | 400  | `NO_DOCUMENT`                |
| Petition has no signatures             | 400  | `NO_SIGNATURES`              |
| Supabase fetch fails for original PDF  | 500  | —                            |
| Individual signature image fetch fails | —    | Graceful fallback (no crash) |

---

## Signature Page Component Design (`signature-page-document.tsx`)

```tsx
// Props
interface SignaturePageDocProps {
  societyName: string;
  petition: {
    title: string;
    type: string;
    targetAuthority: string | null;
    submittedAt: Date | null;
  };
  generatedAt: string;
  signatories: {
    name: string;
    unit: string;
    method: string;
    signedAt: Date;
    signatureDataUrl: string | null; // base64 data URL or null if unavailable
  }[];
}
```

Layout per row:

- Fixed-height row (e.g., 60pt) so signatures are consistently sized
- Signature image: max 120×40pt (landscape signature fits well)
- If `signatureDataUrl` is null, show italic grey text "Unavailable"

Pagination: react-pdf handles this automatically via `<Page>` wrapping — no manual page-break logic needed.

---

## Signature Revocation Policy

- **Residents cannot revoke their own signature.** Once signed, the signature is permanent from the resident's side. The "Revoke Signature" button and the resident `DELETE /sign` API endpoint have been removed.
- **Only RWA Admin can delete a signature** via the existing admin UI (Trash icon in the Signatures tab → `DELETE /societies/[id]/petitions/[petitionId]/signatures/[signatureId]`).
- **After admin deletion, the resident can sign again** — the signing flow allows re-submission if no existing signature is found.

---

## Out of Scope for This Plan

- Consent stored in DB (not needed — the `signedAt` timestamp is sufficient)
- Email/WhatsApp notification on "Signed Doc" download
- Watermarking the original PDF pages
- Signature verification / audit trail beyond what already exists

---

## Test Plan

### Unit Tests (API route)

- Returns 401 for non-admin
- Returns 404 if petition not found
- Returns 400 `NO_DOCUMENT` if `documentUrl` is null
- Returns 400 `NO_SIGNATURES` if no signatures
- Returns 200 `application/pdf` on success
- Gracefully handles missing signature images (returns PDF, not 500)
- Returns 500 on Supabase storage failure for original PDF

### Unit Tests (UI — `page.tsx`)

- "Signed Doc" button is visible when `documentUrl` is set and signatures exist
- "Signed Doc" button is hidden when `documentUrl` is null
- Clicking "Signed Doc" calls `downloadSignedDoc` and triggers a download
- Error toast shown if `downloadSignedDoc` throws

### Unit Tests (Resident consent — `r/petitions/page.tsx`)

- Consent checkbox is shown when `signMode` is not null
- Signature pad is disabled until checkbox is ticked
- Signature pad is enabled after checkbox is ticked
- Consent checkbox resets to unchecked when signing is cancelled
- "Revoke Signature" button is NOT shown after signing (admin-only deletion)
- Already-signed state shows the signed date with no action button
