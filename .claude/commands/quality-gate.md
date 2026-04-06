# /quality-gate — Run lint, tests, and type check in correct order

Two variants — context determines which to use.

---

## Variant A — During implementation (files created, not staged)

```bash
npm run lint                              # zero errors required
npx vitest run <test-files from Step 4>   # the list built during implementation
npx tsc --noEmit                          # ~5s type check — NOT npm run build
```

`npm run build` only on the final group of a feature branch or when explicitly asked.

---

## Variant B — Pre-commit (files staged, before git commit)

```bash
npx lint-staged        # ESLint + Prettier on staged files
npm run test:staged    # targeted tests for staged files only
npx tsc --noEmit
```

The Husky hook runs Variant B automatically on `git commit`. Only run manually to pre-check staged state.

---

## Reporting rule

Stop on first failure. Fix it. Re-run that step. Never skip forward.

```
✅ Lint — clean
✅ Tests — 34 passed (tests/services/..., tests/api/...)
✅ Type check — no errors

❌ Lint — 1 error in src/services/foo.ts:
  Line 45: 'result' is assigned a value but never used
→ Fixing now...
```
