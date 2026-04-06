# /write-tests — Write tests with correct patterns for the file type

**Invocation**: `/write-tests <source-file-path>`

Choose the template below based on the file type. Use it verbatim — do not re-derive patterns.

---

## API route handlers (`src/app/api/**`)

Use `vi.hoisted()` — mocks must exist before the module import executes.

```typescript
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));

// Additional hoisted mocks if needed:
// const { mockOtherDep } = vi.hoisted(() => ({ mockOtherDep: vi.fn() }));
// vi.mock("@/lib/other", () => ({ otherDep: mockOtherDep }));

// Import shared mocks AFTER vi.mock declarations
import { mockPrisma } from "../__mocks__/prisma";
// import { mockStorageBucket, mockSupabaseAdmin } from "../__mocks__/supabase"; // if storage used

// Import route handler LAST
import { GET, POST } from "@/app/api/v1/.../route";

describe("GET /api/v1/...", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockUser); // set default happy path
    mockPrisma.model.findMany.mockResolvedValue([]);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });
  // 422, 400, 404, 500, 200/201 tests...
});
```

**Note**: `$transaction` is already in the shared mock — do not add it. The existing implementation handles both `prisma.$transaction(callback)` and `prisma.$transaction([promise1, promise2])`.

---

## Service files (`src/services/**`)

Module-level `global.fetch` mock. No `vi.hoisted` needed.

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { fnToTest } from "@/services/foo";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("foo service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POSTs and returns data", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ data: {} }) });
    const result = await fnToTest({ field: "value" });
    expect(result.data).toBeDefined();
    expect(mockFetch).toHaveBeenCalledWith("/api/...", expect.objectContaining({ method: "POST" }));
  });

  it("throws on error response", async () => {
    mockFetch.mockResolvedValue({ ok: false, text: () => Promise.resolve("ERROR_CODE") });
    await expect(fnToTest({ field: "value" })).rejects.toThrow("ERROR_CODE");
  });
});
```

---

## React components (`src/components/**`)

`vi.mock()` at module level. Add `QueryClientProvider` wrapper if the component uses TanStack Query hooks.

```typescript
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ComponentName } from "@/components/features/.../ComponentName";

vi.mock("sonner", () => ({ toast: vi.fn() }));          // always mock toast
vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({ user: { id: "u1", societyId: "s1", role: "ADMIN" } })),
}));
vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn() })),
  usePathname: vi.fn(() => "/"),
  useSearchParams: vi.fn(() => ({ get: vi.fn(() => null) })),
}));
vi.mock("next/image", () => ({
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));

function wrap(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

describe("ComponentName", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  // Rendering tests — use wrap()
  it("renders the amount", () => {
    wrap(<ComponentName amount={2000} />);
    expect(screen.getByText(/2,000/)).toBeInTheDocument();
  });

  // Interaction tests — use userEvent.setup() INSIDE the test
  it("copies UPI ID on button click", async () => {
    const user = userEvent.setup();
    // Spy AFTER userEvent.setup() — it installs its own clipboard stub
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    wrap(<ComponentName upiId="test@sbi" />);
    await user.click(screen.getByRole("button", { name: /copy/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith("test@sbi"));
    expect(toast).toHaveBeenCalled();
  });
});
```

---

## Next.js pages (`src/app/**/page.tsx`)

`vi.hoisted()` for fetch + mock all heavy child components.

```typescript
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));
globalThis.fetch = mockFetch;

vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(() => ({ get: vi.fn((_k: string) => null) })),
  useRouter: vi.fn(() => ({ push: vi.fn() })),
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({ user: { societyId: "s1" } })),
}));
// Mock heavy child components to isolate the page
vi.mock("@/components/features/SomeFeature", () => ({
  SomeFeature: ({ prop }: { prop: string }) => <div data-testid="some-feature">{prop}</div>,
}));
vi.mock("@/components/ui/LoadingSkeleton", () => ({
  PageSkeleton: () => <div data-testid="page-skeleton" />,
}));
// Mock services that use fetch internally
vi.mock("@/services/some-service", () => ({ someServiceFn: vi.fn() }));

import { useSearchParams } from "next/navigation";
import { someServiceFn } from "@/services/some-service";
import PageComponent from "@/app/.../page";

const mockUseSearchParams = vi.mocked(useSearchParams);
const mockSomeServiceFn = vi.mocked(someServiceFn);

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><PageComponent /></QueryClientProvider>);
}

describe("PageComponent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSearchParams.mockReturnValue({ get: (k: string) => k === "id" ? "val-1" : null } as ReturnType<typeof useSearchParams>);
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ items: [] }) });
  });

  it("shows loading skeleton while fetching", () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    renderPage();
    expect(screen.getByTestId("page-skeleton")).toBeInTheDocument();
  });
  // error state, empty state, success state, amount calculations...
});
```

---

## Custom hooks (`src/hooks/**`)

`renderHook` from `@testing-library/react`.

```typescript
import React from "react";
import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useHookName } from "@/hooks/useHookName";

// If the hook reads from a context, wrap with a provider:
function wrapper({ children }: { children: React.ReactNode }) {
  return <SomeContext.Provider value={mockValue}>{children}</SomeContext.Provider>;
}

describe("useHookName", () => {
  it("returns the expected value", () => {
    const { result } = renderHook(() => useHookName(), { wrapper });
    expect(result.current.someField).toBe("expected");
  });

  it("returns defaults when no provider", () => {
    const { result } = renderHook(() => useHookName());
    expect(result.current.someField).toBeNull();
  });
});
```

---

## Coverage requirements

- 95% lines, branches, functions, statements **per file**
- Every branch: `if/else`, ternary, `?.`, `??`
- API routes: 401 (unauth), 422 (invalid input), 400 (business rule), 404 (not found), 500 (DB error), 201/200 (success)
- Components/pages: loading, error, empty, success states

## File location convention

```
src/services/payment-claims.ts         → tests/services/payment-claims.test.ts
src/components/features/X/Foo.tsx      → tests/components/X/Foo.test.tsx
src/app/api/v1/residents/me/.../route  → tests/api/resident-payment-claims.test.ts
src/app/r/payments/pay/page.tsx        → tests/app/r/payments/pay/page.test.tsx
src/lib/config/payment.ts              → tests/lib/config/payment.test.ts
src/hooks/useHookName.ts               → tests/hooks/useHookName.test.ts
```

## After writing tests

Run `npx vitest run <test-file>`. Do **not** use `test:staged` — the file is not staged yet.
