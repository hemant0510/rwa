---
name: Supabase connection for DDL on this network
description: Network/connection notes for applying Prisma schema changes to Supabase — the direct URL is unreachable, use session-mode pooler instead
type: project
---

# Supabase DDL connection — this network

## The issue

`DIRECT_URL` in `.env` (`db.<ref>.supabase.co:5432`) resolves to IPv6 only. This network is IPv4-only, so `prisma db push` / `prisma migrate` against the direct URL fails with `P1001: Can't reach database server`.

## The fix — session-mode pooler

Use the session-mode pooler (port **5432** on the pooler host, not the 6543 transaction pooler from `DATABASE_URL`). Same credentials as the pooler, different port:

```
postgresql://postgres.<ref>:<password>@aws-1-ap-south-1.pooler.supabase.com:5432/postgres
```

Command pattern for Prisma DDL:

```bash
npx prisma db push --schema supabase/schema.prisma \
  --url "postgresql://postgres.<ref>:<password>@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"
```

Session-mode pooler handles DDL reliably — the 6543 transaction pooler times out on schema changes (per CLAUDE.md rule 13).

## Why this matters

- CLAUDE.md's `/db-change` skill documents the direct URL approach, but that path fails on IPv4-only networks.
- Apply this override until the network gets IPv6 (or the project gets dedicated IPv4 direct access from Supabase).
- `prisma migrate` will want the direct URL for shadow DB operations — prefer `prisma db push` for simple schema sync against Supabase.

## Confirmed working: 2026-04-14

Applied counsellor role Group 1 schema (4 tables, 3 enums, additive columns, nullable drop) in ~6s via session-mode pooler.
