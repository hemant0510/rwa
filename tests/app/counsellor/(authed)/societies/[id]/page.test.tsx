import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetSociety = vi.hoisted(() => vi.fn());
const mockGetResidents = vi.hoisted(() => vi.fn());
const mockGetGoverningBody = vi.hoisted(() => vi.fn());
const mockUseParams = vi.hoisted(() => vi.fn(() => ({ id: "s-1" })));

vi.mock("@/services/counsellor-self", () => ({
  getSociety: mockGetSociety,
  getSocietyResidents: mockGetResidents,
  getSocietyGoverningBody: mockGetGoverningBody,
}));
vi.mock("next/navigation", () => ({ useParams: mockUseParams }));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import CounsellorSocietyDetailPage from "@/app/counsellor/(authed)/societies/[id]/page";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CounsellorSocietyDetailPage />
    </QueryClientProvider>,
  );
}

const societyData = {
  id: "s-1",
  name: "Alpha Residency",
  societyCode: "ALPHA",
  city: "Pune",
  state: "MH",
  pincode: "411001",
  totalUnits: 120,
  registrationNo: "REG-1",
  registrationDate: "2020-01-01",
  counsellorEscalationThreshold: 10,
  onboardingDate: "2023-05-01",
  assignedAt: "2026-01-01",
  isPrimary: true,
  counts: { residents: 42, governingBodyMembers: 5, openEscalations: 2 },
};

const resident = {
  id: "u-1",
  name: "Asha",
  email: "asha@x.com",
  mobile: "+91 9876543210",
  photoUrl: null,
  unitLabel: "A-101",
  ownershipType: "OWNER" as const,
  status: "ACTIVE_PAID",
  role: "RESIDENT",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseParams.mockReturnValue({ id: "s-1" });
  mockGetSociety.mockResolvedValue(societyData);
  mockGetResidents.mockResolvedValue({ residents: [resident], total: 1, page: 1, pageSize: 20 });
  mockGetGoverningBody.mockResolvedValue({
    members: [
      {
        id: "gbm-1",
        name: "Ramesh",
        email: "r@x.com",
        mobile: "+91 9999999999",
        designation: "President",
        photoUrl: null,
        assignedAt: "2025-01-01",
      },
    ],
  });
});

describe("CounsellorSocietyDetailPage", () => {
  it("renders loading skeleton while society loads", () => {
    mockGetSociety.mockImplementation(() => new Promise(() => {}));
    const { container } = renderPage();
    expect(container.querySelector('[class*="animate-pulse"]')).toBeTruthy();
  });

  it("renders error banner on society failure", async () => {
    mockGetSociety.mockRejectedValue(new Error("boom"));
    renderPage();
    await waitFor(() => expect(screen.getByText(/Failed to load society/)).toBeInTheDocument());
  });

  const findTitle = () =>
    screen.findByRole("heading", { level: 1, name: "Alpha Residency" }, { timeout: 5000 });

  it("renders profile tab with society details by default", async () => {
    renderPage();
    await findTitle();
    expect(screen.getByText(/ALPHA · Pune, MH/)).toBeInTheDocument();
    expect(screen.getByText("411001")).toBeInTheDocument();
  });

  it("switches to residents tab and renders resident list", async () => {
    const user = userEvent.setup();
    renderPage();
    await findTitle();
    await user.click(screen.getByRole("tab", { name: /Residents/ }));
    await waitFor(() => expect(screen.getByText("Asha")).toBeInTheDocument());
    expect(screen.getByText(/A-101/)).toBeInTheDocument();
  });

  it("shows error banner when residents query fails", async () => {
    mockGetResidents.mockRejectedValue(new Error("rxe"));
    const user = userEvent.setup();
    renderPage();
    await findTitle();
    await user.click(screen.getByRole("tab", { name: /Residents/ }));
    await waitFor(() => expect(screen.getByText(/Failed to load residents/)).toBeInTheDocument());
  });

  it("resets page to 1 when search changes in residents tab", async () => {
    const user = userEvent.setup();
    renderPage();
    await findTitle();
    await user.click(screen.getByRole("tab", { name: /Residents/ }));
    await waitFor(() => expect(screen.getByLabelText("Search residents")).toBeInTheDocument());
    await user.type(screen.getByLabelText("Search residents"), "a");
    await waitFor(() => {
      const calls = mockGetResidents.mock.calls;
      const lastArg = calls[calls.length - 1][1];
      expect(lastArg.search).toBe("a");
      expect(lastArg.page).toBe(1);
    });
  });

  it("renders governing body tab with members", async () => {
    const user = userEvent.setup();
    renderPage();
    await findTitle();
    await user.click(screen.getByRole("tab", { name: /Governing body/ }));
    await waitFor(() => expect(screen.getByText("Ramesh")).toBeInTheDocument());
    expect(screen.getByText(/President/)).toBeInTheDocument();
  });

  it("shows loading text for governing body while fetching", async () => {
    mockGetGoverningBody.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderPage();
    await findTitle();
    await user.click(screen.getByRole("tab", { name: /Governing body/ }));
    await waitFor(() => expect(screen.getByText(/Loading members/)).toBeInTheDocument());
  });

  it("shows empty state for governing body when list is empty", async () => {
    mockGetGoverningBody.mockResolvedValue({ members: [] });
    const user = userEvent.setup();
    renderPage();
    await findTitle();
    await user.click(screen.getByRole("tab", { name: /Governing body/ }));
    await waitFor(() => expect(screen.getByText(/No governing body yet/)).toBeInTheDocument());
  });

  it("shows error banner on governing body failure", async () => {
    mockGetGoverningBody.mockRejectedValue(new Error("gb"));
    const user = userEvent.setup();
    renderPage();
    await findTitle();
    await user.click(screen.getByRole("tab", { name: /Governing body/ }));
    await waitFor(() =>
      expect(screen.getByText(/Failed to load governing body/)).toBeInTheDocument(),
    );
  });
});
