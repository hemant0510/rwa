import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

const { mockPush, mockRefresh, mockToast, mockSignIn, mockSignOut, mockFetch } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRefresh: vi.fn(),
  mockToast: { success: vi.fn(), error: vi.fn() },
  mockSignIn: vi.fn(),
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
    auth: { signInWithPassword: mockSignIn, signOut: mockSignOut },
  }),
}));

global.fetch = mockFetch;

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
    mockSignIn.mockResolvedValue({ error: null });
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ redirectTo: "/admin/dashboard", emailVerified: true }),
    });

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
      });
    });

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith("Login successful!");
    });
  });

  it("shows error toast on auth error", async () => {
    mockSignIn.mockResolvedValue({ error: { message: "Invalid credentials" } });

    const user = userEvent.setup();
    render(<LoginPage />);

    await user.type(screen.getByLabelText(/email/i), "test@example.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Invalid credentials");
    });
  });

  it("redirects to check-email when email not verified", async () => {
    mockSignIn.mockResolvedValue({ error: null });
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ redirectTo: null, emailVerified: false, email: "test@example.com" }),
    });

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
    mockSignIn.mockResolvedValue({ error: null });
    mockFetch.mockResolvedValue({ ok: false });

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
    mockSignIn.mockRejectedValue(new Error("Network error"));

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
