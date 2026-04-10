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

5. **Hook simulation — final gate before "ready to commit"**.

   List EVERY source file modified this session (including files changed to fix lint/type/build errors — any change counts). Exclude pure TypeScript type files (`src/types/**`) and files in the hook's SKIP_COVERAGE list (check `scripts/test-staged.mjs`).

   Run `vitest related` against ALL those source files together with the exact flags the pre-commit hook uses:

   ```bash
   npx vitest related src/file1.ts src/file2.ts [all source files...] --run \
     --coverage --coverage.provider=v8 --coverage.reporter=text \
     --coverage.include=src/file1.ts --coverage.include=src/file2.ts \
     --coverage.thresholds.perFile=true \
     --coverage.thresholds.lines=95 --coverage.thresholds.branches=95 \
     --coverage.thresholds.functions=95 --coverage.thresholds.statements=95
   ```

   **Critical**: Use `vitest related <source-files>` — NOT `vitest run <test-files>`. The hook uses `vitest related` which walks Vitest's module graph to find EVERY test that imports the changed source, including pre-existing test files from prior sessions you didn't write. `vitest run tests/foo.test.ts` runs only one file and misses those. A test suite that passes with `vitest run` and fails on commit is almost always this mismatch.

   If test failures appear in files you didn't write → a signature change broke pre-existing call sites. Fix them.
   If any file is below 95% on any metric → add tests now.

   **Common trap:** You fix a build error by extracting a function from a route file into a new file. The route file changed, the new file has no tests. Run `vitest related` on BOTH.

---

## Variant B — Pre-commit (files staged)

Run in order. Stop on first failure:

1. **Linter** — staged files only
2. **Staged tests** — project's staged test runner (see CLAUDE.md): `npm run test:staged`
3. **Type checker**
4. **Build check** — `npm run build`. Same rationale as Variant A step 4.
5. **Hook simulation** — same `vitest related` command as Variant A step 5, scoped to staged source files.

The pre-commit hook runs steps 1-2 automatically on `git commit`. Steps 3-5 are manual — run them before pushing or when the pre-commit hook passes but you want extra confidence.

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
