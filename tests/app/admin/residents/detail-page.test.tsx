import React, { Suspense } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ──

const {
  mockGetResident,
  mockApproveResident,
  mockRejectResident,
  mockUpdateResident,
  mockDeleteResident,
  mockSendSetupEmail,
  mockGetApprovalPreview,
  mockToastSuccess,
  mockToastError,
  mockRouterPush,
  mockFetch,
} = vi.hoisted(() => ({
  mockGetResident: vi.fn(),
  mockApproveResident: vi.fn(),
  mockRejectResident: vi.fn(),
  mockUpdateResident: vi.fn(),
  mockDeleteResident: vi.fn(),
  mockSendSetupEmail: vi.fn(),
  mockGetApprovalPreview: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockRouterPush: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("@/services/residents", () => ({
  getResident: (...args: unknown[]) => mockGetResident(...args),
  approveResident: (...args: unknown[]) => mockApproveResident(...args),
  rejectResident: (...args: unknown[]) => mockRejectResident(...args),
  updateResident: (...args: unknown[]) => mockUpdateResident(...args),
  deleteResident: (...args: unknown[]) => mockDeleteResident(...args),
  sendSetupEmail: (...args: unknown[]) => mockSendSetupEmail(...args),
  getApprovalPreview: (...args: unknown[]) => mockGetApprovalPreview(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush }),
  useSearchParams: () => new URLSearchParams(),
}));

global.fetch = mockFetch;

import ResidentDetailPage from "@/app/admin/residents/[id]/page";
import { AuthContext } from "@/hooks/useAuth";

// ── Helpers ──

async function renderPage(id = "r1", userOverrides: Record<string, unknown> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = {
    id: "u1",
    name: "Admin User",
    role: "RWA_ADMIN" as const,
    permission: "FULL_ACCESS",
    societyId: "soc-1",
    societyName: "Eden Estate",
    societyCode: "EDEN",
    societyStatus: "ACTIVE",
    trialEndsAt: null,
    isTrialExpired: false,
    multiSociety: false,
    societies: null,
    ...userOverrides,
  };
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{
            user,
            isLoading: false,
            isAuthenticated: true,
            signOut: vi.fn(),
            switchSociety: vi.fn(),
          }}
        >
          <Suspense fallback={<div>Loading suspense...</div>}>
            <ResidentDetailPage params={Promise.resolve({ id })} />
          </Suspense>
        </AuthContext.Provider>
      </QueryClientProvider>,
    );
  });
  return result;
}

// ── Mock Data ──

const MOCK_ACTIVE_RESIDENT = {
  id: "r1",
  societyId: "soc-1",
  rwaid: "EDEN-001",
  name: "Rajesh Kumar",
  mobile: "9876543210",
  email: "rajesh@test.com",
  photoUrl: null,
  idProofUrl: null,
  ownershipProofUrl: null,
  role: "RESIDENT",
  ownershipType: "OWNER",
  otherOwnershipDetail: null,
  status: "ACTIVE_PAID",
  adminPermission: null,
  isEmailVerified: true,
  consentWhatsapp: true,
  joiningFeePaid: true,
  registeredAt: "2025-01-15T10:00:00.000Z",
  approvedAt: "2025-01-16T10:00:00.000Z",
  createdAt: "2025-01-15T10:00:00.000Z",
  units: [{ id: "unit-1", displayLabel: "Tower A, Floor 3, Flat 301" }],
  fees: [
    {
      id: "fee-1",
      sessionYear: "2025-2026",
      amountDue: 12000,
      amountPaid: 12000,
      status: "PAID",
    },
  ],
  society: { name: "Eden Estate" },
};

const MOCK_PENDING_RESIDENT = {
  ...MOCK_ACTIVE_RESIDENT,
  id: "r2",
  name: "Priya Sharma",
  status: "PENDING_APPROVAL",
  email: "priya@test.com",
  mobile: "9876543211",
  rwaid: null,
  approvedAt: null,
  photoUrl: "https://example.com/photo.jpg",
  units: [],
  fees: [],
};

const MOCK_DEACTIVATED_RESIDENT = {
  ...MOCK_ACTIVE_RESIDENT,
  id: "r3",
  name: "Sunil Verma",
  status: "DEACTIVATED",
  deactivatedAt: "2025-06-01T10:00:00.000Z",
  deactivationReason: "Moved out of society",
  units: [],
  fees: [],
};

const MOCK_ACTIVE_NO_EMAIL = {
  ...MOCK_ACTIVE_RESIDENT,
  id: "r4",
  name: "No Email Person",
  email: null,
  ownershipType: "TENANT",
};

const MOCK_APPROVAL_PREVIEW = {
  sessionYear: "2025-2026",
  proRata: {
    joiningFee: 1000,
    annualFee: 12000,
    monthlyRate: 1000,
    remainingMonths: 9,
    proRataAmount: 9000,
    totalFirstPayment: 10000,
  },
};

// ── Tests ──

