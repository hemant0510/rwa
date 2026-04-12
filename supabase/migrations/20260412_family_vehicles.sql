-- Migration: Family & Vehicle Registry
-- Date: 2026-04-12
-- Groups: Household Registry Plan — Group 1
-- Execution order matters — do not reorder steps.

-- ═══════════════════════════════════════════════════════
-- STEP 1: Create new enums
-- ═══════════════════════════════════════════════════════

CREATE TYPE "RelationshipType" AS ENUM (
  'SPOUSE','FATHER','MOTHER','SON','DAUGHTER','BROTHER','SISTER',
  'FATHER_IN_LAW','MOTHER_IN_LAW','SON_IN_LAW','DAUGHTER_IN_LAW',
  'GRANDFATHER','GRANDMOTHER','GRANDSON','GRANDDAUGHTER',
  'UNCLE','AUNT','NEPHEW','NIECE','COUSIN','GUARDIAN','OTHER'
);

CREATE TYPE "BloodGroup" AS ENUM (
  'A_POS','A_NEG','B_POS','B_NEG','AB_POS','AB_NEG','O_POS','O_NEG','UNKNOWN'
);

CREATE TYPE "VehicleType" AS ENUM (
  'TWO_WHEELER','TWO_WHEELER_EV','FOUR_WHEELER','FOUR_WHEELER_EV',
  'BICYCLE','COMMERCIAL','OTHER'
);

CREATE TYPE "PetType" AS ENUM (
  'DOG','CAT','BIRD','FISH','RABBIT','OTHER'
);

CREATE TYPE "PetApprovalStatus" AS ENUM (
  'PENDING_APPROVAL','APPROVED','REJECTED'
);

CREATE TYPE "HelperCategory" AS ENUM (
  'MAID','COOK','DRIVER','NANNY','GARDENER','WATCHMAN_PERSONAL','OTHER'
);

CREATE TYPE "HelperStatus" AS ENUM (
  'ACTIVE','INACTIVE'
);

CREATE TYPE "HouseholdStatus" AS ENUM (
  'NOT_SET','DECLARED_NONE','HAS_ENTRIES'
);

CREATE TYPE "VehicleStatus" AS ENUM (
  'NOT_SET','DECLARED_NONE','HAS_ENTRIES'
);

-- ═══════════════════════════════════════════════════════
-- STEP 2: Data migration — Vehicle.vehicleType string → enum
-- Must run BEFORE ALTER COLUMN
-- ═══════════════════════════════════════════════════════

UPDATE vehicles SET vehicle_type = CASE vehicle_type
  WHEN '2-Wheeler' THEN 'TWO_WHEELER'
  WHEN '4-Wheeler' THEN 'FOUR_WHEELER'
  WHEN 'EV'        THEN 'FOUR_WHEELER_EV'
  WHEN 'Bicycle'   THEN 'BICYCLE'
  ELSE 'OTHER'
END;

-- ═══════════════════════════════════════════════════════
-- STEP 3: Cast existing string columns to enums
-- ═══════════════════════════════════════════════════════

ALTER TABLE vehicles
  ALTER COLUMN vehicle_type TYPE "VehicleType"
  USING vehicle_type::"VehicleType";

ALTER TABLE dependents
  ALTER COLUMN relationship TYPE "RelationshipType"
  USING relationship::"RelationshipType";

-- ═══════════════════════════════════════════════════════
-- STEP 4: Add new columns to `dependents`
-- ═══════════════════════════════════════════════════════

