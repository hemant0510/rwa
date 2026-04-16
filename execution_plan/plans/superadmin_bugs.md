# Super Admin Visibility Bugs — Execution Plan

**Owner:** product/eng
**Created:** 2026-04-15
**Status:** Ready to execute
**Prerequisite:** Wave 1 (`getAdminContext` helper + 4 list endpoints) already shipped.

---

## 1. Background

SUPER_ADMIN is the platform root. The "View Dashboard As RWA Admin" flow lets SA impersonate any society via URL query: `/admin/<page>?sid=<societyId>&sname=<name>&scode=<code>`. Client-side, [useSocietyId](../../src/hooks/useSocietyId.ts) reads `sid` and flips `isSuperAdminViewing=true`; the admin layout renders a blue "Viewing as …" banner. Server-side, admin endpoints must admit SA's request and scope data to `sid`.

Wave 1 shipped `getAdminContext(targetSocietyId)` and migrated 4 list routes (residents, admin/support, admin/resident-support, admin/settings). This doc covers everything Wave 1 did not.

## 2. Global rule (lifted from CLAUDE.md)

> SUPER_ADMIN MUST be able to view / read / search every feature and every dataset across every society, unless the feature's spec explicitly carves out an exception. Writes stay RWA-scoped (audit-log attribution). Treat "SA cannot see X" as a bug.

---

## 2.1 Conventions & invariants

### `sid` vs `societyId` translation boundary

The URL uses `?sid=<id>&sname=<name>&scode=<code>`. The API routes use `?societyId=<id>`. The translation happens in the service layer:

```
Page → useSocietyId() → { societyId, saQueryString }
     → service(id, societyId) → fetch(`/api/v1/admin/…?societyId=${societyId}`)
     → route handler → searchParams.get("societyId")
```

**Rule:** Pages NEVER send `sid` to API routes. Services ALWAYS append `?societyId=`. Route handlers ALWAYS read `societyId`, never `sid`.

### `sname` / `scode` query params

`sname` and `scode` are **banner-text only** — used by `useSocietyId()` to render "Viewing as …" in the admin layout. They are NOT sent to API routes and are NOT needed for entity-derived scoping. They must be preserved in navigation Links (via `saQueryString`) but have no server-side significance.

### Test conventions (all phases)

Every "Tests:" block in this doc implies these repo-wide rules:

- **API route tests MUST use the `vi.hoisted()` mock pattern** (see `.claude/memory/feedback_vitest_mock_pattern.md`).
- **95% per-file coverage** enforced by the pre-commit hook (`scripts/test-staged.mjs`) — lines, branches, functions, statements.
- Simulate the hook with: `npx vitest related <source-files> --run --coverage --coverage.provider=v8 --coverage.reporter=text --coverage.include=<file> --coverage.thresholds.perFile=true --coverage.thresholds.lines=95 --coverage.thresholds.branches=95 --coverage.thresholds.functions=95 --coverage.thresholds.statements=95`
- Shared mocks: always `import { mockPrisma } from "../__mocks__/prisma"` — never recreate inline.

### React.cache and cookies invariant (Phase 0)

`React.cache` is request-scoped in both RSC renders and Route Handlers. Cookies are read once per request. The cache key is the request boundary — cookies cannot change mid-request, so the cached auth user is always consistent. Safe.

---

## 3. Phased rollout

| Phase | Goal                                                                     | Why first                                                                                                                                                             |
| ----- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0** | Lock contention + request-scoped auth cache                              | Prerequisite. Fixes Bug 2's AbortError AND masks future perf wins. Current "blocked" endpoints may partly be lock errors masquerading as 403s — remeasure after this. |
| **1** | Detail-route entity-derived scoping (bugs 2, 3, 5)                       | Biggest user-visible impact: all "not found" / "empty profile" pages. Also closes the missing-auth security hole on `/residents/[id]`.                                |
| **2** | Remaining list/GET migrations (bug 1 + bug 8 tail)                       | Mechanical once Phase 0+1 land.                                                                                                                                       |
| **3** | Navigation propagation (`useSAHref` + Link sweep) (bug 6)                | Unblocks SA from losing context across hops.                                                                                                                          |
| **4** | Counsellor parity (bug 9) + perf hardening (bug 7)                       | Lower-impact polish.                                                                                                                                                  |
| **5** | Dev docs (§5.6) — only remaining item (§5.1–5.5 all resolved pre-flight) | Minimal. All systemic audits passed.                                                                                                                                  |

Do NOT merge phases. Ship + verify each before starting the next. Phase 0 MUST land first.

---

## 4. Bug ledger

### Bug 1 — Governing Body, Designations, Fee Sessions not visible for SA

**Pages:** `/admin/governing-body`, `/admin/settings/designations`, `/admin/settings/fee-sessions`.

**Files:**

