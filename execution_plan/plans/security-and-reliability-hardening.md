# Plan: Security & Reliability Hardening

## Context

Following the residents page improvements (bulk upload, filters, send-verification email), a gap analysis identified five categories of issues that need to be addressed before this system can be considered production-grade. These are not MVP blockers but are critical for a real multi-tenant deployment.

---

## Issues to Fix

### 1. Missing Auth/Authorization on API Routes (CRITICAL)

**Problem:**
All new API routes have zero authentication. Anyone who knows the URL can call them:

- `GET /api/v1/residents` — returns all residents for any society
- `POST /api/v1/residents/bulk-upload` — creates residents in any society
- `POST /api/v1/residents/[id]/send-verification` — sends emails for any resident

**Risk:** Data breach, unauthorized writes, spam abuse.

**Fix:**

- Add a shared `requireRWAAdmin(request)` guard helper in `src/lib/api-helpers.ts`
- It reads the session from Supabase (`createClient().auth.getUser()`), looks up the user in DB, verifies `role === "RWA_ADMIN"` and `societyId` matches the requested society
- Return `401` if no session, `403` if role mismatch
- Apply to all three routes

**Files to change:**
| File | Change |
|---|---|
| `src/lib/api-helpers.ts` | Add `requireRWAAdmin(request, societyId)` helper |
| `src/app/api/v1/residents/route.ts` | Call guard at top, pass `societyId` from query |
| `src/app/api/v1/residents/bulk-upload/route.ts` | Call guard at top, resolve societyId from societyCode |
| `src/app/api/v1/residents/[id]/send-verification/route.ts` | Call guard at top |

---

### 2. RWAID Race Condition on Concurrent Bulk Uploads (HIGH)

**Problem:**
The bulk-upload route counts existing RWAIDs for a year to determine the next sequence number:

```typescript
const existingYearCount = await prisma.user.count({ where: { rwaid: { contains: `-${year}-` } } });
const rwaid = generateRWAID(society.societyId, year, existingYearCount + 1);
```

If two admins upload simultaneously, both reads return the same count, and both assign the same RWAID — violating uniqueness.

**Fix:**

- Add `@@unique([societyId, rwaid])` constraint on the `User` model in Prisma schema (or confirm it already exists)
- Wrap the count + create in a DB-level serializable transaction or use a `SELECT FOR UPDATE` advisory lock
- Alternatively, make `rwaid` a unique column and catch `P2002` (unique constraint) errors — retry with incremented sequence on collision (simpler and works for low-concurrency admin uploads)

**Files to change:**
| File | Change |
|---|---|
| `prisma/dbinuse.prisma` | Verify/add `@@unique` on `rwaid` field |
| `src/app/api/v1/residents/bulk-upload/route.ts` | Catch Prisma `P2002` unique violation, retry with +1 sequence (max 3 retries) |

---

### 3. Supabase Auth Orphan on DB Failure (HIGH)

**Problem:**
In bulk upload, the flow is:

1. Create Supabase auth user → `authUserId` obtained
2. Start Prisma transaction → create `user` row + optionally `unit` + `userUnit`

If step 2 fails (e.g., DB connection drop, constraint violation), the Prisma transaction rolls back cleanly — but the Supabase auth user created in step 1 is **not rolled back**. This leaves an orphaned auth account with no matching DB record. The user can never log in (no DB record) but the email is permanently "taken" in Supabase Auth.

**Fix:**

- After any `prisma.$transaction` failure when a new Supabase auth user was just created, call `supabaseAdmin.auth.admin.deleteUser(authUserId)` to clean up
- Only delete if `authUserId` was freshly created in this request (not reused from an existing account)
- Log both the original error and any cleanup failure

**Files to change:**
| File | Change |
|---|---|
| `src/app/api/v1/residents/bulk-upload/route.ts` | Add cleanup block after transaction catch: delete Supabase user if newly created |

---

### 4. URL State Persistence for Residents Page Filters (MEDIUM)

**Problem:**
All filter state (search, status, emailVerified, ownershipType, year, page, limit) lives in React `useState`. Refreshing the page or sharing a URL loses the filter context.

**Fix:**

- Replace `useState` for all filters with `useSearchParams` / `useRouter` from Next.js
- Read initial values from URL on mount, write back on every filter change
- URL format: `/admin/residents?search=john&status=ACTIVE&year=2026&page=2`
- Use `router.replace` (not `router.push`) so filter changes don't pollute browser history

**Files to change:**
| File | Change |
|---|---|
| `src/app/admin/residents/page.tsx` | Replace filter `useState` with URL search params; use `useSearchParams` + `useRouter` |

---

### 5. Supabase Auth Reuse Scope Too Broad (MEDIUM)

**Problem:**
When checking for an existing Supabase auth account to reuse, the query is:

```typescript
prisma.user.findFirst({ where: { email: record.email, authUserId: { not: null } } });
```

This searches **across all societies**. A resident of Society A could have their `authUserId` reused when being added to Society B — which may be intentional (one login for multiple societies) but is not explicitly designed for and could cause confusion.

**Fix:**

- Document the intended behavior explicitly in the code with a comment
- If multi-society login is NOT intended, scope the lookup to `{ email: record.email, authUserId: { not: null }, societyId: society.id }` — but this means a new Supabase account is created if the person is in another society
- If multi-society login IS intended, no code change needed, just add a comment

**Files to change:**
| File | Change |
|---|---|
| `src/app/api/v1/residents/bulk-upload/route.ts` | Add clarifying comment or tighten scope |

---

## Priority Order

| #   | Issue                              | Priority     | Effort     |
| --- | ---------------------------------- | ------------ | ---------- |
| 1   | Missing auth on API routes         | **CRITICAL** | Medium     |
| 2   | RWAID race condition               | **HIGH**     | Low–Medium |
| 3   | Supabase auth orphan on DB failure | **HIGH**     | Low        |
| 4   | URL state persistence for filters  | Medium       | Medium     |
| 5   | Auth reuse scope clarification     | Medium       | Low        |

---

## Files to Create

None — all changes are modifications to existing files.

## Files to Modify

| File                                                       | Issues addressed                    |
| ---------------------------------------------------------- | ----------------------------------- |
| `src/lib/api-helpers.ts`                                   | #1 — add `requireRWAAdmin` helper   |
| `src/app/api/v1/residents/route.ts`                        | #1 — auth guard                     |
| `src/app/api/v1/residents/bulk-upload/route.ts`            | #1, #2, #3, #5                      |
| `src/app/api/v1/residents/[id]/send-verification/route.ts` | #1 — auth guard                     |
| `src/app/admin/residents/page.tsx`                         | #4 — URL state                      |
| `prisma/dbinuse.prisma`                                    | #2 — unique constraint verification |

## Test Coverage Required

- Auth guard: unit tests for 401/403 scenarios
- RWAID retry on P2002: test duplicate collision → retry → success
- Supabase orphan cleanup: test that `deleteUser` is called when transaction fails after auth creation
- URL state: component test verifying URL params are read/written correctly
