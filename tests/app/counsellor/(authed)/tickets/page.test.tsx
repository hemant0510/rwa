import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetTickets = vi.hoisted(() => vi.fn());

vi.mock("@/services/counsellor-self", () => ({ getCounsellorTickets: mockGetTickets }));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import CounsellorTicketsPage from "@/app/counsellor/(authed)/tickets/page";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CounsellorTicketsPage />
    </QueryClientProvider>,
  );
}

const sampleEscalation = {
  id: "e-1",
  status: "PENDING",
  source: "RESIDENT_VOTE",
  slaDeadline: null,
  acknowledgedAt: null,
  resolvedAt: null,
  createdAt: "2026-04-15T00:00:00Z",
  ticket: {
    id: "t-1",
    ticketNumber: 42,
    subject: "Water leak",
    type: "MAINTENANCE",
    priority: "HIGH",
    status: "OPEN",
    societyId: "s-1",
    society: { name: "Alpha", societyCode: "ALPHA" },
  },
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CounsellorTicketsPage", () => {
  it("renders loading skeleton", () => {
    mockGetTickets.mockImplementation(() => new Promise(() => {}));
    const { container } = renderPage();
    expect(container.querySelector('[class*="animate-pulse"]')).toBeTruthy();
  });

  it("renders error banner on failure", async () => {
    mockGetTickets.mockRejectedValue(new Error("boom"));
    renderPage();
    await waitFor(() => expect(screen.getByText(/Failed to load escalations/)).toBeInTheDocument());
  });

  it("renders empty state for open filter", async () => {
    mockGetTickets.mockResolvedValue({ escalations: [] });
    renderPage();
    await waitFor(() => expect(screen.getByText(/No open escalations/)).toBeInTheDocument());
  });

  it("switches to 'all' filter and shows broader empty copy", async () => {
    mockGetTickets.mockResolvedValue({ escalations: [] });
    renderPage();
    await waitFor(() => expect(screen.getByText(/No open escalations/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /^All$/ }));
    await waitFor(() =>
      expect(screen.getByText(/No escalations have been assigned/)).toBeInTheDocument(),
    );
  });

  it("renders escalation list with ticket metadata", async () => {
    mockGetTickets.mockResolvedValue({ escalations: [sampleEscalation] });
    renderPage();
    await waitFor(() => expect(screen.getByText(/Water leak/)).toBeInTheDocument());
    expect(screen.getByText(/#42 — Water leak/)).toBeInTheDocument();
    expect(screen.getByText(/Alpha · ALPHA · MAINTENANCE · HIGH/)).toBeInTheDocument();
  });

  it("calls service with status=all when All filter selected", async () => {
    mockGetTickets.mockResolvedValue({ escalations: [] });
    renderPage();
    await waitFor(() => expect(mockGetTickets).toHaveBeenCalledWith({}));
    fireEvent.click(screen.getByRole("button", { name: /^All$/ }));
    await waitFor(() => expect(mockGetTickets).toHaveBeenCalledWith({ status: "all" }));
  });

  it("switches back to 'open' filter after selecting 'all'", async () => {
    mockGetTickets.mockResolvedValue({ escalations: [] });
    renderPage();
    await waitFor(() => expect(screen.getByText(/No open escalations/)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /^All$/ }));
    await waitFor(() =>
      expect(screen.getByText(/No escalations have been assigned/)).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: /^Open$/ }));
    await waitFor(() => expect(screen.getByText(/No open escalations/)).toBeInTheDocument());
  });
});
