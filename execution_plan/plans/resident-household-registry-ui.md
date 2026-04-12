# Resident Household Registry — UI Build

## Context

The backend plan [resident-household-registry.md](./resident-household-registry.md) shipped all 8 groups ✅ but every UI section was labelled "UI already complete — skip during implementation". The claim was false — zero UI was built. This plan is the companion build for that missing UI.

**Scope**: only UI files and their tests. All APIs, services, validations, and types already exist on `feature/profile-resident`. Reference the backend plan for wireframe specs — this plan cites those specs by line number instead of duplicating them.

**What is intentionally NOT in scope:**

- Pet / domestic helper UI — Phase 2, separate plan
- Any API/service/validation changes (all exist)
- Migration work (already applied — see `/db-change` run on 2026-04-13)

---

## Assumptions (filesystem-verified 2026-04-13)

| Assumption                                                                      | Verified                                                                    |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Family APIs exist                                                               | `src/app/api/v1/residents/me/family/*`                                      |
| Vehicle APIs exist                                                              | `src/app/api/v1/residents/me/vehicles/*`                                    |
| Profile PATCH API exists (bloodGroup / household / vehicle)                     | `src/app/api/v1/residents/me/profile/`                                      |
| Profile summary API exists                                                      | `src/app/api/v1/residents/me/profile/summary/`                              |
| Admin vehicle search API exists                                                 | `src/app/api/v1/admin/vehicles/search/`                                     |
| Admin resident family/vehicle APIs exist                                        | `src/app/api/v1/residents/[id]/family,vehicles/`                            |
| Admin residents list API returns `familyCount` + `vehicleSummary` + `tier`      | `src/app/api/v1/residents/route.ts` (shipped — Groups 5 & 8G already ran)   |
| Services `family.ts`, `vehicles.ts`, `profile.ts`                               | `src/services/*.ts`                                                         |
| Group 6 data migration (`UPDATE users SET show_in_directory = true`)            | Ran as part of Group 1B; directory remains populated after opt-in filter    |
| `/r/profile/family/page.tsx`                                                    | **MISSING — to build**                                                      |
| `/r/profile/vehicles/page.tsx`                                                  | **MISSING — to build**                                                      |
| Feature component folders `components/features/{family,vehicles}/`              | **MISSING — to build**                                                      |
| Admin tabs on `/admin/residents/[id]/page.tsx`                                  | **MISSING — to extend** (existing page present, needs Family+Vehicles tabs) |
| `src/components/layout/ResidentSidebar.tsx` has nav items for Family / Vehicles | **MISSING — grep confirms zero references in the `navItems` array**         |
| `/admin/residents/page.tsx` renders family/vehicle count + completeness         | **MISSING — API returns the data, page does not render it**                 |

---

## Phase Split

```
Phase 1 — Resident Family UI            (/r/profile/family)
Phase 2 — Resident Vehicles UI          (/r/profile/vehicles)
Phase 3 — Profile Hub + Directory       (/r/profile, /r/directory extensions)
Phase 4 — Admin UI                      (/admin/residents/[id], /admin/residents)
```

Each phase ships independently via `/ship-phase`. Order matters only for Phase 3 (depends on Phases 1+2 data to render summary cards) and Phase 4 (independent, can run in parallel if needed).

---

## Component Inventory

All new; none exist today. Folder paths under `src/components/features/`.

