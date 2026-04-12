# Resident Household Registry

## Context

Residents currently have a thin profile at `/r/profile`: name, email, mobile, photo, and unit. There is no way to register family members or vehicles, and the existing resident directory (`/r/directory`) shows all active residents but has no vehicle search. The admin has no way to look up a resident by vehicle number.

The `Dependent` and `Vehicle` models already exist as stubs in the Prisma schema but are not surfaced in any UI. This plan significantly enhances both, adds new Phase 2 stub models (`Pet`, `DomesticHelper`), and builds full CRUD UI for residents plus read-only admin views.

### What already exists (enhance, do not rebuild)

| Existing asset          | Location                                | Plan action                                            |
| ----------------------- | --------------------------------------- | ------------------------------------------------------ |
| Resident profile page   | `src/app/r/profile/page.tsx`            | Add family/vehicle section cards                       |
| Resident directory page | `src/app/r/directory/page.tsx`          | Add vehicle search tab                                 |
| Directory API           | `/api/v1/residents/me/directory`        | Extend with opt-in fields; add vehicle search endpoint |
| Admin resident detail   | `src/app/admin/residents/[id]/page.tsx` | Add Family + Vehicles tabs                             |

### API path conventions (project-wide — do not deviate)

```
Resident:  /api/v1/residents/me/...
Admin:     /api/v1/admin/...    (or /api/v1/residents/[id]/... for resident-scoped admin reads)
```

---

## Design Decisions

### Decision 1 — Family Member ID (RWAID or Sub-ID?)

**Question**: Should a family member added by a resident get their own RWAID, or should the resident's RWAID be the household ID with appended sub-numbers?

**Recommendation: Sub-ID off the head-of-household RWAID**

| Option                | Format                               | Verdict                                                                                                                                 |
| --------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| A — Independent RWAID | `EDN-DLH-0042` for each member       | Too complex. Family members are dependents, not account holders. Billing, voting, and fee collection all hinge on the primary resident. |
| B — Appended Sub-ID   | `EDN-DLH-0042-M1`, `EDN-DLH-0042-M2` | **Recommended.** Clear parentage, easy for gate guards, amenity cards, and ID cards. The head's RWAID is the household ID.              |
| C — No separate ID    | No ID for members at all             | Members can't use gate pass, gym card, or QR check-in.                                                                                  |

**Sub-ID prefix scheme (all per-resident counters):**

- `M{N}` — family Member: `EDN-DLH-0042-M1`, `EDN-DLH-0042-M2`
- `P{N}` — Pet: `EDN-DLH-0042-P1` _(Phase 2)_
- `H{N}` — domestic Helper: `EDN-DLH-0042-H1` _(Phase 2)_

**What the Sub-ID is used for:** gate pass / QR code, gym/amenity card, emergency ID, visitor pre-auth.

**What the Sub-ID is NOT used for:** login, billing, voting, any financial/governance action.

**If a family member later becomes a primary resident** (inheritance/transfer): they register fresh and get their own RWAID. The old sub-ID is retired (dependent soft-deleted).

---

### Decision 2 — Vehicle Ownership

The existing `Vehicle` model links to `Unit` but not to a specific `User` — so we can't tell which resident in a multi-resident unit owns a given vehicle.

**Fix**: Add `ownerId` (FK → User, **required** on create) and optional `dependentOwnerId` (FK → Dependent) so a vehicle can be attributed to a family member. `ownerId` always equals the registering resident even when `dependentOwnerId` is set.

---

### Decision 3 — Vehicle Duplicate Handling

**Block (not warn)** if a vehicle with the same normalized `registrationNumber` + `societyId` + `isActive=true` already exists. One car cannot physically be in two units at once. Exception: a resident with two units in the same society may own the same car — handle by checking `ownerId` in the duplicate message: "This vehicle is already registered by another resident (Unit B-204)."

---

### Decision 4 — Resident Directory & Vehicle Search Privacy

The existing `/r/directory` shows ALL active residents. Phone numbers are already masked via `maskMobile`. The opt-in toggle adds a new layer.

**Vehicle search privacy rules:**

- Result shows: unit number, resident first name + last initial ("Ramesh K."), make + colour
- Phone number **not shown** in vehicle search results — unit number is sufficient to approach the owner
- Admin vehicle search: full name + mobile + all vehicle fields

---

### Decision 5 — Rate Limiting

In-memory rate limiting does not work in Vercel serverless (each invocation is a fresh process). Skip application-level rate limiting for the vehicle search endpoint — it is an authenticated internal API within a society. If abuse becomes a concern, use Vercel's built-in Edge rate limiting via middleware.

---

### Decision 6 — Resident Deactivation Cascade

When a resident's status changes to `DEACTIVATED` or `TRANSFERRED_DEACTIVATED`, their `Dependent` records should NOT be auto-deleted. Admin may need to retain the family data for handover. Vehicles linked to the unit remain on the unit, not the user. The soft-delete approach (`isActive = false`) gives admin control to clean up manually.

---

## Schema Changes

### Breaking Migration: String → Enum conversions

Two existing fields use free-text strings that become enums. Data migration is required.

#### `Dependent.relationship` (currently `String @db.VarChar(30)`)

Existing values in the DB (from seed data): `SPOUSE`, `SON`, `DAUGHTER`. These happen to match the new enum values, so casting works cleanly.

Migration SQL:

```sql
-- 1. Create the enum
CREATE TYPE "RelationshipType" AS ENUM (
  'SPOUSE','FATHER','MOTHER','SON','DAUGHTER','BROTHER','SISTER',
  'FATHER_IN_LAW','MOTHER_IN_LAW','SON_IN_LAW','DAUGHTER_IN_LAW',
  'GRANDFATHER','GRANDMOTHER','GRANDSON','GRANDDAUGHTER',
  'UNCLE','AUNT','NEPHEW','NIECE','COUSIN','GUARDIAN','OTHER'
);
-- 2. Cast the column (existing values must be valid enum members)
ALTER TABLE dependents
  ALTER COLUMN relationship TYPE "RelationshipType"
  USING relationship::"RelationshipType";
```

#### `Vehicle.vehicleType` (currently `String @db.VarChar(20)`)

Existing values in the DB (from schema comment): `2-Wheeler`, `4-Wheeler`, `EV`, `Bicycle`. These do NOT match the new enum names. A mapping step is required before casting:

```sql
-- 1. Create the enum
CREATE TYPE "VehicleType" AS ENUM (
  'TWO_WHEELER','TWO_WHEELER_EV','FOUR_WHEELER','FOUR_WHEELER_EV',
  'BICYCLE','COMMERCIAL','OTHER'
);
-- 2. Map old string values to new enum values
UPDATE vehicles SET vehicle_type = CASE vehicle_type
  WHEN '2-Wheeler'  THEN 'TWO_WHEELER'
  WHEN '4-Wheeler'  THEN 'FOUR_WHEELER'
  WHEN 'EV'         THEN 'FOUR_WHEELER_EV'
  WHEN 'Bicycle'    THEN 'BICYCLE'
  ELSE 'OTHER'
END;
-- 3. Cast the column
ALTER TABLE vehicles
  ALTER COLUMN vehicle_type TYPE "VehicleType"
  USING vehicle_type::"VehicleType";
```

---

### New Enums to Add

```prisma
enum RelationshipType {
  SPOUSE
  FATHER
  MOTHER
  SON
  DAUGHTER
  BROTHER
  SISTER
  FATHER_IN_LAW
  MOTHER_IN_LAW
  SON_IN_LAW
  DAUGHTER_IN_LAW
  GRANDFATHER
  GRANDMOTHER
  GRANDSON
  GRANDDAUGHTER
  UNCLE
  AUNT
  NEPHEW
  NIECE
  COUSIN
  GUARDIAN
  OTHER
}

enum BloodGroup {
  A_POS
  A_NEG
  B_POS
  B_NEG
  AB_POS
  AB_NEG
  O_POS
  O_NEG
  UNKNOWN
}

enum VehicleType {
  TWO_WHEELER       // Petrol/CNG scooter or bike
  TWO_WHEELER_EV    // Electric two-wheeler
  FOUR_WHEELER      // Car (petrol/diesel/CNG/hybrid)
  FOUR_WHEELER_EV   // Electric car
  BICYCLE           // Non-motorised
  COMMERCIAL        // Tempo/van/truck
  OTHER
}

enum PetType {
  DOG
  CAT
  BIRD
  FISH
  RABBIT
  OTHER
}

enum PetApprovalStatus {
  PENDING_APPROVAL
  APPROVED
  REJECTED
}

enum HelperCategory {
  MAID
  COOK
  DRIVER
  NANNY
  GARDENER
  WATCHMAN_PERSONAL
  OTHER
}

enum HelperStatus {
  ACTIVE
  INACTIVE
}
```

