import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCounsellorAuditLog = vi.hoisted(() => vi.fn());

vi.mock("@/services/counsellors", () => ({ getCounsellorAuditLog: mockGetCounsellorAuditLog }));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";

import { CounsellorAuditPanel } from "@/components/features/sa-counsellors/CounsellorAuditPanel";

function renderPanel(counsellorId = "c-1") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CounsellorAuditPanel counsellorId={counsellorId} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CounsellorAuditPanel", () => {
  it("renders loading skeleton initially", () => {
    mockGetCounsellorAuditLog.mockImplementation(() => new Promise(() => {}));
    const { container } = renderPanel();
    expect(container.querySelector('[class*="animate-pulse"]')).toBeTruthy();
  });

  it("renders error banner on failure", async () => {
    mockGetCounsellorAuditLog.mockRejectedValue(new Error("boom"));
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText(/Failed to load audit log/)).toBeInTheDocument();
    });
  });

  it("renders empty state when no logs", async () => {
    mockGetCounsellorAuditLog.mockResolvedValue({ logs: [], total: 0, page: 1, pageSize: 50 });
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText(/No audit events/)).toBeInTheDocument();
    });
  });

  it("renders audit log rows with action and entity", async () => {
    mockGetCounsellorAuditLog.mockResolvedValue({
      logs: [
        {
          id: "l-1",
          counsellorId: "c-1",
          actionType: "COUNSELLOR_ACKNOWLEDGE_ESCALATION",
          entityType: "ResidentTicketEscalation",
          entityId: "abcdef1234567890",
          societyId: null,
          metadata: null,
          ipAddress: null,
          userAgent: null,
          createdAt: new Date().toISOString(),
        },
      ],
      total: 1,
      page: 1,
      pageSize: 50,
    });
    renderPanel();
    await waitFor(() => {
      expect(screen.getByText(/COUNSELLOR ACKNOWLEDGE ESCALATION/)).toBeInTheDocument();
    });
    expect(screen.getByText(/ResidentTicketEscalation/)).toBeInTheDocument();
    expect(screen.getByText(/abcdef12/)).toBeInTheDocument();
    expect(screen.getByText(/Showing 1 of 1 events/)).toBeInTheDocument();
  });

  it("requests with pageSize 50", async () => {
    mockGetCounsellorAuditLog.mockResolvedValue({ logs: [], total: 0, page: 1, pageSize: 50 });
    renderPanel("c-2");
    await waitFor(() => {
      expect(mockGetCounsellorAuditLog).toHaveBeenCalledWith("c-2", { pageSize: 50 });
    });
  });
});
