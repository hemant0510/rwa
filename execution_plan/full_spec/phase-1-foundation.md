# Phase 1 — Foundation & Setup (Full Product)

**Duration**: ~2 weeks
**Goal**: Complete foundation with full schema (all 21+ tables, all v3.0 enums), auth for all portals, i18n from day 1, layout shells, design system, and CI pipeline.
**Depends on**: Nothing (first phase)

---

## How This Differs from MVP Phase 0

| Area                    | MVP Phase 0                          | Full Product Phase 1                                                                   |
| ----------------------- | ------------------------------------ | -------------------------------------------------------------------------------------- |
| Admin positions         | 2 (PRIMARY, SUPPORTING)              | 6 (PRESIDENT, VICE_PRESIDENT, SECRETARY, JOINT_SECRETARY, TREASURER, EXECUTIVE_MEMBER) |
| Admin permissions       | 2 (FULL_ACCESS, READ_NOTIFY)         | 5 (FULL_ACCESS, FINANCIAL_WRITE, READ_NOTIFY, BROADCAST_ONLY, CUSTOM)                  |
| Ownership types         | 2 (OWNER, TENANT)                    | 4 (OWNER, OWNER_NRO, JOINT_OWNER, TENANT)                                              |
| Resident statuses       | 12                                   | 14 (adds ACTIVE_LIFETIME, MIGRATED_DORMANT)                                            |
| Fee statuses            | 6                                    | 8 (adds ADVANCE_PAID, LIFETIME)                                                        |
| Payment modes           | 4                                    | 5 (adds CHEQUE; ONLINE stubbed for Phase 6)                                            |
| Expense categories      | 9                                    | 11 (adds FESTIVAL, LEGAL)                                                              |
| Notification channels   | 2 (WHATSAPP, SMS)                    | 4 (adds PUSH, EMAIL)                                                                   |
| Notification statuses   | 5                                    | 5 (QUEUED, SENT, DELIVERED, FAILED, RETRYING)                                          |
| Language                | English only                         | English + Hindi (next-intl from day 1)                                                 |
| Charts                  | None                                 | Recharts for dashboards                                                                |
| Push notifications      | Not included                         | Firebase FCM setup (stub)                                                              |
| User roles              | 3 (SUPER_ADMIN, RWA_ADMIN, RESIDENT) | 7 granular roles (see enums-reference.md 19.1)                                         |
| Festival/disposal enums | Simplified stubs                     | Full enums from v3.0                                                                   |

---

## Task 1.1 — Install ALL Dependencies

Install every package needed for the full product in a single setup session.

### Commands

```bash
# UI Components (shadcn/ui)
npx shadcn@latest init
npx shadcn@latest add button card input label badge avatar dialog sheet
npx shadcn@latest add select checkbox radio-group switch tabs toast alert form
npx shadcn@latest add dropdown-menu command skeleton separator scroll-area
npx shadcn@latest add table pagination popover tooltip progress
npx shadcn@latest add calendar date-picker collapsible accordion
npx shadcn@latest add navigation-menu breadcrumb toggle-group

# Database & Auth
npm install prisma @prisma/client
npm install @supabase/supabase-js @supabase/ssr

# State & Data Fetching
npm install @tanstack/react-query @tanstack/react-table

# Forms & Validation
npm install react-hook-form @hookform/resolvers zod

# PDF & QR
npm install @react-pdf/renderer qrcode
npm install -D @types/qrcode

# Charts
npm install recharts

# i18n (bilingual — English + Hindi from day 1)
npm install next-intl

# Push Notifications (Firebase FCM stub)
npm install firebase

# Utilities
npm install date-fns clsx tailwind-merge lucide-react
npm install sonner  # Toast notifications (pairs with shadcn toast)

# Dev dependencies
npm install -D vitest @vitejs/plugin-react
npm install -D @testing-library/react @testing-library/jest-dom
npm install -D prisma
```

### Files to Create

- `src/lib/utils.ts` -- `cn()` helper (clsx + tailwind-merge)
- `src/lib/constants.ts` -- App-wide constants (fee defaults, grace period, session months, max pin attempts, etc.)
- `src/lib/firebase.ts` -- Firebase app initialization (FCM stub, no real messages yet)

### Acceptance Criteria

- [ ] `npm run build` passes with zero errors
- [ ] `npm run lint` passes with zero warnings
- [ ] `npx tsc --noEmit` -- no TypeScript errors
- [ ] All packages resolve in `node_modules`
- [ ] `cn()` utility works with Tailwind classes
- [ ] Firebase app initialises without runtime errors (stub only)

---

## Task 1.2 — Project Folder Structure

Create the complete directory structure per `.claude/core_rules.md`, expanded for i18n and full product features.

```
src/
├── app/
│   ├── [locale]/                      # next-intl locale prefix (en, hi)
│   │   ├── (auth)/                    # Auth pages
│   │   │   ├── login/page.tsx         # OTP login (Admin + Resident)
│   │   │   ├── super-admin-login/page.tsx  # Email + password + TOTP
│   │   │   └── layout.tsx
│   │   ├── (super-admin)/             # Super Admin portal
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── societies/page.tsx
│   │   │   ├── societies/new/page.tsx
│   │   │   ├── societies/[id]/page.tsx
│   │   │   ├── subscriptions/page.tsx
│   │   │   ├── settings/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (admin)/                   # RWA Admin portal
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── residents/page.tsx
│   │   │   ├── residents/[id]/page.tsx
│   │   │   ├── residents/pending/page.tsx
│   │   │   ├── fees/page.tsx
│   │   │   ├── fees/record/page.tsx
│   │   │   ├── expenses/page.tsx
│   │   │   ├── expenses/add/page.tsx
│   │   │   ├── festivals/page.tsx
│   │   │   ├── reports/page.tsx
│   │   │   ├── broadcast/page.tsx
│   │   │   ├── migration/page.tsx
│   │   │   ├── settings/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (resident)/                # Resident portal (PWA)
│   │   │   ├── home/page.tsx
│   │   │   ├── payments/page.tsx
│   │   │   ├── expenses/page.tsx
│   │   │   ├── festivals/page.tsx
│   │   │   ├── profile/page.tsx
│   │   │   ├── notifications/page.tsx
│   │   │   └── layout.tsx
│   │   ├── register/                  # Public registration
│   │   │   └── [societyCode]/page.tsx
│   │   ├── rwaid/                     # Public RWAID card viewer
│   │   │   └── [token]/page.tsx
│   │   ├── layout.tsx                 # Locale-wrapped root layout
│   │   └── page.tsx                   # Landing / marketing page
│   ├── api/v1/                        # REST API routes (no locale prefix)
│   │   ├── auth/
│   │   │   ├── login/route.ts
│   │   │   ├── verify-otp/route.ts
│   │   │   ├── verify-pin/route.ts
│   │   │   ├── set-pin/route.ts
│   │   │   └── mfa/route.ts
│   │   ├── societies/
│   │   │   ├── route.ts
│   │   │   ├── check-code/route.ts
│   │   │   └── [id]/
│   │   │       ├── route.ts
│   │   │       ├── admins/route.ts
│   │   │       ├── qr-poster/route.ts
│   │   │       └── stats/route.ts
│   │   ├── residents/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       ├── route.ts
│   │   │       ├── approve/route.ts
│   │   │       └── reject/route.ts
│   │   ├── fees/
│   │   │   ├── route.ts
│   │   │   ├── record-payment/route.ts
│   │   │   └── [id]/route.ts
│   │   ├── expenses/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   ├── festivals/
│   │   │   ├── route.ts
│   │   │   └── [id]/route.ts
│   │   ├── notifications/
│   │   │   └── route.ts
│   │   ├── reports/
│   │   │   └── route.ts
│   │   └── webhooks/
│   │       ├── whatsapp/route.ts
│   │       └── payment-gateway/route.ts
│   ├── globals.css
│   └── layout.tsx                     # True root layout (html, body)
├── components/
│   ├── ui/                            # shadcn/ui primitives (auto-generated)
│   ├── features/                      # Feature-specific composed components
│   │   ├── auth/
│   │   ├── society/
│   │   ├── resident/
│   │   ├── fees/
│   │   ├── expenses/
│   │   ├── festivals/
│   │   ├── notifications/
│   │   └── reports/
│   └── layout/                        # Layout shells
│       ├── SuperAdminSidebar.tsx
│       ├── AdminSidebar.tsx
│       ├── ResidentBottomNav.tsx
│       ├── Header.tsx
│       └── LanguageToggle.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useSociety.ts
│   ├── usePermissions.ts
│   └── useLocale.ts
├── lib/
│   ├── supabase/
│   │   ├── client.ts                  # Browser client
│   │   ├── server.ts                  # Server component client
│   │   └── middleware.ts              # Auth checking helpers
│   ├── prisma.ts                      # Prisma client singleton
│   ├── firebase.ts                    # Firebase app init (FCM stub)
│   ├── utils.ts                       # cn() + general utils
│   ├── constants.ts                   # App-wide constants
│   ├── permissions.ts                 # Permission matrix (position -> capabilities)
│   └── validations/                   # Zod schemas (shared client+server)
│       ├── society.ts
│       ├── resident.ts
│       ├── fee.ts
│       ├── expense.ts
│       ├── festival.ts
│       ├── auth.ts
│       ├── notification.ts
│       └── common.ts
├── providers/
│   ├── QueryProvider.tsx              # TanStack Query
│   ├── AuthProvider.tsx               # Auth context
│   └── ThemeProvider.tsx              # Dark mode
├── types/
│   ├── enums.ts                       # All v3.0 enums as TypeScript types
│   ├── society.ts
│   ├── user.ts
│   ├── fee.ts
│   ├── expense.ts
│   ├── festival.ts
│   ├── notification.ts
│   └── api.ts                         # API response wrappers
├── services/
│   ├── societies.ts
│   ├── residents.ts
│   ├── fees.ts
│   ├── expenses.ts
│   ├── festivals.ts
│   ├── notifications.ts
│   └── reports.ts
├── i18n/
│   ├── request.ts                     # next-intl getRequestConfig
│   ├── routing.ts                     # Locale routing config
│   └── navigation.ts                  # createSharedPathnamesNavigation
└── messages/
    ├── en.json                        # English translations
    └── hi.json                        # Hindi translations
```

### Additional Root-Level Files

```
prisma/
├── schema.prisma                      # Full v3.0 schema
└── seed.ts                            # Dev seed data
i18n.ts                                # next-intl plugin config
middleware.ts                          # Combined auth + i18n middleware
```

### Acceptance Criteria

- [ ] All directories created with placeholder files that compile
- [ ] Imports via `@/` alias resolve correctly
- [ ] `npm run build` succeeds with the skeleton structure
- [ ] No circular dependencies

---

## Task 1.3 — Full Database Schema (All v3.0 Tables in First Migration)

**Strategy**: Create ALL tables from the full product spec in the first migration. Phase 2+ tables are included from day 1 with all their columns so adding features later requires zero schema migrations.