ALTER TABLE dependents
  ADD COLUMN member_id       VARCHAR(60) UNIQUE,
  ADD COLUMN member_seq      INT NOT NULL DEFAULT 0,
  ADD COLUMN other_relationship VARCHAR(50),
  ADD COLUMN blood_group     "BloodGroup",
  ADD COLUMN mobile          VARCHAR(15),
  ADD COLUMN email           VARCHAR(100),
  ADD COLUMN occupation      VARCHAR(100),
  ADD COLUMN photo_url       VARCHAR(500),
  ADD COLUMN id_proof_url    VARCHAR(500),
  ADD COLUMN is_emergency_contact BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN emergency_priority   INT,
  ADD COLUMN medical_notes   VARCHAR(500),
  ADD COLUMN is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN deactivated_at  TIMESTAMPTZ,
  ADD COLUMN updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Assign member_seq to any existing dependents (1-based, per resident)
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) AS rn
  FROM dependents
)
UPDATE dependents d SET member_seq = n.rn FROM numbered n WHERE d.id = n.id;

-- ═══════════════════════════════════════════════════════
-- STEP 5: Add new columns to `vehicles`
-- ═══════════════════════════════════════════════════════

ALTER TABLE vehicles
  ADD COLUMN owner_id             UUID REFERENCES users(id),
  ADD COLUMN dependent_owner_id   UUID REFERENCES dependents(id),
  ADD COLUMN vehicle_photo_url    VARCHAR(500),
  ADD COLUMN rc_doc_url           VARCHAR(500),
  ADD COLUMN rc_expiry            DATE,
  ADD COLUMN insurance_url        VARCHAR(500),
  ADD COLUMN insurance_expiry     DATE,
  ADD COLUMN puc_expiry           DATE,
  ADD COLUMN fastag_id            VARCHAR(30),
  ADD COLUMN notes                VARCHAR(300);

-- Backfill owner_id from unit's primary owner for existing vehicles
UPDATE vehicles v
SET owner_id = u.primary_owner_id
FROM units u
WHERE v.unit_id = u.id AND u.primary_owner_id IS NOT NULL;

-- Fallback: for vehicles where unit has no primary_owner_id
UPDATE vehicles v
SET owner_id = uu.user_id
FROM user_units uu
WHERE v.owner_id IS NULL AND v.unit_id = uu.unit_id AND uu.user_id IS NOT NULL;

-- Verify: SELECT COUNT(*) FROM vehicles WHERE owner_id IS NULL;
-- If count > 0, assign a placeholder admin or log for manual resolution.
ALTER TABLE vehicles ALTER COLUMN owner_id SET NOT NULL;

-- ═══════════════════════════════════════════════════════
-- STEP 6: Create new tables — pets & domestic_helpers
-- ═══════════════════════════════════════════════════════

CREATE TABLE pets (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES users(id),
  society_id       UUID        NOT NULL REFERENCES societies(id),
  pet_id           VARCHAR(60) UNIQUE,
  pet_seq          INT         NOT NULL,
  name             VARCHAR(50) NOT NULL,
  pet_type         "PetType"   NOT NULL,
  breed            VARCHAR(50),
  colour           VARCHAR(30),
  date_of_birth    DATE,
  photo_url        VARCHAR(500),
  vaccination_url  VARCHAR(500),
  license_url      VARCHAR(500),
  approval_status  "PetApprovalStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
  approved_by_id   UUID REFERENCES users(id),
  approved_at      TIMESTAMPTZ,
  rejected_reason  TEXT,
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, pet_seq)
);

CREATE TABLE domestic_helpers (
  id                    UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID             NOT NULL REFERENCES users(id),
  society_id            UUID             NOT NULL REFERENCES societies(id),
  helper_id             VARCHAR(60)      UNIQUE,
  helper_seq            INT              NOT NULL,
  name                  VARCHAR(100)     NOT NULL,
  category              "HelperCategory" NOT NULL,
  other_category        VARCHAR(50),
  mobile                VARCHAR(15),
  id_proof_url          VARCHAR(500),
  photo_url             VARCHAR(500),
  police_verified       BOOLEAN          NOT NULL DEFAULT FALSE,
  police_verif_doc_url  VARCHAR(500),
  entry_time_from       VARCHAR(5),
  entry_time_to         VARCHAR(5),
  entry_days            JSONB,
  address               VARCHAR(300),
  status                "HelperStatus"   NOT NULL DEFAULT 'ACTIVE',
  created_at            TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, helper_seq)
);

