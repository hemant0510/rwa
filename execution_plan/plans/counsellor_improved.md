# Counsellor Improvements — One-Counsellor-Per-Society, Exclusive Society Picker, Counsellor Profile

**Owner:** product/eng
**Created:** 2026-04-19
**Updated:** 2026-04-23
**Status:** Ready to execute
**Prerequisite:** [`counsellor-role.md`](./counsellor-role.md) groups 1–7 already shipped.

---

## 1. Background

The current counsellor role supports many-to-many society assignment via [`CounsellorSocietyAssignment`](../../supabase/schema.prisma). Today:

- A society can have **multiple counsellors**, distinguished by an `isPrimary` flag.
- "Primary" is assigned **automatically, first-come-first-served**: the very first counsellor added to a society becomes primary; every later assignment becomes secondary. See [`/api/v1/super-admin/counsellors/[id]/assignments/route.ts:119-166`](../../src/app/api/v1/super-admin/counsellors/[id]/assignments/route.ts#L119-L166).
- On revoke of a primary, the oldest active secondary auto-promotes. See [`/api/v1/super-admin/counsellors/[id]/assignments/[societyId]/route.ts:38-50`](../../src/app/api/v1/super-admin/counsellors/[id]/assignments/[societyId]/route.ts#L38-L50).
- **SA "assign societies" picker has no filter** for already-assigned societies. SA can accidentally assign a second counsellor to a society that already has one.
- **There is no hard DB guard** that prevents a society from being assigned to more than one active counsellor.
- **The counsellor detail has no profile picture or personal info** beyond a `publicBlurb`. RWA admins and residents cannot recognise or contact their counsellor meaningfully.

### Product decision (2026-04-23)

- **For now, a society has exactly ONE active counsellor.** No primary/secondary concept is surfaced in product.
- **Future-compatible.** The existing many-to-many schema is kept. We enforce "one active counsellor per society" via a partial unique index — lifting this to multi-counsellor later is a single-index change plus UI work, with no data migration.
- **Exclusive picker.** When SA is assigning societies to a counsellor, any society that is already assigned to some other counsellor MUST NOT appear. This is enforced server-side, not a UI toggle.
- **Richer counsellor profile.** Each counsellor can have a profile photo and a set of personal/professional fields so residents and RWA admins can recognise and contact them.

## 2. Scope (what this plan delivers)

1. **DB uniqueness** — partial unique index on `(society_id)` where `is_active = true`. Guarantees at most one active counsellor per society.
2. **SA society-picker is exclusive** — the available-societies endpoint hard-filters out any society that already has an active counsellor. No UI toggle, no override.
3. **SA assignment endpoint is guarded** — rejects with 409 if the target society already has an active counsellor, with a clear error payload naming the current counsellor.
4. **Counsellor profile fields + photo upload** — counsellor gets a profile photo and a set of personal/professional fields (phone, specialisation, languages, years of experience, qualifications) editable by the counsellor themselves and by SA.
5. **RWA admin "Your Counsellor" card** — shows the society's single counsellor with photo and full profile.
6. **Residents see counsellor profile** on the counsellor contact card (same shape as admin).
7. **Legacy `isPrimary` behaviour retained at the data layer** for future multi-counsellor rollout, but not surfaced anywhere in the product UI. Every active assignment is implicitly "the" counsellor.

### Explicitly out of scope

- Primary/secondary swap UI (obsolete under single-counsellor model).
- Shared ticket inbox across multiple counsellors (obsolete — only one counsellor sees tickets for their society, which is the existing behaviour).
- Role-filter tabs (`As primary` / `As secondary`) on counsellor tickets (obsolete).
- Bulk reassignment UI (covered by existing `/transfer-portfolio`).
- Any change to escalation routing logic.
- Removing the `isPrimary` column — kept for forward compatibility (§12).

## 3. Conventions (lifted from CLAUDE.md)

- API route tests use `vi.hoisted()`.
- 95% per-file coverage enforced by `scripts/test-staged.mjs`.
- SUPER_ADMIN must be able to read all data; every new list endpoint accepts `?societyId=` scoping via `getAdminContext` where applicable.
- Writes stay on `requireSuperAdmin` / `requireCounsellor` for audit attribution.
- File uploads follow the existing pattern used by other entity photo uploads (e.g. society cover, user avatars) — Supabase Storage bucket with signed-URL reads.

---

## 4. Data Model Changes

### 4.1 Partial unique index — one active counsellor per society

**Why:** enforces the single-counsellor-per-society rule at the DB layer so the app can rely on it, and closes the two-counsellor race window.

**Migration SQL:**

```sql
CREATE UNIQUE INDEX counsellor_one_active_per_society_uniq
  ON public.counsellor_society_assignments (society_id)
  WHERE is_active = true;
```

**Pre-flight check** (run before migration to guarantee zero violations):

```sql
SELECT society_id, count(*) AS active_counsellors
FROM public.counsellor_society_assignments
WHERE is_active = true
GROUP BY society_id
HAVING count(*) > 1;
```

If any rows return, resolve manually before applying the index:

- Pick one assignment to keep active (prefer `is_primary = true` if any).
- Flip the others to `is_active = false` with a short revocation reason `"Consolidation to single-counsellor model (2026-04)"`.
- Re-run the pre-flight check until zero rows — only then apply the unique index.

**Prisma schema update** — add to `model CounsellorSocietyAssignment`:

```prisma
@@index([societyId, isActive], name: "counsellor_one_active_per_society_uniq")
```

**Note:** Prisma does not natively express partial unique indexes. Apply the index via raw SQL migration (`supabase/migrations/<timestamp>_counsellor_single_active_per_society.sql`), and add a plain `@@index` in the schema for awareness only. Document in the migration file that `UNIQUE...WHERE` is raw SQL.

### 4.2 Counsellor profile fields

Add the following columns to `model Counsellor` (or extend the counsellor-profile table if one already exists — confirm during implementation):

| Field               | Type       | Nullable  | Notes                                                                        |
| ------------------- | ---------- | --------- | ---------------------------------------------------------------------------- |
| `photoUrl`          | `String?`  | yes       | Supabase Storage key (not a public URL). Signed on read.                     |
| `phone`             | `String?`  | yes       | E.164 format recommended. Validated on write with existing util.             |
| `specialization`    | `String?`  | yes       | e.g. "Family counselling", "Senior-citizen wellness". Free text, ≤120 chars. |
| `languages`         | `String[]` | no (`[]`) | Array of ISO 639-1 codes or human names ("English", "Hindi"). Default `[]`.  |
| `yearsOfExperience` | `Int?`     | yes       | Non-negative integer, ≤ 80.                                                  |
| `qualifications`    | `String?`  | yes       | Free text, ≤500 chars (degrees, certifications).                             |
| `publicBlurb`       | `String?`  | yes       | Already exists — keep.                                                       |

**Migration:** generated by `npm run db:generate` + `/db-change` skill (direct connection, not pooler). No data migration needed — new columns default to NULL / empty array.

**Storage:** create (or reuse) Supabase Storage bucket `counsellor-photos` with the same RLS pattern as other entity photo buckets. Keys: `counsellor-photos/{counsellorId}/{uuid}.{ext}`.

### 4.3 `isPrimary` flag — kept, not surfaced

- Column stays on `CounsellorSocietyAssignment`.
- New assignments created via the UI set `isPrimary = true` by default (since there is only ever one).
- No UI references "primary" or "secondary" anywhere in this plan.
- When multi-counsellor ships in the future, the flag is ready to be used (§12).

---

## 5. Phase 1 — Exclusive SA society picker

**Goal:** when SA is assigning societies to a counsellor, the picker shows ONLY societies that currently have no active counsellor. There is no toggle — this is a hard rule.

### 5.1 API — extend the available-societies endpoint

File: [`/api/v1/super-admin/counsellors/[id]/available-societies/route.ts`](../../src/app/api/v1/super-admin/counsellors/[id]/available-societies/route.ts)

- Return **only societies with zero active `CounsellorSocietyAssignment` rows** (to any counsellor, including this one).
- Remove any previous `hideAssigned` query param if present — the behaviour is unconditional.
- Response shape unchanged: `{ societies: [...] }`. No `hasExistingCounsellors` count (not needed).

### 5.2 SA assignment endpoint — hard guard

File: [`/api/v1/super-admin/counsellors/[id]/assignments/route.ts`](../../src/app/api/v1/super-admin/counsellors/[id]/assignments/route.ts)

Before inserting a new assignment:

1. Check `counsellor_society_assignments` for an existing row with `societyId = ? AND isActive = true`.
2. If found, **reject with 409** and a payload:
   ```json
   {
     "error": "SOCIETY_ALREADY_ASSIGNED",
     "message": "Society {societyName} is already assigned to {existingCounsellorName}.",
     "existingCounsellorId": "...",
     "societyId": "..."
   }
   ```
3. Defence in depth: even if the check passes, the partial unique index from §4.1 will reject the insert on a race. Surface that DB error as the same 409 payload.
4. Insert with `isPrimary = true, isActive = true`.

### 5.3 SA UI — society picker

Component: [`src/app/sa/counsellors/[id]/assignments/`](../../src/app/sa/counsellors/[id]/assignments/) (confirm path during implementation).

- Picker shows only available societies (trusts the API's hard filter).
- Empty state: "All societies are already assigned to counsellors." with a secondary line "Reassign an existing society by revoking its current counsellor first."
- On a 409 race response, show a toast: "Society {name} was just assigned to {counsellor}. Refresh to see the latest state."

### 5.4 Tests

- API (available-societies): returns only societies with zero active assignments; excludes ones assigned to the current counsellor AND to other counsellors.
- API (assignments POST): rejects with 409 when the society already has an active counsellor; payload includes `existingCounsellorId` and `societyId`.
- API (assignments POST): partial unique index violation surfaces as the same 409 (simulate via mocked Prisma error code `P2002`).
- API (assignments POST): happy path creates row with `isPrimary = true, isActive = true`.
- UI: empty state copy; toast on 409.

---

## 6. Phase 2 — Counsellor profile (photo + personal fields)

**Goal:** counsellor entity has a profile photo and a set of personal/professional fields. Both SA and the counsellor themselves can edit; residents and RWA admins see a read-only view.

### 6.1 DB + Prisma

Apply §4.2 schema additions. Regenerate Prisma client. Update any existing mocks in `tests/__mocks__/prisma.ts` if they construct `Counsellor` objects.

### 6.2 Counsellor profile API

Files to extend (or create if not present — confirm during implementation):

- `GET  /api/v1/counsellor/profile` — returns own profile (counsellor caller).
- `PATCH /api/v1/counsellor/profile` — updates own profile. Validates:
  - `phone`: optional, E.164-ish (reuse existing util).
  - `specialization`: ≤120 chars.
  - `languages`: array of strings, each ≤40 chars, max 10 entries.
  - `yearsOfExperience`: integer 0–80.
  - `qualifications`: ≤500 chars.
  - `publicBlurb`: ≤500 chars (existing).
- `POST /api/v1/counsellor/profile/photo` — uploads a photo (multipart or signed-URL-on-request pattern — reuse existing society cover upload flow).
  - Validates MIME `image/jpeg|png|webp`, size ≤ 2 MB.
  - Stores at `counsellor-photos/{counsellorId}/{uuid}.{ext}`.
  - Replaces previous `photoUrl` (best-effort delete old object).
- `DELETE /api/v1/counsellor/profile/photo` — removes photoUrl and deletes object.

SA parallels (under `/api/v1/super-admin/counsellors/[id]/`):

- `PATCH /api/v1/super-admin/counsellors/[id]/profile` — same body shape, SA can edit any counsellor.
- `POST /api/v1/super-admin/counsellors/[id]/profile/photo` — SA can upload a photo on behalf of a counsellor.

All GET endpoints that return counsellor data must return a **signed URL** for `photoUrl` (not the raw storage key). Follow the signed-URL test-triple rule from CLAUDE.md:

1. Counsellor with photoUrl → signed URL returned.
2. Counsellor without photoUrl → null returned, `createSignedUrl` NOT called.
3. Signed URL generation fails → falls back to null.

### 6.3 Counsellor self-service UI

File: `src/app/counsellor/(authed)/profile/page.tsx` (new or existing — confirm).

- Form fields: photo uploader, name (read-only — changed via auth only), phone, specialization, languages (chip input), years of experience (number), qualifications (textarea), public blurb (textarea).
- Photo uploader: preview, drag-and-drop, or click-to-select. "Remove photo" button when one exists.
- On save, PATCH profile; on photo change, POST/DELETE photo endpoint.
- Inline validation errors from the server.

### 6.4 SA UI — edit counsellor profile

File: [`src/app/sa/counsellors/[id]/`](../../src/app/sa/counsellors/[id]/) detail page.

- Profile section with the same fields, editable by SA.
- "Edit profile" drawer or inline edit — follow existing SA-edit patterns in the codebase.

### 6.5 RWA admin "Your Counsellor" card

File: [`/api/v1/admin/counsellor/route.ts`](../../src/app/api/v1/admin/counsellor/route.ts)

- Replace `findFirst({ isPrimary: true })` with `findFirst({ isActive: true })` — the society has at most one active counsellor (enforced by §4.1), so this is equivalent and cleaner.
- Response shape:
  ```ts
  {
    counsellor: {
      id: string;
      name: string;
      email: string;
      phone: string | null;
      photoUrl: string | null;            // signed URL
      publicBlurb: string | null;
      specialization: string | null;
      languages: string[];
      yearsOfExperience: number | null;
      qualifications: string | null;
      assignedAt: string;                 // ISO
    } | null;
  }
  ```
- `null` when no active counsellor — card shows existing "No counsellor assigned" empty state.

Component: [`src/components/features/sa-counsellors/YourCounsellorCard.tsx`](../../src/components/features/sa-counsellors/YourCounsellorCard.tsx)

- Render photo (fallback to initials avatar if `photoUrl` is null).
- Render name, specialization, contact (email, phone), languages, years of experience, qualifications, blurb.
- Empty state unchanged ("No counsellor assigned").

Service file: [`src/services/counsellors.ts`](../../src/services/counsellors.ts) — update return type to match new shape. Keep the function name `getMyCounsellor` (singular) — the contract is now "one counsellor or null".

### 6.6 Resident counsellor card (if exposed to residents)

If the counsellor contact card is also rendered for residents (check `src/app/(resident)/...` during implementation), update it to the same read-only shape. Skip this section if residents do not have a counsellor contact view today.

### 6.7 Tests

- API: profile GET returns full shape; signed URL triple for `photoUrl`.
- API: profile PATCH validates each field (phone, specialization length, languages array cap, yoE range, qualifications length).
- API: profile PATCH as counsellor updates only own row; cannot touch another counsellor.
- API: SA profile PATCH can update any counsellor.
- API: photo POST rejects non-image MIME, rejects >2 MB, stores under correct prefix, updates `photoUrl`.
- API: photo DELETE clears `photoUrl` and removes the object.
- API: admin `/counsellor` endpoint returns `null` when no active counsellor; returns full shape when one exists; SA impersonation via `getAdminContext(targetSocietyId)` works.
- UI: counsellor profile form renders all fields, submits correctly, shows inline errors.
- UI: photo uploader preview; remove-photo clears preview.
- UI: "Your Counsellor" card renders photo + all fields; fallback avatar when no photo; empty state when null.

---

## 7. Phase 3 — Revoke / reassign flow

**Goal:** make it easy for SA to move a society from one counsellor to another. Under the single-counsellor model, reassignment is "revoke current, then assign new" — not an atomic swap (atomic swap is a future multi-counsellor concern).

### 7.1 Existing revoke endpoint

File: [`/api/v1/super-admin/counsellors/[id]/assignments/[societyId]/route.ts`](../../src/app/api/v1/super-admin/counsellors/[id]/assignments/[societyId]/route.ts)

- Keep the `DELETE` behaviour: set `isActive = false`, record revocation reason, write audit log.
- **Remove the auto-promote-secondary logic** — there is no concept of secondary to promote under the single-counsellor model. Document the removal in the migration PR.
- After revoke, the society becomes available in the picker (§5.1) for a fresh assignment.

### 7.2 SA UI — reassignment hint

On the SA society detail page (if one exists), when a society has no active counsellor, show a CTA "Assign a counsellor" that deep-links into the "Available counsellors" flow. No new endpoint — just UX glue.

### 7.3 Tests

- API: revoke sets `isActive = false`, writes audit log, does NOT mutate any other rows.
- API: after revoke, the same society appears in `available-societies` for any counsellor.
- API: re-assigning the same society to a new counsellor succeeds (409 no longer fires because the old row is `isActive = false`).

---

## 8. Phase 4 — Counsellor tickets (behaviour confirmation)

**Goal:** confirm the existing "counsellor sees their society's tickets" behaviour still holds under the single-counsellor model. No new code expected — this phase is a test-hardening phase.

### 8.1 Existing behaviour kept

File: [`/api/v1/counsellor/tickets/route.ts`](../../src/app/api/v1/counsellor/tickets/route.ts)

- Current filter `counsellorId = me` is **correct** under single-counsellor, because the auto-escalation ([`src/lib/counsellor/auto-escalate.ts`](../../src/lib/counsellor/auto-escalate.ts)) routes every escalation to the society's single active counsellor.
- No role-filter tabs (no primary/secondary concept in product).
- No shared-inbox changes.

### 8.2 Tests to add / tighten

- Auto-escalate picks the society's single active counsellor (no `isPrimary` preference logic needed — but if the code still branches on `isPrimary`, keep it working since all active assignments have `isPrimary = true`).
- Revoking the counsellor while escalations are open: the open escalation rows still reference the revoked counsellor. Call out the follow-up in §13.

---

## 9. Revoke semantics — explicitly preserved

Revoking a counsellor's assignment to a society continues to:

- Cut them off from seeing that society's tickets (the tickets query filters by `counsellorId = me`, and the revoked counsellor is no longer the target of new escalations).
- Free the society for a fresh assignment (the partial unique index only covers `isActive = true` rows).

**No escalation rows are mutated on revoke.** The `counsellorId` on open escalations continues to point at the revoked counsellor. After revoke:

- The revoked counsellor still technically sees their own historical tickets (they are still `counsellorId = me` for those rows) — **this is an open follow-up** (§13).
- A new counsellor assigned to the society does NOT automatically inherit the old open escalations.

This is the same limitation as before and is unchanged by this plan. Tracked as a follow-up (§13).

---

## 10. Phased Implementation

| Phase | Scope                                                                | Est. effort |
| ----- | -------------------------------------------------------------------- | ----------- |
| 0     | Pre-flight data audit + partial unique index migration (§4.1)        | 30 min      |
| 1     | Exclusive SA society picker + 409 guard on assignment (§5)           | 1 day       |
| 2     | Counsellor profile fields + photo upload + UI on all surfaces (§6)   | 2 days      |
| 3     | Revoke cleanup — remove auto-promote logic, confirm reassign UX (§7) | 0.5 day     |
| 4     | Counsellor tickets test-hardening (§8)                               | 0.5 day     |

Phases are independent except that **Phase 1 depends on Phase 0** (the unique index is load-bearing for the 409 race guard) and **Phase 3 depends on Phase 0** (removing auto-promote relies on the single-counsellor invariant being DB-enforced).

---

## 11. Testing & Quality Gates

Per CLAUDE.md:

- **95% per-file coverage** on every new/changed source file.
- `vi.hoisted()` for all API route mocks.
- Simulate the hook before declaring "ready to commit":
  ```bash
  npx vitest related <source-files> --run --coverage --coverage.provider=v8 --coverage.reporter=text <--coverage.include=... per file> --coverage.thresholds.perFile=true --coverage.thresholds.lines=95 --coverage.thresholds.branches=95 --coverage.thresholds.functions=95 --coverage.thresholds.statements=95
  ```
- New API routes must have 3 explicit auth tests (401, 403-wrong-role, 200-happy-path).
- Audit-log writes must be covered by the test that exercises the happy path — assert `logAudit` was called with the right `actionType`.
- Every endpoint that returns a counsellor's `photoUrl` has the signed-URL test triple (see CLAUDE.md § Pre-Commit Coverage).

---

## 12. Forward compatibility — lifting the single-counsellor cap later

This section documents how to evolve to multi-counsellor support without a painful migration.

When product decides to allow multiple counsellors per society:

1. **Drop the partial unique index** (`counsellor_one_active_per_society_uniq`) — one SQL statement, zero data migration.
2. **Reintroduce the `isPrimary` concept in UI.** The column is still on every row; only the UI needs to surface it.
3. **Update the SA society picker** — replace the exclusive hard-filter (§5.1) with a toggle like the original plan had (hide-by-default, opt-in reveal, with an "N counsellors already assigned" hint).
4. **Update the 409 guard (§5.2)** — either drop it or restrict it to the "already primary" case.
5. **Add the "Make Primary" swap endpoint + UI** (the old §6 design from this plan's prior revision can be recovered from git history).
6. **Shared inbox** — change the counsellor tickets query to filter by `societyId IN (my active societies)` with `myRole` annotation.
7. **RWA admin card** — render the full list ordered primary-first.

Because the `isPrimary` flag and the many-to-many join table were never removed, none of this requires data migration — it is all behavioural.

---

## 13. Open Questions / Follow-ups (not in this plan)

1. **Open-escalation handoff on revoke.** When a counsellor is revoked while holding un-resolved escalations, those escalations remain pointed at the revoked counsellor. Should they auto-reassign to the newly-assigned counsellor? Decide before this becomes a field issue.
2. **Notification on revoke / reassign.** Should the revoked counsellor get an email? Should the new counsellor get a "you've been assigned N society" email? Out of scope; worth deciding before launch.
3. **Profile-edit audit trail.** Every profile edit should ideally land in the counsellor audit log. Low priority — add after launch if requested.
4. **Photo moderation.** Counsellors can upload any image under 2 MB. No content moderation. If this becomes a concern, add a basic review step or integrate an image-classification API.
5. **Multi-counsellor rollout.** See §12 for the playbook — triggered by product, not eng.

---

## 14. Acceptance Criteria

This feature is "done" when all of the following are true on staging:

- [ ] Attempting to assign a society that already has an active counsellor (via UI or direct API call) returns 409 with a payload naming the existing counsellor.
- [ ] The SA "Assign societies" dialog shows only societies with zero active counsellors — assigned societies are not present at all (not hidden-behind-toggle).
- [ ] Attempting to insert a second active assignment for the same society via direct SQL fails on the partial unique index.
- [ ] A counsellor can upload a profile photo via their profile page; the photo appears on the RWA admin "Your Counsellor" card within seconds.
- [ ] A counsellor can edit phone, specialization, languages, years of experience, qualifications, and public blurb; invalid input is rejected with a clear error.
- [ ] SA can edit any counsellor's profile, including uploading a photo on their behalf.
- [ ] The RWA admin "Your Counsellor" card shows the counsellor's photo, name, contact info, specialization, languages, years of experience, qualifications, and blurb.
- [ ] The RWA admin card shows the "No counsellor assigned" empty state when the society has no active counsellor.
- [ ] Revoking a counsellor's assignment frees the society to be assigned to a different counsellor immediately.
- [ ] The counsellor tickets inbox still shows only tickets for escalations routed to the logged-in counsellor (existing behaviour, confirmed by tests).
- [ ] All new routes + UI hit 95% per-file coverage; `npm run lint` and `npx tsc --noEmit` are clean.
- [ ] `execution_plan/plans/counsellor_improved.md` § 12 documents the multi-counsellor rollback path and is reviewed by at least one reviewer.
