# Skills Design — Generic Developer Workflow System

## Purpose

This plan redesigns the Claude Code skill system to be **completely generic** — skills that work for
any feature, any plan document, any tech stack. Project-specific details (commands, file paths,
patterns) belong in `CLAUDE.md` and `core_rules.md`. Skills contain only process and methodology.

---

## Core Principle: The Three-Layer Model

```
Skills (.claude/commands/)     → Process only. Generic. "Run your linter."
CLAUDE.md                      → Project config. "Linter = npm run lint"
core_rules.md                  → Project standards. Test patterns, coding rules.
```

Skills never hardcode tool names, file paths, or commands. When a skill says "run your linter,"
Claude reads CLAUDE.md to know what that means for this project. This means the same skill file
works in a Vite+Jest project, a Django project, or a Go service — only CLAUDE.md changes.

---

## Problems With Current Skills (What This Fixes)

| Problem                                     | Current                                                     | Fixed                                                                     |
| ------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| Project paths in skills                     | `tests/__mocks__/prisma.ts` hardcoded in implement-group    | "Update your mock infrastructure (see CLAUDE.md)"                         |
| Tool names hardcoded                        | `npx vitest run`, `vitest.config.ts coverage.include`       | "Run your test runner / update your coverage config (see CLAUDE.md)"      |
| Phase audit reads only phase section        | Misses UI Pages Summary, global wireframes                  | verify-phase reads phase section + plan's global pages table              |
| "Extend" pages never verified for existence | Labeled "Extend" → skipped in audit                         | Explicitly check: does this page exist? If not, create it                 |
| No skill for creating plan documents        | Plans written ad-hoc → scattered info → implementation gaps | /plan-feature enforces self-contained phases                              |
| No skill for targeted coverage repair       | Coverage gaps fixed manually                                | /fix-coverage: read report → identify lines → add targeted tests          |
| db-change is a generic skill                | Supabase/Prisma-specific in a generic slot                  | Move to project-level commands, not generic skills                        |
| Test templates in write-tests               | Concrete vi.hoisted patterns baked into skill               | Templates stay in core_rules.md; skill says "use your project's patterns" |
| Phase audit stops at group boundary         | Sub-features like "extend existing page" missed             | Audit cross-references global plan sections                               |

---

## Skill Inventory

| Skill              | File                 | Purpose                                                                   |
| ------------------ | -------------------- | ------------------------------------------------------------------------- |
| `/plan-feature`    | `plan-feature.md`    | NEW — Create a structured, implementation-ready plan doc for any feature  |
| `/implement-phase` | `implement-phase.md` | Replaces implement-group — generic phase implementation with full quality |
| `/verify-phase`    | `verify-phase.md`    | Replaces verify-group — audit any phase + global plan sections            |
| `/write-tests`     | `write-tests.md`     | Update — defer templates to core_rules.md                                 |
| `/quality-gate`    | `quality-gate.md`    | Update — defer all commands to CLAUDE.md                                  |
| `/fix-coverage`    | `fix-coverage.md`    | NEW — targeted coverage gap repair for specific files                     |

**Removed from generic skills**: `db-change.md` → becomes a project-specific command in CLAUDE.md.

---

## CLAUDE.md Contract

Every project using these skills MUST define these sections in CLAUDE.md. Skills reference these
by name. If a section is missing, the skill cannot function correctly.

```markdown
## Test Runner

- Run one file: `<command> <file>`
- Run multiple files: `<command> <file1> <file2>`
- Run with coverage: `<command with coverage flags> --coverage.include=<file>`
- Coverage threshold: <N>% lines/branches/functions/statements per file
- Coverage config file: `<path>` — property: `<key>` (add new source files here)

## Quality Gate Commands

- Linter: `<command>` — zero errors required
- Type checker: `<command>` — fast check, NOT full build
- Full build: `<command>` — run only on final phase or when explicitly asked
- Pre-commit staged test: `<command>` — only for staged files

## Mock Infrastructure

- Database mock file: `<path>` — import from here, never recreate inline
- Storage mock file: `<path>` — import from here for storage tests
- New data model template: see core_rules.md Section [N]

## Test Patterns

See core_rules.md Section [N] for:

- API route handler tests
- Service/client tests
- Component tests
- Page tests
- Hook tests
```

