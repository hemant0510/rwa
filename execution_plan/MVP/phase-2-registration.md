# MVP Phase 2 — Resident Registration & RWAID

**Duration**: ~2 weeks
**Goal**: Residents self-register via Society Code. Admins approve. RWAID card auto-generated.
**Depends on**: Phase 1 (society + admin exist)

---

## Task 2.1 — Public Registration Page

### Backend

- API: `GET /api/v1/societies/by-code/[code]` — validates code, returns society name + type
- API: `POST /api/v1/residents/register` — creates pending registration
- Upload: `POST /api/v1/upload/id-proof` — uploads to Supabase Storage (private bucket)

### UI Screen: `/register/[societyCode]`

**Step 1 — Society Code Verification** (also accessible at `/register` with manual entry):

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│          [RWA Connect Logo]                          │
│                                                      │
│     Join Your Society                                │
│                                                      │
│     Enter your Society Code                          │
│     ┌──────────────────────────────────┐            │
│     │ EDENESTATE                       │            │
│     └──────────────────────────────────┘            │
│     Ask your RWA Admin for this code                 │
│                                                      │
│     [Verify →]                                       │
│                                                      │
│     ─────────────────────────────────                │
│     Don't have a code? Contact your                  │
│     society's RWA committee.                         │
│                                                      │
└─────────────────────────────────────────────────────┘
```

On valid code → Shows society name confirmation:

```
  ✓ Eden Estate Resident Welfare Association
    Gurgaon, Haryana
    [Continue to Registration →]
```

On invalid code → Error: "Society code not found. Please check with your RWA admin."

**Security**: No society information is exposed until valid code entered (prevents enumeration).

---

**Step 2 — Registration Form** (dynamic fields based on society type):

```
┌─────────────────────────────────────────────────────┐
│  Register for Eden Estate RWA                        │
│  ─────────────────────────────────────────────────── │
│                                                      │
│  Full Name *                                         │
│  ┌──────────────────────────────────────────────┐   │
│  │                                              │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  Mobile Number (WhatsApp) *                          │
│  ┌──────────────────────────────────────────────┐   │
│  │ +91                                          │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ── Your Address ──────────────────────────────────  │
│  (Dynamic fields based on society type)              │
│                                                      │
│  [FOR INDEPENDENT SECTOR:]                           │
│  House No. *              Street / Gali No.          │
│  ┌────────────────┐      ┌───────────────────┐      │
│  │ 245            │      │ Street 7           │      │
│  └────────────────┘      └───────────────────┘      │
│  Sector / Block                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ Sector 22                                    │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  [FOR APARTMENT:]                                    │
│  Tower/Block *     Floor No. *     Flat No. *        │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐      │
│  │ B        │    │ 12       │    │ 1204     │      │
│  └──────────┘    └──────────┘    └──────────┘      │
│                                                      │
│  [FOR BUILDER FLOOR:]                                │
│  House No. *       Floor *                           │
│  ┌──────────┐    ┌─────────────────────────┐        │
│  │ 42       │    │ First Floor (1F) ▾      │        │
│  └──────────┘    └─────────────────────────┘        │
│                                                      │
│  [FOR GATED VILLAS:]                                 │
│  Villa No. *       Street / Phase                    │
│  ┌──────────┐    ┌───────────────────┐              │
│  │ 17       │    │ Phase 2           │              │
│  └──────────┘    └───────────────────┘              │
│                                                      │
│  [FOR PLOTTED COLONY:]                               │
│  Plot No. *        Lane No.         Phase            │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐      │
│  │ 89       │    │ Lane 4   │    │          │      │
│  └──────────┘    └──────────┘    └──────────┘      │
│                                                      │
│  I am a: *                                           │
│  (●) Owner    (○) Tenant                             │
│                                                      │
│  ── Optional ──────────────────────────────────────  │
│                                                      │
│  Email                                               │
│  ┌──────────────────────────────────────────────┐   │
│  │                                              │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  Photo ID (Aadhaar / Voter ID / Passport)            │
│  ┌──────────────────────────────────────────────┐   │
│  │  [Choose File]   No file chosen              │   │
│  └──────────────────────────────────────────────┘   │
│  PDF, JPG or PNG. Max 5MB.                           │
│                                                      │
│  Secondary Mobile                                    │
│  ┌──────────────────────────────────────────────┐   │
│  │                                              │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  [✓] I consent to receive WhatsApp notifications     │
│      from RWA Connect for society communications *   │
│                                                      │
│  [Submit Registration →]                             │
└─────────────────────────────────────────────────────┘
```

**Step 3 — Confirmation**:

```
┌─────────────────────────────────────────────────────┐
│                                                      │
│     ✓ Registration Submitted!                        │
│                                                      │
│     Your registration for Eden Estate RWA            │
│     is pending admin approval.                       │
│                                                      │
│     You'll receive a WhatsApp notification           │
│     once approved.                                   │
│                                                      │
│     [Back to Home]                                   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Components to build**:

