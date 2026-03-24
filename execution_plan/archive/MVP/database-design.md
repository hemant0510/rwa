# MVP Database Design — Complete Schema

**Source**: Adapted from `execution_plan/database-design.md` (full product schema) with MVP v2-specific adjustments.
**ORM**: Prisma with PostgreSQL (Supabase)
**Strategy**: Build the FULL schema on day 1 — even Phase 2+ tables as stubs. Zero migration pain later.
**Note**: The main Prisma schema is in `prisma/schema.prisma`. This document describes the design decisions and adjustments only.

---

## MVP v2 Adjustments from Full Spec

| Area                | Full Spec                                                                | MVP v2 Change                                                                      |
| ------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| **Auth**            | OTP/mobile for admin+resident                                            | **Email/password for ALL users**. No OTP/mobile login.                             |
| **Super Admin**     | In `users` table with SUPER_ADMIN role                                   | **Separate `super_admins` table** (not in `users` table)                           |
| **User.email**      | Optional                                                                 | **Required** (used for login)                                                      |
| **User.mobile**     | Required (used for OTP login)                                            | **Optional** (kept for WhatsApp notifications only)                                |
| **UserRole enum**   | SUPER_ADMIN, RWA_ADMIN, RESIDENT                                         | **RWA_ADMIN, RESIDENT only** (no SUPER_ADMIN — separate table)                     |
| **Vehicle model**   | Not in MVP v1                                                            | **New model**: self-service add/remove, type, regNumber, make, model, colour       |
| **Unit fields**     | Simple (house_no, block, floor)                                          | **Add**: unitType, areaInSqft, parkingSlotsAllotted, evChargingSlot, unitStatus    |
| Society types       | 4 types (APARTMENT, INDEPENDENT_SECTOR, BUILDER_FLOORS, GATED_COMMUNITY) | **5 types** — add PLOTTED_COLONY, rename GATED_COMMUNITY to GATED_COMMUNITY_VILLAS |
| Society fees        | No per-society fee columns                                               | **Add** `joining_fee` and `annual_fee` columns on `societies`                      |
| Society Code        | Auto-generated from name                                                 | **Admin-chosen** (4-8 alphanumeric, unique)                                        |
| Units table         | Simple (house_no, block, floor)                                          | **Dynamic fields** per society type (tower, villa_no, plot_no, sector_block, etc.) |
| Admin permissions   | 5 positions + 5 permission levels                                        | **2 only**: FULL_ACCESS (Primary) + READ_NOTIFY (Supporting)                       |
| Admin positions     | 6 positions (President through Executive Member)                         | **2 only**: PRIMARY + SUPPORTING                                                   |
| Subscription plan   | 4 tiers                                                                  | Kept but **only BASIC used** for MVP                                               |
| Registration fields | 8+ mandatory                                                             | **4 mandatory** (name, email, unit, ownership). Mobile optional.                   |
| **RWAID**           | String + PDF card + QR code                                              | **String only** (no PDF card, no QR, no WhatsApp image)                            |
| **Registration**    | Society Code self-reg + invite-link                                      | **Invite-link only** (no Society Code Path B in Phase 1)                           |
| **SMS**             | Full fallback for all notifications                                      | **OTP only** (no full SMS fallback stack)                                          |

---

## Enum Types

```sql
-- ═══════════════════════════════════════════════════
-- USER & SOCIETY ENUMS
-- ═══════════════════════════════════════════════════

CREATE TYPE society_status AS ENUM ('ACTIVE', 'TRIAL', 'SUSPENDED', 'OFFBOARDED');

-- MVP: 5 society types (determines unit address fields)
CREATE TYPE society_type AS ENUM (
  'APARTMENT_COMPLEX',         -- Tower/Block + Floor + Flat
  'BUILDER_FLOORS',            -- House No + Floor Level (GF/1F/2F/3F/Terrace)
  'GATED_COMMUNITY_VILLAS',   -- Villa No + Street/Phase
  'INDEPENDENT_SECTOR',        -- House No + Street/Gali + Sector/Block
  'PLOTTED_COLONY'             -- Plot No + Lane No + Phase
);

CREATE TYPE subscription_plan AS ENUM ('BASIC', 'STANDARD', 'PREMIUM', 'ENTERPRISE');

-- MVP v2: SUPER_ADMIN removed (super admins live in separate `super_admins` table)
CREATE TYPE user_role AS ENUM ('RWA_ADMIN', 'RESIDENT');

CREATE TYPE ownership_type AS ENUM ('OWNER', 'TENANT');
-- MVP: Only 2. Full spec adds: OWNER_NRO, JOINT_OWNER (Phase 2)

-- MVP: Simplified admin permissions (2 levels only)
CREATE TYPE admin_permission AS ENUM ('FULL_ACCESS', 'READ_NOTIFY');
-- FULL_ACCESS = Primary Admin (everything)
-- READ_NOTIFY = Supporting Admin (view all, send broadcasts only)

-- MVP: Simplified admin positions (2 only)
CREATE TYPE admin_position AS ENUM ('PRIMARY', 'SUPPORTING');
-- Full spec has: PRESIDENT, VICE_PRESIDENT, SECRETARY, JOINT_SECRETARY, TREASURER, EXECUTIVE_MEMBER

-- ═══════════════════════════════════════════════════
-- RESIDENT STATUS
-- ═══════════════════════════════════════════════════

CREATE TYPE resident_status AS ENUM (
  'PENDING_APPROVAL',          -- Just registered, awaiting admin review
  'ACTIVE_PAID',               -- Approved + fees paid
  'ACTIVE_PENDING',            -- Approved + fees pending (within grace)
  'ACTIVE_OVERDUE',            -- Approved + fees overdue (past grace)
  'ACTIVE_PARTIAL',            -- Approved + partial payment
  'ACTIVE_EXEMPTED',           -- Approved + fees exempted
  'REJECTED',                  -- Admin rejected registration
  'MIGRATED_PENDING',          -- Bulk imported, not yet activated
  'DORMANT',                   -- Migrated but never activated (60+ days)
  'DEACTIVATED',               -- Manually deactivated by admin
  'TRANSFERRED_DEACTIVATED',   -- Ownership transferred, account deactivated
  'TENANT_DEPARTED'            -- Tenant left the unit
);

-- ═══════════════════════════════════════════════════
-- FEE ENUMS
-- ═══════════════════════════════════════════════════

CREATE TYPE fee_status AS ENUM (
  'NOT_YET_DUE',               -- New member, session not started
  'PENDING',                   -- Session started, within grace period
  'OVERDUE',                   -- Past grace period, unpaid
  'PARTIAL',                   -- Some payment, balance remaining
  'PAID',                      -- Full amount received
  'EXEMPTED'                   -- Admin exempted with reason
);
-- Full spec adds: ADVANCE_PAID, LIFETIME (Phase 2)

CREATE TYPE payment_mode AS ENUM ('CASH', 'UPI', 'BANK_TRANSFER', 'OTHER');
-- Full spec adds: CHEQUE, ONLINE (Phase 2 with gateway)

-- ═══════════════════════════════════════════════════
-- EXPENSE ENUMS
-- ═══════════════════════════════════════════════════

CREATE TYPE expense_status AS ENUM ('ACTIVE', 'REVERSED');

CREATE TYPE expense_category AS ENUM (
  'MAINTENANCE', 'SECURITY', 'CLEANING', 'STAFF_SALARY',
  'INFRASTRUCTURE', 'UTILITIES', 'EMERGENCY', 'ADMINISTRATIVE', 'OTHER'
);
-- Full spec adds: FESTIVAL, LEGAL (Phase 2)

-- ═══════════════════════════════════════════════════
-- NOTIFICATION ENUMS
-- ═══════════════════════════════════════════════════

CREATE TYPE notification_channel AS ENUM ('WHATSAPP', 'SMS');
-- Full spec adds: PUSH, EMAIL (Phase 2)

CREATE TYPE notification_status AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'READ', 'FAILED');

-- ═══════════════════════════════════════════════════
-- ADMIN TERM ENUMS
-- ═══════════════════════════════════════════════════

CREATE TYPE admin_term_status AS ENUM ('ACTIVE', 'EXPIRED', 'EXTENDED', 'RESIGNED', 'REMOVED');

-- ═══════════════════════════════════════════════════
-- PHASE 2 STUB ENUMS (created now, used later)
-- ═══════════════════════════════════════════════════

CREATE TYPE festival_status AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE disposal_type AS ENUM ('REFUNDED', 'TRANSFERRED_TO_FUND', 'CARRIED_FORWARD');
CREATE TYPE query_status AS ENUM ('OPEN', 'RESPONDED', 'ESCALATED', 'UNDER_REVIEW', 'RESOLVED');
CREATE TYPE transfer_type AS ENUM ('OWNERSHIP_SALE', 'TENANT_DEPARTURE', 'BUILDER_FLOOR_PARTIAL', 'INHERITANCE');
CREATE TYPE migration_row_status AS ENUM ('VALID', 'ERROR', 'SKIPPED', 'IMPORTED');
```

