# PWA Level 2 — Progressive Web App with Offline Read Cache

## Context

Eden Estate RWA app (Next.js 16, React 19, App Router) currently has no PWA capabilities — no manifest, no service worker, no offline support. Users must be online for every interaction.

This plan implements **Level 2 PWA**: installability + app shell caching + API read cache (stale-while-revalidate) + offline UX indicators. Write operations remain online-only.

**What this delivers:**

- App installs on phone home screen (no Play Store needed)
- Repeat visits load instantly from cache
- Previously visited pages work offline with cached data
- Clear "You're offline" banner when disconnected
- Mutation buttons disabled offline with clear messaging
- Cache scoped per society automatically (APIs return society-specific data)

**What this does NOT do (Level 3, future scope):**

- No offline writes (create ticket, submit payment, etc.)
- No background sync queue
- No push notifications (separate feature)

---

## Technical Decisions

### Library: `@serwist/next` + `serwist`

Modern successor to `next-pwa`, built on Workbox primitives, designed for Next.js App Router. Actively maintained.

### Cache Strategies

| Content Type                         | Strategy             | TTL      | Rationale                             |
| ------------------------------------ | -------------------- | -------- | ------------------------------------- |
| App shell (JS/CSS)                   | CacheFirst           | 30 days  | Content-hashed, safe to cache forever |
| Next.js pages                        | NetworkFirst         | 24h      | Show fresh HTML, fall back to cached  |
| API GETs (tickets, events)           | StaleWhileRevalidate | 15 min   | Volatile data, show cached → refresh  |
| API GETs (fees, expenses)            | StaleWhileRevalidate | 4 hours  | Financial data, moderate freshness    |
| API GETs (directory, governing body) | StaleWhileRevalidate | 24 hours | Stable data, rarely changes           |
| API GETs (profile, settings)         | StaleWhileRevalidate | 1 hour   | Personal data, occasional changes     |
| API mutations (POST/PATCH/DELETE)    | NetworkOnly          | —        | Must reach server                     |
| Auth endpoints                       | NetworkOnly          | —        | Never cache auth state                |
| Supabase storage images              | CacheFirst           | 7 days   | Photos, documents                     |
| Fonts                                | CacheFirst           | 1 year   | Static assets                         |

### Cache Scoping

No special logic needed — APIs already return society-specific data via auth + active-society cookie. A resident of "SEC 15" caches only SEC 15 data.

### React Query Coexistence

React Query (5-min staleTime, in-memory) handles within-session freshness. Service worker cache (persistent, on-disk) handles cross-session and offline access. They complement each other — no config changes needed.

---

## Reference Files

| Pattern                 | Reference File                     |
| ----------------------- | ---------------------------------- |
| Root layout (metadata)  | `src/app/layout.tsx`               |
| Next.js config          | `next.config.ts`                   |
| React Query config      | `src/providers/QueryProvider.tsx`  |
| Auth provider           | `src/providers/AuthProvider.tsx`   |
| Existing hook pattern   | `src/hooks/useAuth.ts`             |
| Existing banner pattern | `src/components/ui/EmptyState.tsx` |
| CSP headers             | `next.config.ts` (securityHeaders) |

---

## Phase 1 — Foundation (Installability + App Shell Caching)

### Goal

App becomes installable, static assets cached for instant repeat loads, offline fallback page exists.

### Files to Create

1. **`src/app/manifest.ts`** — Next.js dynamic manifest (auto-linked by App Router)
   - `MetadataRoute.Manifest` return type
   - name: "RWA Connect", short_name: "RWA Connect"
   - display: "standalone", orientation: "portrait"
   - theme_color and background_color from app's design tokens
   - start_url: "/", scope: "/"
   - Icons array: 72, 96, 128, 144, 192, 384, 512px + one maskable 512px

2. **`public/icons/`** — Full icon set (8 PNG files)
   - Sizes: 72x72, 96x96, 128x128, 144x144, 192x192, 384x384, 512x512
   - One `icon-512x512-maskable.png` with `purpose: "maskable"`
   - Generate from app logo using `pwa-asset-generator` or manual resize

