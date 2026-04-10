---
name: ship-phase
description: Implement ONE phase/group from a plan file end-to-end — implement all deliverables, write tests, run quality gate, run build if plan requires it, run 7-category audit, and report final status. One phase per invocation. Use instead of running implement-group + quality-gate + verify-group separately.
argument-hint: <plan-file> <phase-number>
---

# Ship a Phase End-to-End

**Invocation**: `/ship-phase <plan-file> <phase-number>`

Examples:

```
/ship-phase execution_plan/plans/some-feature.md 1
/ship-phase execution_plan/plans/some-feature.md 3
```

**One invocation = one phase.** For a plan with N phases, run this command N times (1, 2, 3…), committing after each ship report passes.

If the plan file has no numbered phases (the whole file is one unit), omit the phase number:

```
/ship-phase execution_plan/plans/single-phase-plan.md
```

---

## How phases work in plan documents

Before running, understand the plan's structure:

```bash
grep -En "^#{1,4} (Phase|Group|Step) [0-9]" <plan-file>
```

- If this returns results → the plan has numbered phases. Pass the number.
- If this returns nothing → the whole file is one phase. Omit the number.

**Never try to run all phases in one invocation.** Each phase should be committed before the next starts. If you run phase 2 before committing phase 1, the working tree is dirty and the audit cannot tell what belongs to which phase.

---

## What it does — 4 stages in sequence

Each stage must pass before the next starts. No exceptions.

```
Stage 1 — IMPLEMENT    implement all deliverables for this phase
Stage 2 — QUALITY GATE lint + tests + type check
Stage 3 — BUILD CHECK  only if the plan's Quality Gate section requires it
Stage 4 — AUDIT        7-category completeness check, fix every gap
```

---

## Stage 1 — IMPLEMENT

Invoke **Skill(implement-group)** with the plan file and phase number.

Follow it completely. Do not proceed to Stage 2 until every deliverable in the phase is implemented and every test file passes individually.

---

## Stage 2 — QUALITY GATE

**Before invoking quality-gate:** List every source file created or modified in Stage 1. For each, ensure a test file exists (create one if not). Then run the **hook simulation** — NOT individual `vitest run` calls:

```bash
npx vitest related src/file1.ts src/file2.ts [all source files...] --run \
  --coverage --coverage.provider=v8 --coverage.reporter=text \
  --coverage.include=src/file1.ts --coverage.include=src/file2.ts \
  --coverage.thresholds.perFile=true \
  --coverage.thresholds.lines=95 --coverage.thresholds.branches=95 \
  --coverage.thresholds.functions=95 --coverage.thresholds.statements=95
```

**Why `vitest related` not `vitest run`**: The pre-commit hook uses `vitest related` which walks Vitest's module graph and finds EVERY test that imports any of the source files — including pre-existing test files from earlier groups you didn't write. `vitest run tests/foo.test.ts` only runs one file and misses those. This is the single most common cause of "passes locally, fails on commit".

If failures appear in test files you didn't write → a signature change broke pre-existing call sites. Fix them before continuing.

Then invoke **Skill(quality-gate)** — Variant A (files created, not staged yet).

Fix every failure before proceeding. Do not move to Stage 3 with any lint error, test failure, or type error outstanding.

Pass condition:

```
✅ Lint      — zero errors
✅ Tests     — vitest related passes for all source files
✅ Types     — zero errors (includes ALL project files, not just this group)
✅ Coverage  — per-file ≥ 95% confirmed by vitest related output
```

---

## Stage 3 — BUILD CHECK

Determine whether this stage is required by reading the plan's Quality Gate section:

```bash
grep -n "npm run build" <plan-file>
```

**If found:** run `npm run build`. Read the plan's Quality Gate section to identify what success looks like (it will describe expected artifacts or outcomes specific to this plan). Verify those outcomes. Fix root cause if build fails — re-run lint + tsc + build before proceeding.

**If not found:** skip this stage. Mark it ⏭️ Skipped in the report.

---

## Stage 4 — AUDIT

Invoke **Skill(verify-group)** with the plan file and phase number.

Follow it completely. Fix every ❌ found. Re-run the affected audit category after each fix. Do not report completion until all categories are ✅.

---

## Final Report

Output this table after all stages pass:

```
## Ship Report — <plan-filename> Phase <N>

| Stage        | Status | Notes                                   |
|--------------|--------|-----------------------------------------|
| Implement    | ✅     | N files created, M files modified       |
| Quality Gate | ✅     | Lint clean, N tests passed, types clean |
| Build        | ✅/⏭️  | <what was verified> / Skipped           |
| Audit (A–G)  | ✅     | All 7 categories pass                   |

Deliverables: N/N complete
Coverage: per-file ≥ 95% on all modified source files in coverage scope
Ready to commit: YES

Next: /ship-phase <plan-file> <N+1>   ← if more phases exist
```

If any stage has a remaining ❌ after your best fix attempt, mark it ❌ and describe the blocker so the user can decide how to proceed.

---

## Rules

- One phase per invocation — never attempt multiple phases in one run
- Never skip a stage to save time
- Never claim "build passed" without running it
- Never claim "audit passed" without reading actual source files
- If a phase has 10+ files, split into two sub-sessions: implement first half → Stages 2–4 → commit → implement second half → Stages 2–4 → commit
- After the ship report prints "Ready to commit: YES", stop. The user commits manually.
