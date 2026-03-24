# Full Spec v3.0 Database Design — Complete Schema

**Source**: `external_docs/RWA_Connect_Full_Spec_v3.0.docx` (Section 19 Enums + all feature sections)
**ORM**: Prisma with PostgreSQL (Supabase)
**Strategy**: Build ALL tables in the first migration. Every table is fully active — no stubs.
**Enums Reference**: `execution_plan/full_spec/enums-reference.md` (Section 19, canonical source)

---

## Differences from MVP Schema

| Area                  | MVP Schema                              | Full Spec v3.0                                                                                |
| --------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------- |
| Admin positions       | 2 (PRIMARY, SUPPORTING)                 | **6** (PRESIDENT, VICE_PRESIDENT, SECRETARY, JOINT_SECRETARY, TREASURER, EXECUTIVE_MEMBER)    |
| Admin permissions     | 2 (FULL_ACCESS, READ_NOTIFY)            | **5** (FULL_ACCESS, HIGH_ACCESS, FINANCE_ACCESS, READ_NOTIFY, CONFIGURABLE)                   |
| Ownership types       | 2 (OWNER, TENANT)                       | **4** (OWNER, OWNER_NRO, JOINT_OWNER, TENANT)                                                 |
| Resident statuses     | 12                                      | **14** (adds ACTIVE_LIFETIME, MIGRATED_DORMANT; removes DORMANT)                              |
| Fee statuses          | 6                                       | **8** (adds ADVANCE_PAID, LIFETIME)                                                           |
| Payment modes         | 4 (CASH, UPI, BANK_TRANSFER, OTHER)     | **5** (adds CHEQUE, ONLINE; drops OTHER)                                                      |
| Expense categories    | 9                                       | **11** (adds FESTIVAL, LEGAL)                                                                 |
| Payment entry types   | implicit (is_reversal flag)             | **7** explicit (PAYMENT, PARTIAL_PAYMENT, CORRECTION, REVERSAL, REFUND, WRITE_OFF, EXEMPTION) |
| Notification channels | 2 (WHATSAPP, SMS)                       | **4** (adds PUSH, EMAIL)                                                                      |
| Notification statuses | 5                                       | **5** (QUEUED, SENT, DELIVERED, FAILED, RETRYING — removes READ)                              |
| Festival statuses     | 4 (DRAFT, ACTIVE, COMPLETED, CANCELLED) | **5** (DRAFT, COLLECTING, CLOSED, COMPLETED, CANCELLED)                                       |
| Subscription plan     | 4 tiers (only BASIC used)               | **5** tiers (adds TRIAL)                                                                      |
| Festival tables       | Phase 2 stubs                           | **Fully active** with complete columns                                                        |
| Admin terms           | Phase 2 stub                            | **Fully active** with election lifecycle                                                      |
| Recurring expenses    | Not present                             | **New table**                                                                                 |
| Expense queries       | Phase 2 stub                            | **Fully active** with dispute workflow                                                        |
| Property transfers    | Phase 2 stub                            | **Fully active**                                                                              |
| Visitor logs          | Phase 3 stub                            | **Fully active** with QR verification                                                         |
| Dependents            | Phase 2 stub                            | **Fully active** with contact fields                                                          |
| Society table         | No address, no term months              | **Adds** `admin_term_months`, `registration_no`, `address`                                    |
| Users table           | OWNER/TENANT only                       | **Adds** `is_lifetime_member`, expanded `ownership_type`                                      |

---

## 1. Enum Types

All enums from Section 19 of the Full Spec v3.0 — expanded from MVP.

```sql
-- =====================================================================
-- SECTION 1: ENUM TYPES — Full Spec v3.0
-- Source: enums-reference.md (Section 19)
-- =====================================================================

-- ─────────────────────────────────────────────────────────────────────
-- 19.13 Society Status
-- ─────────────────────────────────────────────────────────────────────

CREATE TYPE society_status AS ENUM (
  'TRIAL',                           -- Free 60-day trial
  'ACTIVE',                          -- Paid subscription, full access
  'SUSPENDED',                       -- Lapsed 15-90 days, read-only
  'OFFBOARDED'                       -- Left platform, data pending deletion
);

-- ─────────────────────────────────────────────────────────────────────
-- 19.17 Society Type (determines unit address fields)
-- ─────────────────────────────────────────────────────────────────────

CREATE TYPE society_type AS ENUM (
  'APARTMENT_COMPLEX',               -- Tower/Block + Floor + Flat
  'BUILDER_FLOORS',                  -- House No + Floor Level (GF/1F/2F/3F/Terrace)
  'GATED_COMMUNITY_VILLAS',         -- Villa No + Street/Phase
  'INDEPENDENT_SECTOR_COLONY',      -- House No + Street/Gali + Sector/Block
  'PLOTTED_COLONY'                   -- Plot No + Lane No + Phase
);

-- ─────────────────────────────────────────────────────────────────────
-- 19.14 Subscription Plan
-- ─────────────────────────────────────────────────────────────────────

CREATE TYPE subscription_plan AS ENUM (
  'TRIAL',                           -- 60-day free trial, Standard features
  'BASIC',                           -- ≤100 residents, no WhatsApp API
  'STANDARD',                        -- ≤500 residents, 500 WhatsApp/mo
  'PREMIUM',                         -- Unlimited residents, 2,000 WhatsApp/mo
  'ENTERPRISE'                       -- Multi-society, white-label, unlimited
);

-- ─────────────────────────────────────────────────────────────────────
-- 19.1 User Role (expanded from MVP's 3-value enum)
-- ─────────────────────────────────────────────────────────────────────

CREATE TYPE user_role AS ENUM (
  'SUPER_ADMIN',                     -- Platform owner, one per deployment
  'RWA_ADMIN_PRIMARY',               -- Full access elected admin
  'RWA_ADMIN_SUPPORTING',            -- Configurable access elected admin
  'RESIDENT_OWNER',                  -- Property owner (lives there)
  'RESIDENT_OWNER_NRO',              -- Non-resident owner (owns, lives elsewhere)
  'RESIDENT_JOINT_OWNER',            -- Second owner of same unit
  'RESIDENT_TENANT'                  -- Tenant occupant
);

-- ─────────────────────────────────────────────────────────────────────
-- 19.15 Ownership Type (expanded from MVP's 2-value enum)
-- ─────────────────────────────────────────────────────────────────────

CREATE TYPE ownership_type AS ENUM (
  'OWNER',                           -- Owns and lives in property
  'OWNER_NRO',                       -- Owns but lives elsewhere (Non-Resident Owner)
  'JOINT_OWNER',                     -- Second owner of same unit
  'TENANT'                           -- Renter, does not own
);

-- ─────────────────────────────────────────────────────────────────────
-- Admin Permissions (expanded from MVP's 2-value enum)
-- ─────────────────────────────────────────────────────────────────────

CREATE TYPE admin_permission AS ENUM (
  'FULL_ACCESS',                     -- President/Secretary: all operations
  'HIGH_ACCESS',                     -- Vice President: all except critical financial
  'FINANCE_ACCESS',                  -- Treasurer: financial operations only
  'READ_NOTIFY',                     -- Joint Secretary: view all + send broadcasts
  'CONFIGURABLE'                     -- Executive Member: Super Admin sets per-feature access
);

-- ─────────────────────────────────────────────────────────────────────
-- Admin Positions (expanded from MVP's 2-value enum)
-- ─────────────────────────────────────────────────────────────────────

CREATE TYPE admin_position AS ENUM (
  'PRESIDENT',                       -- Default: FULL_ACCESS
  'VICE_PRESIDENT',                  -- Default: HIGH_ACCESS
  'SECRETARY',                       -- Default: FULL_ACCESS
  'JOINT_SECRETARY',                 -- Default: READ_NOTIFY
  'TREASURER',                       -- Default: FINANCE_ACCESS
  'EXECUTIVE_MEMBER'                 -- Default: CONFIGURABLE
);

-- ─────────────────────────────────────────────────────────────────────
-- 19.2 Resident Account Status (expanded from MVP's 12 to 14)
-- Adds: ACTIVE_LIFETIME, MIGRATED_DORMANT
-- Removes: DORMANT (replaced by MIGRATED_DORMANT for clarity)
-- Adds: SUSPENDED, DECEASED, BLACKLISTED
-- ─────────────────────────────────────────────────────────────────────

CREATE TYPE resident_status AS ENUM (
  'PENDING_APPROVAL',                -- Just registered, awaiting admin review
  'ACTIVE_PAID',                     -- Approved + fees fully paid for session
  'ACTIVE_PENDING',                  -- Approved + within grace period, unpaid
  'ACTIVE_OVERDUE',                  -- Approved + past grace period, unpaid
  'ACTIVE_PARTIAL',                  -- Approved + partial payment recorded
  'ACTIVE_EXEMPTED',                 -- Approved + fees exempted by admin
  'ACTIVE_LIFETIME',                 -- Honorary lifetime member, no annual fee (Super Admin only)
  'REJECTED',                        -- Admin rejected registration
  'MIGRATED_PENDING',                -- Bulk imported, not yet activated
  'MIGRATED_DORMANT',                -- 60+ days post-import without activation
  'TRANSFERRED_DEACTIVATED',         -- Ownership transferred, account deactivated
  'TENANT_DEPARTED',                 -- Tenant vacated, archived
  'SUSPENDED',                       -- Manually suspended by Primary Admin (with reason)
  'DECEASED',                        -- Owner deceased, archived. Heir registers fresh
  'BLACKLISTED',                     -- Mobile blocked from re-registration (admin-visible only)
  'DEACTIVATED'                      -- Manually deactivated by admin
);

-- ─────────────────────────────────────────────────────────────────────
-- 19.4 Fee Status (expanded from MVP's 6 to 8)
-- Adds: ADVANCE_PAID, LIFETIME
-- ─────────────────────────────────────────────────────────────────────

CREATE TYPE fee_status AS ENUM (
  'NOT_YET_DUE',                     -- New member, first payment not processed
  'PENDING',                         -- Session started, within grace, no payment
  'OVERDUE',                         -- Past grace period, still unpaid
  'PARTIAL',                         -- Some paid, balance outstanding
  'PAID',                            -- Full amount received
  'ADVANCE_PAID',                    -- Next session paid before April 1
  'EXEMPTED',                        -- Fee waived for this session (admin + reason)
  'LIFETIME'                         -- Annual fee never applicable (Super Admin grants)
);

-- ─────────────────────────────────────────────────────────────────────
-- 19.5 Payment Entry Type (NEW — replaces MVP's is_reversal boolean)
-- ─────────────────────────────────────────────────────────────────────

CREATE TYPE payment_entry_type AS ENUM (
  'PAYMENT',                         -- Standard fee payment (full amount)
  'PARTIAL_PAYMENT',                 -- Less than full amount
  'CORRECTION',                      -- Edit within 48-hour correction window
  'REVERSAL',                        -- Cancellation after 48 hours
  'REFUND',                          -- Money returned to resident
  'WRITE_OFF',                       -- Uncollectable arrear (transferred/deceased)
  'EXEMPTION'                        -- Fee marked exempt (creates exemption record)
);

-- ─────────────────────────────────────────────────────────────────────
-- 19.6 Payment Mode (expanded from MVP's 4 to 5)
-- Adds: CHEQUE, ONLINE; drops OTHER
-- ─────────────────────────────────────────────────────────────────────

CREATE TYPE payment_mode AS ENUM (
  'CASH',                            -- Physical currency (reference optional)
  'UPI',                             -- GPay, PhonePe, Paytm (reference mandatory)
  'BANK_TRANSFER',                   -- NEFT/RTGS/IMPS (UTR mandatory)
  'CHEQUE',                          -- Physical cheque (cheque number mandatory)
  'ONLINE'                           -- Payment gateway — Razorpay/PayU (Phase 6, system-set)
);

-- ─────────────────────────────────────────────────────────────────────
-- 19.8 Expense Entry Status
-- ─────────────────────────────────────────────────────────────────────

CREATE TYPE expense_status AS ENUM ('ACTIVE', 'REVERSED');

-- ─────────────────────────────────────────────────────────────────────
-- 19.7 Expense Category (expanded from MVP's 9 to 11)
-- Adds: FESTIVAL, LEGAL
-- ─────────────────────────────────────────────────────────────────────

CREATE TYPE expense_category AS ENUM (
  'MAINTENANCE',                     -- Building/area upkeep, repairs
  'SECURITY',                        -- Guard salary, CCTV, barriers
  'CLEANING',                        -- Sweeper, garbage, sanitation
  'STAFF_SALARY',                    -- Society staff payroll
  'INFRASTRUCTURE',                  -- Roads, landscaping, wiring
  'UTILITIES',                       -- Common electricity, water, internet
  'FESTIVAL',                        -- Festival/event spend (links to festival_id)
  'EMERGENCY',                       -- Unplanned urgent repairs (description mandatory)
  'LEGAL',                           -- Legal fees, notices, court filings
  'ADMINISTRATIVE',                  -- Office supplies, printing, bank charges
  'OTHER'                            -- Anything else (description mandatory)
);

-- ─────────────────────────────────────────────────────────────────────
-- 19.11 Notification Channel (expanded from MVP's 2 to 4)
-- Adds: PUSH, EMAIL
-- ─────────────────────────────────────────────────────────────────────

CREATE TYPE notification_channel AS ENUM (
  'WHATSAPP',                        -- Meta Business API (primary)
  'SMS',                             -- MSG91/Twilio (fallback)
  'PUSH',                            -- Firebase Cloud Messaging (PWA/mobile, Phase 6)
  'EMAIL'                            -- SMTP/SendGrid (receipts + reports only)
);

-- ─────────────────────────────────────────────────────────────────────
-- 19.12 Notification Delivery Status (modified from MVP)
-- Adds: RETRYING; removes: READ
-- ─────────────────────────────────────────────────────────────────────

CREATE TYPE notification_status AS ENUM (
  'QUEUED',                          -- In queue, not yet sent
  'SENT',                            -- Dispatched to API
  'DELIVERED',                       -- Confirmed on device
  'FAILED',                          -- All retries exhausted (after 3 attempts)
  'RETRYING'                         -- Retry in progress (during retry interval)
);

-- ─────────────────────────────────────────────────────────────────────
-- 19.3 Admin Term Status (expanded from MVP)
-- ─────────────────────────────────────────────────────────────────────

CREATE TYPE admin_term_status AS ENUM (
  'ACTIVE',                          -- Live, full permissions per role
  'EXPIRED',                         -- Term ended, auto-downgraded to read-only
  'EXTENDED',                        -- Temporary extension (Super Admin; max 2 x 30 days)
  'VACATED',                         -- Mid-term vacancy (Super Admin on request)
  'ARCHIVED'                         -- Historical record after new admin activated post-election
);

-- ─────────────────────────────────────────────────────────────────────
-- 19.9 Festival Status (expanded from MVP's 4 to 5)
-- Changes: ACTIVE → COLLECTING; adds CLOSED
-- ─────────────────────────────────────────────────────────────────────

CREATE TYPE festival_status AS ENUM (
  'DRAFT',                           -- Created, not published. All fields editable
  'COLLECTING',                      -- Published, accepting contributions
  'CLOSED',                          -- Collection ended, expenses being finalised
  'COMPLETED',                       -- Settlement report published
  'CANCELLED'                        -- Cancelled, disposal in progress
);

-- ─────────────────────────────────────────────────────────────────────
-- 19.10 Festival Surplus Disposal
-- ─────────────────────────────────────────────────────────────────────

CREATE TYPE disposal_type AS ENUM (
  'CARRY_FORWARD',                   -- Surplus to next festival
  'TRANSFER_TO_SOCIETY',             -- Surplus to main society fund
  'REFUND_CONTRIBUTORS'              -- Proportional refund to contributors
);

-- ─────────────────────────────────────────────────────────────────────
-- Expense Query Status (dispute workflow)
-- ─────────────────────────────────────────────────────────────────────

CREATE TYPE query_status AS ENUM (
  'OPEN',                            -- Raised by resident, awaiting admin response
  'RESPONDED',                       -- Admin responded
  'ESCALATED',                       -- Escalated to higher authority
  'UNDER_REVIEW',                    -- Under formal review
  'RESOLVED'                         -- Resolution accepted
);

-- ─────────────────────────────────────────────────────────────────────
-- 19.16 Transfer / Departure Type
-- ─────────────────────────────────────────────────────────────────────

CREATE TYPE transfer_type AS ENUM (
  'OWNERSHIP_SALE',                  -- Unit sold to new person
  'TENANT_DEPARTURE',                -- Tenant vacated
  'BUILDER_FLOOR_PARTIAL',           -- Multi-floor owner sells one floor
  'INHERITANCE'                      -- Owner deceased, heir takes over
);

-- ─────────────────────────────────────────────────────────────────────
-- 19.18 Registration Rejection Reason
-- ─────────────────────────────────────────────────────────────────────

CREATE TYPE rejection_reason_type AS ENUM (
  'NOT_RESIDENT',                    -- Not a resident/owner
  'DUPLICATE_ENTRY',                 -- Mobile or unit already registered
  'INCORRECT_INFORMATION',           -- Details don't match records
  'UNDER_VERIFICATION',              -- Temporary hold (registration stays active)
  'ADMIN_DISCRETION'                 -- Other reason (note mandatory)
);

-- ─────────────────────────────────────────────────────────────────────
-- Recurring Expense Frequency
-- ─────────────────────────────────────────────────────────────────────

CREATE TYPE recurring_frequency AS ENUM (
  'DAILY',
  'WEEKLY',
  'BIWEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'HALF_YEARLY',
  'YEARLY'
);

-- ─────────────────────────────────────────────────────────────────────
-- Migration Row Status (bulk import)
-- ─────────────────────────────────────────────────────────────────────

CREATE TYPE migration_row_status AS ENUM ('VALID', 'ERROR', 'SKIPPED', 'IMPORTED');

-- ─────────────────────────────────────────────────────────────────────
-- Visitor Status
-- ─────────────────────────────────────────────────────────────────────

CREATE TYPE visitor_status AS ENUM (
  'EXPECTED',                        -- Pre-registered, not yet arrived
  'ARRIVED',                         -- Checked in at gate
  'DEPARTED',                        -- Checked out
  'CANCELLED',                       -- Visit cancelled by resident
  'NO_SHOW'                          -- Did not arrive by expected date
);
```

