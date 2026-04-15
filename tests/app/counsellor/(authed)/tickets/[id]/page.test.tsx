import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetTicket = vi.hoisted(() => vi.fn());
const mockAck = vi.hoisted(() => vi.fn());
const mockResolve = vi.hoisted(() => vi.fn());
const mockDefer = vi.hoisted(() => vi.fn());
const mockPost = vi.hoisted(() => vi.fn());
const mockUseParams = vi.hoisted(() => vi.fn(() => ({ id: "e-1" })));

vi.mock("@/services/counsellor-self", () => ({
  getCounsellorTicket: mockGetTicket,
  acknowledgeEscalation: mockAck,
  resolveEscalation: mockResolve,
  deferEscalation: mockDefer,
  postCounsellorMessage: mockPost,
}));
vi.mock("next/navigation", () => ({ useParams: mockUseParams }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";

import CounsellorTicketDetailPage from "@/app/counsellor/(authed)/tickets/[id]/page";

function renderPage() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <CounsellorTicketDetailPage />
    </QueryClientProvider>,
  );
}

const baseDetail = {
  id: "e-1",
  status: "ACKNOWLEDGED",
  source: "RESIDENT_VOTE",
  reason: "Residents requested escalation",
  slaDeadline: "2026-04-18T00:00:00Z",
  acknowledgedAt: "2026-04-15T00:00:00Z",
  resolvedAt: null,
  createdAt: "2026-04-14T00:00:00Z",
  ticket: {
    id: "t-1",
    ticketNumber: 42,
    subject: "Water leak",
    description: "Pipe burst in basement",
    type: "MAINTENANCE",
    priority: "HIGH",
    status: "OPEN",
    societyId: "s-1",
    createdAt: "2026-04-14T00:00:00Z",
    society: { name: "Alpha", societyCode: "ALPHA" },
    createdByUser: { id: "u-1", name: "Asha", email: "asha@x.com" },
    messages: [
      {
        id: "m-1",
        ticketId: "t-1",
        authorId: "u-1",
        authorRole: "RESIDENT",
        content: "Still leaking",
        isInternal: false,
        kind: null,
        counsellorId: null,
        createdAt: "2026-04-14T01:00:00Z",
        attachments: [],
        author: { name: "Asha" },
        counsellor: null,
      },
    ],
  },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockUseParams.mockReturnValue({ id: "e-1" });
});

describe("CounsellorTicketDetailPage", () => {
  it("renders loading skeleton", () => {
    mockGetTicket.mockImplementation(() => new Promise(() => {}));
    const { container } = renderPage();
    expect(container.querySelector('[class*="animate-pulse"]')).toBeTruthy();
  });

  it("renders error banner on failure", async () => {
    mockGetTicket.mockRejectedValue(new Error("boom"));
    renderPage();
    await waitFor(() => expect(screen.getByText(/Failed to load escalation/)).toBeInTheDocument());
  });

  it("renders detail with composer when status is open", async () => {
    mockGetTicket.mockResolvedValue(baseDetail);
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /#42 — Water leak/ })).toBeInTheDocument(),
    );
    expect(screen.getByText(/Alpha · ALPHA/)).toBeInTheDocument();
    expect(screen.getByText(/Asha \(asha@x.com\)/)).toBeInTheDocument();
    expect(screen.getByText(/Residents requested escalation/)).toBeInTheDocument();
    expect(screen.getByText(/Pipe burst in basement/)).toBeInTheDocument();
    expect(screen.getByText("Still leaking")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Post$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Acknowledge/ })).toBeInTheDocument();
  });

  it("hides composer when status is RESOLVED_BY_COUNSELLOR", async () => {
    mockGetTicket.mockResolvedValue({ ...baseDetail, status: "RESOLVED_BY_COUNSELLOR" });
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /#42 — Water leak/ })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: /^Post$/ })).not.toBeInTheDocument();
  });

  it("hides composer when status is WITHDRAWN", async () => {
    mockGetTicket.mockResolvedValue({ ...baseDetail, status: "WITHDRAWN" });
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /#42 — Water leak/ })).toBeInTheDocument(),
    );
    expect(screen.queryByRole("button", { name: /^Post$/ })).not.toBeInTheDocument();
  });

  it("renders empty state when data resolves to null", async () => {
    mockGetTicket.mockResolvedValue(null);
    renderPage();
    await waitFor(() => expect(screen.getByText(/Escalation not found/)).toBeInTheDocument());
  });

  it("renders detail without reason line when reason is null", async () => {
    mockGetTicket.mockResolvedValue({ ...baseDetail, reason: null });
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: /#42 — Water leak/ })).toBeInTheDocument(),
    );
    expect(screen.queryByText(/Escalation reason/)).not.toBeInTheDocument();
  });
});
