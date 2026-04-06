import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetProfile = vi.hoisted(() => vi.fn());
const mockUpdateProfile = vi.hoisted(() => vi.fn());
const mockChangePassword = vi.hoisted(() => vi.fn());
const mockGetPlatformConfig = vi.hoisted(() => vi.fn());
const mockUpdatePlatformConfig = vi.hoisted(() => vi.fn());

vi.mock("@/services/settings", () => ({
  getProfile: (...args: unknown[]) => mockGetProfile(...args),
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
  changePassword: (...args: unknown[]) => mockChangePassword(...args),
  getPlatformConfig: (...args: unknown[]) => mockGetPlatformConfig(...args),
  updatePlatformConfig: (...args: unknown[]) => mockUpdatePlatformConfig(...args),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import SettingsPage from "@/app/sa/settings/page";

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const mockProfile = {
  id: "admin-1",
  name: "Super Admin",
  email: "admin@eden.com",
  createdAt: "2025-01-01T00:00:00.000Z",
  lastLogin: "2026-04-05T10:00:00.000Z",
};

const mockConfigs = [
  { key: "trial_duration_days", value: "30", type: "number", label: "Trial Duration (days)" },
  { key: "support_email", value: "help@eden.com", type: "string", label: "Support Email" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <SettingsPage />
    </QueryClientProvider>,
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockGetProfile.mockResolvedValue(mockProfile);
  mockGetPlatformConfig.mockResolvedValue(mockConfigs);
});

// ═══════════════════════════════════════════════════════════════════════════
// Page-level
// ═══════════════════════════════════════════════════════════════════════════

describe("SettingsPage", () => {
  it("renders page header", () => {
    renderPage();
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(
      screen.getByText("Manage your account profile, security, and platform configuration"),
    ).toBeInTheDocument();
  });

  it("renders Payment Setup card with link to /sa/settings/payments", () => {
    renderPage();
    expect(screen.getByText("Payment Setup")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Payment Setup/i });
    expect(link).toHaveAttribute("href", "/sa/settings/payments");
  });

  it("renders all 3 tabs", () => {
    renderPage();
    expect(screen.getByRole("tab", { name: /Profile/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Security/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Platform/i })).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Profile Tab (default active)
// ═══════════════════════════════════════════════════════════════════════════

describe("ProfileTab", () => {
  it("shows loading skeleton while fetching", () => {
    mockGetProfile.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.queryByLabelText("Display Name")).not.toBeInTheDocument();
  });

  it("shows profile form after data loads", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText("Display Name")).toBeInTheDocument();
    });
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Super Admin")).toBeInTheDocument();
  });

  it("shows disabled email field with current email", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByDisplayValue("admin@eden.com")).toBeInTheDocument());
    expect(screen.getByDisplayValue("admin@eden.com")).toBeDisabled();
  });

  it("shows account created date", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Account created/)).toBeInTheDocument();
    });
  });

  it("shows last login date", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Last login/)).toBeInTheDocument();
    });
  });

  it("hides last login when null", async () => {
    mockGetProfile.mockResolvedValue({ ...mockProfile, lastLogin: null });
    renderPage();
    await waitFor(() => expect(screen.getByDisplayValue("Super Admin")).toBeInTheDocument());
    expect(screen.queryByText(/Last login/)).not.toBeInTheDocument();
  });

  it("enables Save when name is changed", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByDisplayValue("Super Admin")).toBeInTheDocument());
    const nameInput = screen.getByLabelText("Display Name");
    await user.clear(nameInput);
    await user.type(nameInput, "New Admin");
    expect(screen.getByRole("button", { name: /Save Changes/i })).toBeEnabled();
  });

  it("calls updateProfile on submit and shows success toast", async () => {
    mockUpdateProfile.mockResolvedValue({ ...mockProfile, name: "New Admin Name" });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByDisplayValue("Super Admin")).toBeInTheDocument());
    const nameInput = screen.getByLabelText("Display Name");
    await user.clear(nameInput);
    await user.type(nameInput, "New Admin Name");
    // Wait for button to become enabled (isDirty)
    const saveBtn = screen.getByRole("button", { name: /Save Changes/i });
    await waitFor(() => expect(saveBtn).toBeEnabled());
    await user.click(saveBtn);
    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Profile updated");
    });
  });

  it("shows 'Saving...' text while profile is submitting", async () => {
    let resolveUpdate!: (v: unknown) => void;
    mockUpdateProfile.mockReturnValue(
      new Promise((r) => {
        resolveUpdate = r;
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByDisplayValue("Super Admin")).toBeInTheDocument());
    const nameInput = screen.getByLabelText("Display Name");
    await user.clear(nameInput);
    await user.type(nameInput, "Changed Name");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Save Changes/i })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: /Save Changes/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Saving/i })).toBeInTheDocument();
    });
    resolveUpdate({ ...mockProfile, name: "Changed Name" });
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it("shows error toast when updateProfile fails", async () => {
    mockUpdateProfile.mockRejectedValue(new Error("Server error"));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByDisplayValue("Super Admin")).toBeInTheDocument());
    const nameInput = screen.getByLabelText("Display Name");
    await user.clear(nameInput);
    await user.type(nameInput, "New Admin Name");
    const saveBtn = screen.getByRole("button", { name: /Save Changes/i });
    await waitFor(() => expect(saveBtn).toBeEnabled());
    await user.click(saveBtn);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Server error");
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Security Tab
// ═══════════════════════════════════════════════════════════════════════════

