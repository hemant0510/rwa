# /db-change — Safe schema migration sequence

**Invocation**: `/db-change` whenever editing `supabase/schema.prisma` or adding a migration.

---

```bash
# FORBIDDEN — these use the pooler (port 6543) which times out on DDL:
# npm run db:push       ← NEVER
# npm run db:migrate    ← NEVER

# 1. Write the migration SQL file:
#    supabase/migrations/YYYYMMDDNNNNNN_description.sql
#    e.g. 20260405000001_add_payment_claims.sql

# 2. Apply via DIRECT connection (port 5432, not 6543):
DATABASE_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" \
  npx prisma db push --schema supabase/schema.prisma

# 3. Regenerate Prisma client — ALWAYS before writing app code:
npm run db:generate

# 4. Update tests/__mocks__/prisma.ts — add new model mock objects
#    Do NOT add $transaction — it is already implemented in the shared mock

# 5. Platform config data → ask user approval before seeding anything
```

---

## New model mock template (for step 4)

Add to `tests/__mocks__/prisma.ts` following the exact existing pattern:

```typescript
newModelName: {
  findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(),
  create: vi.fn(), update: vi.fn(), delete: vi.fn(),
  count: vi.fn(), upsert: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(),
  aggregate: vi.fn(),
},
```

**Do NOT add `$transaction`** — it is already in the shared mock with both callback and array forms.
