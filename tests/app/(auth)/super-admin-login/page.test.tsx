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

import SuperAdminLoginPage from "@/app/(auth)/super-admin-login/page";

describe("SuperAdminLoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders email and password fields", () => {
    render(<SuperAdminLoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('renders a "Sign In" button', () => {
    render(<SuperAdminLoginPage />);
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("renders Super Admin title", () => {
    render(<SuperAdminLoginPage />);
    expect(screen.getByText("Super Admin")).toBeInTheDocument();
  });

  it("shows validation errors on empty submit", async () => {
    const user = userEvent.setup();
    render(<SuperAdminLoginPage />);

    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
    });
  });

  it("handles successful super admin login", async () => {
    mockSignIn.mockResolvedValue({ error: null });
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ role: "SUPER_ADMIN" }),
    });

    const user = userEvent.setup();
    render(<SuperAdminLoginPage />);

    await user.type(screen.getByLabelText(/email/i), "admin@rwaconnect.in");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith("Login successful!");
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith("/sa/dashboard");
    });
  });

  it("shows error for non-super-admin user", async () => {
    mockSignIn.mockResolvedValue({ error: null });
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ role: "RWA_ADMIN" }),
    });

    const user = userEvent.setup();
    render(<SuperAdminLoginPage />);

    await user.type(screen.getByLabelText(/email/i), "admin@test.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Not authorized as Super Admin.");
    });

    await waitFor(() => {
      expect(mockSignOut).toHaveBeenCalled();
    });
  });

  it("shows error on auth failure", async () => {
    mockSignIn.mockResolvedValue({ error: { message: "Invalid login" } });

    const user = userEvent.setup();
    render(<SuperAdminLoginPage />);

    await user.type(screen.getByLabelText(/email/i), "admin@test.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Invalid login");
    });
  });

  it("handles fetch error (not authorized)", async () => {
    mockSignIn.mockResolvedValue({ error: null });
    mockFetch.mockResolvedValue({ ok: false });

    const user = userEvent.setup();
    render(<SuperAdminLoginPage />);

    await user.type(screen.getByLabelText(/email/i), "admin@test.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Not authorized as Super Admin.");
    });
  });

  it("handles network error gracefully", async () => {
    mockSignIn.mockRejectedValue(new Error("Network error"));

    const user = userEvent.setup();
    render(<SuperAdminLoginPage />);

    await user.type(screen.getByLabelText(/email/i), "admin@test.com");
    await user.type(screen.getByLabelText(/password/i), "password123");
    await user.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Invalid credentials");
    });
  });
});
