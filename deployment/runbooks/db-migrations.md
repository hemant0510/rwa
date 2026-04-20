# Database migrations — RWA Connect (Supabase × Prisma)

Two Supabase projects: `rwa-connect` (shared by dev + stage) and `rwa-connect-prod` (prod-only). Migrations flow strictly dev → stage → prod via CI. This runbook covers day-2 ops — how to prepare a migration, how to roll one back, and what to do when things go sideways.

**Important consequence of the shared dev/stage project:** dev and stage point at the **same database**. A migration applied by dev CI is immediately live for stage too. There is no separate "promote to stage" DB step — the gate between dev-quality code and stage-quality code is purely at the app-image level. Plan destructive migrations accordingly: if a migration breaks dev, stage is broken at the same moment.

---

## Ground rules

1. **Never use `db push` or `migrate dev` in CI.** Both use the pooler (6543) which times out on DDL — see CLAUDE.md. CI only runs `migrate deploy` against `DIRECT_URL` (port 5432).
2. **Never hand-edit the prod schema.** Every change goes through a Prisma migration so `_prisma_migrations` stays consistent.
3. **Wrap RLS, triggers, and functions inside Prisma migrations.** Not a separate SQL pipeline. Put raw SQL in `migration.sql` alongside the Prisma-generated SQL.
4. **Master data** is seeded via `npm run db:seed:master` — upsert-only, safe to re-run, runs in CI on every env.
5. **Dev demo data** (`db:seed:dev`) is manual-only, dev-only. CI never runs it. The script itself hard-guards on `NODE_ENV !== "production"` + `SEED_ALLOW=1`.
6. **Prisma does not auto-rollback.** Our rollback mechanism is Supabase's daily backups + careful migration design (expand-contract).

---

## Pre-migration checklist

Before opening a PR with a schema change:

- [ ] Ran locally against a fresh copy of dev schema — no errors, no warnings.
- [ ] New migration file checked in under `supabase/migrations/<timestamp>_<name>/migration.sql`.
- [ ] Raw SQL (RLS policies, triggers, functions) wrapped inside the same migration file — not a separate SQL file.
- [ ] Is this migration **reversible?** If no: is it designed expand-contract so the old app keeps working? (See next section.)
- [ ] Are there **destructive operations** (`DROP COLUMN`, `DROP TABLE`, `RENAME`)? If yes: plan is expand → migrate data → switch app → contract in a LATER PR.
- [ ] Are there **long-running operations** (`CREATE INDEX` on a large table, backfills)? If yes: use `CONCURRENTLY` and schedule outside peak hours.
- [ ] Supabase prod backup from the last 24 h exists. Confirm via Supabase Dashboard → Database → Backups.
- [ ] For a prod migration: the PR title or description says `[MIGRATION]` so the approver knows to look extra carefully.

---

## Expand-contract pattern (zero-downtime schema changes)

When a change is not trivially reversible (rename, drop, type change), split it across two or more PRs:

**Renaming `User.name` → `User.fullName`:**

| PR           | Migration                                                            | App change                                                                              |
| ------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| 1 (expand)   | `ALTER TABLE "User" ADD COLUMN "fullName" TEXT;` + backfill `UPDATE` | App writes to BOTH `name` and `fullName`. Reads prefer `fullName`, fall back to `name`. |
| 2 (switch)   | — (no migration)                                                     | App writes only to `fullName`. Reads only `fullName`.                                   |
| 3 (contract) | `ALTER TABLE "User" DROP COLUMN "name";`                             | —                                                                                       |

Each PR deploys independently. If PR 2 breaks, rollback leaves the DB in a consistent state because the column still exists. This is slower than a single PR but removes the "everything's on fire" class of incident.

**Type changes**: add new column with new type → backfill → app uses new → drop old. Same three steps.

---

## CI migration flow

```
Push to develop ─────────────────────► deploy-dev.yml
                                         └─ migrate deploy (DEV_DIRECT_URL → rwa-connect)
                                         └─ db:seed:master
                                         └─ deploy rwa-dev

Click "Promote to stage" ────────────► promote-to-stage.yml
  (workflow_dispatch)                    ⏸ staging gate → approve
                                         └─ retag image as stage-<sha>
                                         └─ migrate deploy (STAGE_DIRECT_URL → rwa-connect)
                                              (no-op — dev already applied it)
                                         └─ db:seed:master
                                         └─ deploy rwa-stage

Click "Promote to prod" ─────────────► promote-to-prod.yml
  (workflow_dispatch)                    ⏸ production gate → approve
                                         └─ retag image as prod-<sha>
                                         └─ migrate deploy (PROD_DIRECT_URL → rwa-connect-prod)
                                         └─ db:seed:master (on prod)
                                         └─ deploy rwa-prod
```

