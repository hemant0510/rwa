import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSignOut = vi.hoisted(() => vi.fn());
const mockToastSuccess = vi.hoisted(() => vi.fn());
const mockToastError = vi.hoisted(() => vi.fn());
const mockPush = vi.hoisted(() => vi.fn());
const mockRefresh = vi.hoisted(() => vi.fn());
const mockFetch = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signOut: mockSignOut },
  }),
}));
vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

import CounsellorSetPasswordPage from "@/app/counsellor/set-password/page";

beforeEach(() => {
  vi.clearAllMocks();
  mockSignOut.mockResolvedValue({ error: null });
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ passwordSet: true }) });
  vi.stubGlobal("fetch", mockFetch);
});

async function fillPasswords(
  user: ReturnType<typeof userEvent.setup>,
  pwd = "password123",
  confirm = "password123",
) {
  await user.type(screen.getByLabelText("New password"), pwd);
  await user.type(screen.getByLabelText("Confirm password"), confirm);
  await user.click(screen.getByRole("button", { name: "Set Password & Continue" }));
}

describe("CounsellorSetPasswordPage", () => {
  it("renders heading and password form", () => {
    render(<CounsellorSetPasswordPage />);
    expect(screen.getByText("Set Up Your Account")).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
  });

  it("rejects passwords shorter than 8 chars", async () => {
    const user = userEvent.setup();
    render(<CounsellorSetPasswordPage />);
    await fillPasswords(user, "short", "short");
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Password must be at least 8 characters.");
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("rejects when passwords do not match", async () => {
    const user = userEvent.setup();
    render(<CounsellorSetPasswordPage />);
    await fillPasswords(user, "password123", "different456");
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Passwords do not match.");
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("posts password to first-password endpoint on submit", async () => {
    const user = userEvent.setup();
    render(<CounsellorSetPasswordPage />);
    await fillPasswords(user);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/counsellor/first-password",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: "password123" }),
        }),
      );
    });
  });

  it("signs out, toasts success, and redirects to home on success", async () => {
    const user = userEvent.setup();
    render(<CounsellorSetPasswordPage />);
    await fillPasswords(user);
    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Password updated. Please log in with your new credentials.",
      );
      expect(mockPush).toHaveBeenCalledWith("/");
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("shows server error message and stays on page when endpoint returns error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: { code: "PASSWORD_UPDATE_FAILED", message: "weak password" } }),
    });
    const user = userEvent.setup();
    render(<CounsellorSetPasswordPage />);
    await fillPasswords(user);
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("weak password");
    });
    expect(mockSignOut).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("falls back to generic message when error body is malformed", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => {
        throw new Error("bad json");
      },
    });
    const user = userEvent.setup();
    render(<CounsellorSetPasswordPage />);
    await fillPasswords(user);
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Failed to set password. Please try again.");
    });
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it("shows generic toast when fetch throws", async () => {
    mockFetch.mockRejectedValue(new Error("net"));
    const user = userEvent.setup();
    render(<CounsellorSetPasswordPage />);
    await fillPasswords(user);
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Failed to set password. Please try again.");
    });
  });
});
