import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/profile",
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { toast } from "sonner";

import AdminProfilePage from "@/app/admin/profile/page";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockProfile = {
  id: "user-1",
  name: "Arjun Kapoor",
  email: "arjun@example.com",
  mobile: "9876543210",
  role: "RWA_ADMIN",
  adminPermission: "FULL_ACCESS",
  societyName: "Greenwood Residency RWA",
  societyCode: "GRNW",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFetchOk(data: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  });
}

function makeFetchError(message: string, status = 422) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: () => Promise.resolve({ error: { message } }),
  });
}

function renderPage(fetchImpl?: typeof global.fetch) {
  global.fetch = fetchImpl ?? makeFetchOk(mockProfile);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminProfilePage />
    </QueryClientProvider>,
  );
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("AdminProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Loading state ──────────────────────────────────────────────────────────

  it("shows skeleton while data is loading", () => {
    renderPage(vi.fn().mockReturnValue(new Promise(() => {})));
    expect(screen.queryByText("My Profile")).not.toBeInTheDocument();
  });

  // ── Render after load ──────────────────────────────────────────────────────

  it("renders page heading after load", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("My Profile")).toBeInTheDocument();
    });
  });

  it("renders Account Details card", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Account Details")).toBeInTheDocument();
    });
  });

  it("renders Account Info card", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Account Info")).toBeInTheDocument();
    });
  });

  it("pre-fills name input with profile name", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByDisplayValue("Arjun Kapoor")).toBeInTheDocument();
    });
  });

  it("pre-fills mobile input with profile mobile", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByDisplayValue("9876543210")).toBeInTheDocument();
    });
  });

  it("shows email in read-only section", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("arjun@example.com")).toBeInTheDocument();
    });
  });

  it("shows society name in read-only section", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Greenwood Residency RWA")).toBeInTheDocument();
    });
  });

  it("shows society code in read-only section", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("GRNW")).toBeInTheDocument();
    });
  });

  it("shows RWA Administrator as role", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("RWA Administrator")).toBeInTheDocument();
    });
  });

  it("shows — for null societyName", async () => {
    renderPage(makeFetchOk({ ...mockProfile, societyName: null, societyCode: null }));
    await waitFor(() => {
      const dashes = screen.getAllByText("—");
      expect(dashes.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("shows empty mobile when profile has empty mobile string", async () => {
    renderPage(makeFetchOk({ ...mockProfile, mobile: "" }));
    await waitFor(() => {
      const mobileInput = screen.getByPlaceholderText("10-digit mobile number");
      expect(mobileInput).toHaveValue("");
    });
  });

  // ── Save Changes button ────────────────────────────────────────────────────

  it("Save Changes button is enabled when name is non-empty", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save changes/i })).not.toBeDisabled();
    });
  });

  it("Save Changes button is disabled when name is cleared", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByDisplayValue("Arjun Kapoor")).toBeInTheDocument();
    });
    const nameInput = screen.getByDisplayValue("Arjun Kapoor");
    fireEvent.change(nameInput, { target: { value: "" } });
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save changes/i })).toBeDisabled();
    });
  });

  // ── Successful update ──────────────────────────────────────────────────────

  it("calls PATCH on save and shows success toast", async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      // First call = GET profile, subsequent = PATCH update
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            callCount === 1 ? mockProfile : { message: "Profile updated", user: mockProfile },
          ),
      });
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <AdminProfilePage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue("Arjun Kapoor")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Profile updated");
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/v1/admin/profile",
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  // ── Failed update ──────────────────────────────────────────────────────────

  it("shows error toast on PATCH failure", async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // GET succeeds
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockProfile) });
      }
      // PATCH fails
      return Promise.resolve({
        ok: false,
        json: () => Promise.resolve({ error: { message: "Update failed" } }),
      });
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <AdminProfilePage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue("Arjun Kapoor")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Update failed");
    });
  });

  // ── Mobile input editing ───────────────────────────────────────────────────

  it("allows editing mobile number", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByDisplayValue("9876543210")).toBeInTheDocument();
    });
    const mobileInput = screen.getByDisplayValue("9876543210");
    fireEvent.change(mobileInput, { target: { value: "9000000001" } });
    expect(mobileInput).toHaveValue("9000000001");
  });

  it("allows editing name field", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByDisplayValue("Arjun Kapoor")).toBeInTheDocument();
    });
    const nameInput = screen.getByDisplayValue("Arjun Kapoor");
    fireEvent.change(nameInput, { target: { value: "Ramesh Sharma" } });
    expect(nameInput).toHaveValue("Ramesh Sharma");
  });

  it("shows generic error toast when PATCH response has no message", async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockProfile) });
      }
      // PATCH fails with no message in body
      return Promise.resolve({ ok: false, json: () => Promise.resolve({ error: {} }) });
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <AdminProfilePage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue("Arjun Kapoor")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Update failed");
    });
  });

  // ── Pending state ─────────────────────────────────────────────────────────

  it("shows Saving… text while mutation is pending", async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(mockProfile) });
      }
      // PATCH never resolves — keeps mutation in isPending state
      return new Promise(() => {});
    });

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <AdminProfilePage />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue("Arjun Kapoor")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByText("Saving…")).toBeInTheDocument();
    });
  });

  // ── Fetch error ────────────────────────────────────────────────────────────

  it("renders skeleton (not profile content) when fetch fails", async () => {
    renderPage(makeFetchError("Unauthorized", 403));
    // Profile content should never appear since fetch throws
    await new Promise((r) => setTimeout(r, 100));
    expect(screen.queryByText("My Profile")).not.toBeInTheDocument();
  });
});