3. **`src/app/sw.ts`** — Service worker source file
   - Import `defaultCache` from `@serwist/next/worker`
   - Import `Serwist` from `serwist`
   - Declare `self.__SW_MANIFEST` for precache injection
   - Configure: `skipWaiting: true`, `clientsClaim: true`, `navigationPreload: true`
   - Use `defaultCache` for `runtimeCaching` (Phase 2 replaces with custom rules)
   - Fallback: `/offline` for `request.destination === "document"`

4. **`src/app/offline/page.tsx`** — Offline fallback page
   - Server component, centered layout
   - Icon: `WifiOff` from lucide-react
   - Title: "You're Offline"
   - Description: "Check your internet connection and try again."

### Files to Modify

5. **`next.config.ts`**
   - Import and wrap with `withSerwistInit` from `@serwist/next`
   - Config: `swSrc: "src/app/sw.ts"`, `swDest: "public/sw.js"`
   - Add `worker-src 'self'` to CSP header
   - Disable in dev: `disable: process.env.NODE_ENV === "development"`
   - Compose with existing `withSentryConfig`

6. **`src/app/layout.tsx`**
   - Add `viewport` export with `themeColor`
   - Expand `metadata`: `applicationName`, `appleWebApp` (capable, statusBarStyle, title), `formatDetection`
   - Manifest auto-linked by Next.js from `src/app/manifest.ts`

7. **`tsconfig.json`**
   - Add `"@serwist/next/typings"` to `compilerOptions.types`
   - Add `"webworker"` to `compilerOptions.lib`
   - Add `"public/sw.js"` to `exclude`

8. **`.gitignore`**
   - Add `public/sw*` and `public/swe-worker*`

### Dependencies

```bash
npm i @serwist/next
npm i -D serwist
```

### Quality Gate

- `npm run build` succeeds, `public/sw.js` generated
- Service worker registers in browser (DevTools > Application)
- Manifest loads (DevTools > Application > Manifest)
- Chrome install prompt appears
- `npm run lint` + `npx tsc --noEmit` pass

---

## Phase 2 — Runtime Caching (API Read Cache)

### Goal

GET API responses cached with stale-while-revalidate per data type. Images cached with CacheFirst. Auth and mutations never cached.

### Files to Modify

1. **`src/app/sw.ts`** — Replace `defaultCache` with custom runtime caching rules

   13 rules in priority order (first match wins):

   | #   | Matcher                                            | Strategy             | Cache Name           | TTL      | Max Entries |
   | --- | -------------------------------------------------- | -------------------- | -------------------- | -------- | ----------- |
   | 1   | `/api/v1/auth/*`                                   | NetworkOnly          | —                    | —        | —           |
   | 2   | `/api/cron/*`                                      | NetworkOnly          | —                    | —        | —           |
   | 3   | Non-GET `/api/*`                                   | NetworkOnly          | —                    | —        | —           |
   | 4   | Support, events, announcements, unread-count       | StaleWhileRevalidate | `api-volatile`       | 15 min   | 64          |
   | 5   | Fees, expenses, payment-claims, billing            | StaleWhileRevalidate | `api-financial`      | 4 hours  | 128         |
   | 6   | `/residents/me`, settings                          | StaleWhileRevalidate | `api-profile`        | 1 hour   | 16          |
   | 7   | Directory, governing-body, designations, societies | StaleWhileRevalidate | `api-stable`         | 24 hours | 64          |
   | 8   | All other API GETs (catch-all)                     | StaleWhileRevalidate | `api-default`        | 1 hour   | 128         |
   | 9   | `*.supabase.co/storage/*`                          | CacheFirst           | `supabase-images`    | 7 days   | 200         |
   | 10  | `fonts.googleapis.com`                             | StaleWhileRevalidate | `google-fonts-css`   | 30 days  | 10          |
   | 11  | `fonts.gstatic.com`                                | CacheFirst           | `google-fonts-files` | 1 year   | 20          |
   | 12  | `/_next/static/`                                   | CacheFirst           | `next-static`        | 30 days  | 256         |
   | 13  | `request.destination === "document"`               | NetworkFirst         | `pages`              | 24 hours | 50          |

   Imports: `CacheFirst`, `CacheableResponsePlugin`, `ExpirationPlugin`, `NetworkFirst`, `NetworkOnly`, `StaleWhileRevalidate` from `serwist`

2. **`next.config.ts`** — Add font domains to CSP if needed (verify during testing)