Because dev and stage share `rwa-connect`, they share a single `_prisma_migrations` table. Stage's `migrate deploy` will be a no-op for anything already applied by dev. Prod (`rwa-connect-prod`) has its own independent migration state.

**Practical implication:** a bad migration on `develop` breaks dev AND stage at the same moment (shared DB). Recover by fixing forward (another migration) or by restoring `rwa-connect` — see "Rollback procedures" below. The prod gate is your last chance to catch it before `rwa-connect-prod` is touched.

**Master-data-only updates** (new billing plan, platform config, etc.) skip the code pipeline entirely: Actions tab → **Seed master data** → pick env → Run. Prod selection triggers an approval gate. No image rebuild, no deploy.

---

## Connection strings (reference)

From [../../.env.example](../../.env.example):

| Var            | Port          | Use for                                       |
| -------------- | ------------- | --------------------------------------------- |
| `DATABASE_URL` | 6543 (pooler) | App runtime queries                           |
| `DIRECT_URL`   | 5432 (direct) | `prisma migrate deploy`, `psql`, anything DDL |

Per env in CI secrets: `DEV_DATABASE_URL`, `DEV_DIRECT_URL`, `STAGE_*`, `PROD_*`.

---

## Rollback procedures

### Case 1 — migration succeeded, app revision is bad

Rollback the container only. See [rollback.md](rollback.md). The migration stays applied. This is the common case if the migration was designed expand-contract.

### Case 2 — migration partially applied, failed mid-way

Prisma marks the migration as rolled back in `_prisma_migrations`. To recover:

1. Connect with `DIRECT_URL`:
   ```bash
   psql "$PROD_DIRECT_URL"
   ```
2. Inspect:
   ```sql
   SELECT id, migration_name, started_at, finished_at, rolled_back_at
   FROM _prisma_migrations
   WHERE finished_at IS NULL
   ORDER BY started_at DESC LIMIT 5;
   ```
3. **If half-applied SQL is idempotent-safe to re-run** (e.g., `CREATE TABLE IF NOT EXISTS`): mark as rolled-back, fix the migration, redeploy.
   ```sql
   UPDATE _prisma_migrations SET rolled_back_at = now() WHERE id = '<id>';
   ```
4. **If half-applied SQL left the schema inconsistent**: manually reverse the partial DDL with a `psql` session before re-running `migrate deploy`.

### Case 3 — migration fully applied, schema change is destructive and wrong

No way back without data loss OR a restore. In order of preference:

1. **Forward-fix**: ship a new migration that restores the old shape. Only viable for additive mistakes ("accidentally dropped the wrong column" is NOT this case).
2. **Supabase point-in-time restore**: Supabase Pro gives 7-day PITR. Dashboard → Database → Backups → Restore. Creates a new project with restored state; you manually swap the connection strings in the Container App secrets.
3. **Accept data loss** and restore from the most recent daily backup. Only if the window since the bad migration is tolerable.

During a restore, the app is effectively offline. Scale the Container App to zero and put up a maintenance page:

```bash
az containerapp update --name rwa-prod --resource-group rwa-rg-centralindia --min-replicas 0 --max-replicas 0
```

---

## Prod → stage data refresh

Run `deployment/scripts/db-sync-prod-to-stage.sh` (Phase 6 deliverable) when stage needs realistic data for testing. The script:

1. Prompts "type YES to overwrite stage" — guard against accidents.
2. `pg_dump` prod with `--exclude-table-data` on sensitive tables (sessions, audit logs, PII).
3. PII scrub: emails → `user-N@example.com`, phone numbers synthetic.
4. `pg_restore` to stage via `STAGE_DIRECT_URL`.
5. `npm run db:seed:master` to re-assert master data after restore.

**Never** sync prod → dev. Dev uses `db:seed:dev` + fixtures. **Never** sync any env upstream (dev → stage, stage → prod). These flows don't exist and shouldn't exist.

---

## Local dev schema changes

Per CLAUDE.md / memory:

```bash
# NEVER these (pooler times out):
npm run db:push
npm run db:migrate

# Use direct connection:
DATABASE_URL="postgresql://postgres:rwa@mant0510@db.<ref>.supabase.co:5432/postgres" \
  npx prisma db push --schema supabase/schema.prisma

# Then regenerate client:
npm run db:generate
```

When the change is ready to ship, convert it to a migration:

```bash
DATABASE_URL="<direct-url>" npx prisma migrate dev --schema supabase/schema.prisma --name descriptive_name
```

Commit the migration folder. CI applies it via `migrate deploy` on merge.
