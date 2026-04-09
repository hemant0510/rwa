# PWA Phase 1 — Installability + App Shell Caching

## Context

Full PWA Level 2 plan exists at `execution_plan/plans/pwa-level2.md` with 4 phases. After analysis, Phase 1 alone delivers 80% of the perceived value with 20% of the effort.

**Why Phase 1 only (for now):**

- Pages already load in 1-2s with React Query's 5-min staleTime
- Urban Indian housing societies have reliable internet — offline access is rarely needed
- Installability (add to home screen) is the biggest UX win — makes the app feel "real" to residents
- Phase 2-4 add caching/offline complexity for a use case that may not justify the maintenance overhead
- Phase 2-4 can be added later if users report slow loads or need offline access

**What this delivers:**

- App installs on phone home screen (Android + iOS) — no Play Store needed
- App icon on home screen with splash screen on launch
- Standalone mode (no browser chrome — feels like a native app)
- All JS/CSS/HTML cached for instant repeat loads
- Offline fallback page (instead of browser's "No internet" error)

**What this does NOT do:**

- No API data caching (pages need internet to show data)
- No offline reading of previously visited pages
- No offline banner or mutation guards
- No push notifications

---

## Prerequisites

None. No schema changes, no API changes.

---

## Step 0 — Read existing files before touching them

Before writing any code, read these files to understand their current state:

```bash
# Read all files you will modify
src/app/layout.tsx
next.config.ts
tsconfig.json
.gitignore
```

This is mandatory. The modification instructions below describe what to ADD or CHANGE — not what to replace wholesale.

---

## Deliverables

### 1. Install dependencies

```bash
npm i @serwist/next
npm i -D serwist
```

---

### 2. `src/app/manifest.ts` — Web App Manifest (CREATE)

Next.js App Router auto-discovers this file and links it in the HTML head.

```typescript
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RWA Connect",
    short_name: "RWA Connect",
    description: "Manage your Resident Welfare Association with RWA Connect",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: "#0d9488",
    background_color: "#fafafa",
    icons: [
      { src: "/icons/icon-72x72.png", sizes: "72x72", type: "image/png" },
      { src: "/icons/icon-96x96.png", sizes: "96x96", type: "image/png" },
      { src: "/icons/icon-128x128.png", sizes: "128x128", type: "image/png" },
      { src: "/icons/icon-144x144.png", sizes: "144x144", type: "image/png" },
      { src: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-384x384.png", sizes: "384x384", type: "image/png" },
      { src: "/icons/icon-512x512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-512x512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
```

**No test needed** — `src/app/manifest.ts` is not in vitest coverage scope.

---

### 3. `public/icons/` — App Icon Set (MANUAL STEP — USER MUST DO THIS)

| File                        | Size    | Purpose                   |
| --------------------------- | ------- | ------------------------- |
| `icon-72x72.png`            | 72x72   | Android legacy            |
| `icon-96x96.png`            | 96x96   | Android legacy            |
| `icon-128x128.png`          | 128x128 | Chrome Web Store          |
| `icon-144x144.png`          | 144x144 | Android                   |
| `icon-192x192.png`          | 192x192 | Android (required)        |
| `icon-384x384.png`          | 384x384 | Android splash            |
| `icon-512x512.png`          | 512x512 | Android splash (required) |
| `icon-512x512-maskable.png` | 512x512 | Adaptive icon (safe zone) |

**Claude cannot generate real PNG files.** This is a manual step the user must perform.

To generate: provide a square PNG logo and run:

```bash
npx pwa-asset-generator <your-logo.png> public/icons/
```

Or manually resize and export 8 files to `public/icons/`.

**The build will succeed without icons** (manifest just references missing files), but the Chrome install prompt and Lighthouse PWA audit will not pass until real icons exist.

---

### 4. `src/app/sw.ts` — Service Worker (CREATE)

```typescript
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
```

**No test needed** — `src/app/sw.ts` is a service worker compiled by serwist's webpack plugin, not in vitest coverage scope.

---

### 5. `src/app/offline/page.tsx` — Offline Fallback Page (CREATE)

```typescript
import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="bg-muted mb-4 rounded-full p-4">
        <WifiOff className="text-muted-foreground h-8 w-8" />
      </div>
      <h1 className="mb-2 text-xl font-bold">You&apos;re Offline</h1>
      <p className="text-muted-foreground text-sm">
        Check your internet connection and try again.
      </p>
    </div>
  );
}
```

**No test needed** — `src/app/offline/page.tsx` is not in vitest coverage scope (pure presentational, no logic).

---

### 6. Modify `next.config.ts` (MODIFY — read the file first)

Three changes. Apply each as a targeted edit, do not rewrite the file.

**Change A — Add import and withSerwist config** at the top of the file, after the existing `withSentryConfig` import:

```typescript
import withSerwistInit from "@serwist/next";

const revision = crypto.randomUUID();

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  additionalPrecacheEntries: [{ url: "/offline", revision }],
  disable: process.env.NODE_ENV === "development",
});
```

**Change B — Add `worker-src 'self'`** to the existing CSP value array (the array inside the `Content-Security-Policy` object in `securityHeaders`). Add it after `"font-src 'self'"`:

```typescript
// existing line:
"font-src 'self'",
// add after it:
"worker-src 'self'",
```

**Change C — Wrap `nextConfig` with `withSerwist`** in the final export. The existing export is:

```typescript
export default withSentryConfig(nextConfig, { ... });
```

Change it to:

```typescript
export default withSentryConfig(withSerwist(nextConfig), { ... });
```

Do not change anything else in the Sentry config object.

---

### 7. Modify `src/app/layout.tsx` (MODIFY — read the file first)

Two changes. Do not overwrite the existing title or description — they are correct.

**Change A — Update the import line** to add `Viewport`:

```typescript
// Before:
import type { Metadata } from "next";

// After:
import type { Metadata, Viewport } from "next";
```

**Change B — Add `viewport` export** (new export, does not exist yet) and expand the existing `metadata` export by adding new fields only:

```typescript
// Add this new export (before or after the existing metadata export):
export const viewport: Viewport = {
  themeColor: "#0d9488",
};

// Expand the existing metadata export — ADD these fields, keep title and description as-is:
export const metadata: Metadata = {
  title: "RWA Connect — Society Management", // keep existing
  description: "Manage your Resident Welfare Association with RWA Connect", // keep existing
  applicationName: "RWA Connect", // add
  appleWebApp: {
    // add
    capable: true,
    statusBarStyle: "default",
    title: "RWA Connect",
  },
  formatDetection: {
    // add
    telephone: false,
  },
};
```

---

### 8. Modify `tsconfig.json` (MODIFY — read the file first)

Three targeted additions. Do NOT replace any existing array values.

**Change A — Add `"webworker"` to the existing `lib` array:**

```json
"lib": ["dom", "dom.iterable", "esnext", "webworker"]
```

(existing array is `["dom", "dom.iterable", "esnext"]` — just append `"webworker"`)

**Change B — Add new `types` field** (this field does not exist yet — add it):

```json
"types": ["@serwist/next/typings"]
```

**Change C — Add `"public/sw.js"` to the EXISTING `exclude` array.** The current array has 5 entries — append to it, do not replace it:

```json
"exclude": [
  "node_modules",
  "supabase/seed.ts",
  "supabase/seed-master.ts",
  "prisma.config.ts",
  "vitest.config.ts",
  "public/sw.js"
]
```

---

### 9. Modify `.gitignore` (MODIFY)

Append at the end of the file:

```
# PWA generated service worker
public/sw*
public/swe-worker*
```

---

## Files Summary

| File                           | Action                  | Test needed? | Notes                                        |
| ------------------------------ | ----------------------- | ------------ | -------------------------------------------- |
| `src/app/manifest.ts`          | Create                  | No           | Not in coverage scope                        |
| `src/app/sw.ts`                | Create                  | No           | Compiled by serwist, not vitest              |
| `src/app/offline/page.tsx`     | Create                  | No           | Not in coverage scope, zero logic            |
| `public/icons/*.png` (8 files) | Manual (user)           | No           | Requires source logo — Claude cannot do this |
| `next.config.ts`               | Modify (3 edits)        | No           | Not in coverage scope                        |
| `src/app/layout.tsx`           | Modify (2 edits)        | No           | Not in coverage scope                        |
| `tsconfig.json`                | Modify (3 edits)        | No           | Config file                                  |
| `.gitignore`                   | Modify (append)         | No           | Config file                                  |
| `package.json`                 | Modified by npm install | No           | Auto-updated by `npm i`                      |

**Total test files to write: 0** — all deliverables in this phase are config, service worker, or pure presentational. Phase 3 is where new hooks/components with tests are added.

---

## Quality Gate

### Automated (Claude runs these)

```bash
npm run lint          # zero errors
npx tsc --noEmit      # zero errors
npm run build         # succeeds — public/sw.js generated
```

Verify after build:

```bash
ls public/sw.js       # must exist
```

### Manual (User verifies in browser — requires real icons)

1. `npm run start` — open in Chrome
2. **DevTools > Application > Manifest** — name, icons, theme color show correctly
3. **DevTools > Application > Service Workers** — status: "activated and is running"
4. **Chrome address bar** — install icon (⊕) appears; click to install
5. **Android Chrome** — "Add to Home Screen" prompt appears
6. **iOS Safari** — Share > "Add to Home Screen" works
7. **Installed app** — opens in standalone mode (no browser URL bar)
8. **Go offline** (DevTools > Network > Offline) — navigate to any page → offline fallback page appears (not browser error)
9. **Lighthouse** — PWA audit → "Installable" passes

---

## When to Add Phase 2-4

Add `pwa-level2.md` phases when any of these happen:

- Users complain about slow page loads on repeat visits
- Users request offline access
- Analytics show high bounce rate on slow connections

Until then, Phase 1 alone provides the install-on-home-screen experience that makes the app feel professional and native.
