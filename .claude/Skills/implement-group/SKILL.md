---
name: implement-group
description: Implement a plan group/phase with tests, per-file coverage, quality gate, and 7-category completion audit. Use when implementing any numbered group or phase from an execution plan document.
argument-hint: <N> <plan-file>
---

# Implement a Plan Group

**Invocation**: `/implement-group <N> <plan-file>`
Example: `/implement-group 4 execution_plan/plans/resident-support-tickets.md`

---

## Step 1 — Extract only the target section

Do NOT read the full file. Use this two-step approach:

```bash
# Step 1a: Find all section headers — works for Phase, Group, or Step naming
grep -En "^#{1,4} (Phase|Group|Step) [0-9]" <plan-file>

# Step 1b: Read ONLY the lines for section N using the Read tool's offset/limit
# e.g. for Phase 2 at line 203, Phase 3 at line 277: offset=203, limit=(277-203)=74 lines
```

**Note**: Plan files use different section keywords — "Phase", "Group", or "Step" — and different heading levels (`##` or `###`). The grep above catches all variants. Always grep first; never assume the keyword.

Read the extracted section. Stop. Do not read any other section yet (Step 7 reads global sections later).

---

## Step 2 — Pre-flight checks (before writing any code)

**a) Read project context**: Read CLAUDE.md to identify:

- Test runner commands
- Coverage threshold and config file
- Mock infrastructure file paths
- Linter and type checker commands

**b) New data models**: If the group adds new models, update your project's mock infrastructure (see CLAUDE.md "Mock Infrastructure" or "Shared mocks" section) BEFORE writing any source files. Follow the exact existing pattern in that file. Do NOT add infrastructure that already exists (check first).

**c) Existing files**: For each file listed in the group, check if it already exists. If it does, read it first. Implement only what is missing — never overwrite working code.

**d) "Extend" page verification**: For each page marked "Extend" in the group:

- Verify the target file exists in the filesystem
- If it does NOT exist: treat it as a "New" page and create it
- The "Extend" label in a plan assumes the page already exists — a missing "Extend" page is a plan error, not a reason to skip

---

## Step 3 — TodoWrite task list

Create one task per source-file + test-file pair. Mark both complete together.
Keep exactly ONE task in_progress at a time.

---

## Step 4 — Implement each file → test → per-file coverage → next file

For each source file in the group (never batch; do one at a time):

1. Implement the source file per the plan spec
2. Check if a test file already exists for this source — if yes, update it; if no, create it. Follow your project's test patterns (see CLAUDE.md and core_rules.md).
3. Run the test file — fix until it passes
4. **Run per-file coverage immediately** (see CLAUDE.md for the exact command):
   ```
   [coverage command] --coverage.include=<source-file>
   ```
   If any metric is below the project's threshold → add tests NOW. Do not defer.
5. Add the test file path to a running list (used in Step 6)
6. Mark the task complete in TodoWrite

**Every source file MUST have a test** — API routes, services, components, pages, and sidebar/layout files. No exceptions. If you create or modify a source file without writing/updating its test, the pre-commit hook will fail with 0% coverage.

**Note on shared test files**: Some source files share one test file. Check if a test already exists for this source before creating a new one.

**Large group handling**: If a group has more than 5 source files, split into two sub-sessions:

- First half: implement → test → Steps 5–7 → commit
- Second half: implement → test → Steps 5–7 → commit

---

## Step 5 — Update coverage configuration

After all source files exist, check your project's coverage config file (see CLAUDE.md) and add any new source file paths that are missing. Files absent from the config are invisible to threshold enforcement.

---

## Step 6 — Run the group quality gate

Run these checks in order (see CLAUDE.md for exact commands). Stop on first failure:

1. **Linter** — zero errors required
2. **Tests** — run all test files from the list built in Step 4
3. **Type checker** — fast check, NOT full build
4. **Per-file coverage** — run the EXACT check the pre-commit hook uses:
   ```
   [staged test command with coverage flags, per-file thresholds, scoped to all source files in this group]
   ```
   If any file shows below threshold on any metric, add tests for the uncovered branches/lines NOW.

**Re-run linter after any test additions or fixes** — new files may have unused imports or other lint errors.

Fix every failure before proceeding. Never skip forward with a failure open.

Full build: only on the final group of a feature branch or when explicitly asked.

---

## Step 7 — Completion Audit (7 categories, MANDATORY)

Re-read the extracted group spec section. Also grep the plan file for global sections and read them to find anything this group touches:

```bash
grep -n "UI Pages Summary\|Component Inventory\|API Endpoints\|Test File Map" <plan-file>
# Read those sections (offset/limit) to find rows relevant to this group
```

Verify each category:

**A. File Checklist** — every file in the group's file table:

```
✅/❌ <path> — exists, implements spec
```

**B. API Endpoint Checklist** — every endpoint in the group:

```
✅/❌ METHOD /path — auth check present? input validated? correct response shape?
```

**C. Page Navigation Checklist** — for every page in the group AND every page in the plan's global UI Pages Summary that this group touches:

```
✅/❌ /path — New or Extend?
     New: navigation entry point exists (link/card from parent, sidebar item, etc.)
     Extend: target file confirmed to exist AND extension confirmed to be present
```

If any "Extend" page doesn't exist → create it. If any "New" page has no navigation entry → add one.

**D. UI Spec Checklist** — for every page, read its wireframe/spec element by element:

```
✅/❌ Every labeled wireframe element exists in the component
✅/❌ Inline prose requirements ("← Back at top left") are implemented
✅/❌ Amount/currency formatted per spec
✅/❌ Copy button, toast, loading spinner — every interactive element present
```

**E. State Checklist** — every page and interactive component:

```
✅/❌ Loading state
✅/❌ Error state (what renders when API fails?)
✅/❌ Empty state (what renders when list is empty?)
✅/❌ Success state (what renders after action completes?)
```

**F. Integration Checklist**:

```
✅/❌ Every "accessible from" entry in the plan is implemented
✅/❌ Every sidebar badge update specified is implemented
✅/❌ Every parent page that needs a link/card to a new sub-page has it
✅/❌ Every "Extend" page was actually extended (new section present, old sections unbroken)
```

**G. Test Coverage Checklist**:

```
✅/❌ All new source files added to coverage config
✅/❌ Every new/modified source file has a corresponding test file
✅/❌ All test files pass individually
✅/❌ Every file meets the project's coverage threshold per file
```

For any ❌: fix immediately. Do not declare complete with open items.

---

## Step 8 — Report and update memory

Only after all 7 categories are ✅:

```
Group N — COMPLETE ✅

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

Update project memory: record group as complete, list key files created, note any non-obvious decisions. This prevents the next session from re-discovering completion state.

### Session recovery

If this session must end before the group is complete:

- Update project memory: record last completed file, remaining files, any open issues
- The next session reads memory first, then resumes from the next uncompleted file
