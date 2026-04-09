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

None. No schema changes, no API changes, no existing code modifications (except config files).

---

## Deliverables

### 1. Install dependencies

```bash
npm i @serwist/next
npm i -D serwist
```

### 2. `src/app/manifest.ts` — Web App Manifest

Next.js App Router auto-discovers this file and links it in the HTML head.

```typescript
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RWA Connect",
    short_name: "RWA Connect",
    description: "Eden Estate RWA management app",
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

### 3. `public/icons/` — App Icon Set (8 PNG files)

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

Generate from the app logo. Use `npx pwa-asset-generator <logo.png> public/icons/` or manually resize.

### 4. `src/app/sw.ts` — Service Worker

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

### 5. `src/app/offline/page.tsx` — Offline Fallback Page

```typescript
import { WifiOff } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="bg-muted mb-4 rounded-full p-4">
        <WifiOff className="text-muted-foreground h-8 w-8" />
      </div>
      <h1 className="mb-2 text-xl font-bold">You're Offline</h1>
      <p className="text-muted-foreground text-sm">
        Check your internet connection and try again.
      </p>
    </div>
  );
}
```

### 6. Modify `next.config.ts`

Changes needed:

- Import `withSerwistInit` from `@serwist/next`
- Wrap existing config with Serwist plugin
- Add `worker-src 'self'` to CSP header
- Disable in dev mode

```typescript
// Add at top:
import withSerwistInit from "@serwist/next";

const revision = crypto.randomUUID(); // unique per build

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  additionalPrecacheEntries: [{ url: "/offline", revision }],
  disable: process.env.NODE_ENV === "development",
});

// Change the export:
// Before: export default withSentryConfig(nextConfig, { ... });
// After:  export default withSentryConfig(withSerwist(nextConfig), { ... });
```

CSP update — add `worker-src 'self'` to the security headers array:

```typescript
// In the Content-Security-Policy value array, add:
"worker-src 'self'",
```

### 7. Modify `src/app/layout.tsx`

Add PWA metadata to the existing exports:

```typescript
// Add viewport export (new):
export const viewport: Viewport = {
  themeColor: "#0d9488",
};

// Expand existing metadata:
export const metadata: Metadata = {
  title: "RWA Connect",
  description: "Eden Estate RWA management",
  applicationName: "RWA Connect",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "RWA Connect",
  },
  formatDetection: {
    telephone: false,
  },
};
```

Import `Viewport` from `next`:

```typescript
import type { Metadata, Viewport } from "next";
```

### 8. Modify `tsconfig.json`

```jsonc
{
  "compilerOptions": {
    // Add to existing config:
    "types": ["@serwist/next/typings"],
    "lib": ["dom", "dom.iterable", "esnext", "webworker"],
  },
  // Add to root:
  "exclude": ["public/sw.js"],
}
```

### 9. Modify `.gitignore`

Add at the end:

```
# PWA generated service worker
public/sw*
public/swe-worker*
```

---

## Files Summary

| File                           | Action | Purpose                        |
| ------------------------------ | ------ | ------------------------------ |
| `src/app/manifest.ts`          | Create | Web app manifest               |
| `src/app/sw.ts`                | Create | Service worker                 |
| `src/app/offline/page.tsx`     | Create | Offline fallback               |
| `public/icons/*.png` (8 files) | Create | App icons                      |
| `next.config.ts`               | Modify | Serwist plugin + CSP           |
| `src/app/layout.tsx`           | Modify | PWA metadata                   |
| `tsconfig.json`                | Modify | SW types                       |
| `.gitignore`                   | Modify | Exclude generated SW           |
| `package.json`                 | Modify | Dependencies (via npm install) |

---

## Verification

1. `npm run build` — verify `public/sw.js` is generated
2. `npm run start` — open in Chrome
3. **DevTools > Application > Manifest** — verify manifest loads with correct name, icons, theme color
4. **DevTools > Application > Service Workers** — verify SW is registered and active
5. **Chrome address bar** — install icon (download arrow) should appear; click to install
6. **Android Chrome** — "Add to Home Screen" banner should appear
7. **iOS Safari** — Share > "Add to Home Screen" should work
8. **Installed app** — opens in standalone mode (no browser URL bar)
9. **Go offline** (DevTools > Network > Offline) — navigate to any uncached page, verify offline fallback page appears (not browser error)
10. **Lighthouse** — run PWA audit, verify "Installable" passes

---

## Quality Gate

- `npm run lint` — zero errors
- `npx tsc --noEmit` — zero errors
- `npm run build` — succeeds, `public/sw.js` generated
- Lighthouse PWA "Installable" = Yes
- No console errors on SW registration

---

## When to Add Phase 2-4

Add `pwa-level2.md` phases when any of these happen:

- Users complain about slow page loads on repeat visits
- Users request offline access (field staff in areas with poor connectivity)
- Analytics show high bounce rate on slow connections
- SA dashboard becomes sluggish with 50+ societies

Until then, Phase 1 alone provides the install-on-home-screen experience that makes the app feel professional and native.
