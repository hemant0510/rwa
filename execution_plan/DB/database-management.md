# Database Management Guide — RWA Connect

> Last updated: 2026-03-11

---

## Table of Contents

1. [Schema Changes & Migrations](#1-schema-changes--migrations)
2. [Database Backup Strategy](#2-database-backup-strategy)
3. [Fresh DB Setup / Initial Template](#3-fresh-db-setup--initial-template)
4. [Multi-Environment Schema Management](#4-multi-environment-schema-management)
5. [DB Deployment Pipeline with Supabase Free Tier](#5-db-deployment-pipeline-with-supabase-free-tier)
6. [Supabase Tips for Early-Stage Projects](#6-supabase-tips-for-early-stage-projects)

---

## 1. Schema Changes & Migrations

### How It Works Today

Currently the project uses **`prisma db push`** (defined as `npm run db:push`). This directly syncs the Prisma schema to the database without creating migration files. It's fast for early development but has no history of what changed.

### The Problem

- No record of schema changes over time
- No way to replay changes on a fresh database
- If two developers push different schemas, conflicts are silent
- Rolling back a change requires manually writing SQL

### Recommended Approach: Prisma Migrate

Switch from `db push` to `prisma migrate dev` once the schema stabilizes.

```
┌─────────────────────────────────────────────────────────┐
│  Developer changes prisma/dbinuse.prisma                │
│         ↓                                               │
│  npm run db:migrate                                     │
│         ↓                                               │
│  Prisma generates SQL in prisma/migrations/             │
│    └── 20260311_add_vehicle_table/migration.sql         │
│         ↓                                               │
│  SQL runs against local/dev database                    │
│         ↓                                               │
│  Migration file gets committed to git                   │
│         ↓                                               │
│  On deploy: prisma migrate deploy runs pending SQL      │
└─────────────────────────────────────────────────────────┘
```

**When to switch:** Once the MVP schema is stable and you start onboarding real data. Until then, `db push` is fine for rapid iteration.

### Practical Steps

```bash
# During active development (current approach)
npm run db:push          # Syncs schema → DB directly

# After schema stabilizes (recommended switch)
npm run db:migrate       # Creates migration SQL + applies it
npm run db:reset         # Resets DB + replays all migrations + seed
```

### Migration Files Auto-Push with Code

Yes — migration files live in `prisma/migrations/` and are committed to git. When you push code:

```
prisma/migrations/
  ├── 20260305_initial_schema/migration.sql
  ├── 20260311_add_vehicle_table/migration.sql
  └── migration_lock.toml
```

On deployment, run `prisma migrate deploy` (not `migrate dev`) to apply pending migrations without interactive prompts.

### Update Build Script for Production

```json
{
  "build": "prisma generate && prisma migrate deploy && next build"
}
```

---

## 2. Database Backup Strategy

### Prisma Schema ≠ Backup

The Prisma schema defines **structure** only. It does not backup **data**. Here's a complete backup strategy:

### Level 1: Schema Backup (Already Done)

| File                    | Purpose                                              |
| ----------------------- | ---------------------------------------------------- |
| `prisma/schema.prisma`  | Full schema with Phase 2+ stubs (frozen backup)      |
| `prisma/dbinuse.prisma` | Active schema used in development                    |
| `prisma/migrations/`    | Incremental SQL history (once you switch to migrate) |

### Level 2: Supabase Automatic Backups

Supabase provides **daily automatic backups** on the **Pro plan** ($25/month). On the **Free plan**, there are **no automatic backups**.

### Level 3: Manual Data Backups (Free Plan)

Since you're on the free plan, set up manual backup scripts:

```bash
# Add to package.json scripts:
"db:backup": "npx tsx prisma/backup.ts",
"db:backup:sql": "pg_dump $DIRECT_URL --no-owner --clean > backups/$(date +%Y%m%d_%H%M%S).sql"
```

**Option A — pg_dump (recommended for full backup):**

```bash
# Install PostgreSQL client tools locally, then:
pg_dump "postgresql://postgres.mqibhmreswyvaqqneeig:[PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres" \
  --no-owner --clean \
  > backups/rwa_backup_20260311.sql
```

**Option B — Supabase Dashboard:**

Go to **Project Settings → Database → Backups** and download manually.

**Option C — Prisma-based JSON export** (for specific tables):

Create `prisma/backup.ts` — see [Section 3](#3-fresh-db-setup--initial-template) for the template approach that can double as a backup tool.

### Backup Schedule Recommendation

| When                       | Action                                |
| -------------------------- | ------------------------------------- |
| Before every schema change | `pg_dump` to `backups/` folder        |
| Before production deploy   | Full `pg_dump`                        |
| Weekly during active dev   | Manual dashboard export               |
| After stable release       | Upgrade to Pro for daily auto-backups |

### Add to `.gitignore`

```
backups/*.sql
```

---

## 3. Fresh DB Setup / Initial Template

You need a script that sets up a clean database with only master data: SuperAdmin, platform plans, billing options, discounts, and designations — no society/resident data.

### File: `prisma/seed-master.ts`

This is your "fresh DB template" script. Run it after `prisma migrate reset` or on a new database.

```typescript
// prisma/seed-master.ts
// Sets up master/platform tables only — no society or resident data.
// Usage: npx tsx prisma/seed-master.ts

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Setting up master data...\n");

  // ─── 1. Super Admin ───────────────────────────────
  const superAdmin = await prisma.superAdmin.create({
    data: {
      authUserId: "00000000-0000-0000-0000-000000000000", // Update after Supabase Auth setup
      email: "admin@superadmin.com",
      name: "Super Admin",
      isActive: true,
    },
  });
  console.log("✓ Super Admin created:", superAdmin.email);

  // ─── 2. Platform Plans ────────────────────────────
  const plans = await Promise.all([
    prisma.platformPlan.create({
      data: {
        name: "Starter",
        slug: "starter",
        description: "For small societies getting started",
        planType: "FLAT_FEE",
        residentLimit: 50,
        featuresJson: {
          fee_management: true,
          expense_tracking: true,
          broadcasts: false,
          whatsapp: false,
          elections: false,
          ai_insights: false,
        },
        isActive: true,
        isPublic: true,
        displayOrder: 1,
        trialAccessLevel: true,
      },
    }),
    prisma.platformPlan.create({
      data: {
        name: "Growth",
        slug: "growth",
        description: "For growing societies with advanced needs",
        planType: "FLAT_FEE",
        residentLimit: 200,
        featuresJson: {
          fee_management: true,
          expense_tracking: true,
          broadcasts: true,
          whatsapp: true,
          elections: false,
          ai_insights: false,
        },
        isActive: true,
        isPublic: true,
        displayOrder: 2,
        badgeText: "Most Popular",
      },
    }),
    prisma.platformPlan.create({
      data: {
        name: "Pro",
        slug: "pro",
        description: "Full-featured for large societies",
        planType: "FLAT_FEE",
        residentLimit: 500,
        featuresJson: {
          fee_management: true,
          expense_tracking: true,
          broadcasts: true,
          whatsapp: true,
          elections: true,
          ai_insights: false,
        },
        isActive: true,
        isPublic: true,
        displayOrder: 3,
      },
    }),
    prisma.platformPlan.create({
      data: {
        name: "Enterprise",
        slug: "enterprise",
        description: "Unlimited scale with premium support",
        planType: "PER_UNIT",
        pricePerUnit: 10,
        featuresJson: {
          fee_management: true,
          expense_tracking: true,
          broadcasts: true,
          whatsapp: true,
          elections: true,
          ai_insights: true,
        },
        isActive: true,
        isPublic: true,
        displayOrder: 4,
        badgeText: "Best Value",
      },
    }),
  ]);
  console.log(`✓ ${plans.length} Platform Plans created`);

  // ─── 3. Billing Options (per plan × cycle) ────────
  const billingData = plans.flatMap((plan) => [
    { planId: plan.id, billingCycle: "MONTHLY" as const, price: getPrice(plan.slug, "MONTHLY") },
    { planId: plan.id, billingCycle: "ANNUAL" as const, price: getPrice(plan.slug, "ANNUAL") },
    { planId: plan.id, billingCycle: "TWO_YEAR" as const, price: getPrice(plan.slug, "TWO_YEAR") },
  ]);

  for (const opt of billingData) {
    await prisma.planBillingOption.create({ data: opt });
  }
  console.log(`✓ ${billingData.length} Billing Options created`);

  // ─── 4. Default Designations Template ─────────────
  // These are created per-society during onboarding, but we define defaults here
  console.log("✓ Designation templates: President, Vice President, Secretary, Treasurer");
  console.log("  (Created per-society during society onboarding)\n");

  console.log("Master data setup complete!");
  console.log("Next steps:");
  console.log("  1. Create a Supabase Auth user for the Super Admin");
  console.log("  2. Update superAdmin.authUserId with the real UUID");
  console.log("  3. Create a society via the onboarding flow or seed-dev.ts");
}

function getPrice(slug: string, cycle: string): number {
  const prices: Record<string, Record<string, number>> = {
    starter: { MONTHLY: 299, ANNUAL: 2999, TWO_YEAR: 4999 },
    growth: { MONTHLY: 799, ANNUAL: 7999, TWO_YEAR: 13999 },
    pro: { MONTHLY: 1499, ANNUAL: 14999, TWO_YEAR: 25999 },
    enterprise: { MONTHLY: 0, ANNUAL: 0, TWO_YEAR: 0 }, // PER_UNIT pricing
  };
  return prices[slug]?.[cycle] ?? 0;
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### Usage

```bash
# Fresh database setup (master data only)
npx tsx prisma/seed-master.ts

# Full dev setup with demo societies & residents
npx tsx prisma/seed.ts
```

### Add to `package.json`

```json
{
  "scripts": {
    "db:seed:master": "npx tsx prisma/seed-master.ts",
    "db:seed:dev": "npx tsx prisma/seed.ts"
  }
}
```

---

## 4. Multi-Environment Schema Management

### Three Schema Files Strategy

```
prisma/
  ├── schema.prisma        # FROZEN — Full schema with Phase 2+ stubs (backup)
  ├── dbinuse.prisma        # ACTIVE — Current development schema (25 tables)
  └── migrations/           # SQL migration history
```

### How Prisma Knows Which Schema to Use

Prisma 7 uses `prisma.config.ts` at the project root. The schema path is set there:

```typescript
// prisma.config.ts
export default defineConfig({
  schema: path.join(__dirname, "prisma", "dbinuse.prisma"),
  datasource: {
    url: process.env.DATABASE_URL!,
    directUrl: process.env.DIRECT_URL,
  },
});
```

All `prisma` CLI commands automatically read from this config — no `--schema` flags needed:

```json
{
  "scripts": {
    "db:push": "prisma db push",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:seed:master": "npx tsx prisma/seed-master.ts",
    "db:seed:dev": "npx tsx prisma/seed.ts",
    "build": "prisma generate && next build"
  }
}
```

### Do You Need Separate Dev/Prod Schema Files?

**No.** The schema should be the same across environments. What changes is the **database it connects to** (via `DATABASE_URL` in `.env`). The flow is:

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  dbinuse.prisma (ONE schema)                                     │
│       │                                                          │
│       ├── .env (local)      → DATABASE_URL = rwa-connect (dev)   │
│       ├── .env.production   → DATABASE_URL = rwa-connect-prod    │
│       │                                                          │
│  Same schema, different databases per environment                │
└──────────────────────────────────────────────────────────────────┘
```

If you ever need to test a schema change before prod, use **Supabase Branching** (Pro plan) or the **two-project approach** you already have.

---

## 5. DB Deployment Pipeline with Supabase Free Tier

### Your Current Setup

You have two Supabase projects (both free tier):

| Project                                   | Purpose     | Status |
| ----------------------------------------- | ----------- | ------ |
| `rwa-connect` (mqibhmreswyvaqqneeig)      | Development | ACTIVE |
| `rwa-connect-prod` (bdlwudfzjyeoahvsbfsw) | Production  | ACTIVE |

### Free Tier Limitations

- 2 free projects max per organization
- No automatic backups
- No Supabase Branching (Pro only)
- 500 MB database storage
- No point-in-time recovery

### Recommended Pipeline (Free Tier)

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  LOCAL DEV                                                      │
│    ↓ code + schema changes                                      │
│    ↓ npm run db:push (against rwa-connect dev)                  │
│    ↓ test features manually                                     │
│                                                                 │
│  GIT PUSH → develop branch                                      │
│    ↓ Vercel preview deploy (points to rwa-connect dev DB)       │
│    ↓ test on preview URL                                        │
│                                                                 │
│  MERGE → main branch                                            │
│    ↓ Vercel production deploy (points to rwa-connect-prod DB)   │
│    ↓ prisma migrate deploy runs pending migrations              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Environment Variables per Vercel Environment

```bash
# Vercel → Settings → Environment Variables

# Preview (develop branch)
DATABASE_URL         = postgresql://...rwa-connect-dev...
DIRECT_URL           = postgresql://...rwa-connect-dev...
NEXT_PUBLIC_SUPABASE_URL = https://mqibhmreswyvaqqneeig.supabase.co

# Production (main branch)
DATABASE_URL         = postgresql://...rwa-connect-prod...
DIRECT_URL           = postgresql://...rwa-connect-prod...
NEXT_PUBLIC_SUPABASE_URL = https://bdlwudfzjyeoahvsbfsw.supabase.co
```

### Schema Sync Scripts

Add helper scripts to sync schema to each environment:

```json
{
  "scripts": {
    "db:push:dev": "dotenv -e .env -- prisma db push --schema prisma/dbinuse.prisma",
    "db:push:prod": "dotenv -e .env.production -- prisma db push --schema prisma/dbinuse.prisma"
  }
}
```

### Pre-Deploy Checklist

```
Before deploying to production:
  [ ] Schema changes tested on rwa-connect (dev)
  [ ] Migration files committed (if using prisma migrate)
  [ ] pg_dump backup of rwa-connect-prod taken
  [ ] Merge develop → main
  [ ] Verify Vercel deploy succeeded
  [ ] Spot-check prod data integrity
```

---

## 6. Supabase Tips for Early-Stage Projects

### Must-Know Items

#### A. Enable Row Level Security (RLS)

All your tables currently have **RLS disabled**. This means anyone with the anon key can read/write all data via the Supabase client. Since you're using Prisma (server-side) for data access, this is okay for now, but:

```sql
-- Enable RLS on all tables (do this before going live)
ALTER TABLE societies ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ... etc for all tables

-- Then create policies for Supabase client access (if needed)
-- For Prisma-only access (service_role), RLS is bypassed
```

**Action:** Enable RLS before production launch, even if using Prisma only. It's a safety net.

#### B. Protect Your Service Role Key

The `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. Never expose it client-side:

- Use it only in API routes and server actions
- It's already in `.env` (server-side only) - good

#### C. Monitor Database Size

Free tier = 500 MB. Check usage:

```sql
SELECT pg_size_pretty(pg_database_size('postgres'));
```

Or in Supabase Dashboard → **Database → Database Size**.

#### D. Set Up Connection Pooling Correctly

Your `.env.example` already does this right:

| Variable       | Use                     | Port |
| -------------- | ----------------------- | ---- |
| `DATABASE_URL` | Prisma queries (pooled) | 6543 |
| `DIRECT_URL`   | Migrations (direct)     | 5432 |

In your Prisma schema, reference both:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

**Your current `dbinuse.prisma` is missing `directUrl`.** Add it.

#### E. Supabase Auth + Prisma User Table

Your architecture uses Supabase Auth for authentication and a separate Prisma `users` table for app data. The link is `authUserId`. This is the correct pattern. Keep them in sync:

- Create Supabase Auth user → get UUID
- Create Prisma user with that UUID as `authUserId`
- On delete: delete both (your permanent-delete route does this)

#### F. Useful Supabase SQL Queries

```sql
-- Check table sizes
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;

-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Check slow queries
SELECT query, calls, mean_exec_time, total_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

-- List all indexes
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public';
```

#### G. Free Tier Gotchas

| Issue                                  | Impact                                  | Mitigation                                   |
| -------------------------------------- | --------------------------------------- | -------------------------------------------- |
| Project pauses after 1 week inactivity | DB goes offline, takes ~1 min to resume | Visit dashboard weekly or set up a cron ping |
| No automatic backups                   | Data loss risk                          | Manual `pg_dump` before deploys              |
| 500 MB storage limit                   | Will hit it with file uploads           | Use Supabase Storage for files, not DB       |
| 2 projects max per org                 | Can't create a staging environment      | Use the 2 you have (dev + prod) wisely       |
| Rate limits on Auth                    | 4 emails/hour (free)                    | Use custom SMTP (you already have it)        |

#### H. Prevent Project Pausing

Free projects pause after 7 days of inactivity. Add a health check:

```typescript
// src/app/api/health/route.ts (already may exist)
// Vercel cron or external service hits this every few days
export async function GET() {
  const { prisma } = await import("@/lib/prisma");
  const count = await prisma.society.count();
  return Response.json({ status: "ok", societies: count });
}
```

Set up a free cron service (cron-job.org or Vercel Cron) to hit this endpoint every 5 days.

---

## Quick Reference: All DB Scripts

All commands auto-read `prisma/dbinuse.prisma` via `prisma.config.ts`.

```json
{
  "scripts": {
    "db:push": "prisma db push",
    "db:pull": "prisma db pull",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate dev",
    "db:migrate:deploy": "prisma migrate deploy",
    "db:reset": "prisma migrate reset",
    "db:studio": "prisma studio",
    "db:seed": "prisma db seed",
    "db:seed:master": "npx tsx prisma/seed-master.ts",
    "db:seed:dev": "npx tsx prisma/seed.ts",
    "build": "prisma generate && next build"
  }
}
```

---

## Immediate Action Items

1. ~~**Update `prisma.config.ts`** to point to `dbinuse.prisma`~~ DONE
2. ~~**Update `package.json`** with new db scripts~~ DONE
3. ~~**Create `prisma/seed-master.ts`** for fresh DB setup~~ DONE
4. **Take a `pg_dump` backup** of both databases now
5. **Enable RLS** on all tables before production launch
6. **Set up Vercel environment variables** to separate dev/prod DB connections
