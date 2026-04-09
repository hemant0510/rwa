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

## Skills — always use these for implementation work

Skills live in `.claude/skills/<name>/SKILL.md` with YAML frontmatter.

- `/implement-group <N> <plan-file>` — extract spec → build → per-file coverage → 7-category audit → report
- `/verify-group <N> <plan-file>` — audit existing implementation (reads global plan sections too), fix all gaps
- `/write-tests <file>` — write tests with correct patterns from core_rules.md, verify per-file coverage
- `/quality-gate` — lint → tests → tsc, in correct order (Variant A: implementation, Variant B: pre-commit)
- `/db-change` — safe schema migration (direct connection, never pooler)
- `/dev` — start dev server

## Code Quality

- **ESLint** flat config — zero errors required; warnings OK if pre-existing
- **Prettier** — auto-runs on staged files via Husky
- **Vitest** — 95% lines/branches/functions/statements per file
- **Shared mocks**: always `import { mockPrisma } from "../__mocks__/prisma"` — never recreate inline
- **Pre-commit hook**: `scripts/test-staged.mjs` — targeted tests for staged TS files only

## Pre-Commit Coverage — CRITICAL

The pre-commit hook (`scripts/test-staged.mjs`) enforces **95% per-file coverage** on ALL staged source files. This is the #1 source of failed commits. Follow these rules strictly.

### "No test needed" claims in plan files are WRONG by default

Plan files sometimes say "no test needed" or "not in coverage scope." **These claims do not override the pre-commit hook.** The hook tests every staged `.ts`/`.tsx` file — it does not read plan documents. When a plan makes this claim, you must choose exactly one of:

1. **Write tests** that bring coverage to ≥ 95% for that file, OR
2. **Add the file to `vitest.config.ts` `exclude`** AND verify the hook skips it by checking `scripts/test-staged.mjs`

There is no third option. Trusting a plan claim without empirically running the coverage command is the #1 source of "Ready to commit: YES" that then fails on actual commit.

### Before modifying any existing file

1. Check if it has a test file — if not, you MUST create one covering the full file (not just your changes) before committing
2. Run per-file coverage after writing tests: `npx vitest run tests/path/to/test.ts --coverage --coverage.include=src/path/to/source.ts`
3. Do NOT rely on "all tests pass" — per-file thresholds can still fail

### When adding new imports/dependencies to existing API routes

- Audit ALL existing test files for that route and add the required mocks (e.g., adding `createAdminClient` requires mocking `@/lib/supabase/admin` in every test that imports the route)

### v8 coverage ignore in JSX — what works and what doesn't

- **DOES NOT WORK**: `/* v8 ignore next */` on its own line above a JSX expression — V8 ignores this
- **WORKS**: `/* v8 ignore start */` + `/* v8 ignore stop */` blocks around the expression
- **BEST**: Extract branch expressions to variables above the `return`, then use `/* v8 ignore start/stop */` around the variable declarations
- **WORKS in JSX**: `{/* v8 ignore start */}{expression}{/* v8 ignore stop */}`

### Common untestable JSX branches (use v8 ignore)

- `mutation.isPending && <Spinner />` — requires exact async timing in JSDOM
- `STATUS_MAP[status] || fallback` — all known statuses exist in the map
- `ref.current?.click()` — ref is always attached when called
- `isLoading ? <Spinner> : data ? <Content> : null` — transient loading state

### When adding signed URL generation to API routes, always add 3 test cases

1. Entity WITH photoUrl → signed URL returned
2. Entity WITHOUT photoUrl → null returned, `createSignedUrl` NOT called
3. Signed URL generation fails → falls back to null

## Core Coding Rules

All standards: [.claude/core_rules.md](.claude/core_rules.md) — read before writing any code.

## Reference Documents

- `execution_plan/plans/` — feature implementation plans (grep for group headers first)
- `external_docs/RWA_Connect_MVP_v1.0.docx` — MVP spec
- `external_docs/RWA_Connect_Full_Spec_v3.0.docx` — full product vision
