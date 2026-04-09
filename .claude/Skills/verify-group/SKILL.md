---
name: verify-group
description: Audit and repair an existing group/phase implementation. Runs 7-category audit (files, endpoints, navigation, UI spec, states, integration, tests) against current codebase and fixes every gap found. Use when re-checking a previously implemented group or resuming after a prior session.
argument-hint: <N> <plan-file>
---

# Audit and Repair a Group Implementation

**Invocation**: `/verify-group <N> <plan-file>`
Example: `/verify-group 3 execution_plan/plans/resident-support-tickets.md`

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

**Critical differences from implement-group audit:**

- **Category C (Page Navigation)**: check the plan's global UI Pages Summary for ALL rows, not just rows in the group section. Every "Extend" page listed anywhere in the plan must exist. If it doesn't and belongs to this group → create it.
- **Category G (Tests)**: for each source file in this group, run the per-file coverage command empirically. **Do not read the plan's "no test needed" claim and mark ✅ — the plan is not the pre-commit hook.** Run the command, read the output, see the number. Zero percent = commit will fail.

---

**Category G — mandatory commands to run for every new/modified source file:**

```bash
# For each file in this group — run this even if the plan says "no test needed"
npx vitest run tests/path/to/test.ts --coverage --coverage.include=src/path/to/source.ts
```

If the file has NO test yet, run without a test file — you will see 0% and you must either write tests or add the file to `vitest.config.ts` `exclude`. Reading the plan is not a substitute for running this command.

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
