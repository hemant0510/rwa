---
name: write-tests
description: Write or complete tests for any source file with correct patterns. Determines file type (API route, service, component, page, hook), applies verbatim project patterns, and verifies per-file coverage meets 95% threshold.
argument-hint: <source-file-path>
---

# Write Tests

**Invocation**: `/write-tests <source-file-path>`

Choose the template below based on file type. Use it verbatim — do not re-derive patterns.

---

## Step 0 — Confirm the file needs tests (always yes, unless excluded)

The pre-commit hook enforces 95% coverage on **every staged `.ts`/`.tsx` file**. If you are writing tests for a file, it is because that file will be staged and the hook will check it. There is no category of source file that is exempt from this — not config files, not service workers, not manifest files, not offline pages.

If someone (a plan, a comment, a previous session) claimed the file "doesn't need tests", verify by checking:

1. Is the file path in the `exclude` array in `vitest.config.ts`? If yes → truly exempt, stop.
2. If not excluded → it WILL be covered by the hook → write tests.

---

## Step 1 — Identify file type

From the file path:

- `src/app/api/**/route.ts` → **API route handler**
- `src/services/**` → **Service / fetch wrapper**
- `src/components/**` → **React component**
- `src/app/**/page.tsx` → **Next.js page**
- `src/app/**/manifest.ts` → **Next.js metadata export** (treat like a utility function — test the return value)
- `src/app/**/sw.ts` → **Service worker** — compiled by bundler, add to `vitest.config.ts` exclude instead of writing tests
- `src/hooks/**` → **Custom hook**
- `src/lib/**` → **Utility / library function**

---

## Step 2 — Read the source file

Read the complete source file. List every:

- Branch (`if/else`, ternary, `?.`, `??`, `||`, `&&`)
- Error path (throw, error response, null return)
- Async operation (DB call, fetch, Supabase call)
- Auth/permission check
- Edge case mentioned in comments

---

## Step 3 — Apply the template for the file type

### API route handlers (`src/app/api/**`)

`vi.hoisted()` is **mandatory** — mocks must be declared before any module import.

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks (MUST come first) ──
const { mockGetCurrentUser } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
}));
vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));

// If the route uses Supabase auth directly instead of getCurrentUser:
// const { mockGetActiveSocietyId } = vi.hoisted(() => ({ mockGetActiveSocietyId: vi.fn() }));
// vi.mock("@/lib/active-society-server", () => ({ getActiveSocietyId: mockGetActiveSocietyId }));

// Additional hoisted mocks for other dependencies:
// const { mockSomeDep } = vi.hoisted(() => ({ mockSomeDep: vi.fn() }));
// vi.mock("@/lib/some-dep", () => ({ someDep: mockSomeDep }));

// ── Shared mocks (import AFTER all vi.mock declarations) ──
import { mockPrisma } from "../../__mocks__/prisma";
// import { mockSupabaseClient, mockStorageBucket } from "../../__mocks__/supabase"; // if Supabase storage used

// eslint-disable-next-line import/order
import { GET, POST } from "@/app/api/v1/.../route";

// ── Test fixtures ──
const mockUser = { id: "u1", societyId: "s1", role: "ADMIN" as const };