- [src/app/api/v1/admin/governing-body/route.ts](../../src/app/api/v1/admin/governing-body/route.ts) GET — uses `getFullAccessAdmin()`
- [src/app/api/v1/admin/designations/route.ts](../../src/app/api/v1/admin/designations/route.ts) GET — uses `getFullAccessAdmin()`
- [src/app/api/v1/admin/fee-sessions/route.ts](../../src/app/api/v1/admin/fee-sessions/route.ts) GET — uses `getFullAccessAdmin()`
- Client: [src/app/admin/governing-body/page.tsx](../../src/app/admin/governing-body/page.tsx) and corresponding settings pages + their service calls.

**Root cause:** `getFullAccessAdmin()` looks up a `User` row; SA has none. Returns null → 403.

**Fix recipe (Phase 2):**

1. Route:
   ```ts
   const { searchParams } = new URL(request.url);
   const admin = await getAdminContext(searchParams.get("societyId"));
   if (!admin || (!admin.isSuperAdmin && admin.adminPermission !== "FULL_ACCESS")) {
     return forbiddenError("Admin access required");
   }
   const societyId = admin.societyId;
   // rest of query uses societyId
   ```
2. Service: accept `societyId: string` param, append `?societyId=${encodeURIComponent(societyId)}`.
3. Page: thread `societyId` from `useSocietyId()` into the service call; keep `enabled: !!societyId` if other auth contexts require the cookie path.

**Tests:**

- 403 when caller is neither admin nor SA.
- Regular admin success (unchanged path).
- SA with `?societyId=X` returns society X's data.
- SA without `?societyId=` returns 403.

**Risk:** Low. Writes (POST/PATCH/DELETE) on the same files are not touched.

---

### Bug 2 — Resident-support ticket detail: "AbortError: Lock broken by another request with the 'steal' option"

**URL:** `/admin/resident-support/<id>?sid=…`

**Files:**

- [src/lib/supabase/server.ts](../../src/lib/supabase/server.ts) — `createClient()` creates a fresh client on every call; no per-request dedup.
- [src/app/api/v1/admin/resident-support/[id]/route.ts](../../src/app/api/v1/admin/resident-support/[id]/route.ts) GET — uses `getCurrentUser("RWA_ADMIN")`.
- Sibling routes under `[id]/`: `messages`, `status`, `priority`, `assignees`, `attachments`, `escalate`, `escalation`, `escalation-status`, `notify-counsellor`, `link-petition`, `create-petition`, `reopen`. **Audit each.**

**Root cause (lock error):** `@supabase/ssr` uses `navigator.locks` for token-refresh coordination. When the ticket-detail RSC render dispatches N parallel fetches (detail + messages + stats + petitions + governing body), each route handler calls `createClient()` → `supabase.auth.getUser()` → each contends for the same lock → one steal-preempts the rest → AbortError.

**Root cause (not-found):** `getCurrentUser("RWA_ADMIN")` returns null for SA → 403 or silent miss.

**Fix recipe (Phase 0 + Phase 1):**

**Phase 0 — intra-request dedup via `React.cache`:**

```ts
// src/lib/supabase/server.ts
import { cache } from "react";
export const createClient = cache(async () => {
  const cookieStore = await cookies();
  return createServerClient(/* …same as today… */);
});

// src/lib/get-current-user.ts — NEW helper, reused by every auth resolver
import { cache } from "react";
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});
```

Then rewrite `getCurrentUser`, `getAdminContext`, `requireSuperAdmin`, `requireCounsellor` to call `getAuthUser()` instead of `supabase.auth.getUser()`. `React.cache` is request-scoped in RSC — dedups all intra-render calls to a single auth fetch. Kills the lock contention at the source.

**Phase 1 — entity-derived scoping for detail routes:**

```ts
// Pseudocode — pattern for any /admin/.../[id] detail GET
const { id } = await params;
const entity = await prisma.residentTicket.findUnique({
  where: { id },
  select: { societyId: true /* + other fields you need */ },
});
if (!entity) return notFoundError();

const admin = await getAdminContext(entity.societyId);
if (!admin) return forbiddenError("Admin access required");
// now safe to fetch the rest scoped to entity.societyId
```

Entity-derived scoping is safer than trusting `?societyId=` from the client — the entity itself is the source of truth, and an RWA admin accessing another society's ticket gets null via `getAdminContext` because `admin.societyId !== entity.societyId`.

**Tests:**

- 6 tests for `createClient`+`getAuthUser` cache: 10 concurrent calls = 1 underlying `auth.getUser`.
- Detail route: 404 when entity missing; 403 when caller neither admin-of-that-society nor SA; SA success regardless of `?societyId=`.

**Risk:** Medium. `React.cache` swap touches every auth resolver — regression-test the `/api/v1/auth/me` path, `requireSuperAdmin` pages, counsellor routes before shipping.

**Existing test file:** [tests/lib/get-current-user.test.ts](../../tests/lib/get-current-user.test.ts) — update mocks after adding `getAuthUser`. Also update the 75 test files that mock `get-current-user` (grep: `getAdminContext|get-current-user` across `tests/`).

**Rollback plan:** Ship Phase 0 as a single PR with isolated commits:

1. Commit 1: `getAuthUser` + `createClient` cache wrappers (no callers changed)
2. Commit 2: `getCurrentUser` → `getAuthUser`
3. Commit 3: `getAdminContext` → `getAuthUser`
4. Commit 4: `requireSuperAdmin` → `getAuthUser`
5. Commit 5: `requireCounsellor` → `getAuthUser`

If prod breaks, revert the last commit(s) to isolate which resolver caused the regression. Do NOT squash-merge this PR.

**Regression checklist (run after each commit):**

- `GET /api/v1/auth/me` — regular admin, SA, resident
- `GET /api/v1/admin/residents?societyId=X` — regular admin + SA
- `GET /api/v1/super-admin/dashboard` — SA-only
- Any counsellor route — counsellor user
- Cold page load of `/admin/residents?sid=X` — verify no AbortError in server logs

---

### Bug 3 — Admin support detail "Request not found" for SA

**URL:** `/admin/support/<id>?sid=…`

**Files:**

- [src/app/api/v1/admin/support/[id]/route.ts](../../src/app/api/v1/admin/support/[id]/route.ts) GET — `findUnique({ where: { id, societyId: user.societyId } })`; `user` null for SA.
- Sibling routes: `[id]/messages` (POST/GET), `[id]/reopen` (POST).

**Root cause:** Implicit society scoping via `user.societyId` in the `where` clause fails for SA.

**Fix recipe (Phase 1):** entity-derived scoping (same recipe as Bug 2).

**Tests:** same shape as Bug 2. Additionally: GET of an RWA admin against a ticket in a DIFFERENT society must 403, not leak.

---

### Bug 4 — Vehicle search 403 "Unable to search vehicles"

**URL:** `/admin/residents?mode=vehicle&search=HR85&sid=…`

**Files:**

- [src/app/api/v1/admin/vehicles/search/route.ts](../../src/app/api/v1/admin/vehicles/search/route.ts) GET — `getCurrentUser("RWA_ADMIN")`.
- Service: [src/services/admin-residents.ts](../../src/services/admin-residents.ts) `searchAdminVehicles` — does not append `societyId`.
- Page: [src/app/admin/residents/page.tsx](../../src/app/admin/residents/page.tsx) vehicle-mode query.

**Root cause:** Standard SA-block + no societyId threading.

**Fix recipe (Phase 2):**

1. Route: swap to `getAdminContext(searchParams.get("societyId"))`, then query on `admin.societyId`.
2. Service signature: `searchAdminVehicles(q: string, societyId: string, params?)` — append `societyId`.
3. Page: `useSocietyId()` → pass to service; include `societyId` in react-query `queryKey`; `enabled: searchMode === "vehicle" && search.trim().length >= 3 && !!societyId`.

**Tests:** 3 tests in the route spec (standard SA trio) + 1 test in the page spec that the service is called with `societyId`.

---

### Bug 5 — Resident detail page missing family/profile + SECURITY: unauth GET

**URL:** `/admin/residents/<id>?sid=…` (profile sub-tabs fail)

**Files + roots:**

- [src/app/api/v1/residents/[id]/route.ts](../../src/app/api/v1/residents/[id]/route.ts) GET — **NO AUTH AT ALL**. Anyone with a resident UUID can read. Pre-existing P0 security bug. Bundle the fix here because the same migration adds SA support.
- [src/app/api/v1/residents/[id]/family/route.ts](../../src/app/api/v1/residents/[id]/family/route.ts) GET — `getCurrentUser("RWA_ADMIN")` then `admin.societyId !== resident.societyId` check.
- [src/app/api/v1/residents/[id]/vehicles/route.ts](../../src/app/api/v1/residents/[id]/vehicles/route.ts) GET — same.
- Also audit: `/dependents`, `/send-verification`, `/send-setup-email`, `/id-proof`, `/ownership-proof`, `/approve`, `/reject` — approve/reject are mutations, keep RWA-scoped.

**Fix recipe (Phase 1):** entity-derived scoping.

```ts
const { id } = await params;
const resident = await prisma.user.findUnique({
  where: { id },
  select: { societyId: true /* plus any fields needed */ },
});
if (!resident) return notFoundError();
const admin = await getAdminContext(resident.societyId);
if (!admin) return forbiddenError("Admin access required");
// fetch full profile
```

**Client:**

- Service signatures: `getResident(id, societyId)`, `getResidentFamily(id, societyId)`, `getResidentVehicles(id, societyId)`.
- Page ([src/app/admin/residents/[id]/page.tsx](../../src/app/admin/residents/[id]/page.tsx)): `const { societyId } = useSocietyId();` — thread into all three queries; `enabled: !!societyId`.

**Tests:**

- P0 security regression: un-authenticated fetch of `/api/v1/residents/<id>` → 403 (was 200).
- SA view of another society's resident → success when SA, 403 when wrong-society admin.

**Risk:** Medium — public test-framework or external consumer could be calling the currently-open GET. Grep repo for `/api/v1/residents/${` callers and verify they all pass auth cookies.