---

## Core Tables (MVP Active)

### 1. societies

The root tenant entity. All data is scoped to this.

**MVP additions**: `joining_fee`, `annual_fee`, `fee_session_start_month` columns. `society_code` is admin-chosen (not auto-generated).

```sql
CREATE TABLE societies (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id            VARCHAR(30) UNIQUE NOT NULL,     -- RWA-HR-GGN-122001-0001
  society_code          VARCHAR(8) UNIQUE NOT NULL,      -- EDENESTATE (admin-chosen, 4-8 alphanum)
  name                  VARCHAR(200) NOT NULL,
  registration_no       VARCHAR(50),                      -- Societies Registration Act number (optional)
  state                 VARCHAR(2) NOT NULL,              -- ISO state code (HR, DL, MH)
  city                  VARCHAR(50) NOT NULL,             -- Full city name for display
  city_code             VARCHAR(3) NOT NULL,              -- Abbreviated for Society ID (GGN, MUM)
  pincode               VARCHAR(6) NOT NULL,
  type                  society_type NOT NULL,
  total_units           INTEGER NOT NULL DEFAULT 0,

  -- MVP: Configurable fees per society
  joining_fee           DECIMAL(10,2) NOT NULL DEFAULT 1000,
  annual_fee            DECIMAL(10,2) NOT NULL DEFAULT 1200,
  fee_session_start_month INTEGER NOT NULL DEFAULT 4,     -- April = 4
  grace_period_days     INTEGER NOT NULL DEFAULT 15,

  -- Subscription
  plan                  subscription_plan NOT NULL DEFAULT 'BASIC',
  status                society_status NOT NULL DEFAULT 'ACTIVE',
  subscription_expires_at TIMESTAMPTZ,
  trial_ends_at         TIMESTAMPTZ,

  -- Metadata
  onboarding_date       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Society ID generation: RWA-[STATE]-[CITY3]-[PINCODE]-[SEQ]
-- SEQ = count existing societies with same pincode + 1, zero-padded to 4 digits

CREATE INDEX idx_societies_pincode ON societies(pincode);
CREATE INDEX idx_societies_status ON societies(status);
CREATE INDEX idx_societies_state_city ON societies(state, city_code);
CREATE INDEX idx_societies_code ON societies(society_code);
```

**Society ID Generation Algorithm**:

```
Input: state=HR, city=Gurgaon, pincode=122001
1. city_code = GGN (first 3 consonants or abbreviation — admin can override)
2. seq = SELECT COUNT(*) + 1 FROM societies WHERE pincode = '122001'
3. society_id = "RWA-HR-GGN-122001-" + zeroPad(seq, 4)
Result: RWA-HR-GGN-122001-0001
```

---

### 2. super_admins (NEW in v2)

Super Admins are in a **separate table** (not in `users`). They log in via email/password at `/super-admin-login`.

```sql
CREATE TABLE super_admins (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id          UUID UNIQUE NOT NULL,              -- Supabase Auth user ID
  email                 VARCHAR(100) UNIQUE NOT NULL,
  name                  VARCHAR(100) NOT NULL,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 3. users

RWA Admins and Residents only (no Super Admin in this table).

**MVP v2**: Auth is email/password. `email` is **required** (used for login). `mobile` is **optional** (kept for WhatsApp notifications). Only 4 mandatory fields at registration: name, email, unit, ownership.

```sql
CREATE TABLE users (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id            UUID REFERENCES societies(id),
  rwaid                 VARCHAR(40) UNIQUE,                -- RWA-HR-GGN-122001-0001-2025-0089
  auth_user_id          UUID UNIQUE,                       -- Supabase Auth user ID

  -- Identity (name + email mandatory for MVP v2 registration; mobile optional)
  name                  VARCHAR(100) NOT NULL,
  email                 VARCHAR(100) NOT NULL,             -- REQUIRED in v2 (used for login)
  mobile                VARCHAR(15),                       -- OPTIONAL in v2 (kept for WhatsApp)
  photo_url             VARCHAR(500),
  id_proof_url          VARCHAR(500),

  -- Role & ownership (SUPER_ADMIN removed — see super_admins table)
  role                  user_role NOT NULL,                 -- RWA_ADMIN or RESIDENT only
  ownership_type        ownership_type,
  status                resident_status NOT NULL DEFAULT 'PENDING_APPROVAL',

  -- Admin permissions (NULL for non-admins)
  admin_permission      admin_permission,                  -- FULL_ACCESS or READ_NOTIFY

  -- Consent (WhatsApp consent — optional since mobile is optional)
  consent_whatsapp      BOOLEAN NOT NULL DEFAULT false,
  consent_whatsapp_at   TIMESTAMPTZ,

  -- Security (PIN removed in v2 — auth is email/password via Supabase Auth)

  -- Financial
  joining_fee_paid      BOOLEAN NOT NULL DEFAULT false,

  -- Lifecycle timestamps
  registered_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at           TIMESTAMPTZ,
  approved_by           UUID REFERENCES users(id),
  rejected_at           TIMESTAMPTZ,
  rejected_by           UUID REFERENCES users(id),
  rejection_reason      TEXT,
  activated_at          TIMESTAMPTZ,                       -- First login after approval
  deactivated_at        TIMESTAMPTZ,
  deactivation_reason   TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Email unique per society (not globally — same person can be in multiple societies)
  UNIQUE(society_id, email)
);

