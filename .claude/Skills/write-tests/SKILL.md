---
name: write-tests
description: Write or complete tests for any source file with correct patterns. Determines file type (API route, service, component, page, hook), applies project test patterns from core_rules.md, and verifies per-file coverage meets threshold.
argument-hint: <source-file-path>
---

# Write Tests

**Invocation**: `/write-tests <source-file-path>`

---

## Step 1 — Identify file type

From the file path, determine the type:

- `src/app/api/**/route.ts` → API route handler
- `src/services/**` → Client service / fetch wrapper
- `src/components/**` → React component
- `src/app/**/page.tsx` → Next.js page
- `src/hooks/**` → Custom hook
- `src/lib/**` → Utility / library function

---

## Step 2 — Read project test patterns

Read core_rules.md (see CLAUDE.md for path) — Section for Test Coverage Rules. This is where the project's concrete mock patterns, import conventions, and wrapper utilities live. Do not derive patterns from scratch; use what's documented there.

---

## Step 3 — Read the source file

Read the complete source file. List every:

- Branch (`if/else`, ternary, `?.`, `??`, `||`, `&&`)
- Error path (throw, error response, null return)
- Async operation (DB call, fetch, queue)
- Edge case mentioned in comments

---

## Step 4 — Write tests

Apply the project's patterns from core_rules.md. Cover every item from Step 3:

- Every auth/permission check → one test per case (unauthenticated, wrong role, correct)
- Every validation rule → one test per invalid case + one valid case
- Every error path → one test (DB error → 500, not found → 404, etc.)
- Every branch in business logic → one test per branch
- For UI: loading, error, empty, success states

---

## Step 5 — Run and verify

Run the test file — fix until all pass.
Run per-file coverage (see CLAUDE.md for the command) — fix until project threshold is met.

---

## File location convention

Test file mirrors the source file path under the project's test directory:

```
src/services/foo.ts              → tests/services/foo.test.ts
src/components/features/X/Y.tsx  → tests/components/X/Y.test.tsx
src/app/api/v1/.../route.ts      → tests/api/<descriptive-name>.test.ts
src/app/r/payments/page.tsx      → tests/app/r/payments/page.test.tsx
src/lib/config/payment.ts        → tests/lib/config/payment.test.ts
src/hooks/useHookName.ts         → tests/hooks/useHookName.test.ts
```