---

### Enhanced `Dependent` Model

Replaces the existing minimal stub (id, userId, societyId, name, relationship, dateOfBirth, createdAt).

```prisma
model Dependent {
  id                  String           @id @default(uuid()) @db.Uuid
  userId              String           @map("user_id") @db.Uuid
  societyId           String           @map("society_id") @db.Uuid
  memberId            String?          @unique @map("member_id") @db.VarChar(60)
  memberSeq           Int              @map("member_seq")           // 1, 2, 3 per-resident
  name                String           @db.VarChar(100)
  relationship        RelationshipType
  otherRelationship   String?          @map("other_relationship") @db.VarChar(50)
  dateOfBirth         DateTime?        @map("date_of_birth") @db.Date
  bloodGroup          BloodGroup?      @map("blood_group")
  mobile              String?          @db.VarChar(15)
  email               String?          @db.VarChar(100)
  occupation          String?          @db.VarChar(100)
  photoUrl            String?          @map("photo_url") @db.VarChar(500)
  idProofUrl          String?          @map("id_proof_url") @db.VarChar(500)
  isEmergencyContact  Boolean          @default(false) @map("is_emergency_contact")
  emergencyPriority   Int?             @map("emergency_priority")   // 1=primary 2=secondary
  medicalNotes        String?          @map("medical_notes") @db.VarChar(500)
  isActive            Boolean          @default(true) @map("is_active")
  deactivatedAt       DateTime?        @map("deactivated_at")
  createdAt           DateTime         @default(now()) @map("created_at")
  updatedAt           DateTime         @updatedAt @map("updated_at")

  user     User      @relation(fields: [userId], references: [id])
  society  Society   @relation(fields: [societyId], references: [id])
  vehicles Vehicle[]

  @@unique([userId, memberSeq])
  @@index([societyId, userId])
  @@map("dependents")
}
```

---

### Enhanced `Vehicle` Model

Adds `ownerId` (required), `dependentOwnerId` (optional), and document/expiry fields.

```prisma
model Vehicle {
  // existing fields — keep
  id                 String      @id @default(uuid()) @db.Uuid
  unitId             String      @map("unit_id") @db.Uuid
  societyId          String      @map("society_id") @db.Uuid
  vehicleType        VehicleType @map("vehicle_type")             // was String
  registrationNumber String      @map("registration_number") @db.VarChar(20)
  make               String?     @db.VarChar(50)
  model              String?     @db.VarChar(50)
  colour             String?     @db.VarChar(30)
  parkingSlot        String?     @map("parking_slot") @db.VarChar(20)
  stickerNumber      String?     @map("sticker_number") @db.VarChar(20)
  evSlot             String?     @map("ev_slot") @db.VarChar(20)
  isActive           Boolean     @default(true) @map("is_active")
  validFrom          DateTime?   @map("valid_from") @db.Date
  validTo            DateTime?   @map("valid_to") @db.Date

  // NEW fields
  ownerId            String      @map("owner_id") @db.Uuid        // required — always the registering resident
  dependentOwnerId   String?     @map("dependent_owner_id") @db.Uuid
  vehiclePhotoUrl    String?     @map("vehicle_photo_url") @db.VarChar(500)
  rcDocUrl           String?     @map("rc_doc_url") @db.VarChar(500)
  rcExpiry           DateTime?   @map("rc_expiry") @db.Date
  insuranceUrl       String?     @map("insurance_url") @db.VarChar(500)
  insuranceExpiry    DateTime?   @map("insurance_expiry") @db.Date
  pucExpiry          DateTime?   @map("puc_expiry") @db.Date
  fastagId           String?     @map("fastag_id") @db.VarChar(30)
  notes              String?     @db.VarChar(300)
  createdAt          DateTime    @default(now()) @map("created_at")
  updatedAt          DateTime    @updatedAt @map("updated_at")

  unit             Unit       @relation(fields: [unitId], references: [id])
  society          Society    @relation(fields: [societyId], references: [id])
  owner            User       @relation("VehicleOwner", fields: [ownerId], references: [id])
  dependentOwner   Dependent? @relation(fields: [dependentOwnerId], references: [id])

  @@index([societyId, registrationNumber])
  @@index([societyId, ownerId])
  @@map("vehicles")
}
```

---

### New `Pet` Model (Phase 2 stub — schema now, UI in separate plan)

```prisma
model Pet {
  id               String            @id @default(uuid()) @db.Uuid
  userId           String            @map("user_id") @db.Uuid
  societyId        String            @map("society_id") @db.Uuid
  petId            String?           @unique @map("pet_id") @db.VarChar(60)
  petSeq           Int               @map("pet_seq")               // per-resident counter
  name             String            @db.VarChar(50)
  petType          PetType           @map("pet_type")
  breed            String?           @db.VarChar(50)
  colour           String?           @db.VarChar(30)
  dateOfBirth      DateTime?         @map("date_of_birth") @db.Date
  photoUrl         String?           @map("photo_url") @db.VarChar(500)
  vaccinationUrl   String?           @map("vaccination_url") @db.VarChar(500)
  licenseUrl       String?           @map("license_url") @db.VarChar(500)
  approvalStatus   PetApprovalStatus @default(PENDING_APPROVAL) @map("approval_status")
  approvedById     String?           @map("approved_by_id") @db.Uuid
  approvedAt       DateTime?         @map("approved_at")
  rejectedReason   String?           @map("rejected_reason")
  isActive         Boolean           @default(true) @map("is_active")
  createdAt        DateTime          @default(now()) @map("created_at")
  updatedAt        DateTime          @updatedAt @map("updated_at")

  user       User    @relation(fields: [userId], references: [id])
  society    Society @relation(fields: [societyId], references: [id])
  approvedBy User?   @relation("PetApprovedBy", fields: [approvedById], references: [id])

  @@unique([userId, petSeq])
  @@map("pets")
}
```

---

### New `DomesticHelper` Model (Phase 2 stub)

```prisma
model DomesticHelper {
  id                  String         @id @default(uuid()) @db.Uuid
  userId              String         @map("user_id") @db.Uuid
  societyId           String         @map("society_id") @db.Uuid
  helperId            String?        @unique @map("helper_id") @db.VarChar(60)
  helperSeq           Int            @map("helper_seq")            // per-resident counter
  name                String         @db.VarChar(100)
  category            HelperCategory
  otherCategory       String?        @map("other_category") @db.VarChar(50)
  mobile              String?        @db.VarChar(15)
  idProofUrl          String?        @map("id_proof_url") @db.VarChar(500)
  photoUrl            String?        @map("photo_url") @db.VarChar(500)
  policeVerified      Boolean        @default(false) @map("police_verified")
  policeVerifDocUrl   String?        @map("police_verif_doc_url") @db.VarChar(500)
  entryTimeFrom       String?        @map("entry_time_from") @db.VarChar(5)
  entryTimeTo         String?        @map("entry_time_to") @db.VarChar(5)
  entryDays           Json?          @map("entry_days")
  address             String?        @db.VarChar(300)
  status              HelperStatus   @default(ACTIVE)
  createdAt           DateTime       @default(now()) @map("created_at")
  updatedAt           DateTime       @updatedAt @map("updated_at")

  user    User    @relation(fields: [userId], references: [id])
  society Society @relation(fields: [societyId], references: [id])

  @@unique([userId, helperSeq])
  @@map("domestic_helpers")
}
```

---

### Updates Required on Existing Models

#### `User` model — add these fields and relations

```prisma
// Fields — directory opt-in (Group 6)
showInDirectory      Boolean  @default(false) @map("show_in_directory")
showPhoneInDirectory Boolean  @default(false) @map("show_phone_in_directory")

// Fields — profile completeness (Group 8)
bloodGroup           BloodGroup?      @map("blood_group")             // resident's own blood group
householdStatus      HouseholdStatus  @default(NOT_SET) @map("household_status")
vehicleStatus        VehicleStatus    @default(NOT_SET) @map("vehicle_status")

// Relations (add alongside existing relation list)
vehiclesOwned        Vehicle[]          @relation("VehicleOwner")
pets                 Pet[]
petsApproved         Pet[]              @relation("PetApprovedBy")
domesticHelpers      DomesticHelper[]
```

#### New enums for profile completeness declarations