### Full v3.0 Enum Types

```sql
-- ===============================================
-- USER & SOCIETY ENUMS
-- ===============================================

CREATE TYPE society_status AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'OFFBOARDED');

CREATE TYPE society_type AS ENUM (
  'APARTMENT_COMPLEX',
  'BUILDER_FLOORS',
  'GATED_COMMUNITY_VILLAS',
  'INDEPENDENT_SECTOR_COLONY',
  'PLOTTED_COLONY'
);

CREATE TYPE subscription_plan AS ENUM ('TRIAL', 'BASIC', 'STANDARD', 'PREMIUM', 'ENTERPRISE');

-- v3.0: 7 granular user roles (not 3 like MVP)
CREATE TYPE user_role AS ENUM (
  'SUPER_ADMIN',
  'RWA_ADMIN_PRIMARY',
  'RWA_ADMIN_SUPPORTING',
  'RESIDENT_OWNER',
  'RESIDENT_OWNER_NRO',
  'RESIDENT_JOINT_OWNER',
  'RESIDENT_TENANT'
);

-- v3.0: 4 ownership types (not 2 like MVP)
CREATE TYPE ownership_type AS ENUM ('OWNER', 'OWNER_NRO', 'JOINT_OWNER', 'TENANT');

-- v3.0: 5 permission levels (not 2 like MVP)
CREATE TYPE admin_permission AS ENUM (
  'FULL_ACCESS',
  'FINANCIAL_WRITE',
  'READ_NOTIFY',
  'BROADCAST_ONLY',
  'CUSTOM'
);

-- v3.0: 6 admin positions (not 2 like MVP)
CREATE TYPE admin_position AS ENUM (
  'PRESIDENT',
  'VICE_PRESIDENT',
  'SECRETARY',
  'JOINT_SECRETARY',
  'TREASURER',
  'EXECUTIVE_MEMBER'
);

-- ===============================================
-- RESIDENT STATUS — 14 statuses (v3.0)
-- ===============================================

CREATE TYPE resident_status AS ENUM (
  'PENDING_APPROVAL',
  'ACTIVE_PAID',
  'ACTIVE_PENDING',
  'ACTIVE_OVERDUE',
  'ACTIVE_PARTIAL',
  'ACTIVE_EXEMPTED',
  'ACTIVE_LIFETIME',              -- v3.0 addition (Super Admin only)
  'REJECTED',
  'MIGRATED_PENDING',
  'MIGRATED_DORMANT',             -- v3.0 addition (60+ days without activation)
  'TRANSFERRED_DEACTIVATED',
  'TENANT_DEPARTED',
  'SUSPENDED',
  'DECEASED',
  'BLACKLISTED'
);

-- ===============================================
-- FEE ENUMS — 8 statuses (v3.0)
-- ===============================================

CREATE TYPE fee_status AS ENUM (
  'NOT_YET_DUE',
  'PENDING',
  'OVERDUE',
  'PARTIAL',
  'PAID',
  'EXEMPTED',
  'ADVANCE_PAID',                 -- v3.0 addition
  'LIFETIME'                      -- v3.0 addition
);

-- v3.0: 7 payment entry types
CREATE TYPE payment_entry_type AS ENUM (
  'PAYMENT',
  'PARTIAL_PAYMENT',
  'CORRECTION',
  'REVERSAL',
  'REFUND',
  'WRITE_OFF',
  'EXEMPTION'
);

-- v3.0: 5 payment modes (adds CHEQUE; ONLINE stubbed for Phase 6)
CREATE TYPE payment_mode AS ENUM ('CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'ONLINE');

-- ===============================================
-- EXPENSE ENUMS — 11 categories (v3.0)
-- ===============================================

CREATE TYPE expense_status AS ENUM ('ACTIVE', 'REVERSED');

CREATE TYPE expense_category AS ENUM (
  'MAINTENANCE',
  'SECURITY',
  'CLEANING',
  'STAFF_SALARY',
  'INFRASTRUCTURE',
  'UTILITIES',
  'FESTIVAL',                     -- v3.0 addition
  'EMERGENCY',
  'LEGAL',                        -- v3.0 addition
  'ADMINISTRATIVE',
  'OTHER'
);

-- ===============================================
-- NOTIFICATION ENUMS — 4 channels (v3.0)
-- ===============================================

CREATE TYPE notification_channel AS ENUM ('WHATSAPP', 'SMS', 'PUSH', 'EMAIL');

CREATE TYPE notification_status AS ENUM ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'RETRYING');

-- ===============================================
-- ADMIN TERM ENUMS (v3.0)
-- ===============================================

CREATE TYPE admin_term_status AS ENUM ('ACTIVE', 'EXPIRED', 'EXTENDED', 'VACATED', 'ARCHIVED');

-- ===============================================
-- FESTIVAL ENUMS (v3.0)
-- ===============================================

CREATE TYPE festival_status AS ENUM ('DRAFT', 'COLLECTING', 'CLOSED', 'COMPLETED', 'CANCELLED');

CREATE TYPE festival_surplus_disposal AS ENUM (
  'CARRY_FORWARD',
  'TRANSFER_TO_SOCIETY',
  'REFUND_CONTRIBUTORS'
);

-- ===============================================
-- OTHER ENUMS (v3.0)
-- ===============================================

CREATE TYPE query_status AS ENUM ('OPEN', 'RESPONDED', 'ESCALATED', 'UNDER_REVIEW', 'RESOLVED');
CREATE TYPE transfer_type AS ENUM ('OWNERSHIP_SALE', 'TENANT_DEPARTURE', 'BUILDER_FLOOR_PARTIAL', 'INHERITANCE');
CREATE TYPE migration_row_status AS ENUM ('VALID', 'ERROR', 'SKIPPED', 'IMPORTED');
CREATE TYPE registration_rejection_reason AS ENUM (
  'NOT_RESIDENT',
  'DUPLICATE_ENTRY',
  'INCORRECT_INFORMATION',
  'UNDER_VERIFICATION',
  'ADMIN_DISCRETION'
);
```

### All Tables (21+ tables, all created in first migration)

The full schema includes all tables from `execution_plan/MVP/database-design.md` with these v3.0 upgrades applied:

**Core tables** (actively used from Phase 1):

1. `societies` -- Root tenant entity
2. `users` -- All platform users (updated with 7 roles, 4 ownership types)
3. `units` -- Physical property units (dynamic fields per society type)
4. `user_units` -- Join: residents <-> units
5. `membership_fees` -- Session-wise fee records (8 statuses)
6. `fee_payments` -- Individual payment entries (7 entry types, 5 modes)
7. `expenses` -- Society expense ledger (11 categories)
8. `notifications` -- Delivery tracking (4 channels)
9. `broadcasts` -- Manual broadcast records
10. `audit_logs` -- Immutable operation log (INSERT only)
11. `migration_batches` -- Bulk Excel import tracking
12. `notification_preferences` -- Resident opt-in/opt-out
13. `fee_sessions` -- Per-society per-year session config

**Phase 2+ tables** (created now, populated later): 14. `admin_terms` -- Election lifecycle (v3.0 statuses) 15. `festivals` -- Festival fund management (v3.0 statuses) 16. `festival_contributions` -- Festival payment entries 17. `expense_queries` -- Resident dispute module 18. `property_transfers` -- 4 transfer types 19. `visitor_logs` -- Visitor pre-registration (Phase 7) 20. `dependents` -- Family member records 21. `blacklisted_numbers` -- Blocked mobiles

### Key Schema Differences from MVP

**`users` table v3.0 changes**:

```sql
-- Role is now 7-value enum instead of 3
role user_role NOT NULL,  -- SUPER_ADMIN, RWA_ADMIN_PRIMARY, RWA_ADMIN_SUPPORTING,
                          -- RESIDENT_OWNER, RESIDENT_OWNER_NRO, RESIDENT_JOINT_OWNER, RESIDENT_TENANT

-- Ownership is now 4-value enum instead of 2
ownership_type ownership_type,  -- OWNER, OWNER_NRO, JOINT_OWNER, TENANT

-- Status is now 14-value enum instead of 12
status resident_status NOT NULL DEFAULT 'PENDING_APPROVAL',

-- Rejection uses structured enum instead of free text
rejection_reason_type registration_rejection_reason,
rejection_reason_note TEXT,  -- Mandatory when reason = ADMIN_DISCRETION
```

**`fee_payments` table v3.0 changes**:

```sql
-- New column: entry_type classifies the payment
entry_type payment_entry_type NOT NULL DEFAULT 'PAYMENT',

-- Payment mode adds CHEQUE
payment_mode payment_mode NOT NULL,  -- CASH, UPI, BANK_TRANSFER, CHEQUE, ONLINE
```

**`admin_terms` table v3.0 changes**:

```sql
-- Position is 6-value enum instead of 2
position admin_position NOT NULL,  -- PRESIDENT through EXECUTIVE_MEMBER

-- Permission is 5-value enum instead of 2
permission admin_permission NOT NULL,  -- FULL_ACCESS through CUSTOM

-- Status uses v3.0 values
status admin_term_status NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE, EXPIRED, EXTENDED, VACATED, ARCHIVED
```

### Migration Steps

```bash
# 1. Initialize Prisma
npx prisma init

# 2. Configure DATABASE_URL in .env.local (Supabase PostgreSQL)

# 3. Write full schema.prisma with ALL 21+ tables and ALL v3.0 enums

# 4. Run first migration
npx prisma migrate dev --name init_full_v3

# 5. Create and run seed
npx prisma db seed
```

### Seed Data (Development)

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

// 2. Society: Eden Estate (Independent Sector Colony)
const edenEstate = {
  societyId: "RWA-HR-GGN-122001-0001",
  societyCode: "EDENESTATE",
  name: "Eden Estate Resident Welfare Association",
  state: "HR",
  city: "Gurgaon",
  cityCode: "GGN",
  pincode: "122001",
  type: "INDEPENDENT_SECTOR_COLONY",
  joiningFee: 1000,
  annualFee: 1200,
};

// 3. Admin team for Eden Estate (v3.0: 3 positions filled)
const admins = [
  {
    name: "Hemant Kumar",
    mobile: "9876543210",
    role: "RWA_ADMIN_PRIMARY",
    position: "PRESIDENT",
    permission: "FULL_ACCESS",
  },
  {
    name: "Aarti Sharma",
    mobile: "9876543220",
    role: "RWA_ADMIN_SUPPORTING",
    position: "TREASURER",
    permission: "FINANCIAL_WRITE",
  },
  {
    name: "Vikram Singh",
    mobile: "9876543230",
    role: "RWA_ADMIN_SUPPORTING",
    position: "SECRETARY",
    permission: "READ_NOTIFY",
  },
];