- `SocietyCodeVerifier` — Code input with verify button + society confirmation display
- `DynamicUnitFields` — Renders different address fields based on `society.type`
- `FileUploadInput` — Drag-and-drop or click, with preview, 5MB limit, type validation
- `RegistrationForm` — Full form using React Hook Form + Zod
- `RegistrationConfirmation` — Success state with WhatsApp info

**Acceptance**: Full flow works for all 5 society types. Dynamic fields render correctly. File upload works. Confirmation shown.

---

## Task 2.2 — Registration Edge Cases

| Edge Case                           | Detection                       | UI Behavior                                                              |
| ----------------------------------- | ------------------------------- | ------------------------------------------------------------------------ |
| **Duplicate mobile (same society)** | Check `users` table             | Toast error: "This mobile number is already registered in this society." |
| **Duplicate mobile (diff society)** | No check needed                 | Allowed — one person can be in multiple societies                        |
| **Blacklisted mobile**              | Check `blacklisted_numbers`     | Generic error: "Unable to process registration. Contact admin."          |
| **Invalid society code**            | Code lookup fails               | "Society code not found. Please check with your RWA admin."              |
| **Society suspended**               | Society status check            | "This society is currently unavailable. Contact your RWA admin."         |
| **File too large (>5MB)**           | Client-side check               | Inline error under upload: "File must be under 5MB"                      |
| **Invalid file type**               | Client-side + server MIME check | Inline error: "Only PDF, JPG, and PNG files accepted"                    |

**Acceptance**: All 7 edge cases handled gracefully with user-friendly messages.

---

## Task 2.3 — Admin Approval/Rejection Workflow

### Backend

- API: `GET /api/v1/residents?status=PENDING` — list pending registrations
- API: `PATCH /api/v1/residents/[id]/approve` — approve + trigger RWAID generation
- API: `PATCH /api/v1/residents/[id]/reject` — reject with reason

### UI Screen: `/admin/residents` (with pending tab)

```
┌─────────────────────────────────────────────────────────┐
│  Residents                                               │
│  ─────────────────────────────────────────────────────── │
│  [All (42)]  [Pending Approval (3)]  [Active (39)]       │
│                                                          │
│  ── Pending Approval ───────────────────────────────    │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Raj Kumar                        Registered 2h ago│ │
│  │  📱 9876543210  🏠 House 245, St 7, S22  Owner    │ │
│  │  [View ID Proof]                                   │ │
│  │                                                    │ │
│  │  [✓ Approve]                    [✗ Reject ▾]      │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  Priya Sharma                     Registered 1d ago│ │
│  │  📱 8765432109  🏠 House 112, St 3, S22  Tenant   │ │
│  │  [No ID Proof uploaded]                            │ │
│  │                                                    │ │
│  │  [✓ Approve]                    [✗ Reject ▾]      │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

**Rejection dropdown reasons**:

- Not a resident of this society
- Duplicate entry
- Incorrect information
- Under verification

```
┌─────────────────────────────────────┐
│  Reject Registration                │
│  ─────────────────────────────────  │
│                                      │
│  Reason *                            │
│  ┌──────────────────────────────┐   │
│  │ Not a resident of this...  ▾ │   │
│  └──────────────────────────────┘   │
│                                      │
│  Resident will be notified via       │
│  WhatsApp with this reason.          │
│                                      │
│          [Cancel]  [Confirm Reject]  │
└─────────────────────────────────────┘
```

**Components to build**:

- `PendingRegistrationCard` — Card with resident info, ID proof viewer, action buttons
- `RejectDialog` — Dialog with reason dropdown
- `ResidentTabs` — Tab navigation: All / Pending / Active
- `IDProofViewer` — Image/PDF viewer dialog for uploaded ID proof

**Acceptance**: Pending registrations listed. Approve triggers RWAID. Reject requires reason. WhatsApp sent for both outcomes.

---

## Task 2.4 — RWAID Generation

### Backend (trigger: on approval)

**Format**: `RWA-[STATE]-[CITY3]-[PINCODE]-[SOCIETYSEQ]-[YEAR]-[RESIDENTSEQ]`

**Logic**:

```typescript
async function generateRWAID(societyId: string): Promise<string> {
  const society = await getSociety(societyId);
  // society.society_id = "RWA-HR-GGN-122001-0001"
  const year = new Date().getFullYear(); // 2025
  const count = (await countApprovedResidents(societyId)) + 1;
  const seq = String(count).padStart(4, "0"); // "0089"
  return `${society.society_id}-${year}-${seq}`;
  // Result: "RWA-HR-GGN-122001-0001-2025-0089"
}
```

**Short Display ID**: Last segment `#0089` — used in UI, WhatsApp, verbal reference.

