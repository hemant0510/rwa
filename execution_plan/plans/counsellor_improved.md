# Counsellor Improvements — Multi-Counsellor Support, Primary/Secondary Swap, Shared Ticket Inbox

**Owner:** product/eng
**Created:** 2026-04-19
**Status:** Ready to execute
**Prerequisite:** [`counsellor-role.md`](./counsellor-role.md) groups 1–7 already shipped.

---

## 1. Background

The current counsellor role supports many-to-many society assignment via [`CounsellorSocietyAssignment`](../../supabase/schema.prisma). Today:

- A society can have **multiple counsellors**, distinguished by an `isPrimary` flag.
- "Primary" is assigned **automatically, first-come-first-served**: the very first counsellor added to a society becomes primary; every later assignment becomes secondary. See [`/api/v1/super-admin/counsellors/[id]/assignments/route.ts:119-166`](../../src/app/api/v1/super-admin/counsellors/[id]/assignments/route.ts#L119-L166).
- On revoke of a primary, the oldest active secondary auto-promotes. See [`/api/v1/super-admin/counsellors/[id]/assignments/[societyId]/route.ts:38-50`](../../src/app/api/v1/super-admin/counsellors/[id]/assignments/[societyId]/route.ts#L38-L50).
- **There is no UI to swap primary/secondary** for already-assigned counsellors.
- **The RWA admin sees only the primary counsellor** (not the full list) — see [`/api/v1/admin/counsellor/route.ts:11-12`](../../src/app/api/v1/admin/counsellor/route.ts#L11-L12) which filters `isPrimary: true`.
- **Only the routed counsellor sees escalated tickets.** Auto-escalation picks a single counsellor (primary by preference) and stamps `counsellorId` on the escalation row — [`src/lib/counsellor/auto-escalate.ts:34-48`](../../src/lib/counsellor/auto-escalate.ts#L34-L48). The counsellor tickets API then filters `counsellorId = me` — [`/api/v1/counsellor/tickets/route.ts:39`](../../src/app/api/v1/counsellor/tickets/route.ts#L39). Secondary counsellors see zero tickets.
- **SA "assign societies" picker has no filter** for already-assigned societies. With a growing platform, finding an unassigned society becomes a needle-in-haystack problem.
- **Primary flag has no DB uniqueness guard.** A race between two SA operations could leave a society with two primaries.

## 2. Scope (what this plan delivers)

1. **DB uniqueness** — partial unique index on `(society_id)` where `is_primary = true AND is_active = true`.
2. **SA society-picker filter** — a "Hide societies that already have a counsellor" toggle when assigning societies to a counsellor (default ON).
3. **SA one-click primary/secondary swap** — a button in the SA counsellor's society-assignments table to promote a secondary to primary, atomically demoting the existing primary.
4. **Shared ticket inbox for counsellors** — every counsellor assigned to a society sees every escalated ticket for that society, not just the one routed to them.
5. **Counsellor ticket filter tabs** — `As primary` / `As secondary` / `All`.
6. **RWA admin sees the full counsellor list** for their society (not just primary).
7. **Revoke semantics preserved** — revoking a counsellor's assignment keeps cutting them off from that society's tickets (existing behaviour, explicitly kept).

Out of scope:

- Any change to the escalation routing logic itself (still primary-first).
- Removing the `isPrimary` concept.
- Bulk reassignment UI (covered by existing `/transfer-portfolio`).

## 3. Conventions (lifted from CLAUDE.md)

- API route tests use `vi.hoisted()`.
- 95% per-file coverage enforced by `scripts/test-staged.mjs`.
- SUPER_ADMIN must be able to read all data; every new list endpoint accepts `?societyId=` scoping via `getAdminContext` where applicable.
- Writes stay on `requireSuperAdmin` / `requireCounsellor` for audit attribution.

---

## 4. Data Model Changes

### 4.1 Partial unique index — one primary per society

**Why:** prevents two-primary races (see §1 last bullet).

**Migration SQL:**

```sql
CREATE UNIQUE INDEX counsellor_primary_per_society_uniq
  ON public.counsellor_society_assignments (society_id)
  WHERE is_primary = true AND is_active = true;
```

**Pre-flight check** (run before migration to guarantee zero violations):

```sql
SELECT society_id, count(*) AS primaries
FROM public.counsellor_society_assignments
WHERE is_primary = true AND is_active = true
GROUP BY society_id
HAVING count(*) > 1;
```

If any rows return, resolve manually (pick one row to keep, flip the others to `is_primary = false`) before applying the index.

**Prisma schema update** — add to `model CounsellorSocietyAssignment`:

```prisma
@@index([societyId, isPrimary, isActive], name: "counsellor_primary_per_society_uniq")
```

**Note:** Prisma does not natively express partial unique indexes. Apply the index via raw SQL migration (`supabase/migrations/<timestamp>_counsellor_primary_unique.sql`), and add a plain `@@index` in the schema for awareness only. Document in the migration file that `UNIQUE...WHERE` is raw SQL.

### 4.2 No schema column changes

All changes below are behavioral. No new columns, no dropped columns, no data migration.

---

## 5. Phase 1 — SA society-picker filter

**Goal:** when SA is assigning societies to a counsellor, hide societies that already have a counsellor by default, with an opt-in toggle to show all.

### 5.1 API — extend the available-societies endpoint

File: [`/api/v1/super-admin/counsellors/[id]/available-societies/route.ts`](../../src/app/api/v1/super-admin/counsellors/[id]/available-societies/route.ts)

Add query param `?hideAssigned=true|false` (default `true`).

- `hideAssigned=true` → return only societies with zero active `CounsellorSocietyAssignment` rows (to any counsellor).
- `hideAssigned=false` → return all societies the counsellor is not already actively assigned to (current behaviour).

Response shape unchanged — still `{ societies: [...] }`. Add a per-society `hasExistingCounsellors: number` count so the UI can show a "2 counsellors already assigned" hint when the toggle is off.

### 5.2 SA UI — society picker

Component: [`src/app/sa/counsellors/[id]/assignments/`](../../src/app/sa/counsellors/[id]/assignments/) (or wherever the "assign societies" dialog lives — confirm during implementation).

- Add a toggle: **"Show only societies without a counsellor"** — default ON.
- When OFF, each society row shows a small count badge "N counsellor(s) already assigned" if `hasExistingCounsellors > 0`.
- Update the query key in TanStack Query to include the `hideAssigned` flag so toggling re-fetches.

### 5.3 Tests

- API: hideAssigned=true excludes societies with any active assignment; hideAssigned=false behaves as before; default = true; `hasExistingCounsellors` count is accurate across mixed active/revoked rows.
- UI: toggle flips, list updates, badge appears on shared-society rows when toggle is OFF.

---

## 6. Phase 2 — SA one-click primary/secondary swap

**Goal:** let SA promote a secondary counsellor to primary with a single click, atomically demoting the existing primary.

### 6.1 New API endpoint

File: `src/app/api/v1/super-admin/counsellors/[id]/assignments/[societyId]/promote/route.ts`

Method: `POST`

Behavior (transactional):

1. Guard `requireSuperAdmin`.
2. Load the target assignment by `(counsellorId, societyId)`. 404 if not found or revoked.
3. If already primary → return 200 with `{ promoted: false, reason: "ALREADY_PRIMARY" }` (idempotent).
4. In a `prisma.$transaction`:
   a. `UPDATE counsellor_society_assignments SET is_primary = false WHERE society_id = ? AND is_primary = true AND is_active = true` (demote current primary, if any).
   b. `UPDATE counsellor_society_assignments SET is_primary = true WHERE id = ?` (promote target).
5. Write `counsellor_audit_logs` and a platform `audit_log` entry: `SA_COUNSELLOR_PROMOTED`, with `oldPrimaryCounsellorId` and `newPrimaryCounsellorId`.
6. Return `{ promoted: true }`.

**Concurrency guarantee:** because the partial unique index from §4.1 is in place, if two SAs race the swap, the later transaction fails on the unique constraint and returns a 409 conflict. The UI re-fetches and shows the new state.

### 6.2 SA UI — "Make Primary" button

On the SA counsellor detail page's assignments table (confirm file during implementation):

- Each row shows `Primary` badge or `Secondary`.
- Secondary rows get a "Make Primary" button.
- Clicking:
  - Confirm dialog: _"Make {counsellorName} the primary counsellor for {societyName}? {currentPrimaryName} will be demoted to secondary."_
  - On confirm → POST to new promote endpoint → invalidate the assignments query.
- Primary rows show no action (demote happens implicitly via promoting someone else).

### 6.3 Tests

- API: promote when current primary exists → both rows updated in one transaction.
- API: promote when there's no current primary (edge case after revoke) → target becomes primary with no other updates.
- API: promote when already primary → idempotent 200.
- API: partial unique index violation returns 409.
- UI: button appears only on secondary rows; confirm dialog renders both names; successful swap re-renders badges.

---

## 7. Phase 3 — Shared ticket inbox for counsellors

**Goal:** every counsellor assigned to a society sees every escalated ticket for that society, regardless of which counsellor the escalation was originally routed to.

### 7.1 Change counsellor tickets query

File: [`/api/v1/counsellor/tickets/route.ts`](../../src/app/api/v1/counsellor/tickets/route.ts)

Replace the current `where` clause:

```ts
// BEFORE
where: {
  ...(auth.data.isSuperAdmin ? {} : { counsellorId: auth.data.counsellorId }),
  status: { in: [...statuses] },
  ...(societyIdParam ? { ticket: { societyId: societyIdParam } } : {}),
}
```

with:

```ts
// AFTER
// 1. Load every society this counsellor is ACTIVELY assigned to.
const assignments = auth.data.isSuperAdmin
  ? null // SA sees everything, no society filter
  : await prisma.counsellorSocietyAssignment.findMany({
      where: { counsellorId: auth.data.counsellorId, isActive: true },
      select: { societyId: true, isPrimary: true },
    });

const mySocietyIds = assignments?.map((a) => a.societyId) ?? [];
const myPrimarySocietyIds = new Set(
  (assignments ?? []).filter((a) => a.isPrimary).map((a) => a.societyId),
);

// 2. Build the where clause — escalations for tickets in my societies.
where: {
  status: { in: [...statuses] },
  ticket: {
    societyId: societyIdParam
      ? societyIdParam
      : assignments
        ? { in: mySocietyIds }
        : undefined,
  },
}
```

Then in the response shape, annotate each escalation with `myRole: "PRIMARY" | "SECONDARY" | "SUPER_ADMIN"` computed from `myPrimarySocietyIds.has(escalation.ticket.societyId)`.

### 7.2 New query param — role filter

Add `?role=primary|secondary|all` (default `all`).

- `role=primary` → restrict to tickets where the counsellor's assignment for that society is primary.
- `role=secondary` → restrict to where it's secondary.
- `role=all` → no extra filter.

SA bypasses this filter (they see all).

### 7.3 Counsellor UI — filter tabs

File: [`src/app/counsellor/(authed)/tickets/page.tsx`](<../../src/app/counsellor/(authed)/tickets/page.tsx>)

Add tabs above the ticket list:

- **All** (default)
- **As primary**
- **As secondary**

Each tab swaps the `role` query param and re-fetches. Show a small badge per ticket: `Primary` / `Secondary` pill based on `myRole`.

**Empty states:**

- `role=primary` with no tickets → "No escalated tickets where you're the primary counsellor."
- `role=secondary` with no tickets → "No escalated tickets where you're the secondary counsellor."
- `role=all` with no tickets → existing "No tickets" copy.

### 7.4 Actionability rule (important UX decision)

**Both primary and secondary counsellors can see every ticket. Only the assigned counsellor (`escalation.counsellorId`) can acknowledge / resolve / defer.** The secondary's view is read-only. This preserves single-ownership semantics while giving full visibility.

- The ticket detail page shows a banner for read-only viewers: _"Assigned to {primaryName}. You are the secondary counsellor and can view but not act on this escalation."_
- Backend: the existing ACK / RESOLVE / DEFER endpoints already check `counsellorId = me` — no change needed.

### 7.5 Tests

- API: counsellor with two societies, one primary + one secondary → sees both, correct `myRole` per ticket.
- API: counsellor with no active assignments → empty list (no 500).
- API: `role=primary` filters out secondary-society tickets.
- API: `role=secondary` filters out primary-society tickets.
- API: SA ignores `role` param and sees everything.
- API: societyId param still works and restricts within counsellor's assigned set.
- API: revoked assignments are excluded (so revoke really does pull tickets).
- UI: three tabs swap the list; badge renders Primary/Secondary correctly; empty state copy matches role.
- UI: ticket detail read-only banner shows for secondary viewers; ACK button hidden/disabled.

---

## 8. Phase 4 — RWA admin sees all counsellors

**Goal:** the "Your Counsellor" card on the admin dashboard shows every counsellor assigned to the society, not just primary.

### 8.1 API change

File: [`/api/v1/admin/counsellor/route.ts`](../../src/app/api/v1/admin/counsellor/route.ts)

Replace `findFirst({ isPrimary: true })` with `findMany({ isActive: true })`. New response shape:

```ts
{
  counsellors: Array<{
    id: string;
    name: string;
    email: string;
    publicBlurb: string | null;
    photoUrl: string | null;
    isPrimary: boolean;
    assignedAt: string; // ISO
  }>;
}
```

Ordered by `isPrimary DESC, assignedAt ASC` so the primary is first.

### 8.2 Service + component update

- [`src/services/counsellors.ts`](../../src/services/counsellors.ts) — rename `getMyCounsellor` → `getMyCounsellors`, update return type.
- [`src/components/features/sa-counsellors/YourCounsellorCard.tsx`](../../src/components/features/sa-counsellors/YourCounsellorCard.tsx) — rename to `YourCounsellorsCard` (plural), render one row per counsellor with a `Primary` pill on the primary. Empty state unchanged ("No counsellor assigned").

### 8.3 Tests

- API: returns full list sorted primary-first; skips inactive/revoked.
- API: SA impersonation via `getAdminContext(targetSocietyId)` works (as required by the SA-is-GOD rule).
- UI: renders multiple rows with correct primary ordering; primary pill appears only on one; empty state when list is empty.

---

## 9. Revoke semantics — explicitly preserved

Revoking a counsellor's assignment to a society continues to:

- Cut them off from seeing that society's tickets (the new query in §7.1 filters by `isActive: true`).
- Auto-promote the oldest active secondary if the revoked counsellor was primary (existing behaviour — not changed).

**No escalation rows are mutated on revoke.** The `counsellorId` on open escalations continues to point at the revoked counsellor. After revoke:

- The revoked counsellor no longer sees the ticket (their society list no longer contains that society).
- Remaining counsellors for the society now see it (§7.1 filters by society, not by `counsellorId`).
- The escalation is still technically "assigned" to the revoked counsellor — acknowledgement/resolution will 403 because they fail the `requireCounsellor` society check.
- **Follow-up concern:** if the revoked counsellor had acknowledged but not resolved a ticket, nobody else can act on it. Out of scope for this doc — tracked as a follow-up: "Reassign open escalations on revoke" (see §12).

---

## 10. Phased Implementation

| Phase | Scope                                                         | Est. effort |
| ----- | ------------------------------------------------------------- | ----------- |
| 0     | Pre-flight data audit + partial unique index migration (§4.1) | 30 min      |
| 1     | SA society-picker filter (§5)                                 | 1 day       |
| 2     | SA primary/secondary swap endpoint + UI (§6)                  | 1 day       |
| 3     | Shared inbox + counsellor filter tabs (§7)                    | 1.5 days    |
| 4     | RWA admin "all counsellors" card (§8)                         | 0.5 day     |

Phases 1–4 are independent except that **Phase 2 and Phase 3 both depend on Phase 0** (the unique index is load-bearing for race safety in swap and for the assumption "at most one primary per society" throughout phase-3 UI rendering).

---

## 11. Testing & Quality Gates

Per CLAUDE.md:

- **95% per-file coverage** on every new/changed source file.
- `vi.hoisted()` for all API route mocks.
- Simulate the hook before declaring "ready to commit":
  ```bash
  npx vitest related <source-files> --run --coverage --coverage.provider=v8 --coverage.reporter=text <--coverage.include=... per file> --coverage.thresholds.perFile=true --coverage.thresholds.lines=95 --coverage.thresholds.branches=95 --coverage.thresholds.functions=95 --coverage.thresholds.statements=95
  ```
- New API routes must have 3 explicit auth tests (401, 403-counsellor-for-SA-endpoints, 200-happy-path).
- Audit-log writes (§6.1) must be covered by the test that exercises the happy path — assert `logAudit` was called with the right `actionType`.

---

## 12. Open Questions / Follow-ups (not in this plan)

1. **Open-escalation handoff on revoke.** When a counsellor is revoked while holding un-resolved escalations, should those auto-reassign to the next counsellor (primary first, then oldest secondary)? Currently they stall. Decide before this becomes a field issue.
2. **Primary-change audit trail UI.** The swap endpoint writes to `counsellor_audit_logs`, but SA has no UI to view the history of primary changes. Consider adding to the counsellor detail audit tab.
3. **Notification on primary change.** Should the demoted counsellor get an email? Out of scope; worth deciding before launch.
4. **Escalation routing preference.** Auto-escalation still picks primary-first. If we want "least-loaded counsellor first," that's a separate design exercise.

---

## 13. Acceptance Criteria

This feature is "done" when all of the following are true on staging:

- [ ] A society with two counsellors (one primary, one secondary) — the RWA admin sees both names in the "Your Counsellors" card, with the primary listed first.
- [ ] Both counsellors, when logged in, see the same list of escalated tickets for that society under the **All** tab.
- [ ] Each ticket shows a `Primary` or `Secondary` badge reflecting the viewing counsellor's role on that society.
- [ ] The secondary counsellor sees the ticket detail page as read-only (no ACK/RESOLVE/DEFER buttons).
- [ ] SA can click "Make Primary" on the secondary assignment — both rows update in one request, banner confirms the swap.
- [ ] Attempting to create two primaries for one society (e.g. via direct SQL during a race) fails with the unique-index violation.
- [ ] SA "Assign societies" dialog hides already-assigned societies by default; toggle reveals them with a "2 counsellors already assigned" hint.
- [ ] Revoking a counsellor's assignment immediately removes that society's tickets from their inbox; the remaining counsellors still see them.
- [ ] All new routes + UI hit 95% per-file coverage; `npm run lint` and `npx tsc --noEmit` are clean.
