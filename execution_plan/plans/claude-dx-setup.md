# Plan: Claude Developer Experience (DX) Setup

## What Was Wrong With the First Two Drafts

**Draft 1** had 5 critical bugs (test:staged false pass, prose not code in write-tests,
missing prisma mock update step, missing vitest.config.ts update, no completion audit).

**Draft 2** fixed those but introduced 7 more gaps found during deep review:

1. **Grep pattern was broken** — `grep -n "Group N\|Group $((N+1))"` uses `N` as a literal string, not a variable. The actual plan file headers are `### Group 4 — Admin Claim Verification`. That grep would match nothing.

2. **No test-files list maintained in Step 4** — Step 6 says "run all group test files" but nothing tells Claude to build that list as it goes. Step 6 has an undefined reference.

3. **`$transaction` mock not mentioned** — The shared `tests/__mocks__/prisma.ts` already has a full `$transaction` implementation (both callback and array forms). The plan's new-model template doesn't mention it, so Claude might add a duplicate or broken version.

4. **Hook test template completely missing** — The project has 4 hook test files using `renderHook`. The `/write-tests` command has API, service, component, and page templates but no hook template.

5. **`sonner` toast mock and `userEvent.setup()` missing from component template** — Both are used in existing tests (UpiQrDisplay, PaymentClaimForm). Missing from the template means Claude re-derives them.

6. **No memory update in Step 8** — After a group completes, there is no instruction to update project memory. The next session re-discovers which groups are done by exploring the codebase.

7. **No guidance for large groups or mid-session resume** — Group 5 has 5 complex steps. If context fills mid-group, or the user has to stop, there's no recovery path defined.

---

## Problem Statement (Final)

| Problem                                                          | Root Cause                               | Impact                                               |
| ---------------------------------------------------------------- | ---------------------------------------- | ---------------------------------------------------- |
| Claude reads full 86KB plan (≈23K tokens) to implement one group | No "read only group N" instruction       | Slow start, excessive tokens                         |
| "No test framework configured yet" in CLAUDE.md                  | Stale content                            | Claude wastes time discovering Vitest                |
| Test patterns re-derived every session                           | No verbatim code templates               | Wrong pattern → test fails → 2-3 iterations          |
| `tests/__mocks__/prisma.ts` missed when new models added         | Not in any workflow                      | Every test crashes on import                         |
| `vitest.config.ts` coverage.include not updated                  | Not in any workflow                      | New files invisible to 95% threshold                 |
| Quality gate uses wrong commands during implementation           | `test:staged` requires staged files      | False pass — 0 tests run                             |
| `npm run build` used for type-checking                           | Slow (prisma generate + next build)      | 60–90s wait when 5s `tsc` suffices                   |
| DB schema changes use pooler URL                                 | Rule only in memory files                | Migration times out                                  |
| "Group complete" declared without spec verification              | No structured audit after implementation | Nav links, UI elements, error states silently missed |

---

## Root Cause Analysis: Why "Group Complete" Is Often Wrong

```
Claude implements all files → runs tests → passes → says "Group N complete"
User asks to re-check → Claude reads spec again → finds gaps: nav link missing,
  back button not wired, error state forgotten, page unreachable from UI
```

**Why**: Claude verifies _file existence_ but not _spec compliance_. The spec encodes requirements in 5 formats only 2 of which Claude reliably catches:

| Requirement format                                               | Claude catches it?                            |
| ---------------------------------------------------------------- | --------------------------------------------- |
| File tables ("create these files")                               | ✅ Usually                                    |
| API endpoint tables                                              | ✅ Usually                                    |
| Wireframe diagrams (labeled elements)                            | ❌ Reads but doesn't cross-check each element |
| Inline prose ("← Back at top left of both pages")                | ❌ Often skipped                              |
| Navigation entry points ("how does a user reach this page?")     | ❌ Consistently missed                        |
| Integration with existing UI (sidebar badges, parent page links) | ❌ Consistently missed                        |
| Error/loading/empty states                                       | ⚠️ Loading yes, empty often forgotten         |

**The fix**: Mandatory Completion Audit (Step 7) — Claude re-reads the spec _as an auditor_ and generates a 7-category checklist. Every ❌ is fixed before declaring complete.

---

## What Already Exists (Don't Replace)