// 4. Seven demo residents (mixed ownership types + statuses)
const residents = [
  {
    name: "Rajesh Sharma",
    mobile: "9876543211",
    ownership: "OWNER",
    status: "ACTIVE_PAID",
    unit: "S22-St3-H110",
  },
  {
    name: "Priya Singh",
    mobile: "9876543212",
    ownership: "TENANT",
    status: "ACTIVE_PARTIAL",
    unit: "S22-St9-H301",
  },
  {
    name: "Amit Verma",
    mobile: "9876543213",
    ownership: "OWNER",
    status: "ACTIVE_OVERDUE",
    unit: "S22-St2-H88",
  },
  {
    name: "Neha Gupta",
    mobile: "9876543214",
    ownership: "OWNER",
    status: "ACTIVE_EXEMPTED",
    unit: "S22-St1-H55",
  },
  {
    name: "Deepak Malhotra",
    mobile: "9876543215",
    ownership: "TENANT",
    status: "ACTIVE_PENDING",
    unit: "S22-St4-H44",
  },
  {
    name: "Rakesh Jain",
    mobile: "9876543216",
    ownership: "OWNER_NRO",
    status: "ACTIVE_PAID",
    unit: "S22-St6-H99",
  },
  {
    name: "Meena Devi",
    mobile: "9876543217",
    ownership: "JOINT_OWNER",
    status: "ACTIVE_LIFETIME",
    unit: "S22-St3-H110",
  },
];

// 5. Fee records for current session (2025-26)
// 6. Sample expenses (3 entries: Security, Cleaning, Maintenance)
// 7. Fee session record for 2025-26
// 8. Admin term records for all 3 admins
```

### Row-Level Security (RLS)

Enable RLS on all society-scoped tables. Key policies:

| Table              | Policy                | Rule                                                         |
| ------------------ | --------------------- | ------------------------------------------------------------ |
| All society-scoped | `society_isolation`   | `society_id = current_user.society_id OR role = SUPER_ADMIN` |
| notifications      | `own_notifications`   | Residents see only own; Admins see all in society            |
| audit_logs         | `audit_insert_only`   | INSERT only -- no UPDATE or DELETE                           |
| expenses           | `expense_read_all`    | All residents can READ (transparency)                        |
| expenses           | `expense_admin_write` | Only admins can INSERT/UPDATE                                |

### Acceptance Criteria

- [ ] All 21+ tables created in Supabase
- [ ] All v3.0 enum types exist with correct values
- [ ] `npx prisma studio` shows all tables and seed data
- [ ] RLS policies enabled and verified
- [ ] Seed data: 1 Super Admin, 1 society, 3 admins, 7 residents, fee records, expenses
- [ ] Migration file is clean and reviewable

---

## Task 1.4 — Supabase Auth Setup

**3 auth flows** (from v3.0 spec):

| Role                             | Auth Method                                     | Session Duration       |
| -------------------------------- | ----------------------------------------------- | ---------------------- |
| Super Admin                      | Email + Password + TOTP 2FA                     | 8h inactivity timeout  |
| RWA Admin (Primary + Supporting) | Mobile OTP (6-digit, 5-min expiry)              | 8h inactivity timeout  |
| Resident (all types)             | Mobile OTP -> Set 4-digit PIN for return visits | 30 days trusted device |

### Backend

**API routes**:

| Route                     | Method | Purpose                          |
| ------------------------- | ------ | -------------------------------- |
| `/api/v1/auth/login`      | POST   | Initiate login (email or mobile) |
| `/api/v1/auth/verify-otp` | POST   | Verify 6-digit OTP               |
| `/api/v1/auth/mfa`        | POST   | Verify TOTP code (Super Admin)   |
| `/api/v1/auth/set-pin`    | POST   | Set 4-digit PIN (Resident)       |
| `/api/v1/auth/verify-pin` | POST   | Verify PIN for return visits     |

**Auth service** (`src/services/auth.ts`):

```typescript
// Super Admin
signInWithEmailPassword(email: string, password: string): Promise<AuthResult>
verifyTOTP(factorId: string, code: string): Promise<AuthResult>

// Admin + Resident
sendOTP(mobile: string): Promise<void>       // Rate limit: 3/phone/hour
verifyOTP(mobile: string, code: string): Promise<AuthResult>

// Resident PIN
setPIN(userId: string, pin: string): Promise<void>  // bcrypt hash, store in users.pin_hash
verifyPIN(userId: string, pin: string): Promise<AuthResult>
// 5 failed attempts -> lock 30 min -> require OTP re-verification
```

**Auth helpers** (`src/lib/supabase/`):

```typescript
// client.ts — Browser Supabase client
// server.ts — Server component Supabase client
// middleware.ts — Auth checking helpers

export function getSession(): Promise<Session | null>;
export function getCurrentUser(): Promise<UserWithRole | null>;
export function requireAuth(role: UserRole | UserRole[]): Promise<UserWithRole>;
export function requireSociety(societyId: string): Promise<void>;
export function requirePermission(permission: AdminPermission): Promise<void>;
```

### UI Screens

#### Super Admin Login (`/[locale]/super-admin-login`)

```
┌───────────────────────────────────────────────┐
│                                               │
│           RWA Connect                         │
│           Super Admin Portal                  │
│                                               │
│  Email *                                      │
│  ┌─────────────────────────────────────┐     │
│  │ admin@rwaconnect.in                 │     │
│  └─────────────────────────────────────┘     │
│                                               │
│  Password *                                   │
│  ┌─────────────────────────────────────┐     │
│  │ ••••••••••••                        │     │
│  └─────────────────────────────────────┘     │
│                                               │
│  ┌─────────────────────────────────────┐     │
│  │            Sign In                   │     │
│  └─────────────────────────────────────┘     │
│                                               │
│  ── On success, if TOTP enrolled: ──          │
│                                               │
│  Enter 2FA Code                               │
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐             │
│  │ 4│ │ 8│ │ 2│ │ 9│ │ 1│ │ 7│             │
│  └──┘ └──┘ └──┘ └──┘ └──┘ └──┘             │
│                                               │
│  ┌─────────────────────────────────────┐     │
│  │            Verify                    │     │
│  └─────────────────────────────────────┘     │
│                                               │
└───────────────────────────────────────────────┘
```

#### Admin + Resident Login (`/[locale]/login`)

```
┌───────────────────────────────────────────────┐
│                                               │
│           RWA Connect                  [EN|HI]│
│           Login                               │
│                                               │
│  Mobile Number *                              │
│  ┌──────┐ ┌───────────────────────────┐      │
│  │ +91  │ │ 98765 43210               │      │
│  └──────┘ └───────────────────────────┘      │
│                                               │
│  ┌─────────────────────────────────────┐     │
│  │          Send OTP                    │     │
│  └─────────────────────────────────────┘     │
│                                               │
│  ── After OTP sent: ──                        │
│                                               │
│  Enter OTP (sent to 98765****0)               │
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐             │
│  │  │ │  │ │  │ │  │ │  │ │  │             │
│  └──┘ └──┘ └──┘ └──┘ └──┘ └──┘             │
│  Resend in 0:45                               │
│                                               │
│  ┌─────────────────────────────────────┐     │
│  │          Verify                      │     │
│  └─────────────────────────────────────┘     │
│                                               │
│  ── After first OTP login, if Resident: ──    │
│                                               │
│  Set a 4-digit PIN for quick access           │
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐                        │
│  │  │ │  │ │  │ │  │                        │
│  └──┘ └──┘ └──┘ └──┘                        │
│                                               │
│  ┌─────────────────────────────────────┐     │
│  │          Set PIN                     │     │
│  └─────────────────────────────────────┘     │
│  Skip for now                                 │
│                                               │
└───────────────────────────────────────────────┘
```

### Components to Build

- `SuperAdminLoginForm` -- Email + password form with TOTP step
- `OTPLoginForm` -- Mobile input + OTP verification (shared by Admin + Resident)
- `OTPInput` -- 6-digit input with auto-focus and auto-submit
- `PINInput` -- 4-digit input for resident PIN setup/verification
- `PINSetupPrompt` -- Post-login prompt to set PIN (skippable)
- `LanguageToggle` -- EN/HI toggle in auth header (from day 1)

### Acceptance Criteria

- [ ] Super Admin logs in with email + password + TOTP
- [ ] Admin logs in with mobile OTP, redirects to admin portal
- [ ] Resident logs in with mobile OTP, prompted to set PIN
- [ ] Resident returns and logs in with PIN (no OTP)
- [ ] 5 failed PINs locks account for 30 minutes, requires OTP
- [ ] OTP rate limit: max 3 per phone per hour
- [ ] Sessions persist: Super Admin/Admin 8h, Resident 30 days
- [ ] All auth screens show language toggle (EN/HI)
- [ ] All auth error messages are translated

---

## Task 1.5 — Middleware & Route Protection

**File**: `src/middleware.ts` (combined auth + i18n middleware)

### Route Protection Matrix

| Route Pattern                 | Access                                        | Redirect                    |
| ----------------------------- | --------------------------------------------- | --------------------------- |
| `/[locale]`                   | Public                                        | --                          |
| `/[locale]/login`             | Unauthenticated only                          | -> portal home if logged in |
| `/[locale]/super-admin-login` | Unauthenticated only                          | -> portal home if logged in |
| `/[locale]/register/*`        | Public                                        | --                          |
| `/[locale]/rwaid/*`           | Public (signed URL)                           | --                          |
| `/[locale]/super-admin/*`     | `SUPER_ADMIN` only                            | -> `/login`                 |
| `/[locale]/admin/*`           | `RWA_ADMIN_PRIMARY` or `RWA_ADMIN_SUPPORTING` | -> `/login`                 |
| `/[locale]/resident/*`        | `RESIDENT_*` (any resident role)              | -> `/login`                 |
| `/api/v1/*`                   | JWT required (no locale prefix)               | 401 JSON                    |

### Permission-Based Route Guards (v3.0 Addition)

Beyond role-based access, certain admin routes require specific permissions:

| Admin Route                     | Required Permission                               |
| ------------------------------- | ------------------------------------------------- |
| `/admin/fees/record`            | `FULL_ACCESS` or `FINANCIAL_WRITE`                |
| `/admin/expenses/add`           | `FULL_ACCESS` or `FINANCIAL_WRITE`                |
| `/admin/residents/[id]/approve` | `FULL_ACCESS`                                     |
| `/admin/broadcast`              | `FULL_ACCESS`, `READ_NOTIFY`, or `BROADCAST_ONLY` |
| `/admin/migration`              | `FULL_ACCESS`                                     |
| `/admin/settings`               | `FULL_ACCESS`                                     |

### i18n Middleware Integration

```typescript
// middleware.ts
import createMiddleware from "next-intl/middleware";

// 1. next-intl handles locale detection and routing
// 2. Auth middleware wraps around it for protected routes
// 3. API routes bypass locale middleware entirely

const locales = ["en", "hi"] as const;
const defaultLocale = "en";

// Middleware chain:
// Request -> i18n locale detection -> auth check -> route guard -> response
```

### Components to Build

- `middleware.ts` -- Combined i18n + auth middleware
- `src/lib/supabase/middleware.ts` -- Supabase session refresh helper
- `src/lib/permissions.ts` -- Permission checking utilities

### Permission Matrix

```typescript
// src/lib/permissions.ts

// Maps admin_position to default admin_permission
const POSITION_DEFAULT_PERMISSIONS: Record<AdminPosition, AdminPermission> = {
  PRESIDENT: "FULL_ACCESS",
  VICE_PRESIDENT: "FULL_ACCESS",
  SECRETARY: "READ_NOTIFY",
  JOINT_SECRETARY: "READ_NOTIFY",
  TREASURER: "FINANCIAL_WRITE",
  EXECUTIVE_MEMBER: "BROADCAST_ONLY",
};

// Permission capabilities matrix
const PERMISSION_CAPABILITIES = {
  FULL_ACCESS: {
    read: true,
    financial_write: true,
    approve: true,
    broadcast: true,
    settings: true,
    migrate: true,
  },
  FINANCIAL_WRITE: {
    read: true,
    financial_write: true,
    approve: false,
    broadcast: false,
    settings: false,
    migrate: false,
  },
  READ_NOTIFY: {
    read: true,
    financial_write: false,
    approve: false,
    broadcast: true,
    settings: false,
    migrate: false,
  },
  BROADCAST_ONLY: {
    read: false,
    financial_write: false,
    approve: false,
    broadcast: true,
    settings: false,
    migrate: false,
  },
  CUSTOM: {
    /* per-admin configuration */
  },
};
```

### Acceptance Criteria

- [ ] Unauthenticated users redirected from protected routes to `/login`
- [ ] Authenticated users redirected from login pages to their portal
- [ ] Role mismatch shows 403 error page
- [ ] Permission-based guards block unauthorized admin actions
- [ ] API routes return 401 JSON for missing/invalid JWT
- [ ] Locale detection works (browser preference -> default `en`)
- [ ] Locale prefix applied to all page routes (`/en/admin/dashboard`, `/hi/admin/dashboard`)
- [ ] API routes have no locale prefix (`/api/v1/societies`)

---

## Task 1.6 — Layout Shells

**3 portal layouts**, all supporting language toggle and dark mode from day 1.

### Super Admin Layout

```
┌─────────────────────────────────────────────────────────────┐
│  ┌───────────┐  RWA Connect — Super Admin    [EN|HI] [☾] [👤]│
│  │ R         │─────────────────────────────────────────────── │
│  │ W         │                                                │
│  │ A         │                                                │
│  │           │  ┌─────────────────────────────────────────┐  │
│  │ ─────     │  │                                         │  │
│  │ Dashboard │  │          Page Content Area               │  │
│  │ Societies │  │          (children rendered here)        │  │
│  │ Subscript.│  │                                         │  │
│  │ Settings  │  │                                         │  │
│  │           │  │                                         │  │
│  │           │  └─────────────────────────────────────────┘  │
│  │           │                                                │
│  │  ─────    │                                                │
│  │  v1.0.0   │                                                │
│  └───────────┘────────────────────────────────────────────────│
└─────────────────────────────────────────────────────────────┘
  Sidebar: 280px fixed | Collapses to hamburger on < 768px
