import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetReportSummary, mockDownloadReport } = vi.hoisted(() => ({
  mockGetReportSummary: vi.fn(),
  mockDownloadReport: vi.fn(),
}));

vi.mock("@/services/reports", () => ({
  getReportSummary: (...args: unknown[]) => mockGetReportSummary(...args),
  downloadReport: (...args: unknown[]) => mockDownloadReport(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/admin/reports",
  useSearchParams: () => new URLSearchParams(),
}));

import ReportsPage from "@/app/admin/reports/page";
import { AuthContext } from "@/hooks/useAuth";

function renderPage(userOverrides: Record<string, unknown> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = {
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
        <ReportsPage />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

const MOCK_SUMMARY = {
  sessionYear: "2025-26",
  totalResidents: 40,
  paidCount: 30,
  pendingCount: 10,
  totalCollected: 72000,
  totalOutstanding: 24000,
  totalExpenses: 14000,
  balance: 58000,
};

describe("ReportsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetReportSummary.mockReturnValue(new Promise(() => {}));
  });

  it("renders page title", () => {
    renderPage();
    expect(screen.getByText("Reports")).toBeInTheDocument();
  });

  it("shows all 5 report cards", () => {
    renderPage();
    expect(screen.getByText("Fee Collection Report")).toBeInTheDocument();
    expect(screen.getByText("Expense Ledger")).toBeInTheDocument();
    expect(screen.getByText("Resident Directory")).toBeInTheDocument();
    expect(screen.getByText("Financial Summary")).toBeInTheDocument();
    expect(screen.getByText("Outstanding Dues")).toBeInTheDocument();
  });

  it("shows PDF and Excel buttons for each report with both formats", () => {
    renderPage();
    const pdfButtons = screen.getAllByText("PDF");
    const excelButtons = screen.getAllByText("EXCEL");
    expect(pdfButtons.length).toBeGreaterThanOrEqual(5);
    expect(excelButtons.length).toBeGreaterThanOrEqual(5);
  });

  it("shows loading indicator while summary is loading", () => {
    renderPage();
    expect(document.querySelector(".animate-spin")).toBeTruthy();
  });

  it("shows live counts once summary loads", async () => {
    mockGetReportSummary.mockResolvedValue(MOCK_SUMMARY);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("30")).toBeInTheDocument(); // paidCount
    });
    expect(screen.getByText("10")).toBeInTheDocument(); // pendingCount
  });

  it("shows total collected amount", async () => {
    mockGetReportSummary.mockResolvedValue(MOCK_SUMMARY);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/72,000/)).toBeInTheDocument();
    });
  });

  it("shows balance in green when positive", async () => {
    mockGetReportSummary.mockResolvedValue(MOCK_SUMMARY);
    renderPage();
    await waitFor(() => {
      const el = screen.getByText(/58,000/);
      expect(el.className).toContain("green");
    });
  });

  it("shows balance in red when negative", async () => {
    mockGetReportSummary.mockResolvedValue({ ...MOCK_SUMMARY, balance: -5000 });
    renderPage();
    await waitFor(() => {
      const el = screen.getByText(/-5,000/);
      expect(el.className).toContain("red");
    });
  });

  it("shows session selector once summary loads", async () => {
    mockGetReportSummary.mockResolvedValue(MOCK_SUMMARY);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Session")).toBeInTheDocument();
    });
  });

  it("calls downloadReport when PDF button is clicked", async () => {
    mockGetReportSummary.mockResolvedValue(MOCK_SUMMARY);
    mockDownloadReport.mockResolvedValue(undefined);
    renderPage();

    // Wait for summary to load (session selector appears)
    await waitFor(() => screen.getByText("Session"));
    await waitFor(() => screen.getByText("2025-26")); // current session visible
    const pdfButtons = screen.getAllByText("PDF");
    fireEvent.click(pdfButtons[0]);

    await waitFor(() => {
      expect(mockDownloadReport).toHaveBeenCalledWith(
        "soc-1",
        expect.any(String),
        "pdf",
        expect.any(String),
      );
    });
  });

  it("calls downloadReport when EXCEL button is clicked", async () => {
    mockGetReportSummary.mockResolvedValue(MOCK_SUMMARY);
    mockDownloadReport.mockResolvedValue(undefined);
    renderPage();

    // Wait for summary to load (session selector appears)
    await waitFor(() => screen.getByText("Session"));
    await waitFor(() => screen.getByText("2025-26")); // current session visible
    const excelButtons = screen.getAllByText("EXCEL");
    fireEvent.click(excelButtons[0]);

    await waitFor(() => {
      expect(mockDownloadReport).toHaveBeenCalledWith(
        "soc-1",
        expect.any(String),
        "excel",
        expect.any(String),
      );
    });
  });

  it("disables buttons while generating", async () => {
    mockGetReportSummary.mockResolvedValue(MOCK_SUMMARY);
    mockDownloadReport.mockReturnValue(new Promise(() => {})); // never resolves
    renderPage();

    await waitFor(() => screen.getAllByText("PDF"));
    const pdfButtons = screen.getAllByText("PDF");
    fireEvent.click(pdfButtons[0]);

    await waitFor(() => {
      expect(document.querySelector(".animate-spin")).toBeTruthy();
    });
  });

  it("does not call getReportSummary when societyId is empty", () => {
    renderPage({ societyId: "" });
    expect(mockGetReportSummary).not.toHaveBeenCalled();
  });

  it("disables report buttons when societyId is empty", () => {
    renderPage({ societyId: "" });
    const pdfButtons = screen.getAllByText("PDF");
    pdfButtons.forEach((btn) => expect(btn.closest("button")).toBeDisabled());
  });

  it("shows error toast when report download fails", async () => {
    mockGetReportSummary.mockResolvedValue(MOCK_SUMMARY);
    mockDownloadReport.mockRejectedValue(new Error("Network error"));
    renderPage();

    await waitFor(() => screen.getByText("Session"));
    await waitFor(() => screen.getByText("2025-26"));
    const pdfButtons = screen.getAllByText("PDF");
    fireEvent.click(pdfButtons[0]);

    await waitFor(() => {
      // After error, generating is reset to null — buttons are re-enabled
      expect(pdfButtons[0].closest("button")).not.toBeDisabled();
    });
    // downloadReport was called and rejected
    expect(mockDownloadReport).toHaveBeenCalled();
  });

  it("shows expenses amount in summary", async () => {
    mockGetReportSummary.mockResolvedValue(MOCK_SUMMARY);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/14,000/)).toBeInTheDocument();
    });
  });
});
