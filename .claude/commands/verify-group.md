# /verify-group — Audit and repair an existing group implementation

**Invocation**: `/verify-group <N> <plan-file>`
Example: `/verify-group 3 execution_plan/plans/online_payment_upi.md`

Use when: "re-check that group N is properly implemented" or when resuming after a previous session claimed completion.

---

## What it does

Runs the full 7-category audit (A–G) against the existing codebase, fixing each gap as found.

**Step 1** — Extract the section using the same grep → Read approach as `/implement-group` Step 1:

```bash
# Find all section headers — works for Phase, Group, or Step naming
grep -En "^#{1,4} (Phase|Group|Step) [0-9]" <plan-file>

# Read ONLY the lines for section N using the Read tool's offset/limit
# e.g. for Phase 3 at line 277, Phase 4 at line 343: offset=277, limit=(343-277)=66 lines
```

**Note**: Plan files use "Phase", "Group", or "Step" interchangeably. Always grep first to see the keyword and heading level used in the specific file.

**Step 2** — Run through all 7 categories (A through G), reading actual source and component files to verify requirements. Do not rely on memory or previous session output.

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
✅/❌ /page/path — accessible from: [where?]
```

**D. UI Spec Checklist** — every element in wireframes and spec tables:

```
✅/❌ Every labeled wireframe element exists in the component
✅/❌ Inline prose requirements ("← Back at top left") are implemented
```

**E. State Checklist** — every page and component:

```
✅/❌ Loading state
✅/❌ Error state
✅/❌ Empty state
✅/❌ Success state
```

**F. Integration Checklist** — sidebar badges, parent page links, existing page extensions:

```
✅/❌ Sidebar badge shows pending count (if spec requires)
✅/❌ Parent settings page has link/card to new sub-page
✅/❌ Existing pages that spec says to "extend" are actually extended
```

**G. Test Coverage Checklist**:

```
✅/❌ All new source files added to vitest.config.ts coverage.include
✅/❌ All test files pass: npx vitest run <each file individually>
✅/❌ 95%+ lines/branches/functions/statements per source file
```

**Step 3** — For each ❌: implement the fix immediately. This is an audit-and-repair command, not read-only.

**Step 4** — After all fixes: run the quality gate (Variant A — implementation context):

```bash
npm run lint
npx vitest run <all group test files>
npx tsc --noEmit
```

**Step 5** — Report every gap found, every fix applied, and the final state. Update project memory.