```

### RWA Admin Layout

```
┌──────────────────────────────────────────────────────────────┐
│  ┌───────────┐  Eden Estate RWA    [Quick Actions▾] [EN|HI] [☾] [👤]│
│  │ EERWA     │───────────────────────────────────────────────│
│  │           │                                               │
│  │ ─────     │                                               │
│  │ Dashboard │  ┌─────────────────────────────────────────┐ │
│  │ Residents │  │                                         │ │
│  │ Fees      │  │          Page Content Area              │ │
│  │ Expenses  │  │          (children rendered here)       │ │
│  │ Festivals │  │                                         │ │
│  │ Reports   │  │                                         │ │
│  │ Broadcast │  │                                         │ │
│  │ Migration │  │                                         │ │
│  │ Settings  │  └─────────────────────────────────────────┘ │
│  │           │                                               │
│  │  ─────    │  Quick Action FAB (mobile):                   │
│  │  Term:    │  ┌──────────────────────┐                     │
│  │  Active   │  │ [+] Record Payment   │                     │
│  └───────────┘  │ [+] Add Expense      │                     │
│                  └──────────────────────┘                     │
└──────────────────────────────────────────────────────────────┘
  Sidebar: 240px collapsible | Quick Actions dropdown + mobile FAB
```

### Resident Layout (Mobile-First)

```
┌─────────────────────────────────┐
│  Eden Estate RWA   [EN|HI] [🔔] │
│  ─────────────────────────────── │
│                                  │
│  Welcome, Rajesh!                │
│  Status: ACTIVE_PAID             │
│  RWAID: #0089                    │
│                                  │
│  ┌────────────────────────────┐ │
│  │                            │ │
│  │    Page Content Area       │ │
│  │    (children rendered here)│ │
│  │                            │ │
│  │                            │ │
│  │                            │ │
│  │                            │ │
│  │                            │ │
│  └────────────────────────────┘ │
│                                  │
│  ┌──────┬──────┬──────┬──────┐ │
│  │  🏠  │  💰  │  📊  │  👤  │ │
│  │ Home │ Pay  │ Exp. │ Me   │ │
│  └──────┴──────┴──────┴──────┘ │
└─────────────────────────────────┘
  Bottom nav: 4 tabs | Min width: 360px
  Header: Society name + notification bell + language toggle
```

### Components to Build

| Component           | File                                          | Purpose                                                     |
| ------------------- | --------------------------------------------- | ----------------------------------------------------------- |
| `SuperAdminSidebar` | `src/components/layout/SuperAdminSidebar.tsx` | Fixed sidebar with nav items, version, collapse toggle      |
| `AdminSidebar`      | `src/components/layout/AdminSidebar.tsx`      | Collapsible sidebar with nav, term status, Quick Actions    |
| `ResidentBottomNav` | `src/components/layout/ResidentBottomNav.tsx` | 4-tab bottom navigation                                     |
| `Header`            | `src/components/layout/Header.tsx`            | Shared header: title, user menu, language toggle, dark mode |
| `LanguageToggle`    | `src/components/layout/LanguageToggle.tsx`    | EN/HI switcher (updates locale, persists preference)        |
| `ThemeToggle`       | `src/components/layout/ThemeToggle.tsx`       | Light/dark mode toggle                                      |
| `QuickActionsFAB`   | `src/components/layout/QuickActionsFAB.tsx`   | Mobile floating action button for admin                     |
| `UserMenu`          | `src/components/layout/UserMenu.tsx`          | Avatar dropdown: profile, settings, logout                  |

### Acceptance Criteria

- [ ] All 3 layouts render correctly on desktop (1280px+)
- [ ] Super Admin sidebar collapses to hamburger menu below 768px
- [ ] Admin sidebar is collapsible (toggle button) with tooltip-only mode
- [ ] Resident bottom nav renders on all resident pages
- [ ] Language toggle switches between English and Hindi immediately
- [ ] Dark mode toggle works and persists across sessions
- [ ] Quick Actions FAB appears on mobile admin portal
- [ ] Active nav item highlighted with teal accent
- [ ] User menu shows role, name, logout

---

## Task 1.7 — Design System & Theme

Configure shadcn/ui with the full product design tokens.

### Design Tokens

```css
/* globals.css */

@layer base {
  :root {
    /* Primary: Teal */
    --primary: 174 72% 40%;
    --primary-foreground: 0 0% 100%;

    /* Semantic Status Colors */
    --status-paid: 142 76% 36%; /* Green */
    --status-pending: 48 96% 53%; /* Yellow/Amber */
    --status-overdue: 0 84% 60%; /* Red */
    --status-partial: 25 95% 53%; /* Orange */
    --status-exempted: 221 83% 53%; /* Blue */
    --status-lifetime: 262 80% 50%; /* Purple */
    --status-advance: 174 72% 40%; /* Teal (same as primary) */
    --status-inactive: 220 9% 46%; /* Gray */

    /* Background, Card, Muted, Border, etc. — standard shadcn tokens */
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --border: 214.3 31.8% 91.4%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --border: 217.2 32.6% 17.5%;
    /* Status colors slightly adjusted for dark mode readability */
  }
}
```

### Reusable Composed Components

#### StatusBadge

Maps all 14 resident statuses + 8 fee statuses to colored badges.

```typescript
// src/components/ui/StatusBadge.tsx

interface StatusBadgeProps {
  status: ResidentStatus | FeeStatus | AdminTermStatus | FestivalStatus;
  size?: "sm" | "md";
}

// Status -> Color mapping:
// ACTIVE_PAID / PAID         -> green
// ACTIVE_PENDING / PENDING   -> yellow
// ACTIVE_OVERDUE / OVERDUE   -> red
// ACTIVE_PARTIAL / PARTIAL   -> orange
// ACTIVE_EXEMPTED / EXEMPTED -> blue
// ACTIVE_LIFETIME / LIFETIME -> purple
// ADVANCE_PAID               -> teal
// MIGRATED_PENDING / MIGRATED_DORMANT -> gray
// SUSPENDED / BLACKLISTED    -> red (dark)
// DECEASED                   -> gray (dark)
// TRANSFERRED_DEACTIVATED / TENANT_DEPARTED -> gray
// NOT_YET_DUE                -> neutral
```

#### PageHeader

```typescript
// src/components/ui/PageHeader.tsx

interface PageHeaderProps {
  title: string; // i18n key or string
  description?: string; // i18n key or string
  actions?: React.ReactNode; // Buttons aligned right
  breadcrumbs?: BreadcrumbItem[];
}
```

```
┌──────────────────────────────────────────────────────────┐
│  Home > Residents > Rajesh Sharma                         │
│                                                           │
│  Rajesh Sharma                      [Edit] [Deactivate]  │
│  Owner — S22-St3-H110 — ACTIVE_PAID                      │
└──────────────────────────────────────────────────────────┘
```

#### DataTable (TanStack Table Wrapper)

```typescript
// src/components/ui/DataTable.tsx

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  searchKey?: string; // Column key for search input
  filterOptions?: FilterOption[];
  pagination?: boolean;
  pageSize?: number;
  onRowClick?: (row: T) => void;
  emptyState?: React.ReactNode;
  loading?: boolean;
}
```

```
┌──────────────────────────────────────────────────────────┐
│  Search: [____________]   Status: [All ▾]   Type: [All ▾]│
│  ─────────────────────────────────────────────────────────│
│  Name            │ Mobile     │ Status       │ Actions    │
│  ─────────────────────────────────────────────────────────│
│  Rajesh Sharma   │ 98765****1 │ 🟢 Paid      │ [View]     │
│  Priya Singh     │ 98765****2 │ 🟠 Partial   │ [View]     │
│  Amit Verma      │ 98765****3 │ 🔴 Overdue   │ [View]     │
│  ─────────────────────────────────────────────────────────│
│  ← 1 2 3 ... 5 →              Showing 1-10 of 42         │
└──────────────────────────────────────────────────────────┘
```

#### EmptyState

```typescript
// src/components/ui/EmptyState.tsx

