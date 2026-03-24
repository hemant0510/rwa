# MVP Phase 1 — Super Admin Portal & Society Onboarding

**Duration**: ~1.5 weeks
**Goal**: Super Admin can onboard societies and activate admins. (QR poster generation deferred to Phase 2.)
**Depends on**: Phase 0

---

## Task 1.1 — Super Admin Dashboard

### Backend

- API: `GET /api/v1/super-admin/stats`
- Aggregates: Total societies, Active, Suspended, Trial count
- Recent activity: Last 10 society onboarding events

### UI Screen: `/super-admin/dashboard`

```
┌─────────────────────────────────────────────────────┐
│  [Sidebar]  │  RWA Connect — Super Admin             │
│             │─────────────────────────────────────────│
│  Dashboard  │                                         │
│  Societies  │  ┌──────────┐ ┌──────────┐ ┌─────────┐ │
│  Settings   │  │ Total: 3 │ │ Active: 2│ │Trial: 1 │ │
│             │  └──────────┘ └──────────┘ └─────────┘ │
│             │                                         │
│             │  Recent Activity                        │
│             │  ─────────────────────────              │
│             │  • Eden Estate onboarded — 2 days ago   │
│             │  • Admin activated for Green Valley      │
│             │  • New resident pending (DLF Phase 4)   │
│             │                                         │
│             │  [+ Onboard New Society]                │
└─────────────┴─────────────────────────────────────────┘
```

**Components to build**:

- `StatCard` — Reusable stat card (icon, label, value, optional trend)
- `ActivityFeed` — Chronological event list with relative timestamps
- Use shadcn `Card`, `Badge`

**Acceptance**: Dashboard loads with real data from seed. Stat cards clickable to filtered list. Activity feed shows latest events.

---

## Task 1.2 — Society Onboarding Form

### Backend

- API: `POST /api/v1/societies`
- Society ID generation: `RWA-[STATE]-[CITY3]-[PINCODE]-[SEQ]`
  - SEQ = count existing societies with same pincode + 1, zero-padded to 4 digits
- Society Code: Admin-chosen, 4-8 alphanumeric, uppercase
  - Real-time uniqueness check: `GET /api/v1/societies/check-code?code=DLFP4`
- ~~Auto-generate QR code poster PDF after creation~~ (deferred to Phase 2)

### UI Screen: `/super-admin/societies/new`

**Multi-step wizard form** (3 steps):

#### Step 1: Society Details

```
┌─────────────────────────────────────────────────────┐
│  Onboard New Society                    Step 1 of 3 │
│  ─────────────────────────────────────────────────── │
│                                                      │
│  Society Name *                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ Eden Estate Resident Welfare Association      │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  State *              City *            Pincode *    │
│  ┌─────────────┐   ┌──────────────┐  ┌──────────┐  │
│  │ HR ▾        │   │ Gurgaon      │  │ 122001   │  │
│  └─────────────┘   └──────────────┘  └──────────┘  │
│                                                      │
│  Society Type *                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │ Select Type...                    ▾           │   │
│  └──────────────────────────────────────────────┘   │
│  Options:                                            │
│  • Apartment Complex — Tower/Block + Floor + Flat    │
│  • Builder Floors — House No + Floor Level           │
│  • Gated Community (Villas) — Villa No + Street      │
│  • Independent Sector — House No + Street + Sector   │
│  • Plotted Colony — Plot No + Lane + Phase            │
│  ℹ This determines the address fields for residents  │
│                                                      │
│  Society Code *                ✓ Available            │
│  ┌──────────────────────────┐                        │
│  │ EDENESTATE               │  (checked in real-time)│
│  └──────────────────────────┘                        │
│  4-8 characters, letters & numbers only              │
│                                                      │
│                                       [Next →]       │
└─────────────────────────────────────────────────────┘
```

#### Step 2: Fee Configuration

