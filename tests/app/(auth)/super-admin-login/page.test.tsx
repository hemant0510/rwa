import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
  }),
}));

import SuperAdminLoginPage from "@/app/(auth)/super-admin-login/page";

describe("SuperAdminLoginPage", () => {
  it("renders email and password fields", () => {
    render(<SuperAdminLoginPage />);

    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('renders a "Sign In" button', () => {
    render(<SuperAdminLoginPage />);

    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("shows validation errors on empty submit", async () => {
    const user = userEvent.setup();
    render(<SuperAdminLoginPage />);

    const submitButton = screen.getByRole("button", { name: /sign in/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/invalid email/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/password must be at least 8 characters/i)).toBeInTheDocument();
    });
  });

  it('does NOT have a "Sign in here" link to regular login', () => {
    render(<SuperAdminLoginPage />);

    const signInLink = screen.queryByRole("link", { name: /sign in here/i });
    expect(signInLink).not.toBeInTheDocument();
  });
});