| Component                       | Path                                   | Phase | Reused by                                    |
| ------------------------------- | -------------------------------------- | ----- | -------------------------------------------- |
| `FamilyMemberCard`              | `family/FamilyMemberCard.tsx`          | 1     | Phase 1, 4 (admin view)                      |
| `FamilyMemberDialog`            | `family/FamilyMemberDialog.tsx`        | 1     | Phase 1                                      |
| `RelationshipBadge`             | `family/RelationshipBadge.tsx`         | 1     | Phase 1, 4                                   |
| `EmergencyContactIndicator`     | `family/EmergencyContactIndicator.tsx` | 1     | Phase 1, 4                                   |
| `VehicleCard`                   | `vehicles/VehicleCard.tsx`             | 2     | Phase 2, 4                                   |
| `VehicleDialog`                 | `vehicles/VehicleDialog.tsx`           | 2     | Phase 2                                      |
| `RegistrationNumberInput`       | `vehicles/RegistrationNumberInput.tsx` | 2     | Phase 2                                      |
| `ExpiryBadge`                   | `vehicles/ExpiryBadge.tsx`             | 2     | Phase 2, 4                                   |
| `ProfileFamilyCard` (summary)   | `profile/ProfileFamilyCard.tsx`        | 3     | Phase 3                                      |
| `ProfileVehiclesCard` (summary) | `profile/ProfileVehiclesCard.tsx`      | 3     | Phase 3                                      |
| `ProfileCompletenessCard`       | `profile/ProfileCompletenessCard.tsx`  | 3     | Phase 3                                      |
| `DirectorySettingsCard`         | `profile/DirectorySettingsCard.tsx`    | 3     | Phase 3                                      |
| `DeclarationToggle`             | `profile/DeclarationToggle.tsx`        | 3     | Phase 3 (household + vehicle "none" toggles) |
| `ResidentFamilyTab`             | `admin/ResidentFamilyTab.tsx`          | 4     | Phase 4                                      |
| `ResidentVehiclesTab`           | `admin/ResidentVehiclesTab.tsx`        | 4     | Phase 4                                      |
| `VehicleSearchBar`              | `admin/VehicleSearchBar.tsx`           | 4     | Phase 4                                      |
| `CompletenessBadge`             | `admin/CompletenessBadge.tsx`          | 4     | Phase 4 (admin residents table)              |

---

## Phase 1 — Resident Family UI

**Goal**: Resident sees, adds, edits, and removes family members at `/r/profile/family`.

