import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));
const mockUseAuthClaims = vi.hoisted(() => vi.fn(() => ({ user: { societyId: "soc-1" } })));
globalThis.fetch = mockFetch;

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: mockUseAuthClaims,
}));
vi.mock("@/components/ui/LoadingSkeleton", () => ({
  PageSkeleton: () => <div data-testid="page-skeleton" />,
}));
vi.mock("@/components/features/payments/PendingClaimCard", () => ({
  PendingClaimCard: ({
    claim,
    onVerify,
    onReject,
  }: {
    claim: { id: string; status: string; utrNumber: string };
    onVerify: (id: string) => void;
    onReject: (id: string, reason: string) => void;
    isPending: boolean;
  }) => (
    <div data-testid={`claim-card-${claim.id}`}>
      <span>{claim.utrNumber}</span>
      <button onClick={() => onVerify(claim.id)}>verify-{claim.id}</button>
      <button onClick={() => onReject(claim.id, "UTR not found in bank statement")}>
        reject-{claim.id}
      </button>
    </div>
  ),
}));

import AdminClaimsPage from "@/app/admin/fees/claims/page";

const mockToast = vi.mocked(toast);

const mockClaim = {
  id: "claim-1",
  societyId: "soc-1",
  userId: "user-1",
  membershipFeeId: "fee-1",
  claimedAmount: 2000,
  utrNumber: "UTR123456789012",
  paymentDate: "2026-04-04T00:00:00Z",
  screenshotUrl: null,
  status: "PENDING",
  verifiedBy: null,
  verifiedAt: null,
  rejectionReason: null,
  adminNotes: null,
  createdAt: "2026-04-04T10:00:00Z",
  updatedAt: "2026-04-04T10:00:00Z",
  user: { name: "Hemant Kumar", flatNumber: "302" },
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AdminClaimsPage />
    </QueryClientProvider>,
  );
}

describe("AdminClaimsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading skeleton while fetching", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId("page-skeleton")).toBeInTheDocument();
  });

  it("shows empty state when no claims", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ claims: [], total: 0, page: 1, pageSize: 20 }),
    });
    renderPage();
    await waitFor(() => expect(screen.getByText(/no claims found/i)).toBeInTheDocument());
  });

  it("renders claim cards when claims exist", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ claims: [mockClaim], total: 1, page: 1, pageSize: 20 }),
    });
    renderPage();
    await waitFor(() => expect(screen.getByTestId("claim-card-claim-1")).toBeInTheDocument());
    expect(screen.getByText("UTR123456789012")).toBeInTheDocument();
  });

  it("shows total count in page header", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ claims: [mockClaim], total: 3, page: 1, pageSize: 20 }),
    });
    renderPage();
    await waitFor(() => expect(screen.getByText(/\[3\]/)).toBeInTheDocument());
  });

  it("calls verify API and shows success toast", async () => {
    const user = userEvent.setup();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ claims: [mockClaim], total: 1, page: 1, pageSize: 20 }),
      })
      .mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ claim: { ...mockClaim, status: "VERIFIED" } }),
      });
    renderPage();
    await waitFor(() => screen.getByTestId("claim-card-claim-1"));
    await user.click(screen.getByRole("button", { name: /verify-claim-1/i }));
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith("Payment claim verified"));
  });

  it("calls reject API and shows success toast", async () => {
    const user = userEvent.setup();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ claims: [mockClaim], total: 1, page: 1, pageSize: 20 }),
      })
      .mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ claim: { ...mockClaim, status: "REJECTED" } }),
      });
    renderPage();
    await waitFor(() => screen.getByTestId("claim-card-claim-1"));
    await user.click(screen.getByRole("button", { name: /reject-claim-1/i }));
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith("Payment claim rejected"));
  });

  it("shows error toast when verify fails", async () => {
    const user = userEvent.setup();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ claims: [mockClaim], total: 1, page: 1, pageSize: 20 }),
      })
      .mockResolvedValue({ ok: false, text: () => Promise.resolve("CLAIM_ALREADY_PROCESSED") });
    renderPage();
    await waitFor(() => screen.getByTestId("claim-card-claim-1"));
    await user.click(screen.getByRole("button", { name: /verify-claim-1/i }));
    await waitFor(() => expect(mockToast.error).toHaveBeenCalled());
  });

  it("shows error toast when reject fails", async () => {
    const user = userEvent.setup();
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ claims: [mockClaim], total: 1, page: 1, pageSize: 20 }),
      })
      .mockResolvedValue({ ok: false, text: () => Promise.resolve("Rejection failed") });
    renderPage();
    await waitFor(() => screen.getByTestId("claim-card-claim-1"));
    await user.click(screen.getByRole("button", { name: /reject-claim-1/i }));
    await waitFor(() => expect(mockToast.error).toHaveBeenCalled());
  });

  it("shows status filter and renders correctly for filter change", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ claims: [], total: 0, page: 1, pageSize: 20 }),
    });
    renderPage();
    await waitFor(() => screen.getByText(/no claims found/i));
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("shows non-ALL empty state description when filter is PENDING", async () => {
    const user = userEvent.setup();
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ claims: [], total: 0, page: 1, pageSize: 20 }),
    });
    renderPage();
    await waitFor(() => screen.getByText(/no claims found/i));

    // Click the filter combobox and select "Pending"
    await user.click(screen.getByRole("combobox"));
    const pendingOption = await screen.findByRole("option", { name: /pending/i });
    await user.click(pendingOption);

    await waitFor(() => expect(screen.getByText("No pending claims.")).toBeInTheDocument());
  });

  it("renders without crashing when user has no societyId", () => {
    mockUseAuthClaims.mockReturnValueOnce({ user: null });
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ claims: [], total: 0, page: 1, pageSize: 20 }),
    });
    renderPage();
    // query is disabled when societyId is "" — page renders without loading skeleton
    expect(screen.queryByTestId("page-skeleton")).not.toBeInTheDocument();
  });
});
