# CLAUDE.md

## Project Overview

Eden Estate RWA management app — Next.js 16, React 19, TypeScript strict, Tailwind v4, Prisma, Supabase.

## Commands

```bash
npm run dev              # Dev server — http://localhost:3000
npm run build            # Production build (prisma generate + next build)
npm run lint             # ESLint — zero errors required before commit
npm run format           # Prettier
npx tsc --noEmit         # Fast type check (~5s) — use during dev instead of build
npm run test             # Full test suite (Vitest, no coverage)
npm run test:coverage    # Full test suite + V8 coverage report
npm run test:staged      # Tests for staged files only (used by pre-commit hook)
npm run db:generate      # Regenerate Prisma client after schema changes
npm run db:seed:master   # Seed platform master data
npm run db:seed:dev      # Seed dev/demo data
```

## Architecture

- **Framework**: Next.js 16 App Router, React 19, TypeScript strict
- **Styling**: Tailwind CSS v4 via PostCSS
- **DB**: Prisma + Supabase (`supabase/schema.prisma`; mocks in `tests/__mocks__/`)
- **Path alias**: `@/*` → `./src/*`

### Directory Structure

```
src/app/            # Pages, layouts, API route handlers (App Router)
src/components/     # ui/ primitives + features/ composed components
src/hooks/          # Custom React hooks
src/lib/            # Config, utils, Prisma client, validations
src/services/       # Client-side fetch wrappers
src/types/          # Shared TypeScript types
tests/              # Mirrors src/ structure; __mocks__/ for Prisma & Supabase
supabase/           # schema.prisma, migrations/, seed files
execution_plan/     # Build plans — read only the target group section, not the full file
```

## Slash Commands — always use these for implementation work

- `/implement-group <N> <plan-file>` — extract spec → build → test immediately → audit → report
- `/verify-group <N> <plan-file>` — audit existing implementation, find and fix all gaps
- `/write-tests <file>` — write tests with correct patterns (vi.hoisted / global.fetch / renderHook)
- `/quality-gate` — lint → vitest run → tsc, in correct order for the context
- `/db-change` — safe schema migration (direct connection, never pooler)
- `/dev` — start dev server

## Code Quality

- **ESLint** flat config — zero errors required; warnings OK if pre-existing
- **Prettier** — auto-runs on staged files via Husky
- **Vitest** — 95% lines/branches/functions/statements per file
- **Shared mocks**: always `import { mockPrisma } from "../__mocks__/prisma"` — never recreate inline
- **Pre-commit hook**: `scripts/test-staged.mjs` — targeted tests for staged TS files only

## Core Coding Rules

All standards: [.claude/core_rules.md](.claude/core_rules.md) — read before writing any code.

## Reference Documents

- `execution_plan/plans/` — feature implementation plans (grep for group headers first)
- `external_docs/RWA_Connect_MVP_v1.0.docx` — MVP spec
- `external_docs/RWA_Connect_Full_Spec_v3.0.docx` — full product vision