**Wireframe reference**: [resident-household-registry.md lines 670–677](./resident-household-registry.md#L670-L677) (Family list + dialog spec).

### Files

| Path                                                           | Type | Notes                                                                                                                                                  |
| -------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/app/r/profile/family/page.tsx`                            | New  | Client page, React Query, handles 15-limit banner                                                                                                      |
| `src/components/features/family/FamilyMemberCard.tsx`          | New  | Avatar, RelationshipBadge, DOB-computed age, blood group chip, emergency star, **sub-ID badge (`memberId` e.g. EDN-DLH-0042-M1)**, edit/remove actions |
| `src/components/features/family/FamilyMemberDialog.tsx`        | New  | RHF + `familyMemberSchema` (exists)                                                                                                                    |
| `src/components/features/family/RelationshipBadge.tsx`         | New  | Small enum-driven badge                                                                                                                                |
| `src/components/features/family/EmergencyContactIndicator.tsx` | New  | Star + priority label                                                                                                                                  |

### Page spec

`/r/profile/family` — top bar with "← Back to Profile" + "Add Member" CTA (disabled + tooltip when `dependents.length >= 15`). Grid of `FamilyMemberCard`. Empty state: illustration + "Add your first family member" CTA. The `FamilyMemberCard` renders the stable sub-ID (`EDN-DLH-<resident#>-M<n>`) so residents can cite it for gate passes / amenity cards per the Design Decision 1 spec.

### State machine

- **loading** → `<PageSkeleton />`
- **error** → error card with retry
- **empty** → empty-state CTA (0 members)
- **loaded** → card grid
- **limit-reached** → banner "15/15 members — remove one to add new"
- **dialog-open-create** / **dialog-open-edit** — dialog overlays grid
- **mutating** — disable CTAs, toast on success/failure

### Dialog form fields (backend-validated)

Name, Relationship (+ other-text when OTHER), DOB, Blood Group, Mobile, Email, Occupation, Photo (inline upload, optional), ID Proof (inline upload, optional), Emergency Contact toggle (+ Priority radio when ON), Medical Notes.

Photo + ID-proof uploads happen AFTER member is created (two-step — create → upload). In the dialog, show "Save & upload" pattern: on submit, create member, then upload selected files if any.

### Navigation wire-up

- Add link/card from `/r/profile/page.tsx` → `/r/profile/family` (see Phase 3 — Profile Hub extensions)

### Tests (95% per-file)

| Test file                                                             | Covers                                                                                                            |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `tests/app/r/profile/family/page.test.tsx`                            | loading, error, empty, grid, add→dialog→mutation, limit banner                                                    |
| `tests/components/features/family/FamilyMemberCard.test.tsx`          | render, age compute, emergency star, **sub-ID badge renders `memberId`**, edit/remove callbacks                   |
| `tests/components/features/family/FamilyMemberDialog.test.tsx`        | create flow, edit flow (prefill), RHF validation paths, conditional OTHER + priority fields, file-upload sequence |
| `tests/components/features/family/RelationshipBadge.test.tsx`         | every RelationshipType enum value renders correct label                                                           |
| `tests/components/features/family/EmergencyContactIndicator.test.tsx` | OFF, PRIMARY, SECONDARY states                                                                                    |

### Done when

- `/r/profile/family` reachable from `/r/profile` via link/card
- All 5 component files have test coverage ≥ 95% per-file
- `npm run build` succeeds
- Mutations invalidate React Query cache for `["family"]` and `["profile-summary"]` keys

---

## Phase 2 — Resident Vehicles UI

**Goal**: Resident registers, updates, deactivates vehicles at `/r/profile/vehicles`.

**Wireframe reference**: [resident-household-registry.md lines 806–813](./resident-household-registry.md#L806-L813) + expiry-status spec [line 642](./resident-household-registry.md#L642).

### Files

| Path                                                           | Type | Notes                                                                                                                                                                                                                              |
| -------------------------------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/r/profile/vehicles/page.tsx`                          | New  | Client page, paginated list                                                                                                                                                                                                        |
| `src/components/features/vehicles/VehicleCard.tsx`             | New  | **VehicleType icon**, reg number (normalised display), **make / model**, **colour chip**, **owner tag** (self / "Owned by: [dependent name]"), **parking slot**, 3 expiry badges (Insurance / PUC / RC), edit / deactivate actions |
| `src/components/features/vehicles/VehicleDialog.tsx`           | New  | RHF + `vehicleSchema` (exists)                                                                                                                                                                                                     |
| `src/components/features/vehicles/RegistrationNumberInput.tsx` | New  | Auto-uppercase + format mask                                                                                                                                                                                                       |
| `src/components/features/vehicles/ExpiryBadge.tsx`             | New  | Amber (≤30d), red (expired), neutral                                                                                                                                                                                               |

### Page spec

`/r/profile/vehicles` — top bar with "← Back to Profile" + "Add Vehicle" CTA. Card grid. Pagination (page size 10). On card: VehicleType icon, reg number, make/model, colour chip, owner tag (self / "Owned by: [dependent name]"), parking slot, 3 expiry badges (Insurance / PUC / RC). Edit / deactivate buttons.

### Dialog form fields

Reg Number (normalized, duplicate-check on blur), Vehicle Type (icon picker), Make, Model, Colour, Unit (auto when single, dropdown for multi-unit residents), Dependent Owner (self / family member), Parking Slot, Insurance / PUC / RC expiry dates, FASTag ID, Vehicle Photo, RC Doc, Insurance Doc, Notes.

Three-step upload: Save → upload photo if set → upload RC if set → upload insurance if set. Show progress toast per step.

### State machine

Same set as Phase 1 (loading / error / empty / loaded / dialog-open / mutating), plus:

- **dup-blocked** — 409 response surfaced as field-level error on reg number with message from API ("This vehicle is already registered by another resident (Unit B-204).")
- **limit-reached** — 422 from `maxVehiclesPerUnit` — banner shown if API returns this code

### Navigation wire-up

- Add link/card from `/r/profile/page.tsx` → `/r/profile/vehicles` (Phase 3)

### Tests

| Test file                                                             | Covers                                                                                                                   |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `tests/app/r/profile/vehicles/page.test.tsx`                          | loading, error, empty, grid, add→dialog→mutation, pagination, duplicate error                                            |
| `tests/components/features/vehicles/VehicleCard.test.tsx`             | render (icon, reg, make/model, colour chip, parking slot), expiry badges, dependent owner tag, edit/deactivate callbacks |
| `tests/components/features/vehicles/VehicleDialog.test.tsx`           | create, edit, validation, unit auto-select, file-upload sequence, dup error surfacing                                    |
| `tests/components/features/vehicles/RegistrationNumberInput.test.tsx` | uppercase, mask, paste handling                                                                                          |
| `tests/components/features/vehicles/ExpiryBadge.test.tsx`             | neutral, amber (30d), red (expired), null date                                                                           |

---

## Phase 3 — Profile Hub + Directory + Resident Layout Nav

**Goal**: Rebuild `/r/profile/page.tsx` to include family/vehicle summary cards, completeness card, blood-group + household + vehicle declarations, directory opt-in settings. Extend `/r/directory/page.tsx` for opt-in banner + vehicle search tab. Add Family + Vehicles nav entries to `/r/layout.tsx`.

**Wireframe references**:

- Profile hub (Group 7) — [lines 1100–1128](./resident-household-registry.md#L1100-L1128)
- Completeness card + scoring spec (Group 8) — [lines 1266–1299](./resident-household-registry.md#L1266-L1299) and [lines 1482–1491](./resident-household-registry.md#L1482-L1491)
- Directory opt-in (Group 6) — [lines 1048–1091](./resident-household-registry.md#L1048-L1091)
- Vehicle search tab (Group 4) — [lines 920–960](./resident-household-registry.md#L920-L960)
- Nav menu placement (Group 7 + original-plan Q4) — [line 1107](./resident-household-registry.md#L1107) and [line 1613](./resident-household-registry.md#L1613); resolved in this plan to flat top-level items.

### Files

| Path                                                          | Type   | Notes                                                                                                     |
| ------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------- |
| `src/app/r/profile/page.tsx`                                  | Extend | Add 5 new sections to existing 539-line page                                                              |
| `src/components/features/profile/ProfileFamilyCard.tsx`       | New    | Summary — count + emergency-contact mini-list + "View family →" link                                      |
| `src/components/features/profile/ProfileVehiclesCard.tsx`     | New    | Summary — count + first reg + upcoming expiry alerts + link                                               |
| `src/components/features/profile/ProfileCompletenessCard.tsx` | New    | % ring, tier badge (tier-specific colour), core items checklist, Extras/Bonus section, next-step CTA      |
| `src/components/features/profile/DirectorySettingsCard.tsx`   | New    | Two toggles, cascade rule enforcement                                                                     |
| `src/components/features/profile/DeclarationToggle.tsx`       | New    | Shared for household + vehicle "none" toggles                                                             |
| `src/app/r/directory/page.tsx`                                | Extend | Add opt-in banner + tab bar (People / Vehicles)                                                           |
| `src/components/features/directory/VehicleSearchTab.tsx`      | New    | Search input + result cards (name + unit + make/colour, NO phone)                                         |
| `src/components/layout/ResidentSidebar.tsx`                   | Extend | Append Family + Vehicles entries to the flat `navItems` array — see "Resident layout — nav entries" below |

### Profile hub — section order on `/r/profile/page.tsx`

The final page renders 7 top-level sections in this exact order. Sections 2 and 3 are existing blocks (unchanged); the rest are new.

1. **Completeness card** (NEW — top) — % ring + tier badge + "Next: add emergency contact" CTA. Tier colours per spec: Basic=gray (0–49%), Standard=amber (50–74%), Complete=blue (75–89%), Verified=green (90–100%). Shows core items checklist (9 items, A1/A2/A3/A4/B1/B2/C1/D1/E1) AND an "Extras" section for the 3 bonus items (WhatsApp notifications, directory appearance, emergency-contact blood group). `nextIncompleteItem` drives the CTA label and deep-link target.
2. **Profile card** (existing — unchanged) — photo, name, RWAID, designation, info grid.
3. **Documents card** (existing — unchanged) — ID Proof + Ownership Proof.
4. **Blood group dropdown** (NEW) — inline edit via `updateProfileDeclarations` (calls `PATCH /api/v1/residents/me/profile`).
5. **Family Members card** (NEW) — uses `ProfileFamilyCard`:
   - `familyCount > 0` → show count + top emergency contact + "View family →"
   - `familyCount === 0 && householdStatus === NOT_SET` → show `DeclarationToggle` ("I have no family members to add")
   - `familyCount === 0 && householdStatus === DECLARED_NONE` → show "You've declared no family members · Undo"
6. **Vehicles card** (NEW) — uses `ProfileVehiclesCard`: same 3-state pattern as family card, using `vehicleStatus` for the declaration toggle. When count > 0, also surfaces upcoming Insurance/PUC/RC expiry alerts from `/profile/summary`.
7. **Directory Settings card** (NEW) — two toggles (show in directory, show phone); enforce cascade rule: **when show-in-directory turns OFF, also force show-phone OFF and disable the phone toggle** (matches API behaviour at [line 1058](./resident-household-registry.md#L1058)).

### Resident layout — nav entries

Append two flat entries to the `navItems` array in [src/components/layout/ResidentSidebar.tsx](../../src/components/layout/ResidentSidebar.tsx) (this is the component `src/app/r/layout.tsx` renders — edit the sidebar, not the layout). The existing array is a flat list (Home / Payments / Expenses / Events / Petitions / Committee / Support / Directory / Profile); do not introduce a group concept. New entries:

```ts
{ href: "/r/profile/family", label: "Family", icon: Users },
{ href: "/r/profile/vehicles", label: "Vehicles", icon: Car },
```

Active-state styling inherits from the existing `NavLink` pattern used by every other entry. Lucide icons: `Users`, `Car`.

### Directory page — extensions

Add tab bar to `/r/directory/page.tsx` using the Tabs primitive (`src/components/ui/tabs.tsx`): `People` (existing list) and `Vehicles` (new search). Add opt-in banner at top of the People tab explaining that only opted-in residents are shown. Vehicle search tab: debounced input (min 3 chars), grid of result cards (unit label + resident name + make/colour, **no phone**). Single route, two views — the separate `/r/directory/vehicles/page.tsx` idea from Group 4 is dropped.

### State coordination

All 5 new profile cards read from `GET /api/v1/residents/me` (extended response already includes completeness + blood group + household/vehicle status). Invalidate the `["me"]` query key on every declaration mutation. Family/vehicle summary cards also read from `GET /api/v1/residents/me/profile/summary`.

### Tests

| Test file                                                            | Covers                                                                                                                                   |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `tests/app/r/profile/page.test.tsx`                                  | **Replace** existing test file: all 5 new sections + existing photo upload flow                                                          |
| `tests/components/features/profile/ProfileFamilyCard.test.tsx`       | 0 / 1 / many members; link; declaration mode when 0; emergency-contact mini-list                                                         |
| `tests/components/features/profile/ProfileVehiclesCard.test.tsx`     | 0 / 1 / many vehicles; link; declaration mode when 0; expiry-alert row                                                                   |
| `tests/components/features/profile/ProfileCompletenessCard.test.tsx` | BASIC / STANDARD / COMPLETE / VERIFIED rendering with correct colours; core items checklist; Extras section; nextIncompleteItem CTA link |
| `tests/components/features/profile/DirectorySettingsCard.test.tsx`   | both-off, directory-only-on, both-on, cascade rule (phone forced off & disabled when directory off)                                      |
| `tests/components/features/profile/DeclarationToggle.test.tsx`       | NOT_SET → DECLARED_NONE, HAS_ENTRIES (disabled) state                                                                                    |
| `tests/app/r/directory/page.test.tsx`                                | Extend existing: tab switching, vehicle search, opt-in banner                                                                            |
| `tests/components/features/directory/VehicleSearchTab.test.tsx`      | min-length guard, empty results, result card, privacy (no phone)                                                                         |
| `tests/components/layout/ResidentSidebar.test.tsx`                   | Extend existing: Family + Vehicles entries render in nav, active-state styling for each                                                  |

---

## Phase 4 — Admin UI

**Goal**: Admin sees family and vehicles on the resident detail page, searches by vehicle reg from the residents list, sees completeness badges.

**Wireframe references**:

- Admin resident-detail tabs (Group 5) — [lines 996–1018](./resident-household-registry.md#L996-L1018)
- Admin vehicle search (Group 4) — [lines 962–966](./resident-household-registry.md#L962-L966)
- Admin completeness (Group 8G) — [lines 1528–1553](./resident-household-registry.md#L1528-L1553)

### Files

| Path                                                    | Type   | Notes                                                                                                                                                                                      |
| ------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/app/admin/residents/[id]/page.tsx`                 | Extend | Add Family + Vehicles tabs alongside existing                                                                                                                                              |
| `src/components/features/admin/ResidentFamilyTab.tsx`   | New    | Read-only list; shows active AND inactive (inactive strikethrough); blood group column; emergency indicator; signed ID-proof "View" link                                                   |
| `src/components/features/admin/ResidentVehiclesTab.tsx` | New    | Read-only core fields + **inline editable**: parkingSlot, stickerNumber, evSlot, validFrom, validTo (via `PATCH /api/v1/admin/vehicles/[id]`); signed RC + insurance "View" links          |
| `src/app/admin/residents/page.tsx`                      | Extend | Render new `familyCount` + `vehicleSummary.count` + `vehicleSummary.firstReg` + `tier` (via `CompletenessBadge`) columns; add vehicle-search mode toggle; add completeness filter dropdown |
| `src/components/features/admin/VehicleSearchBar.tsx`    | New    | Toggle between "By name/email/phone" and "By vehicle" search modes                                                                                                                         |
| `src/components/features/admin/CompletenessBadge.tsx`   | New    | Tier badge for list + detail view (BASIC gray, STANDARD amber, COMPLETE blue, VERIFIED green)                                                                                              |

### Admin resident-detail — tab additions

Uses the existing `Tabs` primitive from [src/components/ui/tabs.tsx](../../src/components/ui/tabs.tsx) — the admin detail page already imports it for its current tabs; extend the existing `<TabsList>` with two new `<TabsTrigger value="family">` / `<TabsTrigger value="vehicles">` entries plus matching `<TabsContent>` blocks. Do not introduce a new tab component.

Current page has existing tabs (Overview / Fees / etc.). Add two new tabs:

- **Family** — `ResidentFamilyTab`: full dependent list (active + inactive with strikethrough), signed ID-proof links (1-hour signed URL from API), blood group column, emergency indicator. Read-only.
- **Vehicles** — `ResidentVehiclesTab`: full vehicle list, signed RC + insurance links. **Admin-editable fields inline** (parking slot, sticker number, EV slot, validFrom, validTo) via `PATCH /api/v1/admin/vehicles/[id]`. Registration number, owner, vehicle type, and document URLs are read-only (API rejects changes to those fields).

### Admin residents list — extensions

The API (`GET /api/v1/residents`) already returns `familyCount`, `vehicleSummary: {count, firstReg}`, `completenessScore`, and `tier` for every resident (shipped in Groups 5 and 8G). The page currently does not render them. Extensions:

- **New columns** on the residents table:
  - **Family** — `familyCount` badge (e.g. "3 members"); 0 renders as "—"
  - **Vehicles** — `vehicleSummary.count` badge + `firstReg` subtitle when count > 0; 0 renders as "—"
  - **Completeness** — `CompletenessBadge` driven by `tier` + `completenessScore`; sortable (client-side on `completenessScore`)
- **Search bar mode toggle**: "By Name / Email / Phone" vs "By Vehicle". Vehicle mode hits `/api/v1/admin/vehicles/search` and scopes the residents table to owners of matching vehicles.
- **Completeness filter dropdown**: All / Incomplete / Basic / Standard / Complete / Verified. Sends `?completeness=…` to the existing residents API (already supports the param).

### Tests

| Test file                                                      | Covers                                                                                                                            |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `tests/app/admin/residents/[id]/page.test.tsx`                 | Extend existing: new tabs render, lazy-load data on tab click                                                                     |
| `tests/components/features/admin/ResidentFamilyTab.test.tsx`   | loading, error, empty, active + inactive split, signed URLs                                                                       |
| `tests/components/features/admin/ResidentVehiclesTab.test.tsx` | read fields, inline edit for each editable field (parkingSlot, stickerNumber, evSlot, validFrom, validTo), forbidden-field gating |
| `tests/app/admin/residents/page.test.tsx`                      | Extend existing: family/vehicle count columns, completeness column, mode toggle, vehicle search filter, completeness filter       |
| `tests/components/features/admin/VehicleSearchBar.test.tsx`    | mode toggle, min-length guard, debounce                                                                                           |
| `tests/components/features/admin/CompletenessBadge.test.tsx`   | every tier renders correct colour + label                                                                                         |

---

## Cross-cutting concerns

### Shared patterns (do not re-invent per phase)

- **File upload**: use the existing `compressImage` util (`src/lib/utils/compress-image.ts`) — same pattern as profile photo upload on current `/r/profile`.
- **Signed URL display**: `ExternalLink` icon + "View" button pattern; never render the raw Supabase path.
- **Toast on mutation**: `toast.success` / `toast.error` via `sonner` (already used site-wide).
- **React Query keys**: `["family"]`, `["vehicles"]`, `["profile-summary"]`, `["me"]`, `["admin-resident", id]`, `["admin-vehicles", q]`.
- **Form pattern**: React Hook Form + `@hookform/resolvers/zod` + existing validation schemas. No new schemas.
- **Loading state**: `<PageSkeleton />` for full-page; inline spinner (Loader2) for partial.
- **Tabs**: use `Tabs / TabsList / TabsTrigger / TabsContent` from [src/components/ui/tabs.tsx](../../src/components/ui/tabs.tsx) — Radix-based primitive already in use in 5 pages (e.g. `src/app/sa/societies/[id]/page.tsx`, `src/app/admin/petitions/[petitionId]/page.tsx`). Do not build a new tab component.
- **Empty state**: wrap content in `<EmptyState>` from [src/components/ui/EmptyState.tsx](../../src/components/ui/EmptyState.tsx) with a Lucide icon sized `h-8 w-8 text-muted-foreground`. The component renders the icon in a muted rounded circle. Do not import custom illustrations; do not build new empty-state wrappers. Reference usage: `src/app/r/expenses/page.tsx:110`, `src/app/r/events/page.tsx:379`.

### Accessibility (applies to every new component)

- All dialogs: focus trap + ESC to close + aria-labelledby
- All forms: label + describedby for errors
- Icon-only buttons: aria-label
- Status badges: aria-label for screen readers (e.g. "Emergency contact, primary priority")

### coverage config

Every new `src/app/**` and `src/components/features/**` path in this plan must be added to `vitest.config.ts` `coverage.include` before the phase's quality gate runs. Already-included: `src/components/features/**` (glob covers new folders automatically). Check per-phase.

### Exclusions (files that may legitimately need vitest exclude)

None expected. All pages and components should be testable with jsdom + RTL.

---

## UI Pages Summary

| Path                    | Phase | Label  | Test file                                      |
| ----------------------- | ----- | ------ | ---------------------------------------------- |
| `/r/profile/family`     | 1     | New    | `tests/app/r/profile/family/page.test.tsx`     |
| `/r/profile/vehicles`   | 2     | New    | `tests/app/r/profile/vehicles/page.test.tsx`   |
| `/r/profile`            | 3     | Extend | `tests/app/r/profile/page.test.tsx`            |
| `/r/directory`          | 3     | Extend | `tests/app/r/directory/page.test.tsx`          |
| `/r/layout.tsx`         | 3     | Extend | `tests/app/r/layout.test.tsx`                  |
| `/admin/residents/[id]` | 4     | Extend | `tests/app/admin/residents/[id]/page.test.tsx` |
| `/admin/residents`      | 4     | Extend | `tests/app/admin/residents/page.test.tsx`      |

---

## Resolved Decisions

All 5 questions from the earlier revision are now closed. The plan is immediately executable.

| #   | Decision                 | Resolution                                                                                                                                       |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Tabs primitive           | ✅ Use `Tabs / TabsList / TabsTrigger / TabsContent` from `src/components/ui/tabs.tsx` (Radix-based, already in use in 5 pages).                 |
| 2   | Empty-state style        | ✅ Use `<EmptyState>` from `src/components/ui/EmptyState.tsx` with a Lucide icon (`h-8 w-8 text-muted-foreground`). No custom illustrations.     |
| 3   | Profile section order    | ✅ Completeness card FIRST, then existing Profile card, Documents, Blood Group, Family, Vehicles, Directory Settings. See Phase 3 ordering list. |
| 4   | Nav placement            | ✅ Flat top-level entries appended to `navItems` in `src/components/layout/ResidentSidebar.tsx`. No new group concept. Icons: `Users`, `Car`.    |
| 5   | Vehicle search structure | ✅ Tab on `/r/directory` using the Tabs primitive. The `/r/directory/vehicles/page.tsx` separate route is dropped.                               |

---

## Ship Order

```
1. /ship-phase execution_plan/plans/resident-household-registry-ui.md 1   # Family
2. /ship-phase execution_plan/plans/resident-household-registry-ui.md 2   # Vehicles
3. /ship-phase execution_plan/plans/resident-household-registry-ui.md 3   # Profile + Directory
4. /ship-phase execution_plan/plans/resident-household-registry-ui.md 4   # Admin
```

Each phase: implement → quality gate → build → audit → commit → next.