---

## 2. Core Tables

### Table 1: societies

The root tenant entity. All data is scoped to a society.

**v3.0 additions from MVP**: `admin_term_months`, `registration_no` (was optional in MVP, now prominently placed), full `address` field, `whatsapp_business_number` (Phase 5), `default_currency`, `locale`.

```sql
CREATE TABLE societies (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id              VARCHAR(30) UNIQUE NOT NULL,     -- RWA-HR-GGN-122001-0001
  society_code            VARCHAR(8) UNIQUE NOT NULL,      -- EDENESTATE (admin-chosen, 4-8 alphanum)
  name                    VARCHAR(200) NOT NULL,
  registration_no         VARCHAR(50),                      -- Societies Registration Act number
  address                 TEXT,                              -- Full postal address of the society

  -- Location
  state                   VARCHAR(2) NOT NULL,              -- ISO state code (HR, DL, MH)
  city                    VARCHAR(50) NOT NULL,             -- Full city name for display
  city_code               VARCHAR(3) NOT NULL,              -- Abbreviated for Society ID (GGN, MUM)
  pincode                 VARCHAR(6) NOT NULL,
  type                    society_type NOT NULL,
  total_units             INTEGER NOT NULL DEFAULT 0,

  -- Configurable fees
  joining_fee             DECIMAL(10,2) NOT NULL DEFAULT 1000,
  annual_fee              DECIMAL(10,2) NOT NULL DEFAULT 1200,
  fee_session_start_month INTEGER NOT NULL DEFAULT 4,       -- April = 4
  grace_period_days       INTEGER NOT NULL DEFAULT 15,

  -- Admin term configuration
  admin_term_months       INTEGER NOT NULL DEFAULT 24,      -- 12 or 24 months per election term

  -- Subscription
  plan                    subscription_plan NOT NULL DEFAULT 'TRIAL',
  status                  society_status NOT NULL DEFAULT 'TRIAL',
  subscription_expires_at TIMESTAMPTZ,
  trial_ends_at           TIMESTAMPTZ,

  -- WhatsApp configuration (Phase 5 — per-RWA sender)
  whatsapp_business_number VARCHAR(15),                     -- Per-RWA WhatsApp number (NULL = platform default)
  whatsapp_api_key         VARCHAR(200),                    -- Encrypted Meta Business API key

  -- Internationalisation (Phase 8)
  default_currency        VARCHAR(3) NOT NULL DEFAULT 'INR',-- ISO 4217 currency code
  locale                  VARCHAR(10) NOT NULL DEFAULT 'en-IN', -- BCP 47 locale tag

  -- Metadata
  onboarding_date         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Society ID generation: RWA-[STATE]-[CITY3]-[PINCODE]-[SEQ]
-- SEQ = count existing societies with same pincode + 1, zero-padded to 4 digits

CREATE INDEX idx_societies_pincode ON societies(pincode);
CREATE INDEX idx_societies_status ON societies(status);
CREATE INDEX idx_societies_state_city ON societies(state, city_code);
CREATE INDEX idx_societies_code ON societies(society_code);
CREATE INDEX idx_societies_plan ON societies(plan);
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

### Table 2: users

All platform users — Super Admin, RWA Admins (Primary + Supporting), and Residents (Owner, NRO, Joint, Tenant).

**v3.0 additions from MVP**: `is_lifetime_member`, expanded `ownership_type` (4 values), expanded `user_role` (7 values), `admin_position`, `date_of_birth`, `alternate_mobile`, `emergency_contact`.

```sql
CREATE TABLE users (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id              UUID REFERENCES societies(id),    -- NULL for Super Admin
  rwaid                   VARCHAR(40) UNIQUE,                -- RWA-HR-GGN-122001-0001-2025-0089
  auth_user_id            UUID UNIQUE,                       -- Supabase Auth user ID

  -- Identity
  name                    VARCHAR(100) NOT NULL,
  mobile                  VARCHAR(15) NOT NULL,
  alternate_mobile        VARCHAR(15),                       -- Secondary contact number
  email                   VARCHAR(100),
  date_of_birth           DATE,
  photo_url               VARCHAR(500),
  id_proof_url            VARCHAR(500),

  -- Role & ownership
  role                    user_role NOT NULL,
  ownership_type          ownership_type,                    -- NULL for Super Admin / admin-only roles
  status                  resident_status NOT NULL DEFAULT 'PENDING_APPROVAL',

  -- Admin fields (NULL for non-admins)
  admin_permission        admin_permission,                  -- FULL_ACCESS / HIGH_ACCESS / FINANCE_ACCESS / READ_NOTIFY / CONFIGURABLE
  admin_position          admin_position,                    -- PRESIDENT / VICE_PRESIDENT / SECRETARY / etc.

  -- Lifetime membership
  is_lifetime_member      BOOLEAN NOT NULL DEFAULT false,    -- Super Admin only can set this
  lifetime_granted_at     TIMESTAMPTZ,
  lifetime_granted_by     UUID REFERENCES users(id),

  -- Consent
  consent_whatsapp        BOOLEAN NOT NULL DEFAULT false,
  consent_whatsapp_at     TIMESTAMPTZ,
  consent_sms             BOOLEAN NOT NULL DEFAULT false,
  consent_email           BOOLEAN NOT NULL DEFAULT false,
  consent_push            BOOLEAN NOT NULL DEFAULT false,

  -- Security
  pin_hash                VARCHAR(100),                      -- 4-digit PIN (bcrypt hashed)
  pin_failed_attempts     INTEGER NOT NULL DEFAULT 0,
  pin_locked_until        TIMESTAMPTZ,

  -- Financial
  joining_fee_paid        BOOLEAN NOT NULL DEFAULT false,

  -- Emergency contact
  emergency_contact_name  VARCHAR(100),
  emergency_contact_mobile VARCHAR(15),

  -- Lifecycle timestamps
  registered_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at             TIMESTAMPTZ,
  approved_by             UUID REFERENCES users(id),
  rejected_at             TIMESTAMPTZ,
  rejected_by             UUID REFERENCES users(id),
  rejection_reason        TEXT,
  rejection_reason_type   rejection_reason_type,             -- Structured rejection reason
  activated_at            TIMESTAMPTZ,                       -- First login after approval
  deactivated_at          TIMESTAMPTZ,
  deactivation_reason     TEXT,
  last_login_at           TIMESTAMPTZ,                       -- Track last activity
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Mobile unique per society (same person can be in multiple societies)
  UNIQUE(society_id, mobile)
);