```
.claude/
  commands/
    dev.md              ← /dev slash command (keep as-is)
  core_rules.md         ← coding standards (needs small fixes only)
  settings.json / settings.local.json

CLAUDE.md               ← root-level (replace with new content in section 6)
scripts/
  test-staged.mjs       ← pre-commit targeted test runner (keep as-is)
tests/
  __mocks__/
    prisma.ts           ← shared mock with $transaction already implemented — import, never recreate
    supabase.ts         ← shared mock — import, never recreate
  setup.ts              ← auto-loaded via vitest.config.ts setupFiles
```

---

## Files to Create / Edit

| Action     | File                                                      |
| ---------- | --------------------------------------------------------- |
| **Create** | `.claude/commands/implement-group.md`                     |
| **Create** | `.claude/commands/verify-group.md`                        |
| **Create** | `.claude/commands/write-tests.md`                         |
| **Create** | `.claude/commands/quality-gate.md`                        |
| **Create** | `.claude/commands/db-change.md`                           |
| **Edit**   | `CLAUDE.md` (replace entirely with section 6 content)     |
| **Edit**   | `.claude/core_rules.md` (targeted edits only — section 7) |

---

## 1. `/implement-group` — `.claude/commands/implement-group.md`

**Invocation**: `/implement-group <N> <plan-file>`
Example: `/implement-group 4 execution_plan/plans/online_payment_upi.md`

### Step 1 — Extract only the target group section

Do NOT read the full file. Use this two-step approach:

```bash
# Step 1a: Find all group headers to get line number boundaries
grep -n "^### Group" execution_plan/plans/online_payment_upi.md
# Output example:
#   1637: ### Group 1 — Foundation
#   1655: ### Group 2 — Admin UPI Setup
#   1668: ### Group 3 — Resident Pay Flow
#   1683: ### Group 4 — Admin Claim Verification
#   1699: ### Group 5 — Subscription Flow

# Step 1b: Read ONLY the lines for group N using the Read tool's offset/limit
# e.g. for Group 4: offset=1683, limit=(1699-1683)=16 lines
```

**Note**: Different plan files may use "Phase", "Step", or "Group". Always grep first to see how sections are named in that specific file.

Read the extracted section. Stop. Do not read any other section.

### Step 2 — Pre-flight checks (before writing any code)

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

### Step 3 — TodoWrite task list

Create one task per source-file+test-file pair. Mark both complete together.

### Step 4 — Implement each file → write its test immediately → track the test file

For each source file in the group:

1. Implement the source file per the plan spec
2. Immediately write (or update) its test file — **never batch all tests at the end**
3. Run `npx vitest run <that-test-file>` — fix until it passes
4. **Add this test file path to a running list** (this list is used in Step 6)
5. Mark the task complete in TodoWrite

**Note on shared test files**: Some source files share one test file (e.g., a route + its upload sub-route both tested in `resident-payment-claims.test.ts`). Check if a test already exists for this source before creating a new one.

**Large group handling**: If a group has more than 5 source files, split it into two sub-sessions:

- First half: implement → test → Step 5–7 → commit
- Second half: implement → test → Step 5–7 → commit
  Commit at the midpoint so context window stays manageable.

### Step 5 — Update `vitest.config.ts` coverage.include

After all source files exist, open `vitest.config.ts` and check the `coverage.include` array. Add any new source file paths that are missing. Files absent here are invisible to the 95% threshold and will not appear in coverage reports.

### Step 6 — Run the group quality gate

Using the test-files list built in Step 4:

```bash
npm run lint                              # zero errors required
npx vitest run <test-files from Step 4>   # NOT test:staged — files aren't staged yet
npx tsc --noEmit                          # fast type check (not npm run build)
```

Fix every failure before proceeding. Never skip forward with a failure open.

Only run `npm run build` on the final group of a feature branch or when explicitly asked.

