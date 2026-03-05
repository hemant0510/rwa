# MVP Phase 0 — Foundation & Setup

**Duration**: ~1.5 weeks
**Goal**: Rock-solid foundation — database live, auth working, layouts rendered, design system ready.

---

## Task 0.1 — Install Dependencies

Install all MVP-required packages in a single setup.

```bash
# UI Components (shadcn/ui)
npx shadcn@latest init
npx shadcn@latest add button card input label badge avatar dialog sheet
npx shadcn@latest add select checkbox radio-group switch tabs toast alert form
npx shadcn@latest add dropdown-menu command skeleton separator scroll-area
npx shadcn@latest add table pagination popover tooltip progress

# Database & Auth
npm install prisma @prisma/client
npm install @supabase/supabase-js @supabase/ssr

# State & Data Fetching
npm install @tanstack/react-query @tanstack/react-table

# Forms & Validation
npm install react-hook-form @hookform/resolvers zod

# PDF (QR poster removed in v2 — keep @react-pdf/renderer for receipts/reports)
npm install @react-pdf/renderer

# Utilities
npm install date-fns clsx tailwind-merge lucide-react

# Dev
npm install -D vitest @vitejs/plugin-react prisma
```

**Files to create**:

- `src/lib/utils.ts` — `cn()` helper (clsx + tailwind-merge)
- `src/lib/constants.ts` — App-wide constants (default fees, grace period days, etc.)

**Acceptance**: `npm run build` passes. No type errors. All packages resolve.

---

## Task 0.2 — Project Folder Structure

Create the MVP directory structure per `.claude/core_rules.md`.

```
src/
├── app/
│   ├── (auth)/                      # Auth pages
│   │   ├── login/page.tsx           # Email+password login (Admin + Resident)
│   │   ├── super-admin-login/page.tsx # Email+password (hidden, Super Admin only)
│   │   └── layout.tsx
│   ├── (super-admin)/               # Super Admin portal
│   │   ├── dashboard/page.tsx
│   │   ├── societies/page.tsx
│   │   ├── societies/new/page.tsx
│   │   ├── societies/[id]/page.tsx
│   │   └── layout.tsx
│   ├── (admin)/                     # RWA Admin portal
│   │   ├── dashboard/page.tsx
│   │   ├── residents/page.tsx
│   │   ├── residents/[id]/page.tsx
│   │   ├── fees/page.tsx
│   │   ├── expenses/page.tsx
│   │   ├── reports/page.tsx
│   │   ├── broadcast/page.tsx
│   │   ├── migration/page.tsx
│   │   └── layout.tsx
│   ├── (resident)/                  # Resident portal (PWA)
│   │   ├── home/page.tsx
│   │   ├── payments/page.tsx
│   │   ├── expenses/page.tsx
│   │   ├── profile/page.tsx
│   │   └── layout.tsx
│   ├── register/                    # Invite-link registration
│   │   └── [inviteToken]/page.tsx   # Invite-link based (no Society Code Path B)
│   ├── api/v1/                      # REST API routes
│   │   ├── auth/
│   │   ├── societies/
│   │   ├── residents/
│   │   ├── fees/
│   │   ├── expenses/
│   │   ├── notifications/
│   │   └── webhooks/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                     # Landing/marketing page
├── components/
│   ├── ui/                          # shadcn/ui components
│   ├── features/                    # Feature components
│   │   ├── auth/
│   │   ├── society/
│   │   ├── resident/
│   │   ├── fees/
│   │   ├── expenses/
│   │   └── notifications/
│   └── layout/                      # Layout shells
│       ├── SuperAdminSidebar.tsx
│       ├── AdminSidebar.tsx
│       ├── ResidentBottomNav.tsx
│       └── Header.tsx
├── hooks/
│   ├── useAuth.ts
│   └── useSociety.ts
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── middleware.ts
│   ├── prisma.ts
│   ├── utils.ts
│   ├── constants.ts
│   └── validations/
│       ├── society.ts
│       ├── resident.ts
│       ├── fee.ts
│       └── expense.ts
├── providers/
│   ├── QueryProvider.tsx
│   └── AuthProvider.tsx
├── types/
│   ├── society.ts
│   ├── user.ts
│   └── fee.ts
└── services/
    ├── societies.ts
    ├── residents.ts
    ├── fees.ts
    └── notifications.ts
```

