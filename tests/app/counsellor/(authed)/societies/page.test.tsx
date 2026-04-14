import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetSocieties = vi.hoisted(() => vi.fn());

vi.mock("@/services/counsellor-self", () => ({ getSocieties: mockGetSocieties }));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";

import CounsellorSocietiesPage from "@/app/counsellor/(authed)/societies/page";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CounsellorSocietiesPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CounsellorSocietiesPage", () => {
  it("renders loading skeleton", () => {
    mockGetSocieties.mockImplementation(() => new Promise(() => {}));
    const { container } = renderPage();
    expect(container.querySelector('[class*="animate-pulse"]')).toBeTruthy();
  });

  it("renders error banner", async () => {
    mockGetSocieties.mockRejectedValue(new Error("boom"));
    renderPage();
    await waitFor(() => expect(screen.getByText(/Failed to load societies/)).toBeInTheDocument());
  });

  it("renders empty state when no societies", async () => {
    mockGetSocieties.mockResolvedValue({ societies: [] });
    renderPage();
    await waitFor(() => expect(screen.getByText(/You have not been assigned/)).toBeInTheDocument());
  });

  it("renders list with primary badge and society metadata", async () => {
    mockGetSocieties.mockResolvedValue({
      societies: [
        {
          id: "s-1",
          name: "Alpha",
          societyCode: "ALPHA",
          city: "Pune",
          state: "MH",
          totalUnits: 120,
          assignedAt: "2026-01-01",
          isPrimary: true,
        },
        {
          id: "s-2",
          name: "Beta",
          societyCode: "BETA",
          city: "Mumbai",
          state: "MH",
          totalUnits: 80,
          assignedAt: "2026-01-02",
          isPrimary: false,
        },
      ],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Alpha")).toBeInTheDocument());
    expect(screen.getByText("Beta")).toBeInTheDocument();
    expect(screen.getByText("Primary")).toBeInTheDocument();
    expect(screen.getByText(/ALPHA · Pune, MH · 120 units/)).toBeInTheDocument();
  });
});