interface EmptyStateProps {
  icon?: React.ReactNode; // Lucide icon
  title: string; // i18n key
  description?: string; // i18n key
  action?: {
    label: string;
    onClick: () => void;
  };
}
```

```
┌──────────────────────────────────────────────┐
│                                              │
│              ┌────────┐                      │
│              │  📋    │                      │
│              └────────┘                      │
│                                              │
│         No residents yet                     │
│   Share the QR poster to start registrations │
│                                              │
│        [Download QR Poster]                  │
│                                              │
└──────────────────────────────────────────────┘
```

#### LoadingSkeleton

```typescript
// src/components/ui/LoadingSkeleton.tsx

interface LoadingSkeletonProps {
  variant: "page" | "table" | "card" | "form" | "stats-row";
  rows?: number; // For table variant
}
```

#### StatCard

```typescript
// src/components/ui/StatCard.tsx

interface StatCardProps {
  label: string; // i18n key
  value: string | number;
  icon?: React.ReactNode;
  trend?: { value: number; direction: "up" | "down" };
  href?: string; // Click to navigate
  variant?: "default" | "success" | "warning" | "danger";
}
```

#### Additional Design System Components

| Component       | Purpose                                                |
| --------------- | ------------------------------------------------------ |
| `ConfirmDialog` | Destructive action confirmation (delete, deactivate)   |
| `AmountDisplay` | Formatted currency display (INR with commas: 1,00,000) |
| `MobileDisplay` | Masked mobile number (98765\*\*\*\*0)                  |
| `DateDisplay`   | Locale-aware date formatting (date-fns)                |
| `RWAIDDisplay`  | Formatted RWAID with copy button                       |

### Acceptance Criteria

- [ ] All shadcn components installed and rendering
- [ ] Teal primary theme applied consistently
- [ ] Dark mode toggle works — all components adapt
- [ ] StatusBadge renders all 14 resident statuses with correct colors
- [ ] StatusBadge renders all 8 fee statuses with correct colors
- [ ] DataTable: search, filter, sort, paginate all working
- [ ] EmptyState displays with icon, message, and CTA
- [ ] LoadingSkeleton variants for page, table, card, form, stats
- [ ] StatCard shows label, value, trend arrow, clickable
- [ ] AmountDisplay formats INR correctly (Indian numbering: lakhs/crores)
- [ ] All components support both English and Hindi labels

---

## Task 1.8 — Zod Validation Schemas (All Entities)

Shared between forms (client) and API routes (server). One source of truth for validation.

### `src/lib/validations/common.ts`

```typescript
import { z } from "zod";

// Reusable field validators
export const indianMobile = z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian mobile number");
export const pincode = z.string().regex(/^\d{6}$/, "Must be 6 digits");
export const societyCode = z
  .string()
  .min(4)
  .max(8)
  .regex(/^[A-Z0-9]+$/, "4-8 uppercase alphanumeric");
export const amount = z.number().min(0).max(10_000_000); // Max 1 crore
export const pin = z.string().regex(/^\d{4}$/, "Must be 4 digits");
export const upiRef = z.string().min(8).max(35);
export const chequeNo = z.string().min(6).max(10);
```

### `src/lib/validations/society.ts`

```typescript
export const createSocietySchema = z.object({
  name: z.string().min(3).max(200),
  registrationNo: z.string().max(50).optional(),
  state: z.string().length(2),
  city: z.string().min(2).max(50),
  pincode: pincode,
  type: z.enum([
    "APARTMENT_COMPLEX",
    "BUILDER_FLOORS",
    "GATED_COMMUNITY_VILLAS",
    "INDEPENDENT_SECTOR_COLONY",
    "PLOTTED_COLONY",
  ]),
  societyCode: societyCode,
  joiningFee: amount,
  annualFee: amount,
  feeSessionStartMonth: z.number().min(1).max(12),
  gracePeriodDays: z.number().min(0).max(90),
  plan: z.enum(["TRIAL", "BASIC", "STANDARD", "PREMIUM", "ENTERPRISE"]),
  adminName: z.string().min(2).max(100),
  adminMobile: indianMobile,
  adminPosition: z.enum([
    "PRESIDENT",
    "VICE_PRESIDENT",
    "SECRETARY",
    "JOINT_SECRETARY",
    "TREASURER",
    "EXECUTIVE_MEMBER",
  ]),
});
```

### `src/lib/validations/resident.ts`

```typescript
export const registerResidentSchema = z.object({
  fullName: z.string().min(2).max(100),
  mobile: indianMobile,
  email: z.string().email().optional().or(z.literal("")),
  ownershipType: z.enum(["OWNER", "OWNER_NRO", "JOINT_OWNER", "TENANT"]),
  consentWhatsApp: z.literal(true, {
    errorMap: () => ({ message: "WhatsApp consent is required" }),
  }),
  // Unit fields validated dynamically based on society type (server-side)
});

export const approveResidentSchema = z.object({
  residentId: z.string().uuid(),
  notes: z.string().max(500).optional(),
});

export const rejectResidentSchema = z
  .object({
    residentId: z.string().uuid(),
    reason: z.enum([
      "NOT_RESIDENT",
      "DUPLICATE_ENTRY",
      "INCORRECT_INFORMATION",
      "UNDER_VERIFICATION",
      "ADMIN_DISCRETION",
    ]),
    reasonNote: z.string().min(10).max(500).optional(),
    // reasonNote mandatory when reason = ADMIN_DISCRETION
  })
  .refine(
    (data) =>
      data.reason !== "ADMIN_DISCRETION" || (data.reasonNote && data.reasonNote.length >= 10),
    { message: "Note is required for admin discretion", path: ["reasonNote"] },
  );
```

### `src/lib/validations/fee.ts`

```typescript
export const recordPaymentSchema = z
  .object({
    userId: z.string().uuid(),
    feeId: z.string().uuid(),
    amount: amount.positive(),
    paymentMode: z.enum(["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "ONLINE"]),
    referenceNo: z.string().max(50).optional(),
    paymentDate: z.string().date(),
    notes: z.string().max(500).optional(),
  })
  .refine(
    (data) => {
      if (["UPI", "BANK_TRANSFER", "CHEQUE"].includes(data.paymentMode)) {
        return !!data.referenceNo && data.referenceNo.length >= 4;
      }
      return true;
    },
    { message: "Reference number is mandatory for this payment mode", path: ["referenceNo"] },
  );

export const exemptFeeSchema = z.object({
  userId: z.string().uuid(),
  sessionYear: z.string().regex(/^\d{4}-\d{2}$/),
  reason: z.string().min(10).max(500),
});
```

### `src/lib/validations/expense.ts`

```typescript
export const addExpenseSchema = z
  .object({
    date: z.string().date(),
    amount: amount.positive(),
    category: z.enum([
      "MAINTENANCE",
      "SECURITY",
      "CLEANING",
      "STAFF_SALARY",
      "INFRASTRUCTURE",
      "UTILITIES",
      "FESTIVAL",
      "EMERGENCY",
      "LEGAL",
      "ADMINISTRATIVE",
      "OTHER",
    ]),
    description: z.string().min(5).max(1000),
    receiptUrl: z.string().url().optional(),
    festivalId: z.string().uuid().optional(),
  })
  .refine(
    (data) => {
      if (["EMERGENCY", "OTHER"].includes(data.category)) {
        return data.description.length >= 20;
      }
      return true;
    },
    { message: "Detailed description required for this category", path: ["description"] },
  )
  .refine(
    (data) => {
      if (data.category === "FESTIVAL") {
        return !!data.festivalId;
      }
      return true;
    },
    { message: "Festival ID required for festival expenses", path: ["festivalId"] },
  );
```

### `src/lib/validations/festival.ts`

```typescript
export const createFestivalSchema = z
  .object({
    name: z.string().min(3).max(200),
    description: z.string().max(2000).optional(),
    eventDate: z.string().date(),
    targetAmount: amount.positive(),
    collectionStart: z.string().date(),
    collectionEnd: z.string().date(),
  })
  .refine((data) => new Date(data.collectionEnd) > new Date(data.collectionStart), {
    message: "Collection end must be after start",
    path: ["collectionEnd"],
  })
  .refine((data) => new Date(data.eventDate) >= new Date(data.collectionEnd), {
    message: "Event date must be on or after collection end",
    path: ["eventDate"],
  });
```

### `src/lib/validations/auth.ts`

```typescript
export const loginSchema = z.object({
  mobile: indianMobile,
});

export const verifyOTPSchema = z.object({
  mobile: indianMobile,
  code: z
    .string()
    .length(6)
    .regex(/^\d{6}$/),
});

export const setPINSchema = z
  .object({
    pin: pin,
    confirmPin: pin,
  })
  .refine((data) => data.pin === data.confirmPin, {
    message: "PINs do not match",
    path: ["confirmPin"],
  });

export const superAdminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const totpSchema = z.object({
  code: z
    .string()
    .length(6)
    .regex(/^\d{6}$/),
});
```

### `src/lib/validations/notification.ts`

```typescript
export const broadcastSchema = z
  .object({
    message: z.string().min(10).max(4096),
    recipientFilter: z.enum(["ALL_ACTIVE", "FEE_PENDING", "FEE_OVERDUE", "CUSTOM"]),
    customRecipientIds: z.array(z.string().uuid()).optional(),
  })
  .refine(
    (data) =>
      data.recipientFilter !== "CUSTOM" ||
      (data.customRecipientIds && data.customRecipientIds.length > 0),
    { message: "Select at least one recipient for custom broadcast", path: ["customRecipientIds"] },
  );
```

### Acceptance Criteria

- [ ] All schemas export correct TypeScript types via `z.infer<typeof schema>`
- [ ] Schemas validate correctly on both client and server
- [ ] Conditional validation works (e.g., reference required for UPI)
- [ ] Error messages are descriptive and translatable
- [ ] Common validators reused across schemas
- [ ] No `any` types in inferred types

---

## Task 1.9 — TanStack Query Provider + Query Key Factory

### Provider Setup

```typescript
// src/providers/QueryProvider.tsx
'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5 * 60 * 1000,    // 5 minutes
          gcTime: 10 * 60 * 1000,       // 10 minutes (formerly cacheTime)
          retry: 2,
          refetchOnWindowFocus: false,
        },
        mutations: {
          retry: 0,
        },
      },
    })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
```

### Query Key Factory

```typescript
// src/lib/queryKeys.ts

