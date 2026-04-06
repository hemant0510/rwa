import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetPlatformPaymentSetup = vi.hoisted(() => vi.fn());

vi.mock("@/services/payment-setup", () => ({
  getPlatformPaymentSetup: (...args: unknown[]) => mockGetPlatformPaymentSetup(...args),
}));

vi.mock("@/components/features/settings/PlatformPaymentSetupForm", () => ({
  PlatformPaymentSetupForm: () => <div data-testid="platform-payment-form">PlatformForm</div>,
}));

import PlatformPaymentSetupPage from "@/app/sa/settings/payments/page";

const mockSetupData = {
  platformUpiId: "platform@upi",
  platformUpiQrUrl: "https://example.com/qr.png",
  platformUpiAccountName: "Platform Account",
};

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PlatformPaymentSetupPage />
    </QueryClientProvider>,
  );
}

describe("PlatformPaymentSetupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows skeleton while loading", () => {
    mockGetPlatformPaymentSetup.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.queryByTestId("platform-payment-form")).not.toBeInTheDocument();
  });

  it("renders page header with correct title", async () => {
    mockGetPlatformPaymentSetup.mockResolvedValue(mockSetupData);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Payment Setup")).toBeInTheDocument();
    });
  });

  it("renders page description", async () => {
    mockGetPlatformPaymentSetup.mockResolvedValue(mockSetupData);
    renderPage();
    await waitFor(() => {
      expect(
        screen.getByText("Configure platform UPI details for subscription payment collection"),
      ).toBeInTheDocument();
    });
  });

  it("renders PlatformPaymentSetupForm after data loads", async () => {
    mockGetPlatformPaymentSetup.mockResolvedValue(mockSetupData);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("platform-payment-form")).toBeInTheDocument();
    });
  });

  it("calls getPlatformPaymentSetup on mount", async () => {
    mockGetPlatformPaymentSetup.mockResolvedValue(mockSetupData);
    renderPage();
    await waitFor(() => {
      expect(mockGetPlatformPaymentSetup).toHaveBeenCalled();
    });
  });

  it("does not render form when data is null", async () => {
    mockGetPlatformPaymentSetup.mockResolvedValue(null);
    renderPage();
    await waitFor(() => {
      expect(mockGetPlatformPaymentSetup).toHaveBeenCalled();
    });
    expect(screen.queryByTestId("platform-payment-form")).not.toBeInTheDocument();
  });
});