```
┌─────────────────────────────────────────────────────┐
│  Fee Configuration                      Step 2 of 3 │
│  ─────────────────────────────────────────────────── │
│                                                      │
│  One-time Joining Fee (₹) *                          │
│  ┌────────────────┐                                  │
│  │ 1,000          │  Charged once at first join      │
│  └────────────────┘                                  │
│                                                      │
│  Annual Membership Fee (₹) *                         │
│  ┌────────────────┐                                  │
│  │ 1,200          │  ₹100/month (auto-calculated)    │
│  └────────────────┘                                  │
│                                                      │
│  Session Period: April 1 — March 31                  │
│  Grace Period: 15 days (until April 15)              │
│                                                      │
│  Pro-rata preview (if resident joins today):         │
│  ┌──────────────────────────────────────────────┐   │
│  │ Joining Fee: ₹1,000                           │   │
│  │ + Pro-rata (8 months remaining): ₹800         │   │
│  │ = Total first payment: ₹1,800                 │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│                              [← Back]  [Next →]      │
└─────────────────────────────────────────────────────┘
```

#### Step 3: Admin Account

```
┌─────────────────────────────────────────────────────┐
│  Primary Admin Setup                    Step 3 of 3 │
│  ─────────────────────────────────────────────────── │
│                                                      │
│  Admin Full Name *                                   │
│  ┌──────────────────────────────────────────────┐   │
│  │ Hemant Kumar                                  │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  Admin Email *                                       │
│  ┌──────────────────────────────────────────────┐   │
│  │ hemant@edenestate.in                          │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  Admin Mobile (optional, for WhatsApp)               │
│  ┌──────────────────────────────────────────────┐   │
│  │ 9876543210                                    │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  Summary                                             │
│  ┌──────────────────────────────────────────────┐   │
│  │ Society: Eden Estate RWA                      │   │
│  │ ID: RWA-HR-GGN-122001-0001                   │   │
│  │ Code: EDENESTATE                              │   │
│  │ Type: Independent Sector                      │   │
│  │ Fees: ₹1,000 joining + ₹1,200 annual         │   │
│  │ Admin: Hemant Kumar (hemant@edenestate.in)    │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│                        [← Back]  [Create Society]    │
└─────────────────────────────────────────────────────┘
```

**Components to build**:

- `SocietyOnboardingWizard` — Multi-step form with progress indicator
- `SocietyCodeInput` — Input with real-time uniqueness check (debounced API call)
- `ProRataPreview` — Live calculation display based on current fee inputs
- `StepIndicator` — Step 1/2/3 progress dots
- Use shadcn `Form`, `Input`, `Select`, `Button`, `Card`

**Post-creation actions**:

1. Society record created in DB
2. Admin user created in `users` table with `role = RWA_ADMIN`, `permission = FULL_ACCESS`
3. Supabase Auth account created with admin email + temporary password
4. Welcome email sent to admin with login credentials / password-set link
5. Redirect to society detail page with success toast

**Acceptance**: Society created in < 5 minutes. Society ID generated correctly. Code uniqueness validated. Admin receives welcome email.

---

## Task 1.3 — ~~Society Code QR Poster~~ (DEFERRED to Phase 2)

> **v2 change**: Society Code QR poster generation is deferred to Phase 2. In MVP, registration is via invite-link only (no Society Code self-registration Path B). The Society Code is still created and stored, but no QR poster is generated.

No tasks for this section in MVP v1.

---

## Task 1.4 — Society List & Detail

### Backend

- API: `GET /api/v1/societies` (paginated, filterable)
- API: `GET /api/v1/societies/[id]` (detail with stats)

### UI Screen: `/super-admin/societies`

```
┌─────────────────────────────────────────────────────────┐
│  Societies                           [+ Onboard New]    │
│  ─────────────────────────────────────────────────────── │
│  Search: [________________]   Status: [All ▾]           │
│                                                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Name              │ Code      │ Type    │ Status   │  │
│  │───────────────────│───────────│─────────│──────────│  │
│  │ Eden Estate RWA   │ EDENESTATE│ Sector  │ 🟢Active │  │
│  │ DLF Phase 4       │ DLFP4     │ Apartment│ 🟢Active│  │
│  │ Green Valley      │ GRNVLY    │ Villa   │ 🟡Trial  │  │
│  └───────────────────────────────────────────────────┘  │
│  Showing 1-3 of 3                                        │
└─────────────────────────────────────────────────────────┘
```