### Step 7 — Completion Audit (MANDATORY)

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
✅/❌ All test files pass: npx vitest run <each file individually>
✅/❌ 95%+ lines/branches/functions/statements per source file
```

Any ❌ → fix immediately. Do not report "complete" with open items.

### Step 8 — Report and update memory

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

---

## 2. `/verify-group` — `.claude/commands/verify-group.md`

**Invocation**: `/verify-group <N> <plan-file>`
Example: `/verify-group 3 execution_plan/plans/online_payment_upi.md`

Use when: "re-check that group N is properly implemented" or when resuming after a previous session claimed completion.

### What it does

Runs the full 7-category audit (A–G from Step 7 above) against the existing codebase, fixing each gap as found.

**Step 1** — Extract the group section using the same grep → Read approach as `/implement-group` Step 1.

**Step 2** — Run through all 7 categories (A through G), reading actual source and component files to verify requirements. Do not rely on memory or previous session output.

**Step 3** — For each ❌: implement the fix immediately. This is an audit-and-repair command, not read-only.

**Step 4** — After all fixes: run the quality gate (Variant A — implementation context).

**Step 5** — Report every gap found, every fix applied, and the final state. Update memory.

---

## 3. `/write-tests` — `.claude/commands/write-tests.md`

**Invocation**: `/write-tests <source-file-path>`

### Choose the right mock pattern for the file type

---

**API route handlers** (`src/app/api/**`): `vi.hoisted()` — mocks must exist before the module import executes.

```typescript
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));

// Additional hoisted mocks if needed:
// const { mockOtherDep } = vi.hoisted(() => ({ mockOtherDep: vi.fn() }));
// vi.mock("@/lib/other", () => ({ otherDep: mockOtherDep }));

// Import shared mocks AFTER vi.mock declarations
import { mockPrisma } from "../__mocks__/prisma";
// import { mockStorageBucket, mockSupabaseAdmin } from "../__mocks__/supabase"; // if storage used

// Import route handler LAST
import { GET, POST } from "@/app/api/v1/.../route";

describe("GET /api/v1/...", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockUser); // set default happy path
    mockPrisma.model.findMany.mockResolvedValue([]);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });
  // 422, 400, 404, 500, 200/201 tests...
});
```

**Note**: `$transaction` is already in the shared mock — do not add it. The existing implementation handles both `prisma.$transaction(callback)` and `prisma.$transaction([promise1, promise2])`.

---

**Service files** (`src/services/**`): module-level `global.fetch` mock. No `vi.hoisted` needed.

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fnToTest } from "@/services/foo";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("foo service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POSTs and returns data", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: {} }) });
    const result = await fnToTest({ field: "value" });
    expect(result.data).toBeDefined();
    expect(mockFetch).toHaveBeenCalledWith("/api/...", expect.objectContaining({ method: "POST" }));
  });

  it("throws on error response", async () => {
    mockFetch.mockResolvedValue({ ok: false, text: () => Promise.resolve("ERROR_CODE") });
    await expect(fnToTest({ field: "value" })).rejects.toThrow("ERROR_CODE");
  });
});
```

---

**React components** (`src/components/**`): `vi.mock()` at module level. Add `QueryClientProvider` wrapper if the component uses TanStack Query hooks.

```typescript
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ComponentName } from "@/components/features/.../ComponentName";

vi.mock("sonner", () => ({ toast: vi.fn() }));          // always mock toast
vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({ user: { id: "u1", societyId: "s1", role: "ADMIN" } })),
}));
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  usePathname: vi.fn(() => "/"),
  useSearchParams: vi.fn(() => ({ get: vi.fn(() => null) })),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("ComponentName", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  // Rendering tests — use wrap()
  it("renders the amount", () => {
    wrap(<ComponentName amount={2000} />);
    expect(screen.getByText(/2,000/)).toBeInTheDocument();
  });

  // Interaction tests — use userEvent.setup() INSIDE the test
  it("copies UPI ID on button click", async () => {
    const user = userEvent.setup();
    // Spy AFTER userEvent.setup() — it installs its own clipboard stub
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    wrap(<ComponentName upiId="test@sbi" />);
    await user.click(screen.getByRole("button", { name: /copy/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("test@sbi"));
    expect(toast).toHaveBeenCalled();
  });
});
```

---

**Next.js pages** (`src/app/**/page.tsx`): `vi.hoisted()` for fetch + mock all heavy child components.

```typescript
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));
globalThis.fetch = mockFetch;

vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(() => ({ get: vi.fn((_k: string) => null) })),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({ user: { societyId: "s1" } })),
}));
// Mock heavy child components to isolate the page
vi.mock("@/components/features/SomeFeature", () => ({
  SomeFeature: ({ prop }: { prop: string }) => <div data-testid="some-feature">{prop}</div>,
}));
vi.mock("@/components/ui/LoadingSkeleton", () => ({
  PageSkeleton: () => <div data-testid="page-skeleton" />,
}));
// Mock services that use fetch internally
vi.mock("@/services/some-service", () => ({ someServiceFn: vi.fn() }));

import { useSearchParams } from "next/navigation";
import { someServiceFn } from "@/services/some-service";
import PageComponent from "@/app/.../page";

const mockUseSearchParams = vi.mocked(useSearchParams);
const mockSomeServiceFn = vi.mocked(someServiceFn);

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><PageComponent /></QueryClientProvider>);
}