**Unit creation logic** (on approval):

1. Check if unit exists with same address in society
2. If exists + same owner: link as joint owner (flag for admin review)
3. If exists + different person: create separate user-unit link
4. If new: create unit record with display_label based on society type

**Display label generation**:
| Type | Input | Display Label |
|------|-------|---------------|
| Apartment | Tower B, Floor 12, Flat 1204 | `B-12-1204` |
| Builder Floor | House 42, First Floor | `42-1F` |
| Gated Villa | Villa 17, Phase 2 | `Villa-17-P2` |
| Independent Sector | House 245, Street 7, Sector 22 | `S22-St7-H245` |
| Plotted Colony | Plot 89, Lane 4 | `Plot-89-L4` |

**Acceptance**: RWAID generated correctly for all society types. Short ID shown in UI. Unit record created with correct display label.

---

## Task 2.5 — RWAID Digital Card (PDF)

### Backend

- API: `GET /api/v1/residents/[id]/rwaid-card` — generates and returns PDF
- Signed URL for public access: `GET /api/v1/rwaid/[signed-token]`

### UI: Card preview on resident profile + download button

**Card PDF layout** (A6 size, landscape):

```
┌──────────────────────────────────────────────┐
│  Eden Estate Resident Welfare Association      │
│  RWA-HR-GGN-122001-0001                        │
│ ──────────────────────────────────────────── │
│                                                │
│  ┌────────┐   Raj Kumar                        │
│  │ [Photo]│   House 245, St 7, Sector 22       │
│  │   or   │   Owner                             │
│  │silhouet│                                     │
│  └────────┘   #0089                             │
│               RWA-HR-GGN-122001-0001-2025-0089  │
│                                                │
│  Status: Active          ┌──────────┐          │
│  Since: March 2026       │ [QR Code]│          │
│                          │          │          │
│                          └──────────┘          │
│                          Scan to verify         │
│ ──────────────────────────────────────────── │
│  Powered by RWA Connect                        │
└──────────────────────────────────────────────┘
```

**QR Code encodes**: `https://rwaconnect.in/rwaid/[signed-token]`

- Signed token = JWT with `{ rwaid, societyId }`, expires in 365 days
- Public verify page shows: Name, Unit, Society, Status (no login required)

**Components to build**:

- `RWAIDCardPDF` — `@react-pdf/renderer` document component
- `RWAIDCardPreview` — In-browser card preview (HTML version)
- `DownloadCardButton` — Triggers PDF generation + download
- `ShareCardButton` — Copies shareable URL or triggers WhatsApp share

### UI on Resident Home (`/resident/home`):