CREATE INDEX idx_users_society ON users(society_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_rwaid ON users(rwaid);
CREATE INDEX idx_users_mobile ON users(mobile);
CREATE INDEX idx_users_auth ON users(auth_user_id);
CREATE INDEX idx_users_ownership ON users(ownership_type);
CREATE INDEX idx_users_admin_position ON users(admin_position) WHERE admin_position IS NOT NULL;
CREATE INDEX idx_users_lifetime ON users(society_id) WHERE is_lifetime_member = true;
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

### Table 3: units

Physical property units — houses, flats, villas, plots. Dynamic address fields per society type (same approach as MVP).

```sql
CREATE TABLE units (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id              UUID NOT NULL REFERENCES societies(id),

  -- Display label (auto-generated from type-specific fields)
  display_label           VARCHAR(50) NOT NULL,              -- "B-12-1204" or "S22-St7-H245"

  -- Apartment Complex fields
  tower_block             VARCHAR(20),                       -- Tower A, Block B
  floor_no                VARCHAR(10),                       -- 1, 2, 12, G
  flat_no                 VARCHAR(20),                       -- 1204, A-101

  -- Builder Floor fields
  house_no                VARCHAR(20),                       -- 42, 245
  floor_level             VARCHAR(10),                       -- GF, 1F, 2F, 3F, Terrace

  -- Gated Community Villas fields
  villa_no                VARCHAR(20),                       -- 17, A-12
  street_phase            VARCHAR(30),                       -- Phase 2, Street 5

  -- Independent Sector Colony fields
  sector_block            VARCHAR(20),                       -- Sector 22, Block A
  street_gali             VARCHAR(20),                       -- Street 7, Gali 3

  -- Plotted Colony fields
  plot_no                 VARCHAR(20),                       -- 89, A-23
  lane_no                 VARCHAR(20),                       -- Lane 4

  -- Shared optional field
  phase                   VARCHAR(20),                       -- Phase 1, Phase 2

  -- Occupancy
  primary_owner_id        UUID REFERENCES users(id),
  current_tenant_id       UUID REFERENCES users(id),

  -- Unit area (optional, for reports)
  area_sqft               DECIMAL(10,2),
  area_sqm                DECIMAL(10,2),

  -- Metadata
  is_active               BOOLEAN NOT NULL DEFAULT true,     -- Soft delete for decommissioned units
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_units_society ON units(society_id);
CREATE INDEX idx_units_owner ON units(primary_owner_id);
CREATE INDEX idx_units_tenant ON units(current_tenant_id);
CREATE INDEX idx_units_display ON units(society_id, display_label);
CREATE INDEX idx_units_active ON units(society_id) WHERE is_active = true;
```

**Display Label Generation per Society Type**:

```
APARTMENT_COMPLEX:             "{tower_block}-{floor_no}-{flat_no}"           -> "B-12-1204"
BUILDER_FLOORS:                "{house_no}-{floor_level}"                     -> "42-1F"
GATED_COMMUNITY_VILLAS:        "Villa-{villa_no}-{street_phase_abbr}"         -> "Villa-17-P2"
INDEPENDENT_SECTOR_COLONY:     "S{sector_block}-St{street_gali}-H{house_no}" -> "S22-St7-H245"
PLOTTED_COLONY:                "Plot-{plot_no}-L{lane_no}"                    -> "Plot-89-L4"
```

**Required fields per society type**:
| Society Type | Required | Optional |
|---|---|---|
| APARTMENT_COMPLEX | tower_block, floor_no, flat_no | phase |
| BUILDER_FLOORS | house_no, floor_level | phase |
| GATED_COMMUNITY_VILLAS | villa_no | street_phase, phase |
| INDEPENDENT_SECTOR_COLONY | house_no, street_gali, sector_block | phase |
| PLOTTED_COLONY | plot_no | lane_no, phase |

---

### Table 4: user_units

Join table linking residents to units. Supports multiple residents per unit and multiple units per resident.

```sql
CREATE TABLE user_units (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES users(id),
  unit_id                 UUID NOT NULL REFERENCES units(id),
  is_primary              BOOLEAN NOT NULL DEFAULT true,     -- Primary resident vs secondary
  relationship            ownership_type NOT NULL DEFAULT 'OWNER',  -- Uses the ownership_type enum
  linked_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  unlinked_at             TIMESTAMPTZ,

  UNIQUE(user_id, unit_id)
);

CREATE INDEX idx_user_units_user ON user_units(user_id);
CREATE INDEX idx_user_units_unit ON user_units(unit_id);
CREATE INDEX idx_user_units_active ON user_units(unit_id) WHERE unlinked_at IS NULL;
```

---

### Table 5: membership_fees

Session-wise fee records per user. One record per user per financial session. Supports advance payments and lifetime memberships.

```sql
CREATE TABLE membership_fees (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES users(id),
  unit_id                 UUID REFERENCES units(id),
  society_id              UUID NOT NULL REFERENCES societies(id),

  -- Session
  session_year            VARCHAR(7) NOT NULL,               -- "2025-26"
  session_start           DATE NOT NULL,                     -- 2025-04-01
  session_end             DATE NOT NULL,                     -- 2026-03-31

  -- Amounts
  amount_due              DECIMAL(10,2) NOT NULL,
  amount_paid             DECIMAL(10,2) NOT NULL DEFAULT 0,
  balance                 DECIMAL(10,2) GENERATED ALWAYS AS (amount_due - amount_paid) STORED,

  -- Status (8 values in v3.0)
  status                  fee_status NOT NULL DEFAULT 'NOT_YET_DUE',
  grace_period_end        DATE,                              -- Session start + grace days

  -- Pro-rata (for mid-year joiners)
  is_prorata              BOOLEAN NOT NULL DEFAULT false,
  prorata_months          INTEGER,                           -- Remaining months when joined
  joining_fee_included    BOOLEAN NOT NULL DEFAULT false,    -- First-ever payment includes joining fee

  -- Advance payment tracking
  is_advance              BOOLEAN NOT NULL DEFAULT false,    -- Paid before session starts
  advance_received_date   DATE,                              -- When advance was recorded

  -- Lifetime exemption
  is_lifetime             BOOLEAN NOT NULL DEFAULT false,    -- Lifetime member — fee never due

  -- Exemption
  exemption_reason        TEXT,
  exempted_by             UUID REFERENCES users(id),
  exempted_at             TIMESTAMPTZ,

  -- Migration marker
  is_pre_migration        BOOLEAN NOT NULL DEFAULT false,    -- Historical arrear from before platform

  -- Metadata
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_fees_society ON membership_fees(society_id);
CREATE INDEX idx_fees_user ON membership_fees(user_id);
CREATE INDEX idx_fees_session ON membership_fees(session_year);
CREATE INDEX idx_fees_status ON membership_fees(status);
CREATE INDEX idx_fees_unit ON membership_fees(unit_id);
CREATE INDEX idx_fees_advance ON membership_fees(society_id) WHERE is_advance = true;
CREATE UNIQUE INDEX idx_fees_user_session ON membership_fees(user_id, session_year)
  WHERE is_pre_migration = false;
```

**Pro-Rata Calculation** (stored at approval time):

```
approval_month = month of admin approval (e.g., July = 7)
session_start_month = society.fee_session_start_month (e.g., April = 4)
remaining_months = 12 - (approval_month - session_start_month)
  -> if approval_month < session_start_month: remaining_months = session_start_month - approval_month
monthly_rate = society.annual_fee / 12
prorata_amount = monthly_rate * remaining_months
amount_due = society.joining_fee + prorata_amount  (if first payment)
           = prorata_amount                        (if already a member)
```

---

### Table 6: fee_payments

Individual payment entries against a fee record. Uses explicit `payment_entry_type` enum (7 types) instead of MVP's boolean flags.

```sql
CREATE TABLE fee_payments (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_id                  UUID NOT NULL REFERENCES membership_fees(id),
  user_id                 UUID NOT NULL REFERENCES users(id),
  society_id              UUID NOT NULL REFERENCES societies(id),

  -- Payment classification (v3.0 — replaces MVP's is_reversal boolean)
  entry_type              payment_entry_type NOT NULL DEFAULT 'PAYMENT',

  -- Payment details
  amount                  DECIMAL(10,2) NOT NULL,            -- Negative for REVERSAL/REFUND/WRITE_OFF
  payment_mode            payment_mode NOT NULL,
  reference_no            VARCHAR(50),                       -- Mandatory for UPI/Bank Transfer/Cheque
  receipt_no              VARCHAR(50) UNIQUE NOT NULL,       -- EDENESTATE-2025-R0042
  receipt_url             VARCHAR(500),                      -- PDF URL in Supabase Storage
  payment_date            DATE NOT NULL,
  notes                   TEXT,

  -- Cheque-specific fields
  cheque_number           VARCHAR(20),
  cheque_bank             VARCHAR(100),
  cheque_date             DATE,
  cheque_clearance_date   DATE,                              -- NULL until cleared

  -- Online gateway fields (Phase 6)
  gateway_order_id        VARCHAR(100),                      -- Razorpay order_id
  gateway_payment_id      VARCHAR(100),                      -- Razorpay payment_id
  gateway_signature       VARCHAR(200),                      -- Razorpay signature for verification
  gateway_status          VARCHAR(20),                       -- created, authorized, captured, failed

  -- Recording
  recorded_by             UUID NOT NULL REFERENCES users(id),

  -- Linked entry tracking (for corrections, reversals, refunds)
  linked_payment_id       UUID REFERENCES fee_payments(id),  -- Points to original payment (for REVERSAL/CORRECTION)
  linked_reason           TEXT,                               -- Reason for reversal/correction/refund/write_off

  -- Correction window (48 hours from recording)
  correction_window_ends  TIMESTAMPTZ,

  -- Metadata
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Receipt number format: [SOCIETY_CODE]-[YEAR]-R[SEQ]
-- Example: EDENESTATE-2025-R0042

CREATE INDEX idx_payments_society ON fee_payments(society_id);
CREATE INDEX idx_payments_fee ON fee_payments(fee_id);
CREATE INDEX idx_payments_user ON fee_payments(user_id);
CREATE INDEX idx_payments_date ON fee_payments(payment_date);
CREATE INDEX idx_payments_receipt ON fee_payments(receipt_no);
CREATE INDEX idx_payments_entry_type ON fee_payments(entry_type);
CREATE INDEX idx_payments_gateway ON fee_payments(gateway_order_id) WHERE gateway_order_id IS NOT NULL;
```

---

### Table 7: expenses

Society expense ledger. Chronological log with categories. Now links to festivals and supports recurring expense references.

```sql
CREATE TABLE expenses (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id              UUID NOT NULL REFERENCES societies(id),

  -- Expense details
  date                    DATE NOT NULL,
  amount                  DECIMAL(10,2) NOT NULL,
  category                expense_category NOT NULL,
  description             TEXT NOT NULL,
  receipt_url             VARCHAR(500),                      -- Photo/PDF of receipt

  -- Festival linkage (when category = FESTIVAL)
  festival_id             UUID REFERENCES festivals(id),

  -- Recurring expense linkage
  recurring_expense_id    UUID REFERENCES recurring_expenses(id),

  -- Recording
  logged_by               UUID NOT NULL REFERENCES users(id),

  -- Reversal tracking
  status                  expense_status NOT NULL DEFAULT 'ACTIVE',
  reversal_note           TEXT,
  reversed_by             UUID REFERENCES users(id),
  reversed_at             TIMESTAMPTZ,

  -- Correction window (24 hours from logging)
  correction_window_ends  TIMESTAMPTZ,

  -- Metadata
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_expenses_society ON expenses(society_id);
CREATE INDEX idx_expenses_date ON expenses(date);
CREATE INDEX idx_expenses_category ON expenses(category);
CREATE INDEX idx_expenses_status ON expenses(status);
CREATE INDEX idx_expenses_festival ON expenses(festival_id) WHERE festival_id IS NOT NULL;
CREATE INDEX idx_expenses_recurring ON expenses(recurring_expense_id) WHERE recurring_expense_id IS NOT NULL;
```

**Running Balance Calculation** (computed at query time):

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

### Table 8: recurring_expenses (NEW in v3.0)

Defines recurring expense templates that auto-generate expense entries.

```sql
CREATE TABLE recurring_expenses (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id              UUID NOT NULL REFERENCES societies(id),

  -- Template details
  name                    VARCHAR(200) NOT NULL,             -- "Monthly Guard Salary"
  amount                  DECIMAL(10,2) NOT NULL,
  category                expense_category NOT NULL,
  description             TEXT,

  -- Recurrence schedule
  frequency               recurring_frequency NOT NULL,      -- MONTHLY, QUARTERLY, etc.
  start_date              DATE NOT NULL,
  end_date                DATE,                               -- NULL = indefinite
  next_due_date           DATE NOT NULL,                      -- Next auto-generation date
  day_of_month            INTEGER,                            -- 1-28 for monthly (NULL for non-monthly)
  day_of_week             INTEGER,                            -- 0-6 for weekly (NULL for non-weekly)

  -- Auto-generation
  auto_create             BOOLEAN NOT NULL DEFAULT false,     -- Auto-create expense on due date
  requires_approval       BOOLEAN NOT NULL DEFAULT true,      -- Admin must approve auto-created entry

  -- Tracking
  total_generated         INTEGER NOT NULL DEFAULT 0,         -- Count of expenses generated from this template
  last_generated_at       TIMESTAMPTZ,

  -- Status
  is_active               BOOLEAN NOT NULL DEFAULT true,
  paused_at               TIMESTAMPTZ,
  paused_reason           TEXT,

  -- Recording
  created_by              UUID NOT NULL REFERENCES users(id),

  -- Metadata
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_recurring_society ON recurring_expenses(society_id);
CREATE INDEX idx_recurring_active ON recurring_expenses(society_id) WHERE is_active = true;
CREATE INDEX idx_recurring_next_due ON recurring_expenses(next_due_date) WHERE is_active = true;
```

---

### Table 9: notifications

Multi-channel notification tracking (WhatsApp, SMS, Push, Email).

```sql
CREATE TABLE notifications (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES users(id),
  society_id              UUID REFERENCES societies(id),     -- NULL for Super Admin notifications

  -- Message details
  type                    VARCHAR(50) NOT NULL,               -- REGISTRATION_SUBMITTED, PAYMENT_RECORDED, etc.
  channel                 notification_channel NOT NULL,      -- WHATSAPP, SMS, PUSH, EMAIL
  template_name           VARCHAR(100),                       -- WhatsApp template name / email template
  content_vars            JSONB,                              -- {Name: "Hemant", Amount: "1200"}
  content_preview         TEXT,                               -- Rendered message preview
  subject                 VARCHAR(200),                       -- Email subject line (EMAIL channel only)

  -- Delivery
  status                  notification_status NOT NULL DEFAULT 'QUEUED',
  sent_at                 TIMESTAMPTZ,
  delivered_at            TIMESTAMPTZ,
  failed_reason           TEXT,
  retry_count             INTEGER NOT NULL DEFAULT 0,
  max_retries             INTEGER NOT NULL DEFAULT 3,
  next_retry_at           TIMESTAMPTZ,                       -- Scheduled retry time

  -- Fallback tracking
  fallback_channel        notification_channel,              -- If WhatsApp fails, fallback to SMS
  fallback_notification_id UUID REFERENCES notifications(id),-- Link to fallback notification

  -- Broadcast grouping
  broadcast_id            UUID,                               -- Groups messages from same broadcast

  -- Metadata
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_society ON notifications(society_id);
CREATE INDEX idx_notifications_status ON notifications(status);
CREATE INDEX idx_notifications_broadcast ON notifications(broadcast_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_channel ON notifications(channel);
CREATE INDEX idx_notifications_retry ON notifications(next_retry_at)
  WHERE status = 'RETRYING';
```

---

### Table 10: broadcasts

Manual broadcast records with expanded channel support.

```sql
CREATE TABLE broadcasts (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id              UUID NOT NULL REFERENCES societies(id),
  sent_by                 UUID NOT NULL REFERENCES users(id),

  -- Content
  message                 TEXT NOT NULL,
  subject                 VARCHAR(200),                       -- For email broadcasts
  recipient_filter        VARCHAR(30) NOT NULL,               -- ALL_ACTIVE, FEE_PENDING, FEE_OVERDUE, CUSTOM
  recipient_count         INTEGER NOT NULL,
  channels                JSONB NOT NULL DEFAULT '["WHATSAPP"]', -- Array of channels used

  -- Delivery stats (per channel)
  delivered_count         INTEGER NOT NULL DEFAULT 0,
  failed_count            INTEGER NOT NULL DEFAULT 0,
  delivery_stats          JSONB,                              -- {WHATSAPP: {sent: 50, delivered: 48}, SMS: {sent: 2, delivered: 2}}

  -- Metadata
  sent_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_broadcasts_society ON broadcasts(society_id);
CREATE INDEX idx_broadcasts_date ON broadcasts(sent_at);
```

---

### Table 11: audit_logs

Immutable operation log. **INSERT only — no UPDATE or DELETE ever.**

```sql
CREATE TABLE audit_logs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id              UUID REFERENCES societies(id),
  user_id                 UUID NOT NULL REFERENCES users(id),
  action_type             VARCHAR(20) NOT NULL,               -- CREATE, UPDATE, DELETE, STATUS_CHANGE, LOGIN, LOGOUT
  entity_type             VARCHAR(30) NOT NULL,               -- USER, FEE_PAYMENT, EXPENSE, ADMIN_TERM, FESTIVAL, etc.
  entity_id               UUID NOT NULL,
  old_value               JSONB,                              -- Before state (for updates)
  new_value               JSONB,                              -- After state
  description             TEXT,                               -- Human-readable summary
  ip_address              INET,
  user_agent              TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_society ON audit_logs(society_id);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_date ON audit_logs(created_at);
CREATE INDEX idx_audit_action ON audit_logs(action_type);

-- CRITICAL: No UPDATE or DELETE permissions on this table. INSERT only.
```

---

### Table 12: migration_batches

Tracks bulk Excel import operations.

```sql
CREATE TABLE migration_batches (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id              UUID NOT NULL REFERENCES societies(id),
  uploaded_by             UUID NOT NULL REFERENCES users(id),
  file_url                VARCHAR(500) NOT NULL,
  file_name               VARCHAR(200),                       -- Original filename for reference
  total_rows              INTEGER NOT NULL,
  valid_rows              INTEGER NOT NULL DEFAULT 0,
  error_rows              INTEGER NOT NULL DEFAULT 0,
  skipped_rows            INTEGER NOT NULL DEFAULT 0,
  imported_rows           INTEGER NOT NULL DEFAULT 0,
  validation_report       JSONB,                              -- [{row: 5, field: "mobile", error: "Duplicate"}]
  status                  VARCHAR(20) NOT NULL DEFAULT 'UPLOADED',
                                                              -- UPLOADED, VALIDATED, IMPORTING, COMPLETED, FAILED
  error_file_url          VARCHAR(500),                       -- CSV with error rows for re-upload
  completed_at            TIMESTAMPTZ,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_migration_society ON migration_batches(society_id);
CREATE INDEX idx_migration_status ON migration_batches(status);
```

---

### Table 13: notification_preferences

Resident opt-in/opt-out per channel and trigger type.

```sql
CREATE TABLE notification_preferences (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES users(id),
  society_id              UUID NOT NULL REFERENCES societies(id),

  -- Channel preferences
  prefer_whatsapp         BOOLEAN NOT NULL DEFAULT true,
  prefer_sms              BOOLEAN NOT NULL DEFAULT false,
  prefer_push             BOOLEAN NOT NULL DEFAULT true,
  prefer_email            BOOLEAN NOT NULL DEFAULT false,

  -- Optional triggers (mandatory ones cannot be turned off)
  fee_reminder            BOOLEAN NOT NULL DEFAULT true,
  fee_overdue_alert       BOOLEAN NOT NULL DEFAULT true,
  society_broadcasts      BOOLEAN NOT NULL DEFAULT true,
  festival_updates        BOOLEAN NOT NULL DEFAULT true,
  visitor_notifications   BOOLEAN NOT NULL DEFAULT true,
  election_updates        BOOLEAN NOT NULL DEFAULT true,

  -- Quiet hours
  quiet_hours_start       TIME,                               -- e.g., 22:00
  quiet_hours_end         TIME,                               -- e.g., 07:00

  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(user_id, society_id)
);

CREATE INDEX idx_notif_prefs_user ON notification_preferences(user_id);
```

---

### Table 14: fee_sessions

Tracks financial session configuration per society per year.

```sql
CREATE TABLE fee_sessions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id              UUID NOT NULL REFERENCES societies(id),
  session_year            VARCHAR(7) NOT NULL,               -- "2025-26"
  annual_fee              DECIMAL(10,2) NOT NULL,            -- Fee for this specific session
  joining_fee             DECIMAL(10,2) NOT NULL,            -- Joining fee for this session
  session_start           DATE NOT NULL,                     -- 2025-04-01
  session_end             DATE NOT NULL,                     -- 2026-03-31
  grace_period_end        DATE NOT NULL,                     -- 2025-04-15

  -- Session stats (denormalised for dashboard)
  total_members           INTEGER NOT NULL DEFAULT 0,
  total_collected         DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_pending           DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_exempted          INTEGER NOT NULL DEFAULT 0,

  status                  VARCHAR(20) NOT NULL DEFAULT 'UPCOMING',
                                                              -- UPCOMING, ACTIVE, CLOSED
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(society_id, session_year)
);

CREATE INDEX idx_fee_sessions_society ON fee_sessions(society_id);
CREATE INDEX idx_fee_sessions_status ON fee_sessions(status);
```

---

### Table 15: admin_terms (Fully Active — Election Lifecycle)

Tracks admin election terms, extensions, and transitions. Each row represents one person holding one position for one term.

```sql
CREATE TABLE admin_terms (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES users(id),
  society_id              UUID NOT NULL REFERENCES societies(id),

  -- Position & permissions
  position                admin_position NOT NULL,            -- PRESIDENT, VICE_PRESIDENT, etc.
  permission              admin_permission NOT NULL,           -- FULL_ACCESS, HIGH_ACCESS, etc.

  -- Term dates
  term_start              TIMESTAMPTZ NOT NULL,
  term_end                TIMESTAMPTZ NOT NULL,               -- Computed: term_start + society.admin_term_months
  actual_end              TIMESTAMPTZ,                        -- When actually ended (may differ from term_end)

  -- Status
  status                  admin_term_status NOT NULL DEFAULT 'ACTIVE',

  -- Extension tracking (max 2 extensions of 30 days each)
  extension_count         INTEGER NOT NULL DEFAULT 0,
  last_extended_at        TIMESTAMPTZ,
  extension_expires_at    TIMESTAMPTZ,                        -- Original term_end + extension days

  -- Activation / deactivation
  activated_by            UUID REFERENCES users(id),          -- Super Admin who activated
  deactivated_by          UUID REFERENCES users(id),          -- Super Admin who deactivated
  deactivation_reason     TEXT,

  -- Election reference
  election_date           DATE,                                -- Date of election / appointment
  election_notes          TEXT,                                -- Meeting minutes reference

  -- Configurable permissions (for EXECUTIVE_MEMBER with CONFIGURABLE permission)
  custom_permissions      JSONB,                              -- {"can_record_payments": true, "can_manage_expenses": false, ...}

  -- Metadata
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_terms_society ON admin_terms(society_id);
CREATE INDEX idx_admin_terms_user ON admin_terms(user_id);
CREATE INDEX idx_admin_terms_status ON admin_terms(status);
CREATE INDEX idx_admin_terms_active ON admin_terms(society_id, status) WHERE status = 'ACTIVE';
CREATE INDEX idx_admin_terms_expiry ON admin_terms(term_end) WHERE status IN ('ACTIVE', 'EXTENDED');
```

**Term Lifecycle State Machine**:

```
ACTIVE ---[term_end reached]---> EXPIRED
ACTIVE ---[Super Admin extends]---> EXTENDED
ACTIVE ---[admin resigns/removed]---> VACATED
EXTENDED ---[extension expires]---> EXPIRED
EXPIRED ---[new admin activated]---> ARCHIVED
VACATED ---[new admin activated]---> ARCHIVED
```

**Default Permission Mapping**:
| Position | Default Permission |
|----------|-------------------|
| PRESIDENT | FULL_ACCESS |
| VICE_PRESIDENT | HIGH_ACCESS |
| SECRETARY | FULL_ACCESS |
| JOINT_SECRETARY | READ_NOTIFY |
| TREASURER | FINANCE_ACCESS |
| EXECUTIVE_MEMBER | CONFIGURABLE |

---

### Table 16: festivals (Fully Active — Festival Fund Management)

Full lifecycle: create, publish, collect, spend, settle, report.

```sql
CREATE TABLE festivals (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id              UUID NOT NULL REFERENCES societies(id),
  festival_id             VARCHAR(50) UNIQUE NOT NULL,        -- EDENESTATE-DIWALI-2025
  name                    VARCHAR(200) NOT NULL,
  description             TEXT,

  -- Event details
  event_date              DATE NOT NULL,
  event_end_date          DATE,                                -- Multi-day events

  -- Financial
  target_amount           DECIMAL(10,2) NOT NULL,
  min_contribution        DECIMAL(10,2),                      -- Suggested minimum per household
  collected_amount        DECIMAL(10,2) NOT NULL DEFAULT 0,
  spent_amount            DECIMAL(10,2) NOT NULL DEFAULT 0,
  surplus_amount          DECIMAL(10,2) GENERATED ALWAYS AS (collected_amount - spent_amount) STORED,

  -- Collection window
  collection_start        DATE NOT NULL,
  collection_end          DATE NOT NULL,

  -- Status lifecycle
  status                  festival_status NOT NULL DEFAULT 'DRAFT',
  published_at            TIMESTAMPTZ,                        -- When moved from DRAFT to COLLECTING
  closed_at               TIMESTAMPTZ,                        -- When collection ended
  completed_at            TIMESTAMPTZ,                        -- When settlement published
  cancellation_reason     TEXT,
  cancelled_at            TIMESTAMPTZ,

  -- Surplus disposal (after COMPLETED or CANCELLED)
  surplus_disposal        disposal_type,
  surplus_disposal_notes  TEXT,
  surplus_disposed_at     TIMESTAMPTZ,

  -- Contributors count
  total_contributors      INTEGER NOT NULL DEFAULT 0,

  -- Recording
  created_by              UUID NOT NULL REFERENCES users(id),

  -- Metadata
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Festival ID format: [SOCIETY_CODE]-[FESTIVAL_NAME_SLUG]-[YEAR]
-- Example: EDENESTATE-DIWALI-2025

CREATE INDEX idx_festivals_society ON festivals(society_id);
CREATE INDEX idx_festivals_status ON festivals(status);
CREATE INDEX idx_festivals_event_date ON festivals(event_date);
CREATE INDEX idx_festivals_collecting ON festivals(society_id, status) WHERE status = 'COLLECTING';
```

**Festival Lifecycle State Machine**:

```
DRAFT ---[admin publishes]---> COLLECTING
COLLECTING ---[collection_end reached]---> CLOSED
COLLECTING ---[admin cancels]---> CANCELLED
CLOSED ---[admin publishes settlement]---> COMPLETED
CLOSED ---[admin cancels]---> CANCELLED
COMPLETED ---[surplus disposed]---> (terminal)
CANCELLED ---[refunds processed]---> (terminal)
```

---

### Table 17: festival_contributions (Fully Active)

Individual contributions and refunds for a festival.

```sql
CREATE TABLE festival_contributions (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  festival_id             UUID NOT NULL REFERENCES festivals(id),
  user_id                 UUID NOT NULL REFERENCES users(id),
  unit_id                 UUID REFERENCES units(id),          -- Which unit this contribution is for
  society_id              UUID NOT NULL REFERENCES societies(id),

  -- Payment details
  amount                  DECIMAL(10,2) NOT NULL,             -- Negative for refunds
  payment_mode            payment_mode NOT NULL,
  reference_no            VARCHAR(50),
  receipt_no              VARCHAR(50) UNIQUE NOT NULL,         -- EDENESTATE-DIWALI-2025-C0042
  contributed_date        DATE NOT NULL,
  notes                   TEXT,

  -- Refund tracking
  is_refund               BOOLEAN NOT NULL DEFAULT false,
  refund_of               UUID REFERENCES festival_contributions(id), -- Points to original contribution
  refund_reason           TEXT,

  -- Recording
  recorded_by             UUID NOT NULL REFERENCES users(id),

  -- Metadata
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Receipt format: [SOCIETY_CODE]-[FESTIVAL_SLUG]-[YEAR]-C[SEQ]
-- Example: EDENESTATE-DIWALI-2025-C0042

CREATE INDEX idx_contributions_festival ON festival_contributions(festival_id);
CREATE INDEX idx_contributions_society ON festival_contributions(society_id);
CREATE INDEX idx_contributions_user ON festival_contributions(user_id);
CREATE INDEX idx_contributions_unit ON festival_contributions(unit_id);
```

---

### Table 18: expense_queries (Fully Active — Resident Dispute Module)

Residents can raise queries/disputes on expenses. Full workflow with escalation.

```sql
CREATE TABLE expense_queries (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id              UUID NOT NULL REFERENCES expenses(id),
  society_id              UUID NOT NULL REFERENCES societies(id),

  -- Query details
  raised_by               UUID NOT NULL REFERENCES users(id),
  query_text              TEXT NOT NULL,
  category                VARCHAR(50),                        -- AMOUNT_DISPUTE, RECEIPT_MISSING, VENDOR_CONCERN, OTHER

  -- Admin response
  admin_response          TEXT,
  responded_by            UUID REFERENCES users(id),
  responded_at            TIMESTAMPTZ,

  -- Escalation
  escalated_to            UUID REFERENCES users(id),          -- Which admin the query was escalated to
  escalated_at            TIMESTAMPTZ,
  escalation_reason       TEXT,

  -- Resolution
  status                  query_status NOT NULL DEFAULT 'OPEN',
  resolved_at             TIMESTAMPTZ,
  resolution_notes        TEXT,

  -- Metadata
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_queries_society ON expense_queries(society_id);
CREATE INDEX idx_queries_status ON expense_queries(status);
CREATE INDEX idx_queries_expense ON expense_queries(expense_id);
CREATE INDEX idx_queries_raised_by ON expense_queries(raised_by);
CREATE INDEX idx_queries_open ON expense_queries(society_id, status) WHERE status IN ('OPEN', 'ESCALATED');
```

---

### Table 19: property_transfers (Fully Active)

Tracks ownership transfers, tenant departures, inheritance, and partial floor sales.

```sql
CREATE TABLE property_transfers (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id                 UUID NOT NULL REFERENCES units(id),
  society_id              UUID NOT NULL REFERENCES societies(id),
  transfer_type           transfer_type NOT NULL,

  -- Parties
  outgoing_user_id        UUID NOT NULL REFERENCES users(id),
  incoming_user_id        UUID REFERENCES users(id),          -- NULL for TENANT_DEPARTURE with no replacement

  -- Transfer details
  transfer_date           DATE NOT NULL,
  effective_date          DATE,                                -- When the transfer takes effect (may differ from transfer_date)
  notes                   TEXT,

  -- Outstanding fee handling
  outstanding_fees        DECIMAL(10,2) DEFAULT 0,
  fees_written_off        BOOLEAN NOT NULL DEFAULT false,
  write_off_reason        TEXT,
  fees_transferred        BOOLEAN NOT NULL DEFAULT false,     -- Outstanding transferred to incoming user
  transfer_settlement     DECIMAL(10,2),                      -- Amount settled during transfer

  -- Document references
  sale_deed_url           VARCHAR(500),                       -- Scanned sale deed / agreement
  noc_url                 VARCHAR(500),                       -- Society NOC document

  -- Approval
  initiated_by            UUID NOT NULL REFERENCES users(id),
  approved_by             UUID REFERENCES users(id),
  approved_at             TIMESTAMPTZ,
  status                  VARCHAR(20) NOT NULL DEFAULT 'PENDING',
                                                              -- PENDING, APPROVED, COMPLETED, REJECTED

  -- Metadata
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transfers_society ON property_transfers(society_id);
CREATE INDEX idx_transfers_unit ON property_transfers(unit_id);
CREATE INDEX idx_transfers_outgoing ON property_transfers(outgoing_user_id);
CREATE INDEX idx_transfers_incoming ON property_transfers(incoming_user_id);
CREATE INDEX idx_transfers_status ON property_transfers(status);
CREATE INDEX idx_transfers_type ON property_transfers(transfer_type);
```

---

### Table 20: visitor_logs (Fully Active — Visitor Management)

Visitor pre-registration with QR code verification at gate.

```sql
CREATE TABLE visitor_logs (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id              UUID NOT NULL REFERENCES societies(id),
  resident_id             UUID NOT NULL REFERENCES users(id), -- Host resident
  unit_id                 UUID REFERENCES units(id),          -- Which unit the visitor is visiting

  -- Visitor details
  visitor_name            VARCHAR(100) NOT NULL,
  visitor_mobile          VARCHAR(15),
  visitor_email           VARCHAR(100),
  visitor_photo_url       VARCHAR(500),                       -- Photo captured at gate
  vehicle_number          VARCHAR(20),                        -- Vehicle plate number
  purpose                 VARCHAR(200),
  company_name            VARCHAR(100),                       -- For delivery / service visitors

  -- Visit schedule
  expected_date           DATE NOT NULL,
  expected_time           TIME,
  expected_departure      TIMESTAMPTZ,

  -- QR verification
  visitor_code            VARCHAR(20) UNIQUE,                 -- 6-digit alphanumeric code
  qr_code_url             VARCHAR(500),                       -- Generated QR code image URL

  -- Check-in / Check-out
  status                  visitor_status NOT NULL DEFAULT 'EXPECTED',
  arrived_at              TIMESTAMPTZ,
  departed_at             TIMESTAMPTZ,
  checked_in_by           VARCHAR(100),                       -- Guard name or gate system

  -- Notifications
  host_notified_at        TIMESTAMPTZ,                        -- When host was notified of arrival

  -- Metadata
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_visitors_society ON visitor_logs(society_id);
CREATE INDEX idx_visitors_resident ON visitor_logs(resident_id);
CREATE INDEX idx_visitors_unit ON visitor_logs(unit_id);
CREATE INDEX idx_visitors_status ON visitor_logs(status);
CREATE INDEX idx_visitors_date ON visitor_logs(expected_date);
CREATE INDEX idx_visitors_code ON visitor_logs(visitor_code) WHERE visitor_code IS NOT NULL;
CREATE INDEX idx_visitors_expected ON visitor_logs(society_id, expected_date, status) WHERE status = 'EXPECTED';
```

---

### Table 21: dependents (Fully Active)

Family members / dependents of a resident. Used for resident directory and emergency contacts.

```sql
CREATE TABLE dependents (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID NOT NULL REFERENCES users(id),
  society_id              UUID NOT NULL REFERENCES societies(id),

  -- Personal details
  name                    VARCHAR(100) NOT NULL,
  relationship            VARCHAR(30) NOT NULL,               -- SPOUSE, CHILD, PARENT, SIBLING, OTHER
  date_of_birth           DATE,
  gender                  VARCHAR(10),                        -- MALE, FEMALE, OTHER

  -- Contact (optional — for adult dependents)
  mobile                  VARCHAR(15),
  email                   VARCHAR(100),

  -- Photo (optional)
  photo_url               VARCHAR(500),

  -- Emergency contact flag
  is_emergency_contact    BOOLEAN NOT NULL DEFAULT false,

  -- Metadata
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dependents_user ON dependents(user_id);
CREATE INDEX idx_dependents_society ON dependents(society_id);
CREATE INDEX idx_dependents_emergency ON dependents(user_id) WHERE is_emergency_contact = true;
```

---

### Table 22: blacklisted_numbers

Blocked mobile numbers per society — prevents re-registration.

```sql
CREATE TABLE blacklisted_numbers (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id              UUID NOT NULL REFERENCES societies(id),
  mobile                  VARCHAR(15) NOT NULL,
  reason                  TEXT NOT NULL,
  blacklisted_by          UUID NOT NULL REFERENCES users(id),
  expires_at              TIMESTAMPTZ,                        -- NULL = permanent
  is_active               BOOLEAN NOT NULL DEFAULT true,
  lifted_by               UUID REFERENCES users(id),
  lifted_at               TIMESTAMPTZ,
  lifted_reason           TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(society_id, mobile)
);

CREATE INDEX idx_blacklist_society ON blacklisted_numbers(society_id);
CREATE INDEX idx_blacklist_active ON blacklisted_numbers(society_id, mobile) WHERE is_active = true;
```

---

## 3. Row-Level Security (RLS) Policies

```sql
-- =====================================================================
-- ENABLE RLS ON ALL SOCIETY-SCOPED TABLES
-- =====================================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE membership_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE fee_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE festivals ENABLE ROW LEVEL SECURITY;
ALTER TABLE festival_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE property_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE visitor_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dependents ENABLE ROW LEVEL SECURITY;
ALTER TABLE blacklisted_numbers ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- HELPER FUNCTION: Get current user's society_id and role
-- =====================================================================

CREATE OR REPLACE FUNCTION auth_society_id() RETURNS UUID AS $$
  SELECT society_id FROM users WHERE auth_user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth_user_role() RETURNS user_role AS $$
  SELECT role FROM users WHERE auth_user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth_user_id() RETURNS UUID AS $$
  SELECT id FROM users WHERE auth_user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION auth_admin_permission() RETURNS admin_permission AS $$
  SELECT admin_permission FROM users WHERE auth_user_id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =====================================================================
-- CORE ISOLATION: Users can only see data from their own society
-- Applied to most tables (template shown for users, replicate for others)
-- =====================================================================

-- users: Society isolation + Super Admin bypass
CREATE POLICY society_isolation ON users
  FOR ALL USING (
    society_id = auth_society_id()
    OR auth_user_role() = 'SUPER_ADMIN'
  );

-- units: Society isolation
CREATE POLICY society_isolation ON units
  FOR ALL USING (
    society_id = auth_society_id()
    OR auth_user_role() = 'SUPER_ADMIN'
  );

-- user_units: Via unit's society
CREATE POLICY society_isolation ON user_units
  FOR ALL USING (
    unit_id IN (SELECT id FROM units WHERE society_id = auth_society_id())
    OR auth_user_role() = 'SUPER_ADMIN'
  );

-- membership_fees: Society isolation
CREATE POLICY society_isolation ON membership_fees
  FOR ALL USING (
    society_id = auth_society_id()
    OR auth_user_role() = 'SUPER_ADMIN'
  );

-- fee_payments: Society isolation
CREATE POLICY society_isolation ON fee_payments
  FOR ALL USING (
    society_id = auth_society_id()
    OR auth_user_role() = 'SUPER_ADMIN'
  );

-- =====================================================================
-- EXPENSE POLICIES: All residents read (transparency), admins write
-- =====================================================================

CREATE POLICY expense_read_all ON expenses
  FOR SELECT USING (
    society_id = auth_society_id()
    OR auth_user_role() = 'SUPER_ADMIN'
  );

CREATE POLICY expense_admin_write ON expenses
  FOR INSERT WITH CHECK (
    auth_user_role() IN ('SUPER_ADMIN', 'RWA_ADMIN_PRIMARY', 'RWA_ADMIN_SUPPORTING')
  );

CREATE POLICY expense_admin_update ON expenses
  FOR UPDATE USING (
    auth_user_role() IN ('SUPER_ADMIN', 'RWA_ADMIN_PRIMARY', 'RWA_ADMIN_SUPPORTING')
    AND society_id = auth_society_id()
  );

-- =====================================================================
-- NOTIFICATION POLICIES: Residents see own, admins see all in society
-- =====================================================================

CREATE POLICY own_notifications ON notifications
  FOR SELECT USING (
    user_id = auth_user_id()
    OR auth_user_role() IN ('SUPER_ADMIN', 'RWA_ADMIN_PRIMARY', 'RWA_ADMIN_SUPPORTING')
  );

-- =====================================================================
-- AUDIT LOG POLICIES: INSERT only (immutable). Read by society admins.
-- =====================================================================

CREATE POLICY audit_insert_only ON audit_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY audit_read ON audit_logs
  FOR SELECT USING (
    society_id = auth_society_id()
    OR auth_user_role() = 'SUPER_ADMIN'
  );
-- No UPDATE or DELETE policy = immutable

-- =====================================================================
-- ADMIN-LEVEL WRITE POLICIES (applied per permission level)
-- =====================================================================

-- Fee payments: Only FULL_ACCESS, HIGH_ACCESS, FINANCE_ACCESS can record
CREATE POLICY fee_payment_write ON fee_payments
  FOR INSERT WITH CHECK (
    auth_admin_permission() IN ('FULL_ACCESS', 'HIGH_ACCESS', 'FINANCE_ACCESS')
    OR auth_user_role() = 'SUPER_ADMIN'
  );

-- Admin terms: Only Super Admin can manage
CREATE POLICY admin_terms_super_only ON admin_terms
  FOR ALL USING (
    auth_user_role() = 'SUPER_ADMIN'
    OR (society_id = auth_society_id())  -- Read access for society members
  );

CREATE POLICY admin_terms_write ON admin_terms
  FOR INSERT WITH CHECK (
    auth_user_role() = 'SUPER_ADMIN'
  );

-- =====================================================================
-- FESTIVAL POLICIES: All residents read, admins manage
-- =====================================================================

CREATE POLICY festival_read ON festivals
  FOR SELECT USING (
    society_id = auth_society_id()
    OR auth_user_role() = 'SUPER_ADMIN'
  );

CREATE POLICY festival_admin_write ON festivals
  FOR INSERT WITH CHECK (
    auth_admin_permission() IN ('FULL_ACCESS', 'HIGH_ACCESS')
    OR auth_user_role() = 'SUPER_ADMIN'
  );

-- Festival contributions: Admins record, all residents read
CREATE POLICY contribution_read ON festival_contributions
  FOR SELECT USING (
    society_id = auth_society_id()
    OR auth_user_role() = 'SUPER_ADMIN'
  );

CREATE POLICY contribution_write ON festival_contributions
  FOR INSERT WITH CHECK (
    auth_admin_permission() IN ('FULL_ACCESS', 'HIGH_ACCESS', 'FINANCE_ACCESS')
    OR auth_user_role() = 'SUPER_ADMIN'
  );

-- =====================================================================
-- EXPENSE QUERY POLICIES: Residents create, admins respond
-- =====================================================================

CREATE POLICY query_read ON expense_queries
  FOR SELECT USING (
    raised_by = auth_user_id()
    OR auth_user_role() IN ('SUPER_ADMIN', 'RWA_ADMIN_PRIMARY', 'RWA_ADMIN_SUPPORTING')
  );

CREATE POLICY query_create ON expense_queries
  FOR INSERT WITH CHECK (
    society_id = auth_society_id()
  );

-- =====================================================================
-- VISITOR LOG POLICIES: Residents manage own visitors, admins see all
-- =====================================================================

CREATE POLICY visitor_own ON visitor_logs
  FOR ALL USING (
    resident_id = auth_user_id()
    OR auth_user_role() IN ('SUPER_ADMIN', 'RWA_ADMIN_PRIMARY', 'RWA_ADMIN_SUPPORTING')
  );

-- =====================================================================
-- DEPENDENT POLICIES: Residents manage own dependents, admins read
-- =====================================================================

CREATE POLICY dependent_own ON dependents
  FOR ALL USING (
    user_id = auth_user_id()
    OR auth_user_role() IN ('SUPER_ADMIN', 'RWA_ADMIN_PRIMARY', 'RWA_ADMIN_SUPPORTING')
  );

-- =====================================================================
-- PROPERTY TRANSFER POLICIES: Admins only
-- =====================================================================

CREATE POLICY transfer_society ON property_transfers
  FOR SELECT USING (
    society_id = auth_society_id()
    OR auth_user_role() = 'SUPER_ADMIN'
  );

CREATE POLICY transfer_admin_write ON property_transfers
  FOR INSERT WITH CHECK (
    auth_admin_permission() IN ('FULL_ACCESS', 'HIGH_ACCESS')
    OR auth_user_role() = 'SUPER_ADMIN'
  );

-- =====================================================================
-- BLACKLIST POLICIES: Admin-only read/write
-- =====================================================================

CREATE POLICY blacklist_admin ON blacklisted_numbers
  FOR ALL USING (
    auth_user_role() IN ('SUPER_ADMIN', 'RWA_ADMIN_PRIMARY', 'RWA_ADMIN_SUPPORTING')
    AND (society_id = auth_society_id() OR auth_user_role() = 'SUPER_ADMIN')
  );

-- =====================================================================
-- RECURRING EXPENSE POLICIES: Admins manage
-- =====================================================================

CREATE POLICY recurring_read ON recurring_expenses
  FOR SELECT USING (
    society_id = auth_society_id()
    OR auth_user_role() = 'SUPER_ADMIN'
  );

CREATE POLICY recurring_admin_write ON recurring_expenses
  FOR INSERT WITH CHECK (
    auth_admin_permission() IN ('FULL_ACCESS', 'HIGH_ACCESS', 'FINANCE_ACCESS')
    OR auth_user_role() = 'SUPER_ADMIN'
  );
```

---

## 4. Prisma Schema (Key Models)

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

// =====================================================
// ENUMS
// =====================================================

enum SocietyStatus {
  TRIAL
  ACTIVE
  SUSPENDED
  OFFBOARDED
}

enum SocietyType {
  APARTMENT_COMPLEX
  BUILDER_FLOORS
  GATED_COMMUNITY_VILLAS
  INDEPENDENT_SECTOR_COLONY
  PLOTTED_COLONY
}

enum SubscriptionPlan {
  TRIAL
  BASIC
  STANDARD
  PREMIUM
  ENTERPRISE
}

enum UserRole {
  SUPER_ADMIN
  RWA_ADMIN_PRIMARY
  RWA_ADMIN_SUPPORTING
  RESIDENT_OWNER
  RESIDENT_OWNER_NRO
  RESIDENT_JOINT_OWNER
  RESIDENT_TENANT
}

enum OwnershipType {
  OWNER
  OWNER_NRO
  JOINT_OWNER
  TENANT
}

enum AdminPermission {
  FULL_ACCESS
  HIGH_ACCESS
  FINANCE_ACCESS
  READ_NOTIFY
  CONFIGURABLE
}

enum AdminPosition {
  PRESIDENT
  VICE_PRESIDENT
  SECRETARY
  JOINT_SECRETARY
  TREASURER
  EXECUTIVE_MEMBER
}

enum ResidentStatus {
  PENDING_APPROVAL
  ACTIVE_PAID
  ACTIVE_PENDING
  ACTIVE_OVERDUE
  ACTIVE_PARTIAL
  ACTIVE_EXEMPTED
  ACTIVE_LIFETIME
  REJECTED
  MIGRATED_PENDING
  MIGRATED_DORMANT
  TRANSFERRED_DEACTIVATED
  TENANT_DEPARTED
  SUSPENDED
  DECEASED
  BLACKLISTED
  DEACTIVATED
}

enum FeeStatus {
  NOT_YET_DUE
  PENDING
  OVERDUE
  PARTIAL
  PAID
  ADVANCE_PAID
  EXEMPTED
  LIFETIME
}

enum PaymentEntryType {
  PAYMENT
  PARTIAL_PAYMENT
  CORRECTION
  REVERSAL
  REFUND
  WRITE_OFF
  EXEMPTION
}

enum PaymentMode {
  CASH
  UPI
  BANK_TRANSFER
  CHEQUE
  ONLINE
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
  FESTIVAL
  EMERGENCY
  LEGAL
  ADMINISTRATIVE
  OTHER
}

enum NotificationChannel {
  WHATSAPP
  SMS
  PUSH
  EMAIL
}

enum NotificationStatus {
  QUEUED
  SENT
  DELIVERED
  FAILED
  RETRYING
}

enum AdminTermStatus {
  ACTIVE
  EXPIRED
  EXTENDED
  VACATED
  ARCHIVED
}

enum FestivalStatus {
  DRAFT
  COLLECTING
  CLOSED
  COMPLETED
  CANCELLED
}

enum DisposalType {
  CARRY_FORWARD
  TRANSFER_TO_SOCIETY
  REFUND_CONTRIBUTORS
}

enum QueryStatus {
  OPEN
  RESPONDED
  ESCALATED
  UNDER_REVIEW
  RESOLVED
}

enum TransferType {
  OWNERSHIP_SALE
  TENANT_DEPARTURE
  BUILDER_FLOOR_PARTIAL
  INHERITANCE
}

enum RejectionReasonType {
  NOT_RESIDENT
  DUPLICATE_ENTRY
  INCORRECT_INFORMATION
  UNDER_VERIFICATION
  ADMIN_DISCRETION
}

enum RecurringFrequency {
  DAILY
  WEEKLY
  BIWEEKLY
  MONTHLY
  QUARTERLY
  HALF_YEARLY
  YEARLY
}

enum VisitorStatus {
  EXPECTED
  ARRIVED
  DEPARTED
  CANCELLED
  NO_SHOW
}

// =====================================================
// CORE MODELS
// =====================================================

model Society {
  id                      String            @id @default(uuid()) @db.Uuid
  societyId               String            @unique @map("society_id") @db.VarChar(30)
  societyCode             String            @unique @map("society_code") @db.VarChar(8)
  name                    String            @db.VarChar(200)
  registrationNo          String?           @map("registration_no") @db.VarChar(50)
  address                 String?
  state                   String            @db.VarChar(2)
  city                    String            @db.VarChar(50)
  cityCode                String            @map("city_code") @db.VarChar(3)
  pincode                 String            @db.VarChar(6)
  type                    SocietyType
  totalUnits              Int               @default(0) @map("total_units")
  joiningFee              Decimal           @default(1000) @map("joining_fee") @db.Decimal(10, 2)
  annualFee               Decimal           @default(1200) @map("annual_fee") @db.Decimal(10, 2)
  feeSessionStartMonth    Int               @default(4) @map("fee_session_start_month")
  gracePeriodDays         Int               @default(15) @map("grace_period_days")
  adminTermMonths         Int               @default(24) @map("admin_term_months")
  plan                    SubscriptionPlan  @default(TRIAL)
  status                  SocietyStatus     @default(TRIAL)
  subscriptionExpiresAt   DateTime?         @map("subscription_expires_at")
  trialEndsAt             DateTime?         @map("trial_ends_at")
  whatsappBusinessNumber  String?           @map("whatsapp_business_number") @db.VarChar(15)
  whatsappApiKey          String?           @map("whatsapp_api_key") @db.VarChar(200)
  defaultCurrency         String            @default("INR") @map("default_currency") @db.VarChar(3)
  locale                  String            @default("en-IN") @db.VarChar(10)
  onboardingDate          DateTime          @default(now()) @map("onboarding_date")
  createdAt               DateTime          @default(now()) @map("created_at")
  updatedAt               DateTime          @updatedAt @map("updated_at")

  // Relations
  users                   User[]
  units                   Unit[]
  membershipFees          MembershipFee[]
  feePayments             FeePayment[]
  expenses                Expense[]
  recurringExpenses       RecurringExpense[]
  notifications           Notification[]
  broadcasts              Broadcast[]
  auditLogs               AuditLog[]
  migrationBatches        MigrationBatch[]
  feeSessions             FeeSession[]
  adminTerms              AdminTerm[]
  festivals               Festival[]
  festivalContributions   FestivalContribution[]
  expenseQueries          ExpenseQuery[]
  propertyTransfers       PropertyTransfer[]
  visitorLogs             VisitorLog[]
  dependents              Dependent[]
  blacklistedNumbers      BlacklistedNumber[]

  @@map("societies")
}

model User {
  id                      String              @id @default(uuid()) @db.Uuid
  societyId               String?             @map("society_id") @db.Uuid
  rwaid                   String?             @unique @db.VarChar(40)
  authUserId              String?             @unique @map("auth_user_id") @db.Uuid
  name                    String              @db.VarChar(100)
  mobile                  String              @db.VarChar(15)
  alternateMobile         String?             @map("alternate_mobile") @db.VarChar(15)
  email                   String?             @db.VarChar(100)
  dateOfBirth             DateTime?           @map("date_of_birth") @db.Date
  photoUrl                String?             @map("photo_url") @db.VarChar(500)
  idProofUrl              String?             @map("id_proof_url") @db.VarChar(500)
  role                    UserRole
  ownershipType           OwnershipType?      @map("ownership_type")
  status                  ResidentStatus      @default(PENDING_APPROVAL)
  adminPermission         AdminPermission?    @map("admin_permission")
  adminPosition           AdminPosition?      @map("admin_position")
  isLifetimeMember        Boolean             @default(false) @map("is_lifetime_member")
  lifetimeGrantedAt       DateTime?           @map("lifetime_granted_at")
  lifetimeGrantedById     String?             @map("lifetime_granted_by") @db.Uuid
  consentWhatsapp         Boolean             @default(false) @map("consent_whatsapp")
  consentWhatsappAt       DateTime?           @map("consent_whatsapp_at")
  consentSms              Boolean             @default(false) @map("consent_sms")
  consentEmail            Boolean             @default(false) @map("consent_email")
  consentPush             Boolean             @default(false) @map("consent_push")
  pinHash                 String?             @map("pin_hash") @db.VarChar(100)
  pinFailedAttempts       Int                 @default(0) @map("pin_failed_attempts")
  pinLockedUntil          DateTime?           @map("pin_locked_until")
  joiningFeePaid          Boolean             @default(false) @map("joining_fee_paid")
  emergencyContactName    String?             @map("emergency_contact_name") @db.VarChar(100)
  emergencyContactMobile  String?             @map("emergency_contact_mobile") @db.VarChar(15)
  registeredAt            DateTime            @default(now()) @map("registered_at")
  approvedAt              DateTime?           @map("approved_at")
  approvedById            String?             @map("approved_by") @db.Uuid
  rejectedAt              DateTime?           @map("rejected_at")
  rejectedById            String?             @map("rejected_by") @db.Uuid
  rejectionReason         String?             @map("rejection_reason")
  rejectionReasonType     RejectionReasonType? @map("rejection_reason_type")
  activatedAt             DateTime?           @map("activated_at")
  deactivatedAt           DateTime?           @map("deactivated_at")
  deactivationReason      String?             @map("deactivation_reason")
  lastLoginAt             DateTime?           @map("last_login_at")
  createdAt               DateTime            @default(now()) @map("created_at")
  updatedAt               DateTime            @updatedAt @map("updated_at")

  // Relations
  society                 Society?            @relation(fields: [societyId], references: [id])
  lifetimeGrantedBy       User?               @relation("LifetimeGrantedBy", fields: [lifetimeGrantedById], references: [id])
  lifetimeGrantees        User[]              @relation("LifetimeGrantedBy")
  approvedBy              User?               @relation("ApprovedBy", fields: [approvedById], references: [id])
  rejectedBy              User?               @relation("RejectedBy", fields: [rejectedById], references: [id])
  approvedUsers           User[]              @relation("ApprovedBy")
  rejectedUsers           User[]              @relation("RejectedBy")
  userUnits               UserUnit[]
  membershipFees          MembershipFee[]
  feePayments             FeePayment[]
  notifications           Notification[]
  adminTerms              AdminTerm[]
  dependents              Dependent[]
  visitorLogs             VisitorLog[]
  expenseQueries          ExpenseQuery[]

  @@unique([societyId, mobile])
  @@map("users")
}

model Unit {
  id                      String              @id @default(uuid()) @db.Uuid
  societyId               String              @map("society_id") @db.Uuid
  displayLabel            String              @map("display_label") @db.VarChar(50)
  towerBlock              String?             @map("tower_block") @db.VarChar(20)
  floorNo                 String?             @map("floor_no") @db.VarChar(10)
  flatNo                  String?             @map("flat_no") @db.VarChar(20)
  houseNo                 String?             @map("house_no") @db.VarChar(20)
  floorLevel              String?             @map("floor_level") @db.VarChar(10)
  villaNo                 String?             @map("villa_no") @db.VarChar(20)
  streetPhase             String?             @map("street_phase") @db.VarChar(30)
  sectorBlock             String?             @map("sector_block") @db.VarChar(20)
  streetGali              String?             @map("street_gali") @db.VarChar(20)
  plotNo                  String?             @map("plot_no") @db.VarChar(20)
  laneNo                  String?             @map("lane_no") @db.VarChar(20)
  phase                   String?             @db.VarChar(20)
  primaryOwnerId          String?             @map("primary_owner_id") @db.Uuid
  currentTenantId         String?             @map("current_tenant_id") @db.Uuid
  areaSqft                Decimal?            @map("area_sqft") @db.Decimal(10, 2)
  areaSqm                 Decimal?            @map("area_sqm") @db.Decimal(10, 2)
  isActive                Boolean             @default(true) @map("is_active")
  createdAt               DateTime            @default(now()) @map("created_at")
  updatedAt               DateTime            @updatedAt @map("updated_at")

  // Relations
  society                 Society             @relation(fields: [societyId], references: [id])
  userUnits               UserUnit[]
  membershipFees          MembershipFee[]
  festivalContributions   FestivalContribution[]
  propertyTransfers       PropertyTransfer[]
  visitorLogs             VisitorLog[]

  @@map("units")
}

model AdminTerm {
  id                      String              @id @default(uuid()) @db.Uuid
  userId                  String              @map("user_id") @db.Uuid
  societyId               String              @map("society_id") @db.Uuid
  position                AdminPosition
  permission              AdminPermission
  termStart               DateTime            @map("term_start")
  termEnd                 DateTime            @map("term_end")
  actualEnd               DateTime?           @map("actual_end")
  status                  AdminTermStatus     @default(ACTIVE)
  extensionCount          Int                 @default(0) @map("extension_count")
  lastExtendedAt          DateTime?           @map("last_extended_at")
  extensionExpiresAt      DateTime?           @map("extension_expires_at")
  activatedById           String?             @map("activated_by") @db.Uuid
  deactivatedById         String?             @map("deactivated_by") @db.Uuid
  deactivationReason      String?             @map("deactivation_reason")
  electionDate            DateTime?           @map("election_date") @db.Date
  electionNotes           String?             @map("election_notes")
  customPermissions       Json?               @map("custom_permissions")
  createdAt               DateTime            @default(now()) @map("created_at")
  updatedAt               DateTime            @updatedAt @map("updated_at")

  // Relations
  user                    User                @relation(fields: [userId], references: [id])
  society                 Society             @relation(fields: [societyId], references: [id])

  @@map("admin_terms")
}

model Festival {
  id                      String              @id @default(uuid()) @db.Uuid
  societyId               String              @map("society_id") @db.Uuid
  festivalId              String              @unique @map("festival_id") @db.VarChar(50)
  name                    String              @db.VarChar(200)
  description             String?
  eventDate               DateTime            @map("event_date") @db.Date
  eventEndDate            DateTime?           @map("event_end_date") @db.Date
  targetAmount            Decimal             @map("target_amount") @db.Decimal(10, 2)
  minContribution         Decimal?            @map("min_contribution") @db.Decimal(10, 2)
  collectedAmount         Decimal             @default(0) @map("collected_amount") @db.Decimal(10, 2)
  spentAmount             Decimal             @default(0) @map("spent_amount") @db.Decimal(10, 2)
  collectionStart         DateTime            @map("collection_start") @db.Date
  collectionEnd           DateTime            @map("collection_end") @db.Date
  status                  FestivalStatus      @default(DRAFT)
  publishedAt             DateTime?           @map("published_at")
  closedAt                DateTime?           @map("closed_at")
  completedAt             DateTime?           @map("completed_at")
  cancellationReason      String?             @map("cancellation_reason")
  cancelledAt             DateTime?           @map("cancelled_at")
  surplusDisposal         DisposalType?       @map("surplus_disposal")
  surplusDisposalNotes    String?             @map("surplus_disposal_notes")
  surplusDisposedAt       DateTime?           @map("surplus_disposed_at")
  totalContributors       Int                 @default(0) @map("total_contributors")
  createdById             String              @map("created_by") @db.Uuid
  createdAt               DateTime            @default(now()) @map("created_at")
  updatedAt               DateTime            @updatedAt @map("updated_at")

  // Relations
  society                 Society             @relation(fields: [societyId], references: [id])
  contributions           FestivalContribution[]
  expenses                Expense[]

  @@map("festivals")
}

// ... remaining models (FestivalContribution, RecurringExpense, ExpenseQuery,
// PropertyTransfer, VisitorLog, Dependent, BlacklistedNumber, MembershipFee,
// FeePayment, Expense, Notification, Broadcast, AuditLog, MigrationBatch,
// FeeSession, UserUnit, NotificationPreference) follow the same pattern
// as the SQL DDL definitions above with appropriate Prisma @map annotations.
```

---

## 5. Key Indexes Summary

| Table               | Index                                         | Purpose                                      |
| ------------------- | --------------------------------------------- | -------------------------------------------- |
| societies           | pincode                                       | Society ID generation (find last SEQ)        |
| societies           | society_code                                  | Uniqueness check during society creation     |
| societies           | plan                                          | Subscription tier queries                    |
| users               | society_id + mobile                           | Duplicate detection per society              |
| users               | rwaid                                         | RWAID lookup for card/verification           |
| users               | auth_user_id                                  | Supabase Auth session -> user mapping        |
| users               | admin_position (partial)                      | Quick lookup of current admins               |
| users               | is_lifetime_member (partial)                  | Lifetime member queries                      |
| membership_fees     | user_id + session_year                        | One fee record per user per session (unique) |
| membership_fees     | is_advance (partial)                          | Advance payment queries                      |
| fee_payments        | payment_date                                  | Date range queries for reports               |
| fee_payments        | receipt_no                                    | Receipt lookup for verification              |
| fee_payments        | entry_type                                    | Filter by payment type                       |
| fee_payments        | gateway_order_id (partial)                    | Online payment reconciliation                |
| expenses            | festival_id (partial)                         | Festival-linked expenses                     |
| expenses            | recurring_expense_id (partial)                | Auto-generated expense tracking              |
| recurring_expenses  | next_due_date (partial)                       | Cron job: generate due recurring expenses    |
| notifications       | status + next_retry_at (partial)              | Retry queue processing                       |
| notifications       | channel                                       | Per-channel analytics                        |
| admin_terms         | society_id + status (partial)                 | Active admin lookup                          |
| admin_terms         | term_end (partial)                            | Expiry date monitoring                       |
| festivals           | society_id + status (partial)                 | Active collection lookup                     |
| expense_queries     | society_id + status (partial)                 | Open query dashboard                         |
| visitor_logs        | visitor_code (partial)                        | QR code verification at gate                 |
| visitor_logs        | society_id + expected_date + status (partial) | Today's expected visitors                    |
| audit_logs          | created_at                                    | Time-range audit queries                     |
| blacklisted_numbers | society_id + mobile (partial)                 | Registration block check                     |

---

## 6. Migration Strategy

### Phase 0: Initial Migration (All 22 Tables)

```bash
npx prisma migrate dev --name init_full_schema
```

Creates ALL 22 tables with complete columns in a single migration. No stub tables — everything is production-ready from day one.

### Ongoing Migrations

| Scenario                     | Approach                                                                                            |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| New column on existing table | `ALTER TABLE ... ADD COLUMN ... DEFAULT ...` (nullable or with default)                             |
| New enum value               | `ALTER TYPE ... ADD VALUE '...'` (PostgreSQL supports this natively)                                |
| New table                    | `CREATE TABLE ...` in a new migration                                                               |
| Column rename                | `ALTER TABLE ... RENAME COLUMN ...` (one migration per rename)                                      |
| Column removal               | **Never in production**. Add `deprecated_` prefix, stop reading it, remove in future major version. |
| Index addition               | Can be done concurrently: `CREATE INDEX CONCURRENTLY ...`                                           |

### Migration Commands

```bash
# Development: generate and apply migration
npx prisma migrate dev --name descriptive_name

# Production: apply pending migrations (non-interactive)
npx prisma migrate deploy

# Generate Prisma client after schema changes
npx prisma generate

# Reset database (development only!)
npx prisma migrate reset
```

### Connection Pooling

- **Production**: Use Supabase PgBouncer. Prisma `DATABASE_URL` includes `?pgbouncer=true`.
- **Migrations**: Use `DIRECT_URL` (bypasses PgBouncer) since migrations need transaction support.

```env
# .env.local
DATABASE_URL="postgresql://user:pass@host:6543/db?pgbouncer=true"
DIRECT_URL="postgresql://user:pass@host:5432/db"
```

### Backward Compatibility Rules

1. **Never drop columns in production** — add nullable, backfill, then add constraint.
2. **Never rename columns in production** — add new column, dual-write, migrate reads, drop old.
3. **Enum values can only be added** — never removed or renamed (PostgreSQL limitation).
4. **All migrations must be reversible** — include `DOWN` migration where possible.
5. **Test migrations against production snapshot** before deploying.

---

## 7. Seed Data Plan

### Development Seed (`prisma/seed.ts`)

```typescript
// prisma/seed.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // ═══════════════════════════════════════════════════
  // 1. Super Admin (platform owner)
  // ═══════════════════════════════════════════════════
  const superAdmin = await prisma.user.create({
    data: {
      name: "Super Admin",
      email: "admin@rwaconnect.in",
      mobile: "9999999999",
      role: "SUPER_ADMIN",
      status: "ACTIVE_PAID",
    },
  });

  // ═══════════════════════════════════════════════════
  // 2. Society: Eden Estate (Independent Sector Colony)
  // ═══════════════════════════════════════════════════
  const edenEstate = await prisma.society.create({
    data: {
      societyId: "RWA-HR-GGN-122001-0001",
      societyCode: "EDENESTATE",
      name: "Eden Estate Resident Welfare Association",
      registrationNo: "HR/GGN/2017/05/0000335",
      address: "Eden Estate, Sector 22, Gurgaon, Haryana 122001",
      state: "HR",
      city: "Gurgaon",
      cityCode: "GGN",
      pincode: "122001",
      type: "INDEPENDENT_SECTOR_COLONY",
      totalUnits: 250,
      joiningFee: 1000,
      annualFee: 1200,
      adminTermMonths: 24,
      plan: "STANDARD",
      status: "ACTIVE",
    },
  });

  // ═══════════════════════════════════════════════════
  // 3. Admin Team (6 positions with election term)
  // ═══════════════════════════════════════════════════
  const admins = [
    {
      name: "Hemant Kumar",
      mobile: "9876543210",
      role: "RWA_ADMIN_PRIMARY" as const,
      position: "PRESIDENT" as const,
      permission: "FULL_ACCESS" as const,
    },
    {
      name: "Suresh Mehta",
      mobile: "9876543220",
      role: "RWA_ADMIN_SUPPORTING" as const,
      position: "VICE_PRESIDENT" as const,
      permission: "HIGH_ACCESS" as const,
    },
    {
      name: "Anita Rao",
      mobile: "9876543230",
      role: "RWA_ADMIN_PRIMARY" as const,
      position: "SECRETARY" as const,
      permission: "FULL_ACCESS" as const,
    },
    {
      name: "Vikram Joshi",
      mobile: "9876543240",
      role: "RWA_ADMIN_SUPPORTING" as const,
      position: "JOINT_SECRETARY" as const,
      permission: "READ_NOTIFY" as const,
    },
    {
      name: "Meena Agarwal",
      mobile: "9876543250",
      role: "RWA_ADMIN_SUPPORTING" as const,
      position: "TREASURER" as const,
      permission: "FINANCE_ACCESS" as const,
    },
    {
      name: "Ravi Tiwari",
      mobile: "9876543260",
      role: "RWA_ADMIN_SUPPORTING" as const,
      position: "EXECUTIVE_MEMBER" as const,
      permission: "CONFIGURABLE" as const,
    },
  ];

  const termStart = new Date("2025-01-01");
  const termEnd = new Date("2026-12-31"); // 24 months

  for (const admin of admins) {
    const user = await prisma.user.create({
      data: {
        societyId: edenEstate.id,
        name: admin.name,
        mobile: admin.mobile,
        role: admin.role,
        adminPermission: admin.permission,
        adminPosition: admin.position,
        status: "ACTIVE_PAID",
        consentWhatsapp: true,
      },
    });

    await prisma.adminTerm.create({
      data: {
        userId: user.id,
        societyId: edenEstate.id,
        position: admin.position,
        permission: admin.permission,
        termStart,
        termEnd,
        status: "ACTIVE",
        electionDate: new Date("2024-12-15"),
        electionNotes: "Annual General Meeting election",
      },
    });
  }

  // ═══════════════════════════════════════════════════
  // 4. Demo Residents (mixed ownership types + statuses)
  // ═══════════════════════════════════════════════════
  const residents = [
    {
      name: "Rajesh Sharma",
      mobile: "9876543211",
      ownership: "OWNER" as const,
      role: "RESIDENT_OWNER" as const,
      feeStatus: "PAID" as const,
      unit: "S22-St3-H110",
    },
    {
      name: "Priya Singh",
      mobile: "9876543212",
      ownership: "TENANT" as const,
      role: "RESIDENT_TENANT" as const,
      feeStatus: "PARTIAL" as const,
      unit: "S22-St9-H301",
    },
    {
      name: "Amit Verma",
      mobile: "9876543213",
      ownership: "OWNER" as const,
      role: "RESIDENT_OWNER" as const,
      feeStatus: "OVERDUE" as const,
      unit: "S22-St2-H88",
    },
    {
      name: "Neha Gupta",
      mobile: "9876543214",
      ownership: "OWNER" as const,
      role: "RESIDENT_OWNER" as const,
      feeStatus: "EXEMPTED" as const,
      unit: "S22-St1-H55",
    },
    {
      name: "Deepak Malhotra",
      mobile: "9876543215",
      ownership: "TENANT" as const,
      role: "RESIDENT_TENANT" as const,
      feeStatus: "PENDING" as const,
      unit: "S22-St4-H44",
    },
    {
      name: "Kavita Nair (NRO)",
      mobile: "9876543216",
      ownership: "OWNER_NRO" as const,
      role: "RESIDENT_OWNER_NRO" as const,
      feeStatus: "PAID" as const,
      unit: "S22-St5-H150",
    },
    {
      name: "Sanjay Kumar (Joint)",
      mobile: "9876543217",
      ownership: "JOINT_OWNER" as const,
      role: "RESIDENT_JOINT_OWNER" as const,
      feeStatus: "PAID" as const,
      unit: "S22-St3-H110", // Joint owner of Rajesh's unit
    },
    {
      name: "Dr. R.K. Aggarwal",
      mobile: "9876543218",
      ownership: "OWNER" as const,
      role: "RESIDENT_OWNER" as const,
      feeStatus: "LIFETIME" as const,
      unit: "S22-St1-H01",
      isLifetime: true,
    },
  ];

  // Create users and units for each resident...
  // (Implementation follows same pattern as MVP seed with expanded fields)

  // ═══════════════════════════════════════════════════
  // 5. Fee Session (2025-26)
  // ═══════════════════════════════════════════════════
  await prisma.feeSession.create({
    data: {
      societyId: edenEstate.id,
      sessionYear: "2025-26",
      annualFee: 1200,
      joiningFee: 1000,
      sessionStart: new Date("2025-04-01"),
      sessionEnd: new Date("2026-03-31"),
      gracePeriodEnd: new Date("2025-04-15"),
      status: "ACTIVE",
    },
  });

  // ═══════════════════════════════════════════════════
  // 6. Sample Expenses (5 entries across categories)
  // ═══════════════════════════════════════════════════
  // - Security guard salary (SECURITY, MONTHLY recurring)
  // - Park cleaning (CLEANING)
  // - Road repair (MAINTENANCE)
  // - Legal notice for encroachment (LEGAL)
  // - Diwali decoration advance (FESTIVAL, linked to festival)

  // ═══════════════════════════════════════════════════
  // 7. Recurring Expense Template
  // ═══════════════════════════════════════════════════
  // - Monthly guard salary: Rs 15,000/month
  // - Quarterly cleaning contract: Rs 8,000/quarter

  // ═══════════════════════════════════════════════════
  // 8. Sample Festival (Diwali 2025)
  // ═══════════════════════════════════════════════════
  // - Status: COLLECTING
  // - Target: Rs 50,000
  // - 3 sample contributions

  // ═══════════════════════════════════════════════════
  // 9. Sample Visitor Logs (3 entries)
  // ═══════════════════════════════════════════════════
  // - Expected delivery (EXPECTED)
  // - Arrived guest (ARRIVED)
  // - Cancelled visit (CANCELLED)

  // ═══════════════════════════════════════════════════
  // 10. Sample Dependents (for 2 residents)
  // ═══════════════════════════════════════════════════
  // - Rajesh Sharma: spouse + 2 children
  // - Neha Gupta: spouse + 1 parent

  // ═══════════════════════════════════════════════════
  // 11. Notification Preferences (for all residents)
  // ═══════════════════════════════════════════════════
  // Default: WhatsApp on, SMS off, Push on, Email off
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
```

### Production Seed (Minimal)

Production only seeds the Super Admin account. Everything else is created through the application.

```typescript
// prisma/seed-production.ts

// 1. Super Admin account only
// 2. Default subscription plans configuration (if using a config table)
// 3. WhatsApp template registry (if using a templates table)
```

---

## 8. Table Count Summary

| #         | Table                    | Status               | Phase |
| --------- | ------------------------ | -------------------- | ----- |
| 1         | societies                | Active               | 1     |
| 2         | users                    | Active               | 1     |
| 3         | units                    | Active               | 1     |
| 4         | user_units               | Active               | 1     |
| 5         | membership_fees          | Active               | 2     |
| 6         | fee_payments             | Active               | 2     |
| 7         | expenses                 | Active               | 2     |
| 8         | recurring_expenses       | Active               | 3     |
| 9         | notifications            | Active               | 2     |
| 10        | broadcasts               | Active               | 2     |
| 11        | audit_logs               | Active               | 1     |
| 12        | migration_batches        | Active               | 2     |
| 13        | notification_preferences | Active               | 2     |
| 14        | fee_sessions             | Active               | 2     |
| 15        | admin_terms              | Active               | 4     |
| 16        | festivals                | Active               | 3     |
| 17        | festival_contributions   | Active               | 3     |
| 18        | expense_queries          | Active               | 3     |
| 19        | property_transfers       | Active               | 4     |
| 20        | visitor_logs             | Active               | 7     |
| 21        | dependents               | Active               | 4     |
| 22        | blacklisted_numbers      | Active               | 2     |
| **Total** | **22 tables**            | **All fully active** | —     |

---

## 9. Enum Count Summary

| #         | Enum                  | Values | Source |
| --------- | --------------------- | ------ | ------ |
| 1         | society_status        | 4      | 19.13  |
| 2         | society_type          | 5      | 19.17  |
| 3         | subscription_plan     | 5      | 19.14  |
| 4         | user_role             | 7      | 19.1   |
| 5         | ownership_type        | 4      | 19.15  |
| 6         | admin_permission      | 5      | —      |
| 7         | admin_position        | 6      | —      |
| 8         | resident_status       | 16     | 19.2   |
| 9         | fee_status            | 8      | 19.4   |
| 10        | payment_entry_type    | 7      | 19.5   |
| 11        | payment_mode          | 5      | 19.6   |
| 12        | expense_status        | 2      | 19.8   |
| 13        | expense_category      | 11     | 19.7   |
| 14        | notification_channel  | 4      | 19.11  |
| 15        | notification_status   | 5      | 19.12  |
| 16        | admin_term_status     | 5      | 19.3   |
| 17        | festival_status       | 5      | 19.9   |
| 18        | disposal_type         | 3      | 19.10  |
| 19        | query_status          | 5      | —      |
| 20        | transfer_type         | 4      | 19.16  |
| 21        | rejection_reason_type | 5      | 19.18  |
| 22        | recurring_frequency   | 7      | —      |
| 23        | migration_row_status  | 4      | —      |
| 24        | visitor_status        | 5      | —      |
| **Total** | **24 enums**          | —      | —      |
