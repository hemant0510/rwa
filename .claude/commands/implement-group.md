# /implement-group — Implement a plan group with tests, quality gate, and completion audit

**Invocation**: `/implement-group <N> <plan-file>`
Example: `/implement-group 4 execution_plan/plans/online_payment_upi.md`

---

## Step 1 — Extract only the target section

Do NOT read the full file. Use this two-step approach:

```bash
# Step 1a: Find all section headers — works for Phase, Group, or Step naming
grep -En "^#{1,4} (Phase|Group|Step) [0-9]" <plan-file>

# Output examples (varies by plan file):
#   67:  ## Phase 1: API Authorization Middleware
#   203: ## Phase 2: Super Admin Audit Logging
# or:
#   1637: ### Group 1 — Foundation
#   1655: ### Group 2 — Admin UPI Setup
# or:
#   538: ### Phase 2: Storage & Dependencies
#   543: ### Phase 3: Backend — Core

# Step 1b: Read ONLY the lines for section N using the Read tool's offset/limit
# e.g. for Phase 2 at line 203, Phase 3 at line 277: offset=203, limit=(277-203)=74 lines
```

**Note**: Plan files use different section keywords — "Phase", "Group", or "Step" — and different heading levels (`##` or `###`). The grep above catches all variants. Always grep first; never assume the keyword.

Read the extracted section. Stop. Do not read any other section.

---

## Step 2 — Pre-flight checks (before writing any code)

**a) New Prisma models**: If the group adds new models, update `tests/__mocks__/prisma.ts` before writing any source files. Add the new model following the exact existing pattern:

```typescript
newModelName: {
  findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(),
  create: vi.fn(), update: vi.fn(), delete: vi.fn(),
  count: vi.fn(), upsert: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn(),
  aggregate: vi.fn(),
},
```

**Do NOT add `$transaction`** — it is already in the shared mock with both callback and array forms. Do not duplicate it.

**b) Existing files**: For each file listed in the group, check if it already exists. If it does, read it first. Implement only what is missing — never overwrite working code.

---

## Step 3 — TodoWrite task list

Create one task per source-file+test-file pair. Mark both complete together.

---

## Step 4 — Implement each file → write its test immediately → track the test file

For each source file in the group:

1. Implement the source file per the plan spec
2. Immediately write (or update) its test file — **never batch all tests at the end**
3. Run `npx vitest run <that-test-file>` — fix until it passes
4. **Add this test file path to a running list** (this list is used in Step 6)
5. Mark the task complete in TodoWrite

**Every source file MUST have a test** — API routes, services, components, pages, and sidebar/layout files. No exceptions. If you create or modify a source file without writing/updating its test, the pre-commit hook will fail with 0% coverage.

**Note on shared test files**: Some source files share one test file (e.g., a route + its upload sub-route both tested in `resident-payment-claims.test.ts`). Check if a test already exists for this source before creating a new one.

**Large group handling**: If a group has more than 5 source files, split it into two sub-sessions:

- First half: implement → test → Step 5–7 → commit
- Second half: implement → test → Step 5–7 → commit

Commit at the midpoint so context window stays manageable.

---

## Step 5 — Update `vitest.config.ts` coverage.include

After all source files exist, open `vitest.config.ts` and check the `coverage.include` array. Add any new source file paths that are missing. Files absent here are invisible to the 95% threshold and will not appear in coverage reports.

---

## Step 6 — Run the group quality gate

Using the source-files and test-files lists built in Step 4, run these **three checks in order**:

```bash
# 1. Lint — zero errors required
npm run lint

# 2. Type check — fast (~5s), NOT npm run build
npx tsc --noEmit

# 3. Coverage — the EXACT check the pre-commit hook runs
#    This is the most important step. Uses `vitest related` to find tests
#    for all source files, then enforces 95% per file.
npx vitest related <all-source-files> --run \
  --coverage --coverage.provider=v8 --coverage.reporter=text \
  --coverage.include=<source-file-1> \
  --coverage.include=<source-file-2> \
  ... \
  --coverage.thresholds.perFile=true \
  --coverage.thresholds.lines=95 \
  --coverage.thresholds.branches=95 \
  --coverage.thresholds.functions=95 \
  --coverage.thresholds.statements=95
```