describe("PageComponent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSearchParams.mockReturnValue({ get: (k: string) => k === "id" ? "val-1" : null } as ReturnType<typeof useSearchParams>);
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ items: [] }) });
  });

  it("shows loading skeleton while fetching", () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    renderPage();
    expect(screen.getByTestId("page-skeleton")).toBeInTheDocument();
  });
  // error state, empty state, success state, amount calculations...
});
```

---

**Custom hooks** (`src/hooks/**`): `renderHook` from `@testing-library/react`.

```typescript
import React from "react";
import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useHookName } from "@/hooks/useHookName";

// If the hook reads from a context, wrap with a provider:
function wrapper({ children }: { children: React.ReactNode }) {
  return <SomeContext.Provider value={mockValue}>{children}</SomeContext.Provider>;
}

describe("useHookName", () => {
  it("returns the expected value", () => {
    const { result } = renderHook(() => useHookName(), { wrapper });
    expect(result.current.someField).toBe("expected");
  });

  it("returns defaults when no provider", () => {
    const { result } = renderHook(() => useHookName());
    expect(result.current.someField).toBeNull();
  });
});
```

---

### Coverage requirements

- 95% lines, branches, functions, statements **per file**
- Every branch: `if/else`, ternary, `?.`, `??`
- API routes: 401 (unauth), 422 (invalid input), 400 (business rule), 404 (not found), 500 (DB error), 201/200 (success)
- Components/pages: loading, error, empty, success states

### File location convention

```
src/services/payment-claims.ts         → tests/services/payment-claims.test.ts
src/components/features/X/Foo.tsx      → tests/components/X/Foo.test.tsx
src/app/api/v1/residents/me/.../route  → tests/api/resident-payment-claims.test.ts
src/app/r/payments/pay/page.tsx        → tests/app/r/payments/pay/page.test.tsx
src/lib/config/payment.ts              → tests/lib/config/payment.test.ts
src/hooks/useHookName.ts               → tests/hooks/useHookName.test.ts
```

### After writing tests

Run `npx vitest run <test-file>`. Do **not** use `test:staged` — the file is not staged yet.

---

## 4. `/quality-gate` — `.claude/commands/quality-gate.md`

**Two variants — context determines which to use:**

### Variant A — During implementation (files created, not staged)

```bash
npm run lint                              # zero errors required
npx vitest run <test-files from Step 4>   # the list built during implementation
npx tsc --noEmit                          # ~5s type check — NOT npm run build
```

`npm run build` only on the final group of a feature branch or when explicitly asked.

### Variant B — Pre-commit (files staged, before git commit)

```bash
npx lint-staged        # ESLint + Prettier on staged files
npm run test:staged    # targeted tests for staged files only
npx tsc --noEmit
```

The Husky hook runs Variant B automatically on `git commit`. Only run manually to pre-check staged state.

### Reporting rule

Stop on first failure. Fix it. Re-run that step. Never skip forward.

```
✅ Lint — clean
✅ Tests — 34 passed (tests/services/..., tests/api/...)
✅ Type check — no errors

❌ Lint — 1 error in src/services/foo.ts:
  Line 45: 'result' is assigned a value but never used
→ Fixing now...
```

---

## 5. `/db-change` — `.claude/commands/db-change.md`

**Invocation**: `/db-change` whenever editing `supabase/schema.prisma` or adding a migration.

```bash
# FORBIDDEN — use the pooler (port 6543) which times out on DDL:
# npm run db:push       ← NEVER
# npm run db:migrate    ← NEVER

# 1. Write the migration SQL file:
#    supabase/migrations/YYYYMMDDNNNNNN_description.sql
#    e.g. 20260405000001_add_payment_claims.sql

# 2. Apply via DIRECT connection (port 5432, not 6543):
DATABASE_URL="postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres" \
  npx prisma db push --schema supabase/schema.prisma

# 3. Regenerate Prisma client — ALWAYS before writing app code:
npm run db:generate

# 4. Update tests/__mocks__/prisma.ts — add new model mock objects
#    Do NOT add $transaction — it is already implemented in the shared mock

# 5. Platform config data → ask user approval before seeding anything
```

---

## 6. Updated `CLAUDE.md` — exact replacement content

```markdown
# CLAUDE.md

## Project Overview

Eden Estate RWA management app — Next.js 16, React 19, TypeScript strict, Tailwind v4, Prisma, Supabase.

## Commands

\`\`\`bash
npm run dev # Dev server — http://localhost:3000
npm run build # Production build (prisma generate + next build)
npm run lint # ESLint — zero errors required before commit
npm run format # Prettier
npx tsc --noEmit # Fast type check (~5s) — use during dev instead of build
npm run test # Full test suite (Vitest, no coverage)
npm run test:coverage # Full test suite + V8 coverage report
npm run test:staged # Tests for staged files only (used by pre-commit hook)
npm run db:generate # Regenerate Prisma client after schema changes
npm run db:seed:master # Seed platform master data
npm run db:seed:dev # Seed dev/demo data
\`\`\`

## Architecture

- **Framework**: Next.js 16 App Router, React 19, TypeScript strict
- **Styling**: Tailwind CSS v4 via PostCSS
- **DB**: Prisma + Supabase (`supabase/schema.prisma`; mocks in `tests/__mocks__/`)
- **Path alias**: `@/*` → `./src/*`

### Directory Structure

\`\`\`
src/app/ # Pages, layouts, API route handlers (App Router)
src/components/ # ui/ primitives + features/ composed components
src/hooks/ # Custom React hooks
src/lib/ # Config, utils, Prisma client, validations
src/services/ # Client-side fetch wrappers
src/types/ # Shared TypeScript types
tests/ # Mirrors src/ structure; **mocks**/ for Prisma & Supabase
supabase/ # schema.prisma, migrations/, seed files
execution_plan/ # Build plans — read only the target group section, not the full file
\`\`\`

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
```

