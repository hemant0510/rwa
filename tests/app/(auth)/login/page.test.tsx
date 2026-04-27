import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockPush, mockRefresh, mockToast, mockSignOut, mockFetch } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRefresh: vi.fn(),
  mockToast: { success: vi.fn(), error: vi.fn() },
  mockSignOut: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

vi.mock("sonner", () => ({
  toast: mockToast,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signOut: mockSignOut },
  }),
}));

global.fetch = mockFetch;

// Helper to build fetch mock responses
function loginOk() {
  return { ok: true, status: 200, json: () => Promise.resolve({ success: true }) };
}
function loginError(message: string, status = 401) {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error: { code: "INVALID_CREDENTIALS", message } }),
  };
}
function loginRateLimited() {
  return {
    ok: false,
    status: 429,
    json: () =>
      Promise.resolve({
        error: {
          code: "RATE_LIMIT_EXCEEDED",
          message: "Too many login attempts. Please wait 15 minutes before trying again.",
        },
      }),
  };
}
function meOk(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({ redirectTo: "/admin/dashboard", emailVerified: true, ...overrides }),
  };
}
function meNotFound() {
  return { ok: false, status: 404, json: () => Promise.resolve({ error: "Not found" }) };
}

import LoginPage from "@/app/(auth)/login/page";

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders email and password fields", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('renders a "Sign In" button', () => {
    render(<LoginPage />);
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows validation errors on empty submit", async () => {
    const user = userEvent.setup();
    render(<LoginPage />);

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    });
  });

  it('does NOT have a "Super Admin" link', () => {
    render(<LoginPage />);
    expect(screen.queryByRole("link", { name: /super admin/i })).not.toBeInTheDocument();
  });

  it("renders register society link", () => {
    render(<LoginPage />);
    expect(screen.getByRole("link", { name: /register your society/i })).toBeInTheDocument();
  });

  it("handles successful login", async () => {
    // First fetch = /api/v1/auth/login proxy, second = /api/v1/auth/me
    mockFetch.mockResolvedValueOnce(loginOk()).mockResolvedValueOnce(meOk());

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith("Login successful!");
    });
  });

  it("shows error toast on auth error (invalid credentials)", async () => {
    mockFetch.mockResolvedValueOnce(loginError("Invalid credentials"));

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Invalid credentials");
    });
  });

  it("shows rate limit toast on 429", async () => {
    mockFetch.mockResolvedValueOnce(loginRateLimited());

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(expect.stringMatching(/too many/i));
    });
  });

  it("falls back to default 429 message when error.message is missing", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error: { code: "RATE_LIMIT_EXCEEDED" } }),
    });

    const user = userEvent.setup();
    render(<LoginPage />);
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Too many attempts. Please try again later.");
    });
  });

  it("falls back to default credentials message when error.message is missing", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: () => Promise.resolve({}),
    });

    const user = userEvent.setup();
    render(<LoginPage />);
    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Invalid credentials.");
    });
  });

  it("uses form email when /me does not return email on unverified flow", async () => {
    mockFetch
      .mockResolvedValueOnce(loginOk())
      .mockResolvedValueOnce(meOk({ redirectTo: null, emailVerified: false }));

    const user = userEvent.setup();
    render(<LoginPage />);
    await user.type(screen.getByLabelText(/email/i), "fallback@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.stringContaining("email=fallback%40example.com"),
      );
    });
  });

  it("redirects to check-email when email not verified", async () => {
    mockFetch
      .mockResolvedValueOnce(loginOk())
      .mockResolvedValueOnce(
        meOk({ redirectTo: null, emailVerified: false, email: "test@example.com" }),
      );

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Please verify your email before signing in.");
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(expect.stringContaining("/check-email"));
    });
  });

  it("handles account not found", async () => {
    mockFetch.mockResolvedValueOnce(loginOk()).mockResolvedValueOnce(meNotFound());

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Account not found. Please contact your admin.");
    });
  });

  it("handles unexpected errors", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Login failed. Please try again.");
    });
  });
});