---

## Skill 1: `/plan-feature`

**File**: `.claude/commands/plan-feature.md`
**Invocation**: `/plan-feature`
**When to use**: Before writing any code for a new feature. Creates the plan document.

### What it does

Produces a complete, implementation-ready plan document at `execution_plan/plans/<feature-name>.md`.

### Process

**Step 1 — Gather requirements**
Ask the user (if not already provided):

- What is the feature name and one-line description?
- What user roles does it affect?
- What data needs to be stored (new tables, modified fields)?
- What are the key user flows?
- Any existing pages/components to extend?
- Any out-of-scope items?

**Step 2 — Check existing codebase**
Before writing a single line of the plan:

- For every "extend existing" page mentioned: verify it exists in the filesystem
- For every new data model: check if similar models exist for pattern reference
- For every new API endpoint: check existing endpoints for auth pattern reference
- For every mentioned component: check if a similar component already exists

**Step 3 — Draft the plan structure**

Enforce this structure without exception:

```
# Plan: <Feature Name>

## Scope
<One paragraph: what this feature does and does not cover.>

## Prerequisites
<What must exist before implementation starts. Schema migrations, env vars, etc.>

## Database Changes (omit section if none)
<New tables, modified columns, new enum values. SQL + Prisma schema both.>

## API Endpoints
<Complete table: Method | Path | Auth Level | Description>

## UI Pages Summary
<Complete table: Page | Path | Who | Status (New/Extend) | Notes>
For every "Extend" row: confirm the page exists (grep/find), note the file path.

## Component Inventory
<Table: Component | File | New/Modified | Used By>

## Service/Utility Files
<Table: File | Purpose | New/Modified>

## Test File Map
<Table: Source File | Test File | Key Scenarios (comma-separated)>

## Implementation Phases
(Each phase is SELF-CONTAINED — all info needed is within the phase section.)

### Phase N — <Name>
#### What this phase delivers
<One sentence.>

#### Files
<Table: File | Type | New/Modified>

#### API Endpoints in this phase
<Repeat only endpoints from this phase.>

#### UI Specs
<For each page in this phase: wireframe, loading/error/empty/success states.>
<For "Extend" pages: exact file path + what section to add + where in the file.>

#### Integration Points
<Sidebar badges, parent page links, navigation entry points, existing page extensions.
For every new page: "Accessible from: [specific location]."
For every "Extend" page: "Existing page at [path] — add [section] after line ~[N].">

#### Edge Cases
<Table: Case | Handling>

#### Test Scenarios
<Table: File | Scenarios>

#### Quality Gate
<List of test files to run for this phase's quality gate.>

---
```

**Step 4 — Phase sizing and ordering**

Rules enforced automatically:

- No phase has more than 5 source files (split if needed)
- Phase order: schema migration → backend (API routes, services) → components → pages
- Each phase must be independently committable and testable
- If a page "extends" another: both must be in the same phase OR the base page must be in an earlier phase

**Step 5 — Self-containment validation**

Before outputting the plan, run this checklist:

- [ ] Every "Extend" page in UI Pages Summary has a confirmed file path
- [ ] Every API endpoint has its auth level specified
- [ ] Every phase section contains its own copy of relevant endpoint rows (no "see above")
- [ ] Every new page has its navigation entry point specified in Integration Points
- [ ] Every page has loading/error/empty/success states described in UI Specs
- [ ] No phase has more than 5 source files
- [ ] Phase order respects dependencies (schema before API, API before UI)
- [ ] Every phase has its own Quality Gate list

