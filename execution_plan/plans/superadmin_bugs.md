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

## 3. Phased rollout

| Phase | Goal                                                                                    | Why first                                                                                                                                                             |
| ----- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0** | Lock contention + request-scoped auth cache                                             | Prerequisite. Fixes Bug 2's AbortError AND masks future perf wins. Current "blocked" endpoints may partly be lock errors masquerading as 403s — remeasure after this. |
| **1** | Detail-route entity-derived scoping (bugs 2, 3, 5)                                      | Biggest user-visible impact: all "not found" / "empty profile" pages. Also closes the missing-auth security hole on `/residents/[id]`.                                |
| **2** | Remaining list/GET migrations (bug 1 + bug 8 tail)                                      | Mechanical once Phase 0+1 land.                                                                                                                                       |
| **3** | Navigation propagation (`useSAHref` + Link sweep) (bug 6)                               | Unblocks SA from losing context across hops.                                                                                                                          |
| **4** | Counsellor parity (bug 9) + perf hardening (bug 7)                                      | Lower-impact polish.                                                                                                                                                  |
| **5** | Systemic gaps from plan review (RLS / storage / realtime / server actions / middleware) | Audit + hardening.                                                                                                                                                    |

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

**Files:**

- Confirmed offender: [src/app/admin/residents/page.tsx:532](../../src/app/admin/residents/page.tsx#L532): `<Link href={`/admin/residents/${resident.id}`}>` — no `saQueryString`.
- Detail page ([src/app/admin/residents/[id]/page.tsx](../../src/app/admin/residents/[id]/page.tsx) lines 157, 229) DOES append `saQueryString` to its back-link — but `useSocietyId()` has already observed the empty query and returned `saQueryString=""`, so the back link points to `/admin/residents` bare. Cascade failure: the forward Link is the real root cause.
- Grep sweep needed across `src/app/admin/**/*.tsx` for `<Link href="/admin/...">` or `` `/admin/...` `` not followed by `saQueryString`.

**Fix recipe (Phase 3):**

1. Extend [src/hooks/useSocietyId.ts](../../src/hooks/useSocietyId.ts) with a helper:
   ```ts
   export function useSAHref(basePath: string): string {
     const { saQueryString } = useSocietyId();
     return `${basePath}${saQueryString}`;
   }
   ```
2. Grep sweep: every `<Link href="/admin/…">` and `router.push("/admin/…")` / `router.push(`/admin/…`)` inside `src/app/admin/` must use `useSAHref` OR inline `${saQueryString}`.
3. At minimum: fix [src/app/admin/residents/page.tsx:532](../../src/app/admin/residents/page.tsx#L532), [src/app/admin/settings/page.tsx](../../src/app/admin/settings/page.tsx) (Subscription, Payment Setup cards), [src/app/admin/migration/page.tsx](../../src/app/admin/migration/page.tsx), [src/app/admin/settings/subscription/page.tsx](../../src/app/admin/settings/subscription/page.tsx).
4. Consider a one-time lint rule (ESLint custom) that fails CI on `<Link href=.*\/admin\/` without `saQueryString`.

**Tests:**

- Page test: render residents list with `useSocietyId` mocked as SA viewing → assert rendered row Link href contains `?sid=`.
- Manual smoke: navigate 3 hops deep; banner stays.

**Risk:** Low, but mechanically large — ~10-20 Link touch-points.

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

**`/admin/profile` special case:** "profile" for a SA-viewing-as-admin is semantically undefined. Decide one of:

- (a) Return the SA's own profile (recommended — matches the real session).
- (b) Return synthetic "Viewing as Super Admin" record.
- (c) 404.

Doc recommendation: (a). If SA hits `/admin/profile`, show their SA identity with a "you are Super Admin" banner.

**SA-blind pages** (don't call `useSocietyId`, so can't even form URLs):

- [src/app/admin/announcements/page.tsx](../../src/app/admin/announcements/page.tsx)
- [src/app/admin/migration/page.tsx](../../src/app/admin/migration/page.tsx)
- [src/app/admin/reports/page.tsx](../../src/app/admin/reports/page.tsx)
- [src/app/admin/profile/page.tsx](../../src/app/admin/profile/page.tsx) (fine if rule (a) above)

All four need the Phase 3 Link/useSocietyId treatment.

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

`CounsellorAuthContext` adds `isSuperAdmin: boolean`. Every counsellor route that mutates (POST/PATCH/DELETE) AND writes rows keyed by `counsellorId` FK (e.g. assignment, resolution-by, notes) MUST check `if (ctx.isSuperAdmin) return forbiddenError("Super Admin cannot perform counsellor actions")`. **Audit all counsellor routes for FK writes before shipping this phase.**

Reads that need `counsellorId` (dashboard KPIs, "my societies", "my tickets") should do:

- For real counsellor: keep filtering by `counsellorId: ctx.counsellorId`.
- For SA: skip the counsellor filter (return all societies / all tickets across all counsellors). Explicit branch.

**Tests:** one per counsellor route — SA GET returns unfiltered, SA write returns 403.

---

## 5. Systemic gaps (Phase 5) — surfaced during plan review

These are categories of SA visibility that are not API-route-level but can still silently blackhole data. Audit needed before calling the fix complete.

### 5.1 Supabase RLS policies

If any client-side code does `supabase.from('<table>').select(…)` (not Prisma on service-role key), RLS policies apply. Typical policies key off `auth.uid()` existing in the `User` table for that society. SA has no User row → empty result, no error.

**Action:** Grep the codebase for `supabase.from(`. For each hit:

- If it's reading admin data, either (i) migrate to a Prisma-backed API route, or (ii) add an RLS policy clause `OR auth.uid() IN (SELECT auth_user_id FROM super_admins WHERE is_active = true)`.

### 5.2 Storage signed URLs

`supabase.storage.from('<bucket>').createSignedUrl(…)` respects bucket policies. If bucket policies enforce society membership, SA reads may fail silently (null url).

**Action:** Grep `.createSignedUrl(`. For each:

- Server-side using service-role client → safe.
- Client-side → verify bucket policy admits SA.

Known buckets worth checking: `resident-photos`, ID-proof, ownership-proof, receipt uploads, society registration docs.

### 5.3 Realtime channels

`supabase.channel(…).on(…)` subscriptions filter by RLS server-side. Same class of bug as 5.1. Less likely in admin views — check notification / unread-count live updates.

### 5.4 Server Actions

`'use server'` functions resolve auth via `getCurrentUser` too. If any admin page uses a Server Action (forms, toggles), SA submission will 403 even when the page loads.

**Action:** Grep `^'use server'$` in `src/app/admin/`. Migrate those functions to use `getAdminContext` with an explicit societyId parameter (server actions don't have a `request.url`, so the client must pass societyId in the action args).

### 5.5 Middleware

`middleware.ts` at `src/middleware.ts` (or under `src/lib/supabase/middleware.ts`) may gate `/admin/*` by role. Verify it admits SA.

**Action:** Read middleware; ensure SA (identified by row in `super_admins`) passes the `/admin/*` matcher.

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
| **P1**   | Full admin Link sweep                                          | 3                                |
| **P2**   | Counsellor parity                                              | 4                                |
| **P2**   | Counsellor feature-flag caching + `/auth/me` perf review       | 4                                |
| **P3**   | RLS / storage / realtime / server actions / middleware audit   | 5                                |

**Done definition:** walk every URL in the user's original report as an SA; every dataset renders; the blue "Viewing as …" banner persists across ≥ 3 navigation hops; no AbortError in server logs under normal use; `make coverage` green at ≥ 95% per file.
