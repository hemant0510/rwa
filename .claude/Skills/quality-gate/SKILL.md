---
name: quality-gate
description: Run lint, tests, and type check in correct order. Two variants — Variant A during implementation, Variant B pre-commit. Stop on first failure, fix, re-run.
---

# Quality Gate

Two variants — context determines which to use.

---

## Variant A — During implementation (files created, not staged)

Run in order (see CLAUDE.md for exact commands). Stop on first failure:

1. **Linter** — zero errors required. Pre-existing warnings acceptable.
2. **Tests** — run test files for the code you've been working on. NOT the pre-commit staged variant — files aren't staged yet.
3. **Type checker** — fast check (seconds), NOT full build.

Full build: only on the final group of a feature branch or when explicitly asked.

---

## Variant B — Pre-commit (files staged)

Run in order. Stop on first failure:

1. **Linter** — staged files only
2. **Staged tests** — project's staged test runner (see CLAUDE.md)
3. **Type checker**

The pre-commit hook runs Variant B automatically on `git commit`. Only run manually to pre-check staged state.

---

## Reporting

Stop on first failure. Fix it. Re-run that step only. Never skip forward.

```
✅ Lint — clean
✅ Tests — 34 passed (tests/services/..., tests/api/...)
✅ Type check — no errors

❌ Lint — 1 error in src/services/foo.ts:
  Line 45: 'result' is assigned but never used
→ Fixing now...
```