Flag any failed checks and fix before outputting.

---

## Skill 2: `/implement-phase`

**File**: `.claude/commands/implement-phase.md`
**Invocation**: `/implement-phase <N> <plan-file>`
**When to use**: Implementing any phase of any plan document.

### Process

**Step 1 — Extract only the target phase section**

Do NOT read the full plan file. Use a two-step approach:

```bash
# Step 1a: Find all phase/group/step headers and their line numbers
grep -En "^#{1,4} (Phase|Group|Step|Epic|Task|Sprint) [0-9]" <plan-file>

# Step 1b: Read ONLY the target section using offset/limit
# Calculate: offset = start line of phase N, limit = (start line of phase N+1) - offset
```

The section keyword varies by plan file. Always grep first. Read the extracted section only.

**Step 2 — Pre-flight checks**

a) Check project context: read CLAUDE.md for test runner, coverage config, mock infrastructure.

b) For each file listed in the phase:

- Check if it already exists
- If yes: read it before writing anything — never overwrite working code

c) If the phase adds new data models:

- Update the project's mock infrastructure (per CLAUDE.md "Mock Infrastructure" section)
- Add new models following the existing pattern in that file
- Do NOT add infrastructure that already exists (check first)

d) For each "Extend" page in the phase's Integration Points:

- Verify the target file exists: if it doesn't, create it first (the "Extend" label in the
  plan assumes existence; treat a missing "Extend" page the same as a "New" page)

**Step 3 — TodoWrite task list**

One task per source-file + test-file pair. Mark complete immediately when both are done.
Keep exactly ONE task in_progress at a time.

**Step 4 — Implement → test → coverage, file by file**

For each source file in the phase (never batch; do one at a time):

