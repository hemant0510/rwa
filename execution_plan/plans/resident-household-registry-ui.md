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

| Assumption                                                         | Verified                                         |
| ------------------------------------------------------------------ | ------------------------------------------------ |
| Family APIs exist                                                  | `src/app/api/v1/residents/me/family/*`           |
| Vehicle APIs exist                                                 | `src/app/api/v1/residents/me/vehicles/*`         |
| Profile PATCH API exists (bloodGroup / household / vehicle)        | `src/app/api/v1/residents/me/profile/`           |
| Profile summary API exists                                         | `src/app/api/v1/residents/me/profile/...`        |
| Admin vehicle search API exists                                    | `src/app/api/v1/admin/vehicles/search/`          |
| Admin resident family/vehicle APIs exist                           | `src/app/api/v1/residents/[id]/family,vehicles/` |
| Services `family.ts`, `vehicles.ts`, `profile.ts`                  | `src/services/*.ts`                              |
| `/r/profile/family/page.tsx`                                       | **MISSING — to build**                           |
| `/r/profile/vehicles/page.tsx`                                     | **MISSING — to build**                           |
| Feature component folders `components/features/{family,vehicles}/` | **MISSING — to build**                           |
| Admin tabs on `/admin/residents/[id]/page.tsx`                     | **MISSING — to build**                           |

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

| Path                                                           | Type | Notes                                             |
| -------------------------------------------------------------- | ---- | ------------------------------------------------- |
| `src/app/r/profile/family/page.tsx`                            | New  | Client page, React Query, handles 15-limit banner |
| `src/components/features/family/FamilyMemberCard.tsx`          | New  | Avatar, age, blood group, emergency star, actions |
| `src/components/features/family/FamilyMemberDialog.tsx`        | New  | RHF + `familyMemberSchema` (exists)               |
| `src/components/features/family/RelationshipBadge.tsx`         | New  | Small enum-driven badge                           |
| `src/components/features/family/EmergencyContactIndicator.tsx` | New  | Star + priority label                             |

### Page spec

`/r/profile/family` — top bar with "← Back to Profile" + "Add Member" CTA (disabled + tooltip when `dependents.length >= 15`). Grid of `FamilyMemberCard`. Empty state: illustration + "Add your first family member" CTA.

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
| `tests/components/features/family/FamilyMemberCard.test.tsx`          | render, age compute, emergency star, edit/remove callbacks                                                        |
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

| Path                                                           | Type | Notes                                    |
| -------------------------------------------------------------- | ---- | ---------------------------------------- |
| `src/app/r/profile/vehicles/page.tsx`                          | New  | Client page, paginated list              |
| `src/components/features/vehicles/VehicleCard.tsx`             | New  | Icon, reg, owner, expiry badges, actions |
| `src/components/features/vehicles/VehicleDialog.tsx`           | New  | RHF + `vehicleSchema` (exists)           |
| `src/components/features/vehicles/RegistrationNumberInput.tsx` | New  | Auto-uppercase + format mask             |
| `src/components/features/vehicles/ExpiryBadge.tsx`             | New  | Amber (≤30d), red (expired), neutral     |

### Page spec

`/r/profile/vehicles` — top bar with "← Back to Profile" + "Add Vehicle" CTA. Card grid. Pagination (page size 10). On card: make/model, reg number, 3 expiry badges (Insurance, PUC, RC), owner tag (self / "Owned by: [dependent name]"), parking slot. Edit / deactivate buttons.

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

| Test file                                                             | Covers                                                                                |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `tests/app/r/profile/vehicles/page.test.tsx`                          | loading, error, empty, grid, add→dialog→mutation, pagination, duplicate error         |
| `tests/components/features/vehicles/VehicleCard.test.tsx`             | render, expiry badges, dependent owner tag, edit/deactivate callbacks                 |
| `tests/components/features/vehicles/VehicleDialog.test.tsx`           | create, edit, validation, unit auto-select, file-upload sequence, dup error surfacing |
| `tests/components/features/vehicles/RegistrationNumberInput.test.tsx` | uppercase, mask, paste handling                                                       |
| `tests/components/features/vehicles/ExpiryBadge.test.tsx`             | neutral, amber (30d), red (expired), null date                                        |

---

## Phase 3 — Profile Hub + Directory Extensions

**Goal**: Rebuild `/r/profile/page.tsx` to include family/vehicle summary cards, completeness card, blood-group + household + vehicle declarations, directory opt-in settings. Rebuild `/r/directory/page.tsx` for opt-in banner + vehicle search tab.