**Acceptance**: All directories created. Placeholder files compile. Imports resolve.

---

## Task 0.3 — Database Schema (Full Schema, MVP-Adjusted)

Use the complete schema from `execution_plan/database-design.md` with these MVP adjustments:

**Changes to `societies` table**:

```sql
-- Add configurable fee columns (MVP: per-society fees)
ALTER TABLE societies ADD COLUMN joining_fee DECIMAL(10,2) NOT NULL DEFAULT 1000;
ALTER TABLE societies ADD COLUMN annual_fee DECIMAL(10,2) NOT NULL DEFAULT 1200;
ALTER TABLE societies ADD COLUMN fee_session_start_month INTEGER NOT NULL DEFAULT 4; -- April
```

**Society Code behavior change**:

- `society_code` is admin-chosen (4-8 alphanumeric, unique)
- NOT auto-generated from society name
- Real-time uniqueness check via API during society creation

**5 Society Types enum**:

```sql
CREATE TYPE society_type AS ENUM (
  'APARTMENT_COMPLEX',
  'BUILDER_FLOORS',
  'GATED_COMMUNITY_VILLAS',
  'INDEPENDENT_SECTOR',
  'PLOTTED_COLONY'
);
```

**Dynamic unit address fields per type**:

```sql
-- Units table stores flexible addressing
CREATE TABLE units (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  society_id      UUID NOT NULL REFERENCES societies(id),
  -- Common fields
  display_label   VARCHAR(50) NOT NULL,
  -- Apartment Complex fields
  tower_block     VARCHAR(20),
  floor_no        VARCHAR(10),
  flat_no         VARCHAR(20),
  -- Builder Floor fields
  house_no        VARCHAR(20),
  floor_level     VARCHAR(10),      -- GF, 1F, 2F, 3F, Terrace
  -- Gated Community fields
  villa_no        VARCHAR(20),
  street_phase    VARCHAR(30),
  -- Independent Sector fields
  sector_block    VARCHAR(20),
  street_gali     VARCHAR(20),
  -- Plotted Colony fields
  plot_no         VARCHAR(20),
  lane_no         VARCHAR(20),
  phase           VARCHAR(20),
  -- Metadata
  primary_owner_id UUID REFERENCES users(id),
  current_tenant_id UUID REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Admin roles (MVP: 2 levels only)**:

```sql
-- Simplified for MVP
CREATE TYPE admin_permission AS ENUM ('FULL_ACCESS', 'READ_NOTIFY');
-- FULL_ACCESS = Primary Admin (everything)
-- READ_NOTIFY = Supporting Admin (view all, send broadcasts only)
```

**Steps**:

1. `npx prisma init`
2. Configure `DATABASE_URL` in `.env.local` (Supabase PostgreSQL)
3. Write full `schema.prisma` (all 22 tables including Phase 2 stubs)
4. `npx prisma migrate dev --name init`
5. Create `prisma/seed.ts`:
   - 1 Super Admin in `super_admins` table (email: admin@rwaconnect.in)
   - 1 society (Eden Estate, type: INDEPENDENT_SECTOR, joining_fee: 1000, annual_fee: 1200)
   - 5 demo residents in `users` table (3 owners, 2 tenants, mixed fee statuses, all with email)
6. `npx prisma db seed`

**Acceptance**: All tables visible in Prisma Studio. Seed data populated. Phase 2 stub tables exist (empty).

---

## Task 0.4 — Authentication Setup

**MVP v2 change**: Auth is now **email/password for ALL users**. No OTP, no mobile login, no PIN.

- Super Admin is in a **separate `super_admins` table** (not in `users`).
- Single `/login` page for Admin + Resident (email/password).
- Hidden `/super-admin-login` for Super Admin (email/password).
- Mobile number is **optional** on User (kept for WhatsApp notifications only).

**2 auth flows** (simplified from v1):

| Role        | Auth Method      | Login Page           | Session                |
| ----------- | ---------------- | -------------------- | ---------------------- |
| Super Admin | Email + Password | `/super-admin-login` | 8h inactivity timeout  |
| RWA Admin   | Email + Password | `/login`             | 8h inactivity timeout  |
| Resident    | Email + Password | `/login`             | 30 days trusted device |

**Implementation with Supabase Auth**:

1. **Super Admin login** (`/super-admin-login`):
   - Email + password form (hidden page, not linked from main UI)
   - Supabase `signInWithPassword()`
   - On success: check `super_admins` table for matching `auth_user_id`
   - Redirect to `/super-admin/dashboard`

2. **Admin + Resident login** (`/login`):
   - Email + password form
   - Supabase `signInWithPassword()`
   - On verify: check `users` table for role → redirect to correct portal
   - RWA_ADMIN → `/admin/dashboard`
   - RESIDENT → `/resident/home`

**Auth API Endpoints**:

| Method | Endpoint                         | Purpose                                        |
| ------ | -------------------------------- | ---------------------------------------------- |
| `POST` | `/api/v1/auth/super-admin/login` | Email + password login → returns session       |
| `POST` | `/api/v1/auth/login`             | Email + password login (Admin + Resident)      |
| `POST` | `/api/v1/auth/register`          | Create account (invite-link registration flow) |
| `POST` | `/api/v1/auth/forgot-password`   | Send password reset email                      |
| `POST` | `/api/v1/auth/reset-password`    | Reset password with token                      |
| `POST` | `/api/v1/auth/logout`            | Destroy session                                |

**Session Timeout Mechanism**:

| Role        | Timeout                | Mechanism                                                                                                                                                                                                                                                |
| ----------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Super Admin | 8h inactivity          | Server-side: Supabase session with custom `idle_timeout`. Client-side: activity tracker resets on mouse/keyboard/touch events. After 7h 45m idle, show "Session expiring" toast. At 8h, call `/api/v1/auth/logout` and redirect to `/super-admin-login`. |
| RWA Admin   | 8h inactivity          | Same mechanism as Super Admin. Redirect to `/login`.                                                                                                                                                                                                     |
| Resident    | 30 days trusted device | Supabase refresh token with 30-day expiry.                                                                                                                                                                                                               |

**Implementation**: Track last activity timestamp in `sessionStorage`. A `useIdleTimeout` hook checks every 60 seconds and triggers logout when exceeded. The hook resets on `mousedown`, `keydown`, `touchstart`, and `scroll` events.

**Auth helpers** (`src/lib/supabase/`):

```typescript
// client.ts — Browser client
// server.ts — Server component client
// middleware.ts — Auth checking helpers