describe("GET /api/v1/...", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockUser);
    mockPrisma.someModel.findMany.mockResolvedValue([]);
  });

  it("401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("403 when wrong role", async () => {
    mockGetCurrentUser.mockResolvedValue({ ...mockUser, role: "RESIDENT" });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("422 when required field missing", async () => {
    const req = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({
        /* missing required field */
      }),
    });
    const res = await POST(req as import("next/server").NextRequest);
    expect(res.status).toBe(422);
  });

  it("404 when resource not found", async () => {
    mockPrisma.someModel.findUnique.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("500 when DB throws", async () => {
    mockPrisma.someModel.findMany.mockRejectedValue(new Error("DB error"));
    const res = await GET();
    expect(res.status).toBe(500);
  });

  it("200 with data on success", async () => {
    const item = { id: "i1", name: "Test" };
    mockPrisma.someModel.findMany.mockResolvedValue([item]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([item]);
  });
});
```

**Key rules:**

- `$transaction` is already in the shared mock — never add it again
- Import route handler LAST (after all `vi.mock` declarations), with `// eslint-disable-next-line import/order` if ESLint complains
- For Supabase-auth routes (no `getCurrentUser`): use `mockSupabaseClient.auth.getUser` from `__mocks__/supabase`

---

### Service files (`src/services/**`)

Module-level `global.fetch` mock. No `vi.hoisted` needed.

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { someServiceFn } from "@/services/foo";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("foo service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POSTs and returns data", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: { id: "1" } }),
    });
    const result = await someServiceFn({ field: "value" });
    expect(result.data).toBeDefined();
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/...",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("throws on non-ok response", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      text: () => Promise.resolve("VALIDATION_ERROR"),
    });
    await expect(someServiceFn({ field: "value" })).rejects.toThrow("VALIDATION_ERROR");
  });

  it("throws on network error", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));
    await expect(someServiceFn({ field: "value" })).rejects.toThrow();
  });
});
```

---

### React components (`src/components/**`)

`vi.mock()` at module level for dependencies. Use `QueryClientProvider` wrapper if the component uses TanStack Query hooks.

```typescript
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ComponentName } from "@/components/features/.../ComponentName";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({ user: { id: "u1", societyId: "s1", role: "ADMIN" } })),
}));
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  usePathname: vi.fn(() => "/"),
  useSearchParams: vi.fn(() => ({ get: vi.fn(() => null) })),
}));

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("ComponentName", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("renders correctly", () => {
    wrap(<ComponentName prop="value" />);
    expect(screen.getByText("Expected Text")).toBeInTheDocument();
  });

  it("handles user interaction", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    wrap(<ComponentName onAction={onAction} />);
    await user.click(screen.getByRole("button", { name: /submit/i }));
    await waitFor(() => expect(onAction).toHaveBeenCalled());
  });

  it("shows error state", () => {
    wrap(<ComponentName error="Something went wrong" />);
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });
});
```

**Note**: For clipboard tests, set up the spy AFTER `userEvent.setup()` — it installs its own clipboard stub:

```typescript
const user = userEvent.setup();
const writeText = vi.spyOn(navigator.clipboard, "writeText");
```

---

### Next.js pages (`src/app/**/page.tsx`)

Use `vi.hoisted()` for all service mocks. Use `AuthContext.Provider` directly — do **not** mock `useAuth` for pages.

```typescript
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthContext } from "@/hooks/useAuth";

// ── Hoisted mocks ──
const { mockServiceFn, mockRouterPush } = vi.hoisted(() => ({
  mockServiceFn: vi.fn(),
  mockRouterPush: vi.fn(),
}));

vi.mock("@/services/some-service", () => ({
  someServiceFn: (...args: unknown[]) => mockServiceFn(...args),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
  usePathname: () => "/r/some-page",
  useSearchParams: () => new URLSearchParams(),
}));
// Mock heavy child components to isolate the page:
vi.mock("@/components/features/SomeHeavyComponent", () => ({
  SomeHeavyComponent: () => <div data-testid="some-heavy-component" />,
}));

// eslint-disable-next-line import/order
import PageComponent from "@/app/r/.../page";

