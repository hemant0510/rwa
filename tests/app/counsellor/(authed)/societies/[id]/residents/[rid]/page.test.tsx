import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetResident = vi.hoisted(() => vi.fn());
const mockUseParams = vi.hoisted(() => vi.fn(() => ({ id: "s-1", rid: "u-1" })));

vi.mock("@/services/counsellor-self", () => ({ getSocietyResident: mockGetResident }));
vi.mock("next/navigation", () => ({ useParams: mockUseParams }));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";

import CounsellorResidentDetailPage from "@/app/counsellor/(authed)/societies/[id]/residents/[rid]/page";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CounsellorResidentDetailPage />
    </QueryClientProvider>,
  );
}

const resident = {
  id: "u-1",
  name: "Asha Patel",
  email: "asha@x.com",
  mobile: "+91 9876543210",
  photoUrl: null,
  role: "RESIDENT",
  status: "ACTIVE_PAID",
  ownershipType: "OWNER" as const,
  registeredAt: "2025-10-01",
  approvedAt: "2025-10-05",
  society: { id: "s-1", name: "Alpha" },
  units: [
    {
      id: "un-1",
      displayLabel: "A-101",
      towerBlock: "A",
      floorNo: "1",
      relationship: "OWNER",
      isPrimary: true,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseParams.mockReturnValue({ id: "s-1", rid: "u-1" });
});

describe("CounsellorResidentDetailPage", () => {
  it("renders loading skeleton", () => {
    mockGetResident.mockImplementation(() => new Promise(() => {}));
    const { container } = renderPage();
    expect(container.querySelector('[class*="animate-pulse"]')).toBeTruthy();
  });

  it("renders error banner on failure", async () => {
    mockGetResident.mockRejectedValue(new Error("boom"));
    renderPage();
    await waitFor(() => expect(screen.getByText(/Failed to load resident/)).toBeInTheDocument());
  });

  it("renders resident profile with units and primary badge", async () => {
    mockGetResident.mockResolvedValue(resident);
    renderPage();
    await waitFor(() => expect(screen.getByText("Asha Patel")).toBeInTheDocument());
    expect(screen.getByText("asha@x.com")).toBeInTheDocument();
    expect(screen.getByText("+91 9876543210")).toBeInTheDocument();
    expect(screen.getByText("OWNER")).toBeInTheDocument();
    expect(screen.getByText("A-101")).toBeInTheDocument();
    expect(screen.getByText(/Tower A/)).toBeInTheDocument();
    expect(screen.getByText(/Floor 1/)).toBeInTheDocument();
    expect(screen.getByText("Primary")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE PAID")).toBeInTheDocument();
  });

  it("renders em-dashes for null mobile/approvedAt and no-unit message", async () => {
    mockGetResident.mockResolvedValue({
      ...resident,
      mobile: null,
      approvedAt: null,
      ownershipType: null,
      units: [],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Asha Patel")).toBeInTheDocument());
    expect(screen.getByText(/No units linked/)).toBeInTheDocument();
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it("omits tower/floor when unit data is null", async () => {
    mockGetResident.mockResolvedValue({
      ...resident,
      units: [{ ...resident.units[0], towerBlock: null, floorNo: null, isPrimary: false }],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("A-101")).toBeInTheDocument());
    expect(screen.queryByText(/Tower/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Floor/)).not.toBeInTheDocument();
    expect(screen.queryByText("Primary")).not.toBeInTheDocument();
  });
});