**CRITICAL**: If any file shows below 95% on any metric, add tests for the uncovered branches/lines **now**. Do not defer to Step 7. The pre-commit hook runs this exact check — if you skip it here, the commit will fail.

**Re-run lint after any test additions or fixes**: If coverage failures required adding/modifying test files, re-run `npm run lint` before moving on — new files may have unused imports or other lint errors.

Fix every failure before proceeding. Never skip forward with a failure open.

Only run `npm run build` on the final group of a feature branch or when explicitly asked.

---

## Step 7 — Completion Audit (MANDATORY)

Re-read the extracted group spec section as an auditor. Verify each category:

**A. File Checklist** — every file in the group's file table:

```
✅/❌ src/path/to/file.ts — exists, implements spec
```

**B. API Endpoint Checklist** — every row in the endpoint table:

```
✅/❌ METHOD /api/path — auth check present? input validated? correct response shape?
```

**C. Page Navigation Checklist** — for every new page: "How does a user reach this page?"

```
✅/❌ /admin/settings/payment-setup — accessible from: [where?]
✅/❌ /r/payments/pay             — accessible from: [where?]
```

If no navigation entry point exists → add one before declaring complete.

**D. UI Spec Checklist** — every element in wireframes and spec tables:

```
✅/❌ "← Back" button at top left
✅/❌ Amount formatted as ₹X,XXX
✅/❌ "QR not configured" placeholder when upiQrUrl is null
✅/❌ Copy button with clipboard + toast feedback
```

Read wireframe diagrams element by element. Every labeled item must exist in the component.

**E. State Checklist** — every page and component:

```
✅/❌ Loading state (PageSkeleton or spinner while data fetches)
✅/❌ Error state (what renders when API fails?)
✅/❌ Empty state (what renders when list has 0 items?)
✅/❌ Success state (what renders after form submits?)
```

**F. Integration Checklist** — sidebar badges, parent page links, existing page extensions:

```
✅/❌ Sidebar badge shows pending count (if spec requires)
✅/❌ Parent settings page has link/card to new sub-page
✅/❌ Existing pages that spec says to "extend" are actually extended, not broken
```

**G. Test Coverage Checklist**:

```
✅/❌ All new source files added to vitest.config.ts coverage.include
✅/❌ Every new/modified source file has a corresponding test file
✅/❌ All test files pass: npx vitest run <each file individually>
✅/❌ 95%+ coverage per file — run this exact command to verify:
```

```bash
npx vitest run <test-files> \
  --coverage \
  --coverage.include=<source-file-1> \
  --coverage.include=<source-file-2> \
  --coverage.thresholds.perFile=true \
  --coverage.thresholds.lines=95 \
  --coverage.thresholds.branches=95 \
  --coverage.thresholds.functions=95 \
  --coverage.thresholds.statements=95
```

If any file is below 95% on any metric → add tests for the uncovered branches/lines. Do not report "complete" with open items.

---

## Step 8 — Report and update memory

Only after all items above are ✅:

```
Group N — COMPLETE ✅

Files created: X source, Y test
Audit results:
  A. Files:       ✅ all X files exist and match spec
  B. Endpoints:   ✅ all routes auth'd, validated, correct shape
  C. Navigation:  ✅ all pages reachable from UI
  D. UI spec:     ✅ all wireframe elements present
  E. States:      ✅ loading/error/empty/success handled
  F. Integration: ✅ sidebar/parent pages updated
  G. Tests:       ✅ all pass, 95%+ coverage per file

Files to stage:
  git add <list every new/modified file>
```

Then update project memory: write a memory entry recording which group is done and the key files created. This prevents the next session from re-discovering completion status by reading through source files.