1. Implement the source file per the phase spec
2. Check if a test file already exists for this source — if yes, update it; if no, create it
   (Follow your project's test patterns from core_rules.md)
3. Run: `[test runner from CLAUDE.md] <test-file>` — fix until it passes
4. Check coverage for this file against your project's threshold (CLAUDE.md):
   `[coverage command from CLAUDE.md] --coverage.include=<source-file>`
   Fix any file below threshold before moving to the next file
5. Add the test file path to a running list (used in Step 6)
6. Mark the task complete

**Note on shared test files**: Some source files share one test file. Check before creating new.

**Step 5 — Update coverage configuration**

After all source files exist, update your project's coverage config (CLAUDE.md "Coverage config
file") to include all new source file paths. Files absent from this config are invisible to
threshold enforcement.

**Step 6 — Quality gate**

Run in this order, stop on first failure:

1. **Linter** (from CLAUDE.md) — zero errors required
2. **Test suite** — run all test files from the list built in Step 4
3. **Type checker** (from CLAUDE.md) — fast check, NOT full build

Full build: only on the final phase of a feature branch, or when explicitly requested.

Fix every failure before proceeding. Do not mark the gate as passed with open failures.

**Step 7 — Completion Audit (7 categories, MANDATORY)**

Re-read the extracted phase section. Also run a targeted grep on the plan file for global
sections (UI Pages Summary, Component Inventory) to find anything this phase touches:

```bash
grep -n "UI Pages Summary\|Component Inventory\|API Endpoints" <plan-file>
# Read those sections (offset/limit) to find rows relevant to this phase
```

Verify each category:

**A. File Checklist**
For every file in the phase's file table:

```
✅/❌ <path> — exists, implements spec
```

**B. API Endpoint Checklist**
For every endpoint in the phase:

```
✅/❌ METHOD /path — auth check present? input validated? correct response shape?
```

**C. Page Navigation Checklist**
For every page in the phase AND every page in the plan's UI Pages Summary that this phase touches:

```
✅/❌ /path — New or Extend?
     New: navigation entry point exists (link/card from parent, sidebar item, etc.)
     Extend: target file confirmed to exist AND extension confirmed to be present
```

If any "Extend" page doesn't exist → create it. If any "New" page has no navigation entry → add one.

**D. UI Spec Checklist**
For every page in the phase, read its wireframe/spec in the phase section element by element:

```
✅/❌ Every labeled wireframe element exists in the component
✅/❌ Inline prose requirements ("← Back at top left") are implemented
✅/❌ Amount/currency formatted per spec
✅/❌ Copy button, toast, loading spinner — every interactive element present
```

**E. State Checklist**
For every page and interactive component in the phase:

```
✅/❌ Loading state
✅/❌ Error state (what renders when API fails?)
✅/❌ Empty state (what renders when list is empty?)
✅/❌ Success state (what renders after action completes?)
```

**F. Integration Checklist**

```
✅/❌ Every "accessible from" entry in Integration Points is implemented
✅/❌ Every sidebar badge update specified in the phase is implemented
✅/❌ Every parent page that needs a link/card to a new sub-page has it
✅/❌ Every "Extend" page was actually extended (new section is present, old sections unbroken)
```

**G. Test Coverage Checklist**

```
✅/❌ All new source files added to coverage config
✅/❌ Every new/modified source file has a corresponding test file
✅/❌ All test files pass individually
✅/❌ Every file meets the project's coverage threshold (CLAUDE.md)
```

For any ❌: fix immediately. Do not declare complete with open items.

**Step 8 — Report and update memory**

Only after all 7 categories are ✅:

```
Phase N — COMPLETE ✅

Files created: X source, Y test
Audit:
  A. Files:        ✅ all N files exist and match spec
  B. Endpoints:    ✅ all routes auth'd, validated, correct shape
  C. Navigation:   ✅ all pages reachable / all extends verified
  D. UI spec:      ✅ all wireframe elements present
  E. States:       ✅ loading/error/empty/success handled
  F. Integration:  ✅ navigation, badges, parent links in place
  G. Tests:        ✅ all pass, threshold met per file

Files to stage:
  <list every new/modified file>
```

Update project memory: record phase as complete, list key files created, note any non-obvious
decisions. This prevents the next session from re-discovering completion state.

### Large phase handling

If a phase has more than 5 source files:

- Split into two sub-sessions (first half → Steps 1–8 → commit, then second half)
- Commit the first half before starting the second half
- This keeps the context window manageable and gives clean recovery points

### Session recovery

If this session must end before the phase is complete:

- Update project memory: record last completed file, remaining files, any open issues
- The next session reads memory first, then resumes from the next uncompleted file

---

## Skill 3: `/verify-phase`

**File**: `.claude/commands/verify-phase.md`
**Invocation**: `/verify-phase <N> <plan-file>`
**When to use**: Re-checking any previously implemented phase; auditing a full feature.

### What it does

Full 7-category audit (A–G from implement-phase Step 7) against the existing codebase.
Fixes every gap found. This is audit-and-repair, not read-only.

### Process

**Step 1 — Extract target section + global sections**

```bash
# Get all phase headers
grep -En "^#{1,4} (Phase|Group|Step|Epic|Task|Sprint) [0-9]" <plan-file>

# Read the target phase section (offset/limit)
# Also find and read global sections: UI Pages Summary, Component Inventory
grep -n "UI Pages Summary\|Component Inventory\|Key Files\|API Endpoints\|Test Coverage" <plan-file>
# Read each global section (offset/limit)
```

Do NOT rely on previous session output or memory alone — read actual source files to verify.

**Step 2 — Run 7-category audit**

Execute categories A–G from implement-phase Step 7 in full.

**Critical differences from implement-phase audit:**

For Category C (Page Navigation): check the plan's global UI Pages Summary for ALL rows,
not just rows mentioned in the phase section. Every "Extend" page listed anywhere in the plan
must exist in the filesystem. If it doesn't exist and it belongs to this phase → create it.

For Category G (Tests): for each source file, run coverage and verify against project threshold.
Do not accept "tests pass" as sufficient — coverage must be measured.

**Step 3 — Fix every ❌ immediately**

For each gap found:

1. Implement the fix
2. Re-run the affected category check
3. Run the quality gate for the modified files
4. Confirm the ❌ is now ✅ before moving to the next gap

**Step 4 — Quality gate**

After all fixes:

1. Linter (from CLAUDE.md)
2. Full test suite for this phase
3. Type checker (from CLAUDE.md)

**Step 5 — Report and update memory**

List every gap found, every fix applied, final state per category.
Update memory to reflect current implementation status.

---

## Skill 4: `/write-tests`

**File**: `.claude/commands/write-tests.md`
**Invocation**: `/write-tests <source-file-path>`
**When to use**: Writing or completing tests for any source file.

### Process

**Step 1 — Identify file type**
From the file path, determine the type:

- `src/app/api/**/route.ts` → API route handler
- `src/services/**` → Client service / fetch wrapper
- `src/components/**` → React component
- `src/app/**/page.tsx` → Next.js page
- `src/hooks/**` → Custom hook
- `src/lib/**` → Utility / library function

**Step 2 — Read project test patterns**
Read `core_rules.md` Section for Test Coverage Rules — this is where the project's concrete
mock patterns, import conventions, and wrapper utilities live. Do not derive patterns from
scratch; use what's documented there.

**Step 3 — Read the source file**
Read the complete source file. List every:

- Branch (`if/else`, ternary, `?.`, `??`, `||`, `&&`)
- Error path (throw, error response, null return)
- Async operation (DB call, fetch, queue)
- Edge case mentioned in comments

**Step 4 — Write tests**
Apply the project's patterns from core_rules.md. Cover every item from Step 3:

- Every auth/permission check → one test per case (unauthenticated, wrong role, correct)
- Every validation rule → one test per invalid case + one valid case
- Every error path → one test (DB error → 500, not found → 404, etc.)
- Every branch in business logic → one test per branch
- For UI: loading, error, empty, success states

**Step 5 — Run and verify**
Run the test file: `[test runner from CLAUDE.md] <test-file>`
Fix until all tests pass.
Run coverage: `[coverage command from CLAUDE.md] --coverage.include=<source-file>`
Fix until project threshold is met (from CLAUDE.md).

### File location convention

Test file mirrors the source file path under `tests/`:

```
src/services/foo.ts              → tests/services/foo.test.ts
src/components/features/X/Y.tsx → tests/components/X/Y.test.tsx
src/app/api/v1/.../route.ts      → tests/api/<descriptive-name>.test.ts
src/app/r/payments/page.tsx      → tests/app/r/payments/page.test.tsx
src/lib/config/payment.ts        → tests/lib/config/payment.test.ts
src/hooks/useHookName.ts         → tests/hooks/useHookName.test.ts
```

---

## Skill 5: `/quality-gate`

**File**: `.claude/commands/quality-gate.md`
**Invocation**: `/quality-gate`
**When to use**: Any time a quality check is needed. Context determines which variant.

### Variant A — During implementation (files exist, not staged)

Run in order, stop on first failure:

1. **Linter** — run your project's linter (see CLAUDE.md "Quality Gate Commands")
   Zero errors required. Pre-existing warnings are acceptable.
2. **Tests** — run your project's test runner for the files you've been working on
   (see CLAUDE.md "Test Runner"). NOT the pre-commit staged variant — files aren't staged yet.
3. **Type checker** — run your project's type checker (see CLAUDE.md)
   This is the fast check (seconds), NOT the full build.

Do NOT run the full build unless on the final phase of a feature branch or explicitly asked.

### Variant B — Pre-commit (files staged)

Run in order, stop on first failure:

1. **Linter** — staged files only (lint-staged or equivalent)
2. **Staged tests** — your project's staged test runner (see CLAUDE.md "Pre-commit staged test")
3. **Type checker**

### Reporting format

```
✅ Linter — clean
✅ Tests — N passed (list test files)
✅ Type check — no errors

❌ Linter — 1 error in src/foo.ts:45 — 'x' is assigned but never used
→ Fixing now...
```

Stop on first failure. Fix. Re-run that step only. Never skip forward.

---

## Skill 6: `/fix-coverage`

**File**: `.claude/commands/fix-coverage.md`
**Invocation**: `/fix-coverage <source-file> [test-file]`
**When to use**: A source file is below the coverage threshold. Find and fix the gaps.

### Process

**Step 1 — Get the coverage report**
Run coverage for the specific file (see CLAUDE.md "Test Runner — Run with coverage"):
`[coverage command] --coverage.include=<source-file>`

Read the output. Note every uncovered line number and branch.

**Step 2 — Read the source file at those lines**
For each uncovered line/branch:

- Read the surrounding context (5–10 lines)
- Identify what condition or code path is not being exercised
- Note: optional chaining `?.`, nullish coalescing `??`, ternary branches, try/catch blocks,
  early returns, and fire-and-forget async patterns are the most common coverage gaps

**Step 3 — Add targeted tests**
In the test file, add exactly the tests needed to cover the identified gaps.
Do not add tests for lines that are already covered — targeted additions only.
Follow the project's test patterns from core_rules.md.

**Step 4 — Verify**
Re-run coverage. Confirm every previously-uncovered line is now green.
If still gaps, repeat from Step 2.

**Step 5 — Run quality gate Variant A**
After coverage passes, confirm lint and type check are still clean.

---

## Implementation Phases (How to Build These Skills)

### Phase 1 — Create `/plan-feature` skill

**Files:**

- Create `.claude/commands/plan-feature.md` with content from Skill 1 spec above

**Verify**: Invoke `/plan-feature` manually with a simple feature description. Confirm the output
plan has all required sections and the self-containment checklist is applied.

### Phase 2 — Update `/implement-phase` skill

**Files:**

- Rename `.claude/commands/implement-group.md` → `implement-phase.md`
  OR create `implement-phase.md` and keep `implement-group.md` as a thin redirect

**Key changes from implement-group:**

- Remove all project-specific paths and commands — replace with CLAUDE.md references
- Step 7 Category C: add the "global sections" cross-check (grep for UI Pages Summary)
- Step 7 Category C: add the "Extend page existence" check
- Step 2d: add the pre-flight "Extend page verification" step
- Step 8: always update project memory

**Verify**: Run `/implement-phase` on a new trivial feature. Confirm no project-specific text
appears in the skill output; all commands reference CLAUDE.md.

### Phase 3 — Update `/verify-phase` skill

**Files:**

- Rename `.claude/commands/verify-group.md` → `verify-phase.md`

**Key changes from verify-group:**

- Step 1: explicitly reads global plan sections (UI Pages Summary etc.), not just phase section
- Step 2: Category C checks all UI Pages Summary rows, not just phase section rows
- Step 2: every "Extend" page existence is verified regardless of which phase added it

### Phase 4 — Update `/write-tests` and `/quality-gate`, create `/fix-coverage`

**Files:**

- Update `.claude/commands/write-tests.md`:
  - Remove all concrete code templates (vi.hoisted, mockPrisma, etc.) — these stay in core_rules.md
  - Replace with: "Use your project's test patterns from core_rules.md Section [Test Coverage]"
  - Keep: file type detection, coverage requirement, file location convention
- Update `.claude/commands/quality-gate.md`:
  - Remove specific command strings — replace with CLAUDE.md references
  - Keep: the two variants (implementation vs pre-commit), the reporting format, stop-on-failure rule
- Create `.claude/commands/fix-coverage.md` with content from Skill 6 spec above

### Phase 5 — Update CLAUDE.md and core_rules.md

**CLAUDE.md changes:**

- Add "Test Runner" section with the structured format from the CLAUDE.md Contract above
  (concrete commands for this project: vitest, coverage threshold 95%, vitest.config.ts)
- Add "Mock Infrastructure" section
  (concrete: `tests/__mocks__/prisma.ts`, `tests/__mocks__/supabase.ts`, model template)
- Update "Slash Commands" section: reflect new skill names (`implement-phase`, `verify-phase`,
  `fix-coverage`) alongside existing ones
- Remove `db-change` from the generic skill list — document it inline in the DB section of CLAUDE.md

**core_rules.md changes (Section 12 — Test Coverage Rules):**

- Ensure all concrete test patterns for this project live here in full:
  - API route handler pattern (vi.hoisted, mockPrisma import)
  - Service pattern (global.fetch)
  - Component pattern (QueryClientProvider, toast mock, userEvent.setup)
  - Page pattern (AuthContext, fetch mock)
  - Hook pattern (renderHook, wrapper)
- These are the patterns that `/write-tests` tells Claude to reference
- Every pattern should be a complete, runnable code block

**Quality gate for Phase 5**: manually invoke each skill and confirm it reads from CLAUDE.md
correctly. Invoke `/write-tests` on an existing file — confirm it uses core_rules.md patterns.

---

## How Skills Chain Together

```
User describes feature
        ↓
/plan-feature → execution_plan/plans/<feature>.md
        ↓
For each phase N:
  /implement-phase N <plan-file>
    ├── Extract phase section (grep + offset/limit)
    ├── Pre-flight (check files, update mocks if needed)
    ├── Per file: implement → write tests → coverage → ✅
    ├── Update coverage config
    ├── /quality-gate (Variant A)
    ├── Completion Audit (7 categories)
    └── Update memory
        ↓
  If gaps found later:
  /verify-phase N <plan-file>
    ├── Read phase section + global plan sections
    ├── 7-category audit + fix every ❌
    ├── /quality-gate (Variant A)
    └── Update memory
        ↓
  If specific file below coverage:
  /fix-coverage <source-file>
        ↓
  Before commit:
  /quality-gate (Variant B)
```

---

## Why Nothing Gets Missed

The gap in the UPI implementation (missing `/admin/settings/subscription` page) was caused by:

1. Plan scattered the page spec across three sections (wireframe, UI Pages Summary, Group 5 items)
2. Group 5 items list didn't mention the page explicitly
3. The "Extend" label in UI Pages Summary bypassed the "new page" navigation check
4. verify-phase only read the group section, missing the global UI Pages Summary

These three design decisions together prevent that:

1. **plan-feature enforces self-contained phases** — every page spec is duplicated into the phase
   section, not just in global sections. If it's needed in Phase 5, it's described in Phase 5.

2. **implement-phase Step 2d** — pre-flight explicitly verifies every "Extend" page exists
   before implementation starts. A missing "Extend" page is treated as "New" and created.

3. **implement-phase Step 7 Category C** — reads the plan's global UI Pages Summary table
   (not just the phase section) and checks every row that touches this phase.

4. **verify-phase Step 1** — always reads global plan sections in addition to the phase section.

---

## Token Efficiency Rules (Baked Into Every Skill)

- **grep + offset/limit**: never read a full plan file; always grep headers first, then read
  only the target section. A 1,800-line plan becomes a 15-line read.
- **Read before write**: before implementing any file, check if it exists and read it. Prevents
  re-discovering existing code mid-implementation.
- **Track test files**: build the list during Step 4; use it in Step 6. Never re-discover.
- **One task in_progress**: TodoWrite has exactly one in_progress task. No cognitive overhead
  managing complex state.
- **Fix at the source, not downstream**: when a test fails, fix the root cause in the same step.
  Don't defer failures to a later step — they compound.
- **Memory updates**: at phase completion, write a one-paragraph memory entry. The next session
  reads it instead of re-discovering via filesystem exploration.
- **No speculative reads**: never read a file "just in case." Read only when a specific decision
  requires it.
