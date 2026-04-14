import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSignInWithPassword = vi.hoisted(() => vi.fn());
const mockListFactors = vi.hoisted(() => vi.fn());
const mockChallenge = vi.hoisted(() => vi.fn());
const mockVerify = vi.hoisted(() => vi.fn());
const mockSignOut = vi.hoisted(() => vi.fn());
const mockToastSuccess = vi.hoisted(() => vi.fn());
const mockToastError = vi.hoisted(() => vi.fn());
const mockToastInfo = vi.hoisted(() => vi.fn());
const mockPush = vi.hoisted(() => vi.fn());
const mockRefresh = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signOut: mockSignOut,
      mfa: {
        listFactors: mockListFactors,
        challenge: mockChallenge,
        verify: mockVerify,
      },
    },
  }),
}));
vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess, error: mockToastError, info: mockToastInfo },
}));

const mockFetch = vi.fn();

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import CounsellorLoginPage from "@/app/counsellor/login/page";

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockReset();
  vi.stubGlobal("fetch", mockFetch);
  mockSignInWithPassword.mockResolvedValue({ error: null });
  mockListFactors.mockResolvedValue({
    data: { totp: [{ id: "factor-1", status: "verified" }] },
  });
  mockChallenge.mockResolvedValue({ data: { id: "chall-1" }, error: null });
  mockVerify.mockResolvedValue({ error: null });
  mockSignOut.mockResolvedValue(undefined);
  mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
});

async function fillCredentialsAndSubmit(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("Email"), "asha@x.com");
  await user.type(screen.getByLabelText("Password"), "secret123");
  await user.click(screen.getByRole("button", { name: "Sign In" }));
}

describe("CounsellorLoginPage — credentials stage", () => {
  it("renders Counsellor heading and Sign In form", () => {
    render(<CounsellorLoginPage />);
    expect(screen.getByText("Counsellor")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign In" })).toBeInTheDocument();
  });

  it("shows toast.error and stays on credentials when signInWithPassword fails", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: { message: "bad creds" } });
    const user = userEvent.setup();
    render(<CounsellorLoginPage />);
    await fillCredentialsAndSubmit(user);
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("bad creds");
    });
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("redirects to set-password when MFA is not enrolled", async () => {
    mockListFactors.mockResolvedValue({ data: { totp: [] } });
    const user = userEvent.setup();
    render(<CounsellorLoginPage />);
    await fillCredentialsAndSubmit(user);
    await waitFor(() => {
      expect(mockToastInfo).toHaveBeenCalledWith(expect.stringContaining("setup"));
      expect(mockPush).toHaveBeenCalledWith("/counsellor/set-password");
    });
  });

  it("redirects to set-password when TOTP exists but is unverified", async () => {
    mockListFactors.mockResolvedValue({
      data: { totp: [{ id: "factor-1", status: "unverified" }] },
    });
    const user = userEvent.setup();
    render(<CounsellorLoginPage />);
    await fillCredentialsAndSubmit(user);
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/counsellor/set-password");
    });
  });

  it("signs out and shows error if MFA challenge fails", async () => {
    mockChallenge.mockResolvedValue({ data: null, error: { message: "rate limited" } });
    const user = userEvent.setup();
    render(<CounsellorLoginPage />);
    await fillCredentialsAndSubmit(user);
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("rate limited");
      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  it("uses generic message when challenge error has no message", async () => {
    mockChallenge.mockResolvedValue({ data: null, error: {} });
    const user = userEvent.setup();
    render(<CounsellorLoginPage />);
    await fillCredentialsAndSubmit(user);
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Failed to start MFA challenge");
    });
  });

  it("advances to MFA stage when challenge succeeds", async () => {
    const user = userEvent.setup();
    render(<CounsellorLoginPage />);
    await fillCredentialsAndSubmit(user);
    await waitFor(() => {
      expect(screen.getByLabelText("Authenticator code")).toBeInTheDocument();
    });
  });

  it("shows generic toast on signInWithPassword throw", async () => {
    mockSignInWithPassword.mockRejectedValue(new Error("network"));
    const user = userEvent.setup();
    render(<CounsellorLoginPage />);
    await fillCredentialsAndSubmit(user);
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Login failed. Please try again.");
    });
  });
});

describe("CounsellorLoginPage — MFA stage", () => {
  async function advanceToMfaStage() {
    const user = userEvent.setup();
    render(<CounsellorLoginPage />);
    await fillCredentialsAndSubmit(user);
    await waitFor(() => expect(screen.getByLabelText("Authenticator code")).toBeInTheDocument());
    return user;
  }

  it("disables Verify until 6-digit code is entered", async () => {
    await advanceToMfaStage();
    expect(screen.getByRole("button", { name: "Verify" })).toBeDisabled();
  });

  it("verifies code and redirects to /counsellor on success", async () => {
    const user = await advanceToMfaStage();
    await user.type(screen.getByLabelText("Authenticator code"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify" }));
    await waitFor(() => {
      expect(mockVerify).toHaveBeenCalledWith({
        factorId: "factor-1",
        challengeId: "chall-1",
        code: "123456",
      });
      expect(mockToastSuccess).toHaveBeenCalledWith("Welcome back!");
      expect(mockPush).toHaveBeenCalledWith("/counsellor");
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it("shows error and stays when MFA verify fails", async () => {
    mockVerify.mockResolvedValue({ error: { message: "bad code" } });
    const user = await advanceToMfaStage();
    await user.type(screen.getByLabelText("Authenticator code"), "999999");
    await user.click(screen.getByRole("button", { name: "Verify" }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("bad code");
    });
  });

  it("signs out + errors when /me check rejects (not a counsellor)", async () => {
    mockFetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
    const user = await advanceToMfaStage();
    await user.type(screen.getByLabelText("Authenticator code"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify" }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Not authorized as a Counsellor.");
      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  it("shows generic toast when MFA verify throws", async () => {
    mockVerify.mockRejectedValue(new Error("net"));
    const user = await advanceToMfaStage();
    await user.type(screen.getByLabelText("Authenticator code"), "123456");
    await user.click(screen.getByRole("button", { name: "Verify" }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Verification failed. Please try again.");
    });
  });

  it("returns to credentials when Back is clicked", async () => {
    const user = await advanceToMfaStage();
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });
});