```prisma
enum HouseholdStatus {
  NOT_SET        // resident has never answered
  DECLARED_NONE  // resident confirmed "I live alone"
  HAS_ENTRIES    // auto-set when first family member is added
}

enum VehicleStatus {
  NOT_SET        // resident has never answered
  DECLARED_NONE  // resident confirmed "No vehicle"
  HAS_ENTRIES    // auto-set when first vehicle is registered
}
```

#### `Society` model — add these fields and relations

```prisma
// Fields (resolves Open Questions 1 & 2)
allowResidentVehicleSearch  Boolean  @default(true)  @map("allow_resident_vehicle_search")
maxVehiclesPerUnit           Int      @default(5)     @map("max_vehicles_per_unit")  // 0 = unlimited

// Relations
pets                 Pet[]
domesticHelpers      DomesticHelper[]
```

---

## Implementation Groups

---

## Group 1 — Schema Migration & Infrastructure

**Goal**: Apply all schema changes, handle breaking migrations, set up storage buckets, regenerate Prisma client.

### 1A — Prisma Schema (`supabase/schema.prisma`)

Apply all changes listed in Schema Changes above:

- Add 10 new enums (8 from vehicles/family + `HouseholdStatus` + `VehicleStatus`)
- Replace `Dependent.relationship String` with `RelationshipType`
- Add 10 new fields to `Dependent`; add `@@index`, update `@@map`
- Replace `Vehicle.vehicleType String` with `VehicleType`; add 8 new fields; change `ownerId` to required
- Add `Pet` model, `DomesticHelper` model
- Add `User` fields + relations
- Add `Society` relations

### 1B — Migration SQL (`supabase/migrations/YYYYMMDD_family_vehicles.sql`)

The migration must run in this exact order:

```sql
-- STEP 1: Create enums
CREATE TYPE "RelationshipType" AS ENUM (...);
CREATE TYPE "BloodGroup" AS ENUM (...);
CREATE TYPE "VehicleType" AS ENUM (...);
CREATE TYPE "PetType" AS ENUM (...);
CREATE TYPE "PetApprovalStatus" AS ENUM (...);
CREATE TYPE "HelperCategory" AS ENUM (...);
CREATE TYPE "HelperStatus" AS ENUM (...);

-- STEP 2: Data migration for VehicleType (must run BEFORE ALTER COLUMN)
UPDATE vehicles SET vehicle_type = CASE vehicle_type
  WHEN '2-Wheeler' THEN 'TWO_WHEELER'
  WHEN '4-Wheeler' THEN 'FOUR_WHEELER'
  WHEN 'EV'        THEN 'FOUR_WHEELER_EV'
  WHEN 'Bicycle'   THEN 'BICYCLE'
  ELSE 'OTHER' END;

-- STEP 3: Cast existing string columns to enums
ALTER TABLE vehicles ALTER COLUMN vehicle_type TYPE "VehicleType"
  USING vehicle_type::"VehicleType";
ALTER TABLE dependents ALTER COLUMN relationship TYPE "RelationshipType"
  USING relationship::"RelationshipType";

-- STEP 4: Add new columns to `dependents`
ALTER TABLE dependents
  ADD COLUMN member_id VARCHAR(60) UNIQUE,
  ADD COLUMN member_seq INT NOT NULL DEFAULT 0,
  ADD COLUMN other_relationship VARCHAR(50),
  ADD COLUMN blood_group "BloodGroup",
  ADD COLUMN mobile VARCHAR(15),
  ADD COLUMN email VARCHAR(100),
  ADD COLUMN occupation VARCHAR(100),
  ADD COLUMN photo_url VARCHAR(500),
  ADD COLUMN id_proof_url VARCHAR(500),
  ADD COLUMN is_emergency_contact BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN emergency_priority INT,
  ADD COLUMN medical_notes VARCHAR(500),
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN deactivated_at TIMESTAMPTZ,
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Assign member_seq to any existing dependents
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) AS rn
  FROM dependents
)
UPDATE dependents d SET member_seq = n.rn FROM numbered n WHERE d.id = n.id;

-- STEP 5: Add new columns to `vehicles`
ALTER TABLE vehicles
  ADD COLUMN owner_id UUID REFERENCES users(id),
  ADD COLUMN dependent_owner_id UUID REFERENCES dependents(id),
  ADD COLUMN vehicle_photo_url VARCHAR(500),
  ADD COLUMN rc_doc_url VARCHAR(500),
  ADD COLUMN rc_expiry DATE,
  ADD COLUMN insurance_url VARCHAR(500),
  ADD COLUMN insurance_expiry DATE,
  ADD COLUMN puc_expiry DATE,
  ADD COLUMN fastag_id VARCHAR(30),
  ADD COLUMN notes VARCHAR(300);

-- Backfill owner_id from unit's primary owner for existing vehicles
UPDATE vehicles v
SET owner_id = u.primary_owner_id
FROM units u
WHERE v.unit_id = u.id AND u.primary_owner_id IS NOT NULL;

-- Fallback: for vehicles where unit has no primary_owner_id, use any linked user via user_units
UPDATE vehicles v
SET owner_id = uu.user_id
FROM user_units uu
WHERE v.owner_id IS NULL AND v.unit_id = uu.unit_id
  AND uu.user_id IS NOT NULL;

-- After backfill: if any vehicles still have NULL owner_id, they cannot be migrated cleanly.
-- Verify with: SELECT COUNT(*) FROM vehicles WHERE owner_id IS NULL;
-- If count > 0, assign a placeholder admin or log for manual resolution before continuing.
-- Then enforce NOT NULL:
ALTER TABLE vehicles ALTER COLUMN owner_id SET NOT NULL;

-- STEP 6: Create new tables
CREATE TABLE pets ( ... );  -- full DDL from Pet model above
CREATE TABLE domestic_helpers ( ... );  -- full DDL from DomesticHelper model above

-- STEP 7: Add columns to users
CREATE TYPE "HouseholdStatus" AS ENUM ('NOT_SET','DECLARED_NONE','HAS_ENTRIES');
CREATE TYPE "VehicleStatus"   AS ENUM ('NOT_SET','DECLARED_NONE','HAS_ENTRIES');
ALTER TABLE users
  ADD COLUMN show_in_directory        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN show_phone_in_directory  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN blood_group              "BloodGroup",
  ADD COLUMN household_status         "HouseholdStatus" NOT NULL DEFAULT 'NOT_SET',
  ADD COLUMN vehicle_status           "VehicleStatus"   NOT NULL DEFAULT 'NOT_SET';

-- STEP 8: Indexes
-- NOTE: idx_vehicles_society_reg (society_id, registration_number) already exists on the vehicles
-- table from the original schema (@@index in Prisma). Do NOT re-create it.
CREATE INDEX idx_dependents_society_user ON dependents(society_id, user_id);
CREATE INDEX idx_vehicles_society_owner ON vehicles(society_id, owner_id);
CREATE UNIQUE INDEX idx_dependents_user_seq ON dependents(user_id, member_seq);

-- STEP 9: Add allowResidentVehicleSearch and maxVehiclesPerUnit to Society
ALTER TABLE societies
  ADD COLUMN allow_resident_vehicle_search BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN max_vehicles_per_unit         INT     NOT NULL DEFAULT 5;
-- 0 = unlimited; default 5 covers most societies.
```

### 1C — Supabase Storage Buckets

Create these buckets in Supabase Storage. Add to migration or run via Supabase dashboard:

| Bucket             | Access               | Used for                                   |
| ------------------ | -------------------- | ------------------------------------------ |
| `dependent-photos` | Public               | Family member face photos (no PII)         |
| `dependent-docs`   | Private (signed URL) | Family member ID proof (Aadhaar, passport) |
| `vehicle-photos`   | Public               | Vehicle exterior photos                    |
| `vehicle-docs`     | Private (signed URL) | RC certificate, insurance docs             |
| `pet-photos`       | Public               | Pet photos _(Phase 2)_                     |
| `pet-docs`         | Private              | Vaccination, licence _(Phase 2)_           |
| `helper-photos`    | Public               | Helper face photos _(Phase 2)_             |
| `helper-docs`      | Private              | Helper ID proof _(Phase 2)_                |

### 1D — RLS Policies

Add to the migration SQL for each new table:

```sql
-- dependents: resident CRUD own; admin read all in society
ALTER TABLE dependents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "residents_own_dependents" ON dependents
  USING (user_id = auth.uid());
CREATE POLICY "admin_read_society_dependents" ON dependents
  FOR SELECT USING (
    society_id IN (SELECT society_id FROM users WHERE id = auth.uid() AND role = 'RWA_ADMIN')
  );

-- pets, domestic_helpers: same pattern
-- vehicles: owner OR admin in same society
```