---

### Bug 6 — SA banner vanishes on navigation + back button loses context

**Symptom:** click on a resident row from `/admin/residents?sid=X&sname=Y&scode=Z` → land on `/admin/residents/<id>` with NO query params → banner gone, `isSuperAdminViewing=false`, subsequent clicks break.

**Files — root cause:**

- Confirmed offender: [src/app/admin/residents/page.tsx:532](../../src/app/admin/residents/page.tsx#L532): `<Link href={`/admin/residents/${resident.id}`}>` — no `saQueryString`.
- Detail page ([src/app/admin/residents/[id]/page.tsx](../../src/app/admin/residents/[id]/page.tsx) lines 157, 229) DOES append `saQueryString` to its back-link — but `useSocietyId()` has already observed the empty query and returned `saQueryString=""`, so the back link points to `/admin/residents` bare. Cascade failure: the forward Link is the real root cause.

**Complete Link/router.push inventory (grep 2026-04-16):**

`<Link>` without `saQueryString` (5 sites):

| #   | File                                           | Line | Code                                                     |
| --- | ---------------------------------------------- | ---- | -------------------------------------------------------- |
| 1   | `src/app/admin/residents/page.tsx`             | 532  | `<Link href={/admin/residents/${resident.id}}>`          |
| 2   | `src/app/admin/migration/page.tsx`             | 315  | `<Link href="/admin/residents?status=MIGRATED_PENDING">` |
| 3   | `src/app/admin/settings/page.tsx`              | 158  | `<Link href="/admin/settings/subscription">`             |
| 4   | `src/app/admin/settings/page.tsx`              | 176  | `<Link href="/admin/settings/payment-setup">`            |
| 5   | `src/app/admin/settings/subscription/page.tsx` | 74   | `<Link href="/admin/settings">`                          |

`router.push`/`router.replace` without `saQueryString` (8 sites):

| #   | File                                            | Line | Code                                           |
| --- | ----------------------------------------------- | ---- | ---------------------------------------------- |
| 6   | `src/app/admin/events/page.tsx`                 | 276  | `router.push(/admin/events/${event.id})`       |
| 7   | `src/app/admin/events/[eventId]/page.tsx`       | 352  | `router.push("/admin/events")`                 |
| 8   | `src/app/admin/events/[eventId]/page.tsx`       | 529  | `router.push("/admin/events")`                 |
| 9   | `src/app/admin/events/[eventId]/page.tsx`       | 548  | `router.push("/admin/events")`                 |
| 10  | `src/app/admin/petitions/page.tsx`              | 227  | `router.push(/admin/petitions/${petition.id})` |
| 11  | `src/app/admin/petitions/[petitionId]/page.tsx` | 376  | `router.push("/admin/petitions")`              |
| 12  | `src/app/admin/petitions/[petitionId]/page.tsx` | 484  | `router.push("/admin/petitions")`              |
| 13  | `src/app/admin/petitions/[petitionId]/page.tsx` | 502  | `router.push("/admin/petitions")`              |

**SA-blind pages** (don't call `useSocietyId` at all — can't form URLs or thread `societyId`):

| #   | File                                         | Uses `useSocietyId`? | Needs it?                                 |
| --- | -------------------------------------------- | -------------------- | ----------------------------------------- |
| 1   | `src/app/admin/announcements/page.tsx`       | No                   | Yes — list + service call                 |
| 2   | `src/app/admin/migration/page.tsx`           | No                   | Yes — Link + service call                 |
| 3   | `src/app/admin/reports/page.tsx`             | No                   | Yes — service call                        |
| 4   | `src/app/admin/profile/page.tsx`             | No                   | No — see §Bug 8 `/admin/profile` decision |
| 5   | `src/app/admin/fees/claims/page.tsx`         | No                   | Yes — service call                        |
| 6   | `src/app/admin/support/[requestId]/page.tsx` | No                   | Yes — detail + back-link                  |

Pages that destructure `societyId` but NOT `saQueryString` (router.push breaks):

| #   | File                                            |
| --- | ----------------------------------------------- |
| 7   | `src/app/admin/events/page.tsx`                 |
| 8   | `src/app/admin/events/[eventId]/page.tsx`       |
| 9   | `src/app/admin/petitions/page.tsx`              |
| 10  | `src/app/admin/petitions/[petitionId]/page.tsx` |

**Fix recipe (Phase 3):**

1. Extend [src/hooks/useSocietyId.ts](../../src/hooks/useSocietyId.ts) with a helper:
   ```ts
   export function useSAHref(basePath: string): string {
     const { saQueryString } = useSocietyId();
     return `${basePath}${saQueryString}`;
   }
   ```
2. Fix all 13 Link/router.push sites listed above — use `useSAHref` OR inline `${saQueryString}`.
3. Add `useSocietyId` to all 6 SA-blind pages and thread `societyId` into their service calls.
4. For pages that already have `useSocietyId` but not `saQueryString` (#7–10), destructure `saQueryString` and append to all `router.push` calls.
5. Consider a one-time lint rule (ESLint custom) that fails CI on `<Link href=.*\/admin\/` without `saQueryString`.

**Tests:**

- Per page: render with `useSocietyId` mocked as SA viewing → assert all rendered Link hrefs contain `?sid=`.
- Manual smoke: navigate 3 hops deep from dashboard; banner stays; back button preserves context.

**Risk:** Low, but mechanically large — 13 Link sites + 6 SA-blind pages + 4 partial pages = 23 touch-points.

---

### Bug 7 — Performance degradation

**Confirmed hot paths:**

1. **[src/lib/counsellor/feature-flag.ts](../../src/lib/counsellor/feature-flag.ts)** — `prisma.platformConfig.findUnique` on EVERY counsellor-guarded request. No cache.

   Fix:

   ```ts
   import { cache } from "react";
   export const isCounsellorRoleEnabled = cache(async () => {
     const row = await prisma.platformConfig.findUnique({
       where: { key: FLAG_KEY },
       select: { value: true },
     });
     return row?.value === "true";
   });
   ```

   Or `unstable_cache` with a 1h revalidate if you want cross-request caching. `React.cache` alone gives intra-request dedup which is enough to fix the "called N times per page" issue.

2. **[src/lib/supabase/server.ts](../../src/lib/supabase/server.ts)** — addressed in Phase 0 (Bug 2).

3. **[src/app/api/v1/auth/me/route.ts](../../src/app/api/v1/auth/me/route.ts)** — called on every page nav from `AuthContext`. For multi-society users, fetches all societies each time. Review:
   - Grep the client for `/api/v1/auth/me` callers; confirm `staleTime` on that react-query key.
   - Consider moving multi-society list to a separate lazy endpoint; keep `/me` to minimum profile + active society.

4. Hypothesis (unverified): client `AuthContext` may `refetchOnWindowFocus`. Confirm; set `staleTime: Infinity` with explicit invalidation on login/logout/societySwitch if so.

**Phase 4 task.** Benchmark cold-start load of `/admin/residents?sid=…` before vs after Phase 0 — a lot of "slowness" perception may be the lock error's retry loop, not true CPU/IO time.

**Perf baseline (capture BEFORE Phase 0):** Record p50/p95 for cold-start load of `/admin/residents?sid=…` using browser DevTools Network tab. Save the numbers so Phase 4 can compare before/after with real data, not guesses.

**Tests:** add a counter mock on `prisma.platformConfig.findUnique` in an integration test that hits 3 counsellor routes back-to-back; assert `toHaveBeenCalledTimes(1)` after cache lands.

---

### Bug 8 — Remaining SA blackouts (full audit)

All `export async function GET` under `src/app/api/v1/admin/**` that still block SA (excluding those already fixed in Wave 1):

| Route                                  | File                                                                          | Auth helper                   | Fix type                              |
| -------------------------------------- | ----------------------------------------------------------------------------- | ----------------------------- | ------------------------------------- |
| `/admin/announcements`                 | [route.ts](../../src/app/api/v1/admin/announcements/route.ts)                 | `getCurrentUser("RWA_ADMIN")` | Swap to `getAdminContext(?societyId)` |
| `/admin/support/[id]`                  | [route.ts](../../src/app/api/v1/admin/support/[id]/route.ts)                  | `getCurrentUser("RWA_ADMIN")` | Entity-derived (Bug 3)                |
| `/admin/support/unread-count`          | [route.ts](../../src/app/api/v1/admin/support/unread-count/route.ts)          | `getCurrentUser("RWA_ADMIN")` | Swap + pass `?societyId` from page    |
| `/admin/resident-support/[id]`         | [route.ts](../../src/app/api/v1/admin/resident-support/[id]/route.ts)         | `getCurrentUser("RWA_ADMIN")` | Entity-derived (Bug 2)                |
| `/admin/resident-support/unread-count` | [route.ts](../../src/app/api/v1/admin/resident-support/unread-count/route.ts) | `getCurrentUser("RWA_ADMIN")` | Swap + pass `?societyId`              |
| `/admin/vehicles/search`               | [route.ts](../../src/app/api/v1/admin/vehicles/search/route.ts)               | `getCurrentUser("RWA_ADMIN")` | Swap (Bug 4)                          |
| `/admin/governing-body`                | [route.ts](../../src/app/api/v1/admin/governing-body/route.ts)                | `getFullAccessAdmin()`        | Swap (Bug 1)                          |
| `/admin/designations`                  | [route.ts](../../src/app/api/v1/admin/designations/route.ts)                  | `getFullAccessAdmin()`        | Swap                                  |
| `/admin/fee-sessions`                  | [route.ts](../../src/app/api/v1/admin/fee-sessions/route.ts)                  | `getFullAccessAdmin()`        | Swap                                  |
| `/admin/profile`                       | [route.ts](../../src/app/api/v1/admin/profile/route.ts)                       | `getCurrentUser("RWA_ADMIN")` | **Special** — see below               |
| `/admin/counsellor`                    | [route.ts](../../src/app/api/v1/admin/counsellor/route.ts)                    | `getCurrentUser("RWA_ADMIN")` | Swap                                  |

**`/admin/profile` — DECISION LOCKED:** **(a) Return the SA's own profile.** SA hits `/admin/profile` → show SA identity (name, email from `super_admins` table) with a "You are Super Admin" banner. The route should check for SA via `getAuthUser()` → `superAdmin.findUnique()` fallback when no `User` row found. No `?societyId=` needed — profile is the SA's own data. This does NOT need the Phase 3 `useSocietyId` treatment.

**SA-blind pages** (don't call `useSocietyId`, so can't form URLs or thread `societyId`):

| #   | Page                                                                                           | Needs `useSocietyId`? | Notes                                     |
| --- | ---------------------------------------------------------------------------------------------- | --------------------- | ----------------------------------------- |
| 1   | [src/app/admin/announcements/page.tsx](../../src/app/admin/announcements/page.tsx)             | Yes                   | List + service call                       |
| 2   | [src/app/admin/migration/page.tsx](../../src/app/admin/migration/page.tsx)                     | Yes                   | Link + service call                       |
| 3   | [src/app/admin/reports/page.tsx](../../src/app/admin/reports/page.tsx)                         | Yes                   | Service call                              |
| 4   | [src/app/admin/profile/page.tsx](../../src/app/admin/profile/page.tsx)                         | No                    | SA profile = SA's own data (decision (a)) |
| 5   | [src/app/admin/fees/claims/page.tsx](../../src/app/admin/fees/claims/page.tsx)                 | Yes                   | Service call                              |
| 6   | [src/app/admin/support/[requestId]/page.tsx](../../src/app/admin/support/[requestId]/page.tsx) | Yes                   | Detail + back-link                        |

Pages #1–3, #5–6 need the Phase 3 Link/useSocietyId treatment. Page #4 is exempt per the profile decision above.

---

### Bug 9 — Counsellor view parity for SA

Counsellor pages under `src/app/counsellor/(authed)/**` are gated by `requireCounsellor()` in [src/lib/auth-guard.ts](../../src/lib/auth-guard.ts). SA has no Counsellor row → refused.

**Chosen approach:** extend `requireCounsellor()` (NOT a new `?counsellorId=` mechanism — that would duplicate the whole SA-view-as infrastructure).

**Recipe (Phase 4):**

```ts
// src/lib/auth-guard.ts
export async function requireCounsellor(): Promise<CounsellorAuthResult> {
  const enabled = await isCounsellorRoleEnabled();
  if (!enabled) return { data: null, error: forbiddenError("Counsellor role is disabled") };

  const user = await getAuthUser(); // from Phase 0
  if (!user) return { data: null, error: unauthorizedError() };

  const counsellor = await prisma.counsellor.findUnique({
    where: { authUserId: user.id },
    select: { id: true, authUserId: true, email: true, name: true, isActive: true },
  });
  if (counsellor?.isActive) {
    return {
      data: {
        counsellorId: counsellor.id,
        authUserId: user.id,
        email: counsellor.email,
        name: counsellor.name,
        isSuperAdmin: false,
      },
      error: null,
    };
  }

  // SA fallback — READ-ONLY
  const sa = await prisma.superAdmin.findUnique({
    where: { authUserId: user.id },
    select: { id: true, email: true, name: true, isActive: true },
  });
  if (sa?.isActive) {
    return {
      data: {
        counsellorId: "__super_admin__",
        authUserId: user.id,
        email: sa.email,
        name: sa.name,
        isSuperAdmin: true,
      },
      error: null,
    };
  }

  return { data: null, error: forbiddenError("Counsellor access required") };
}
```

`CounsellorAuthContext` adds `isSuperAdmin: boolean`. Every counsellor route that mutates (POST/PATCH/DELETE) AND writes rows keyed by `counsellorId` FK MUST check `if (ctx.isSuperAdmin) return forbiddenError("Super Admin cannot perform counsellor actions")`.

**Counsellor route FK audit (grep 2026-04-16):**

Mutation routes that write `counsellorId` FK — **SA MUST be blocked:**

| #   | Route                                  | Method | File                                                          | FK writes on lines |
| --- | -------------------------------------- | ------ | ------------------------------------------------------------- | ------------------ |
| 1   | `/counsellor/tickets/[id]/acknowledge` | POST   | `src/app/api/v1/counsellor/tickets/[id]/acknowledge/route.ts` | L50                |
| 2   | `/counsellor/tickets/[id]/defer`       | POST   | `src/app/api/v1/counsellor/tickets/[id]/defer/route.ts`       | L57, L78           |
| 3   | `/counsellor/tickets/[id]/resolve`     | POST   | `src/app/api/v1/counsellor/tickets/[id]/resolve/route.ts`     | L57, L78           |
| 4   | `/counsellor/tickets/[id]/messages`    | POST   | `src/app/api/v1/counsellor/tickets/[id]/messages/route.ts`    | L56, L83           |
| 5   | `/counsellor/me`                       | PATCH  | `src/app/api/v1/counsellor/me/route.ts`                       | L61                |

Read routes that filter by `counsellorId` — **SA gets unfiltered (all counsellors):**

| #   | Route                             | Method | File                                                     | Filter on lines      |
| --- | --------------------------------- | ------ | -------------------------------------------------------- | -------------------- |
| 6   | `/counsellor/tickets`             | GET    | `src/app/api/v1/counsellor/tickets/route.ts`             | L39                  |
| 7   | `/counsellor/tickets/[id]`        | GET    | `src/app/api/v1/counsellor/tickets/[id]/route.ts`        | L18                  |
| 8   | `/counsellor/dashboard`           | GET    | `src/app/api/v1/counsellor/dashboard/route.ts`           | L16, L20, L39        |
| 9   | `/counsellor/analytics/portfolio` | GET    | `src/app/api/v1/counsellor/analytics/portfolio/route.ts` | L28, L34, L160, L163 |
| 10  | `/counsellor/societies`           | GET    | `src/app/api/v1/counsellor/societies/route.ts`           | L11                  |
| 11  | `/counsellor/societies/[id]`      | GET    | `src/app/api/v1/counsellor/societies/[id]/route.ts`      | L42                  |

**`assertCounsellorSocietyAccess` also needs SA bypass** ([src/lib/counsellor/access.ts](../../src/lib/counsellor/access.ts)) — it checks `counsellorSocietyAssignment` which SA won't have. Add early return if `ctx.isSuperAdmin`.

Society sub-routes that use `assertCounsellorSocietyAccess` (SA reads all societies, no assignment check):

- `GET /counsellor/societies/[id]/governing-body`
- `GET /counsellor/societies/[id]/residents`
- `GET /counsellor/societies/[id]/residents/[rid]`

Reads that need `counsellorId`:

- For real counsellor: keep filtering by `counsellorId: ctx.counsellorId`.
- For SA: skip the counsellor filter (return all societies / all tickets across all counsellors). Explicit branch.

**Tests:** one per counsellor route — SA GET returns unfiltered, SA write returns 403.

---

## 5. Systemic gaps (Phase 5) — surfaced during plan review

These are categories of SA visibility that are not API-route-level but can still silently blackhole data. Audit needed before calling the fix complete.

### 5.1 Supabase RLS policies — ✅ RESOLVED (no action needed)

**Grep result (2026-04-16):** Zero `supabase.from(` calls found in `src/`. All database access uses Prisma with the service-role connection string. No RLS exposure for SA.

### 5.2 Storage signed URLs — ✅ RESOLVED (no action needed)

**Grep result (2026-04-16):** All 21 `.createSignedUrl(` calls use `createAdminClient()` (service-role key), which bypasses bucket policies. No client-side storage access found. SA is safe through storage.

Files using `createSignedUrl` (all server-side, all via `createAdminClient`):

- `src/app/api/v1/residents/[id]/route.ts` (L42)
- `src/app/api/v1/residents/[id]/family/route.ts` (L16)
- `src/app/api/v1/residents/[id]/vehicles/route.ts` (L17)
- `src/app/api/v1/residents/[id]/id-proof/route.ts` (L117)
- `src/app/api/v1/residents/[id]/ownership-proof/route.ts` (L99)
- `src/app/api/v1/residents/route.ts` (L205)
- `src/app/api/v1/residents/me/*` (7 files — resident-facing, not admin)
- `src/app/api/v1/super-admin/residents/route.ts` (L100)
- `src/app/api/v1/admin/resident-support/[id]/attachments/route.ts` (L41)
- `src/app/api/v1/societies/[id]/petitions/[petitionId]/*` (3 files)

### 5.3 Realtime channels — ✅ RESOLVED (no action needed)

**Grep result (2026-04-16):** Zero `supabase.channel(` calls found in `src/app/admin/`. No admin pages use Realtime subscriptions. Notification/unread-count updates use polling via react-query, not Realtime channels.

### 5.4 Server Actions — ✅ RESOLVED (no action needed)

**Grep result (2026-04-16):** Zero `'use server'` directives found in `src/app/admin/`. No server actions exist in admin pages. All admin forms use client-side mutations via react-query → API routes.

### 5.5 Middleware — ✅ RESOLVED (SA passes, no action needed)

**Analysis (2026-04-16):** There is no `src/middleware.ts`. The app uses `src/proxy.ts` which calls `updateSession()` from `src/lib/supabase/middleware.ts`.

The proxy's auth logic (L54–72):

- API routes: checks `!!user` only — no role check. SA with a valid Supabase session passes.
- Protected pages: redirects if `!user` — no role check. SA passes.
- `/admin` and `/sa` paths: inactivity timeout via `admin-last-activity` cookie — no role check. SA passes.

**Result:** SA is admitted to all `/admin/*` pages and API routes at the middleware level. No changes needed.

### 5.6 Dev hazard — session cookie collision

Not a code bug, but document: if SA and RWA_ADMIN sign in to the same browser at overlapping times, `active-society-id` cookie can produce ghost behavior. Add a brief note to developer docs: "when testing SA impersonation, use an incognito window or explicit `Sign out` between roles."

---

## 6. Summary priority & acceptance

| Priority | Fix                                                            | Phase                            |
| -------- | -------------------------------------------------------------- | -------------------------------- |
| **P0**   | Supabase client lock fix (`React.cache`)                       | 0                                |
| **P0**   | `/api/v1/residents/[id]` unauth security hole                  | 1 (bundled with Bug 5)           |
| **P0**   | Support + resident-support detail routes (SA + entity-scoping) | 1                                |
| **P0**   | Residents list Link — preserve `saQueryString`                 | 3 (but ship ASAP, it's one-line) |
| **P1**   | Governing-body / designations / fee-sessions / vehicles-search | 2                                |
| **P1**   | Full admin Link sweep (13 sites) + SA-blind pages (5 pages)    | 3                                |
| **P2**   | Counsellor parity (5 mutation blocks + 6 read routes)          | 4                                |
| **P2**   | Counsellor feature-flag caching + `/auth/me` perf review       | 4                                |
| **P3**   | Dev docs: session cookie collision warning (§5.6)              | 5                                |

**Done definition:** walk every URL in the user's original report as an SA; every dataset renders; the blue "Viewing as …" banner persists across ≥ 3 navigation hops; no AbortError in server logs under normal use; `npm run test:coverage` green at ≥ 95% per file.

---

## 7. Per-phase sign-off checklist

Each phase MUST pass its checklist before merging. Do not batch phases.

### Phase 0 — Sign-off

- [ ] `getAuthUser` + `createClient` cache wrappers unit-tested (10 concurrent calls = 1 `auth.getUser`)
- [ ] All 4 auth resolvers (`getCurrentUser`, `getAdminContext`, `requireSuperAdmin`, `requireCounsellor`) migrated to `getAuthUser()`
- [ ] Regression checklist passes (§Bug 2 rollback plan)
- [ ] `npx vitest related` on all changed files passes 95% per-file coverage
- [ ] No AbortError in server logs during manual smoke test of `/admin/resident-support/<id>?sid=…`
- [ ] `npx tsc --noEmit` clean

### Phase 1 — Sign-off

- [ ] Entity-derived scoping on: `/admin/resident-support/[id]`, `/admin/support/[id]`, `/residents/[id]`, `/residents/[id]/family`, `/residents/[id]/vehicles`
- [ ] P0 security: unauthenticated GET `/api/v1/residents/<id>` → 403
- [ ] SA can view resident detail, support ticket detail, resident-support ticket detail
- [ ] Wrong-society admin gets 403 on all entity-derived routes
- [ ] `npx vitest related` passes; `npx tsc --noEmit` clean

### Phase 2 — Sign-off

- [ ] All routes in Bug 1 + Bug 8 table migrated to `getAdminContext`
- [ ] SA can view: governing body, designations, fee sessions, vehicles search, announcements, unread counts, counsellor list
- [ ] `/admin/profile` shows SA identity (decision (a))
- [ ] `npx vitest related` passes; `npx tsc --noEmit` clean

### Phase 3 — Sign-off

- [ ] All 13 Link/router.push sites fixed (Bug 6 inventory table)
- [ ] All 5 SA-blind pages wired to `useSocietyId` (excluding profile)
- [ ] 4 partial pages (events, petitions) destructure `saQueryString`
- [ ] Manual smoke: navigate dashboard → residents list → resident detail → back → petitions → petition detail — banner persists at every hop
- [ ] `npx vitest related` passes; `npx tsc --noEmit` clean

### Phase 4 — Sign-off

- [ ] `requireCounsellor()` extended with SA fallback
- [ ] All 5 mutation routes block SA with 403
- [ ] All 6 read routes return unfiltered data for SA
- [ ] `assertCounsellorSocietyAccess` bypassed for SA
- [ ] `isCounsellorRoleEnabled` uses `React.cache`
- [ ] `npx vitest related` passes; `npx tsc --noEmit` clean

### Phase 5 — Sign-off

- [x] §5.1 RLS: zero `supabase.from(` calls — no action (resolved pre-flight)
- [x] §5.2 Storage: all `createSignedUrl` via service-role — no action (resolved pre-flight)
- [x] §5.3 Realtime: zero `supabase.channel(` in admin — no action (resolved pre-flight)
- [x] §5.4 Server actions: zero `'use server'` in admin — no action (resolved pre-flight)
- [x] §5.5 Middleware: `src/proxy.ts` only checks `!!user` — SA passes (resolved pre-flight)
- [ ] §5.6 Dev docs updated with session cookie collision warning
- [ ] Final walkthrough: every URL from original bug report renders correctly as SA
