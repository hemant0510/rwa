import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { AuthContext } from "@/hooks/useAuth";

const { mockGetPaymentSetup } = vi.hoisted(() => ({
  mockGetPaymentSetup: vi.fn(),
}));

vi.mock("@/services/payment-setup", () => ({
  getPaymentSetup: (...args: unknown[]) => mockGetPaymentSetup(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/components/features/settings/PaymentSetupForm", () => ({
  PaymentSetupForm: ({ societyId }: { societyId: string }) => (
    <div data-testid="payment-setup-form">societyId={societyId}</div>
  ),
}));

// eslint-disable-next-line import/order
import PaymentSetupPage from "@/app/admin/settings/payment-setup/page";

const mockUser = {
  id: "admin-1",
  name: "Admin",
  role: "RWA_ADMIN" as const,
  permission: "FULL_ACCESS" as const,
  societyId: "soc-1",
  societyName: "Greenwood Residency",
  societyCode: "GRNW",
  societyStatus: "ACTIVE",
  trialEndsAt: null,
  isTrialExpired: false,
  multiSociety: false,
  societies: null,
};

const mockUpiSettings = {
  upiId: "edenestate@sbi",
  upiQrUrl: "https://example.com/qr.png",
  upiAccountName: "Greenwood Residency RWA",
};

function renderPage() {
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
        <PaymentSetupPage />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe("PaymentSetupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows skeleton while loading", () => {
    mockGetPaymentSetup.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(document.querySelector("[data-testid='payment-setup-form']")).not.toBeInTheDocument();
  });

  it("renders PaymentSetupForm with correct societyId after data loads", async () => {
    mockGetPaymentSetup.mockResolvedValue(mockUpiSettings);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("payment-setup-form")).toBeInTheDocument();
      expect(screen.getByText("societyId=soc-1")).toBeInTheDocument();
    });
  });

  it("calls getPaymentSetup with the correct societyId", async () => {
    mockGetPaymentSetup.mockResolvedValue(mockUpiSettings);
    renderPage();
    await waitFor(() => {
      expect(mockGetPaymentSetup).toHaveBeenCalledWith("soc-1");
    });
  });

  it("renders the page header", async () => {
    mockGetPaymentSetup.mockResolvedValue(mockUpiSettings);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Payment Setup")).toBeInTheDocument();
    });
  });
});
