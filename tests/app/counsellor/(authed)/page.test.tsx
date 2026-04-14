import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetDashboard = vi.hoisted(() => vi.fn());

vi.mock("@/services/counsellor-self", () => ({ getDashboard: mockGetDashboard }));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";

import CounsellorDashboardPage from "@/app/counsellor/(authed)/page";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CounsellorDashboardPage />
    </QueryClientProvider>,
  );
}

const dashboard = {
  counsellor: { id: "c-1", name: "Asha Patel", email: "asha@x.com", photoUrl: null },
  totals: { societies: 3, residents: 180, openEscalations: 4, pendingAck: 2 },
  societies: [
    {
      id: "s-1",
      name: "Alpha",
      societyCode: "ALPHA",
      city: "Pune",
      state: "MH",
      totalUnits: 120,
      isPrimary: true,
      openEscalations: 3,
    },
    {
      id: "s-2",
      name: "Beta",
      societyCode: "BETA",
      city: "Mumbai",
      state: "MH",
      totalUnits: 80,
      isPrimary: false,
      openEscalations: 0,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CounsellorDashboardPage", () => {
  it("renders loading skeleton initially", () => {
    mockGetDashboard.mockImplementation(() => new Promise(() => {}));
    const { container } = renderPage();
    expect(container.querySelector('[class*="animate-pulse"]')).toBeTruthy();
    expect(screen.getByText(/Welcome$/)).toBeInTheDocument();
  });

  it("renders error banner on failure", async () => {
    mockGetDashboard.mockRejectedValue(new Error("server"));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Failed to load dashboard/)).toBeInTheDocument();
    });
  });

  it("renders totals, greeting, and portfolio with escalation badge", async () => {
    mockGetDashboard.mockResolvedValue(dashboard);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Welcome, Asha/)).toBeInTheDocument();
    });
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("180")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("3 open")).toBeInTheDocument();
    expect(screen.getByText("Primary")).toBeInTheDocument();
  });

  it("renders empty state when no societies assigned", async () => {
    mockGetDashboard.mockResolvedValue({
      ...dashboard,
      totals: { societies: 0, residents: 0, openEscalations: 0, pendingAck: 0 },
      societies: [],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/No societies assigned yet/)).toBeInTheDocument();
    });
  });
});
