---
name: Super Admin is the platform root — global read access
description: SUPER_ADMIN must see every feature/dataset across every society; uses getAdminContext on the server and useSocietyId on the client; writes stay RWA-scoped.
type: project
---

Rule: SUPER_ADMIN is GOD of the platform. Every admin feature, every dataset,
and every search must be visible / readable / searchable by an active SA,
scoped to the society they are currently "Viewing as" via the dashboard
impersonation flow. Exceptions require an explicit spec carve-out.

**Why:** The product owner stated this explicitly — Super Admin is the platform
root and should never be locked out of a society's data when using the "View
Dashboard As RWA Admin" feature. Before this rule landed, many admin GET
endpoints called `getCurrentUser("RWA_ADMIN")` / `getFullAccessAdmin()` and
returned 401/403 for SA because SA has no row in the `users` table (only in
`super_admins`). That broke residents, support tickets, resident-support
tickets, and settings pages for SA. Petitions/events/expenses GETs had no
auth check at all (also wrong — they should use the same helper for
consistent society scoping).

**How to apply:**

- **Server**: for any admin GET route reachable via `/admin/*`, call
  `getAdminContext(targetSocietyId)` (from `src/lib/get-current-user.ts`).
  `targetSocietyId` comes from path params (`:id`) or a query param
  (`?societyId=…`). The helper returns:
  - RWA admin's own context if the caller is an RWA_ADMIN whose societyId matches
  - A synthetic `FULL_ACCESS` context with `isSuperAdmin: true` if the caller
    is an active SuperAdmin AND `targetSocietyId` is supplied
  - `null` otherwise.
    In the route, treat `ctx.isSuperAdmin || ctx.adminPermission === "FULL_ACCESS"`
    as "allowed to view".
- **Writes**: keep POST/PATCH/DELETE on `getCurrentUser("RWA_ADMIN")` /
  `getFullAccessAdmin()` so `userId` stays a real `User.id` for audit logs.
  If SA must mutate, add a mirror endpoint under `/api/v1/super-admin/…`
  gated by `requireSuperAdmin()`.
- **Client**: admin pages resolve society via
  [useSocietyId()](src/hooks/useSocietyId.ts) — this returns the SA's URL
  `?sid=…` param when impersonating, or the admin's own societyId otherwise.
  Thread `societyId` into any service call whose backing route has no
  society in the URL path (support, resident-support, admin-settings). Pass
  `isSuperAdminViewing ? societyId : undefined` to avoid polluting regular
  admin requests.
- **Search**: SA must appear in result sets. If you write a search query,
  include a branch that works when the caller is SA.
- **Audit**: when adding a new admin page, the 3 must-checks are (a)
  `useSocietyId()` for scoping, (b) societyId threaded into the service call,
  (c) server GET uses `getAdminContext`.

**Key files:**

- [src/lib/get-current-user.ts](src/lib/get-current-user.ts) — `getAdminContext` helper.
- [src/hooks/useSocietyId.ts](src/hooks/useSocietyId.ts) — client hook; returns
  `societyId`, `isSuperAdminViewing`, `saQueryString` (preserves SA context
  across navigation).
- [src/app/admin/layout.tsx](src/app/admin/layout.tsx) — renders the blue
  "Viewing as …" banner when `isSuperAdminViewing`.