export const queryKeys = {
  // Societies
  societies: {
    all: ["societies"] as const,
    list: (filters?: Record<string, string>) => ["societies", "list", filters] as const,
    detail: (id: string) => ["societies", id] as const,
    stats: (id: string) => ["societies", id, "stats"] as const,
    checkCode: (code: string) => ["societies", "check-code", code] as const,
  },

  // Residents
  residents: {
    all: (societyId: string) => ["residents", societyId] as const,
    list: (societyId: string, filters?: Record<string, string>) =>
      ["residents", societyId, "list", filters] as const,
    detail: (id: string) => ["residents", id] as const,
    pending: (societyId: string) => ["residents", societyId, "pending"] as const,
    search: (societyId: string, query: string) =>
      ["residents", societyId, "search", query] as const,
  },

  // Fees
  fees: {
    session: (societyId: string, year: string) => ["fees", societyId, year] as const,
    userFees: (userId: string) => ["fees", "user", userId] as const,
    detail: (id: string) => ["fees", id] as const,
    summary: (societyId: string, year: string) => ["fees", societyId, year, "summary"] as const,
  },

  // Expenses
  expenses: {
    list: (societyId: string, filters?: Record<string, string>) =>
      ["expenses", societyId, "list", filters] as const,
    detail: (id: string) => ["expenses", id] as const,
    summary: (societyId: string, dateRange?: string) =>
      ["expenses", societyId, "summary", dateRange] as const,
  },

  // Festivals
  festivals: {
    list: (societyId: string) => ["festivals", societyId] as const,
    detail: (id: string) => ["festivals", id] as const,
    contributions: (festivalId: string) => ["festivals", festivalId, "contributions"] as const,
  },

  // Notifications
  notifications: {
    list: (userId: string) => ["notifications", userId] as const,
    unreadCount: (userId: string) => ["notifications", userId, "unread"] as const,
  },

  // Reports
  reports: {
    collection: (societyId: string, year: string) =>
      ["reports", societyId, "collection", year] as const,
    expenses: (societyId: string, dateRange: string) =>
      ["reports", societyId, "expenses", dateRange] as const,
    dashboard: (societyId: string) => ["reports", societyId, "dashboard"] as const,
  },

  // Auth
  auth: {
    session: ["auth", "session"] as const,
    user: ["auth", "user"] as const,
  },
} as const;
```

### Acceptance Criteria

- [ ] QueryProvider wraps the app at root layout level
- [ ] React Query DevTools accessible in development
- [ ] Queries cache correctly (5-minute stale time)
- [ ] Query keys are type-safe with `as const`
- [ ] Background refetch works when navigating back to cached pages
- [ ] Mutations invalidate correct query keys on success

---

## Task 1.10 — i18n Setup (English + Hindi)

### next-intl Configuration

```typescript
// src/i18n/routing.ts
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "hi"],
  defaultLocale: "en",
});

// src/i18n/navigation.ts
import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

export const { Link, redirect, usePathname, useRouter } = createNavigation(routing);

// src/i18n/request.ts
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as "en" | "hi")) {
    locale = routing.defaultLocale;
  }
  return {
    locale,
    messages: (await import(`@/messages/${locale}.json`)).default,
  };
});
```

### Translation Files

**`src/messages/en.json`** (English -- source of truth):

```json
{
  "common": {
    "appName": "RWA Connect",
    "loading": "Loading...",
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "view": "View",
    "search": "Search",
    "filter": "Filter",
    "noResults": "No results found",
    "confirmAction": "Are you sure?",
    "success": "Success",
    "error": "Something went wrong",
    "retry": "Retry",
    "back": "Back",
    "next": "Next",
    "submit": "Submit",
    "logout": "Logout",
    "language": "Language"
  },
  "auth": {
    "login": "Login",
    "mobile": "Mobile Number",
    "sendOTP": "Send OTP",
    "enterOTP": "Enter OTP sent to {mobile}",
    "verify": "Verify",
    "resendIn": "Resend in {seconds}s",
    "setPin": "Set a 4-digit PIN for quick access",
    "enterPin": "Enter your PIN",
    "skipForNow": "Skip for now",
    "superAdminLogin": "Super Admin Login",
    "email": "Email",
    "password": "Password",
    "signIn": "Sign In",
    "enter2FA": "Enter 2FA Code",
    "invalidOTP": "Invalid OTP. Please try again.",
    "otpExpired": "OTP expired. Please request a new one.",
    "pinMismatch": "PINs do not match",
    "accountLocked": "Too many attempts. Please try OTP login.",
    "rateLimited": "Too many OTP requests. Try again in {minutes} minutes."
  },
  "nav": {
    "dashboard": "Dashboard",
    "societies": "Societies",
    "residents": "Residents",
    "fees": "Fees",
    "expenses": "Expenses",
    "festivals": "Festivals",
    "reports": "Reports",
    "broadcast": "Broadcast",
    "migration": "Migration",
    "settings": "Settings",
    "subscriptions": "Subscriptions",
    "home": "Home",
    "payments": "Payments",
    "profile": "Profile",
    "notifications": "Notifications"
  },
  "status": {
    "ACTIVE_PAID": "Paid",
    "ACTIVE_PENDING": "Pending",
    "ACTIVE_OVERDUE": "Overdue",
    "ACTIVE_PARTIAL": "Partial",
    "ACTIVE_EXEMPTED": "Exempted",
    "ACTIVE_LIFETIME": "Lifetime",
    "PENDING_APPROVAL": "Pending Approval",
    "REJECTED": "Rejected",
    "MIGRATED_PENDING": "Migrated (Pending)",
    "MIGRATED_DORMANT": "Dormant",
    "TRANSFERRED_DEACTIVATED": "Transferred",
    "TENANT_DEPARTED": "Departed",
    "SUSPENDED": "Suspended",
    "DECEASED": "Deceased",
    "BLACKLISTED": "Blacklisted",
    "PAID": "Paid",
    "PENDING": "Pending",
    "OVERDUE": "Overdue",
    "PARTIAL": "Partial",
    "EXEMPTED": "Exempted",
    "NOT_YET_DUE": "Not Yet Due",
    "ADVANCE_PAID": "Advance Paid",
    "LIFETIME": "Lifetime"
  },
  "society": {
    "onboard": "Onboard New Society",
    "name": "Society Name",
    "code": "Society Code",
    "type": "Society Type",
    "state": "State",
    "city": "City",
    "pincode": "Pincode",
    "joiningFee": "Joining Fee",
    "annualFee": "Annual Fee",
    "totalResidents": "Total Residents",
    "downloadQR": "Download QR Poster"
  },
  "resident": {
    "register": "Register",
    "approve": "Approve",
    "reject": "Reject",
    "fullName": "Full Name",
    "mobile": "Mobile Number",
    "ownershipType": "Ownership Type",
    "OWNER": "Owner",
    "OWNER_NRO": "Owner (Non-Resident)",
    "JOINT_OWNER": "Joint Owner",
    "TENANT": "Tenant",
    "unit": "Unit",
    "consentWhatsApp": "I consent to receive WhatsApp notifications"
  },
  "fee": {
    "recordPayment": "Record Payment",
    "paymentMode": "Payment Mode",
    "CASH": "Cash",
    "UPI": "UPI",
    "BANK_TRANSFER": "Bank Transfer",
    "CHEQUE": "Cheque",
    "ONLINE": "Online",
    "referenceNo": "Reference Number",
    "receiptNo": "Receipt Number",
    "amountDue": "Amount Due",
    "amountPaid": "Amount Paid",
    "balance": "Balance",
    "session": "Session"
  },
  "expense": {
    "addExpense": "Add Expense",
    "category": "Category",
    "MAINTENANCE": "Maintenance",
    "SECURITY": "Security",
    "CLEANING": "Cleaning",
    "STAFF_SALARY": "Staff Salary",
    "INFRASTRUCTURE": "Infrastructure",
    "UTILITIES": "Utilities",
    "FESTIVAL": "Festival",
    "EMERGENCY": "Emergency",
    "LEGAL": "Legal",
    "ADMINISTRATIVE": "Administrative",
    "OTHER": "Other",
    "description": "Description",
    "amount": "Amount"
  }
}
```

**`src/messages/hi.json`** (Hindi):

```json
{
  "common": {
    "appName": "RWA Connect",
    "loading": "लोड हो रहा है...",
    "save": "सहेजें",
    "cancel": "रद्द करें",
    "delete": "हटाएं",
    "edit": "संपादित करें",
    "view": "देखें",
    "search": "खोजें",
    "filter": "फ़िल्टर",
    "noResults": "कोई परिणाम नहीं मिला",
    "confirmAction": "क्या आप सुनिश्चित हैं?",
    "success": "सफल",
    "error": "कुछ गलत हो गया",
    "retry": "पुनः प्रयास करें",
    "back": "वापस",
    "next": "अगला",
    "submit": "जमा करें",
    "logout": "लॉगआउट",
    "language": "भाषा"
  },
  "auth": {
    "login": "लॉगिन",
    "mobile": "मोबाइल नंबर",
    "sendOTP": "OTP भेजें",
    "enterOTP": "{mobile} पर भेजा गया OTP दर्ज करें",
    "verify": "सत्यापित करें",
    "resendIn": "{seconds} सेकंड में पुनः भेजें",
    "setPin": "त्वरित लॉगिन के लिए 4 अंकों का PIN सेट करें",
    "enterPin": "अपना PIN दर्ज करें",
    "skipForNow": "अभी छोड़ें",
    "superAdminLogin": "सुपर एडमिन लॉगिन",
    "email": "ईमेल",
    "password": "पासवर्ड",
    "signIn": "साइन इन",
    "enter2FA": "2FA कोड दर्ज करें",
    "invalidOTP": "अमान्य OTP। कृपया पुनः प्रयास करें।",
    "otpExpired": "OTP की समय सीमा समाप्त। कृपया नया अनुरोध करें।",
    "pinMismatch": "PIN मेल नहीं खाते",
    "accountLocked": "बहुत अधिक प्रयास। कृपया OTP लॉगिन का प्रयास करें।",
    "rateLimited": "बहुत अधिक OTP अनुरोध। {minutes} मिनट बाद पुनः प्रयास करें।"
  },
  "nav": {
    "dashboard": "डैशबोर्ड",
    "societies": "सोसायटी",
    "residents": "निवासी",
    "fees": "शुल्क",
    "expenses": "खर्च",
    "festivals": "त्योहार",
    "reports": "रिपोर्ट",
    "broadcast": "प्रसारण",
    "migration": "माइग्रेशन",
    "settings": "सेटिंग्स",
    "subscriptions": "सदस्यता",
    "home": "होम",
    "payments": "भुगतान",
    "profile": "प्रोफ़ाइल",
    "notifications": "सूचनाएं"
  },
  "status": {
    "ACTIVE_PAID": "भुगतान किया",
    "ACTIVE_PENDING": "लंबित",
    "ACTIVE_OVERDUE": "अतिदेय",
    "ACTIVE_PARTIAL": "आंशिक",
    "ACTIVE_EXEMPTED": "छूट",
    "ACTIVE_LIFETIME": "आजीवन",
    "PENDING_APPROVAL": "अनुमोदन लंबित",
    "REJECTED": "अस्वीकृत",
    "MIGRATED_PENDING": "माइग्रेटेड (लंबित)",
    "MIGRATED_DORMANT": "निष्क्रिय",
    "TRANSFERRED_DEACTIVATED": "स्थानांतरित",
    "TENANT_DEPARTED": "प्रस्थान",
    "SUSPENDED": "निलंबित",
    "DECEASED": "दिवंगत",
    "BLACKLISTED": "काली सूची",
    "PAID": "भुगतान किया",
    "PENDING": "लंबित",
    "OVERDUE": "अतिदेय",
    "PARTIAL": "आंशिक",
    "EXEMPTED": "छूट",
    "NOT_YET_DUE": "अभी देय नहीं",
    "ADVANCE_PAID": "अग्रिम भुगतान",
    "LIFETIME": "आजीवन"
  },
  "society": {
    "onboard": "नई सोसायटी जोड़ें",
    "name": "सोसायटी का नाम",
    "code": "सोसायटी कोड",
    "type": "सोसायटी प्रकार",
    "state": "राज्य",
    "city": "शहर",
    "pincode": "पिनकोड",
    "joiningFee": "प्रवेश शुल्क",
    "annualFee": "वार्षिक शुल्क",
    "totalResidents": "कुल निवासी",
    "downloadQR": "QR पोस्टर डाउनलोड करें"
  },
  "resident": {
    "register": "पंजीकरण",
    "approve": "स्वीकृत करें",
    "reject": "अस्वीकार करें",
    "fullName": "पूरा नाम",
    "mobile": "मोबाइल नंबर",
    "ownershipType": "स्वामित्व प्रकार",
    "OWNER": "मालिक",
    "OWNER_NRO": "मालिक (अनिवासी)",
    "JOINT_OWNER": "संयुक्त मालिक",
    "TENANT": "किरायेदार",
    "unit": "यूनिट",
    "consentWhatsApp": "मैं WhatsApp सूचनाएं प्राप्त करने की सहमति देता/देती हूं"
  },
  "fee": {
    "recordPayment": "भुगतान दर्ज करें",
    "paymentMode": "भुगतान माध्यम",
    "CASH": "नकद",
    "UPI": "UPI",
    "BANK_TRANSFER": "बैंक ट्रांसफर",
    "CHEQUE": "चेक",
    "ONLINE": "ऑनलाइन",
    "referenceNo": "संदर्भ संख्या",
    "receiptNo": "रसीद संख्या",
    "amountDue": "देय राशि",
    "amountPaid": "भुगतान राशि",
    "balance": "शेष राशि",
    "session": "सत्र"
  },
  "expense": {
    "addExpense": "खर्च जोड़ें",
    "category": "श्रेणी",
    "MAINTENANCE": "रखरखाव",
    "SECURITY": "सुरक्षा",
    "CLEANING": "सफाई",
    "STAFF_SALARY": "कर्मचारी वेतन",
    "INFRASTRUCTURE": "बुनियादी ढांचा",
    "UTILITIES": "उपयोगिताएं",
    "FESTIVAL": "त्योहार",
    "EMERGENCY": "आपातकालीन",
    "LEGAL": "कानूनी",
    "ADMINISTRATIVE": "प्रशासनिक",
    "OTHER": "अन्य",
    "description": "विवरण",
    "amount": "राशि"
  }
}
```

### LanguageToggle Component

```
┌──────────────┐
│  EN  |  हिं  │    ← Toggle in header of every page
└──────────────┘
```

Behavior:

1. Switches locale by updating the URL prefix (`/en/...` <-> `/hi/...`)
2. Persists preference in a cookie (`NEXT_LOCALE`)
3. All UI text updates instantly (no page reload)
4. Date formatting adapts via `date-fns` locale

### Acceptance Criteria

- [ ] `/en/admin/dashboard` renders in English
- [ ] `/hi/admin/dashboard` renders in Hindi
- [ ] Language toggle switches locale and URL immediately
- [ ] Locale preference persists across sessions (cookie)
- [ ] Browser language auto-detected on first visit (falls back to `en`)
- [ ] All status badges, nav items, buttons, and form labels are translated
- [ ] Date formatting uses locale-appropriate format
- [ ] API routes do NOT have locale prefix
- [ ] Missing translation keys fall back to English gracefully

---

## Task 1.11 — Error Handling & Loading States

### Error Boundaries

| File                                       | Scope              | Behavior                                             |
| ------------------------------------------ | ------------------ | ---------------------------------------------------- |
| `src/app/[locale]/error.tsx`               | Root               | Catch-all with "Something went wrong" + retry button |
| `src/app/[locale]/(super-admin)/error.tsx` | Super Admin portal | Portal-specific error with sidebar still visible     |
| `src/app/[locale]/(admin)/error.tsx`       | Admin portal       | Portal-specific error with sidebar still visible     |
| `src/app/[locale]/(resident)/error.tsx`    | Resident portal    | Portal-specific error with bottom nav still visible  |

### 404 Page

**File**: `src/app/[locale]/not-found.tsx`

```
┌──────────────────────────────────────────────┐
│                                              │
│              ┌────────┐                      │
│              │  404   │                      │
│              └────────┘                      │
│                                              │
│         Page not found                       │
│   The page you're looking for doesn't exist  │
│         or has been moved.                   │
│                                              │
│         [Go to Dashboard]                    │
│                                              │
└──────────────────────────────────────────────┘
```

### Loading Skeletons

| File                                                   | Variant       | Description                            |
| ------------------------------------------------------ | ------------- | -------------------------------------- |
| `src/app/[locale]/(super-admin)/loading.tsx`           | Stats + table | 3 stat card skeletons + table skeleton |
| `src/app/[locale]/(admin)/loading.tsx`                 | Stats + table | 4 stat card skeletons + table skeleton |
| `src/app/[locale]/(resident)/loading.tsx`              | Card stack    | 2 card skeletons                       |
| `src/app/[locale]/(super-admin)/societies/loading.tsx` | Table         | Full table skeleton with search bar    |
| `src/app/[locale]/(admin)/residents/loading.tsx`       | Table         | Full table skeleton with filters       |

### API Error Response Format

```typescript
// Standard API error response
interface ApiError {
  error: {
    code: string; // Machine-readable: 'VALIDATION_ERROR', 'NOT_FOUND', etc.
    message: string; // Human-readable (translatable)
    details?: Record<string, string[]>; // Field-level errors for validation
  };
}