---

## 7. Targeted edits to `.claude/core_rules.md`

**Section 12 — Test Coverage Rules**: Replace last 4 bullet points with:

```
- Vitest is the configured test runner — zero configuration needed
- Test files live in `tests/` mirroring src/ (no underscores — NOT __tests__/)
- Run one file: `npx vitest run tests/path/to/file.test.ts`
- API route tests MUST use `vi.hoisted()` — see /write-tests for verbatim pattern
- Always `import { mockPrisma } from "../__mocks__/prisma"` — never declare inline
- Always `import { mockStorageBucket, mockSupabaseAdmin } from "../__mocks__/supabase"` for storage tests
- `$transaction` is already in the shared mock — do not add it to new model entries
```

**Section 13 — Database Rules**: Add at top:

```
- NEVER use `npm run db:push` or `npm run db:migrate` — they use the pooler (port 6543)
  which times out on DDL. Use /db-change for the correct direct-connection sequence.
```

---

## What the Workflow Looks Like After This

**Before** (current):

```
User: "implement group 4"
→ Claude reads full 86KB plan (23K tokens consumed at start)
→ Implements all files, batches tests at end
→ Tests use wrong mock pattern → fix iterations
→ Says "complete" → user re-checks → 3 gaps found → another session to fix
Total: 60–90 min, 40–60K tokens
```

**After** (with commands):

```
User: "/implement-group 4 execution_plan/plans/online_payment_upi.md"
→ grep finds Group 4 at line 1683, Group 5 at line 1699 → reads 16 lines (~400 tokens)
→ Pre-flight: no new Prisma models in Group 4 → proceed
→ File 1: implement → test immediately → npx vitest run passes ✅ → task done
→ File 2: implement → test immediately → passes ✅
→ ... (tracks test file list throughout)
→ vitest.config.ts updated with 3 new paths
→ Quality gate (Variant A): lint ✅ vitest run all 5 test files ✅ tsc ✅
→ Completion Audit:
    A. Files ✅  B. Endpoints ✅  C. Navigation ❌ (admin claims page missing sidebar link)
    → fix sidebar → ✅
    D. UI spec ✅  E. States ✅  F. Integration ✅  G. Tests ✅
→ "Group 4 complete" — all 7 categories ✅
→ Memory updated: "Group 4 done, 6 source files, 4 test files"
Total: 20–30 min, ~10K tokens
```

---

## Realistic Token Savings Per Session

| Source                                  | Before          | After                       | Saved                 |
| --------------------------------------- | --------------- | --------------------------- | --------------------- |
| Plan file reading                       | 23K (full file) | ~0.5K (grep + 16 lines)     | ~22.5K                |
| Test pattern re-derivation + fix rounds | 6K              | 0 (verbatim templates)      | ~6K                   |
| Post-impl gap-finding sessions          | 8K              | 0 (audit catches it inline) | ~8K                   |
| Quality gate confusion / wrong commands | 1.5K            | 0                           | ~1.5K                 |
| **Total per group session**             | **~38K**        | **~10K**                    | **~28K saved (~74%)** |

---

## Out of Scope

- Superpowers system-level skills (global to all projects, not project-specific)
- Playwright / E2E test commands
- CI/CD pipeline changes