export function getSession(): Promise<Session | null>;
export function getCurrentUser(): Promise<UserWithRole | null>;
export function requireAuth(role: UserRole): Promise<UserWithRole>;
export function requireSuperAdmin(): Promise<SuperAdmin>;
export function requireSociety(societyId: string): Promise<void>;
```

**Acceptance**: Both login flows work (super admin + admin/resident). Sessions persist correctly. Idle timeout triggers logout after 8h for admins. Password reset flow works.

---

## Task 0.5 — Middleware & Route Protection

**File**: `src/middleware.ts`

| Route Pattern                  | Access                          | Redirect                   |
| ------------------------------ | ------------------------------- | -------------------------- |
| `/`                            | Public                          | —                          |
| `/login`, `/super-admin-login` | Unauthenticated only            | → portal home if logged in |
| `/register/*`                  | Public (invite-link)            | —                          |
| `/super-admin/*`               | Super Admin only (super_admins) | → `/super-admin-login`     |
| `/admin/*`                     | RWA_ADMIN only                  | → `/login`                 |
| `/resident/*`                  | RESIDENT only                   | → `/login`                 |
| `/api/v1/*`                    | JWT required                    | 401                        |

**Permission Matrix (FULL_ACCESS vs READ_NOTIFY)**:

The MVP has exactly 2 admin permission levels. This matrix defines what each can do:

| Feature / Action                             | FULL_ACCESS (Primary) | READ_NOTIFY (Supporting) |
| -------------------------------------------- | --------------------- | ------------------------ |
| **Dashboard** — View stats                   | ✅                    | ✅                       |
| **Residents** — View list & details          | ✅                    | ✅                       |
| **Residents** — Approve/reject registrations | ✅                    | ❌                       |
| **Residents** — Deactivate resident          | ✅                    | ❌                       |
| **Fees** — View fee dashboard & tracker      | ✅                    | ✅                       |
| **Fees** — Record payment                    | ✅                    | ❌                       |
| **Fees** — Grant exemption                   | ✅                    | ❌                       |
| **Fees** — Correct/reverse payment           | ✅                    | ❌                       |
| **Expenses** — View expense ledger           | ✅                    | ✅                       |
| **Expenses** — Add/edit/reverse expense      | ✅                    | ❌                       |
| **Reports** — View & download reports        | ✅                    | ✅                       |
| **Broadcast** — Send WhatsApp broadcast      | ✅                    | ✅                       |
| **Migration** — Upload & import Excel        | ✅                    | ❌                       |
| **Settings** — Edit society details/fees     | ✅                    | ❌                       |

**Implementation**: Middleware helper `requirePermission('FULL_ACCESS')` on write-action API routes. UI hides action buttons for READ_NOTIFY admins using `useAuth().permission` check. Server always validates — never rely on UI-only hiding.

**Acceptance**: Unauthorized access redirects. Role mismatch shows 403. READ_NOTIFY admin sees all data but write actions are hidden and server-blocked.

---

## Task 0.6 — Layout Shells

**3 layouts** matching the 3 portals:

### Super Admin Layout

- Fixed sidebar (280px): Dashboard, Societies, Settings
- Header: "RWA Connect Admin" + user menu
- Sidebar collapses to hamburger on mobile

### RWA Admin Layout

- Collapsible sidebar (240px): Dashboard, Residents, Fees, Expenses, Reports, Broadcast, Migration
- Header: Society name + Quick Actions (Record Payment, Add Expense) + user menu
- Quick Action floating bar on mobile

### Resident Layout

- Bottom tab bar (4 tabs): Home, Payments, Expenses, Profile
- Header: Society name + status indicator
- Mobile-first (360px min)

**Components to build**:

- `SuperAdminSidebar.tsx`
- `AdminSidebar.tsx`
- `ResidentBottomNav.tsx`
- `Header.tsx` (shared, configurable)

**Acceptance**: All 3 layouts render. Sidebar collapses on mobile. Bottom nav on resident.

---

## Task 0.7 — Design System & Theme

Configure shadcn/ui with RWA Connect tokens (from `execution_plan/ui-design-system.md`):

1. Update `globals.css` with design tokens (teal primary, semantic colors)
2. Install all shadcn components listed in Task 0.1
3. Create reusable composed components:
   - `StatusBadge` — Paid/Pending/Overdue/Partial/Exempted badges with correct colors
   - `PageHeader` — Title + description + action buttons
   - `DataTable` — TanStack Table wrapper (sort, filter, paginate)
   - `EmptyState` — Illustration + message + CTA
   - `LoadingSkeleton` — Page/table/card skeleton variants
4. Set up dark mode toggle (CSS variables + localStorage)

**Acceptance**: All components render in light/dark mode. Status badges correct. Theme consistent.

---

## Task 0.8 — Validation Schemas (Zod)

Shared between forms and API routes.

**`src/lib/validations/society.ts`**:

```typescript
export const createSocietySchema = z.object({
  name: z.string().min(3).max(200),
  state: z.string().length(2), // ISO state code
  city: z.string().min(2).max(50),
  pincode: z.string().regex(/^\d{6}$/),
  type: z.enum([
    "APARTMENT_COMPLEX",
    "BUILDER_FLOORS",
    "GATED_COMMUNITY_VILLAS",
    "INDEPENDENT_SECTOR",
    "PLOTTED_COLONY",
  ]),
  societyCode: z
    .string()
    .min(4)
    .max(8)
    .regex(/^[A-Z0-9]+$/),
  joiningFee: z.number().min(0).max(100000),
  annualFee: z.number().min(0).max(100000),
  adminName: z.string().min(2).max(100),
  adminEmail: z.string().email(),
  adminMobile: z
    .string()
    .regex(/^[6-9]\d{9}$/)
    .optional(), // Optional in v2
});
```

**`src/lib/validations/resident.ts`**:

```typescript
export const registerResidentSchema = z.object({
  fullName: z.string().min(2).max(100),
  email: z.string().email(), // REQUIRED in v2 (used for login)
  password: z.string().min(8).max(100), // REQUIRED in v2 (email/password auth)
  mobile: z
    .string()
    .regex(/^[6-9]\d{9}$/)
    .optional(), // OPTIONAL in v2 (for WhatsApp only)
  // Unit fields are dynamic based on society type — validated server-side
  ownershipType: z.enum(["OWNER", "TENANT"]),
  consentWhatsApp: z.boolean().optional(), // Optional since mobile is optional
});
```

**Also create**: `fee.ts`, `expense.ts`, `auth.ts`

**Acceptance**: Schemas validate correctly. Types inferred from schemas. Shared between client and server.

---

## Task 0.9 — TanStack Query Provider

```typescript
// src/providers/QueryProvider.tsx
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 2 },
  },
});
```

**Query key factory**:

```typescript
export const queryKeys = {
  societies: { all: ["societies"], detail: (id: string) => ["societies", id] },
  residents: { byStatus: (sid: string, status: string) => ["residents", sid, status] },
  fees: { session: (sid: string, year: string) => ["fees", sid, year] },
  expenses: { list: (sid: string) => ["expenses", sid] },
};
```

**Acceptance**: Queries cache. Background refetch works. Loading/error states handled.

---

## Task 0.10 — Error Handling & Loading States

- `src/app/error.tsx` — Root error boundary
- `src/app/not-found.tsx` — 404 page
- `src/app/(super-admin)/error.tsx`
- `src/app/(admin)/error.tsx`
- `src/app/(resident)/error.tsx`
- `loading.tsx` files in each route group (skeleton screens)

**Acceptance**: Errors caught with retry button. 404 shows helpful message. Skeletons display during load.

---

## Task 0.11 — Environment & CI

**.env.local** (git-ignored):

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=
DIRECT_URL=
```

**.env.example** — Template with all variables (no secrets).

**`.github/workflows/ci.yml`**:

```yaml
on: [pull_request]
jobs:
  quality:
    steps:
      - npm ci
      - npm run lint
      - npx tsc --noEmit
      - npm run build
```

**Acceptance**: App starts without env errors. CI runs on PR.

---

## Phase 0 Definition of Done

- [ ] All packages installed, `npm run build` passes
- [ ] All DB tables created (including new `super_admins`, `vehicles`), seed data populated
- [ ] Super Admin logs in with email + password at `/super-admin-login`
- [ ] Admin logs in with email + password at `/login`
- [ ] Resident logs in with email + password at `/login`
- [ ] Super Admin is in separate `super_admins` table (not in `users`)
- [ ] Route guards enforce role-based access (super admin checked against `super_admins` table)
- [ ] 3 layout shells render correctly (sidebar + bottom nav)
- [ ] Design system: StatusBadge, DataTable, EmptyState, Skeleton all working
- [ ] Zod schemas defined for all entities
- [ ] Error boundaries and loading states in place
- [ ] CI pipeline runs lint + typecheck + build
