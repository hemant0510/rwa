# RWA Connect

A multi-tenant SaaS platform for **Resident Welfare Associations (RWAs)** to manage societies, residents, billing, communication, and day-to-day operations — all from a single dashboard.

Any housing society, apartment complex, or gated community can onboard, subscribe to a plan, and run their association end-to-end.

---

## What this project does

RWA Connect is an operational backbone for residential communities. It replaces spreadsheets, WhatsApp chaos, and manual registers with a structured system that covers:

### Platform (SuperAdmin)

- Onboard new societies and assign subscription plans
- Configure platform-wide master data (plans, billing options, feature flags)
- Global visibility across every society, resident, ticket, and payment
- "View Dashboard As" impersonation for support

### Society Administration (RWA Admin)

- **Resident management** — household registry, family members, tenants, move-in / move-out
- **Billing & payments** — maintenance fees, UPI collection, payment reconciliation, receipts, defaulter tracking
- **Support tickets** — resident-raised complaints with assignment, status, and SLAs
- **Communication** — announcements, notices, WhatsApp integration via WATI
- **Documents** — shared bylaws, minutes, circulars with signed-URL access control
- **Reports & exports** — CSV / Excel / PDF export across every module

### Resident Experience

- Self-service portal — view dues, pay online, raise tickets, book amenities
- Household registry — manage family members and vehicle details
- Announcements and notices
- Progressive Web App (installable, offline-aware)

### Cross-cutting

- Row-level security (RLS) in Supabase — a society can only ever see its own data
- Role-based access — `SUPER_ADMIN`, `RWA_ADMIN`, `RESIDENT`, plus granular sub-roles
- Audit logging on every mutating action

---

## Tech Stack

| Layer         | Choice                                                        |
| ------------- | ------------------------------------------------------------- |
| Framework     | Next.js 16 (App Router), React 19, TypeScript (strict)        |
| Styling       | Tailwind CSS v4, shadcn/ui, Radix UI primitives               |
| Data          | Prisma 7 ORM + `@prisma/adapter-pg`                           |
| Database      | Supabase (Postgres + Auth + Storage + RLS)                    |
| State         | TanStack Query (React Query) + React Hook Form + Zod          |
| PWA           | Serwist (service worker, offline support, installable)        |
| Observability | Sentry (errors + performance)                                 |
| Email / Msg   | Nodemailer (SMTP), WATI (WhatsApp)                            |
| PDF / Export  | `@react-pdf/renderer`, `pdf-lib`, `xlsx`, `papaparse`         |
| Testing       | Vitest + Testing Library (unit/integration), Playwright (e2e) |
| Deployment    | Docker → Azure Container Apps (see `deployment/`)             |
| Image host    | GitHub Container Registry (GHCR)                              |
| CI/CD         | GitHub Actions — 3 environments (dev / stage / prod)          |

---

## Quick Start

```bash
npm install           # Install dependencies (Node >= 22)
cp .env.example .env  # Configure environment variables
npm run db:generate   # Generate Prisma client
npm run dev           # http://localhost:3000
```

### Seeding

```bash
npm run db:seed:master   # Platform master data — SuperAdmin, plans, billing options (idempotent)
npm run db:seed:dev      # Demo society + residents + fees (dev-only, manually triggered)
```

---

## Commands

### Dev & Build

| Command         | Description                                          |
| --------------- | ---------------------------------------------------- |
| `npm run dev`   | Start dev server                                     |
| `npm run build` | Production build (`prisma generate` + Next.js build) |
| `npm start`     | Start production server                              |

### Code Quality

| Command                | Description                                    |
| ---------------------- | ---------------------------------------------- |
| `npm run lint`         | ESLint                                         |
| `npm run lint:fix`     | Auto-fix lint issues                           |
| `npm run format`       | Prettier (write)                               |
| `npm run format:check` | Prettier (check only)                          |
| `npm run check`        | Full check: `tsc --noEmit` + ESLint + Prettier |

### Tests

| Command                 | Description                                  |
| ----------------------- | -------------------------------------------- |
| `npm test`              | Vitest run (95% per-file coverage required)  |
| `npm run test:watch`    | Vitest watch mode                            |
| `npm run test:coverage` | Vitest with V8 coverage report               |
| `npm run test:staged`   | Targeted tests for staged files (pre-commit) |
| `npm run test:e2e`      | Playwright e2e                               |
| `npm run test:e2e:ui`   | Playwright UI mode                           |

### Database

Schema lives in [`supabase/schema.prisma`](supabase/schema.prisma). All Prisma commands pass `--schema supabase/schema.prisma`.

| Command                     | Description                                        |
| --------------------------- | -------------------------------------------------- |
| `npm run db:generate`       | Regenerate Prisma client                           |
| `npm run db:studio`         | Open Prisma Studio                                 |
| `npm run db:push`           | Sync schema → DB (dev only)                        |
| `npm run db:pull`           | Pull remote DB schema → local                      |
| `npm run db:migrate`        | Create a new tracked migration (dev)               |
| `npm run db:migrate:deploy` | Apply migrations (CI / production)                 |
| `npm run db:reset`          | Reset DB, re-run migrations + seed                 |
| `npm run db:seed:master`    | Seed platform master data (upsert, safe to re-run) |
| `npm run db:seed:dev`       | Seed full demo data                                |

