---
name: db-change
description: Safe schema migration sequence for Prisma + Supabase. Use when editing schema.prisma or adding a database migration. Ensures direct connection (not pooler) and updates mocks.
---

# Safe Schema Migration

**Invocation**: `/db-change` whenever editing the Prisma schema or adding a migration.

---

## Steps

```bash
# FORBIDDEN — these use the pooler (port 6543) which times out on DDL:
# npm run db:push       ← NEVER
# npm run db:migrate    ← NEVER

# 1. Write the migration SQL file:
#    supabase/migrations/YYYYMMDDNNNNNN_description.sql

# 2. Apply via DIRECT connection (port 5432, not 6543):
DATABASE_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" \
  npx prisma db push --schema supabase/schema.prisma

# 3. Regenerate Prisma client — ALWAYS before writing app code:
npm run db:generate

# 4. Update mock infrastructure — add new model mock objects
#    (see CLAUDE.md for mock file path and template)
#    Do NOT add $transaction — it is already in the shared mock

# 5. Platform config data → ask user approval before seeding anything
```
