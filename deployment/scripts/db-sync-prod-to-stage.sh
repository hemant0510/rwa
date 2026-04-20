#!/usr/bin/env bash
# db-sync-prod-to-stage.sh — sanitised prod → stage data refresh
#
# STATUS: STUB. Phase 6 deliverable. This file sketches the flow; flesh out
# each section before the first real run. Do NOT execute as-is.
#
# Purpose:
#   Overwrite the stage Supabase project with a sanitised copy of prod data
#   so stage testing reflects real-world shapes. Never runs the other way.
#
# Guardrails:
#   - Interactive confirmation — operator must type "YES" to proceed.
#   - PII tables excluded from dump or scrubbed after restore.
#   - Aborts if PROD_DIRECT_URL or STAGE_DIRECT_URL is missing.
#   - Dry-run flag (`--dry-run`) prints the pg_dump / pg_restore commands
#     without executing.

set -euo pipefail

# ─────────────────────────────────────────────
# 0. Args
# ─────────────────────────────────────────────
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    *) echo "Unknown arg: $arg"; exit 1 ;;
  esac
done

# ─────────────────────────────────────────────
# 1. Required env vars (source from Supabase dashboards; do not hardcode)
# ─────────────────────────────────────────────
: "${PROD_DIRECT_URL:?PROD_DIRECT_URL is required (postgres://... :5432/postgres)}"
: "${STAGE_DIRECT_URL:?STAGE_DIRECT_URL is required (postgres://... :5432/postgres)}"

# ─────────────────────────────────────────────
# 2. Tables to exclude entirely from the dump
#    (schema copied, data skipped)
# ─────────────────────────────────────────────
EXCLUDED_TABLES=(
  "public.\"Session\""
  "public.\"AuditLog\""
  "public.\"VerificationToken\""
  # TODO: review after schema stabilises — add anything holding raw PII, OTPs, tokens
)

# ─────────────────────────────────────────────
# 3. Confirmation gate
# ─────────────────────────────────────────────
echo "────────────────────────────────────────────────────"
echo "  PROD → STAGE data sync"
echo "  Source: $(echo "$PROD_DIRECT_URL" | sed 's/:.*@/:****@/')"
echo "  Target: $(echo "$STAGE_DIRECT_URL" | sed 's/:.*@/:****@/')"
echo "  Dry run: ${DRY_RUN}"
echo "  Excluded tables: ${EXCLUDED_TABLES[*]}"
echo "────────────────────────────────────────────────────"
echo "This will OVERWRITE stage data. Type YES to proceed."
read -r CONFIRM
if [[ "$CONFIRM" != "YES" ]]; then
  echo "Aborted."
  exit 1
fi

DUMP_FILE="$(mktemp -t rwa-prod-dump-XXXXXX.sql)"
trap 'rm -f "$DUMP_FILE"' EXIT

# ─────────────────────────────────────────────
# 4. Dump prod (schema + data, minus excluded tables)
# ─────────────────────────────────────────────
EXCLUDE_ARGS=()
for t in "${EXCLUDED_TABLES[@]}"; do
  EXCLUDE_ARGS+=(--exclude-table-data="$t")
done

DUMP_CMD=(pg_dump "$PROD_DIRECT_URL"
  --no-owner --no-acl
  --schema=public
  "${EXCLUDE_ARGS[@]}"
  --file="$DUMP_FILE")

echo "Dumping prod..."
echo "  ${DUMP_CMD[*]}"
if (( DRY_RUN == 0 )); then
  "${DUMP_CMD[@]}"
fi

# ─────────────────────────────────────────────
# 5. Restore into stage
#    Option A: drop+recreate the public schema, then \i the dump.
#    Option B: use pg_restore if we switch to --format=custom above.
# ─────────────────────────────────────────────
echo "Restoring to stage..."
if (( DRY_RUN == 0 )); then
  psql "$STAGE_DIRECT_URL" <<'SQL'
    DROP SCHEMA IF EXISTS public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO postgres;
    GRANT ALL ON SCHEMA public TO public;
SQL
  psql "$STAGE_DIRECT_URL" -f "$DUMP_FILE"
fi

# ─────────────────────────────────────────────
# 6. PII scrub — run AFTER restore, on stage only
#    Keep these statements idempotent.
# ─────────────────────────────────────────────
echo "Scrubbing PII on stage..."
if (( DRY_RUN == 0 )); then
  psql "$STAGE_DIRECT_URL" <<'SQL'
    -- Emails: replace with deterministic synthetic addresses
    UPDATE "User"
    SET email = CONCAT('user-', id, '@example.com')
    WHERE email IS NOT NULL AND email NOT LIKE '%@example.com';

    -- Phone numbers: replace with synthetic
    UPDATE "Resident"
    SET phone = CONCAT('+9199', LPAD((RANDOM() * 10000000)::int::text, 8, '0'))
    WHERE phone IS NOT NULL;

    -- TODO: list every PII-bearing column after the schema stabilises:
    --   - User.fullName / Resident.fullName → "Resident N"
    --   - Address lines
    --   - Any free-text fields that leak names/phones
SQL
fi

# ─────────────────────────────────────────────
# 7. Re-assert master data (upsert, safe)
# ─────────────────────────────────────────────
echo "Re-seeding master data..."
if (( DRY_RUN == 0 )); then
  DATABASE_URL="$STAGE_DIRECT_URL" npm run db:seed:master
fi

echo "Done. Verify stage manually before handing off to QA."
