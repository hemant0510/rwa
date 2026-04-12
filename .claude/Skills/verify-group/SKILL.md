---
name: verify-group
description: Audit and repair an existing group/phase implementation. Runs 7-category audit (files, endpoints, navigation, UI spec, states, integration, tests) against current codebase and fixes every gap found. Use when re-checking a previously implemented group or resuming after a prior session.
argument-hint: <N> <plan-file>
---

# Audit and Repair a Group Implementation

**Invocation**: `/verify-group <N> <plan-file>`
Example: `/verify-group 3 execution_plan/plans/some-feature.md`

Use when: "re-check that group N is properly implemented" or when resuming after a previous session claimed completion.

---

## What it does

Full 7-category audit (A–G) against the existing codebase, fixing every gap found.
This is audit-and-repair, not read-only.

---

## Step 1 — Extract target section + global sections

```bash
# Get all phase/group headers
grep -En "^#{1,4} (Phase|Group|Step) [0-9]" <plan-file>

# Read the target section (offset/limit)
```

Also find and read global plan sections to catch cross-cutting items:

```bash
grep -n "UI Pages Summary\|Component Inventory\|API Endpoints\|Test File Map" <plan-file>
# Read each global section (offset/limit)
```

Do NOT rely on previous session output or memory alone — read actual source files to verify.

---

## Step 2 — Run 7-category audit

Execute categories A–G (same as `/implement-group` Step 7).

### Mandatory pre-audit check — filesystem-verify every UI claim

Before running the audit, grep the plan for every label that asserts pre-existing UI, and verify each claimed file exists on disk:

```bash
grep -nE "UI already complete|UI done|skip during implementation|reference only|already complete" <plan-file>
```

For every file path referenced by those sections, run `ls` (or the Read tool) at the expected path. Build a list:

```
✅ src/app/r/profile/family/page.tsx        — exists
❌ src/app/r/profile/vehicles/page.tsx      — MISSING (plan claims "UI done")
```

Any ❌ on this list is a plan error and MUST be fixed in this audit — either by building the missing UI in this session, or by explicitly reporting it in Step 5 so the user can decide next steps. A ❌ here DISABLES the backend-only shortcut below.

### Backend-only group shortcut — TWO conditions required, both empirical

The shortcut can only apply if BOTH are true:

1. The group's file table lists ZERO pages, components, or client modules.
2. The pre-audit check above found zero missing files — every page or component the group's APIs feed exists on disk.

If both hold, Categories C, D, and E are auto-✅ N/A. Note "C/D/E: N/A — backend-only group, UI pre-existence verified on disk" in the report.

If any UI claim fails the pre-audit check, the shortcut DOES NOT APPLY. You must audit C/D/E normally, and fix or report every gap.

Plan labels are not evidence. `ls` is evidence.

**Critical differences from implement-group audit:**

- **Category C (Page Navigation)**: check the plan's global UI Pages Summary for ALL rows, not just rows in the group section. Every page labeled "Extend", "UI already complete", "skip during implementation", or similar must be confirmed to exist on disk. A missing file is a plan error — create it or report it, never silently mark ✅.
- **Category G (Tests)**: for each source file in this group, run the per-file coverage command empirically. **Do not read the plan's "no test needed" claim and mark ✅ — the plan is not the pre-commit hook.** Run the command, read the output, see the number. Zero percent = commit will fail.

---

**Category G — mandatory command for all source files in this group:**

```bash
# Pass ALL source files together — vitest related finds every test that imports any of them,
# including pre-existing tests from other groups you didn't write.
npx vitest related src/file1.ts src/file2.ts --run \
  --coverage --coverage.provider=v8 --coverage.reporter=text \
  --coverage.include=src/file1.ts --coverage.include=src/file2.ts \
  --coverage.thresholds.perFile=true \
  --coverage.thresholds.lines=95 --coverage.thresholds.branches=95 \
  --coverage.thresholds.functions=95 --coverage.thresholds.statements=95
```

Use `vitest related <source-files>` — NOT `vitest run <test-file>`. `vitest related` walks Vitest's module graph and finds every test that imports the source, including tests from prior groups you didn't write. Missing those tests is how "passes in review, fails on commit" happens.

If a file has NO test yet, the command will report 0% — you must either write tests or add the file to `vitest.config.ts` `exclude`. Reading the plan is not a substitute for running this command.

---

## Step 3 — Fix every gap immediately

For each ❌ found:

1. Implement the fix
2. Re-run the affected category check
3. Run per-file coverage for modified files
4. Confirm the ❌ is now ✅ before moving to the next gap

---

## Step 4 — Quality gate

After all fixes, run in order (see CLAUDE.md for exact commands):

1. Linter — zero errors
2. Full test suite for this group
3. Type checker

---

## Step 5 — Report and update memory

List every gap found, every fix applied, final state per category.
Update project memory to reflect current implementation status.