### 1E — Member ID Generation (`src/lib/utils/member-id.ts`)

```typescript
export function generateMemberId(rwaid: string, seq: number): string {
  return `${rwaid}-M${seq}`;
}
export function generatePetId(rwaid: string, seq: number): string {
  return `${rwaid}-P${seq}`;
}
export function generateHelperId(rwaid: string, seq: number): string {
  return `${rwaid}-H${seq}`;
}
```

### 1F — Registration Number Utility (`src/lib/utils/vehicle-utils.ts`)

```typescript
// Strips spaces AND hyphens, uppercases. DL-3C-AB-1234 → DL3CAB1234
export function normalizeRegNumber(raw: string): string {
  return raw
    .replace(/[\s-]+/g, "")
    .toUpperCase()
    .trim();
}

export type ExpiryStatus = "VALID" | "EXPIRING_SOON" | "EXPIRED" | "NOT_SET";

export function getExpiryStatus(date: Date | null | undefined): ExpiryStatus {
  if (!date) return "NOT_SET";
  const today = new Date();
  const soon = new Date(today);
  soon.setDate(soon.getDate() + 30);
  if (date < today) return "EXPIRED";
  if (date <= soon) return "EXPIRING_SOON";
  return "VALID";
}
```

### 1G — Run and Verify

```bash
# Use direct connection (not pooler) per project DB convention
DATABASE_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" \
  npx prisma db push --schema supabase/schema.prisma
npm run db:generate
npx tsc --noEmit
```

### Tests

- `tests/lib/utils/member-id.test.ts` — all generators, boundary values
- `tests/lib/utils/vehicle-utils.test.ts` — normalizeRegNumber (spaces, hyphens, mixed), getExpiryStatus (all 4 states, boundary days)
- `tests/lib/utils/profile-completeness.test.ts` — all tier boundaries (49/50/74/75/89/90%), B2 skip for ownershipType=OTHER (denominator=90), bonus items, nextIncompleteItem returns first incomplete, all-complete returns null

---

## Group 2 — Family Members: Resident CRUD

**Goal**: Resident can add, edit, view, and remove family members from `/r/profile/family`.

### Pages _(UI already complete — skip during implementation)_

> `src/app/r/profile/family/page.tsx` and `FamilyMemberDialog` are done. Reference only.

<details>
<summary>UI spec (reference)</summary>

Family Members List — cards with avatar, RelationshipBadge, DOB-computed age, blood group chip, emergency star, sub-ID badge. "Add Member" → dialog. Edit/Remove per card (soft delete). Limit: 15 members (API enforced).

FamilyMemberDialog form: Name, Relationship (+ other text when OTHER), DOB, Blood Group, Mobile, Photo, Emergency Contact toggle (+ Priority radio when ON), Medical Notes, ID Proof, Occupation, Email.

</details>

### API Routes

All routes require `RESIDENT` session. `societyId` is always derived from `user.societyId` (never from request body/query).

#### `GET /api/v1/residents/me/family`

- Returns all active dependents for the authenticated user
- Include: computed `age` (years from DOB, null if DOB missing), `memberId`
- **Signed URLs**: `idProofUrl` is stored in the private `dependent-docs` bucket. Generate a signed URL (1 hr expiry) for each dependent that has `idProofUrl`. Return as `idProofSignedUrl: string | null`. The raw stored path is never exposed to the client.

#### `POST /api/v1/residents/me/family`

- Body: family member form data (Zod validated)
- Reject if `count(active dependents for user) >= 15`
- Concurrency-safe `memberSeq` assignment:
  ```typescript
  // Wrap in try/catch, retry up to 3 times on P2002 (unique violation on [userId, memberSeq])
  const max = await prisma.dependent.aggregate({ _max: { memberSeq: true }, where: { userId } });
  const nextSeq = (max._max.memberSeq ?? 0) + 1;
  // memberId requires user.rwaid — fetch user first
  const memberId = user.rwaid ? generateMemberId(user.rwaid, nextSeq) : null;
  ```
- Write audit log: `{ action: "FAMILY_MEMBER_ADDED", entityType: "DEPENDENT", entityId: newId }`
- **Set `householdStatus = HAS_ENTRIES`** on the parent User (profile completeness)
- Returns created dependent with `memberId`

#### `PATCH /api/v1/residents/me/family/[id]`

- Partial update; validates `dependent.userId === session.userId`
- Write audit log: `FAMILY_MEMBER_UPDATED`

#### `DELETE /api/v1/residents/me/family/[id]`

- Soft delete: `{ isActive: false, deactivatedAt: new Date() }`
- Validate ownership
- Write audit log: `FAMILY_MEMBER_REMOVED`
- **If no more active dependents remain → revert `householdStatus = NOT_SET`** on the parent User

#### `POST /api/v1/residents/me/family/[id]/photo`

- Multipart upload, max 5MB, image/\* only
- Upload to `dependent-photos` bucket at path `{societyId}/{dependentId}/photo`
- Update `photoUrl`; return new URL

#### `POST /api/v1/residents/me/family/[id]/id-proof`

- Upload to `dependent-docs` bucket (private)
- Update `idProofUrl`

### Components _(UI already complete — skip during implementation)_

> `FamilyMemberCard`, `FamilyMemberDialog`, `RelationshipBadge`, `EmergencyContactIndicator` are done.

### Validation (`src/lib/validations/family.ts`)

```typescript
export const familyMemberSchema = z
  .object({
    name: z.string().min(2).max(100),
    relationship: z.nativeEnum(RelationshipType),
    otherRelationship: z.string().max(50).optional(),
    dateOfBirth: z.string().optional(),
    bloodGroup: z.nativeEnum(BloodGroup).optional(),
    mobile: z
      .string()
      .regex(/^[6-9]\d{9}$/)
      .optional()
      .or(z.literal("")),
    email: z.string().email().optional().or(z.literal("")),
    occupation: z.string().max(100).optional(),
    isEmergencyContact: z.boolean().default(false),
    emergencyPriority: z.number().int().min(1).max(2).optional(),
    medicalNotes: z.string().max(500).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.relationship === "OTHER" && !data.otherRelationship?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["otherRelationship"],
        message: "Please specify the relationship",
      });
    }
    if (data.isEmergencyContact && !data.emergencyPriority) {
      ctx.addIssue({
        code: "custom",
        path: ["emergencyPriority"],
        message: "Select Primary or Secondary",
      });
    }
  });
```

### Service (`src/services/family.ts`)

```typescript
export async function getFamilyMembers(): Promise<FamilyMember[]>;
export async function createFamilyMember(data: FamilyMemberInput): Promise<FamilyMember>;
export async function updateFamilyMember(
  id: string,
  data: Partial<FamilyMemberInput>,
): Promise<FamilyMember>;
export async function deleteFamilyMember(id: string): Promise<void>;
export async function uploadFamilyMemberPhoto(id: string, file: File): Promise<{ url: string }>;
export async function uploadFamilyMemberIdProof(id: string, file: File): Promise<{ url: string }>;
```

### Tests (95% coverage required)

- `tests/app/api/v1/residents/me/family/route.test.ts` — GET (list with signed URLs, empty), POST (success, 15-limit, concurrent seq, missing required)
- `tests/app/api/v1/residents/me/family/[id]/route.test.ts` — PATCH (success, wrong owner), DELETE (soft delete, wrong owner, householdStatus revert)
- `tests/app/api/v1/residents/me/family/[id]/photo/route.test.ts` — upload success, wrong type, size limit
- `tests/app/api/v1/residents/me/family/[id]/id-proof/route.test.ts` — upload success, signed URL returned, access control
- ~~`tests/components/features/family/FamilyMemberCard.test.tsx`~~ _(UI done)_
- ~~`tests/components/features/family/FamilyMemberDialog.test.tsx`~~ _(UI done)_
- `tests/lib/validations/family.test.ts` — schema: all conditional validations
- `tests/services/family.test.ts` — all 6 service functions: happy path + error propagation

---

## Group 3 — Vehicles: Resident CRUD

**Goal**: Resident can register, update, and deactivate vehicles at `/r/profile/vehicles`.

### Pages _(UI already complete — skip during implementation)_

> `src/app/r/profile/vehicles/page.tsx` and `VehicleDialog` are done. Reference only.

<details>
<summary>UI spec (reference)</summary>

