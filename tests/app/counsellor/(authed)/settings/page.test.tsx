import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetMe = vi.hoisted(() => vi.fn());
const mockListFactors = vi.hoisted(() => vi.fn());
const mockUnenroll = vi.hoisted(() => vi.fn());
const mockSignOut = vi.hoisted(() => vi.fn());
const mockFetch = vi.hoisted(() => vi.fn());
const mockToastSuccess = vi.hoisted(() => vi.fn());
const mockToastError = vi.hoisted(() => vi.fn());
const mockPush = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));
vi.mock("@/services/counsellor-self", () => ({
  getMe: mockGetMe,
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signOut: mockSignOut,
      mfa: {
        listFactors: mockListFactors,
        unenroll: mockUnenroll,
      },
    },
  }),
}));
vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import CounsellorSettingsPage from "@/app/counsellor/(authed)/settings/page";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CounsellorSettingsPage />
    </QueryClientProvider>,
  );
}

const profileEnrolled = {
  id: "c-1",
  authUserId: "auth-1",
  email: "asha@x.com",
  name: "Asha",
  mobile: null,
  nationalId: null,
  photoUrl: null,
  bio: null,
  publicBlurb: null,
  isActive: true,
  mfaRequired: true,
  mfaEnrolledAt: new Date().toISOString(),
  lastLoginAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const profileNotEnrolled = { ...profileEnrolled, mfaEnrolledAt: null };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", mockFetch);
  mockListFactors.mockResolvedValue({ data: { totp: [{ id: "factor-1" }] } });
  mockUnenroll.mockResolvedValue({ error: null });
  mockSignOut.mockResolvedValue(undefined);
  mockFetch.mockResolvedValue({ ok: true });
});

describe("CounsellorSettingsPage", () => {
  it("renders loading skeleton initially", () => {
    mockGetMe.mockImplementation(() => new Promise(() => {}));
    const { container } = renderPage();
    expect(container.querySelector('[class*="animate-pulse"]')).toBeTruthy();
  });

  it("renders error banner on query failure", async () => {
    mockGetMe.mockRejectedValue(new Error("boom"));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Failed to load settings/)).toBeInTheDocument();
    });
  });

  it("shows MFA active description when enrolled", async () => {
    mockGetMe.mockResolvedValue(profileEnrolled);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/TOTP factor active/)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Reset MFA/ })).toBeEnabled();
  });

  it("disables Reset MFA when not enrolled", async () => {
    mockGetMe.mockResolvedValue(profileNotEnrolled);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/MFA is not yet enrolled/)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Reset MFA/ })).toBeDisabled();
  });

  it("opens reset confirmation dialog", async () => {
    mockGetMe.mockResolvedValue(profileEnrolled);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Reset MFA/ })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /Reset MFA/ }));
    await waitFor(() => {
      expect(screen.getByText("Reset MFA?")).toBeInTheDocument();
    });
  });

  it("resets MFA, signs user to set-password on confirm", async () => {
    mockGetMe.mockResolvedValue(profileEnrolled);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Reset MFA/ })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /Reset MFA/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Yes, reset" })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "Yes, reset" }));
    await waitFor(() => {
      expect(mockUnenroll).toHaveBeenCalledWith({ factorId: "factor-1" });
      expect(mockFetch).toHaveBeenCalledWith("/api/v1/counsellor/mfa-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrolled: false }),
      });
      expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringContaining("re-enrol"));
      expect(mockPush).toHaveBeenCalledWith("/counsellor/set-password");
    });
  });

  it("shows error when MFA reset sync fails", async () => {
    mockGetMe.mockResolvedValue(profileEnrolled);
    mockFetch.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Reset MFA/ })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /Reset MFA/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Yes, reset" })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "Yes, reset" }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "MFA was reset, but account state could not be updated.",
      );
    });
    expect(mockPush).not.toHaveBeenCalledWith("/counsellor/set-password");
  });

  it("shows error when no MFA factor exists at reset time", async () => {
    mockGetMe.mockResolvedValue(profileEnrolled);
    mockListFactors.mockResolvedValue({ data: { totp: [] } });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Reset MFA/ })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /Reset MFA/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Yes, reset" })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "Yes, reset" }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("No MFA factor found.");
    });
  });

  it("shows error when unenroll fails", async () => {
    mockGetMe.mockResolvedValue(profileEnrolled);
    mockUnenroll.mockResolvedValue({ error: { message: "cannot remove" } });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Reset MFA/ })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /Reset MFA/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Yes, reset" })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "Yes, reset" }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("cannot remove");
    });
  });

  it("shows generic error when listFactors throws", async () => {
    mockGetMe.mockResolvedValue(profileEnrolled);
    mockListFactors.mockRejectedValue(new Error("net"));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Reset MFA/ })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /Reset MFA/ }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Yes, reset" })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "Yes, reset" }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Failed to reset MFA.");
    });
  });

  it("signs out and redirects to login on Sign out", async () => {
    mockGetMe.mockResolvedValue(profileEnrolled);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Sign out/ })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /Sign out/ }));
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockToastSuccess).toHaveBeenCalledWith("Signed out.");
      expect(mockPush).toHaveBeenCalledWith("/counsellor/login");
    });
  });

  it("shows generic error when signOut throws", async () => {
    mockGetMe.mockResolvedValue(profileEnrolled);
    mockSignOut.mockRejectedValue(new Error("net"));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Sign out/ })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /Sign out/ }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Failed to sign out.");
    });
  });
});
