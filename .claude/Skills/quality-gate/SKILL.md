---
name: quality-gate
description: Run lint, tests, type check, coverage, and build in correct order. Two variants — Variant A during implementation, Variant B pre-commit. Stop on first failure, fix, re-run.
---

# Quality Gate

Two variants — context determines which to use.

---

## Variant A — During implementation (files created, not staged)

Run in order (see CLAUDE.md for exact commands). Stop on first failure:

1. **Linter** — zero errors required. Pre-existing warnings acceptable.
2. **Tests** — run test files for the code you've been working on. NOT the pre-commit staged variant — files aren't staged yet.
3. **Type checker** — fast check (seconds), NOT full build.
4. **Build check** — run `npm run build`. This catches errors that `tsc --noEmit` misses:
   - Next.js route export validation (e.g., non-HTTP-method exports from route files)
   - Next.js page/layout type constraints
   - Webpack/Turbopack bundling errors
   - Missing runtime dependencies

   `tsc --noEmit` only validates TypeScript types. `npm run build` additionally validates Next.js conventions (valid route exports, page props, etc.). **Always run both** — they catch different classes of errors.

   If the build fails, fix the root cause and re-run from step 1 (lint) since the fix may introduce new issues.

5. **Per-file coverage sweep** — this is the FINAL step, after ALL fixes are done.

   List EVERY source file that was created or modified during this entire session — including files modified to fix lint errors, type errors, or build errors in steps 1-4. Then for each file, run:

   ```bash
   npx vitest run tests/path/to/test.ts --coverage --coverage.include=src/path/to/source.ts
   ```

   **"Modified" means ANY change** — extracting a function, removing an export, fixing a type, adding an import. If you touched the file, you check its coverage. The pre-commit hook does not distinguish between "intentional changes" and "incidental fixes."

   If any file shows below 95% on any metric → add tests NOW. If a file has no test file → write one or add to vitest exclude.

   **Do not skip this step because the plan says "no test needed" — the hook does not read plans.**

   **Common trap:** You fix a build error by extracting an exported constant/function from a route file into a separate file. The route file now has different code, the new file has no test. BOTH need coverage checks.

---

## Variant B — Pre-commit (files staged)

Run in order. Stop on first failure:

1. **Linter** — staged files only
2. **Staged tests** — project's staged test runner (see CLAUDE.md)
3. **Type checker**
4. **Build check** — `npm run build`. Same rationale as Variant A step 4.
5. **Per-file coverage sweep** — same as Variant A step 5, scoped to staged files.

The pre-commit hook runs steps 1-3 automatically on `git commit`. Steps 4-5 are manual — run them before pushing or when the pre-commit hook passes but you want extra confidence.

---

## Reporting

Stop on first failure. Fix it. Re-run from step 1 after any fix. Never skip forward.

```
✅ Lint — clean
✅ Tests — 34 passed (tests/services/..., tests/api/...)
✅ Type check — no errors
✅ Build — compiled successfully
✅ Coverage — per-file ≥ 95% on 8 modified files

❌ Build — Route export error:
  src/app/api/v1/foo/route.ts: "helperFn" is not a valid Route export field.
→ Extracting helperFn to separate file...
→ Re-running from step 1...
→ After fix: MUST re-check coverage on both route.ts AND the new helper file
```