### Quality Gate

- `npm run build` succeeds
- Cache buckets populate in DevTools > Application > Cache Storage
- GET responses cached (verify: load fee dashboard, check `api-financial`)
- POST/PATCH/DELETE NOT in any cache
- Auth calls NOT cached
- Go offline → previously visited pages load with data
- Navigate to un-visited page offline → offline fallback page shown

---

## Phase 3 — Offline UX (Banner, Status Hook, Mutation Guards)

### Goal

Clear user feedback when offline. Mutation buttons disabled. Toast notifications on connectivity changes.

### Files to Create

1. **`src/hooks/useOnlineStatus.ts`** — Network status hook
   - Uses `useSyncExternalStore` (React 19 recommended pattern)
   - Subscribes to `window.addEventListener("online"/"offline")`
   - Returns `{ isOnline: boolean }`
   - SSR-safe: `getServerSnapshot` returns `true`

2. **`src/components/ui/OfflineBanner.tsx`** — Sticky offline banner
   - Uses `useOnlineStatus` hook
   - Amber/yellow warning style (not destructive — data is still visible)
   - Icon: `WifiOff`, Title: "You're offline"
   - Description: "Showing cached data. Some actions are unavailable until you reconnect."
   - Animate in/out with Tailwind transitions
   - Returns `null` when online

3. **`src/hooks/useOnlineToast.ts`** — Toast on connectivity transitions
   - Fires only on state transitions, NOT on initial mount
   - offline→online: `toast.success("You're back online!")`
   - online→offline: `toast.warning("You're offline")`

4. **`src/components/ui/OnlineOnly.tsx`** — Wrapper for mutation buttons
   - Wraps children and disables interaction when offline
   - Shows tooltip: "Connect to internet to perform this action"
   - Reduces per-file changes — wrap submit buttons with `<OnlineOnly>` instead of modifying each

### Files to Modify

5. **`src/app/layout.tsx`** — Add OfflineBanner + OnlineToast provider
   - Render `<OfflineBanner />` inside `<body>` before page content
   - Add `OnlineStatusProvider` (calls `useOnlineToast`) wrapping `{children}`

6. **Key mutation pages** — Wrap submit buttons with `<OnlineOnly>`:
   - `src/app/r/profile/page.tsx` — photo upload
   - `src/app/r/support/page.tsx` — create ticket (when implemented)
   - `src/app/admin/residents/[id]/page.tsx` — approve/reject/edit
   - `src/app/admin/resident-support/[ticketId]/page.tsx` — reply/status (when implemented)
   - Other high-impact mutation pages as needed

### Tests

- `tests/hooks/useOnlineStatus.test.ts`
- `tests/hooks/useOnlineToast.test.ts`
- `tests/components/ui/OfflineBanner.test.tsx`
- `tests/components/ui/OnlineOnly.test.tsx`

### Quality Gate

- Banner appears when offline, disappears when online
- Toast fires only on transitions
- Mutation buttons disabled offline
- Per-file 95% coverage on new hooks/components
- `npm run lint` + `npx tsc --noEmit` pass

---

## Phase 4 — Polish, SA Optimization, and Verification

### Goal

Optimize Super Admin caching, comprehensive cross-role testing, Lighthouse PWA score 100.

### Tasks

1. **Cache versioning** — Serwist handles this automatically:
   - `skipWaiting: true` + `clientsClaim: true` activates new SW on deploy
   - Precache manifest uses content hashes, stale entries auto-cleaned
   - No additional versioning logic needed

2. **SA dashboard optimization**
   - React Query staleTime (5min) + SW StaleWhileRevalidate = instant loads after first visit
   - 1000+ resident table loads from cache in <100ms vs 2-3s from network
   - Background refresh keeps data current within TTL
   - No additional code changes needed — the caching strategies from Phase 2 already cover SA routes

3. **Cache debug utility** (dev-only)
   - `src/lib/utils/cache-debug.ts` — logs all cache names and entry counts
   - Only callable in development, stripped in production

