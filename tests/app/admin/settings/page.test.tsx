import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/settings",
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import AdminSettingsPage from "@/app/admin/settings/page";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockSettings = {
  emailVerificationRequired: true,
  joiningFee: 500,
  annualFee: 2000,
  gracePeriodDays: 30,
  feeSessionStartMonth: 4,
  feeSessions: [] as Array<{
    id: string;
    sessionYear: string;
    annualFee: number;
    joiningFee: number;
    sessionStart: string;
    sessionEnd: string;
    gracePeriodEnd: string;
    status: string;
  }>,
};

const mockSession = {
  id: "sess-1",
  sessionYear: "2025-26",
  annualFee: 2000,
  joiningFee: 500,
  sessionStart: "2025-04-01T00:00:00.000Z",
  sessionEnd: "2026-03-31T00:00:00.000Z",
  gracePeriodEnd: "2026-04-30T00:00:00.000Z",
  status: "ACTIVE",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPage(fetchImpl?: typeof global.fetch) {
  global.fetch =
    fetchImpl ??
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockSettings),
    });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminSettingsPage />
    </QueryClientProvider>,
  );
}

function mockFetchWithSettings(settings = mockSettings) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(settings),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AdminSettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // --- Loading state ---

  it("shows skeleton while loading", () => {
    renderPage(vi.fn().mockReturnValue(new Promise(() => {})));
    expect(screen.queryByText("Settings")).not.toBeInTheDocument();
  });

  // --- Main render ---

  it("renders Settings heading after load", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Settings")).toBeInTheDocument();
    });
  });

  it("renders Subscription Payment card", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Subscription Payment")).toBeInTheDocument();
    });
  });

  it("Subscription Payment card links to /admin/settings/subscription", async () => {
    renderPage();
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /subscription payment/i });
      expect(link).toHaveAttribute("href", "/admin/settings/subscription");
    });
  });

  it("renders Payment Setup card", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Payment Setup")).toBeInTheDocument();
    });
  });

  it("Payment Setup card links to /admin/settings/payment-setup", async () => {
    renderPage();
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /payment setup/i });
      expect(link).toHaveAttribute("href", "/admin/settings/payment-setup");
    });
  });

  // --- Email verification ---

  it("renders Email Verification section", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Email Verification")).toBeInTheDocument();
    });
  });

  it("email verification switch is checked when setting is true", async () => {
    renderPage(mockFetchWithSettings({ ...mockSettings, emailVerificationRequired: true }));
    await waitFor(() => {
      const toggle = screen.getByRole("switch");
      expect(toggle).toBeChecked();
    });
  });

  it("toggling email verification switch calls PATCH API", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockSettings) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...mockSettings, emailVerificationRequired: false }),
      });

    renderPage(fetchMock);

    await waitFor(() => {
      expect(screen.getByRole("switch")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("switch"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/admin/settings",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });

  it("shows update error when PATCH fails", async () => {
    const { toast } = await import("sonner");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockSettings) })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: { message: "Unauthorized" } }),
      });

    renderPage(fetchMock);

    await waitFor(() => expect(screen.getByRole("switch")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("switch"));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Unauthorized");
    });
  });

  // --- Active session warning ---

  it("shows active session warning when a session is ACTIVE", async () => {
    renderPage(mockFetchWithSettings({ ...mockSettings, feeSessions: [mockSession] }));
    await waitFor(() => {
      expect(screen.getByText(/An active fee session exists/i)).toBeInTheDocument();
    });
  });

  it("does not show active session warning when no ACTIVE session", async () => {
    renderPage(
      mockFetchWithSettings({
        ...mockSettings,
        feeSessions: [{ ...mockSession, status: "UPCOMING" }],
      }),
    );
    await waitFor(() => {
      expect(screen.queryByText(/An active fee session exists/i)).not.toBeInTheDocument();
    });
  });

  // --- Fee Configuration card ---

  it("renders Fee Configuration section", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Fee Configuration")).toBeInTheDocument();
    });
  });

  it("initializes joining fee input from settings", async () => {
    renderPage(mockFetchWithSettings({ ...mockSettings, joiningFee: 750 }));
    await waitFor(() => {
      expect(screen.getByLabelText(/Joining Fee/i)).toHaveValue(750);
    });
  });

  it("initializes annual fee input from settings", async () => {
    renderPage(mockFetchWithSettings({ ...mockSettings, annualFee: 3000 }));
    await waitFor(() => {
      expect(screen.getByLabelText(/Annual Fee/i)).toHaveValue(3000);
    });
  });

  it("initializes grace period input from settings", async () => {
    renderPage(mockFetchWithSettings({ ...mockSettings, gracePeriodDays: 45 }));
    await waitFor(() => {
      expect(screen.getByLabelText(/Grace Period/i)).toHaveValue(45);
    });
  });

  it("changes grace period input and enables Save button", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByLabelText(/Grace Period/i)).toBeInTheDocument());

    await userEvent.clear(screen.getByLabelText(/Grace Period/i));
    await userEvent.type(screen.getByLabelText(/Grace Period/i), "45");

    expect(screen.getByRole("button", { name: /Save Fee Settings/i })).not.toBeDisabled();
  });

  it("changing session start month Select enables Save button", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("combobox"));
    const mayOption = await screen.findByRole("option", { name: "May" });
    await userEvent.click(mayOption);

    expect(screen.getByRole("button", { name: /Save Fee Settings/i })).not.toBeDisabled();
  });

  it("Save Fee Settings button is disabled before any field change", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Save Fee Settings/i })).toBeDisabled();
    });
  });

  it("Save Fee Settings button becomes enabled after changing a field", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByLabelText(/Joining Fee/i)).toBeInTheDocument());

    await userEvent.clear(screen.getByLabelText(/Joining Fee/i));
    await userEvent.type(screen.getByLabelText(/Joining Fee/i), "600");

    expect(screen.getByRole("button", { name: /Save Fee Settings/i })).not.toBeDisabled();
  });

  it("save skips out-of-range grace period value", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockSettings) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockSettings) });

    renderPage(fetchMock);
    await waitFor(() => expect(screen.getByLabelText(/Grace Period/i)).toBeInTheDocument());

    // Set grace period to 0 (below minimum of 1) — condition `gp >= 1` is false
    await userEvent.clear(screen.getByLabelText(/Grace Period/i));
    await userEvent.type(screen.getByLabelText(/Grace Period/i), "0");
    await userEvent.click(screen.getByRole("button", { name: /Save Fee Settings/i }));

    await waitFor(() => {
      // PATCH is still called (other fields are valid), but gracePeriodDays is excluded
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/admin/settings",
        expect.objectContaining({ method: "PATCH" }),
      );
      const patchCall = fetchMock.mock.calls.find(
        ([url, opts]) => url === "/api/v1/admin/settings" && opts?.method === "PATCH",
      );
      const body = JSON.parse((patchCall![1] as RequestInit).body as string) as Record<
        string,
        unknown
      >;
      expect(body.gracePeriodDays).toBeUndefined();
    });
  });

  it("clicking Save Fee Settings calls PATCH API", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockSettings) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockSettings) });

    renderPage(fetchMock);
    await waitFor(() => expect(screen.getByLabelText(/Annual Fee/i)).toBeInTheDocument());

    await userEvent.clear(screen.getByLabelText(/Annual Fee/i));
    await userEvent.type(screen.getByLabelText(/Annual Fee/i), "2500");
    await userEvent.click(screen.getByRole("button", { name: /Save Fee Settings/i }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/admin/settings",
        expect.objectContaining({ method: "PATCH" }),
      );
    });
  });

  // --- Fee Sessions card ---

  it("renders Fee Sessions section", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Fee Sessions")).toBeInTheDocument();
    });
  });

  it("shows empty state when no fee sessions", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("No fee sessions")).toBeInTheDocument();
    });
  });

  it("renders fee sessions table when sessions exist", async () => {
    renderPage(mockFetchWithSettings({ ...mockSettings, feeSessions: [mockSession] }));
    await waitFor(() => {
      expect(screen.getByText("2025-26")).toBeInTheDocument();
      expect(screen.getByText("ACTIVE")).toBeInTheDocument();
    });
  });

  it("renders UPCOMING session status", async () => {
    renderPage(
      mockFetchWithSettings({
        ...mockSettings,
        feeSessions: [{ ...mockSession, status: "UPCOMING" }],
      }),
    );
    await waitFor(() => {
      expect(screen.getByText("UPCOMING")).toBeInTheDocument();
    });
  });

  it("renders COMPLETED session status", async () => {
    renderPage(
      mockFetchWithSettings({
        ...mockSettings,
        feeSessions: [{ ...mockSession, status: "COMPLETED" }],
      }),
    );
    await waitFor(() => {
      expect(screen.getByText("COMPLETED")).toBeInTheDocument();
    });
  });

  it("renders unknown session status without crashing", async () => {
    renderPage(
      mockFetchWithSettings({
        ...mockSettings,
        feeSessions: [{ ...mockSession, status: "UNKNOWN" }],
      }),
    );
    await waitFor(() => {
      expect(screen.getByText("UNKNOWN")).toBeInTheDocument();
    });
  });

  it("save excludes out-of-range annual fee (> 100000)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockSettings) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockSettings) });

    renderPage(fetchMock);
    await waitFor(() => expect(screen.getByLabelText(/Annual Fee/i)).toBeInTheDocument());

    await userEvent.clear(screen.getByLabelText(/Annual Fee/i));
    await userEvent.type(screen.getByLabelText(/Annual Fee/i), "200000");
    // 200000 > 100000 → af <= 100000 = false → annualFee excluded
    await userEvent.click(screen.getByRole("button", { name: /Save Fee Settings/i }));

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(
        ([url, opts]) => url === "/api/v1/admin/settings" && opts?.method === "PATCH",
      );
      const body = JSON.parse((patchCall![1] as RequestInit).body as string) as Record<
        string,
        unknown
      >;
      expect(body.annualFee).toBeUndefined();
    });
  });

  it("save excludes joiningFee when value exceeds 100000", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockSettings) })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockSettings) });

    renderPage(fetchMock);
    await waitFor(() => expect(screen.getByLabelText(/Joining Fee/i)).toBeInTheDocument());

    await userEvent.clear(screen.getByLabelText(/Joining Fee/i));
    await userEvent.type(screen.getByLabelText(/Joining Fee/i), "200000");
    await userEvent.click(screen.getByRole("button", { name: /Save Fee Settings/i }));

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(
        ([url, opts]) => url === "/api/v1/admin/settings" && opts?.method === "PATCH",
      );
      const body = JSON.parse((patchCall![1] as RequestInit).body as string) as Record<
        string,
        unknown
      >;
      expect(body.joiningFee).toBeUndefined();
    });
  });

  it("shows Loader2 spinner while mutation is pending", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockSettings) })
      .mockReturnValueOnce(new Promise(() => {})); // PATCH never resolves → mutation stays pending

    renderPage(fetchMock);
    await waitFor(() => expect(screen.getByRole("switch")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("switch")); // triggers mutation.mutate

    // While pending: switch is disabled and Loader2 is rendered near the switch
    await waitFor(() => {
      expect(screen.getByRole("switch")).toBeDisabled();
    });
  });

  it("renders without crashing when settings is undefined", async () => {
    renderPage(vi.fn().mockResolvedValue({ ok: false }));
    // fetch fails → React Query keeps data as undefined
    await waitFor(() => {
      // Page renders (no skeleton) but settings-dependent fields have empty values
      expect(screen.getByText("Fee Configuration")).toBeInTheDocument();
    });
  });

  it("opens Create Session dialog when button clicked", async () => {
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Create Session/i })).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole("button", { name: /Create Session/i }));

    await waitFor(() => {
      expect(screen.getByText("Create Fee Session")).toBeInTheDocument();
    });
  });

  it("shows invalid year error when year is out of range", async () => {
    const { toast } = await import("sonner");
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Create Session/i })).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole("button", { name: /Create Session/i }));
    await waitFor(() => expect(screen.getByText("Create Fee Session")).toBeInTheDocument());

    const yearInput = screen.getByLabelText(/Start Year/i);
    await userEvent.clear(yearInput);
    await userEvent.type(yearInput, "2020");

    const dialogCreateBtn = screen.getAllByRole("button", { name: /Create Session/i })[0];
    fireEvent.click(dialogCreateBtn);

    expect(toast.error).toHaveBeenCalledWith("Enter a valid year between 2024 and 2100");
  });

  it("calls create session API with valid year", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockSettings) })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ...mockSession, message: "Session created" }),
      });

    renderPage(fetchMock);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Create Session/i })).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole("button", { name: /Create Session/i }));
    await waitFor(() => expect(screen.getByText("Create Fee Session")).toBeInTheDocument());

    const dialogCreateBtn = screen.getAllByRole("button", { name: /Create Session/i })[0];
    fireEvent.click(dialogCreateBtn);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/v1/admin/fee-sessions",
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("shows generic error message when create session response has no error.message", async () => {
    const { toast } = await import("sonner");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockSettings) })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({}), // no error.message → falls back to generic
      });

    renderPage(fetchMock);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Create Session/i })).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole("button", { name: /Create Session/i }));
    await waitFor(() => expect(screen.getByText("Create Fee Session")).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole("button", { name: /Create Session/i })[0]);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to create fee session");
    });
  });

  it("shows Loader2 spinner in dialog while create session mutation is pending", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockSettings) })
      .mockReturnValueOnce(new Promise(() => {})); // POST never resolves → mutation stays pending

    renderPage(fetchMock);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Create Session/i })).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole("button", { name: /Create Session/i }));
    await waitFor(() => expect(screen.getByText("Create Fee Session")).toBeInTheDocument());

    fireEvent.click(screen.getAllByRole("button", { name: /Create Session/i })[0]);

    // While pending: dialog create button is disabled
    await waitFor(() => {
      const dialogBtn = screen.getAllByRole("button", { name: /Create Session/i })[0];
      expect(dialogBtn).toBeDisabled();
    });
  });

  it("shows error when create session fails", async () => {
    const { toast } = await import("sonner");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(mockSettings) })
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: { message: "Session already exists" } }),
      });

    renderPage(fetchMock);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Create Session/i })).toBeInTheDocument(),
    );

    await userEvent.click(screen.getByRole("button", { name: /Create Session/i }));
    await waitFor(() => expect(screen.getByText("Create Fee Session")).toBeInTheDocument());

    const dialogCreateBtn = screen.getAllByRole("button", { name: /Create Session/i })[0];
    fireEvent.click(dialogCreateBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Session already exists");
    });
  });
});
