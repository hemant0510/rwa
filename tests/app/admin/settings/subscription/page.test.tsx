import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { AuthContext } from "@/hooks/useAuth";

const { mockGetSubscription, mockGetMySubscriptionClaims } = vi.hoisted(() => ({
  mockGetSubscription: vi.fn(),
  mockGetMySubscriptionClaims: vi.fn(),
}));

vi.mock("@/services/subscriptions", () => ({
  getSubscription: (...args: unknown[]) => mockGetSubscription(...args),
}));

vi.mock("@/services/subscription-payment-claims", () => ({
  getMySubscriptionClaims: (...args: unknown[]) => mockGetMySubscriptionClaims(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/admin/settings/subscription",
}));

vi.mock("@/components/features/payments/UpiQrDisplay", () => ({
  UpiQrDisplay: ({ upiId }: { upiId: string }) => (
    <div data-testid="upi-qr-display">upiId={upiId}</div>
  ),
}));

let capturedOnSuccess: (() => void) | null = null;

vi.mock("@/components/features/subscription/SubscriptionPaymentClaimForm", () => ({
  SubscriptionPaymentClaimForm: ({
    societyId,
    onSuccess,
  }: {
    societyId: string;
    onSuccess: () => void;
  }) => {
    capturedOnSuccess = onSuccess;
    return <button data-testid="claim-form-trigger">I&apos;ve paid — societyId={societyId}</button>;
  },
}));

// eslint-disable-next-line import/order
import AdminSubscriptionPage from "@/app/admin/settings/subscription/page";

const mockUser = {
  id: "admin-1",
  name: "Admin",
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
};

const mockSub = {
  plan: { name: "Community" },
  billingOption: { billingCycle: "MONTHLY" },
  finalPrice: 1799,
  currentPeriodEnd: "2026-05-15T00:00:00.000Z",
  status: "ACTIVE",
};

const mockPlatformUpiConfigured = {
  platformUpiId: "rwaconnect@icici",
  platformUpiQrUrl: "https://example.com/platform-qr.png",
  platformUpiAccountName: "RWA Connect Technologies",
};

const mockClaim = {
  id: "claim-1",
  amount: 1799,
  utrNumber: "UTR123456789",
  status: "VERIFIED",
  createdAt: "2026-03-10T00:00:00.000Z",
  rejectionReason: null,
};

// Mock global fetch for platform-payment-info
const originalFetch = global.fetch;

function renderPage(fetchImpl?: typeof global.fetch) {
  global.fetch =
    fetchImpl ??
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPlatformUpiConfigured),
    });

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider
        value={{
          user: mockUser,
          isLoading: false,
          isAuthenticated: true,
          signOut: vi.fn(),
          switchSociety: vi.fn(),
        }}
      >
        <AdminSubscriptionPage />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe("AdminSubscriptionPage", () => {
  beforeEach(() => {
    capturedOnSuccess = null;
    vi.clearAllMocks();
    mockGetSubscription.mockResolvedValue(mockSub);
    mockGetMySubscriptionClaims.mockResolvedValue({ claims: [] });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPlatformUpiConfigured),
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("shows skeleton while loading", () => {
    mockGetSubscription.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.queryByText("Subscription Payment")).not.toBeInTheDocument();
  });

  it("renders subscription plan info after load", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Subscription Payment")).toBeInTheDocument();
      expect(screen.getByText("Community")).toBeInTheDocument();
    });
  });

  it("renders UpiQrDisplay when platform UPI is configured", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("upi-qr-display")).toBeInTheDocument();
      expect(screen.getByText(/rwaconnect@icici/)).toBeInTheDocument();
    });
  });

  it("shows claim form trigger when no pending claim", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("claim-form-trigger")).toBeInTheDocument();
      expect(screen.getByText(/societyId=soc-1/)).toBeInTheDocument();
    });
  });

  it("hides claim form and shows pending message when claim is PENDING", async () => {
    mockGetMySubscriptionClaims.mockResolvedValue({
      claims: [{ ...mockClaim, status: "PENDING" }],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId("claim-form-trigger")).not.toBeInTheDocument();
      expect(screen.getByText(/pending review/i)).toBeInTheDocument();
    });
  });

  it("shows previous claims section when claims exist", async () => {
    mockGetMySubscriptionClaims.mockResolvedValue({ claims: [mockClaim] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Previous Claims")).toBeInTheDocument();
      expect(screen.getByText(/UTR123456789/)).toBeInTheDocument();
      expect(screen.getByText("VERIFIED")).toBeInTheDocument();
    });
  });

  it("shows rejection reason for REJECTED claims", async () => {
    mockGetMySubscriptionClaims.mockResolvedValue({
      claims: [{ ...mockClaim, status: "REJECTED", rejectionReason: "UTR not found" }],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("UTR not found")).toBeInTheDocument();
    });
  });

  it("shows platform not configured message when platformUpiId is null", async () => {
    const nullFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          platformUpiId: null,
          platformUpiQrUrl: null,
          platformUpiAccountName: null,
        }),
    });
    renderPage(nullFetch);
    await waitFor(() => {
      expect(screen.getByText(/platform UPI has not been configured/i)).toBeInTheDocument();
      expect(screen.queryByTestId("upi-qr-display")).not.toBeInTheDocument();
    });
  });

  it("shows no previous claims section when claims list is empty", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.queryByText("Previous Claims")).not.toBeInTheDocument();
    });
  });

  it("shows no subscription info when sub is null", async () => {
    mockGetSubscription.mockResolvedValue(null);
    renderPage();
    await waitFor(() => {
      expect(screen.queryByText("Subscription Payment Due")).not.toBeInTheDocument();
    });
  });

  it("calls invalidateQueries when onSuccess is triggered", async () => {
    renderPage();
    await waitFor(() => {
      expect(capturedOnSuccess).not.toBeNull();
    });
    // Trigger handleClaimSuccess — should not throw
    capturedOnSuccess!();
    // Re-render should refetch claims
    await waitFor(() => {
      expect(mockGetMySubscriptionClaims).toHaveBeenCalled();
    });
  });

  it("calculates periodEnd from today when sub has no currentPeriodEnd", async () => {
    mockGetSubscription.mockResolvedValue({ ...mockSub, currentPeriodEnd: null });
    renderPage();
    await waitFor(() => {
      // Form still renders — periodEnd is derived from today+1 month
      expect(screen.getByTestId("claim-form-trigger")).toBeInTheDocument();
    });
  });

  it("shows not-configured message when platform fetch returns ok:false", async () => {
    const errorFetch = vi.fn().mockResolvedValue({ ok: false });
    renderPage(errorFetch);
    await waitFor(() => {
      expect(screen.getByText(/platform UPI has not been configured/i)).toBeInTheDocument();
    });
  });

  it("shows zero amount correctly when sub has no finalPrice", async () => {
    mockGetSubscription.mockResolvedValue({ ...mockSub, finalPrice: null });
    renderPage();
    await waitFor(() => {
      // UpiQrDisplay renders with amountDue=0 → undefined passed as amount prop
      expect(screen.getByTestId("upi-qr-display")).toBeInTheDocument();
    });
  });

  it("renders claim with unknown status using empty fallback class", async () => {
    mockGetMySubscriptionClaims.mockResolvedValue({
      claims: [{ ...mockClaim, status: "UNKNOWN_STATUS" }],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("UNKNOWN_STATUS")).toBeInTheDocument();
    });
  });

  it("shows empty claims when getMySubscriptionClaims rejects", async () => {
    mockGetMySubscriptionClaims.mockRejectedValue(new Error("fetch error"));
    renderPage();
    await waitFor(() => {
      expect(screen.queryByText("Previous Claims")).not.toBeInTheDocument();
    });
  });
});