// HTTP status codes used:
// 200 — Success
// 201 — Created
// 400 — Validation error
// 401 — Unauthenticated
// 403 — Forbidden (wrong role or insufficient permission)
// 404 — Not found
// 409 — Conflict (duplicate society code, etc.)
// 429 — Rate limited
// 500 — Internal server error
```

### Toast Notifications

Use `sonner` (shadcn-compatible) for transient feedback:

```typescript
// Success: "Payment recorded successfully" (auto-dismiss 3s)
// Error: "Failed to record payment. Please try again." (persistent until dismissed)
// Info: "Your session will expire in 5 minutes" (auto-dismiss 5s)
```

### Acceptance Criteria

- [ ] Error boundaries catch and display errors with retry button
- [ ] Layout (sidebar/nav) remains visible when error occurs inside content area
- [ ] 404 page renders for invalid routes with correct locale
- [ ] Loading skeletons display during data fetching (no blank screens)
- [ ] API errors return consistent JSON format with correct status codes
- [ ] Toast notifications display for success/error actions
- [ ] Network errors show "Connection lost" banner (not just blank screen)
- [ ] All error messages are translated (EN/HI)

---

## Task 1.12 — Environment & CI

### Environment Variables

**.env.local** (git-ignored):

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Database (Prisma)
DATABASE_URL=
DIRECT_URL=

# Firebase (FCM push notifications -- stub)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_VAPID_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEFAULT_LOCALE=en
```

**.env.example** (committed -- template with no secrets):

```
# Copy this to .env.local and fill in real values

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database (Prisma)
DATABASE_URL=postgresql://user:password@host:5432/db?pgbouncer=true
DIRECT_URL=postgresql://user:password@host:5432/db

# Firebase (FCM)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_VAPID_KEY=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEFAULT_LOCALE=en
```

### GitHub Actions CI

**.github/workflows/ci.yml**:

```yaml
name: CI

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [develop]

jobs:
  quality:
    name: Lint + Typecheck + Build
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Generate Prisma client
        run: npx prisma generate

      - name: Lint
        run: npm run lint

      - name: Typecheck
        run: npx tsc --noEmit

      - name: Format check
        run: npm run format:check

      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder
          NEXT_PUBLIC_APP_URL: http://localhost:3000
          NEXT_PUBLIC_DEFAULT_LOCALE: en
```

### Husky + lint-staged Updates

Ensure pre-commit hook runs on staged files:

```json
// package.json (lint-staged config)
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,css}": ["prettier --write"]
  }
}
```

### Acceptance Criteria

- [ ] `.env.example` committed with all variables (no real secrets)
- [ ] `.env.local` is git-ignored
- [ ] App starts without env-related errors when `.env.local` is properly configured
- [ ] Missing env vars throw clear error at startup (not silent failure)
- [ ] CI workflow runs on every PR to `main` and `develop`
- [ ] CI steps: install -> prisma generate -> lint -> typecheck -> format check -> build
- [ ] CI passes with placeholder env vars (no real Supabase needed)
- [ ] Pre-commit hook lints + formats staged files

---

## Task 1.13 — TypeScript Enum Types (Single Source of Truth)

All v3.0 enums as TypeScript types that match the database exactly.

### `src/types/enums.ts`

