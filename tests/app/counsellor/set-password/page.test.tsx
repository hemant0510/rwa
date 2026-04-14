import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUpdateUser = vi.hoisted(() => vi.fn());
const mockEnroll = vi.hoisted(() => vi.fn());
const mockChallenge = vi.hoisted(() => vi.fn());
const mockVerify = vi.hoisted(() => vi.fn());
const mockToastSuccess = vi.hoisted(() => vi.fn());
const mockToastError = vi.hoisted(() => vi.fn());
const mockPush = vi.hoisted(() => vi.fn());
const mockRefresh = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      updateUser: mockUpdateUser,
      mfa: {
        enroll: mockEnroll,
        challenge: mockChallenge,
        verify: mockVerify,
      },
    },
  }),
}));
vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import CounsellorSetPasswordPage from "@/app/counsellor/set-password/page";

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateUser.mockResolvedValue({ error: null });
  mockEnroll.mockResolvedValue({
    data: {
      id: "factor-1",
      totp: { qr_code: "data:image/png;base64,xx", secret: "ABCDEF" },
    },
    error: null,
  });
  mockChallenge.mockResolvedValue({ data: { id: "chall-1" }, error: null });
  mockVerify.mockResolvedValue({ error: null });
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

describe("CounsellorSetPasswordPage — password stage", () => {
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
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("rejects when passwords do not match", async () => {
    const user = userEvent.setup();
    render(<CounsellorSetPasswordPage />);
    await fillPasswords(user, "password123", "different456");
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Passwords do not match.");
    });
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("shows error and stays when updateUser fails", async () => {
    mockUpdateUser.mockResolvedValue({ error: { message: "weak password" } });
    const user = userEvent.setup();
    render(<CounsellorSetPasswordPage />);
    await fillPasswords(user);
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("weak password");
    });
  });

  it("shows error when enrollment fails", async () => {
    mockEnroll.mockResolvedValue({ data: null, error: { message: "rate" } });
    const user = userEvent.setup();
    render(<CounsellorSetPasswordPage />);
    await fillPasswords(user);
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("rate");
    });
  });

  it("uses generic message when enroll error has no message", async () => {
    mockEnroll.mockResolvedValue({ data: null, error: {} });
    const user = userEvent.setup();
    render(<CounsellorSetPasswordPage />);
    await fillPasswords(user);
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Failed to start MFA enrollment");
    });
  });

  it("advances to MFA stage on successful enrollment, showing QR + secret", async () => {
    const user = userEvent.setup();
    render(<CounsellorSetPasswordPage />);
    await fillPasswords(user);
    await waitFor(() => {
      expect(screen.getByLabelText("6-digit code")).toBeInTheDocument();
      expect(screen.getByRole("img", { name: "MFA QR code" })).toBeInTheDocument();
      expect(screen.getByText(/ABCDEF/)).toBeInTheDocument();
    });
  });

  it("shows generic toast when updateUser throws", async () => {
    mockUpdateUser.mockRejectedValue(new Error("net"));
    const user = userEvent.setup();
    render(<CounsellorSetPasswordPage />);
    await fillPasswords(user);
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Failed to set password. Please try again.");
    });
  });
});

describe("CounsellorSetPasswordPage — MFA stage", () => {
  async function advanceToMfa() {
    const user = userEvent.setup();
    render(<CounsellorSetPasswordPage />);
    await fillPasswords(user);
    await waitFor(() => expect(screen.getByLabelText("6-digit code")).toBeInTheDocument());
    return user;
  }

  it("disables Verify until 6 digits entered", async () => {
    await advanceToMfa();
    expect(screen.getByRole("button", { name: "Verify & Continue" })).toBeDisabled();
  });

  it("shows error when challenge fails", async () => {
    mockChallenge.mockResolvedValue({ data: null, error: { message: "ch fail" } });
    const user = await advanceToMfa();
    await user.type(screen.getByLabelText("6-digit code"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify & Continue" }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("ch fail");
    });
  });

  it("uses generic message when challenge error has no message", async () => {
    mockChallenge.mockResolvedValue({ data: null, error: {} });
    const user = await advanceToMfa();
    await user.type(screen.getByLabelText("6-digit code"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify & Continue" }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Failed to challenge MFA factor");
    });
  });

  it("shows error when verify fails", async () => {
    mockVerify.mockResolvedValue({ error: { message: "bad code" } });
    const user = await advanceToMfa();
    await user.type(screen.getByLabelText("6-digit code"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify & Continue" }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("bad code");
    });
  });

  it("redirects to /counsellor/onboarding on full success", async () => {
    const user = await advanceToMfa();
    await user.type(screen.getByLabelText("6-digit code"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify & Continue" }));
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringContaining("onboarding"));
      expect(mockPush).toHaveBeenCalledWith("/counsellor/onboarding");
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("shows generic toast when verify throws", async () => {
    mockVerify.mockRejectedValue(new Error("net"));
    const user = await advanceToMfa();
    await user.type(screen.getByLabelText("6-digit code"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify & Continue" }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Verification failed. Please try again.");
    });
  });
});