4. **Cross-role testing matrix**

   | Test                        | Resident | Admin | Super Admin |
   | --------------------------- | -------- | ----- | ----------- |
   | Install PWA from browser    | Test     | Test  | Test        |
   | Navigate all main pages     | Test     | Test  | Test        |
   | Go offline                  | Test     | Test  | Test        |
   | Verify cached pages load    | Test     | Test  | Test        |
   | Verify offline banner       | Test     | Test  | Test        |
   | Verify mutations disabled   | Test     | Test  | Test        |
   | Come back online            | Test     | Test  | Test        |
   | Verify toast notification   | Test     | Test  | Test        |
   | Verify mutations work again | Test     | Test  | Test        |

5. **Lighthouse PWA audit**
   - Target: 100 score on PWA category
   - Checklist: installability, splash screen, themed address bar, offline support, HTTPS, valid manifest, SW with fetch handler

6. **Cross-browser testing**
   - Chrome/Edge: Full PWA (install + SW + cache)
   - Firefox: SW + cache (no native install prompt)
   - Safari/iOS: SW caching + Add to Home Screen (limited but functional)

### Quality Gate

- All existing tests pass (`npm run test`)
- New tests pass at 95% coverage
- `npm run build` succeeds
- Lighthouse PWA score >= 90
- Manual testing across 3 roles completes

---

## File Summary

### New Files (18)

| File                                         | Phase | Purpose                           |
| -------------------------------------------- | ----- | --------------------------------- |
| `src/app/manifest.ts`                        | 1     | Web app manifest                  |
| `src/app/sw.ts`                              | 1-2   | Service worker with caching rules |
| `src/app/offline/page.tsx`                   | 1     | Offline fallback page             |
| `public/icons/icon-72x72.png`                | 1     | PWA icon                          |
| `public/icons/icon-96x96.png`                | 1     | PWA icon                          |
| `public/icons/icon-128x128.png`              | 1     | PWA icon                          |
| `public/icons/icon-144x144.png`              | 1     | PWA icon                          |
| `public/icons/icon-192x192.png`              | 1     | PWA icon                          |
| `public/icons/icon-384x384.png`              | 1     | PWA icon                          |
| `public/icons/icon-512x512.png`              | 1     | PWA icon                          |
| `public/icons/icon-512x512-maskable.png`     | 1     | Maskable PWA icon                 |
| `src/hooks/useOnlineStatus.ts`               | 3     | Network status hook               |
| `src/hooks/useOnlineToast.ts`                | 3     | Connectivity toast                |
| `src/components/ui/OfflineBanner.tsx`        | 3     | Offline indicator banner          |
| `src/components/ui/OnlineOnly.tsx`           | 3     | Mutation guard wrapper            |
| `tests/hooks/useOnlineStatus.test.ts`        | 3     | Hook test                         |
| `tests/hooks/useOnlineToast.test.ts`         | 3     | Hook test                         |
| `tests/components/ui/OfflineBanner.test.tsx` | 3     | Component test                    |

### Modified Files (4)

| File                 | Phase | Change                                      |
| -------------------- | ----- | ------------------------------------------- |
| `next.config.ts`     | 1     | Serwist plugin + CSP `worker-src`           |
| `src/app/layout.tsx` | 1, 3  | PWA metadata + OfflineBanner + online toast |
| `tsconfig.json`      | 1     | SW types + webworker lib                    |
| `.gitignore`         | 1     | Exclude `public/sw*`                        |

---

## Edge Cases

| Scenario                                      | Handling                                                                              |
| --------------------------------------------- | ------------------------------------------------------------------------------------- |
| User visits page for first time while offline | Offline fallback page shown (page not in cache yet)                                   |
| Signed URL expires in cache                   | CacheFirst serves stale image; next online visit refreshes it. Acceptable for photos. |
| User clears browser data                      | Cache cleared, next visit re-populates from network (graceful degradation)            |
| Multiple tabs open when SW updates            | `skipWaiting` + `clientsClaim` activates new SW across all tabs immediately           |
| Cache storage full (device low on space)      | Browser evicts least-recently-used caches automatically; app continues working online |
| Auth token expires while offline              | User sees cached data but auth-dependent actions fail; re-authenticates when online   |
| Multi-society user switches society           | New API calls have different URLs/cookies, cached separately per society context      |

---

## NOT in This Plan (Future Scope)

- Push notifications (Web Push API — separate feature)
- Offline write queue with background sync
- Periodic background sync for fresh data
- App shortcuts in manifest
- Share target API
- Badging API for unread counts on app icon