### UI Screen: `/super-admin/societies/[id]`

```
┌─────────────────────────────────────────────────────────┐
│  ← Back to Societies                                     │
│                                                          │
│  Eden Estate RWA                          🟢 Active      │
│  RWA-HR-GGN-122001-0001                                  │
│  ─────────────────────────────────────────────────────── │
│                                                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐       │
│  │ Residents:42│ │ Fees: 78%   │ │ Balance:    │       │
│  │ (3 pending) │ │ collected   │ │ ₹38,400     │       │
│  └─────────────┘ └─────────────┘ └─────────────┘       │
│                                                          │
│  Society Details          Admin Team                     │
│  ──────────────          ──────────                     │
│  Code: EDENESTATE        Primary: Hemant Kumar           │
│  Type: Ind. Sector       Mobile: 98765xxxxx              │
│  Pincode: 122001         Term: Active                    │
│  Joining Fee: ₹1,000                                     │
│  Annual Fee: ₹1,200      Supporting: (none)              │
│                                                          │
│  [Generate Invite Link] [Activate Admin] [Edit Society]  │
└─────────────────────────────────────────────────────────┘
```

**Components to build**:

- `SocietyListTable` — DataTable with search, filter, pagination
- `SocietyDetailCard` — Profile card with all society fields
- `AdminTeamCard` — Shows active admins with term info
- `SocietyStatsRow` — Row of StatCards for society metrics

**Acceptance**: All societies listed. Search/filter works. Detail page shows all info. Actions accessible.

---

## Task 1.5 — Admin Activation Flow

### Backend

- API: `POST /api/v1/societies/[id]/admins` (create admin)
- Validates: max 1 Primary + max 1 Supporting per society (MVP limit)
- Creates user record (if new) or upgrades existing resident

### UI: Modal/Sheet from society detail page

```
┌─────────────────────────────────────────┐
│  Activate Admin                         │
│  ────────────────────────────────────── │
│                                          │
│  Role *                                  │
│  (●) Primary Admin (Full Access)         │
│  (○) Supporting Admin (Read + Notify)    │
│                                          │
│  Search Existing Resident                │
│  ┌─────────────────────────────┐        │
│  │ Search by name or mobile... │        │
│  └─────────────────────────────┘        │
│  No match? Create new:                   │
│                                          │
│  Full Name *                             │
│  ┌─────────────────────────────┐        │
│  │                             │        │
│  └─────────────────────────────┘        │
│  Email *                                 │
│  ┌─────────────────────────────┐        │
│  │                             │        │
│  └─────────────────────────────┘        │
│  Mobile (optional, for WhatsApp)         │
│  ┌─────────────────────────────┐        │
│  │                             │        │
│  └─────────────────────────────┘        │
│                                          │
│              [Cancel]  [Activate Admin]  │
└─────────────────────────────────────────┘
```

**Components to build**:

- `ActivateAdminSheet` — Sheet/dialog with form
- `ResidentSearchInput` — Autocomplete search across society residents

**Acceptance**: Existing resident promoted to admin. New admin created with email/password account. Welcome email sent. MVP limit of 1 Primary + 1 Supporting enforced.

---

## Phase 1 Definition of Done

- [ ] Super Admin dashboard shows stats with real data
- [ ] Society onboarding wizard: 3-step form with validation
- [ ] Society ID auto-generated correctly (format verified)
- [ ] Society Code: admin-chosen with real-time uniqueness check
- [ ] ~~QR poster PDF~~ (deferred to Phase 2)
- [ ] Invite link generation works for society registration
- [ ] Society list: search, filter by status, pagination
- [ ] Society detail: all fields, stats, admin team displayed
- [ ] Admin activation: search existing resident or create new
- [ ] Admin receives welcome email with login credentials on activation
- [ ] All UI responsive: works on desktop + tablet + mobile
- [ ] Loading skeletons on all data-fetching pages
- [ ] Empty states when no data (e.g., no societies yet)