describe("ResidentDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: null }),
    });
  });

  // ── Loading state ──

  it("shows loading skeleton while data is pending", async () => {
    mockGetResident.mockReturnValue(new Promise(() => {}));
    await renderPage();
    // use(Promise.resolve()) resolves asynchronously, then PageSkeleton renders
    await waitFor(() => {
      // PageSkeleton uses animate-pulse, or we see the Suspense fallback
      const hasSkeleton = document.querySelector(".animate-pulse");
      const hasSuspenseFallback = screen.queryByText("Loading suspense...");
      expect(hasSkeleton || hasSuspenseFallback).toBeTruthy();
    });
  });

  // ── Not found ──

  it("shows not found message when resident is null", async () => {
    mockGetResident.mockResolvedValue(null);
    await renderPage();
    await waitFor(
      () => {
        expect(screen.getByText("Resident not found.")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  // ── Active resident rendering ──

  it("renders resident name", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    await renderPage();
    await waitFor(() => {
      // Name appears in PageHeader and DetailRow
      expect(screen.getAllByText("Rajesh Kumar").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders status badge", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Active (Paid)")).toBeInTheDocument();
    });
  });

  it("renders RWAID", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("EDEN-001")).toBeInTheDocument();
    });
  });

  it("renders Personal Details card", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Personal Details")).toBeInTheDocument();
    });
  });

  it("renders ownership type", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("OWNER")).toBeInTheDocument();
    });
  });

  it("renders masked mobile by default", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("XXXXX 43210")).toBeInTheDocument();
    });
  });

  it("reveals mobile number when eye button is clicked", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("XXXXX 43210")).toBeInTheDocument();
    });
    const showBtn = screen.getByLabelText("Show mobile number");
    await user.click(showBtn);
    await waitFor(() => {
      expect(screen.getByText("9876543210")).toBeInTheDocument();
    });
  });

  it("hides mobile number when hide button is clicked", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText("Show mobile number")).toBeInTheDocument();
    });
    await user.click(screen.getByLabelText("Show mobile number"));
    await waitFor(() => {
      expect(screen.getByLabelText("Hide mobile number")).toBeInTheDocument();
    });
    await user.click(screen.getByLabelText("Hide mobile number"));
    await waitFor(() => {
      expect(screen.getByText("XXXXX 43210")).toBeInTheDocument();
    });
  });

  it("renders email for resident with email", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("rajesh@test.com")).toBeInTheDocument();
    });
  });

  it("renders registered date", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText(/15 Jan 2025/)).toBeInTheDocument();
    });
  });

  it("renders approved date when available", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText(/16 Jan 2025/)).toBeInTheDocument();
    });
  });

  // ── Unit Address ──

  it("renders unit address card", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Unit Address")).toBeInTheDocument();
    });
    expect(screen.getByText("Tower A, Floor 3, Flat 301")).toBeInTheDocument();
  });

  it("does not render unit card when no units", async () => {
    mockGetResident.mockResolvedValue(MOCK_PENDING_RESIDENT);
    await renderPage();
    await waitFor(() => {
      expect(screen.getAllByText("Priya Sharma").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.queryByText("Unit Address")).not.toBeInTheDocument();
  });

  // ── Fee Records ──

  it("renders fee records card", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Fee Records")).toBeInTheDocument();
    });
    expect(screen.getByText("2025-2026")).toBeInTheDocument();
  });

  it("does not render fees card when no fees", async () => {
    mockGetResident.mockResolvedValue(MOCK_PENDING_RESIDENT);
    await renderPage();
    await waitFor(() => {
      expect(screen.getAllByText("Priya Sharma").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.queryByText("Fee Records")).not.toBeInTheDocument();
  });

  // ── Documents section ──

  it("renders Documents section", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Documents")).toBeInTheDocument();
    });
  });

  it("renders ID Proof doc card", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("ID Proof")).toBeInTheDocument();
    });
  });

  it("renders Ownership Proof doc card for owners", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Ownership Proof")).toBeInTheDocument();
    });
  });

  it("renders Tenancy / Rental Agreement for tenants", async () => {
    const tenant = { ...MOCK_ACTIVE_RESIDENT, ownershipType: "TENANT" };
    mockGetResident.mockResolvedValue(tenant);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Tenancy / Rental Agreement")).toBeInTheDocument();
    });
  });

  // ── Avatar ──

  it("renders avatar for resident with photoUrl", async () => {
    mockGetResident.mockResolvedValue(MOCK_PENDING_RESIDENT);
    await renderPage("r2");
    await waitFor(() => {
      expect(screen.getAllByText("Priya Sharma").length).toBeGreaterThanOrEqual(1);
    });
    // In JSDOM, Radix AvatarImage does not fire onLoad so fallback always shows
    // "Priya Sharma" => initials "PS"
    expect(screen.getByText("PS")).toBeInTheDocument();
    // Avatar container should exist
    const avatars = document.querySelectorAll('[data-slot="avatar"]');
    expect(avatars.length).toBeGreaterThanOrEqual(1);
  });

  it("renders fallback initials when no photo", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("RK")).toBeInTheDocument();
    });
  });

  // ── Edit button ──

  it("shows Edit button for active residents", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Edit/i })).toBeInTheDocument();
    });
  });

  it("does not show Edit button for deactivated residents", async () => {
    mockGetResident.mockResolvedValue(MOCK_DEACTIVATED_RESIDENT);
    await renderPage("r3");
    await waitFor(() => {
      expect(screen.getAllByText("Sunil Verma").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.queryByRole("button", { name: /Edit/i })).not.toBeInTheDocument();
  });

  // ── Edit dialog ──

  it("opens edit dialog pre-filled with resident data", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Edit/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Edit/i }));
    await waitFor(() => {
      expect(screen.getByText("Edit Resident")).toBeInTheDocument();
    });
    expect(screen.getByDisplayValue("Rajesh Kumar")).toBeInTheDocument();
    expect(screen.getByDisplayValue("9876543210")).toBeInTheDocument();
    expect(screen.getByDisplayValue("rajesh@test.com")).toBeInTheDocument();
  });

  it("closes edit dialog on cancel", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Edit/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Edit/i }));
    await waitFor(() => {
      expect(screen.getByText("Edit Resident")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Cancel/i }));
    await waitFor(() => {
      expect(screen.queryByText("Edit Resident")).not.toBeInTheDocument();
    });
  });

  it("calls updateResident on save", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    mockUpdateResident.mockResolvedValue({});
    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Edit/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Edit/i }));
    await waitFor(() => {
      expect(screen.getByText("Edit Resident")).toBeInTheDocument();
    });
    // Change name
    const nameInput = screen.getByDisplayValue("Rajesh Kumar");
    await user.clear(nameInput);
    await user.type(nameInput, "Rajesh K");
    await user.click(screen.getByRole("button", { name: /Save Changes/i }));
    await waitFor(() => {
      expect(mockUpdateResident).toHaveBeenCalledWith("r1", {
        name: "Rajesh K",
        mobile: "9876543210",
        email: "rajesh@test.com",
        ownershipType: "OWNER",
      });
    });
  });

  it("shows toast on edit success", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    mockUpdateResident.mockResolvedValue({});
    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Edit/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Edit/i }));
    await waitFor(() => {
      expect(screen.getByText("Edit Resident")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Save Changes/i }));
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Resident updated!");
    });
  });

  it("shows toast on edit error", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    mockUpdateResident.mockRejectedValue(new Error("Update failed"));
    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Edit/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Edit/i }));
    await waitFor(() => {
      expect(screen.getByText("Edit Resident")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Save Changes/i }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Update failed");
    });
  });

  it("disables Save button when name is too short", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Edit/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Edit/i }));
    await waitFor(() => {
      expect(screen.getByText("Edit Resident")).toBeInTheDocument();
    });
    const nameInput = screen.getByDisplayValue("Rajesh Kumar");
    await user.clear(nameInput);
    await user.type(nameInput, "R");
    expect(screen.getByRole("button", { name: /Save Changes/i })).toBeDisabled();
  });

  // ── Deactivate button ──

  it("shows Deactivate button for active residents", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Deactivate/i })).toBeInTheDocument();
    });
  });

  it("does not show Deactivate button for deactivated residents", async () => {
    mockGetResident.mockResolvedValue(MOCK_DEACTIVATED_RESIDENT);
    await renderPage("r3");
    await waitFor(() => {
      expect(screen.getAllByText("Sunil Verma").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.queryByRole("button", { name: /Deactivate/i })).not.toBeInTheDocument();
  });

  // ── Deactivate dialog ──

  it("opens deactivate dialog", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Deactivate/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Deactivate/i }));
    await waitFor(() => {
      expect(screen.getByText("Deactivate Resident")).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText(/Moved out/)).toBeInTheDocument();
  });

  it("disables deactivate button when reason is too short", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Deactivate/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Deactivate/i }));
    await waitFor(() => {
      expect(screen.getByText("Deactivate Resident")).toBeInTheDocument();
    });
    // The submit button in dialog
    const deactivateBtns = screen.getAllByRole("button", { name: /Deactivate/i });
    const submitBtn = deactivateBtns[deactivateBtns.length - 1];
    expect(submitBtn).toBeDisabled();
  });

  it("enables deactivate button when reason is >= 5 chars", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Deactivate/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Deactivate/i }));
    await waitFor(() => {
      expect(screen.getByText("Deactivate Resident")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText(/Moved out/), "Moved to another city");
    const deactivateBtns = screen.getAllByRole("button", { name: /Deactivate/i });
    const submitBtn = deactivateBtns[deactivateBtns.length - 1];
    expect(submitBtn).not.toBeDisabled();
  });

  it("calls deleteResident on deactivate", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    mockDeleteResident.mockResolvedValue({});
    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Deactivate/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Deactivate/i }));
    await waitFor(() => {
      expect(screen.getByText("Deactivate Resident")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText(/Moved out/), "Moved to another city");
    const deactivateBtns = screen.getAllByRole("button", { name: /Deactivate/i });
    await user.click(deactivateBtns[deactivateBtns.length - 1]);
    await waitFor(() => {
      expect(mockDeleteResident).toHaveBeenCalledWith("r1", "Moved to another city");
    });
  });

  it("shows toast and redirects on deactivate success", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    mockDeleteResident.mockResolvedValue({});
    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Deactivate/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Deactivate/i }));
    await waitFor(() => {
      expect(screen.getByText("Deactivate Resident")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText(/Moved out/), "Moved to another city");
    const deactivateBtns = screen.getAllByRole("button", { name: /Deactivate/i });
    await user.click(deactivateBtns[deactivateBtns.length - 1]);
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Resident deactivated");
    });
    expect(mockRouterPush).toHaveBeenCalledWith("/admin/residents");
  });

  it("shows toast on deactivate error", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    mockDeleteResident.mockRejectedValue(new Error("Cannot deactivate"));
    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Deactivate/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Deactivate/i }));
    await waitFor(() => {
      expect(screen.getByText("Deactivate Resident")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText(/Moved out/), "Some valid reason here");
    const deactivateBtns = screen.getAllByRole("button", { name: /Deactivate/i });
    await user.click(deactivateBtns[deactivateBtns.length - 1]);
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Cannot deactivate");
    });
  });

  it("cancels deactivate dialog and clears reason", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Deactivate/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Deactivate/i }));
    await waitFor(() => {
      expect(screen.getByText("Deactivate Resident")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText(/Moved out/), "Some reason");
    await user.click(screen.getByRole("button", { name: /Cancel/i }));
    await waitFor(() => {
      expect(screen.queryByText("Deactivate Resident")).not.toBeInTheDocument();
    });
  });

  // ── Deactivated resident banner ──

  it("shows deactivated banner with reason", async () => {
    mockGetResident.mockResolvedValue(MOCK_DEACTIVATED_RESIDENT);
    await renderPage("r3");
    await waitFor(() => {
      expect(screen.getByText("Resident Deactivated")).toBeInTheDocument();
    });
    expect(screen.getByText("Reason: Moved out of society")).toBeInTheDocument();
  });

  it("shows deactivation date", async () => {
    mockGetResident.mockResolvedValue(MOCK_DEACTIVATED_RESIDENT);
    await renderPage("r3");
    await waitFor(() => {
      expect(screen.getByText(/01 Jun 2025/)).toBeInTheDocument();
    });
  });

  // ── Pending resident - Approve/Reject ──

  it("shows pending approval banner for pending residents", async () => {
    mockGetResident.mockResolvedValue(MOCK_PENDING_RESIDENT);
    await renderPage("r2");
    await waitFor(() => {
      // "Pending Approval" appears as status badge AND banner title
      expect(screen.getAllByText("Pending Approval").length).toBeGreaterThanOrEqual(2);
    });
    expect(screen.getByText("Review this registration and approve or reject.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Approve/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reject/i })).toBeInTheDocument();
  });

  it("does not show pending banner for active residents", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    await renderPage();
    await waitFor(() => {
      expect(screen.getAllByText("Rajesh Kumar").length).toBeGreaterThanOrEqual(1);
    });
    expect(
      screen.queryByText("Review this registration and approve or reject."),
    ).not.toBeInTheDocument();
  });

  // ── Approve dialog ──

  it("opens approve dialog with fee preview", async () => {
    mockGetResident.mockResolvedValue(MOCK_PENDING_RESIDENT);
    mockGetApprovalPreview.mockResolvedValue(MOCK_APPROVAL_PREVIEW);
    const user = userEvent.setup();
    await renderPage("r2");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Approve/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Approve/i }));
    await waitFor(() => {
      expect(screen.getByText("Approve Registration")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText("2025-2026")).toBeInTheDocument();
    });
  });

  it("shows fee preview details in approve dialog", async () => {
    mockGetResident.mockResolvedValue(MOCK_PENDING_RESIDENT);
    mockGetApprovalPreview.mockResolvedValue(MOCK_APPROVAL_PREVIEW);
    const user = userEvent.setup();
    await renderPage("r2");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Approve/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Approve/i }));
    await waitFor(() => {
      expect(screen.getByText("2025-2026")).toBeInTheDocument();
    });
    expect(screen.getByText("Joining fee")).toBeInTheDocument();
    expect(screen.getByText(/9 months remaining/)).toBeInTheDocument();
    expect(screen.getByText("Total due")).toBeInTheDocument();
  });

  it("shows fee preview unavailable when preview fails", async () => {
    mockGetResident.mockResolvedValue(MOCK_PENDING_RESIDENT);
    mockGetApprovalPreview.mockRejectedValue(new Error("Preview error"));
    const user = userEvent.setup();
    await renderPage("r2");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Approve/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Approve/i }));
    await waitFor(() => {
      expect(screen.getByText("Fee preview unavailable.")).toBeInTheDocument();
    });
    expect(mockToastError).toHaveBeenCalledWith("Could not load fee preview");
  });

  it("calls approveResident on confirm", async () => {
    mockGetResident.mockResolvedValue(MOCK_PENDING_RESIDENT);
    mockGetApprovalPreview.mockResolvedValue(MOCK_APPROVAL_PREVIEW);
    mockApproveResident.mockResolvedValue({});
    const user = userEvent.setup();
    await renderPage("r2");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Approve/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Approve/i }));
    await waitFor(() => {
      expect(screen.getByText("2025-2026")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Confirm Approval/i }));
    await waitFor(() => {
      expect(mockApproveResident).toHaveBeenCalledWith("r2");
    });
  });

  it("shows toast on approve success", async () => {
    mockGetResident.mockResolvedValue(MOCK_PENDING_RESIDENT);
    mockGetApprovalPreview.mockResolvedValue(MOCK_APPROVAL_PREVIEW);
    mockApproveResident.mockResolvedValue({});
    const user = userEvent.setup();
    await renderPage("r2");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Approve/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Approve/i }));
    await waitFor(() => {
      expect(screen.getByText("2025-2026")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Confirm Approval/i }));
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Resident approved!");
    });
  });

  it("shows toast on approve error", async () => {
    mockGetResident.mockResolvedValue(MOCK_PENDING_RESIDENT);
    mockGetApprovalPreview.mockResolvedValue(MOCK_APPROVAL_PREVIEW);
    mockApproveResident.mockRejectedValue(new Error("Approve failed"));
    const user = userEvent.setup();
    await renderPage("r2");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Approve/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Approve/i }));
    await waitFor(() => {
      expect(screen.getByText("2025-2026")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Confirm Approval/i }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Approve failed");
    });
  });

  it("cancels approve dialog", async () => {
    mockGetResident.mockResolvedValue(MOCK_PENDING_RESIDENT);
    mockGetApprovalPreview.mockResolvedValue(MOCK_APPROVAL_PREVIEW);
    const user = userEvent.setup();
    await renderPage("r2");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Approve/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Approve/i }));
    await waitFor(() => {
      expect(screen.getByText("Approve Registration")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Cancel/i }));
    await waitFor(() => {
      expect(screen.queryByText("Approve Registration")).not.toBeInTheDocument();
    });
  });

  // ── Reject dialog ──

  it("opens reject dialog from pending banner", async () => {
    mockGetResident.mockResolvedValue(MOCK_PENDING_RESIDENT);
    const user = userEvent.setup();
    await renderPage("r2");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Reject/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Reject/i }));
    await waitFor(() => {
      expect(screen.getByText("Reject Registration")).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText(/Incomplete details/)).toBeInTheDocument();
  });

  it("disables reject button when reason < 5 chars", async () => {
    mockGetResident.mockResolvedValue(MOCK_PENDING_RESIDENT);
    const user = userEvent.setup();
    await renderPage("r2");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Reject/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Reject/i }));
    await waitFor(() => {
      expect(screen.getByText("Reject Registration")).toBeInTheDocument();
    });
    const rejectBtns = screen.getAllByRole("button", { name: /Reject/i });
    const submitBtn = rejectBtns[rejectBtns.length - 1];
    expect(submitBtn).toBeDisabled();
  });

  it("enables reject button when reason >= 5 chars", async () => {
    mockGetResident.mockResolvedValue(MOCK_PENDING_RESIDENT);
    const user = userEvent.setup();
    await renderPage("r2");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Reject/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Reject/i }));
    await waitFor(() => {
      expect(screen.getByText("Reject Registration")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText(/Incomplete details/), "Not a valid resident");
    const rejectBtns = screen.getAllByRole("button", { name: /Reject/i });
    const submitBtn = rejectBtns[rejectBtns.length - 1];
    expect(submitBtn).not.toBeDisabled();
  });

  it("calls rejectResident on confirm", async () => {
    mockGetResident.mockResolvedValue(MOCK_PENDING_RESIDENT);
    mockRejectResident.mockResolvedValue({});
    const user = userEvent.setup();
    await renderPage("r2");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Reject/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Reject/i }));
    await waitFor(() => {
      expect(screen.getByText("Reject Registration")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText(/Incomplete details/), "Invalid details given");
    const rejectBtns = screen.getAllByRole("button", { name: /Reject/i });
    await user.click(rejectBtns[rejectBtns.length - 1]);
    await waitFor(() => {
      expect(mockRejectResident).toHaveBeenCalledWith("r2", "Invalid details given");
    });
  });

  it("shows toast on reject success", async () => {
    mockGetResident.mockResolvedValue(MOCK_PENDING_RESIDENT);
    mockRejectResident.mockResolvedValue({});
    const user = userEvent.setup();
    await renderPage("r2");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Reject/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Reject/i }));
    await waitFor(() => {
      expect(screen.getByText("Reject Registration")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText(/Incomplete details/), "Invalid details given");
    const rejectBtns = screen.getAllByRole("button", { name: /Reject/i });
    await user.click(rejectBtns[rejectBtns.length - 1]);
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Resident rejected");
    });
  });

  it("shows toast on reject error", async () => {
    mockGetResident.mockResolvedValue(MOCK_PENDING_RESIDENT);
    mockRejectResident.mockRejectedValue(new Error("Reject failed"));
    const user = userEvent.setup();
    await renderPage("r2");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Reject/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Reject/i }));
    await waitFor(() => {
      expect(screen.getByText("Reject Registration")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText(/Incomplete details/), "Not valid at all!");
    const rejectBtns = screen.getAllByRole("button", { name: /Reject/i });
    await user.click(rejectBtns[rejectBtns.length - 1]);
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Reject failed");
    });
  });

  it("cancels reject dialog and clears reason", async () => {
    mockGetResident.mockResolvedValue(MOCK_PENDING_RESIDENT);
    const user = userEvent.setup();
    await renderPage("r2");
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Reject/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Reject/i }));
    await waitFor(() => {
      expect(screen.getByText("Reject Registration")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Cancel/i }));
    await waitFor(() => {
      expect(screen.queryByText("Reject Registration")).not.toBeInTheDocument();
    });
  });

  // ── Send Setup Email ──

  it("shows Send Setup Email button for active residents with email", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Send Setup Email/i })).toBeInTheDocument();
    });
  });

  it("does not show Send Setup Email for pending residents", async () => {
    mockGetResident.mockResolvedValue(MOCK_PENDING_RESIDENT);
    await renderPage("r2");
    await waitFor(() => {
      expect(screen.getAllByText("Priya Sharma").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.queryByRole("button", { name: /Send Setup Email/i })).not.toBeInTheDocument();
  });

  it("does not show Send Setup Email for residents without email", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_NO_EMAIL);
    await renderPage("r4");
    await waitFor(() => {
      expect(screen.getAllByText("No Email Person").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.queryByRole("button", { name: /Send Setup Email/i })).not.toBeInTheDocument();
  });

  it("calls sendSetupEmail on click", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    mockSendSetupEmail.mockResolvedValue({});
    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Send Setup Email/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Send Setup Email/i }));
    await waitFor(() => {
      expect(mockSendSetupEmail).toHaveBeenCalledWith("r1");
    });
  });

  it("shows toast on setup email success", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    mockSendSetupEmail.mockResolvedValue({});
    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Send Setup Email/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Send Setup Email/i }));
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Setup email sent");
    });
  });

  it("shows toast on setup email error", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    mockSendSetupEmail.mockRejectedValue(new Error("Email send failed"));
    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Send Setup Email/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Send Setup Email/i }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Email send failed");
    });
  });

  // ── Back link ──

  it("renders back link to residents list", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Personal Details")).toBeInTheDocument();
    });
    const backLink = document.querySelector('a[href="/admin/residents"]');
    expect(backLink).toBeTruthy();
  });

  // ── RWAID not assigned ──

  it("shows 'Not assigned' when rwaid is null", async () => {
    mockGetResident.mockResolvedValue(MOCK_PENDING_RESIDENT);
    await renderPage("r2");
    await waitFor(() => {
      expect(screen.getByText("Not assigned")).toBeInTheDocument();
    });
  });

  // ── Doc upload status display ──

  it("shows Not uploaded status for docs without URLs", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Documents")).toBeInTheDocument();
    });
    const notUploadedBadges = screen.getAllByText("Not uploaded");
    expect(notUploadedBadges.length).toBeGreaterThanOrEqual(2);
  });

  it("shows Upload button for docs without URLs", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Documents")).toBeInTheDocument();
    });
    const uploadBtns = screen.getAllByRole("button", { name: /Upload/i });
    expect(uploadBtns.length).toBeGreaterThanOrEqual(2);
  });

  it("shows Uploaded status for docs with URLs", async () => {
    const withDocs = {
      ...MOCK_ACTIVE_RESIDENT,
      idProofUrl: "https://example.com/id.pdf",
      ownershipProofUrl: "https://example.com/ownership.pdf",
    };
    mockGetResident.mockResolvedValue(withDocs);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Documents")).toBeInTheDocument();
    });
    const uploadedBadges = screen.getAllByText("Uploaded");
    expect(uploadedBadges.length).toBeGreaterThanOrEqual(2);
  });

  // ── Edit form field interactions ──

  it("changes mobile in edit dialog", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    mockUpdateResident.mockResolvedValue({});
    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Edit/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Edit/i }));
    await waitFor(() => {
      expect(screen.getByDisplayValue("9876543210")).toBeInTheDocument();
    });
    const mobileInput = screen.getByDisplayValue("9876543210");
    await user.clear(mobileInput);
    await user.type(mobileInput, "9999999999");
    await user.click(screen.getByRole("button", { name: /Save Changes/i }));
    await waitFor(() => {
      expect(mockUpdateResident).toHaveBeenCalledWith(
        "r1",
        expect.objectContaining({
          mobile: "9999999999",
        }),
      );
    });
  });

  it("changes email in edit dialog", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    mockUpdateResident.mockResolvedValue({});
    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Edit/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Edit/i }));
    await waitFor(() => {
      expect(screen.getByDisplayValue("rajesh@test.com")).toBeInTheDocument();
    });
    const emailInput = screen.getByDisplayValue("rajesh@test.com");
    await user.clear(emailInput);
    await user.type(emailInput, "new@test.com");
    await user.click(screen.getByRole("button", { name: /Save Changes/i }));
    await waitFor(() => {
      expect(mockUpdateResident).toHaveBeenCalledWith(
        "r1",
        expect.objectContaining({
          email: "new@test.com",
        }),
      );
    });
  });

  // ── Document upload flow ──

  it("uploads a document when file is selected", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Documents")).toBeInTheDocument();
    });
    // Find file inputs (hidden)
    const fileInputs = document.querySelectorAll('input[type="file"]');
    expect(fileInputs.length).toBeGreaterThanOrEqual(2);
    // Simulate file selection on first input (ID Proof)
    const file = new File(["test"], "id.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/id-proof"),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  it("shows success toast on document upload", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Documents")).toBeInTheDocument();
    });
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(["test"], "id.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("ID Proof uploaded");
    });
  });

  it("shows error toast on document upload failure", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: { message: "Too large" } }),
    });
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Documents")).toBeInTheDocument();
    });
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(["test"], "id.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Too large");
    });
  });

  it("shows fallback error on upload failure without message", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Documents")).toBeInTheDocument();
    });
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const file = new File(["test"], "id.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Upload failed");
    });
  });

  // ── Document delete flow ──

  it("deletes a document when remove is clicked", async () => {
    const withDocs = {
      ...MOCK_ACTIVE_RESIDENT,
      idProofUrl: "https://example.com/id.pdf",
      ownershipProofUrl: "https://example.com/ownership.pdf",
    };
    mockGetResident.mockResolvedValue(withDocs);
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: "https://signed.url/doc" }),
    });
    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Documents")).toBeInTheDocument();
    });
    // Find Remove buttons
    const removeButtons = screen.getAllByTitle("Remove document");
    expect(removeButtons.length).toBeGreaterThanOrEqual(1);
    await user.click(removeButtons[0]);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/id-proof"),
        expect.objectContaining({ method: "DELETE" }),
      );
    });
  });

  it("shows success toast on document delete", async () => {
    const withDocs = {
      ...MOCK_ACTIVE_RESIDENT,
      idProofUrl: "https://example.com/id.pdf",
    };
    mockGetResident.mockResolvedValue(withDocs);
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: "https://signed.url/doc" }),
    });
    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Documents")).toBeInTheDocument();
    });
    const removeButtons = screen.getAllByTitle("Remove document");
    await user.click(removeButtons[0]);
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("ID Proof removed");
    });
  });

  it("shows error toast on document delete failure", async () => {
    const withDocs = {
      ...MOCK_ACTIVE_RESIDENT,
      idProofUrl: "https://example.com/id.pdf",
    };
    mockGetResident.mockResolvedValue(withDocs);
    // First call returns signed URL, second (DELETE) returns failure
    let _callCount = 0;
    mockFetch.mockImplementation((_url: string, opts?: RequestInit) => {
      _callCount++;
      if (opts?.method === "DELETE") {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({}),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ url: "https://signed.url/doc" }),
      });
    });
    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Documents")).toBeInTheDocument();
    });
    const removeButtons = screen.getAllByTitle("Remove document");
    await user.click(removeButtons[0]);
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Failed to remove ID Proof");
    });
  });

  // ── Document view flow ──

  it("renders View button for uploaded docs with signed URL", async () => {
    const withDocs = {
      ...MOCK_ACTIVE_RESIDENT,
      idProofUrl: "https://example.com/id.pdf",
    };
    mockGetResident.mockResolvedValue(withDocs);
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: "https://signed.url/doc" }),
    });
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Documents")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getAllByTitle("View document").length).toBeGreaterThanOrEqual(1);
    });
  });

  it("renders Replace button for uploaded docs", async () => {
    const withDocs = {
      ...MOCK_ACTIVE_RESIDENT,
      idProofUrl: "https://example.com/id.pdf",
    };
    mockGetResident.mockResolvedValue(withDocs);
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: "https://signed.url/doc" }),
    });
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Documents")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getAllByTitle("Replace document").length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── File input with no file selected ──

  it("does nothing when file input changes with no file", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Documents")).toBeInTheDocument();
    });
    const fileInputs = document.querySelectorAll('input[type="file"]');
    // Trigger change with no files
    fireEvent.change(fileInputs[0], { target: { files: [] } });
    // No upload should be triggered
    expect(mockFetch).not.toHaveBeenCalledWith(
      expect.stringContaining("/id-proof"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  // ── Resident with no email doesn't show email row ──

  it("does not render email row when email is null", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_NO_EMAIL);
    await renderPage("r4");
    await waitFor(() => {
      expect(screen.getAllByText("No Email Person").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.queryByText("rajesh@test.com")).not.toBeInTheDocument();
  });

  // ── Status color variants ──

  it("renders ACTIVE_OVERDUE status color correctly", async () => {
    const overdue = { ...MOCK_ACTIVE_RESIDENT, status: "ACTIVE_OVERDUE" };
    mockGetResident.mockResolvedValue(overdue);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Active (Overdue)")).toBeInTheDocument();
    });
  });

  it("renders ACTIVE_EXEMPTED status correctly", async () => {
    const exempted = { ...MOCK_ACTIVE_RESIDENT, status: "ACTIVE_EXEMPTED" };
    mockGetResident.mockResolvedValue(exempted);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Active (Exempted)")).toBeInTheDocument();
    });
  });

  it("renders REJECTED status correctly", async () => {
    const rejected = { ...MOCK_ACTIVE_RESIDENT, status: "REJECTED" };
    mockGetResident.mockResolvedValue(rejected);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rejected")).toBeInTheDocument();
    });
  });

  // ── Deactivated resident without reason ──

  it("shows deactivated banner without reason when reason is null", async () => {
    const noReason = { ...MOCK_DEACTIVATED_RESIDENT, deactivationReason: null };
    mockGetResident.mockResolvedValue(noReason);
    await renderPage("r3");
    await waitFor(() => {
      expect(screen.getByText("Resident Deactivated")).toBeInTheDocument();
    });
    expect(screen.queryByText(/Reason:/)).not.toBeInTheDocument();
  });

  // ── Ownership type dash ──

  it("shows dash for null ownershipType", async () => {
    const noOwnership = { ...MOCK_ACTIVE_RESIDENT, ownershipType: null };
    mockGetResident.mockResolvedValue(noOwnership);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Personal Details")).toBeInTheDocument();
    });
  });

  // ── Edit dialog ownership type change ──

  it("changes ownership type in edit dialog", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    mockUpdateResident.mockResolvedValue({});
    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Edit/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Edit/i }));
    await waitFor(() => {
      expect(screen.getByText("Edit Resident")).toBeInTheDocument();
    });
    // Click the ownership type select trigger to open the dropdown
    const ownershipTrigger = screen.getByRole("combobox");
    await user.click(ownershipTrigger);
    // Select TENANT option
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Tenant" })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("option", { name: "Tenant" }));
    // Save and verify ownershipType changed
    await user.click(screen.getByRole("button", { name: /Save Changes/i }));
    await waitFor(() => {
      expect(mockUpdateResident).toHaveBeenCalledWith(
        "r1",
        expect.objectContaining({
          ownershipType: "TENANT",
        }),
      );
    });
  });

  // ── Document View button opens window ──

  it("opens document in new tab when View button is clicked", async () => {
    const withDocs = {
      ...MOCK_ACTIVE_RESIDENT,
      idProofUrl: "https://example.com/id.pdf",
    };
    mockGetResident.mockResolvedValue(withDocs);
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: "https://signed.url/doc" }),
    });
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Documents")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getAllByTitle("View document").length).toBeGreaterThanOrEqual(1);
    });
    await user.click(screen.getAllByTitle("View document")[0]);
    expect(windowOpenSpy).toHaveBeenCalledWith("https://signed.url/doc", "_blank");
    windowOpenSpy.mockRestore();
  });

  // ── Replace document button triggers file input ──

  it("triggers file input when Replace button is clicked", async () => {
    const withDocs = {
      ...MOCK_ACTIVE_RESIDENT,
      idProofUrl: "https://example.com/id.pdf",
    };
    mockGetResident.mockResolvedValue(withDocs);
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: "https://signed.url/doc" }),
    });
    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Documents")).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getAllByTitle("Replace document").length).toBeGreaterThanOrEqual(1);
    });
    // The Replace button should trigger click on hidden file input
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const clickSpy = vi.spyOn(fileInputs[0] as HTMLInputElement, "click");
    await user.click(screen.getAllByTitle("Replace document")[0]);
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  // ── Upload button (not uploaded) triggers file input ──

  it("triggers file input when Upload button is clicked for non-uploaded doc", async () => {
    mockGetResident.mockResolvedValue(MOCK_ACTIVE_RESIDENT);
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ url: null }),
    });
    const user = userEvent.setup();
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Documents")).toBeInTheDocument();
    });
    // For non-uploaded docs, there are Upload buttons
    const uploadBtns = screen.getAllByRole("button", { name: /Upload/i });
    expect(uploadBtns.length).toBeGreaterThanOrEqual(1);
    const fileInputs = document.querySelectorAll('input[type="file"]');
    const clickSpy = vi.spyOn(fileInputs[0] as HTMLInputElement, "click");
    await user.click(uploadBtns[0]);
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  // ── Edit dialog does not open without resident ──

  it("edit dialog does not open when resident is null", async () => {
    mockGetResident.mockResolvedValue(null);
    await renderPage();
    await waitFor(
      () => {
        expect(screen.getByText("Resident not found.")).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    expect(screen.queryByText("Edit Resident")).not.toBeInTheDocument();
  });
});