> ⚠️ Schema changes must use the **direct** Postgres connection (port 5432), not the pooler (6543) — the pooler times out on DDL. See [CLAUDE.md](CLAUDE.md) and [.claude/memory/](./.claude/memory/).

---

## Project Structure

```
src/
├── app/                # Next.js App Router — pages, layouts, API routes
│   ├── (auth)/         # Sign-in / sign-up flows
│   ├── admin/          # RWA Admin dashboard
│   ├── resident/       # Resident self-service portal
│   ├── super-admin/    # Platform SuperAdmin console
│   └── api/            # Route handlers
├── components/
│   ├── ui/             # shadcn/ui primitives
│   └── features/       # Composed feature components
├── hooks/              # Custom React hooks
├── lib/                # Prisma client, Supabase helpers, validations, utils
├── services/           # Client-side fetch wrappers
└── types/              # Shared TypeScript types

supabase/
├── schema.prisma       # Prisma schema
├── migrations/         # SQL migrations (DDL, RLS, triggers)
├── seed-master.ts      # Master data seed (SuperAdmin + plans)
└── seed.ts             # Demo data seed

tests/                  # Vitest — mirrors src/ structure, __mocks__/ for Prisma + Supabase
deployment/             # Docker + Azure Container Apps pipeline, runbooks
execution_plan/         # Feature build plans and architecture notes
external_docs/          # Product spec documents
.github/workflows/      # CI/CD — deploy-dev, promote-to-stage, promote-to-prod, seed-master
```

---

## Environment Variables

Copy `.env.example` → `.env` and populate:

| Variable                                                        | Purpose                             |
| --------------------------------------------------------------- | ----------------------------------- |
| `DATABASE_URL`                                                  | Postgres pooler URL (app runtime)   |
| `DIRECT_URL`                                                    | Postgres direct URL (migrations)    |
| `NEXT_PUBLIC_SUPABASE_URL`                                      | Supabase project URL                |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                                 | Supabase anon key (client-safe)     |
| `SUPABASE_SERVICE_ROLE_KEY`                                     | Supabase service role (server only) |
| `NEXT_PUBLIC_APP_URL`                                           | Public app URL                      |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` | Email delivery                      |
| `WATI_API_URL`, `WATI_API_KEY`                                  | WhatsApp (WATI) integration         |
| `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_*`                            | Error tracking                      |
| `TRIAL_PERIOD_DAYS`, `MAX_TRIAL_RESIDENTS`                      | Trial plan limits                   |

---

## Deployment

Production uses a three-environment pipeline on **Azure Container Apps**, with images hosted on **GHCR**.

| Env   | Branch    | Trigger                           | DB                                |
| ----- | --------- | --------------------------------- | --------------------------------- |
| dev   | `develop` | Auto on push                      | `rwa-connect` (shared with stage) |
| stage | `staging` | Manual `workflow_dispatch` + gate | `rwa-connect` (shared with dev)   |
| prod  | `main`    | Manual `workflow_dispatch` + gate | `rwa-connect-prod` (isolated)     |

**Build once, promote the artifact** — the image built for dev is retagged through stage to prod, so what you approve in stage is byte-identical to what runs in prod.

Full deployment plan, runbooks, and infra setup scripts live in [`deployment/`](deployment/):

- [`deployment/plan.md`](deployment/plan.md) — architecture, phases, decisions
- [`deployment/runbooks/rollback.md`](deployment/runbooks/rollback.md) — two rollback paths
- [`deployment/runbooks/observability.md`](deployment/runbooks/observability.md) — where to look when X
- [`deployment/runbooks/db-migrations.md`](deployment/runbooks/db-migrations.md) — migration checklist
- [`deployment/runbooks/troubleshooting.md`](deployment/runbooks/troubleshooting.md) — common failure modes

### Where to see Docker images

GHCR: GitHub → this repo → **Packages** tab → `rwa` — shows every tag (`dev-<sha>`, `stage-<sha>`, `prod-<sha>`).

### Promote to stage / prod

GitHub → **Actions** → **"Promote to stage"** / **"Promote to prod"** → **Run workflow** → approve the environment gate.

---

## Testing & Coverage

- **Framework**: Vitest (unit/integration) + Playwright (e2e)
- **Threshold**: 95% per-file (lines / branches / functions / statements) — enforced by the pre-commit hook
- **Mocks**: shared mocks in `tests/__mocks__/` — import, never recreate inline
- **Pre-commit hook**: `scripts/test-staged.mjs` runs `vitest related` + coverage on staged files only

To simulate what the pre-commit hook runs:

```bash
npx vitest related <file1.ts> <file2.ts> --run \
  --coverage --coverage.provider=v8 --coverage.reporter=text \
  --coverage.thresholds.perFile=true \
  --coverage.thresholds.lines=95 --coverage.thresholds.branches=95 \
  --coverage.thresholds.functions=95 --coverage.thresholds.statements=95
```

---

## Documentation

- [CLAUDE.md](CLAUDE.md) — coding standards, super-admin rules, testing rules
- [.claude/core_rules.md](.claude/core_rules.md) — component / TS / DB / security standards
- [execution_plan/](execution_plan/) — feature build plans and architecture notes
- [external_docs/](external_docs/) — product spec (MVP and full vision)
- [deployment/](deployment/) — Azure deployment pipeline and runbooks

---

## License

Proprietary — all rights reserved.