Vehicle List — cards with type icon, reg number, make/model, colour, owner tag, parking slot, expiry badges (amber ≤30d, red expired). "Add Vehicle" → dialog. Edit/Deactivate per card.

VehicleDialog fields: Reg Number (auto-uppercase), Vehicle Type, Make, Model, Colour, Owner (self or family member), Unit (auto-select if single unit, dropdown if multiple), Parking Slot, Insurance/PUC/RC expiry dates, FASTag ID, Vehicle Photo, RC Doc, Insurance Doc, Notes.

</details>

### API Routes

#### `GET /api/v1/residents/me/vehicles`

- Returns active vehicles for all units linked to authenticated user
- Includes: `owner.name`, `dependentOwner.name`, computed `insuranceStatus`, `pucStatus`, `rcStatus` (all via `getExpiryStatus`)
- **Signed URLs**: `rcDocUrl` and `insuranceUrl` are stored in the private `vehicle-docs` bucket. Generate signed URLs (1 hr expiry) for each, returned as `rcDocSignedUrl` and `insuranceSignedUrl`. Raw paths never exposed.
- Pagination: `?page=1&limit=20`

#### `POST /api/v1/residents/me/vehicles`

- Body: vehicle form data
- Validates `unitId` belongs to authenticated user's units
- Enforce `society.maxVehiclesPerUnit` limit: count active vehicles for the unit; if `count >= maxVehiclesPerUnit` AND `maxVehiclesPerUnit > 0`, return 422 with message "This unit has reached its vehicle limit (N). Contact admin to increase."
- Sets `ownerId = session.userId` always (even when `dependentOwnerId` is set)
- Normalises `registrationNumber` via `normalizeRegNumber`
- **Blocks** duplicate: if `{ registrationNumber: normalised, societyId, isActive: true }` exists, return 409 with message identifying the other resident's unit
- Write audit log: `VEHICLE_ADDED`
- **Set `vehicleStatus = HAS_ENTRIES`** on the owner User (profile completeness)
- Returns created vehicle

#### `PATCH /api/v1/residents/me/vehicles/[id]`

- Partial update; validates `vehicle.ownerId === session.userId`
- Re-normalises `registrationNumber` if changed
- Write audit log: `VEHICLE_UPDATED`

#### `DELETE /api/v1/residents/me/vehicles/[id]`

- Soft delete: `{ isActive: false }`
- Validates ownership
- Write audit log: `VEHICLE_DEACTIVATED`
- **If no more active vehicles for this user → revert `vehicleStatus = NOT_SET`** on the owner User

#### `POST /api/v1/residents/me/vehicles/[id]/photo`

- Upload to `vehicle-photos` bucket at `{societyId}/{vehicleId}/photo`
- Update `vehiclePhotoUrl`

#### `POST /api/v1/residents/me/vehicles/[id]/rc`

- Upload to `vehicle-docs` bucket (private), path `{societyId}/{vehicleId}/rc`
- Update `rcDocUrl`

#### `POST /api/v1/residents/me/vehicles/[id]/insurance`

- Upload to `vehicle-docs` bucket, path `{societyId}/{vehicleId}/insurance`
- Update `insuranceUrl`

### Components _(UI already complete — skip during implementation)_

> `VehicleCard`, `VehicleDialog`, `RegistrationNumberInput`, `ExpiryBadge` are done.

### Validation (`src/lib/validations/vehicle.ts`)

```typescript
// Accepts common Indian formats: DL3CAB1234 / DL 3C AB 1234 / DL-3C-AB-1234
const REG_REGEX = /^[A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{1,3}[\s-]?\d{4}$/i;

export const vehicleSchema = z.object({
  registrationNumber: z
    .string()
    .regex(REG_REGEX, "Enter a valid registration number (e.g. DL 3C AB 1234)"),
  vehicleType: z.nativeEnum(VehicleType),
  make: z.string().max(50).optional(),
  model: z.string().max(50).optional(),
  colour: z.string().max(30).optional(),
  unitId: z.string().uuid(),
  dependentOwnerId: z.string().uuid().nullable().optional(),
  parkingSlot: z.string().max(20).optional(),
  insuranceExpiry: z.string().date().optional(),
  pucExpiry: z.string().date().optional(),
  rcExpiry: z.string().date().optional(),
  fastagId: z.string().max(30).optional(),
  notes: z.string().max(300).optional(),
});
```

### Service (`src/services/vehicles.ts`)

```typescript
export async function getVehicles(params?: PaginationParams): Promise<VehicleListResponse>;
export async function createVehicle(data: VehicleInput): Promise<Vehicle>;
export async function updateVehicle(id: string, data: Partial<VehicleInput>): Promise<Vehicle>;
export async function deleteVehicle(id: string): Promise<void>;
export async function uploadVehiclePhoto(id: string, file: File): Promise<{ url: string }>;
export async function uploadVehicleRc(id: string, file: File): Promise<{ url: string }>;
export async function uploadVehicleInsurance(id: string, file: File): Promise<{ url: string }>;
```

### Tests (95% coverage required)

- `tests/app/api/v1/residents/me/vehicles/route.test.ts` — GET (list with signed URLs, pagination), POST (success, duplicate block, wrong unit, vehicleStatus auto-set)
- `tests/app/api/v1/residents/me/vehicles/[id]/route.test.ts` — PATCH (success, wrong owner, re-normalise), DELETE (vehicleStatus revert when last vehicle)
- `tests/app/api/v1/residents/me/vehicles/[id]/photo/route.test.ts`
- `tests/app/api/v1/residents/me/vehicles/[id]/rc/route.test.ts` — signed URL returned
- `tests/app/api/v1/residents/me/vehicles/[id]/insurance/route.test.ts` — signed URL returned
- ~~`tests/components/features/vehicles/VehicleCard.test.tsx`~~ _(UI done)_
- ~~`tests/components/features/vehicles/VehicleDialog.test.tsx`~~ _(UI done)_
- ~~`tests/components/features/vehicles/ExpiryBadge.test.tsx`~~ _(UI done)_
- `tests/lib/validations/vehicle.test.ts` — valid/invalid reg numbers, formats
- `tests/services/vehicles.test.ts` — all 7 service functions: happy path + error propagation

---

## Group 4 — Vehicle Search

**Goal**: Residents and admins can find a vehicle's owner by registration number, make, or colour.

### Resident Vehicle Search

#### Page: `src/app/r/directory/vehicles/page.tsx` _(UI already complete — skip during implementation)_

> Search tab inside `/r/directory` is done. Key privacy rule for API: results must include unit label + name only — **no phone number**. `allowResidentVehicleSearch=false` disables the endpoint (return 403).

#### API: `GET /api/v1/residents/me/vehicles/search?q=...`

```typescript
// societyId ALWAYS from session — never from query params
const q = normalizeRegNumber(searchParams.get("q") ?? "");
if (q.length < 3) return 400;

const vehicles = await prisma.vehicle.findMany({
  where: {
    societyId: user.societyId, // from session
    isActive: true,
    OR: [
      { registrationNumber: { contains: q, mode: "insensitive" } },
      { make: { contains: q, mode: "insensitive" } },
      { colour: { contains: q, mode: "insensitive" } },
    ],
  },
  select: {
    id: true,
    registrationNumber: true,
    vehicleType: true,
    make: true,
    model: true,
    colour: true,
    unit: { select: { displayLabel: true } },
    owner: { select: { name: true } }, // NO mobile/email
    dependentOwner: { select: { name: true } },
  },
  take: 20,
});
```

### Admin Vehicle Search

#### Enhancement to `src/app/admin/residents/page.tsx`

Add a "By Vehicle" filter pill to the existing search bar. Shows a reg-number input. Results update the residents table to show only residents whose vehicles match.

#### API: `GET /api/v1/admin/vehicles/search?q=...`

- `societyId` from admin's session (`user.societyId`)
- Same query as resident search but returns `owner.mobile`, `owner.email`, full unit details
- Sortable: `?sort=reg|type|unit`
- Pagination: `?page=1&limit=20`

### Service addition (`src/services/vehicles.ts`)

```typescript
export async function searchVehicles(q: string): Promise<VehicleSearchResult[]>;
```

Admin search called from existing `residents.ts` or new `src/services/admin-vehicles.ts`.

### Tests (95% coverage required)

- `tests/app/api/v1/residents/me/vehicles/search/route.test.ts` — min-length guard, societyId isolation (cannot see other society), results format, no phone in response
- `tests/app/api/v1/admin/vehicles/search/route.test.ts` — full detail in response, societyId isolation, sort param