**Wireframe references**:

- Profile hub (Group 7) — [lines 1100–1128](./resident-household-registry.md#L1100-L1128)
- Completeness card (Group 8E) — [lines 1482–1491](./resident-household-registry.md#L1482-L1491)
- Directory opt-in (Group 6) — [lines 1088–1091](./resident-household-registry.md#L1088-L1091)
- Vehicle search tab (Group 4) — [lines 924–928](./resident-household-registry.md#L924-L928)

### Files

| Path                                                          | Type   | Notes                                                             |
| ------------------------------------------------------------- | ------ | ----------------------------------------------------------------- |
| `src/app/r/profile/page.tsx`                                  | Extend | Add 5 new sections to existing 539-line page                      |
| `src/components/features/profile/ProfileFamilyCard.tsx`       | New    | Summary — count + "View family →" link                            |
| `src/components/features/profile/ProfileVehiclesCard.tsx`     | New    | Summary — count + first reg + link                                |
| `src/components/features/profile/ProfileCompletenessCard.tsx` | New    | Progress bar, tier badge, next-step CTA                           |
| `src/components/features/profile/DirectorySettingsCard.tsx`   | New    | Two toggles, cascade rule enforcement                             |
| `src/components/features/profile/DeclarationToggle.tsx`       | New    | Shared for household + vehicle "none" toggles                     |
| `src/app/r/directory/page.tsx`                                | Extend | Add opt-in banner + tab bar (People / Vehicles)                   |
| `src/components/features/directory/VehicleSearchTab.tsx`      | New    | Search input + result cards (name + unit + make/colour, NO phone) |

### Profile hub — new sections added to `/r/profile/page.tsx`

1. **Completeness card** (top) — % ring + tier badge + "Next: add emergency contact" CTA
2. **Blood group dropdown** — inline edit via `updateProfileDeclarations`
3. **Family Members card** — uses `ProfileFamilyCard` (link → `/r/profile/family`) OR "No family members" declaration toggle
4. **Vehicles card** — uses `ProfileVehiclesCard` (link → `/r/profile/vehicles`) OR "No vehicles" declaration toggle
5. **Directory Settings** — two toggles (show in directory, show phone); enforce cascade (phone off when directory off)

### Directory page — extensions

Add tab bar: "People" (existing list) / "Vehicles" (new search tab). Add opt-in banner at top of People tab explaining that only opted-in residents are shown. Vehicle search tab: debounced input (min 3 chars), grid of result cards.

### State coordination

All 5 new profile cards read from `GET /api/v1/residents/me` (extended response already includes completeness + blood group + household/vehicle status). Invalidate the `["me"]` query key on every declaration mutation. Family/vehicle summary cards also read from `GET /api/v1/residents/me/profile/summary`.

### Tests

| Test file                                                            | Covers                                                                          |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `tests/app/r/profile/page.test.tsx`                                  | **Replace** existing test file: all 5 new sections + existing photo upload flow |
| `tests/components/features/profile/ProfileFamilyCard.test.tsx`       | 0 / 1 / many members; link; declaration mode when 0                             |
| `tests/components/features/profile/ProfileVehiclesCard.test.tsx`     | 0 / 1 / many vehicles; link; declaration mode when 0                            |
| `tests/components/features/profile/ProfileCompletenessCard.test.tsx` | BASIC / STANDARD / COMPLETE / VERIFIED rendering; next-step text                |
| `tests/components/features/profile/DirectorySettingsCard.test.tsx`   | both-off, directory-only-on, both-on, cascade rule                              |
| `tests/components/features/profile/DeclarationToggle.test.tsx`       | NOT_SET → DECLARED_NONE, HAS_ENTRIES (disabled) state                           |
| `tests/app/r/directory/page.test.tsx`                                | Extend existing: tab switching, vehicle search, opt-in banner                   |
| `tests/components/features/directory/VehicleSearchTab.test.tsx`      | min-length guard, empty results, result card, privacy (no phone)                |

---

## Phase 4 — Admin UI

**Goal**: Admin sees family and vehicles on the resident detail page, searches by vehicle reg from the residents list, sees completeness badges.

**Wireframe references**:

- Admin resident-detail tabs (Group 5) — [lines 996–1018](./resident-household-registry.md#L996-L1018)
- Admin vehicle search (Group 4) — [lines 962–966](./resident-household-registry.md#L962-L966)
- Admin completeness (Group 8G) — [lines 1528–1553](./resident-household-registry.md#L1528-L1553)

### Files

| Path                                                    | Type   | Notes                                                       |
| ------------------------------------------------------- | ------ | ----------------------------------------------------------- |
| `src/app/admin/residents/[id]/page.tsx`                 | Extend | Add Family + Vehicles tabs alongside existing               |
| `src/components/features/admin/ResidentFamilyTab.tsx`   | New    | Read-only list; shows active AND inactive                   |
| `src/components/features/admin/ResidentVehiclesTab.tsx` | New    | Read-only + editable parking slot via admin PATCH           |
| `src/app/admin/residents/page.tsx`                      | Extend | Add vehicle search filter pill + completeness column/filter |
| `src/components/features/admin/VehicleSearchBar.tsx`    | New    | Toggle between "By name" and "By vehicle" search modes      |
| `src/components/features/admin/CompletenessBadge.tsx`   | New    | Tier badge for list + detail view                           |

### Admin resident-detail — tab additions

Current page has existing tabs (Overview / Fees / etc.). Add two new tabs:

- **Family** — `ResidentFamilyTab`: full dependent list (active + inactive with strikethrough), signed ID-proof links, blood group column, emergency indicator. Read-only.
- **Vehicles** — `ResidentVehiclesTab`: full vehicle list, signed RC + insurance links. Admin-editable fields inline (parking slot, sticker, EV slot, validFrom/validTo) via `PATCH /api/v1/admin/vehicles/[id]`.

### Admin residents list — extensions

- Existing search bar gets a mode toggle: "By Name / Email / Phone" vs "By Vehicle". Vehicle mode hits `/api/v1/admin/vehicles/search` and scopes the list.
- Existing table gets a **Completeness** column (sortable, filterable) — badge from `CompletenessBadge`.

### Tests

| Test file                                                      | Covers                                                                          |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `tests/app/admin/residents/[id]/page.test.tsx`                 | Extend existing: new tabs render, lazy-load data on tab click                   |
| `tests/components/features/admin/ResidentFamilyTab.test.tsx`   | loading, error, empty, active + inactive split, signed URLs                     |
| `tests/components/features/admin/ResidentVehiclesTab.test.tsx` | read fields, inline edit parking slot, forbidden field gating                   |
| `tests/app/admin/residents/page.test.tsx`                      | Extend existing: mode toggle, vehicle search filter, completeness column/filter |
| `tests/components/features/admin/VehicleSearchBar.test.tsx`    | mode toggle, min-length guard, debounce                                         |
| `tests/components/features/admin/CompletenessBadge.test.tsx`   | every tier renders correct colour + label                                       |

---

## Cross-cutting concerns

### Shared patterns (do not re-invent per phase)

- **File upload**: use the existing `compressImage` util (`src/lib/utils/compress-image.ts`) — same pattern as profile photo upload on current `/r/profile`.
- **Signed URL display**: `ExternalLink` icon + "View" button pattern; never render the raw Supabase path.
- **Toast on mutation**: `toast.success` / `toast.error` via `sonner` (already used site-wide).
- **React Query keys**: `["family"]`, `["vehicles"]`, `["profile-summary"]`, `["me"]`, `["admin-resident", id]`, `["admin-vehicles", q]`.
- **Form pattern**: React Hook Form + `@hookform/resolvers/zod` + existing validation schemas. No new schemas.
- **Loading state**: `<PageSkeleton />` for full-page; inline spinner (Loader2) for partial.
- **Empty state**: illustration + primary CTA — copy from existing pages for consistency.

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
| `/admin/residents/[id]` | 4     | Extend | `tests/app/admin/residents/[id]/page.test.tsx` |
| `/admin/residents`      | 4     | Extend | `tests/app/admin/residents/page.test.tsx`      |

---

## Open Questions (resolve before Phase 1 starts)

1. Does the app already have a `<Tabs />` primitive in `src/components/ui/` for the admin detail + directory tabs, or is this a new addition?
2. What illustration / empty-state image library is used elsewhere (lucide? custom svg? none)? — match the house style.
3. On `/r/profile`, order of new sections: completeness card first (top) vs. profile card first — needs UX call.

---

## Ship Order

```
1. /ship-phase execution_plan/plans/resident-household-registry-ui.md 1   # Family
2. /ship-phase execution_plan/plans/resident-household-registry-ui.md 2   # Vehicles
3. /ship-phase execution_plan/plans/resident-household-registry-ui.md 3   # Profile + Directory
4. /ship-phase execution_plan/plans/resident-household-registry-ui.md 4   # Admin
```

Each phase: implement → quality gate → build → audit → commit → next.