```typescript
// ===============================================
// This file is the TypeScript mirror of all v3.0 PostgreSQL enums.
// Keep in sync with prisma/schema.prisma.
// Reference: execution_plan/full_spec/enums-reference.md
// ===============================================

// 19.1 User Role
export const USER_ROLES = [
  "SUPER_ADMIN",
  "RWA_ADMIN_PRIMARY",
  "RWA_ADMIN_SUPPORTING",
  "RESIDENT_OWNER",
  "RESIDENT_OWNER_NRO",
  "RESIDENT_JOINT_OWNER",
  "RESIDENT_TENANT",
] as const;
export type UserRole = (typeof USER_ROLES)[number];

// 19.2 Resident Account Status (14 statuses)
export const RESIDENT_STATUSES = [
  "PENDING_APPROVAL",
  "ACTIVE_PAID",
  "ACTIVE_PENDING",
  "ACTIVE_OVERDUE",
  "ACTIVE_PARTIAL",
  "ACTIVE_EXEMPTED",
  "ACTIVE_LIFETIME",
  "REJECTED",
  "MIGRATED_PENDING",
  "MIGRATED_DORMANT",
  "TRANSFERRED_DEACTIVATED",
  "TENANT_DEPARTED",
  "SUSPENDED",
  "DECEASED",
  "BLACKLISTED",
] as const;
export type ResidentStatus = (typeof RESIDENT_STATUSES)[number];

// 19.3 Admin Term Status
export const ADMIN_TERM_STATUSES = [
  "ACTIVE",
  "EXPIRED",
  "EXTENDED",
  "VACATED",
  "ARCHIVED",
] as const;
export type AdminTermStatus = (typeof ADMIN_TERM_STATUSES)[number];

// 19.4 Fee Status (8 statuses)
export const FEE_STATUSES = [
  "NOT_YET_DUE",
  "PENDING",
  "OVERDUE",
  "PARTIAL",
  "PAID",
  "EXEMPTED",
  "ADVANCE_PAID",
  "LIFETIME",
] as const;
export type FeeStatus = (typeof FEE_STATUSES)[number];

// 19.5 Payment Entry Type
export const PAYMENT_ENTRY_TYPES = [
  "PAYMENT",
  "PARTIAL_PAYMENT",
  "CORRECTION",
  "REVERSAL",
  "REFUND",
  "WRITE_OFF",
  "EXEMPTION",
] as const;
export type PaymentEntryType = (typeof PAYMENT_ENTRY_TYPES)[number];

// 19.6 Payment Mode (5 modes)
export const PAYMENT_MODES = ["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "ONLINE"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];

// 19.7 Expense Category (11 categories)
export const EXPENSE_CATEGORIES = [
  "MAINTENANCE",
  "SECURITY",
  "CLEANING",
  "STAFF_SALARY",
  "INFRASTRUCTURE",
  "UTILITIES",
  "FESTIVAL",
  "EMERGENCY",
  "LEGAL",
  "ADMINISTRATIVE",
  "OTHER",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

// 19.8 Expense Entry Status
export const EXPENSE_STATUSES = ["ACTIVE", "REVERSED"] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

// 19.9 Festival Status
export const FESTIVAL_STATUSES = [
  "DRAFT",
  "COLLECTING",
  "CLOSED",
  "COMPLETED",
  "CANCELLED",
] as const;
export type FestivalStatus = (typeof FESTIVAL_STATUSES)[number];

// 19.10 Festival Surplus Disposal
export const SURPLUS_DISPOSALS = [
  "CARRY_FORWARD",
  "TRANSFER_TO_SOCIETY",
  "REFUND_CONTRIBUTORS",
] as const;
export type SurplusDisposal = (typeof SURPLUS_DISPOSALS)[number];

// 19.11 Notification Channel (4 channels)
export const NOTIFICATION_CHANNELS = ["WHATSAPP", "SMS", "PUSH", "EMAIL"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

// 19.12 Notification Delivery Status
export const NOTIFICATION_STATUSES = ["QUEUED", "SENT", "DELIVERED", "FAILED", "RETRYING"] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

// 19.13 Society Status
export const SOCIETY_STATUSES = ["TRIAL", "ACTIVE", "SUSPENDED", "OFFBOARDED"] as const;
export type SocietyStatus = (typeof SOCIETY_STATUSES)[number];

// 19.14 Subscription Plan
export const SUBSCRIPTION_PLANS = ["TRIAL", "BASIC", "STANDARD", "PREMIUM", "ENTERPRISE"] as const;
export type SubscriptionPlan = (typeof SUBSCRIPTION_PLANS)[number];

// 19.15 Ownership Type (4 types)
export const OWNERSHIP_TYPES = ["OWNER", "OWNER_NRO", "JOINT_OWNER", "TENANT"] as const;
export type OwnershipType = (typeof OWNERSHIP_TYPES)[number];

// 19.16 Transfer / Departure Type
export const TRANSFER_TYPES = [
  "OWNERSHIP_SALE",
  "TENANT_DEPARTURE",
  "BUILDER_FLOOR_PARTIAL",
  "INHERITANCE",
] as const;
export type TransferType = (typeof TRANSFER_TYPES)[number];

// 19.17 Society Type (5 types)
export const SOCIETY_TYPES = [
  "APARTMENT_COMPLEX",
  "BUILDER_FLOORS",
  "GATED_COMMUNITY_VILLAS",
  "INDEPENDENT_SECTOR_COLONY",
  "PLOTTED_COLONY",
] as const;
export type SocietyType = (typeof SOCIETY_TYPES)[number];

// 19.18 Registration Rejection Reason
export const REJECTION_REASONS = [
  "NOT_RESIDENT",
  "DUPLICATE_ENTRY",
  "INCORRECT_INFORMATION",
  "UNDER_VERIFICATION",
  "ADMIN_DISCRETION",
] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];

// Admin Position (6 positions)
export const ADMIN_POSITIONS = [
  "PRESIDENT",
  "VICE_PRESIDENT",
  "SECRETARY",
  "JOINT_SECRETARY",
  "TREASURER",
  "EXECUTIVE_MEMBER",
] as const;
export type AdminPosition = (typeof ADMIN_POSITIONS)[number];

// Admin Permission (5 levels)
export const ADMIN_PERMISSIONS = [
  "FULL_ACCESS",
  "FINANCIAL_WRITE",
  "READ_NOTIFY",
  "BROADCAST_ONLY",
  "CUSTOM",
] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

// Migration Row Status
export const MIGRATION_ROW_STATUSES = ["VALID", "ERROR", "SKIPPED", "IMPORTED"] as const;
export type MigrationRowStatus = (typeof MIGRATION_ROW_STATUSES)[number];

// Query Status
export const QUERY_STATUSES = [
  "OPEN",
  "RESPONDED",
  "ESCALATED",
  "UNDER_REVIEW",
  "RESOLVED",
] as const;
export type QueryStatus = (typeof QUERY_STATUSES)[number];
```

### Acceptance Criteria

- [ ] Every enum from `enums-reference.md` has a matching TypeScript type
- [ ] Array constants allow runtime iteration (for dropdowns, filters)
- [ ] Types are used throughout validations, components, and services
- [ ] No string literals in components -- always reference enum types

---

## Phase 1 Definition of Done

### Infrastructure

- [ ] All packages installed, `npm run build` passes with zero errors
- [ ] `npm run lint` passes, `npx tsc --noEmit` passes
- [ ] CI pipeline runs on every PR: lint -> typecheck -> format check -> build

### Database

- [ ] All 21+ tables created in Supabase with full v3.0 enums
- [ ] All enum types have correct values matching `enums-reference.md`
- [ ] RLS policies enabled on all society-scoped tables
- [ ] Seed data populated: 1 Super Admin, 1 society, 3 admins (3 positions), 7 residents (4 ownership types)
- [ ] `npx prisma studio` shows all tables and data

### Authentication

- [ ] Super Admin logs in with email + password + TOTP 2FA
- [ ] RWA Admin logs in with mobile OTP
- [ ] Resident logs in with mobile OTP, can set 4-digit PIN
- [ ] Resident returns and logs in with PIN (no OTP needed)
- [ ] 5 failed PIN attempts locks account for 30 minutes
- [ ] OTP rate limiting: max 3 per phone per hour

### Route Protection

- [ ] Middleware enforces role-based access on all routes
- [ ] Permission-based guards block unauthorized admin actions
- [ ] API routes return 401 for missing JWT, 403 for wrong role/permission
- [ ] Authenticated users redirected away from login pages

### Layouts & Navigation

- [ ] 3 portal layouts render correctly (Super Admin, Admin, Resident)
- [ ] Sidebar collapses to hamburger on mobile (Super Admin, Admin)
- [ ] Bottom nav renders on all resident pages
- [ ] Language toggle (EN/HI) visible and functional in all layouts
- [ ] Dark mode toggle works and persists across sessions
- [ ] Quick Actions FAB appears on mobile admin portal

### Design System

- [ ] Teal primary theme applied, dark mode fully supported
- [ ] StatusBadge renders all 14 resident statuses and 8 fee statuses correctly
- [ ] DataTable supports search, filter, sort, pagination
- [ ] EmptyState, LoadingSkeleton, StatCard all rendering
- [ ] AmountDisplay formats INR with Indian numbering (lakhs/crores)

### Validation

- [ ] Zod schemas defined for all entities (society, resident, fee, expense, festival, auth, notification)
- [ ] Schemas shared between client forms and server API routes
- [ ] TypeScript types inferred from schemas (no duplication)
- [ ] Conditional validation works (reference required for UPI, note required for admin discretion, etc.)

### Data Fetching

- [ ] TanStack Query provider wrapping app with DevTools
- [ ] Query key factory with type-safe keys for all entities
- [ ] 5-minute stale time, background refetch on navigation

### i18n

- [ ] English and Hindi translations for all UI strings
- [ ] Locale detection from browser preference
- [ ] Language toggle switches between EN and HI instantly
- [ ] Locale persisted in cookie, survives page refresh
- [ ] All status labels, nav items, form labels, error messages translated

### Error Handling

- [ ] Error boundaries at root and per-portal level
- [ ] 404 page with correct locale
- [ ] Loading skeletons on all data-fetching pages
- [ ] Toast notifications for success/error actions
- [ ] API errors return consistent JSON format

### Environment

- [ ] `.env.example` committed with all variables
- [ ] `.env.local` git-ignored
- [ ] Missing env vars throw clear error at startup
- [ ] GitHub Actions CI passes on PR

---

## File Dependency Graph

```
Task 1.1  Install deps ─────────────────────────────────────────────┐
                                                                     │
Task 1.2  Folder structure ──┬──────────────────────────────────────┤
                              │                                      │
Task 1.3  Database schema ───┤  (needs prisma from 1.1)             │
                              │                                      │
Task 1.4  Auth setup ────────┤  (needs supabase from 1.1 + db)     │
                              │                                      │
Task 1.5  Middleware ─────────┤  (needs auth from 1.4 + i18n)       │
                              │                                      │
Task 1.6  Layout shells ─────┤  (needs i18n from 1.10 + theme)     │
                              │                                      │
Task 1.7  Design system ─────┤  (needs shadcn from 1.1)            │
                              │                                      │
Task 1.8  Zod schemas ───────┤  (needs enums from 1.13)            │
                              │                                      │
Task 1.9  TanStack Query ────┤  (independent after 1.1)            │
                              │                                      │
Task 1.10 i18n setup ────────┤  (needs next-intl from 1.1)         │
                              │                                      │
Task 1.11 Error handling ────┤  (needs layouts from 1.6)            │
                              │                                      │
Task 1.12 Environment & CI ──┤  (independent)                      │
                              │                                      │
Task 1.13 TypeScript enums ──┘  (needs enums-reference.md)         │
                                                                     │
All tasks complete ──────────────────────────────────────────────────┘
```

### Recommended Build Order

1. **Task 1.1** (Install deps) -- unblocks everything
2. **Task 1.2** (Folder structure) -- creates skeleton
3. **Task 1.13** (TypeScript enums) -- needed by schemas and components
4. **Task 1.12** (Environment & CI) -- can run in parallel
5. **Task 1.3** (Database schema) -- needs Prisma from 1.1
6. **Task 1.10** (i18n setup) -- needs next-intl from 1.1
7. **Task 1.9** (TanStack Query) -- independent after 1.1
8. **Task 1.8** (Zod schemas) -- needs enums from 1.13
9. **Task 1.4** (Auth setup) -- needs Supabase + DB
10. **Task 1.7** (Design system) -- needs shadcn from 1.1
11. **Task 1.5** (Middleware) -- needs auth + i18n
12. **Task 1.6** (Layout shells) -- needs i18n + theme
13. **Task 1.11** (Error handling) -- needs layouts