---

## Group 5 — Admin Views: Family & Vehicles

**Goal**: Admin can view any resident's family members and vehicles from the existing resident detail page.

### UI Changes _(already complete — skip during implementation)_

> `src/app/admin/residents/[id]/page.tsx` Family + Vehicles tabs are done.
> `src/app/admin/residents/page.tsx` family/vehicle count columns are done.

**Required API change** (`src/app/api/v1/residents/route.ts`):

Add to the Prisma `include` / `_count` for each resident:

```typescript
_count: {
  select: {
    dependents: { where: { isActive: true } },
  }
}
// and include first vehicle reg number:
vehicles: {
  where: { isActive: true },
  orderBy: { createdAt: 'asc' },
  take: 1,
  select: { registrationNumber: true },
}
```

Return `familyCount: number` and `vehicleSummary: { count: number; firstReg: string | null }` per resident. _(Group 8G adds more changes to the same route — coordinate both sets of changes in a single implementation pass.)_

### New Admin API Routes

#### `GET /api/v1/residents/[id]/family` _(admin only)_

- Returns ALL dependents (active and inactive) for the resident
- Generates signed URLs for `idProofUrl` (1 hr expiry)
- Validates: calling admin is in same society as resident

#### `GET /api/v1/residents/[id]/vehicles` _(admin only)_

- Returns all vehicles for the resident's unit(s)
- Generates signed URLs for `rcDocUrl`, `insuranceUrl`

#### `PATCH /api/v1/admin/vehicles/[vehicleId]`

- Admin-only editable fields: `parkingSlot`, `stickerNumber`, `evSlot`, `validFrom`, `validTo`
- Cannot change: `registrationNumber`, `ownerId`, `vehicleType`, document URLs
- Validates vehicle belongs to admin's society
- Write audit log: `VEHICLE_SLOT_ASSIGNED`

### Tests (95% coverage required)

- `tests/app/api/v1/residents/[id]/family/route.test.ts` — admin gets all (incl inactive), generates signed URLs, wrong society blocked
- `tests/app/api/v1/residents/[id]/vehicles/route.test.ts` — admin gets all, signed URLs
- `tests/app/api/v1/admin/vehicles/[vehicleId]/route.test.ts` — parking slot update, forbidden field update blocked

---

## Group 6 — Resident Directory Enhancements

**Goal**: Extend the existing opt-in-less directory with (a) opt-in toggles, (b) vehicle search tab.

> The directory page (`/r/directory`) and API (`/api/v1/residents/me/directory`) already exist and are functional. This group enhances them — do NOT rebuild from scratch.

### Changes to Existing Directory API (`/api/v1/residents/me/directory`)

Add `showInDirectory` filter: when `?optinOnly=true` is passed (default for the enhanced UI), only return residents with `showInDirectory = true`. The old behaviour (all active residents) remains when `optinOnly=false` to avoid breaking changes.

**Phone visibility**: The existing directory already masks phone via `maskMobile`. Enhance: if `showPhoneInDirectory = false`, return `mobile: null` (full mask instead of partial).

### New API: `PATCH /api/v1/residents/me/settings/directory`

```typescript
// Body: { showInDirectory: boolean, showPhoneInDirectory: boolean }
// Business rule: if showInDirectory = false, force showPhoneInDirectory = false
const data = {
  showInDirectory: body.showInDirectory,
  showPhoneInDirectory: body.showInDirectory ? body.showPhoneInDirectory : false,
};
await prisma.user.update({ where: { id: user.userId }, data });
```

### Group 6 Migration SQL

Run as part of the Group 1B migration (step 7 already adds `show_in_directory` with default FALSE). After columns are added, execute this one-time data migration to preserve the existing directory behaviour for all current residents:

```sql
-- Opt-in all currently ACTIVE or APPROVED residents so they continue to appear
-- in the directory after the opt-in filter is deployed (see Open Question 5).
UPDATE users SET show_in_directory = true
WHERE status IN ('ACTIVE');
-- showPhoneInDirectory remains FALSE (false by default — residents can opt in explicitly).
```

> **Important**: run this migration before deploying the Group 6 UI. Without it, the directory will appear empty for all residents the moment the `optinOnly=true` filter is live.

---

### UI Changes _(already complete — skip during implementation)_

> `/r/directory/page.tsx` tab bar and opt-in banner are done.
> Directory settings card in `/r/profile/page.tsx` is done.

### Tests (95% coverage required)

- `tests/app/api/v1/residents/me/directory/route.test.ts` — update to cover `optinOnly` filter, phone null when `showPhoneInDirectory=false`
- `tests/app/api/v1/residents/me/settings/directory/route.test.ts` — PATCH success, force-false cascade, validation

---

## Group 7 — Profile Hub Enhancements

**Goal**: Create the `GET /api/v1/residents/me/profile/summary` endpoint that powers the family + vehicle summary cards on the profile page.

### UI Changes _(already complete — skip during implementation)_

> Family Members Card and Vehicles Card on `/r/profile/page.tsx` are done.
> Navigation menu items in `/r/layout.tsx` are done.

### New API: `GET /api/v1/residents/me/profile/summary`

Returns aggregate data for the hub — efficient single query:

```typescript
{
  familyCount: number,
  vehicleCount: number,
  emergencyContacts: { name: string, relationship: RelationshipType, mobile: string | null, bloodGroup: BloodGroup | null }[],
  vehicleExpiryAlerts: { id: string, registrationNumber: string, insuranceStatus: ExpiryStatus, pucStatus: ExpiryStatus, rcStatus: ExpiryStatus }[],
  directoryOptIn: boolean,
  showPhoneInDirectory: boolean,
}
```

### Tests (95% coverage required)

- `tests/app/api/v1/residents/me/profile/summary/route.test.ts` — all counts, expiry alerts, empty states
- `tests/services/profile.test.ts` — `updateProfileDeclarations`: happy path, HAS_ENTRIES rejection, unauthenticated

---

## Phase 2 Features (Stub Now, UI in Separate Plan `resident-profile-phase2.md`)

Schema models for `Pet` and `DomesticHelper` are added in Group 1 but no UI is built in this plan.

### Pet Registration Flow (Phase 2)

1. Resident submits: name, type, breed, photo, vaccination cert, licence
2. Status: `PENDING_APPROVAL`
3. Admin reviews → Approves/Rejects (with reason)
4. On approval: `petId` auto-generated (`EDN-DLH-0042-P1`); notification sent
5. Resident downloads "Society Pet ID Card" (QR code card)

### Domestic Helper Register Flow (Phase 2)

1. Resident adds: name, category, mobile, photo, ID proof, entry schedule
2. `helperId` auto-generated (`EDN-DLH-0042-H1`)
3. QR code generated for helper to use at gate
4. Admin can view all helpers per society, blacklist a helper

### Other Future Engagement Features

- **Move-In/Move-Out Slot Booking** — book elevator/gate window for moving; admin approves
- **Package/Delivery Tracking** — pre-register deliveries; gate confirms arrival; resident notified
- **Society Marketplace** — residents buy/sell/offer services within the society

---

## Engagement Summary

| Feature                 | Resident Value                                                     | Admin Value                                            |
| ----------------------- | ------------------------------------------------------------------ | ------------------------------------------------------ |
| Family Members          | Household-level app; gate passes; emergency ID                     | Full household picture for emergencies and onboarding  |
| Vehicle Registration    | Safety (blocked parking, hit-and-run lookup), doc expiry reminders | Vehicle-based resident lookup; sticker/slot management |
| Directory Opt-in        | Community building; neighbour WhatsApp                             | Census-level data; contact completeness                |
| Pet Registration _(P2)_ | Prove compliance; digital pet ID card                              | Enforce pet bylaws; approval workflow                  |
| Domestic Helper _(P2)_  | Replace paper gate register; QR entry pass                         | Security audit trail; blacklist capability             |

---

## Routing & File Summary

### New Routes