CREATE INDEX idx_users_society ON users(society_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_rwaid ON users(rwaid);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_mobile ON users(mobile);
CREATE INDEX idx_users_auth ON users(auth_user_id);
```

**RWAID Generation Algorithm**:

```
Input: society_id=RWA-HR-GGN-122001-0001, year=2025
1. resident_seq = SELECT COUNT(*) + 1 FROM users WHERE society_id = [society] AND rwaid IS NOT NULL
2. rwaid = society_id + "-" + year + "-" + zeroPad(resident_seq, 4)
Result: RWA-HR-GGN-122001-0001-2025-0089
Short Display: #0089
```

---

### 4. units

Physical property units — houses, flats, villas, plots.

**MVP change**: Dynamic address fields per society type. All fields nullable — only the relevant ones are filled based on society type.

**New in v2**: Added `unit_type`, `area_in_sqft`, `parking_slots_allotted`, `ev_charging_slot`, `unit_status` fields.

```sql
CREATE TABLE units (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id            UUID NOT NULL REFERENCES societies(id),

  -- Display label (auto-generated from type-specific fields)
  display_label         VARCHAR(50) NOT NULL,              -- "B-12-1204" or "S22-St7-H245"

  -- Apartment Complex fields
  tower_block           VARCHAR(20),                       -- Tower A, Block B
  floor_no              VARCHAR(10),                       -- 1, 2, 12, G
  flat_no               VARCHAR(20),                       -- 1204, A-101

  -- Builder Floor fields
  house_no              VARCHAR(20),                       -- 42, 245
  floor_level           VARCHAR(10),                       -- GF, 1F, 2F, 3F, Terrace

  -- Gated Community Villas fields
  villa_no              VARCHAR(20),                       -- 17, A-12
  street_phase          VARCHAR(30),                       -- Phase 2, Street 5

  -- Independent Sector fields
  sector_block          VARCHAR(20),                       -- Sector 22, Block A
  street_gali           VARCHAR(20),                       -- Street 7, Gali 3

  -- Plotted Colony fields
  plot_no               VARCHAR(20),                       -- 89, A-23
  lane_no               VARCHAR(20),                       -- Lane 4

  -- Shared optional field
  phase                 VARCHAR(20),                       -- Phase 1, Phase 2

  -- NEW in v2: Unit metadata
  unit_type             VARCHAR(30),                       -- e.g. "2BHK", "3BHK", "Villa", "Plot"
  area_in_sqft          DECIMAL(10,2),                     -- Built-up or plot area
  parking_slots_allotted INTEGER NOT NULL DEFAULT 0,       -- Number of parking slots for this unit
  ev_charging_slot      BOOLEAN NOT NULL DEFAULT false,    -- Has EV charging slot
  unit_status           VARCHAR(20) NOT NULL DEFAULT 'OCCUPIED', -- OCCUPIED, VACANT, UNDER_CONSTRUCTION

  -- Occupancy
  primary_owner_id      UUID REFERENCES users(id),
  current_tenant_id     UUID REFERENCES users(id),

  -- Metadata
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_units_society ON units(society_id);
CREATE INDEX idx_units_owner ON units(primary_owner_id);
CREATE INDEX idx_units_tenant ON units(current_tenant_id);
CREATE INDEX idx_units_display ON units(society_id, display_label);
```

**Display Label Generation per Society Type**:

```
APARTMENT_COMPLEX:        "{tower_block}-{floor_no}-{flat_no}"           → "B-12-1204"
BUILDER_FLOORS:           "{house_no}-{floor_level}"                     → "42-1F"
GATED_COMMUNITY_VILLAS:   "Villa-{villa_no}-{street_phase_abbr}"         → "Villa-17-P2"
INDEPENDENT_SECTOR:       "S{sector_block}-St{street_gali}-H{house_no}" → "S22-St7-H245"
PLOTTED_COLONY:           "Plot-{plot_no}-L{lane_no}"                    → "Plot-89-L4"
```

**Required fields per society type**:
| Society Type | Required | Optional |
|---|---|---|
| APARTMENT_COMPLEX | tower_block, floor_no, flat_no | — |
| BUILDER_FLOORS | house_no, floor_level | — |
| GATED_COMMUNITY_VILLAS | villa_no | street_phase |
| INDEPENDENT_SECTOR | house_no, street_gali, sector_block | — |
| PLOTTED_COLONY | plot_no | lane_no, phase |

---

### 5. vehicles (NEW in v2)

Self-service vehicle registration. Residents can add/remove their own vehicles.

```sql
CREATE TABLE vehicles (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id               UUID NOT NULL REFERENCES units(id),
  society_id            UUID NOT NULL REFERENCES societies(id),

  -- Vehicle details
  vehicle_type          VARCHAR(20) NOT NULL,              -- CAR, BIKE, SCOOTER, EV, OTHER
  registration_number   VARCHAR(20) NOT NULL,              -- e.g. HR26CA1234
  make                  VARCHAR(50),                       -- e.g. Maruti, Honda
  model                 VARCHAR(50),                       -- e.g. Swift, Activa
  colour                VARCHAR(30),                       -- e.g. White, Silver

  -- Parking (Phase 2 features — stub fields, not used in MVP)
  parking_slot          VARCHAR(20),                       -- Deferred: parking slot approval
  sticker_number        VARCHAR(20),                       -- Deferred: sticker management
  ev_slot               BOOLEAN NOT NULL DEFAULT false,

  -- Validity
  valid_from            TIMESTAMPTZ NOT NULL DEFAULT now(),
  valid_to              TIMESTAMPTZ,                       -- NULL = no expiry
  is_active             BOOLEAN NOT NULL DEFAULT true,

  -- Metadata
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vehicles_unit ON vehicles(unit_id);
CREATE INDEX idx_vehicles_society ON vehicles(society_id);
CREATE INDEX idx_vehicles_registration ON vehicles(registration_number);
CREATE INDEX idx_vehicles_active ON vehicles(society_id, is_active);
```

---

### 6. user_units (Join table — residents linked to units)

```sql
CREATE TABLE user_units (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id),
  unit_id               UUID NOT NULL REFERENCES units(id),
  is_primary            BOOLEAN NOT NULL DEFAULT true,     -- Primary resident vs secondary
  relationship          VARCHAR(20) NOT NULL DEFAULT 'OWNER', -- OWNER, TENANT
  linked_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  unlinked_at           TIMESTAMPTZ,

  UNIQUE(user_id, unit_id)
);

CREATE INDEX idx_user_units_user ON user_units(user_id);
CREATE INDEX idx_user_units_unit ON user_units(unit_id);
```

---

### 7. membership_fees

Session-wise fee records per user. One record per user per financial session.

```sql
CREATE TABLE membership_fees (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id),
  unit_id               UUID REFERENCES units(id),
  society_id            UUID NOT NULL REFERENCES societies(id),

  -- Session
  session_year          VARCHAR(7) NOT NULL,               -- "2025-26"
  session_start         DATE NOT NULL,                     -- 2025-04-01
  session_end           DATE NOT NULL,                     -- 2026-03-31

  -- Amounts
  amount_due            DECIMAL(10,2) NOT NULL,
  amount_paid           DECIMAL(10,2) NOT NULL DEFAULT 0,
  balance               DECIMAL(10,2) GENERATED ALWAYS AS (amount_due - amount_paid) STORED,

  -- Status
  status                fee_status NOT NULL DEFAULT 'NOT_YET_DUE',
  grace_period_end      DATE,                              -- Session start + 15 days

  -- Pro-rata (for mid-year joiners)
  is_prorata            BOOLEAN NOT NULL DEFAULT false,
  prorata_months        INTEGER,                           -- Remaining months when joined
  joining_fee_included  BOOLEAN NOT NULL DEFAULT false,    -- First-ever payment includes joining fee

  -- Exemption
  exemption_reason      TEXT,
  exempted_by           UUID REFERENCES users(id),
  exempted_at           TIMESTAMPTZ,

  -- Migration marker
  is_pre_migration      BOOLEAN NOT NULL DEFAULT false,    -- Historical arrear from before platform

  -- Metadata
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fees_society ON membership_fees(society_id);
CREATE INDEX idx_fees_user ON membership_fees(user_id);
CREATE INDEX idx_fees_session ON membership_fees(session_year);
CREATE INDEX idx_fees_status ON membership_fees(status);
CREATE UNIQUE INDEX idx_fees_user_session ON membership_fees(user_id, session_year)
  WHERE is_pre_migration = false;
```

**Pro-Rata Calculation** (stored at approval time):

```
approval_month = month of admin approval (e.g., July = 7)
session_start_month = society.fee_session_start_month (e.g., April = 4)
remaining_months = 12 - (approval_month - session_start_month)
  → if approval_month < session_start_month: remaining_months = session_start_month - approval_month
monthly_rate = society.annual_fee / 12
prorata_amount = monthly_rate * remaining_months
amount_due = society.joining_fee + prorata_amount  (if first payment)
           = prorata_amount                        (if already a member)
```

---

### 8. fee_payments

Individual payment entries against a fee record. Supports partial payments, corrections, and reversals.

```sql
CREATE TABLE fee_payments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_id                UUID NOT NULL REFERENCES membership_fees(id),
  user_id               UUID NOT NULL REFERENCES users(id),
  society_id            UUID NOT NULL REFERENCES societies(id),

  -- Payment details
  amount                DECIMAL(10,2) NOT NULL,            -- Negative for reversals
  payment_mode          payment_mode NOT NULL,
  reference_no          VARCHAR(50),                       -- Mandatory for UPI/Bank Transfer
  receipt_no            VARCHAR(50) UNIQUE NOT NULL,       -- EDENESTATE-2025-R0042
  receipt_url           VARCHAR(500),                      -- PDF URL in Supabase Storage
  payment_date          DATE NOT NULL,
  notes                 TEXT,

  -- Recording
  recorded_by           UUID NOT NULL REFERENCES users(id),

  -- Reversal tracking
  is_reversal           BOOLEAN NOT NULL DEFAULT false,
  reversal_of           UUID REFERENCES fee_payments(id),  -- Points to original payment
  reversal_reason       TEXT,
  is_reversed           BOOLEAN NOT NULL DEFAULT false,    -- Original marked as reversed

  -- Correction window (48 hours from recording)
  correction_window_ends TIMESTAMPTZ,

  -- Metadata
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Receipt number format: [SOCIETY_CODE]-[YEAR]-R[SEQ]
-- Example: EDENESTATE-2025-R0042

CREATE INDEX idx_payments_society ON fee_payments(society_id);
CREATE INDEX idx_payments_fee ON fee_payments(fee_id);
CREATE INDEX idx_payments_user ON fee_payments(user_id);
CREATE INDEX idx_payments_date ON fee_payments(payment_date);
CREATE INDEX idx_payments_receipt ON fee_payments(receipt_no);
```

---

### 9. expenses

Society expense ledger. Chronological log with categories.

```sql
CREATE TABLE expenses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id            UUID NOT NULL REFERENCES societies(id),

  -- Expense details
  date                  DATE NOT NULL,
  amount                DECIMAL(10,2) NOT NULL,
  category              expense_category NOT NULL,
  description           TEXT NOT NULL,
  receipt_url           VARCHAR(500),                      -- Photo/PDF of receipt

  -- Recording
  logged_by             UUID NOT NULL REFERENCES users(id),

  -- Reversal tracking
  status                expense_status NOT NULL DEFAULT 'ACTIVE',
  reversal_note         TEXT,
  reversed_by           UUID REFERENCES users(id),
  reversed_at           TIMESTAMPTZ,

  -- Correction window (24 hours from logging)
  correction_window_ends TIMESTAMPTZ,

  -- Metadata
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_expenses_society ON expenses(society_id);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_status ON expenses(status);
```

**Running Balance Calculation** (not stored — computed at query time for MVP):

```sql
SELECT
  (SELECT COALESCE(SUM(amount_paid), 0) FROM membership_fees
   WHERE society_id = ? AND session_year = ?)
  -
  (SELECT COALESCE(SUM(amount), 0) FROM expenses
   WHERE society_id = ? AND status = 'ACTIVE'
   AND date BETWEEN session_start AND session_end)
AS balance_in_hand;
```

---

### 10. notifications

WhatsApp/SMS delivery tracking.

```sql
CREATE TABLE notifications (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id),
  society_id            UUID REFERENCES societies(id),     -- NULL for Super Admin notifications

  -- Message details
  type                  VARCHAR(50) NOT NULL,               -- REGISTRATION_SUBMITTED, PAYMENT_RECORDED, etc.
  channel               notification_channel NOT NULL,
  template_name         VARCHAR(100),                       -- WhatsApp template name
  content_vars          JSONB,                              -- {Name: "Hemant", Amount: "1200"}
  content_preview       TEXT,                               -- Rendered message preview

  -- Delivery
  status                notification_status NOT NULL DEFAULT 'QUEUED',
  sent_at               TIMESTAMPTZ,
  delivered_at          TIMESTAMPTZ,
  read_at               TIMESTAMPTZ,
  failed_reason         TEXT,
  retry_count           INTEGER NOT NULL DEFAULT 0,

  -- Broadcast grouping
  broadcast_id          UUID,                               -- Groups messages from same broadcast

  -- Metadata
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_society ON notifications(society_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_broadcast ON notifications(broadcast_id);
CREATE INDEX idx_notifications_type ON notifications(type);
```

---

### 11. broadcasts

Manual broadcast records (separate from individual notifications).

```sql
CREATE TABLE broadcasts (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id            UUID NOT NULL REFERENCES societies(id),
  sent_by               UUID NOT NULL REFERENCES users(id),

  -- Content
  message               TEXT NOT NULL,
  recipient_filter      VARCHAR(30) NOT NULL,               -- ALL_ACTIVE, FEE_PENDING, FEE_OVERDUE, CUSTOM
  recipient_count       INTEGER NOT NULL,

  -- Delivery stats
  delivered_count       INTEGER NOT NULL DEFAULT 0,
  failed_count          INTEGER NOT NULL DEFAULT 0,

  -- Metadata
  sent_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_broadcasts_society ON broadcasts(society_id);
```

---

### 12. audit_logs

Immutable operation log. **INSERT only — no UPDATE or DELETE ever.**

```sql
CREATE TABLE audit_logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id            UUID REFERENCES societies(id),
  user_id               UUID NOT NULL REFERENCES users(id),
  action_type           VARCHAR(20) NOT NULL,               -- CREATE, UPDATE, DELETE, STATUS_CHANGE
  entity_type           VARCHAR(30) NOT NULL,               -- USER, FEE_PAYMENT, EXPENSE, etc.
  entity_id             UUID NOT NULL,
  old_value             JSONB,                              -- Before state (for updates)
  new_value             JSONB,                              -- After state
  ip_address            INET,
  user_agent            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_society ON audit_logs(society_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_date ON audit_logs(created_at);
CREATE INDEX idx_audit_action ON audit_logs(action_type);

-- CRITICAL: No UPDATE or DELETE permissions on this table. INSERT only.
```

---

### 13. migration_batches

Tracks bulk Excel import operations.

```sql
CREATE TABLE migration_batches (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id            UUID NOT NULL REFERENCES societies(id),
  uploaded_by           UUID NOT NULL REFERENCES users(id),
  file_url              VARCHAR(500) NOT NULL,
  total_rows            INTEGER NOT NULL,
  valid_rows            INTEGER NOT NULL DEFAULT 0,
  error_rows            INTEGER NOT NULL DEFAULT 0,
  imported_rows         INTEGER NOT NULL DEFAULT 0,
  validation_report     JSONB,                              -- [{row: 5, field: "mobile", error: "Duplicate"}]
  status                VARCHAR(20) NOT NULL DEFAULT 'UPLOADED',
                                                            -- UPLOADED, VALIDATED, IMPORTING, COMPLETED, FAILED
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_migration_society ON migration_batches(society_id);
```

---

### 14. migration_rows

Per-row tracking for bulk import operations. Each row from the uploaded Excel maps to one record here.

```sql
CREATE TABLE migration_rows (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id        UUID NOT NULL REFERENCES migration_batches(id) ON DELETE CASCADE,
  row_number      INTEGER NOT NULL,                    -- Excel row number (for error reporting)
  raw_data        JSONB NOT NULL,                      -- Original row data as JSON
  status          migration_row_status NOT NULL DEFAULT 'VALID',
                                                       -- VALID, ERROR, SKIPPED, IMPORTED
  error_details   JSONB,                               -- [{field: "mobile", error: "Duplicate"}]
  user_id         UUID REFERENCES users(id),           -- Set after successful import
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_migration_rows_batch ON migration_rows(batch_id);
CREATE INDEX idx_migration_rows_status ON migration_rows(status);
```

---

### 15. notification_preferences

Resident opt-in/opt-out for optional notifications.

```sql
CREATE TABLE notification_preferences (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id),
  society_id            UUID NOT NULL REFERENCES societies(id),

  -- Optional triggers (mandatory ones cannot be turned off)
  fee_reminder          BOOLEAN NOT NULL DEFAULT true,
  fee_overdue_alert     BOOLEAN NOT NULL DEFAULT true,
  society_broadcasts    BOOLEAN NOT NULL DEFAULT true,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, society_id)
);
```

---

### 16. fee_sessions

Tracks financial session configuration per society per year.

```sql
CREATE TABLE fee_sessions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id            UUID NOT NULL REFERENCES societies(id),
  session_year          VARCHAR(7) NOT NULL,               -- "2025-26"
  annual_fee            DECIMAL(10,2) NOT NULL,            -- Fee for this specific session
  joining_fee           DECIMAL(10,2) NOT NULL,            -- Joining fee for this session
  session_start         DATE NOT NULL,                     -- 2025-04-01
  session_end           DATE NOT NULL,                     -- 2026-03-31
  grace_period_end      DATE NOT NULL,                     -- 2025-04-15
  status                VARCHAR(20) NOT NULL DEFAULT 'UPCOMING',
                                                            -- UPCOMING, ACTIVE, CLOSED
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(society_id, session_year)
);

CREATE INDEX idx_fee_sessions_society ON fee_sessions(society_id);
```

---

## Phase 2+ Stub Tables (Created Now, Empty Until Needed)

These tables exist in the schema from day 1 so adding Phase 2 features requires no migration.

### 17. admin_terms (MVP v2 — Election lifecycle, term tracking)

```sql
CREATE TABLE admin_terms (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id),
  society_id            UUID NOT NULL REFERENCES societies(id),
  position              admin_position NOT NULL,
  permission            admin_permission NOT NULL,
  term_start            TIMESTAMPTZ NOT NULL,
  term_end              TIMESTAMPTZ NOT NULL,
  status                admin_term_status NOT NULL DEFAULT 'ACTIVE',
  extension_count       INTEGER NOT NULL DEFAULT 0,
  activated_by          UUID REFERENCES users(id),
  deactivated_by        UUID REFERENCES users(id),
  deactivation_reason   TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_terms_society ON admin_terms(society_id);
CREATE INDEX idx_admin_terms_user ON admin_terms(user_id);
CREATE INDEX idx_admin_terms_status ON admin_terms(status);
```

### 18. festivals (MVP v2 — Basic festival fund management)

```sql
CREATE TABLE festivals (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id            UUID NOT NULL REFERENCES societies(id),
  festival_id           VARCHAR(50) UNIQUE NOT NULL,
  name                  VARCHAR(200) NOT NULL,
  description           TEXT,
  event_date            DATE NOT NULL,
  target_amount         DECIMAL(10,2) NOT NULL,
  collected_amount      DECIMAL(10,2) NOT NULL DEFAULT 0,
  spent_amount          DECIMAL(10,2) NOT NULL DEFAULT 0,
  collection_start      DATE NOT NULL,
  collection_end        DATE NOT NULL,
  status                festival_status NOT NULL DEFAULT 'DRAFT',
  cancellation_reason   TEXT,
  surplus_disposal      disposal_type,
  surplus_amount        DECIMAL(10,2),
  created_by            UUID NOT NULL REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_festivals_society ON festivals(society_id);
```

### 19. festival_contributions (MVP v2 — Basic contributions)

```sql
CREATE TABLE festival_contributions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id           UUID NOT NULL REFERENCES festivals(id),
  user_id               UUID NOT NULL REFERENCES users(id),
  society_id            UUID NOT NULL REFERENCES societies(id),
  amount                DECIMAL(10,2) NOT NULL,
  payment_mode          payment_mode NOT NULL,
  reference_no          VARCHAR(50),
  receipt_no            VARCHAR(50) UNIQUE NOT NULL,
  contributed_date      DATE NOT NULL,
  recorded_by           UUID NOT NULL REFERENCES users(id),
  is_refund             BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contributions_festival ON festival_contributions(festival_id);
CREATE INDEX idx_contributions_society ON festival_contributions(society_id);
```

### 20. expense_queries (Phase 2 — Resident dispute module, deferred)

```sql
CREATE TABLE expense_queries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id            UUID NOT NULL REFERENCES expenses(id),
  society_id            UUID NOT NULL REFERENCES societies(id),
  raised_by             UUID NOT NULL REFERENCES users(id),
  query_text            TEXT NOT NULL,
  admin_response        TEXT,
  responded_by          UUID REFERENCES users(id),
  responded_at          TIMESTAMPTZ,
  status                query_status NOT NULL DEFAULT 'OPEN',
  escalated_at          TIMESTAMPTZ,
  resolved_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_queries_society ON expense_queries(society_id);
CREATE INDEX idx_queries_status ON expense_queries(status);
```

### 21. property_transfers (Phase 2 — deferred)

```sql
CREATE TABLE property_transfers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id               UUID NOT NULL REFERENCES units(id),
  society_id            UUID NOT NULL REFERENCES societies(id),
  transfer_type         transfer_type NOT NULL,
  outgoing_user_id      UUID NOT NULL REFERENCES users(id),
  incoming_user_id      UUID REFERENCES users(id),
  transfer_date         DATE NOT NULL,
  notes                 TEXT,
  outstanding_fees      DECIMAL(10,2) DEFAULT 0,
  fees_written_off      BOOLEAN NOT NULL DEFAULT false,
  write_off_reason      TEXT,
  initiated_by          UUID NOT NULL REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transfers_society ON property_transfers(society_id);
```

### 22. visitor_logs (Phase 3 — Visitor management, deferred)

```sql
CREATE TABLE visitor_logs (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id            UUID NOT NULL REFERENCES societies(id),
  resident_id           UUID NOT NULL REFERENCES users(id),
  visitor_name          VARCHAR(100) NOT NULL,
  visitor_mobile        VARCHAR(15),
  purpose               VARCHAR(100),
  expected_date         DATE NOT NULL,
  visitor_code          VARCHAR(20) UNIQUE,
  status                VARCHAR(20) NOT NULL DEFAULT 'EXPECTED',
                                                            -- EXPECTED, ARRIVED, CANCELLED
  arrived_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_visitors_society ON visitor_logs(society_id);
```

### 23. dependents (Phase 2 — deferred)

```sql
CREATE TABLE dependents (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id),
  society_id            UUID NOT NULL REFERENCES societies(id),
  name                  VARCHAR(100) NOT NULL,
  relationship          VARCHAR(30) NOT NULL,
  date_of_birth         DATE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dependents_user ON dependents(user_id);
```

### 24. blacklisted_numbers

```sql
CREATE TABLE blacklisted_numbers (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id            UUID NOT NULL REFERENCES societies(id),
  mobile                VARCHAR(15) NOT NULL,
  reason                TEXT NOT NULL,
  blacklisted_by        UUID NOT NULL REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(society_id, mobile)
);
```

---

## Row-Level Security (RLS) Policies

```sql
-- Enable RLS on all society-scoped tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_sessions ENABLE ROW LEVEL SECURITY;

-- Core isolation policy (applied to each table):
-- Users can only see data from their own society
CREATE POLICY society_isolation ON users
  USING (
    society_id = (SELECT society_id FROM users WHERE auth_user_id = auth.uid())
    OR
    (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'SUPER_ADMIN'
  );

-- Residents: can only see own notifications
CREATE POLICY own_notifications ON notifications
  FOR SELECT USING (
    user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    OR
    (SELECT role FROM users WHERE auth_user_id = auth.uid()) IN ('SUPER_ADMIN', 'RWA_ADMIN')
  );

-- Audit logs: INSERT only (immutable)
CREATE POLICY audit_insert_only ON audit_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY audit_read ON audit_logs
  FOR SELECT USING (
    society_id = (SELECT society_id FROM users WHERE auth_user_id = auth.uid())
    OR
    (SELECT role FROM users WHERE auth_user_id = auth.uid()) = 'SUPER_ADMIN'
  );
-- No UPDATE or DELETE policy = immutable

-- Expenses: all residents in society can read (transparency)
CREATE POLICY expense_read_all ON expenses
  FOR SELECT USING (
    society_id = (SELECT society_id FROM users WHERE auth_user_id = auth.uid())
  );

-- Expenses: only admins can insert/update
CREATE POLICY expense_admin_write ON expenses
  FOR INSERT WITH CHECK (
    (SELECT role FROM users WHERE auth_user_id = auth.uid()) IN ('SUPER_ADMIN', 'RWA_ADMIN')
  );
```

---

## Prisma Schema (Key Models)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

// ═══════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════

enum SocietyStatus {
  ACTIVE
  TRIAL
  SUSPENDED
  OFFBOARDED
}

enum SocietyType {
  APARTMENT_COMPLEX
  BUILDER_FLOORS
  GATED_COMMUNITY_VILLAS
  INDEPENDENT_SECTOR
  PLOTTED_COLONY
}

enum SubscriptionPlan {
  BASIC
  STANDARD
  PREMIUM
  ENTERPRISE
}

enum UserRole {
  SUPER_ADMIN
  RWA_ADMIN
  RESIDENT
}

enum OwnershipType {
  OWNER
  TENANT
}

enum AdminPermission {
  FULL_ACCESS
  READ_NOTIFY
}

enum AdminPosition {
  PRIMARY
  SUPPORTING
}

enum ResidentStatus {
  PENDING_APPROVAL
  ACTIVE_PAID
  ACTIVE_PENDING
  ACTIVE_OVERDUE
  ACTIVE_PARTIAL
  ACTIVE_EXEMPTED
  REJECTED
  MIGRATED_PENDING
  DORMANT
  DEACTIVATED
  TRANSFERRED_DEACTIVATED
  TENANT_DEPARTED
}

enum FeeStatus {
  NOT_YET_DUE
  PENDING
  OVERDUE
  PARTIAL
  PAID
  EXEMPTED
}

enum PaymentMode {
  CASH
  UPI
  BANK_TRANSFER
  OTHER
}

enum ExpenseStatus {
  ACTIVE
  REVERSED
}

enum ExpenseCategory {
  MAINTENANCE
  SECURITY
  CLEANING
  STAFF_SALARY
  INFRASTRUCTURE
  UTILITIES
  EMERGENCY
  ADMINISTRATIVE
  OTHER
}

enum NotificationChannel {
  WHATSAPP
  SMS
}

enum NotificationStatus {
  QUEUED
  SENT
  DELIVERED
  READ
  FAILED
}

// ═══════════════════════════════════════
// CORE MODELS
// ═══════════════════════════════════════

model Society {
  id                    String            @id @default(uuid()) @db.Uuid
  societyId             String            @unique @map("society_id") @db.VarChar(30)
  societyCode           String            @unique @map("society_code") @db.VarChar(8)
  name                  String            @db.VarChar(200)
  registrationNo        String?           @map("registration_no") @db.VarChar(50)
  state                 String            @db.VarChar(2)
  city                  String            @db.VarChar(50)
  cityCode              String            @map("city_code") @db.VarChar(3)
  pincode               String            @db.VarChar(6)
  type                  SocietyType
  totalUnits            Int               @default(0) @map("total_units")
  joiningFee            Decimal           @default(1000) @map("joining_fee") @db.Decimal(10, 2)
  annualFee             Decimal           @default(1200) @map("annual_fee") @db.Decimal(10, 2)
  feeSessionStartMonth  Int               @default(4) @map("fee_session_start_month")
  gracePeriodDays       Int               @default(15) @map("grace_period_days")
  plan                  SubscriptionPlan  @default(BASIC)
  status                SocietyStatus     @default(ACTIVE)
  subscriptionExpiresAt DateTime?         @map("subscription_expires_at")
  trialEndsAt           DateTime?         @map("trial_ends_at")
  onboardingDate        DateTime          @default(now()) @map("onboarding_date")
  createdAt             DateTime          @default(now()) @map("created_at")
  updatedAt             DateTime          @updatedAt @map("updated_at")

  users                 User[]
  units                 Unit[]
  membershipFees        MembershipFee[]
  feePayments           FeePayment[]
  expenses              Expense[]
  notifications         Notification[]
  broadcasts            Broadcast[]
  auditLogs             AuditLog[]
  migrationBatches      MigrationBatch[]
  feeSessions           FeeSession[]

  @@map("societies")
}

model User {
  id                    String            @id @default(uuid()) @db.Uuid
  societyId             String?           @map("society_id") @db.Uuid
  rwaid                 String?           @unique @db.VarChar(40)
  authUserId            String?           @unique @map("auth_user_id") @db.Uuid
  name                  String            @db.VarChar(100)
  mobile                String            @db.VarChar(15)
  email                 String?           @db.VarChar(100)
  photoUrl              String?           @map("photo_url") @db.VarChar(500)
  idProofUrl            String?           @map("id_proof_url") @db.VarChar(500)
  role                  UserRole
  ownershipType         OwnershipType?    @map("ownership_type")
  status                ResidentStatus    @default(PENDING_APPROVAL)
  adminPermission       AdminPermission?  @map("admin_permission")
  consentWhatsapp       Boolean           @default(false) @map("consent_whatsapp")
  consentWhatsappAt     DateTime?         @map("consent_whatsapp_at")
  pinHash               String?           @map("pin_hash") @db.VarChar(100)
  pinFailedAttempts     Int               @default(0) @map("pin_failed_attempts")
  pinLockedUntil        DateTime?         @map("pin_locked_until")
  joiningFeePaid        Boolean           @default(false) @map("joining_fee_paid")
  registeredAt          DateTime          @default(now()) @map("registered_at")
  approvedAt            DateTime?         @map("approved_at")
  approvedById          String?           @map("approved_by") @db.Uuid
  rejectedAt            DateTime?         @map("rejected_at")
  rejectedById          String?           @map("rejected_by") @db.Uuid
  rejectionReason       String?           @map("rejection_reason")
  activatedAt           DateTime?         @map("activated_at")
  deactivatedAt         DateTime?         @map("deactivated_at")
  deactivationReason    String?           @map("deactivation_reason")
  createdAt             DateTime          @default(now()) @map("created_at")
  updatedAt             DateTime          @updatedAt @map("updated_at")

  society               Society?          @relation(fields: [societyId], references: [id])
  approvedBy            User?             @relation("ApprovedBy", fields: [approvedById], references: [id])
  rejectedBy            User?             @relation("RejectedBy", fields: [rejectedById], references: [id])
  approvedUsers         User[]            @relation("ApprovedBy")
  rejectedUsers         User[]            @relation("RejectedBy")
  userUnits             UserUnit[]
  membershipFees        MembershipFee[]
  feePayments           FeePayment[]
  notifications         Notification[]

  @@unique([societyId, mobile])
  @@map("users")
}

model Unit {
  id                    String            @id @default(uuid()) @db.Uuid
  societyId             String            @map("society_id") @db.Uuid
  displayLabel          String            @map("display_label") @db.VarChar(50)
  towerBlock            String?           @map("tower_block") @db.VarChar(20)
  floorNo               String?           @map("floor_no") @db.VarChar(10)
  flatNo                String?           @map("flat_no") @db.VarChar(20)
  houseNo               String?           @map("house_no") @db.VarChar(20)
  floorLevel            String?           @map("floor_level") @db.VarChar(10)
  villaNo               String?           @map("villa_no") @db.VarChar(20)
  streetPhase           String?           @map("street_phase") @db.VarChar(30)
  sectorBlock           String?           @map("sector_block") @db.VarChar(20)
  streetGali            String?           @map("street_gali") @db.VarChar(20)
  plotNo                String?           @map("plot_no") @db.VarChar(20)
  laneNo                String?           @map("lane_no") @db.VarChar(20)
  phase                 String?           @db.VarChar(20)
  primaryOwnerId        String?           @map("primary_owner_id") @db.Uuid
  currentTenantId       String?           @map("current_tenant_id") @db.Uuid
  createdAt             DateTime          @default(now()) @map("created_at")
  updatedAt             DateTime          @updatedAt @map("updated_at")

  society               Society           @relation(fields: [societyId], references: [id])
  userUnits             UserUnit[]

  @@map("units")
}

model UserUnit {
  id            String    @id @default(uuid()) @db.Uuid
  userId        String    @map("user_id") @db.Uuid
  unitId        String    @map("unit_id") @db.Uuid
  isPrimary     Boolean   @default(true) @map("is_primary")
  relationship  String    @default("OWNER") @db.VarChar(20)
  linkedAt      DateTime  @default(now()) @map("linked_at")
  unlinkedAt    DateTime? @map("unlinked_at")

  user          User      @relation(fields: [userId], references: [id])
  unit          Unit      @relation(fields: [unitId], references: [id])

  @@unique([userId, unitId])
  @@map("user_units")
}

model MembershipFee {
  id                  String    @id @default(uuid()) @db.Uuid
  userId              String    @map("user_id") @db.Uuid
  unitId              String?   @map("unit_id") @db.Uuid
  societyId           String    @map("society_id") @db.Uuid
  sessionYear         String    @map("session_year") @db.VarChar(7)
  sessionStart        DateTime  @map("session_start") @db.Date
  sessionEnd          DateTime  @map("session_end") @db.Date
  amountDue           Decimal   @map("amount_due") @db.Decimal(10, 2)
  amountPaid          Decimal   @default(0) @map("amount_paid") @db.Decimal(10, 2)
  status              FeeStatus @default(NOT_YET_DUE)
  gracePeriodEnd      DateTime? @map("grace_period_end") @db.Date
  isProrata           Boolean   @default(false) @map("is_prorata")
  prorataMonths       Int?      @map("prorata_months")
  joiningFeeIncluded  Boolean   @default(false) @map("joining_fee_included")
  exemptionReason     String?   @map("exemption_reason")
  exemptedBy          String?   @map("exempted_by") @db.Uuid
  exemptedAt          DateTime? @map("exempted_at")
  isPreMigration      Boolean   @default(false) @map("is_pre_migration")
  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")

  user                User      @relation(fields: [userId], references: [id])
  society             Society   @relation(fields: [societyId], references: [id])
  feePayments         FeePayment[]

  @@unique([userId, sessionYear])
  @@map("membership_fees")
}

model FeePayment {
  id                    String        @id @default(uuid()) @db.Uuid
  feeId                 String        @map("fee_id") @db.Uuid
  userId                String        @map("user_id") @db.Uuid
  societyId             String        @map("society_id") @db.Uuid
  amount                Decimal       @db.Decimal(10, 2)
  paymentMode           PaymentMode   @map("payment_mode")
  referenceNo           String?       @map("reference_no") @db.VarChar(50)
  receiptNo             String        @unique @map("receipt_no") @db.VarChar(50)
  receiptUrl            String?       @map("receipt_url") @db.VarChar(500)
  paymentDate           DateTime      @map("payment_date") @db.Date
  notes                 String?
  recordedBy            String        @map("recorded_by") @db.Uuid
  isReversal            Boolean       @default(false) @map("is_reversal")
  reversalOf            String?       @map("reversal_of") @db.Uuid
  reversalReason        String?       @map("reversal_reason")
  isReversed            Boolean       @default(false) @map("is_reversed")
  correctionWindowEnds  DateTime?     @map("correction_window_ends")
  createdAt             DateTime      @default(now()) @map("created_at")

  fee                   MembershipFee @relation(fields: [feeId], references: [id])
  user                  User          @relation(fields: [userId], references: [id])
  society               Society       @relation(fields: [societyId], references: [id])
  reversalOfPayment     FeePayment?   @relation("PaymentReversal", fields: [reversalOf], references: [id])
  reversals             FeePayment[]  @relation("PaymentReversal")

  @@map("fee_payments")
}

model Expense {
  id                    String          @id @default(uuid()) @db.Uuid
  societyId             String          @map("society_id") @db.Uuid
  date                  DateTime        @db.Date
  amount                Decimal         @db.Decimal(10, 2)
  category              ExpenseCategory
  description           String
  receiptUrl            String?         @map("receipt_url") @db.VarChar(500)
  loggedBy              String          @map("logged_by") @db.Uuid
  status                ExpenseStatus   @default(ACTIVE)
  reversalNote          String?         @map("reversal_note")
  reversedBy            String?         @map("reversed_by") @db.Uuid
  reversedAt            DateTime?       @map("reversed_at")
  correctionWindowEnds  DateTime?       @map("correction_window_ends")
  createdAt             DateTime        @default(now()) @map("created_at")
  updatedAt             DateTime        @updatedAt @map("updated_at")

  society               Society         @relation(fields: [societyId], references: [id])

  @@map("expenses")
}

model Notification {
  id              String              @id @default(uuid()) @db.Uuid
  userId          String              @map("user_id") @db.Uuid
  societyId       String?             @map("society_id") @db.Uuid
  type            String              @db.VarChar(50)
  channel         NotificationChannel
  templateName    String?             @map("template_name") @db.VarChar(100)
  contentVars     Json?               @map("content_vars")
  contentPreview  String?             @map("content_preview")
  status          NotificationStatus  @default(QUEUED)
  sentAt          DateTime?           @map("sent_at")
  deliveredAt     DateTime?           @map("delivered_at")
  readAt          DateTime?           @map("read_at")
  failedReason    String?             @map("failed_reason")
  retryCount      Int                 @default(0) @map("retry_count")
  broadcastId     String?             @map("broadcast_id") @db.Uuid
  createdAt       DateTime            @default(now()) @map("created_at")

  user            User                @relation(fields: [userId], references: [id])
  society         Society?            @relation(fields: [societyId], references: [id])

  @@map("notifications")
}

model Broadcast {
  id              String    @id @default(uuid()) @db.Uuid
  societyId       String    @map("society_id") @db.Uuid
  sentBy          String    @map("sent_by") @db.Uuid
  message         String
  recipientFilter String    @map("recipient_filter") @db.VarChar(30)
  recipientCount  Int       @map("recipient_count")
  deliveredCount  Int       @default(0) @map("delivered_count")
  failedCount     Int       @default(0) @map("failed_count")
  sentAt          DateTime  @default(now()) @map("sent_at")
  createdAt       DateTime  @default(now()) @map("created_at")

  society         Society   @relation(fields: [societyId], references: [id])

  @@map("broadcasts")
}

model AuditLog {
  id          String    @id @default(uuid()) @db.Uuid
  societyId   String?   @map("society_id") @db.Uuid
  userId      String    @map("user_id") @db.Uuid
  actionType  String    @map("action_type") @db.VarChar(20)
  entityType  String    @map("entity_type") @db.VarChar(30)
  entityId    String    @map("entity_id") @db.Uuid
  oldValue    Json?     @map("old_value")
  newValue    Json?     @map("new_value")
  ipAddress   String?   @map("ip_address")
  userAgent   String?   @map("user_agent")
  createdAt   DateTime  @default(now()) @map("created_at")

  society     Society?  @relation(fields: [societyId], references: [id])

  @@map("audit_logs")
}

model MigrationBatch {
  id               String    @id @default(uuid()) @db.Uuid
  societyId        String    @map("society_id") @db.Uuid
  uploadedBy       String    @map("uploaded_by") @db.Uuid
  fileUrl          String    @map("file_url") @db.VarChar(500)
  totalRows        Int       @map("total_rows")
  validRows        Int       @default(0) @map("valid_rows")
  errorRows        Int       @default(0) @map("error_rows")
  importedRows     Int       @default(0) @map("imported_rows")
  validationReport Json?     @map("validation_report")
  status           String    @default("UPLOADED") @db.VarChar(20)
  completedAt      DateTime? @map("completed_at")
  createdAt        DateTime  @default(now()) @map("created_at")

  society          Society   @relation(fields: [societyId], references: [id])
  rows             MigrationRow[]

  @@map("migration_batches")
}

model MigrationRow {
  id           String    @id @default(uuid()) @db.Uuid
  batchId      String    @map("batch_id") @db.Uuid
  rowNumber    Int       @map("row_number")
  rawData      Json      @map("raw_data")
  status       String    @default("VALID") @db.VarChar(20)
  errorDetails Json?     @map("error_details")
  userId       String?   @map("user_id") @db.Uuid
  createdAt    DateTime  @default(now()) @map("created_at")

  batch        MigrationBatch @relation(fields: [batchId], references: [id])

  @@map("migration_rows")
}

model FeeSession {
  id              String    @id @default(uuid()) @db.Uuid
  societyId       String    @map("society_id") @db.Uuid
  sessionYear     String    @map("session_year") @db.VarChar(7)
  annualFee       Decimal   @map("annual_fee") @db.Decimal(10, 2)
  joiningFee      Decimal   @map("joining_fee") @db.Decimal(10, 2)
  sessionStart    DateTime  @map("session_start") @db.Date
  sessionEnd      DateTime  @map("session_end") @db.Date
  gracePeriodEnd  DateTime  @map("grace_period_end") @db.Date
  status          String    @default("UPCOMING") @db.VarChar(20)
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  society         Society   @relation(fields: [societyId], references: [id])

  @@unique([societyId, sessionYear])
  @@map("fee_sessions")
}

model NotificationPreference {
  id                String    @id @default(uuid()) @db.Uuid
  userId            String    @map("user_id") @db.Uuid
  societyId         String    @map("society_id") @db.Uuid
  feeReminder       Boolean   @default(true) @map("fee_reminder")
  feeOverdueAlert   Boolean   @default(true) @map("fee_overdue_alert")
  societyBroadcasts Boolean   @default(true) @map("society_broadcasts")
  createdAt         DateTime  @default(now()) @map("created_at")
  updatedAt         DateTime  @updatedAt @map("updated_at")

  @@unique([userId, societyId])
  @@map("notification_preferences")
}
```

---

## Seed Data (Development)

```typescript
// prisma/seed.ts

// 1. Super Admin
const superAdmin = {
  name: "Super Admin",
  email: "admin@rwaconnect.in",
  mobile: "9999999999",
  role: "SUPER_ADMIN",
  status: "ACTIVE_PAID",
};

// 2. Society: Eden Estate (Independent Sector)
const edenEstate = {
  societyId: "RWA-HR-GGN-122001-0001",
  societyCode: "EDENESTATE",
  name: "Eden Estate Resident Welfare Association",
  state: "HR",
  city: "Gurgaon",
  cityCode: "GGN",
  pincode: "122001",
  type: "INDEPENDENT_SECTOR",
  joiningFee: 1000,
  annualFee: 1200,
};

// 3. Primary Admin for Eden Estate
const admin = {
  name: "Hemant Kumar",
  mobile: "9876543210",
  role: "RWA_ADMIN",
  adminPermission: "FULL_ACCESS",
  status: "ACTIVE_PAID",
};

// 4. Five demo residents (3 owners, 2 tenants, mixed fee statuses)
const residents = [
  {
    name: "Rajesh Sharma",
    mobile: "9876543211",
    ownership: "OWNER",
    feeStatus: "PAID",
    unit: "S22-St3-H110",
  },
  {
    name: "Priya Singh",
    mobile: "9876543212",
    ownership: "TENANT",
    feeStatus: "PARTIAL",
    unit: "S22-St9-H301",
  },
  {
    name: "Amit Verma",
    mobile: "9876543213",
    ownership: "OWNER",
    feeStatus: "OVERDUE",
    unit: "S22-St2-H88",
  },
  {
    name: "Neha Gupta",
    mobile: "9876543214",
    ownership: "OWNER",
    feeStatus: "EXEMPTED",
    unit: "S22-St1-H55",
  },
  {
    name: "Deepak Malhotra",
    mobile: "9876543215",
    ownership: "TENANT",
    feeStatus: "PENDING",
    unit: "S22-St4-H44",
  },
];

// 5. Fee records for current session (2025-26)
// 6. Sample expenses (3 entries: Security, Cleaning, Maintenance)
// 7. Fee session record for 2025-26
```

---

## Key Indexes Summary

| Table           | Index                  | Purpose                                  |
| --------------- | ---------------------- | ---------------------------------------- |
| societies       | pincode                | Society ID generation (find last SEQ)    |
| societies       | society_code           | Uniqueness check during society creation |
| users           | society_id + mobile    | Duplicate detection per society          |
| users           | rwaid                  | RWAID lookup for card/verification       |
| users           | auth_user_id           | Supabase Auth session → user mapping     |
| membership_fees | user_id + session_year | One fee record per user per session      |
| fee_payments    | payment_date           | Date range queries for reports           |
| fee_payments    | receipt_no             | Receipt lookup for verification          |
| expenses        | society_id + date      | Chronological expense ledger             |
| notifications   | broadcast_id           | Group messages for delivery stats        |
| audit_logs      | created_at             | Time-range audit queries                 |

---

## Migration Strategy

1. **Phase 0**: Create ALL 22 tables in the first migration (including Phase 2+ stubs)
   ```bash
   npx prisma migrate dev --name init
   ```
2. **Phase 2+**: When new features are added, only ALTER existing stub tables (add columns, constraints)
3. **Production**: Use `npx prisma migrate deploy` (no interactive prompts)
4. **Backward-compatible only**: Never drop columns in production. Add nullable → backfill → add constraint.
5. **Connection pooling**: Use Supabase PgBouncer. Prisma URL includes `?pgbouncer=true`.

---

## Table Count Summary

| Category                 | Tables | Status                                                                                                                                                                                         |
| ------------------------ | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Core MVP (actively used) | 14     | societies, users, units, user_units, membership_fees, fee_payments, expenses, notifications, broadcasts, audit_logs, migration_batches, migration_rows, notification_preferences, fee_sessions |
| Phase 2+ stubs (empty)   | 8      | admin_terms, festivals, festival_contributions, expense_queries, property_transfers, visitor_logs, dependents, blacklisted_numbers                                                             |
| **Total**                | **22** | All created in Phase 0                                                                                                                                                                         |