```
┌─────────────────────────────────────────────────┐
│  Eden Estate RWA                                 │
│ ─────────────────────────────────────────────── │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │          [RWAID Card Preview]               │ │
│  │          (Rendered HTML version)            │ │
│  │                                             │ │
│  │  Raj Kumar            #0089                 │ │
│  │  House 245, St 7, Sector 22                │ │
│  │  Owner   |   Active                        │ │
│  │                                             │ │
│  └────────────────────────────────────────────┘ │
│  [Download PDF]  [Share via WhatsApp]            │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │  Fee Status: Session 2025-2026              │ │
│  │  Status: Pending    Amount Due: ₹2,200      │ │
│  └────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

**Acceptance**: PDF generates with all fields including QR. QR scans to public verify page. WhatsApp share works. Card regenerates when profile changes.

---

## Task 2.6 — Admin Resident Directory

### UI Screen: `/admin/residents`

```
┌──────────────────────────────────────────────────────────┐
│  Residents (42)                                          │
│  ─────────────────────────────────────────────────────── │
│  Search: [________________]                               │
│  Filter: Status [All ▾]  Fee [All ▾]  Type [All ▾]      │
│                                                           │
│  ┌──────────────────────────────────────────────────────┐│
│  │ Name         │ Unit        │ Type  │ Fee    │ RWAID  ││
│  │──────────────│─────────────│───────│────────│────────││
│  │ Raj Kumar    │ S22-St7-H245│ Owner │ 🟢Paid │ #0089  ││
│  │ Priya Sharma │ S22-St3-H112│ Tenant│ 🟡Pend │ #0091  ││
│  │ Amit Singh   │ S22-St7-H246│ Owner │ 🔴Over │ #0045  ││
│  │ ...          │             │       │        │        ││
│  └──────────────────────────────────────────────────────┘│
│  Showing 1-20 of 42              [← Prev] [1] [2] [Next →]│
└──────────────────────────────────────────────────────────┘
```

**Click row → Resident detail page** (`/admin/residents/[id]`):

```
┌─────────────────────────────────────────────────────────┐
│  ← Back                                                  │
│                                                          │
│  Raj Kumar                              #0089            │
│  RWA-HR-GGN-122001-0001-2025-0089       Owner            │
│  ─────────────────────────────────────────────────────── │
│                                                          │
│  Unit: House 245, Street 7, Sector 22                    │
│  Mobile: 9876543210                                      │
│  Email: raj@example.com                                  │
│  Registered: 15 Mar 2026                                 │
│  WhatsApp Consent: ✓ Yes                                 │
│                                                          │
│  ── Fee History ─────────────────────────────────────── │
│  Session 2025-26: 🟢 Paid (₹2,200) — 20 Apr 2025       │
│    [View Receipt]                                        │
│                                                          │
│  ── Actions ─────────────────────────────────────────── │
│  [Record Payment]  [Download RWAID Card]  [Deactivate]   │
└─────────────────────────────────────────────────────────┘
```

**Components to build**:

- `ResidentDirectoryTable` — DataTable with sort, search, filter, pagination
- `ResidentDetailPage` — Full profile with fee history and actions
- `FeeStatusBadge` — Color-coded badge (green/yellow/orange/red/blue)
- `ResidentFilters` — Filter bar: status, fee status, ownership type

**Acceptance**: All residents listed. Search by name/mobile/unit/RWAID works. Filters work. Detail page shows full info.

---

## Phase 2 Definition of Done

- [ ] Public registration page works for all 5 society types
- [ ] Dynamic address fields render correctly per society type
- [ ] 4 mandatory fields + optional fields all validate
- [ ] File upload (ID proof) works — size/type validated
- [ ] All 7 edge cases handled with clear error messages
- [ ] Admin sees pending registrations with approve/reject actions
- [ ] Rejection requires reason selection
- [ ] RWAID generated correctly on approval (format verified)
- [ ] Unit display labels correct for all 5 society types
- [ ] RWAID card PDF generates with QR code
- [ ] QR scans to public verification page
- [ ] Resident can download card + share via WhatsApp
- [ ] Admin resident directory: search, filter, sort, paginate
- [ ] Resident detail page shows profile + fee history + actions
- [ ] All screens responsive (360px mobile → 1280px desktop)
- [ ] WhatsApp sent on registration submit, approval, and rejection