describe("SecurityTab", () => {
  async function switchToSecurity() {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("tab", { name: /Security/i }));
    return user;
  }

  it("shows password change form", async () => {
    await switchToSecurity();
    expect(screen.getByLabelText("Current Password")).toBeInTheDocument();
    expect(screen.getByLabelText("New Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm New Password")).toBeInTheDocument();
  });

  it("calls changePassword on submit", async () => {
    mockChangePassword.mockResolvedValue({});
    const user = await switchToSecurity();
    await user.type(screen.getByLabelText("Current Password"), "OldPass123!");
    await user.type(screen.getByLabelText("New Password"), "NewPass456!");
    await user.type(screen.getByLabelText("Confirm New Password"), "NewPass456!");
    await user.click(screen.getByRole("button", { name: /Change Password/i }));
    await waitFor(() => {
      expect(mockChangePassword).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Password changed successfully");
    });
  });

  it("shows error toast when changePassword fails", async () => {
    mockChangePassword.mockRejectedValue(new Error("Wrong password"));
    const user = await switchToSecurity();
    await user.type(screen.getByLabelText("Current Password"), "OldPass123!");
    await user.type(screen.getByLabelText("New Password"), "NewPass456!");
    await user.type(screen.getByLabelText("Confirm New Password"), "NewPass456!");
    await user.click(screen.getByRole("button", { name: /Change Password/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Wrong password");
    });
  });

  it("shows validation errors when submitting empty password form", async () => {
    const user = await switchToSecurity();
    await user.click(screen.getByRole("button", { name: /Change Password/i }));
    await waitFor(() => {
      expect(screen.getByText("Current password is required")).toBeInTheDocument();
    });
  });

  it("shows validation error for short new password", async () => {
    const user = await switchToSecurity();
    await user.type(screen.getByLabelText("Current Password"), "OldPass123!");
    await user.type(screen.getByLabelText("New Password"), "short");
    await user.type(screen.getByLabelText("Confirm New Password"), "short");
    await user.click(screen.getByRole("button", { name: /Change Password/i }));
    await waitFor(() => {
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    });
  });

  it("shows validation error for password mismatch", async () => {
    const user = await switchToSecurity();
    await user.type(screen.getByLabelText("Current Password"), "OldPass123!");
    await user.type(screen.getByLabelText("New Password"), "NewPass456!");
    await user.type(screen.getByLabelText("Confirm New Password"), "Different789!");
    await user.click(screen.getByRole("button", { name: /Change Password/i }));
    await waitFor(() => {
      expect(screen.getByText(/do not match/i)).toBeInTheDocument();
    });
  });

  it("shows 'Updating...' text while submitting", async () => {
    let resolveChange!: (v: unknown) => void;
    mockChangePassword.mockReturnValue(
      new Promise((r) => {
        resolveChange = r;
      }),
    );
    const user = await switchToSecurity();
    await user.type(screen.getByLabelText("Current Password"), "OldPass123!");
    await user.type(screen.getByLabelText("New Password"), "NewPass456!");
    await user.type(screen.getByLabelText("Confirm New Password"), "NewPass456!");
    await user.click(screen.getByRole("button", { name: /Change Password/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Updating/i })).toBeInTheDocument();
    });
    resolveChange({});
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Platform Config Tab
// ═══════════════════════════════════════════════════════════════════════════

describe("PlatformConfigTab", () => {
  async function switchToPlatform() {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("tab", { name: /Platform/i }));
    return user;
  }

  it("shows loading skeleton while fetching configs", async () => {
    mockGetPlatformConfig.mockReturnValue(new Promise(() => {}));
    await switchToPlatform();
    // No config fields visible yet
    expect(screen.queryByLabelText("Trial Duration (days)")).not.toBeInTheDocument();
  });

  it("shows number config fields after load", async () => {
    await switchToPlatform();
    await waitFor(() => {
      expect(screen.getByLabelText("Trial Duration (days)")).toBeInTheDocument();
    });
  });

  it("shows string config fields after load", async () => {
    await switchToPlatform();
    await waitFor(() => {
      expect(screen.getByLabelText("Support Email")).toBeInTheDocument();
    });
  });

  it("calls updatePlatformConfig on submit and shows success toast", async () => {
    mockUpdatePlatformConfig.mockResolvedValue(mockConfigs);
    const user = await switchToPlatform();
    // Wait for form fields to render and reset to apply
    await waitFor(() => expect(screen.getByLabelText("Support Email")).toBeInTheDocument());
    await waitFor(() =>
      expect((screen.getByLabelText("Support Email") as HTMLInputElement).value).toBe(
        "help@eden.com",
      ),
    );

    const emailField = screen.getByLabelText("Support Email");
    await user.clear(emailField);
    await user.type(emailField, "new@eden.com");
    const saveBtn = screen.getByRole("button", { name: /Save Settings/i });
    await waitFor(() => expect(saveBtn).toBeEnabled());
    await user.click(saveBtn);
    await waitFor(() => {
      expect(mockUpdatePlatformConfig).toHaveBeenCalled();
      expect(toast.success).toHaveBeenCalledWith("Platform settings saved");
    });
  });

  it("shows error toast when updatePlatformConfig fails", async () => {
    mockUpdatePlatformConfig.mockRejectedValue(new Error("Config error"));
    const user = await switchToPlatform();
    await waitFor(() => expect(screen.getByLabelText("Support Email")).toBeInTheDocument());
    await waitFor(() =>
      expect((screen.getByLabelText("Support Email") as HTMLInputElement).value).toBe(
        "help@eden.com",
      ),
    );

    const emailField = screen.getByLabelText("Support Email");
    await user.clear(emailField);
    await user.type(emailField, "new@eden.com");
    const saveBtn = screen.getByRole("button", { name: /Save Settings/i });
    await waitFor(() => expect(saveBtn).toBeEnabled());
    await user.click(saveBtn);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Config error");
    });
  });

  it("handles empty config arrays", async () => {
    mockGetPlatformConfig.mockResolvedValue([]);
    await switchToPlatform();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Save Settings/i })).toBeInTheDocument();
    });
  });

  it("shows 'Saving...' text while submitting", async () => {
    let resolveUpdate!: (v: unknown) => void;
    mockUpdatePlatformConfig.mockReturnValue(
      new Promise((r) => {
        resolveUpdate = r;
      }),
    );
    const user = await switchToPlatform();
    await waitFor(() => expect(screen.getByLabelText("Support Email")).toBeInTheDocument());
    await waitFor(() =>
      expect((screen.getByLabelText("Support Email") as HTMLInputElement).value).toBe(
        "help@eden.com",
      ),
    );
    const emailField = screen.getByLabelText("Support Email");
    await user.clear(emailField);
    await user.type(emailField, "new@eden.com");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Save Settings/i })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: /Save Settings/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Saving/i })).toBeInTheDocument();
    });
    resolveUpdate(mockConfigs);
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it("shows validation error for invalid number field", async () => {
    const user = await switchToPlatform();
    await waitFor(() => expect(screen.getByLabelText("Trial Duration (days)")).toBeInTheDocument());
    await waitFor(() =>
      expect((screen.getByLabelText("Trial Duration (days)") as HTMLInputElement).value).toBe("30"),
    );
    // Clear the number field to make it NaN / empty which fails .int().positive()
    const trialField = screen.getByLabelText("Trial Duration (days)") as HTMLInputElement;
    await user.clear(trialField);
    // Change email to make form dirty
    const emailField = screen.getByLabelText("Support Email");
    await user.clear(emailField);
    await user.type(emailField, "bad-email");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Save Settings/i })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: /Save Settings/i }));
    await waitFor(() => {
      const errors = document.querySelectorAll(".text-destructive");
      expect(errors.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows validation error for invalid email field", async () => {
    const user = await switchToPlatform();
    await waitFor(() => expect(screen.getByLabelText("Support Email")).toBeInTheDocument());
    await waitFor(() =>
      expect((screen.getByLabelText("Support Email") as HTMLInputElement).value).toBe(
        "help@eden.com",
      ),
    );
    const emailField = screen.getByLabelText("Support Email");
    await user.clear(emailField);
    await user.type(emailField, "notanemail");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Save Settings/i })).toBeEnabled(),
    );
    await user.click(screen.getByRole("button", { name: /Save Settings/i }));
    await waitFor(() => {
      const errors = document.querySelectorAll(".text-destructive");
      expect(errors.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders sections for number and string fields separately", async () => {
    await switchToPlatform();
    await waitFor(() => expect(screen.getByLabelText("Trial Duration (days)")).toBeInTheDocument());
    expect(screen.getByText("Limits & Timeouts")).toBeInTheDocument();
    expect(screen.getByText("Support Contact")).toBeInTheDocument();
  });
});