```
/r/profile/family              — Family Members CRUD
/r/profile/vehicles            — Vehicles CRUD
/r/directory                   — ENHANCED: + vehicle search tab
/r/profile                     — ENHANCED: + family/vehicle summary cards + directory toggles

/api/v1/residents/me/family                        GET, POST
/api/v1/residents/me/family/[id]                   PATCH, DELETE
/api/v1/residents/me/family/[id]/photo             POST
/api/v1/residents/me/family/[id]/id-proof          POST
/api/v1/residents/me/vehicles                      GET, POST
/api/v1/residents/me/vehicles/[id]                 PATCH, DELETE
/api/v1/residents/me/vehicles/[id]/photo           POST
/api/v1/residents/me/vehicles/[id]/rc              POST
/api/v1/residents/me/vehicles/[id]/insurance       POST
/api/v1/residents/me/vehicles/search               GET
/api/v1/residents/me/settings/directory            PATCH
/api/v1/residents/me/profile/summary               GET
/api/v1/residents/me/profile                       PATCH (blood group + declarations)
/api/v1/residents/[id]/family                      GET (admin)
/api/v1/residents/[id]/vehicles                    GET (admin)
/api/v1/admin/vehicles/search                      GET
/api/v1/admin/vehicles/[vehicleId]                 PATCH
```

### New/Modified Files

> Files marked **(UI done)** exist and are complete — do not create or modify during implementation.

```
src/
  app/
    r/
      profile/
        family/page.tsx               (UI done)
        vehicles/page.tsx             (UI done)
      directory/
        vehicles/page.tsx             (UI done)
    api/v1/
      residents/
        me/
          family/route.ts             NEW  ← build
          family/[id]/route.ts        NEW  ← build
          family/[id]/photo/route.ts  NEW  ← build
          family/[id]/id-proof/route.ts NEW ← build
          vehicles/route.ts           NEW  ← build
          vehicles/[id]/route.ts      NEW  ← build
          vehicles/[id]/photo/route.ts NEW ← build
          vehicles/[id]/rc/route.ts   NEW  ← build
          vehicles/[id]/insurance/route.ts NEW ← build
          vehicles/search/route.ts    NEW  ← build
          settings/directory/route.ts NEW  ← build
          profile/summary/route.ts    NEW  ← build
          profile/route.ts            NEW  ← build (PATCH: blood group + declarations)
          directory/route.ts          MODIFIED ← build (opt-in filter)
        [id]/
          family/route.ts             NEW  ← build (admin)
          vehicles/route.ts           NEW  ← build (admin)
      admin/
        vehicles/search/route.ts      NEW  ← build
        vehicles/[vehicleId]/route.ts NEW  ← build

  components/features/              (UI done — do not touch)
    family/  FamilyMemberCard, FamilyMemberDialog, RelationshipBadge, EmergencyContactIndicator
    vehicles/ VehicleCard, VehicleDialog, RegistrationNumberInput, ExpiryBadge

  lib/
    utils/member-id.ts                NEW  ← build
    utils/vehicle-utils.ts            NEW  ← build
    utils/profile-completeness.ts     NEW  ← build  (Group 8)
    validations/family.ts             NEW  ← build
    validations/vehicle.ts            NEW  ← build

  services/
    family.ts                         NEW  ← build
    vehicles.ts                       NEW  ← build
    profile.ts                        NEW  ← build  (Group 8)

  types/
    user.ts                           MODIFIED ← build (add completeness types + new User fields)
```

---

---

## Group 8 — Resident Profile Completeness

**Goal**: Show residents a live completeness score with tier badges so they fill in all important details, and give admins a filter to follow up with incomplete profiles.

---

### Completeness Scoring Specification

#### Core Items (9 items → 100%)

| Key | Item                                                                                   | Points | Conditional                                                           |
| --- | -------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------- |
| A1  | Profile photo uploaded (`photoUrl`)                                                    | 15     | No                                                                    |
| A2  | Mobile number added (`mobile`)                                                         | 10     | No                                                                    |
| A3  | Email verified (`isEmailVerified`)                                                     | 10     | No                                                                    |
| A4  | Blood group added — own profile (`bloodGroup`)                                         | 10     | No                                                                    |
| B1  | ID proof uploaded (`idProofUrl`)                                                       | 15     | No                                                                    |
| B2  | Ownership / residency proof (`ownershipProofUrl`)                                      | 10     | **Skip when `ownershipType = OTHER`** — denominator reduces to 90 pts |
| C1  | At least 1 emergency contact set (active `Dependent` with `isEmergencyContact = true`) | 10     | No                                                                    |
| D1  | Household declared (`householdStatus ≠ NOT_SET`)                                       | 10     | No                                                                    |
| E1  | Vehicle declared (`vehicleStatus ≠ NOT_SET`)                                           | 10     | No                                                                    |

**Tier thresholds:**

| Tier        | Range   | Badge colour |
| ----------- | ------- | ------------ |
| 🔵 Basic    | 0–49%   | Gray         |
| 🟡 Standard | 50–74%  | Amber        |
| 🟢 Complete | 75–89%  | Blue         |
| ⭐ Verified | 90–100% | Green        |

#### Bonus Items (shown as "Extras" — do NOT affect the 100% ceiling)

| Key | Item                                     | Source                                                                   |
| --- | ---------------------------------------- | ------------------------------------------------------------------------ |
| A5  | WhatsApp notifications enabled           | `User.consentWhatsapp`                                                   |
| F1  | Appeared in society directory            | `User.showInDirectory`                                                   |
| C2  | Emergency contact has blood group filled | Any `Dependent` where `isEmergencyContact=true` AND `bloodGroup != null` |

---

### 8A — Profile Completeness Utility (`src/lib/utils/profile-completeness.ts`)

Pure function, zero DB dependencies. Called from both resident API and admin API.

```typescript
import type { BloodGroup, OwnershipType } from "@prisma/client";

export type TierLabel = "BASIC" | "STANDARD" | "COMPLETE" | "VERIFIED";

export interface CompletenessItem {
  key: string;
  label: string;
  completed: boolean;
  points: number;
}

export interface CompletenessBonus {
  key: string;
  label: string;
  completed: boolean;
}

export interface CompletenessResult {
  percentage: number; // 0–100 (rounded)
  tier: TierLabel;
  earned: number; // raw points earned
  possible: number; // total applicable points (90 for OTHER, 100 for rest)
  items: CompletenessItem[];
  bonus: CompletenessBonus[];
  nextIncompleteItem: CompletenessItem | null; // first incomplete core item
}

export interface CompletenessInput {
  photoUrl: string | null;
  mobile: string | null;
  isEmailVerified: boolean;
  bloodGroup: BloodGroup | null;
  idProofUrl: string | null;
  ownershipProofUrl: string | null;
  ownershipType: OwnershipType | null; // use Prisma enum, not raw strings
  hasEmergencyContact: boolean;
  householdStatus: "NOT_SET" | "DECLARED_NONE" | "HAS_ENTRIES";
  vehicleStatus: "NOT_SET" | "DECLARED_NONE" | "HAS_ENTRIES";
  // bonus
  consentWhatsapp: boolean;
  showInDirectory: boolean;
  emergencyContactHasBloodGroup: boolean;
}

export function computeCompleteness(input: CompletenessInput): CompletenessResult {
  const isOther = input.ownershipType === "OTHER";

  const coreItems: CompletenessItem[] = [
    { key: "A1", label: "Profile photo", completed: !!input.photoUrl, points: 15 },
    { key: "A2", label: "Mobile number", completed: !!input.mobile, points: 10 },
    { key: "A3", label: "Email verified", completed: input.isEmailVerified, points: 10 },
    { key: "A4", label: "Blood group", completed: !!input.bloodGroup, points: 10 },
    { key: "B1", label: "ID proof", completed: !!input.idProofUrl, points: 15 },
    // B2 only applicable for OWNER / TENANT
    ...(!isOther
      ? [{ key: "B2", label: "Residency proof", completed: !!input.ownershipProofUrl, points: 10 }]
      : []),
    { key: "C1", label: "Emergency contact", completed: input.hasEmergencyContact, points: 10 },
    {
      key: "D1",
      label: "Household declared",
      completed: input.householdStatus !== "NOT_SET",
      points: 10,
    },
    {
      key: "E1",
      label: "Vehicle declared",
      completed: input.vehicleStatus !== "NOT_SET",
      points: 10,
    },
  ];

  const possible = coreItems.reduce((s, i) => s + i.points, 0); // 90 or 100
  const earned = coreItems.filter((i) => i.completed).reduce((s, i) => s + i.points, 0);
  const percentage = Math.round((earned / possible) * 100);

  const tier: TierLabel =
    percentage >= 90
      ? "VERIFIED"
      : percentage >= 75
        ? "COMPLETE"
        : percentage >= 50
          ? "STANDARD"
          : "BASIC";

  const bonus: CompletenessBonus[] = [
    { key: "A5", label: "WhatsApp notifications", completed: input.consentWhatsapp },
    { key: "F1", label: "In society directory", completed: input.showInDirectory },
    {
      key: "C2",
      label: "Emergency contact blood group",
      completed: input.emergencyContactHasBloodGroup,
    },
  ];

  const nextIncompleteItem = coreItems.find((i) => !i.completed) ?? null;

  return { percentage, tier, earned, possible, items: coreItems, bonus, nextIncompleteItem };
}
```