-- ═══════════════════════════════════════════════════════
-- STEP 7: Add columns to users & societies
-- ═══════════════════════════════════════════════════════

ALTER TABLE users
  ADD COLUMN show_in_directory         BOOLEAN          NOT NULL DEFAULT FALSE,
  ADD COLUMN show_phone_in_directory   BOOLEAN          NOT NULL DEFAULT FALSE,
  ADD COLUMN blood_group               "BloodGroup",
  ADD COLUMN household_status          "HouseholdStatus" NOT NULL DEFAULT 'NOT_SET',
  ADD COLUMN vehicle_status            "VehicleStatus"   NOT NULL DEFAULT 'NOT_SET';

ALTER TABLE societies
  ADD COLUMN allow_resident_vehicle_search BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN max_vehicles_per_unit         INT     NOT NULL DEFAULT 5;

-- ═══════════════════════════════════════════════════════
-- STEP 8: Indexes
-- NOTE: idx_vehicles_society_reg (society_id, registration_number) already exists.
-- ═══════════════════════════════════════════════════════

CREATE INDEX idx_dependents_society_user  ON dependents(society_id, user_id);
CREATE INDEX idx_vehicles_society_owner   ON vehicles(society_id, owner_id);
CREATE UNIQUE INDEX idx_dependents_user_seq ON dependents(user_id, member_seq);

-- ═══════════════════════════════════════════════════════
-- STEP 9: RLS Policies
-- ═══════════════════════════════════════════════════════

-- dependents: resident owns their own; admin reads all in their society
ALTER TABLE dependents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "residents_own_dependents" ON dependents
  USING (user_id = auth.uid());

CREATE POLICY "admin_read_society_dependents" ON dependents
  FOR SELECT USING (
    society_id IN (
      SELECT society_id FROM users WHERE id = auth.uid() AND role = 'RWA_ADMIN'
    )
  );

-- pets: same pattern
ALTER TABLE pets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "residents_own_pets" ON pets
  USING (user_id = auth.uid());

CREATE POLICY "admin_read_society_pets" ON pets
  FOR SELECT USING (
    society_id IN (
      SELECT society_id FROM users WHERE id = auth.uid() AND role = 'RWA_ADMIN'
    )
  );

-- domestic_helpers: same pattern
ALTER TABLE domestic_helpers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "residents_own_helpers" ON domestic_helpers
  USING (user_id = auth.uid());

CREATE POLICY "admin_read_society_helpers" ON domestic_helpers
  FOR SELECT USING (
    society_id IN (
      SELECT society_id FROM users WHERE id = auth.uid() AND role = 'RWA_ADMIN'
    )
  );

-- vehicles: owner OR admin in same society
ALTER TABLE vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "residents_own_vehicles" ON vehicles
  USING (owner_id = auth.uid());

CREATE POLICY "admin_read_society_vehicles" ON vehicles
  FOR SELECT USING (
    society_id IN (
      SELECT society_id FROM users WHERE id = auth.uid() AND role = 'RWA_ADMIN'
    )
  );

-- ═══════════════════════════════════════════════════════
-- STEP 10: Storage Buckets
-- Create via Supabase Dashboard → Storage → New Bucket, or via supabase-js in a seed script.
-- Buckets required:
--   dependent-photos  (Public)           — family member face photos
--   dependent-docs    (Private/signed)   — ID proof (Aadhaar, passport)
--   vehicle-photos    (Public)           — vehicle exterior
--   vehicle-docs      (Private/signed)   — RC certificate, insurance
--   pet-photos        (Public)           — Phase 2
--   pet-docs          (Private)          — Phase 2
--   helper-photos     (Public)           — Phase 2
--   helper-docs       (Private)          — Phase 2
-- ═══════════════════════════════════════════════════════