// ── Render helper ──
function renderPage(userOverrides: Record<string, unknown> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // Shape must match your project's AuthContext user type exactly.
  // Read src/hooks/useAuth.tsx to get the full required shape, then fill in test values.
  const user = {
    id: "u1",
    name: "Test User",
    role: "RESIDENT" as const,
    // ...add all required fields from your AuthContext user type...
    ...userOverrides,
  };
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider
        value={{
          user,
          isLoading: false,
          isAuthenticated: true,
          signOut: vi.fn(),
          switchSociety: vi.fn(),
        }}
      >
        <PageComponent />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe("PageComponent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockServiceFn.mockResolvedValue({ items: [], total: 0 });
  });

  it("shows loading state while fetching", () => {
    mockServiceFn.mockReturnValue(new Promise(() => {})); // never resolves
    renderPage();
    expect(screen.getByTestId("page-skeleton")).toBeInTheDocument();
  });

  it("shows empty state when no data", async () => {
    mockServiceFn.mockResolvedValue({ items: [], total: 0 });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/no .* found/i)).toBeInTheDocument(),
    );
  });

  it("shows error state on fetch failure", async () => {
    mockServiceFn.mockRejectedValue(new Error("fetch failed"));
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument(),
    );
  });

  it("renders data on success", async () => {
    mockServiceFn.mockResolvedValue({ items: [{ id: "1", name: "Item One" }], total: 1 });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText("Item One")).toBeInTheDocument(),
    );
  });
});
```

---

### Custom hooks (`src/hooks/**`)

`renderHook` from `@testing-library/react`.

```typescript
import React from "react";
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useHookName } from "@/hooks/useHookName";

// If the hook reads from a context, wrap with a provider:
function wrapper({ children }: { children: React.ReactNode }) {
  return <SomeContext.Provider value={mockContextValue}>{children}</SomeContext.Provider>;
}

describe("useHookName", () => {
  it("returns initial value", () => {
    const { result } = renderHook(() => useHookName(), { wrapper });
    expect(result.current.someField).toBe("expected");
  });

  it("updates on action", async () => {
    const { result } = renderHook(() => useHookName(), { wrapper });
    await act(async () => {
      result.current.doSomething("input");
    });
    expect(result.current.someField).toBe("updated");
  });

  it("returns defaults without provider", () => {
    const { result } = renderHook(() => useHookName());
    expect(result.current.someField).toBeNull();
  });
});
```

---

## Step 4 — Coverage checklist for 95%

Write one test per item. Check off each:

**API routes:**

- [ ] 401 — unauthenticated (no user)
- [ ] 403 — wrong role (if role check exists)
- [ ] 422 — missing/invalid request body field (one per required field)
- [ ] 400 — business rule violation (e.g. duplicate, invalid state)
- [ ] 404 — resource not found
- [ ] 500 — DB/external service throws
- [ ] 200/201 — happy path (one per HTTP method)
- [ ] Every `if/else` branch in business logic

**Components / Pages:**

- [ ] Loading state
- [ ] Error state
- [ ] Empty state (no data)
- [ ] Success / populated state
- [ ] Every interactive element (buttons, forms, tabs)
- [ ] Every conditional render (`isAdmin && <X>`, `count > 0 ? A : B`)

**Services:**

- [ ] Success response (returns correct shape)
- [ ] Non-ok response (throws with error text)
- [ ] Network error
- [ ] Every query param / body field variation

**Hooks:**

- [ ] Initial/default return value
- [ ] State change after action
- [ ] Edge cases (null input, empty array, etc.)

---

## Step 5 — Run and verify

Run tests with `vitest related <source-file>` — **not** `vitest run <test-file>`. The pre-commit hook uses `vitest related` which walks Vitest's module graph to find EVERY test that imports the source, including pre-existing tests you didn't write. `vitest run tests/foo.test.ts` only runs one file and misses those.

```bash
# Simulate the pre-commit hook exactly:
npx vitest related src/path/to/source.ts --run \
  --coverage --coverage.provider=v8 --coverage.reporter=text \
  --coverage.include=src/path/to/source.ts \
  --coverage.thresholds.perFile=true \
  --coverage.thresholds.lines=95 --coverage.thresholds.branches=95 \
  --coverage.thresholds.functions=95 --coverage.thresholds.statements=95
```

If failures appear in test files you didn't write → a signature change broke pre-existing callers. Fix them.

Fix all test failures. Fix all coverage gaps. Do **not** stage until this command passes clean.

---

## Step 6 — v8 ignore for untestable JSX branches

Use `/* v8 ignore start */` / `/* v8 ignore stop */` blocks — NOT `/* v8 ignore next */` on its own line (V8 ignores that in JSX).

**In JSX:** `{/* v8 ignore start */}{expression}{/* v8 ignore stop */}`

Only use for genuinely untestable branches:

- `mutation.isPending && <Spinner />` — requires exact async timing in JSDOM
- `STATUS_MAP[status] || fallback` — all known statuses exist in the map
- `ref.current?.click()` — ref is always attached when called
- `isLoading ? <Spinner /> : data ? <Content /> : null` — transient loading state

---

## File location convention

```
src/services/foo.ts                  → tests/services/foo.test.ts
src/components/features/X/Y.tsx     → tests/components/X/Y.test.tsx
src/app/api/v1/.../route.ts          → tests/api/<descriptive-name>.test.ts
src/app/r/payments/pay/page.tsx      → tests/app/r/payments/pay/page.test.tsx
src/app/admin/residents/page.tsx     → tests/app/admin/residents/page.test.tsx
src/lib/config/payment.ts            → tests/lib/config/payment.test.ts
src/hooks/useHookName.ts             → tests/hooks/useHookName.test.ts
```

---

## Shared mock imports

```typescript
import { mockPrisma } from "../../__mocks__/prisma";
import { mockSupabaseClient, mockStorageBucket, mockSupabaseAdmin } from "../../__mocks__/supabase";
```

- Use `mockPrisma` for all DB operations — never recreate inline
- Use `mockStorageBucket` for Supabase storage upload/download/remove
- Use `mockSupabaseClient.auth.getUser` for routes that authenticate via Supabase directly
- `$transaction` is already in `mockPrisma` — never add it again