---

### 8B — Schema: New User Fields

Already listed in the "Updates Required on Existing Models" section above. Summary:

- `bloodGroup BloodGroup?` — resident's own blood group
- `householdStatus HouseholdStatus @default(NOT_SET)`
- `vehicleStatus VehicleStatus @default(NOT_SET)`

**Migration SQL already included in Group 1B Step 7.**

---

### 8C — API: Extend `GET /api/v1/residents/me`

**File:** `src/app/api/v1/residents/me/route.ts`

Add `completeness: CompletenessResult` to the existing response. Requires two additional lightweight queries alongside the existing user fetch — run in `prisma.$transaction`:

```typescript
const [user, hasEmergencyContact, emergencyContactHasBloodGroup] = await prisma.$transaction([
  prisma.user.findUnique({ where: { ... }, ... }),  // existing query
  prisma.dependent.count({
    where: { userId, isEmergencyContact: true, isActive: true }
  }),
  prisma.dependent.count({
    where: { userId, isEmergencyContact: true, isActive: true, bloodGroup: { not: null } }
  }),
]);

const completeness = computeCompleteness({
  photoUrl: user.photoUrl,
  mobile: user.mobile,
  isEmailVerified: user.isEmailVerified,
  bloodGroup: user.bloodGroup,
  idProofUrl: user.idProofUrl,
  ownershipProofUrl: user.ownershipProofUrl,
  ownershipType: user.ownershipType,
  hasEmergencyContact: hasEmergencyContact > 0,
  householdStatus: user.householdStatus,
  vehicleStatus: user.vehicleStatus,
  consentWhatsapp: user.consentWhatsapp,
  showInDirectory: user.showInDirectory,
  emergencyContactHasBloodGroup: emergencyContactHasBloodGroup > 0,
});
```

Return `completeness` as a top-level field in the JSON response.

---

### 8D — API: `PATCH /api/v1/residents/me/profile`

**New file:** `src/app/api/v1/residents/me/profile/route.ts`

Handles fields that have no dedicated endpoint: blood group and household/vehicle declarations.

```typescript
// Allowed body fields:
// bloodGroup?       — any BloodGroup enum value
// householdStatus?  — only "DECLARED_NONE" accepted (HAS_ENTRIES is auto-set by family API)
// vehicleStatus?    — only "DECLARED_NONE" accepted (HAS_ENTRIES is auto-set by vehicle API)
```

**Validation rules:**

- Reject `householdStatus = HAS_ENTRIES` if sent directly (return 400: "This is set automatically")
- Reject `vehicleStatus = HAS_ENTRIES` if sent directly (same)
- Allow transitioning from `DECLARED_NONE` back to `NOT_SET` (resident changes their mind before adding entries)

Returns: `{ bloodGroup, householdStatus, vehicleStatus, completeness: CompletenessResult }`

---

### 8E — Resident Profile: Completeness Card _(UI already complete — skip during implementation)_

> The completeness card on `/r/profile/page.tsx` is done. The `PATCH /api/v1/residents/me/profile` endpoint (8D) is what this card calls — build the API, not the UI.

---

### 8F — Types Update

**File:** `src/types/user.ts`

```typescript
// Add these types
export type TierLabel = "BASIC" | "STANDARD" | "COMPLETE" | "VERIFIED";

export interface CompletenessItem {
  key: string;
  label: string;
  completed: boolean;
  points: number;
}

export interface CompletenessBonus {
  key: string;
  label: string;
  completed: boolean;
}

export interface CompletenessResult {
  percentage: number;
  tier: TierLabel;
  earned: number;
  possible: number;
  items: CompletenessItem[];
  bonus: CompletenessBonus[];
  nextIncompleteItem: CompletenessItem | null;
}

// Extend User interface with new fields:
// bloodGroup?: string | null;
// householdStatus?: "NOT_SET" | "DECLARED_NONE" | "HAS_ENTRIES";
// vehicleStatus?: "NOT_SET" | "DECLARED_NONE" | "HAS_ENTRIES";
// showInDirectory?: boolean;    (already added in Group 6)
```

---

### 8G — Admin: Completeness Badge + Filter

**File:** `src/app/admin/residents/page.tsx` _(UI already complete — skip during implementation)_

> Completeness column and filter dropdown in the admin residents page are done.

**File:** `src/app/api/v1/residents/route.ts`

**Changes:**

1. Add `completeness` query param: `"incomplete" | "basic" | "standard" | "complete" | "verified"`
2. For each resident returned, compute completeness via `computeCompleteness`
3. Include `hasEmergencyContact` per resident using Prisma's `_count` or `some` shorthand:
   ```typescript
   dependents: {
     where: { isEmergencyContact: true, isActive: true },
     select: { id: true },
     take: 1,   // only need to know if any exist
   }
   ```
4. After computing, filter by requested tier if `completeness` param is set
5. Add `completenessScore: number` and `tier: TierLabel` to each resident in the response

**Pagination note:** The completeness filter is applied after DB fetch (JS-side). This means a page of 20 residents may return fewer than 20 after filtering. This is acceptable for admin use — document in a code comment.

---

### 8H — Service Update

**File:** `src/services/residents.ts` (extend existing)

```typescript
// Add to getResidents params:
completeness?: "incomplete" | "basic" | "standard" | "complete" | "verified";
```

**New file:** `src/services/profile.ts` (or add to existing profile service)

```typescript
export async function updateProfileDeclarations(data: {
  bloodGroup?: string;
  householdStatus?: "DECLARED_NONE" | "NOT_SET";
  vehicleStatus?: "DECLARED_NONE" | "NOT_SET";
}): Promise<{ completeness: CompletenessResult }>;
```

---

### Tests (95% coverage required)

- `tests/lib/utils/profile-completeness.test.ts`
  - All tier boundary values: 0%, 49%, 50%, 74%, 75%, 89%, 90%, 100%
  - B2 conditional skip: ownershipType=OTHER → possible=90, score recalculates correctly
  - All 9 core items: each toggled individually
  - Bonus items: all 3 in each state
  - `nextIncompleteItem`: returns first incomplete item, null when all complete
  - `emergencyContactHasBloodGroup` bonus only counts when `hasEmergencyContact=true`

- `tests/app/api/v1/residents/me/profile/route.test.ts`
  - PATCH bloodGroup: valid enum value accepted, invalid rejected
  - PATCH householdStatus=DECLARED_NONE: accepted
  - PATCH householdStatus=HAS_ENTRIES: rejected with 400
  - PATCH vehicleStatus=DECLARED_NONE: accepted
  - PATCH vehicleStatus=HAS_ENTRIES: rejected with 400
  - Returns updated completeness object

- `tests/app/api/v1/residents/me/route.test.ts` (extend existing)
  - Response now includes `completeness` object
  - Completeness reflects current user data (photo=null → A1 incomplete)

- `tests/app/api/v1/residents/route.test.ts` (extend existing)
  - `?completeness=incomplete` filters correctly
  - `?completeness=verified` only returns 100% residents
  - Each resident in response has `completenessScore` and `tier`

---

## Open Questions (Confirm Before Group 1 Starts)

1. **`allowResidentVehicleSearch` society toggle** — ~~Add `allowResidentVehicleSearch Boolean @default(true)` to `Society` model?~~ **RESOLVED**: Added to schema and migration Step 9.

2. **`maxVehiclesPerUnit` limit** — ~~Add `maxVehiclesPerUnit Int @default(5)` to `Society`?~~ **RESOLVED**: Added to schema and migration Step 9. Vehicle POST must check `society.maxVehiclesPerUnit` (0 = unlimited).

3. **Admin can edit family members** — Current spec: admin is read-only. Allow admin to add/correct on behalf of residents during migration onboarding? Recommendation: defer to Phase 2, add a `POST /api/v1/residents/[id]/family` admin route later.

4. **Navigation placement for Family / Vehicles** — Should these be under a "Profile" submenu or standalone nav items in `/r/layout.tsx`? Confirm with the existing layout structure before Group 7.

5. **Directory opt-in default** — ~~Currently `showInDirectory = false` by default.~~ **RESOLVED**: See "Group 6 Migration SQL" section — one-time `UPDATE users SET show_in_directory = true WHERE status = 'ACTIVE'` runs before deploying the Group 6 UI, preserving existing directory behaviour.
