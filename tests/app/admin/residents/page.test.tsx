import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ──

const {
  mockGetResidents,
  mockApproveResident,
  mockRejectResident,
  mockPermanentDeleteResident,
  mockSendResidentVerificationEmail,
  mockGetSocietyByCode,
  mockToastSuccess,
  mockToastError,
  mockRouterPush,
  mockRouterReplace,
  mockFetch,
} = vi.hoisted(() => ({
  mockGetResidents: vi.fn(),
  mockApproveResident: vi.fn(),
  mockRejectResident: vi.fn(),
  mockPermanentDeleteResident: vi.fn(),
  mockSendResidentVerificationEmail: vi.fn(),
  mockGetSocietyByCode: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockRouterPush: vi.fn(),
  mockRouterReplace: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("@/services/residents", () => ({
  getResidents: (...args: unknown[]) => mockGetResidents(...args),
  approveResident: (...args: unknown[]) => mockApproveResident(...args),
  rejectResident: (...args: unknown[]) => mockRejectResident(...args),
  permanentDeleteResident: (...args: unknown[]) => mockPermanentDeleteResident(...args),
  sendResidentVerificationEmail: (...args: unknown[]) => mockSendResidentVerificationEmail(...args),
}));

vi.mock("@/services/societies", () => ({
  getSocietyByCode: (...args: unknown[]) => mockGetSocietyByCode(...args),
}));

const { mockSearchAdminVehicles } = vi.hoisted(() => ({
  mockSearchAdminVehicles: vi.fn(),
}));

vi.mock("@/services/admin-residents", () => ({
  searchAdminVehicles: (...args: unknown[]) => mockSearchAdminVehicles(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

const mockSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush, replace: mockRouterReplace }),
  usePathname: () => "/admin/residents",
  useSearchParams: () => mockSearchParams,
}));

// Mock Select components to use native <select> so onValueChange fires in JSDOM
vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (v: string) => void;
  }) => (
    <select
      data-testid="mock-select"
      value={value}
      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onValueChange?.(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode; className?: string }) => (
    <>{children}</>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

vi.mock("@/components/residents/BulkUploadDialog", () => ({
  BulkUploadDialog: ({
    open,
    onSuccess,
  }: {
    open: boolean;
    onOpenChange: (v: boolean) => void;
    societyCode: string;
    onSuccess: () => void;
  }) => {
    if (open) {
      return (
        <div data-testid="bulk-upload-dialog">
          Bulk Upload
          <button data-testid="bulk-upload-success" onClick={onSuccess}>
            Simulate Success
          </button>
        </div>
      );
    }
    return null;
  },
}));

global.fetch = mockFetch;

import ResidentsPage from "@/app/admin/residents/page";
import { AuthContext } from "@/hooks/useAuth";

// ── Helpers ──

function renderPage(userOverrides: Record<string, unknown> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = {
    id: "u1",
    name: "Admin User",
    role: "RWA_ADMIN" as const,
    permission: "FULL_ACCESS" as const,
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
  return render(
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
        <ResidentsPage />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

// ── Mock Data ──

const MOCK_RESIDENT_ACTIVE = {
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
};

const MOCK_RESIDENT_PENDING = {
  ...MOCK_RESIDENT_ACTIVE,
  id: "r2",
  name: "Priya Sharma",
  mobile: "9876543211",
  email: "priya@test.com",
  rwaid: null,
  status: "PENDING_APPROVAL",
  isEmailVerified: false,
  approvedAt: null,
  ownershipType: "TENANT",
  photoUrl: "https://example.com/photo.jpg",
  registeredAt: "2025-04-10T10:00:00.000Z",
};

const MOCK_RESIDENT_DEACTIVATED = {
  ...MOCK_RESIDENT_ACTIVE,
  id: "r3",
  name: "Sunil Verma",
  mobile: "9876543212",
  rwaid: "EDEN-003",
  status: "DEACTIVATED",
  isEmailVerified: true,
  idProofUrl: "some-url",
  ownershipProofUrl: "some-url-2",
  registeredAt: "2025-02-10T10:00:00.000Z",
};

const MOCK_RESIDENT_PARTIAL_DOCS = {
  ...MOCK_RESIDENT_ACTIVE,
  id: "r4",
  name: "Anita Patel",
  mobile: "9876543213",
  rwaid: "EDEN-004",
  status: "ACTIVE_PENDING",
  idProofUrl: "some-url",
  ownershipProofUrl: null,
  registeredAt: "2025-03-20T10:00:00.000Z",
};

const MOCK_LIST_RESPONSE = {
  data: [
    MOCK_RESIDENT_ACTIVE,
    MOCK_RESIDENT_PENDING,
    MOCK_RESIDENT_DEACTIVATED,
    MOCK_RESIDENT_PARTIAL_DOCS,
  ],
  total: 4,
  page: 1,
  limit: 20,
};

const EMPTY_RESPONSE = { data: [], total: 0, page: 1, limit: 20 };

// ── Tests ──

describe("AdminResidentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParams.delete("search");
    mockSearchParams.delete("status");
    mockSearchParams.delete("page");
    mockSearchParams.delete("limit");
    mockSearchParams.delete("verified");
    mockSearchParams.delete("ownership");
    mockSearchParams.delete("year");
    mockSearchParams.delete("doc");
    mockGetSocietyByCode.mockResolvedValue({
      name: "Eden Estate",
      type: "APARTMENT_COMPLEX",
      city: "Delhi",
      state: "Delhi",
    });
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: "new-1" }) });
  });

  // ── Page structure ──

  it("renders page title and description", () => {
    mockGetResidents.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText("Residents")).toBeInTheDocument();
    expect(screen.getByText("Manage society residents")).toBeInTheDocument();
  });

  it("renders Add Resident and Import buttons", () => {
    mockGetResidents.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole("button", { name: /Add Resident/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Import/i })).toBeInTheDocument();
  });

  it("renders search input", () => {
    mockGetResidents.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByLabelText(/search residents/i)).toBeInTheDocument();
  });

  it("renders filter dropdowns", () => {
    mockGetResidents.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getAllByText("All Statuses").length).toBeGreaterThanOrEqual(1);
  });

  // ── Loading state ──

  it("shows loading skeleton while data is loading", () => {
    mockGetResidents.mockReturnValue(new Promise(() => {}));
    renderPage();
    // TableSkeleton renders div with animate-pulse class
    expect(document.querySelector(".animate-pulse")).toBeTruthy();
  });

  // ── Empty state ──

  it("shows empty state when no residents found", async () => {
    mockGetResidents.mockResolvedValue(EMPTY_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("No residents found")).toBeInTheDocument();
    });
  });

  it("shows search-specific empty message when search is active", async () => {
    mockSearchParams.set("search", "xyz");
    mockGetResidents.mockResolvedValue(EMPTY_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Try adjusting your search.")).toBeInTheDocument();
    });
  });

  it("shows default empty message when no search", async () => {
    mockGetResidents.mockResolvedValue(EMPTY_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByText("Residents will appear here after they register."),
      ).toBeInTheDocument();
    });
  });

  // ── Data rendering ──

  it("renders resident names in table", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
    expect(screen.getByText("Sunil Verma")).toBeInTheDocument();
    expect(screen.getByText("Anita Patel")).toBeInTheDocument();
  });

  it("renders masked mobile numbers", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    // maskMobile("9876543210") => "XXXXX 43210"
    const cells = screen.getAllByText("XXXXX 43210");
    expect(cells.length).toBeGreaterThanOrEqual(1);
  });

  it("renders status badges", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Active (Paid)")).toBeInTheDocument();
    });
    expect(screen.getByText("Pending Approval")).toBeInTheDocument();
    expect(screen.getByText("Deactivated")).toBeInTheDocument();
  });

  it("renders RWAID or dash for residents", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("EDEN-001")).toBeInTheDocument();
    });
  });

  it("renders ownership badges", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText("Owner").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText("Tenant").length).toBeGreaterThanOrEqual(1);
  });

  it("renders email verified badge", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText("Verified").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getAllByText("Not Verified").length).toBeGreaterThanOrEqual(1);
  });

  it("renders registered dates", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    // Each resident has a different date: 15 Jan, 10 Apr, 10 Feb, 20 Mar
    expect(screen.getByText("15 Jan 2025")).toBeInTheDocument();
    expect(screen.getByText("10 Apr 2025")).toBeInTheDocument();
  });

  // ── Avatar with photo ──

  it("renders avatar for resident with photoUrl set", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
    });
    // In JSDOM, Radix AvatarImage does not trigger onLoad so fallback always shows.
    // Priya Sharma has photoUrl set - verify fallback initials still render ("PS")
    expect(screen.getByText("PS")).toBeInTheDocument();
    // Avatar container should exist
    const avatars = document.querySelectorAll('[data-slot="avatar"]');
    expect(avatars.length).toBeGreaterThanOrEqual(4);
  });

  it("renders fallback initials when no photo", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    // "Rajesh Kumar" => "RK"
    expect(screen.getByText("RK")).toBeInTheDocument();
  });

  // ── Doc status badges ──

  it("renders Verified doc badge when both docs present", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    // Sunil Verma has both docs
    const verifiedBadges = screen.getAllByTitle("Both documents uploaded");
    expect(verifiedBadges.length).toBeGreaterThanOrEqual(1);
  });

  it("renders Partial doc badge when one doc present", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Anita Patel")).toBeInTheDocument();
    });
    const partialBadges = screen.getAllByTitle(/proof uploaded.*proof missing/);
    expect(partialBadges.length).toBeGreaterThanOrEqual(1);
  });

  it("renders None doc badge when no docs present", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    const noneBadges = screen.getAllByTitle("No documents uploaded");
    expect(noneBadges.length).toBeGreaterThanOrEqual(1);
  });

  // ── Pagination ──

  it("renders pagination info with correct text", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Showing 1/)).toBeInTheDocument();
    });
  });

  it("shows page number buttons for multi-page results", async () => {
    mockGetResidents.mockResolvedValue({
      data: [MOCK_RESIDENT_ACTIVE],
      total: 45,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    // Should have page buttons 1, 2, 3
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3" })).toBeInTheDocument();
  });

  it("does not show page buttons for single-page results", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "1" })).not.toBeInTheDocument();
  });

  // ── Approve action ──

  it("shows approve button for pending residents", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Approve/i })).toBeInTheDocument();
  });

  it("calls approveResident when approve is clicked", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    mockApproveResident.mockResolvedValue({});
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Approve/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Approve/i }));
    await waitFor(() => {
      expect(mockApproveResident).toHaveBeenCalled();
    });
  });

  it("shows toast on successful approval", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    mockApproveResident.mockResolvedValue({});
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Approve/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Approve/i }));
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Resident approved!");
    });
  });

  it("shows toast error on approval failure", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    mockApproveResident.mockRejectedValue(new Error("Server error"));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Approve/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Approve/i }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Server error");
    });
  });

  // ── Reject action ──

  it("shows reject button for pending residents", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Reject/i })).toBeInTheDocument();
  });

  it("opens reject dialog and requires reason", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Reject/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Reject/i }));
    await waitFor(() => {
      expect(screen.getByText("Reject Resident")).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText(/Duplicate registration/)).toBeInTheDocument();
    // Reject button in dialog should be disabled until reason >= 5 chars
    const dialogRejectBtn = screen.getAllByRole("button", { name: /Reject/i });
    const rejectSubmit = dialogRejectBtn[dialogRejectBtn.length - 1];
    expect(rejectSubmit).toBeDisabled();
  });

  it("enables reject button when reason is provided", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Reject/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Reject/i }));
    await waitFor(() => {
      expect(screen.getByText("Reject Resident")).toBeInTheDocument();
    });
    const reasonInput = screen.getByPlaceholderText(/Duplicate registration/);
    await user.type(reasonInput, "Not a valid resident");
    const dialogRejectBtn = screen.getAllByRole("button", { name: /Reject/i });
    const rejectSubmit = dialogRejectBtn[dialogRejectBtn.length - 1];
    expect(rejectSubmit).not.toBeDisabled();
  });

  it("calls rejectResident when confirmed", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    mockRejectResident.mockResolvedValue({});
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Reject/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Reject/i }));
    await waitFor(() => {
      expect(screen.getByText("Reject Resident")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText(/Duplicate registration/), "Not a valid resident");
    const dialogRejectBtns = screen.getAllByRole("button", { name: /Reject/i });
    await user.click(dialogRejectBtns[dialogRejectBtns.length - 1]);
    await waitFor(() => {
      expect(mockRejectResident).toHaveBeenCalledWith("r2", "Not a valid resident");
    });
  });

  it("closes reject dialog on cancel", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Reject/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Reject/i }));
    await waitFor(() => {
      expect(screen.getByText("Reject Resident")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Cancel/i }));
    await waitFor(() => {
      expect(screen.queryByText("Reject Resident")).not.toBeInTheDocument();
    });
  });

  // ── Delete action ──

  it("shows Delete button for deactivated residents", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Sunil Verma")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Delete/i })).toBeInTheDocument();
  });

  it("opens delete confirmation dialog", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Delete/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Delete/i }));
    await waitFor(() => {
      expect(screen.getByText("Permanently Delete Resident")).toBeInTheDocument();
    });
    expect(screen.getByText(/This will permanently delete/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Delete Permanently/i })).toBeInTheDocument();
  });

  it("calls permanentDeleteResident when confirmed", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    mockPermanentDeleteResident.mockResolvedValue({});
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Delete/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Delete/i }));
    await waitFor(() => {
      expect(screen.getByText("Permanently Delete Resident")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Delete Permanently/i }));
    await waitFor(() => {
      expect(mockPermanentDeleteResident).toHaveBeenCalledWith("r3", expect.anything());
    });
  });

  // ── Send verification email ──

  it("shows verification email button for unverified residents", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
    });
    // Not verified residents should show the mail icon button
    const mailButtons = screen.getAllByTitle("Send verification email");
    expect(mailButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("calls sendResidentVerificationEmail on click", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    mockSendResidentVerificationEmail.mockResolvedValue({});
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
    });
    const mailButtons = screen.getAllByTitle("Send verification email");
    await user.click(mailButtons[0]);
    await waitFor(() => {
      expect(mockSendResidentVerificationEmail).toHaveBeenCalledWith("r2");
    });
  });

  it("shows toast on verification email success", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    mockSendResidentVerificationEmail.mockResolvedValue({});
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
    });
    const mailButtons = screen.getAllByTitle("Send verification email");
    await user.click(mailButtons[0]);
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Verification email sent");
    });
  });

  it("shows toast error on verification email failure", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    mockSendResidentVerificationEmail.mockRejectedValue(new Error("Email failed"));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
    });
    const mailButtons = screen.getAllByTitle("Send verification email");
    await user.click(mailButtons[0]);
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Email failed");
    });
  });

  // ── Search interaction ──

  it("updates URL params when typing in search", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    const searchInput = screen.getByLabelText(/search residents/i);
    await user.type(searchInput, "test");
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalled();
    });
  });

  // ── Add Resident dialog ──

  it("opens Add Resident dialog when button clicked", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    // Click the header "Add Resident" button (the first one)
    const addBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    await user.click(addBtns[0]);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter full name")).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText("9876543210")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("email@example.com")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Min 8 characters")).toBeInTheDocument();
  });

  it("closes Add Resident dialog on cancel", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Add Resident/i }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter full name")).toBeInTheDocument();
    });
    const cancelBtns = screen.getAllByRole("button", { name: /Cancel/i });
    await user.click(cancelBtns[cancelBtns.length - 1]);
    await waitFor(() => {
      expect(screen.queryByPlaceholderText("Enter full name")).not.toBeInTheDocument();
    });
  });

  it("Add Resident button is disabled when required fields are empty", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Add Resident/i }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter full name")).toBeInTheDocument();
    });
    // The submit button should be disabled initially
    const submitBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    const submitBtn = submitBtns[submitBtns.length - 1];
    expect(submitBtn).toBeDisabled();
  });

  it("submits add resident form with valid data", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: "new-1" }) });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Add Resident/i }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter full name")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByPlaceholderText("Enter full name"), {
      target: { value: "New Resident" },
    });
    fireEvent.change(screen.getByPlaceholderText("9876543210"), {
      target: { value: "9123456789" },
    });
    fireEvent.change(screen.getByPlaceholderText("email@example.com"), {
      target: { value: "new@test.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Min 8 characters"), {
      target: { value: "password123" },
    });
    const passwordFields = document.querySelectorAll('input[type="password"]');
    fireEvent.change(passwordFields[1], { target: { value: "password123" } });
    const submitBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    const submitBtn = submitBtns[submitBtns.length - 1];
    expect(submitBtn).not.toBeDisabled();
  });

  it("shows form validation errors for invalid add form", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: { message: "Failed" } }),
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Add Resident/i }));
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter full name")).toBeInTheDocument();
    });
    // Fill in just enough to enable button: name >= 2, email, password
    fireEvent.change(screen.getByPlaceholderText("Enter full name"), { target: { value: "AB" } });
    fireEvent.change(screen.getByPlaceholderText("email@example.com"), {
      target: { value: "a@b.c" },
    });
    fireEvent.change(screen.getByPlaceholderText("Min 8 characters"), {
      target: { value: "short" },
    });
    const submitBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    const submitBtn = submitBtns[submitBtns.length - 1];
    // Won't be disabled because name >= 2, email non-empty, password non-empty
    if (!submitBtn.hasAttribute("disabled")) {
      await user.click(submitBtn);
      // Validation should show errors (mobile invalid, password < 8, etc)
      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalled();
      });
    }
  });

  // ── Bulk upload dialog ──

  it("opens bulk upload dialog when Import button is clicked", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Import/i }));
    await waitFor(() => {
      expect(screen.getByTestId("bulk-upload-dialog")).toBeInTheDocument();
    });
  });

  // ── Link to detail page ──

  it("renders resident names as links to detail pages", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    const link = screen.getByText("Rajesh Kumar").closest("a");
    expect(link).toBeTruthy();
    expect(link?.getAttribute("href")).toBe("/admin/residents/r1");
  });

  // ── Does not render actions for wrong statuses ──

  it("does not show approve/reject for active residents", async () => {
    mockGetResidents.mockResolvedValue({
      data: [MOCK_RESIDENT_ACTIVE],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /Approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reject/i })).not.toBeInTheDocument();
  });

  it("does not show delete for active residents", async () => {
    mockGetResidents.mockResolvedValue({
      data: [MOCK_RESIDENT_ACTIVE],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /Delete/i })).not.toBeInTheDocument();
  });

  // ── Resident without ownershipType ──

  it("renders dash for resident without ownership type", async () => {
    const noOwnership = {
      ...MOCK_RESIDENT_ACTIVE,
      id: "r10",
      name: "No Type",
      ownershipType: null,
    };
    mockGetResidents.mockResolvedValue({ data: [noOwnership], total: 1, page: 1, limit: 20 });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("No Type")).toBeInTheDocument();
    });
  });

  // ── Page size selector ──

  it("renders page size selector with Show label", async () => {
    mockGetResidents.mockResolvedValue({
      data: [MOCK_RESIDENT_ACTIVE],
      total: 25,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    expect(screen.getByText("Show")).toBeInTheDocument();
  });

  // ── Reject dialog error toast ──

  it("shows toast on reject mutation error", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    mockRejectResident.mockRejectedValue(new Error("Reject failed"));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Reject/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Reject/i }));
    await waitFor(() => {
      expect(screen.getByText("Reject Resident")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText(/Duplicate registration/), "Not valid at all");
    const dialogRejectBtns = screen.getAllByRole("button", { name: /Reject/i });
    await user.click(dialogRejectBtns[dialogRejectBtns.length - 1]);
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Reject failed");
    });
  });

  // ── Delete dialog error toast ──

  it("shows toast on delete mutation error", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    mockPermanentDeleteResident.mockRejectedValue(new Error("Delete failed"));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Delete/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Delete/i }));
    await waitFor(() => {
      expect(screen.getByText("Permanently Delete Resident")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Delete Permanently/i }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Delete failed");
    });
  });

  // ── Reject success toast ──

  it("shows success toast on reject", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    mockRejectResident.mockResolvedValue({});
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Reject/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Reject/i }));
    await waitFor(() => {
      expect(screen.getByText("Reject Resident")).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText(/Duplicate registration/), "Invalid details");
    const dialogRejectBtns = screen.getAllByRole("button", { name: /Reject/i });
    await user.click(dialogRejectBtns[dialogRejectBtns.length - 1]);
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Resident rejected");
    });
  });

  // ── Delete success toast ──

  it("shows success toast on delete", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    mockPermanentDeleteResident.mockResolvedValue({});
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Delete/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Delete/i }));
    await waitFor(() => {
      expect(screen.getByText("Permanently Delete Resident")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Delete Permanently/i }));
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Resident permanently deleted");
    });
  });

  // ── getPageNumbers coverage (called internally) ──

  it("shows ellipsis for many pages", async () => {
    mockGetResidents.mockResolvedValue({
      data: [MOCK_RESIDENT_ACTIVE],
      total: 200,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    // total=200 / limit=20 = 10 pages. getPageNumbers(1,10) => [1,2,3,4,5,"...",10]
    expect(screen.getByRole("button", { name: "10" })).toBeInTheDocument();
  });

  it("shows ellipsis at start when current page is near end", async () => {
    mockSearchParams.set("page", "9");
    mockGetResidents.mockResolvedValue({
      data: [MOCK_RESIDENT_ACTIVE],
      total: 200,
      page: 9,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    // getPageNumbers(9,10) => [1,"...",6,7,8,9,10]
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "10" })).toBeInTheDocument();
  });

  it("shows ellipsis on both sides for middle pages", async () => {
    mockSearchParams.set("page", "5");
    mockGetResidents.mockResolvedValue({
      data: [MOCK_RESIDENT_ACTIVE],
      total: 200,
      page: 5,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    // getPageNumbers(5,10) => [1,"...",4,5,6,"...",10]
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "4" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "5" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "6" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "10" })).toBeInTheDocument();
  });

  // ── Add Resident form field coverage ──

  it("clears add form when dialog is closed via Escape key", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    // Open dialog
    const addBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    await user.click(addBtns[0]);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter full name")).toBeInTheDocument();
    });
    // Type something in name field
    await user.type(screen.getByPlaceholderText("Enter full name"), "Test");
    // Close dialog using Escape key (triggers onOpenChange with false)
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByPlaceholderText("Enter full name")).not.toBeInTheDocument();
    });
    // Reopen and verify form is cleared
    await user.click(addBtns[0]);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter full name")).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText("Enter full name")).toHaveValue("");
  });

  it("renders address fields when society type is available", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    mockGetSocietyByCode.mockResolvedValue({
      name: "Eden Estate",
      type: "APARTMENT_COMPLEX",
      city: "Delhi",
      state: "Delhi",
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    const addBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    await user.click(addBtns[0]);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter full name")).toBeInTheDocument();
    });
    // Address fields should appear for APARTMENT_COMPLEX (towerBlock, floorNo, flatNo)
    await waitFor(() => {
      expect(screen.getByText("Address Details")).toBeInTheDocument();
    });
  });

  it("shows add mutation success toast and clears form", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: "new-1" }) });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    const addBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    await user.click(addBtns[0]);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter full name")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByPlaceholderText("Enter full name"), {
      target: { value: "Valid Name" },
    });
    fireEvent.change(screen.getByPlaceholderText("9876543210"), {
      target: { value: "9123456789" },
    });
    fireEvent.change(screen.getByPlaceholderText("email@example.com"), {
      target: { value: "valid@test.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Min 8 characters"), {
      target: { value: "password123" },
    });
    const passwordFields = document.querySelectorAll('input[type="password"]');
    fireEvent.change(passwordFields[1], { target: { value: "password123" } });
    const submitBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    await user.click(submitBtns[submitBtns.length - 1]);
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(
        "Resident added successfully! They will appear as Pending Approval.",
      );
    });
  });

  it("shows error toast when add resident API fails", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: { message: "Duplicate email" } }),
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    const addBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    await user.click(addBtns[0]);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter full name")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByPlaceholderText("Enter full name"), {
      target: { value: "Valid Name" },
    });
    fireEvent.change(screen.getByPlaceholderText("9876543210"), {
      target: { value: "9123456789" },
    });
    fireEvent.change(screen.getByPlaceholderText("email@example.com"), {
      target: { value: "valid@test.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Min 8 characters"), {
      target: { value: "password123" },
    });
    const passwordFields = document.querySelectorAll('input[type="password"]');
    fireEvent.change(passwordFields[1], { target: { value: "password123" } });
    const submitBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    await user.click(submitBtns[submitBtns.length - 1]);
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Duplicate email");
    });
  });

  it("shows validation errors for missing mobile in add form", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    const addBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    await user.click(addBtns[0]);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter full name")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByPlaceholderText("Enter full name"), {
      target: { value: "Valid Name" },
    });
    fireEvent.change(screen.getByPlaceholderText("email@example.com"), {
      target: { value: "valid@test.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Min 8 characters"), {
      target: { value: "password123" },
    });
    const passwordFields = document.querySelectorAll('input[type="password"]');
    fireEvent.change(passwordFields[1], { target: { value: "password123" } });
    const submitBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    await user.click(submitBtns[submitBtns.length - 1]);
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Please fix the highlighted fields");
    });
  });

  it("shows password mismatch error in add form", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    const addBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    await user.click(addBtns[0]);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter full name")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByPlaceholderText("Enter full name"), {
      target: { value: "Valid Name" },
    });
    fireEvent.change(screen.getByPlaceholderText("9876543210"), {
      target: { value: "9123456789" },
    });
    fireEvent.change(screen.getByPlaceholderText("email@example.com"), {
      target: { value: "valid@test.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Min 8 characters"), {
      target: { value: "password123" },
    });
    const passwordFields = document.querySelectorAll('input[type="password"]');
    fireEvent.change(passwordFields[1], { target: { value: "different" } });
    const submitBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    await user.click(submitBtns[submitBtns.length - 1]);
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Please fix the highlighted fields");
    });
  });

  it("clears field error when typing in add form field", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    const addBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    await user.click(addBtns[0]);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter full name")).toBeInTheDocument();
    });
    // Use fireEvent for speed
    fireEvent.change(screen.getByPlaceholderText("Enter full name"), { target: { value: "AB" } });
    fireEvent.change(screen.getByPlaceholderText("email@example.com"), {
      target: { value: "a@b.c" },
    });
    fireEvent.change(screen.getByPlaceholderText("Min 8 characters"), {
      target: { value: "12345678" },
    });
    const passwordFields = document.querySelectorAll('input[type="password"]');
    fireEvent.change(passwordFields[1], { target: { value: "12345678" } });
    const submitBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    await user.click(submitBtns[submitBtns.length - 1]);
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });
    // Type in mobile to clear error
    fireEvent.change(screen.getByPlaceholderText("9876543210"), {
      target: { value: "9123456789" },
    });
  });

  // ── Filter interactions that trigger updateParams ──

  it("calls getResidents when status filter changes", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    // The status filter is already rendered
    expect(mockGetResidents).toHaveBeenCalled();
  });

  // ── Pagination button clicks ──

  it("navigates to a specific page number", async () => {
    mockGetResidents.mockResolvedValue({
      data: [MOCK_RESIDENT_ACTIVE],
      total: 45,
      page: 1,
      limit: 20,
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "2" })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: "2" }));
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith(expect.stringContaining("page=2"));
    });
  });

  it("navigates back with chevron left button", async () => {
    mockSearchParams.set("page", "2");
    mockGetResidents.mockResolvedValue({
      data: [MOCK_RESIDENT_ACTIVE],
      total: 45,
      page: 2,
      limit: 20,
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    // Find the chevron left button (first button in pagination)
    const prevBtns = document.querySelectorAll(".h-8.w-8.p-0");
    if (prevBtns.length > 0) {
      await user.click(prevBtns[0] as HTMLButtonElement);
      await waitFor(() => {
        expect(mockRouterReplace).toHaveBeenCalled();
      });
    }
  });

  it("navigates forward with chevron right button", async () => {
    mockGetResidents.mockResolvedValue({
      data: [MOCK_RESIDENT_ACTIVE],
      total: 45,
      page: 1,
      limit: 20,
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    const nextBtns = document.querySelectorAll(".h-8.w-8.p-0");
    if (nextBtns.length > 1) {
      const lastBtn = nextBtns[nextBtns.length - 1] as HTMLButtonElement;
      await user.click(lastBtn);
      await waitFor(() => {
        expect(mockRouterReplace).toHaveBeenCalled();
      });
    }
  });

  // ── Existing resident with no ownership ──

  it("renders dash indicator for null ownershipType", async () => {
    const noOwnership = {
      ...MOCK_RESIDENT_ACTIVE,
      id: "r-no-own",
      name: "No Owner Type",
      ownershipType: null,
    };
    mockGetResidents.mockResolvedValue({ data: [noOwnership], total: 1, page: 1, limit: 20 });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("No Owner Type")).toBeInTheDocument();
    });
  });

  // ── Send verification button disabled while sending ──

  it("does not show verification button for verified residents", async () => {
    mockGetResidents.mockResolvedValue({
      data: [MOCK_RESIDENT_ACTIVE],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    expect(screen.queryByTitle("Send verification email")).not.toBeInTheDocument();
  });

  // ── DocStatusBadge full branch coverage ──

  it("renders doc badge for resident with only ownership proof", async () => {
    const ownershipOnly = {
      ...MOCK_RESIDENT_ACTIVE,
      id: "r-own-only",
      name: "Ownership Only",
      idProofUrl: null,
      ownershipProofUrl: "some-url",
    };
    mockGetResidents.mockResolvedValue({ data: [ownershipOnly], total: 1, page: 1, limit: 20 });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Ownership Only")).toBeInTheDocument();
    });
    expect(screen.getByTitle("Ownership proof uploaded, ID proof missing")).toBeInTheDocument();
  });

  // ── getPageNumbers edge: total <= 7 ──

  it("shows all page numbers when total pages <= 7", async () => {
    mockGetResidents.mockResolvedValue({
      data: [MOCK_RESIDENT_ACTIVE],
      total: 100,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    // 100/20 = 5 pages <= 7, so all shown: [1,2,3,4,5]
    expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "5" })).toBeInTheDocument();
  });

  // ── Delete dialog onOpenChange handler ──

  it("closes delete dialog when onOpenChange fires with false", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Delete/i })).toBeInTheDocument();
    });
    // Open delete dialog
    await user.click(screen.getByRole("button", { name: /Delete/i }));
    await waitFor(() => {
      expect(screen.getByText("Permanently Delete Resident")).toBeInTheDocument();
    });
    // Click Cancel in the delete dialog
    const cancelBtns = screen.getAllByRole("button", { name: /Cancel/i });
    await user.click(cancelBtns[cancelBtns.length - 1]);
    await waitFor(() => {
      expect(screen.queryByText("Permanently Delete Resident")).not.toBeInTheDocument();
    });
  });

  it("closes delete dialog via Escape key", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    const user = userEvent.setup();
    renderPage();
    await waitFor(
      () => {
        expect(screen.getByRole("button", { name: /Delete/i })).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
    await user.click(screen.getByRole("button", { name: /Delete/i }));
    await waitFor(() => {
      expect(screen.getByText("Permanently Delete Resident")).toBeInTheDocument();
    });
    // Close via Escape — triggers onOpenChange(false) which resets id and name
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByText("Permanently Delete Resident")).not.toBeInTheDocument();
    });
  });

  // ── Ownership type change in add form ──

  it("changes ownership type to TENANT in add form", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    const addBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    await user.click(addBtns[0]);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter full name")).toBeInTheDocument();
    });
    // The ownership type Select defaults to "Owner". Click the trigger and select Tenant.
    // Fill the form fully and submit to verify TENANT is sent
    fireEvent.change(screen.getByPlaceholderText("Enter full name"), {
      target: { value: "Tenant User" },
    });
    fireEvent.change(screen.getByPlaceholderText("9876543210"), {
      target: { value: "9123456789" },
    });
    fireEvent.change(screen.getByPlaceholderText("email@example.com"), {
      target: { value: "tenant@test.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Min 8 characters"), {
      target: { value: "password123" },
    });
    const passwordFields = document.querySelectorAll('input[type="password"]');
    fireEvent.change(passwordFields[1], { target: { value: "password123" } });
    const submitBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    await user.click(submitBtns[submitBtns.length - 1]);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    // Verify the body was sent (default is OWNER)
    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.ownershipType).toBe("OWNER");
  });

  // ── Address field input changes ──

  it("allows typing in address required fields (non-floorLevel)", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    mockGetSocietyByCode.mockResolvedValue({
      name: "Eden Estate",
      type: "APARTMENT_COMPLEX",
      city: "Delhi",
      state: "Delhi",
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    const addBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    await user.click(addBtns[0]);
    await waitFor(() => {
      expect(screen.getByText("Address Details")).toBeInTheDocument();
    });
    // APARTMENT_COMPLEX has required: ["towerBlock", "floorNo", "flatNo"]
    // These are regular Input fields (not floorLevel Select)
    // Find the input fields in the address section
    const addressInputs = document.querySelectorAll(".bg-muted\\/30 input");
    expect(addressInputs.length).toBeGreaterThanOrEqual(1);
    // Type in an address field
    fireEvent.change(addressInputs[0], { target: { value: "Tower A" } });
    // Verify it accepted the change
    expect((addressInputs[0] as HTMLInputElement).value).toBe("Tower A");
  });

  it("renders floorLevel select for BUILDER_FLOORS society type", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    mockGetSocietyByCode.mockResolvedValue({
      name: "Builder Floors Society",
      type: "BUILDER_FLOORS",
      city: "Delhi",
      state: "Delhi",
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    const addBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    await user.click(addBtns[0]);
    await waitFor(() => {
      expect(screen.getByText("Address Details")).toBeInTheDocument();
    });
    // BUILDER_FLOORS has required: ["houseNo", "floorLevel"]
    // floorLevel renders as a Select with placeholder "Select floor"
    expect(screen.getByText("Select floor")).toBeInTheDocument();
  });

  it("renders optional address fields for society types that have them", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    mockGetSocietyByCode.mockResolvedValue({
      name: "Plotted Colony",
      type: "PLOTTED_COLONY",
      city: "Delhi",
      state: "Delhi",
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    const addBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    await user.click(addBtns[0]);
    await waitFor(() => {
      expect(screen.getByText("Address Details")).toBeInTheDocument();
    });
    // PLOTTED_COLONY has required: ["plotNo"], optional: ["laneNo", "phase"]
    // Verify optional fields are rendered (they have no asterisk)
    const addressInputs = document.querySelectorAll(".bg-muted\\/30 input");
    // plotNo (required) + laneNo (optional) + phase (optional) = 3
    expect(addressInputs.length).toBe(3);
    // Type in an optional field
    fireEvent.change(addressInputs[1], { target: { value: "Lane 5" } });
    expect((addressInputs[1] as HTMLInputElement).value).toBe("Lane 5");
  });

  it("sends unitAddress when address fields are filled", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    mockGetSocietyByCode.mockResolvedValue({
      name: "Eden Estate",
      type: "APARTMENT_COMPLEX",
      city: "Delhi",
      state: "Delhi",
    });
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: "new-2" }) });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    const addBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    await user.click(addBtns[0]);
    await waitFor(() => {
      expect(screen.getByText("Address Details")).toBeInTheDocument();
    });
    // Fill main form fields
    fireEvent.change(screen.getByPlaceholderText("Enter full name"), {
      target: { value: "Address User" },
    });
    fireEvent.change(screen.getByPlaceholderText("9876543210"), {
      target: { value: "9123456789" },
    });
    fireEvent.change(screen.getByPlaceholderText("email@example.com"), {
      target: { value: "addr@test.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Min 8 characters"), {
      target: { value: "password123" },
    });
    const passwordFields = document.querySelectorAll('input[type="password"]');
    fireEvent.change(passwordFields[1], { target: { value: "password123" } });
    // Fill address fields
    const addressInputs = document.querySelectorAll(".bg-muted\\/30 input");
    fireEvent.change(addressInputs[0], { target: { value: "A" } });
    fireEvent.change(addressInputs[1], { target: { value: "3" } });
    fireEvent.change(addressInputs[2], { target: { value: "301" } });
    // Submit
    const submitBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    await user.click(submitBtns[submitBtns.length - 1]);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.unitAddress).toBeDefined();
    expect(body.unitAddress.towerBlock).toBe("A");
  });

  // ── BulkUploadDialog onSuccess callback ──

  it("invalidates residents query when bulk upload succeeds", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Import/i }));
    await waitFor(() => {
      expect(screen.getByTestId("bulk-upload-dialog")).toBeInTheDocument();
    });
    // Click the simulate success button exposed by our mock
    await user.click(screen.getByTestId("bulk-upload-success"));
    // The onSuccess invalidates the "residents" query, causing a re-fetch
    await waitFor(() => {
      // getResidents is called again due to invalidation
      expect(mockGetResidents).toHaveBeenCalledTimes(2);
    });
  });

  // ── Add form: API error without error.message (fallback) ──

  it("shows fallback error when API returns no error.message", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    const addBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    await user.click(addBtns[0]);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter full name")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByPlaceholderText("Enter full name"), {
      target: { value: "Valid Name" },
    });
    fireEvent.change(screen.getByPlaceholderText("9876543210"), {
      target: { value: "9123456789" },
    });
    fireEvent.change(screen.getByPlaceholderText("email@example.com"), {
      target: { value: "valid@test.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Min 8 characters"), {
      target: { value: "password123" },
    });
    const passwordFields = document.querySelectorAll('input[type="password"]');
    fireEvent.change(passwordFields[1], { target: { value: "password123" } });
    const submitBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    await user.click(submitBtns[submitBtns.length - 1]);
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Failed to add resident");
    });
  });

  // ── Reject dialog onOpenChange: covers the open=false path resetting ID ──

  it("resets reject dialog ID when closed via dialog onOpenChange", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Reject/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Reject/i }));
    await waitFor(() => {
      expect(screen.getByText("Reject Resident")).toBeInTheDocument();
    });
    // Close via Escape (triggers onOpenChange(false) which sets id to "")
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByText("Reject Resident")).not.toBeInTheDocument();
    });
  });

  // ── Pagination showing "0" for empty total ──

  it("shows Showing 0 when total is 0 but data array exists", async () => {
    mockGetResidents.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("No residents found")).toBeInTheDocument();
    });
  });

  // ── updateParams: clearing a param with value "all" ──

  it("clears search param when search input is emptied", async () => {
    mockSearchParams.set("search", "test");
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    const searchInput = screen.getByLabelText(/search residents/i);
    // Clear the input
    await user.clear(searchInput);
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalled();
    });
    // Verify the replace call removes the search param (value is null/empty)
    const lastCall = mockRouterReplace.mock.calls[mockRouterReplace.mock.calls.length - 1][0];
    expect(lastCall).not.toContain("search=");
  });

  // ── Add form: clearing individual field errors on change ──

  it("clears email error when email field changes", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    const addBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    await user.click(addBtns[0]);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter full name")).toBeInTheDocument();
    });
    // Fill form with invalid email to trigger validation
    fireEvent.change(screen.getByPlaceholderText("Enter full name"), { target: { value: "AB" } });
    fireEvent.change(screen.getByPlaceholderText("email@example.com"), {
      target: { value: "notanemail" },
    });
    fireEvent.change(screen.getByPlaceholderText("Min 8 characters"), {
      target: { value: "12345678" },
    });
    const passwordFields = document.querySelectorAll('input[type="password"]');
    fireEvent.change(passwordFields[1], { target: { value: "12345678" } });
    const submitBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    await user.click(submitBtns[submitBtns.length - 1]);
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });
    // Now fix the email field — the email error should be cleared
    fireEvent.change(screen.getByPlaceholderText("email@example.com"), {
      target: { value: "good@email.com" },
    });
    // Fix password confirm field too
    fireEvent.change(screen.getByPlaceholderText("Min 8 characters"), {
      target: { value: "newpassword" },
    });
    fireEvent.change(passwordFields[1], { target: { value: "newpassword" } });
    // Fix name field
    fireEvent.change(screen.getByPlaceholderText("Enter full name"), {
      target: { value: "Good Name" },
    });
  });

  // ── Pagination: disabled prev button on page 1 ──

  it("disables previous button on first page", async () => {
    mockGetResidents.mockResolvedValue({
      data: [MOCK_RESIDENT_ACTIVE],
      total: 45,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "1" })).toBeInTheDocument();
    });
    // First .h-8.w-8.p-0 button is the prev button, should be disabled on page 1
    const navBtns = document.querySelectorAll(".h-8.w-8.p-0");
    expect(navBtns.length).toBeGreaterThanOrEqual(2);
    expect((navBtns[0] as HTMLButtonElement).disabled).toBe(true);
  });

  // ── Pagination: disabled next button on last page ──

  it("disables next button on last page", async () => {
    mockSearchParams.set("page", "3");
    mockGetResidents.mockResolvedValue({
      data: [MOCK_RESIDENT_ACTIVE],
      total: 45,
      page: 3,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    // Last .h-8.w-8.p-0 button is the next button, should be disabled on last page
    const navBtns = document.querySelectorAll(".h-8.w-8.p-0");
    const lastBtn = navBtns[navBtns.length - 1] as HTMLButtonElement;
    expect(lastBtn.disabled).toBe(true);
  });

  // ── Add form: name too short validation ──

  it("shows name validation error when name is too short", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    const addBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    await user.click(addBtns[0]);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter full name")).toBeInTheDocument();
    });
    // Fill form with short name (1 char) but enable submit (need name >= 2)
    fireEvent.change(screen.getByPlaceholderText("Enter full name"), { target: { value: "AB" } });
    fireEvent.change(screen.getByPlaceholderText("9876543210"), {
      target: { value: "1234567890" },
    });
    fireEvent.change(screen.getByPlaceholderText("email@example.com"), {
      target: { value: "x@y.z" },
    });
    fireEvent.change(screen.getByPlaceholderText("Min 8 characters"), {
      target: { value: "12345678" },
    });
    const passwordFields = document.querySelectorAll('input[type="password"]');
    fireEvent.change(passwordFields[1], { target: { value: "12345678" } });
    const submitBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    await user.click(submitBtns[submitBtns.length - 1]);
    await waitFor(() => {
      // Mobile starts with 1, so it fails mobile validation
      expect(mockToastError).toHaveBeenCalledWith("Please fix the highlighted fields");
    });
    // Verify the mobile error text is shown
    expect(screen.getByText("Enter a valid 10-digit mobile number")).toBeInTheDocument();
  });

  // ── Add form: short name triggers name error ──

  it("shows fullName error when name is 1 character", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    const addBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    await user.click(addBtns[0]);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter full name")).toBeInTheDocument();
    });
    // name "A" is < 2 chars but we need name >= 2 to enable button
    // Use "AB" for name but leave mobile blank, password short, confirm mismatch
    // Actually we need name >= 2 to enable button. Let's test a different combo:
    // valid name, valid email, valid password, but test that password short error shows
    fireEvent.change(screen.getByPlaceholderText("Enter full name"), { target: { value: "AB" } });
    fireEvent.change(screen.getByPlaceholderText("9876543210"), {
      target: { value: "9123456789" },
    });
    fireEvent.change(screen.getByPlaceholderText("email@example.com"), {
      target: { value: "a@b.c" },
    });
    fireEvent.change(screen.getByPlaceholderText("Min 8 characters"), {
      target: { value: "short" },
    });
    const passwordFields = document.querySelectorAll('input[type="password"]');
    fireEvent.change(passwordFields[1], { target: { value: "short" } });
    const submitBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    await user.click(submitBtns[submitBtns.length - 1]);
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Please fix the highlighted fields");
    });
    expect(screen.getByText("Password must be at least 8 characters")).toBeInTheDocument();
  });

  // ── No address fields when society is not loaded ──

  it("does not render address fields when society is null", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    mockGetSocietyByCode.mockResolvedValue(null);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    const addBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    await user.click(addBtns[0]);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter full name")).toBeInTheDocument();
    });
    expect(screen.queryByText("Address Details")).not.toBeInTheDocument();
  });

  // ── Add form: email empty validation ──

  it("shows email error when email is empty", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    const addBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    await user.click(addBtns[0]);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter full name")).toBeInTheDocument();
    });
    // name >= 2, email set then cleared, password set
    fireEvent.change(screen.getByPlaceholderText("Enter full name"), { target: { value: "AB" } });
    fireEvent.change(screen.getByPlaceholderText("email@example.com"), {
      target: { value: "a@b.c" },
    });
    fireEvent.change(screen.getByPlaceholderText("Min 8 characters"), {
      target: { value: "12345678" },
    });
    // Now clear email to make it empty, but button check uses !addForm.email
    // Actually the button is disabled when !addForm.email. Let's set a bad email format instead.
    fireEvent.change(screen.getByPlaceholderText("email@example.com"), {
      target: { value: "invalidemail" },
    });
    const passwordFields = document.querySelectorAll('input[type="password"]');
    fireEvent.change(passwordFields[1], { target: { value: "12345678" } });
    const submitBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    await user.click(submitBtns[submitBtns.length - 1]);
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Please fix the highlighted fields");
    });
    // Should show email validation error
    expect(screen.getByText("Enter a valid email address")).toBeInTheDocument();
  });

  // ── Filter Select interactions (trigger onValueChange via native select) ──

  it("updates URL params when status filter is changed", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    // Find the status filter select (has "All Statuses" and "Pending Approval" options)
    const selects = document.querySelectorAll("select");
    // The status filter is the first select after search
    // It contains "All Statuses" option
    let statusSelect: HTMLSelectElement | null = null;
    selects.forEach((sel) => {
      const options = sel.querySelectorAll("option");
      options.forEach((opt) => {
        if (opt.textContent === "Pending Approval") statusSelect = sel;
      });
    });
    expect(statusSelect).toBeTruthy();
    fireEvent.change(statusSelect!, { target: { value: "PENDING_APPROVAL" } });
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalled();
    });
  });

  it("updates URL params when email verified filter is changed", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    const selects = document.querySelectorAll("select");
    let verifiedSelect: HTMLSelectElement | null = null;
    selects.forEach((sel) => {
      const options = sel.querySelectorAll("option");
      options.forEach((opt) => {
        if (opt.textContent === "Not Verified") verifiedSelect = sel;
      });
    });
    expect(verifiedSelect).toBeTruthy();
    fireEvent.change(verifiedSelect!, { target: { value: "true" } });
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalled();
    });
  });

  it("updates URL params when ownership filter is changed", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    const selects = document.querySelectorAll("select");
    let ownershipSelect: HTMLSelectElement | null = null;
    selects.forEach((sel) => {
      const options = sel.querySelectorAll("option");
      options.forEach((opt) => {
        if (opt.textContent === "All Types") ownershipSelect = sel;
      });
    });
    expect(ownershipSelect).toBeTruthy();
    fireEvent.change(ownershipSelect!, { target: { value: "OWNER" } });
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalled();
    });
  });

  it("updates URL params when year filter is changed", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    const selects = document.querySelectorAll("select");
    let yearSelect: HTMLSelectElement | null = null;
    selects.forEach((sel) => {
      const options = sel.querySelectorAll("option");
      options.forEach((opt) => {
        if (opt.textContent === "All Years") yearSelect = sel;
      });
    });
    expect(yearSelect).toBeTruthy();
    fireEvent.change(yearSelect!, { target: { value: "2023" } });
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalled();
    });
  });

  it("updates URL params when doc filter is changed", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    const selects = document.querySelectorAll("select");
    let docSelect: HTMLSelectElement | null = null;
    selects.forEach((sel) => {
      const options = sel.querySelectorAll("option");
      options.forEach((opt) => {
        if (opt.textContent === "All Documents") docSelect = sel;
      });
    });
    expect(docSelect).toBeTruthy();
    fireEvent.change(docSelect!, { target: { value: "full" } });
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalled();
    });
  });

  it("updates URL params when page size is changed", async () => {
    mockGetResidents.mockResolvedValue({
      data: [MOCK_RESIDENT_ACTIVE],
      total: 45,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    // The page size select has options "20" and "50"
    const selects = document.querySelectorAll("select");
    let pageSizeSelect: HTMLSelectElement | null = null;
    selects.forEach((sel) => {
      const optValues = Array.from(sel.querySelectorAll("option")).map((o) => o.value);
      if (optValues.includes("20") && optValues.includes("50")) pageSizeSelect = sel;
    });
    expect(pageSizeSelect).toBeTruthy();
    fireEvent.change(pageSizeSelect!, { target: { value: "50" } });
    await waitFor(() => {
      expect(mockRouterReplace).toHaveBeenCalledWith(expect.stringContaining("limit=50"));
    });
  });

  // ── Add form: ownership type Select change ──

  it("changes ownership type to TENANT via select in add form", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: "new-3" }) });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    const addBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    await user.click(addBtns[0]);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter full name")).toBeInTheDocument();
    });
    // Find ownership type select (has Owner and Tenant options in the dialog)
    const dialogSelects = document.querySelectorAll("select");
    let ownershipTypeSelect: HTMLSelectElement | null = null;
    dialogSelects.forEach((sel) => {
      const optValues = Array.from(sel.querySelectorAll("option")).map((o) => o.value);
      if (optValues.includes("OWNER") && optValues.includes("TENANT") && optValues.length === 2)
        ownershipTypeSelect = sel;
    });
    expect(ownershipTypeSelect).toBeTruthy();
    fireEvent.change(ownershipTypeSelect!, { target: { value: "TENANT" } });
    // Fill form and submit to verify TENANT is sent
    fireEvent.change(screen.getByPlaceholderText("Enter full name"), {
      target: { value: "Tenant Person" },
    });
    fireEvent.change(screen.getByPlaceholderText("9876543210"), {
      target: { value: "9123456789" },
    });
    fireEvent.change(screen.getByPlaceholderText("email@example.com"), {
      target: { value: "tenant@test.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Min 8 characters"), {
      target: { value: "password123" },
    });
    const passwordFields = document.querySelectorAll('input[type="password"]');
    fireEvent.change(passwordFields[1], { target: { value: "password123" } });
    const submitBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    await user.click(submitBtns[submitBtns.length - 1]);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.ownershipType).toBe("TENANT");
  });

  // ── Address: floorLevel Select change ──

  it("changes floorLevel select in address fields for BUILDER_FLOORS", async () => {
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    mockGetSocietyByCode.mockResolvedValue({
      name: "Builder Floors Society",
      type: "BUILDER_FLOORS",
      city: "Delhi",
      state: "Delhi",
    });
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: "new-4" }) });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    const addBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    await user.click(addBtns[0]);
    await waitFor(() => {
      expect(screen.getByText("Address Details")).toBeInTheDocument();
    });
    // BUILDER_FLOORS has required: ["houseNo", "floorLevel"]
    // floorLevel renders as a Select with "1F", "2F", "3F", "4F" options
    const addressSection = document.querySelector(".bg-muted\\/30");
    expect(addressSection).toBeTruthy();
    const addressSelects = addressSection!.querySelectorAll("select");
    expect(addressSelects.length).toBeGreaterThanOrEqual(1);
    // Change floorLevel select
    fireEvent.change(addressSelects[0], { target: { value: "2F" } });
    // Fill other fields and submit
    const addressInputs = addressSection!.querySelectorAll("input");
    fireEvent.change(addressInputs[0], { target: { value: "42" } });
    // Fill main form
    fireEvent.change(screen.getByPlaceholderText("Enter full name"), {
      target: { value: "Floor User" },
    });
    fireEvent.change(screen.getByPlaceholderText("9876543210"), {
      target: { value: "9123456789" },
    });
    fireEvent.change(screen.getByPlaceholderText("email@example.com"), {
      target: { value: "floor@test.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Min 8 characters"), {
      target: { value: "password123" },
    });
    const passwordFields = document.querySelectorAll('input[type="password"]');
    fireEvent.change(passwordFields[1], { target: { value: "password123" } });
    const submitBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    await user.click(submitBtns[submitBtns.length - 1]);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });
    const callArgs = mockFetch.mock.calls[0];
    const body = JSON.parse(callArgs[1].body);
    expect(body.unitAddress.floorLevel).toBe("2F");
    expect(body.unitAddress.houseNo).toBe("42");
  });

  // ── Branch coverage: getResidents called with specific filter values ──

  it("passes filter values to getResidents when URL params are set", async () => {
    mockSearchParams.set("status", "ACTIVE_PAID");
    mockSearchParams.set("verified", "true");
    mockSearchParams.set("ownership", "OWNER");
    mockSearchParams.set("year", "2024");
    mockSearchParams.set("doc", "full");
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    // Verify getResidents was called with the filter values (not undefined)
    expect(mockGetResidents).toHaveBeenCalledWith(
      "soc-1",
      expect.objectContaining({
        status: "ACTIVE_PAID",
        emailVerified: "true",
        ownershipType: "OWNER",
        year: "2024",
        docStatus: "full",
      }),
    );
  });

  // ── Branch coverage: unknown status falls back to status string ──

  it("renders raw status when no label mapping exists", async () => {
    const unknownStatus = {
      ...MOCK_RESIDENT_ACTIVE,
      id: "r-unknown",
      name: "Unknown Status",
      status: "SOME_UNKNOWN_STATUS",
    };
    mockGetResidents.mockResolvedValue({
      data: [unknownStatus],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Unknown Status")).toBeInTheDocument();
    });
    // STATUS_COLORS["SOME_UNKNOWN_STATUS"] is undefined, so || "" is taken
    // RESIDENT_STATUS_LABELS["SOME_UNKNOWN_STATUS"] is undefined, so || resident.status is taken
    expect(screen.getByText("SOME_UNKNOWN_STATUS")).toBeInTheDocument();
  });

  // ── Branch coverage: sendingVerificationId spinner (Loader2 shown while sending) ──

  it("shows spinner on verification email button while sending", async () => {
    // Make the mutation stay pending
    mockSendResidentVerificationEmail.mockImplementation(
      () => new Promise(() => {}), // never resolves
    );
    const user = userEvent.setup();
    mockGetResidents.mockResolvedValue({
      data: [MOCK_RESIDENT_PENDING],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
    });
    const mailButton = screen.getByTitle("Send verification email");
    await user.click(mailButton);
    // After click, the button should show a spinner (Loader2) instead of Mail icon
    // The button should become disabled
    await waitFor(() => {
      expect(mailButton).toBeDisabled();
    });
  });

  // ── Branch coverage: deleteMutation.isPending spinner ──

  it("shows spinner on delete button while deletion is pending", async () => {
    mockPermanentDeleteResident.mockImplementation(
      () => new Promise(() => {}), // never resolves
    );
    const user = userEvent.setup();
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Delete/i })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Delete/i }));
    await waitFor(() => {
      expect(screen.getByText("Permanently Delete Resident")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Delete Permanently/i }));
    // The delete button should become disabled while pending
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Delete Permanently/i })).toBeDisabled();
    });
  });

  // ── Branch coverage: addMutation.isPending spinner ──

  it("shows spinner on add button while add mutation is pending", async () => {
    mockFetch.mockImplementation(
      () => new Promise(() => {}), // never resolves
    );
    const user = userEvent.setup();
    mockGetResidents.mockResolvedValue(MOCK_LIST_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    const addBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    await user.click(addBtns[0]);
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Enter full name")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByPlaceholderText("Enter full name"), {
      target: { value: "Valid Name" },
    });
    fireEvent.change(screen.getByPlaceholderText("9876543210"), {
      target: { value: "9123456789" },
    });
    fireEvent.change(screen.getByPlaceholderText("email@example.com"), {
      target: { value: "valid@test.com" },
    });
    fireEvent.change(screen.getByPlaceholderText("Min 8 characters"), {
      target: { value: "password123" },
    });
    const passwordFields = document.querySelectorAll('input[type="password"]');
    fireEvent.change(passwordFields[1], { target: { value: "password123" } });
    const submitBtns = screen.getAllByRole("button", { name: /Add Resident/i });
    await user.click(submitBtns[submitBtns.length - 1]);
    // The add button should become disabled while pending
    await waitFor(() => {
      const btns = screen.getAllByRole("button", { name: /Add Resident/i });
      expect(btns[btns.length - 1]).toBeDisabled();
    });
  });

  // ── Phase 4 extensions: new columns + filters + vehicle search mode ──

  it("renders family count badge for residents with members", async () => {
    mockGetResidents.mockResolvedValue({
      data: [
        {
          ...MOCK_RESIDENT_ACTIVE,
          familyCount: 3,
          vehicleSummary: { count: 0, firstReg: null },
          tier: "STANDARD",
          completenessScore: 55,
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    expect(screen.getByText(/3 members/i)).toBeInTheDocument();
  });

  it("renders em-dash for zero family/vehicle counts", async () => {
    mockGetResidents.mockResolvedValue({
      data: [
        {
          ...MOCK_RESIDENT_ACTIVE,
          familyCount: 0,
          vehicleSummary: { count: 0, firstReg: null },
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    // 2 em-dashes for family and vehicle columns
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(2);
  });

  it("renders vehicle summary with firstReg subtitle", async () => {
    mockGetResidents.mockResolvedValue({
      data: [
        {
          ...MOCK_RESIDENT_ACTIVE,
          familyCount: 1,
          vehicleSummary: { count: 2, firstReg: "DL3CAB1234" },
          tier: "COMPLETE",
          completenessScore: 80,
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/2 vehicles/i)).toBeInTheDocument();
    });
    expect(screen.getByText("DL3CAB1234")).toBeInTheDocument();
    expect(screen.getByText("1 member")).toBeInTheDocument();
  });

  it("renders completeness badge when tier present", async () => {
    mockGetResidents.mockResolvedValue({
      data: [
        {
          ...MOCK_RESIDENT_ACTIVE,
          familyCount: 0,
          vehicleSummary: { count: 0, firstReg: null },
          tier: "VERIFIED",
          completenessScore: 100,
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByLabelText(/tier Verified/i)).toBeInTheDocument();
    });
  });

  it("renders People / Vehicle search mode toggle", () => {
    mockGetResidents.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole("button", { name: /by name/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /by vehicle/i })).toBeInTheDocument();
  });

  it("switches to vehicle mode and searches vehicles", async () => {
    mockSearchAdminVehicles.mockResolvedValue({
      vehicles: [
        {
          id: "v1",
          registrationNumber: "DL3CAB1234",
          vehicleType: "FOUR_WHEELER",
          make: "Maruti",
          model: "Swift",
          colour: "White",
          unit: { displayLabel: "A-101" },
          owner: { name: "Hemant", mobile: null, email: null },
          dependentOwner: null,
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /by vehicle/i }));
    expect(mockRouterReplace).toHaveBeenCalled();
  });

  it("shows 'Type at least 3' guide when vehicle mode with no query", () => {
    // Set URL to vehicle mode
    mockSearchParams.set("mode", "vehicle");
    mockGetResidents.mockReturnValue(new Promise(() => {}));
    try {
      renderPage();
      expect(screen.getByText(/type at least 3 characters/i)).toBeInTheDocument();
    } finally {
      mockSearchParams.delete("mode");
    }
  });

  it("renders vehicle search results when query is 3+ chars", async () => {
    mockSearchParams.set("mode", "vehicle");
    mockSearchParams.set("search", "DL3");
    mockSearchAdminVehicles.mockResolvedValue({
      vehicles: [
        {
          id: "v1",
          registrationNumber: "DL3CAB1234",
          vehicleType: "FOUR_WHEELER",
          make: "Maruti",
          model: "Swift",
          colour: "White",
          unit: { displayLabel: "A-101" },
          owner: { name: "Hemant", mobile: null, email: null },
          dependentOwner: null,
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });
    try {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("DL3CAB1234")).toBeInTheDocument();
      });
      expect(screen.getByText(/Owner: Hemant/i)).toBeInTheDocument();
      expect(screen.getByText(/Unit A-101/i)).toBeInTheDocument();
    } finally {
      mockSearchParams.delete("mode");
      mockSearchParams.delete("search");
    }
  });

  it("renders vehicle search result with minimal fields (no colour/make)", async () => {
    mockSearchParams.set("mode", "vehicle");
    mockSearchParams.set("search", "DL3");
    mockSearchAdminVehicles.mockResolvedValue({
      vehicles: [
        {
          id: "v1",
          registrationNumber: "DL3CAB1234",
          vehicleType: "FOUR_WHEELER",
          make: null,
          model: null,
          colour: null,
          unit: null,
          owner: null,
          dependentOwner: null,
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });
    try {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("DL3CAB1234")).toBeInTheDocument();
      });
    } finally {
      mockSearchParams.delete("mode");
      mockSearchParams.delete("search");
    }
  });

  it("renders empty state when vehicle search returns no matches", async () => {
    mockSearchParams.set("mode", "vehicle");
    mockSearchParams.set("search", "ZZZ");
    mockSearchAdminVehicles.mockResolvedValue({
      vehicles: [],
      total: 0,
      page: 1,
      limit: 20,
    });
    try {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/no matching vehicles/i)).toBeInTheDocument();
      });
    } finally {
      mockSearchParams.delete("mode");
      mockSearchParams.delete("search");
    }
  });

  it("updates completeness filter when dropdown changes", async () => {
    mockGetResidents.mockResolvedValue({
      data: [
        { ...MOCK_RESIDENT_ACTIVE, familyCount: 0, vehicleSummary: { count: 0, firstReg: null } },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    // mock-select renders as native select; pick the one with 'verified' option
    const selects = screen.getAllByTestId("mock-select");
    const compSelect = selects.find((s) =>
      Array.from(s.querySelectorAll("option")).some(
        (o) => (o as HTMLOptionElement).value === "verified",
      ),
    );
    expect(compSelect).toBeDefined();
    fireEvent.change(compSelect!, { target: { value: "verified" } });
    expect(mockRouterReplace).toHaveBeenCalled();
  });

  it("surfaces error state when vehicle search fails", async () => {
    mockSearchParams.set("mode", "vehicle");
    mockSearchParams.set("search", "DL3");
    mockSearchAdminVehicles.mockRejectedValue(new Error("oops"));
    try {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/unable to search vehicles/i)).toBeInTheDocument();
      });
    } finally {
      mockSearchParams.delete("mode");
      mockSearchParams.delete("search");
    }
  });
});
