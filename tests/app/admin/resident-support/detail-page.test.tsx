import React, { Suspense } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────────────────────────

const {
  mockGetAdminResidentTicketDetail,
  mockPostAdminResidentMessage,
  mockChangeAdminResidentTicketStatus,
  mockChangeAdminResidentTicketPriority,
  mockLinkTicketPetition,
  mockUploadAdminResidentAttachment,
  mockToastSuccess,
  mockToastError,
  mockFetch,
} = vi.hoisted(() => ({
  mockGetAdminResidentTicketDetail: vi.fn(),
  mockPostAdminResidentMessage: vi.fn(),
  mockChangeAdminResidentTicketStatus: vi.fn(),
  mockChangeAdminResidentTicketPriority: vi.fn(),
  mockLinkTicketPetition: vi.fn(),
  mockUploadAdminResidentAttachment: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockFetch: vi.fn(),
}));

vi.mock("@/services/resident-support", () => ({
  getAdminResidentTicketDetail: (...args: unknown[]) => mockGetAdminResidentTicketDetail(...args),
  postAdminResidentMessage: (...args: unknown[]) => mockPostAdminResidentMessage(...args),
  changeAdminResidentTicketStatus: (...args: unknown[]) =>
    mockChangeAdminResidentTicketStatus(...args),
  changeAdminResidentTicketPriority: (...args: unknown[]) =>
    mockChangeAdminResidentTicketPriority(...args),
  linkTicketPetition: (...args: unknown[]) => mockLinkTicketPetition(...args),
  uploadAdminResidentAttachment: (...args: unknown[]) => mockUploadAdminResidentAttachment(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock("@/hooks/useSocietyId", () => ({
  useSocietyId: () => ({ societyId: "soc-1", saQueryString: "" }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
  usePathname: () => "/admin/resident-support/t-1",
  useSearchParams: () => new URLSearchParams(""),
}));

global.fetch = mockFetch as unknown as typeof fetch;

import AdminResidentTicketDetailPage from "@/app/admin/resident-support/[ticketId]/page";
import { AuthContext } from "@/hooks/useAuth";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_ADMIN = {
  id: "u-1",
  name: "Admin User",
  role: "RWA_ADMIN" as const,
  permission: "FULL_ACCESS" as const,
  societyId: "soc-1",
  societyName: "Eden Estate",
  societyCode: "EDEN",
  societyStatus: "ACTIVE" as const,
  trialEndsAt: null,
  isTrialExpired: false,
  multiSociety: false,
  societies: null,
};

const MOCK_READ_NOTIFY_ADMIN = { ...MOCK_ADMIN, permission: "READ_NOTIFY" as const };

const MOCK_TICKET = {
  id: "t-1",
  ticketNumber: 42,
  societyId: "soc-1",
  type: "MAINTENANCE_ISSUE",
  priority: "HIGH",
  status: "IN_PROGRESS",
  subject: "Broken elevator",
  description: "The elevator has been stuck between floors 3 and 4.",
  createdBy: "u-2",
  petitionId: null,
  resolvedAt: null,
  closedAt: null,
  closedReason: null,
  createdAt: new Date("2026-04-01T10:00:00Z").toISOString(),
  updatedAt: new Date("2026-04-05T10:00:00Z").toISOString(),
  createdByUser: {
    name: "Priya Sharma",
    userUnits: [{ unit: { displayLabel: "B-201" } }],
  },
  petition: null,
  messages: [],
};

const MOCK_TICKET_WITH_PETITION = {
  ...MOCK_TICKET,
  petitionId: "pet-1",
  petition: {
    id: "pet-1",
    title: "Fix elevator urgently",
    type: "COMPLAINT",
    status: "DRAFT",
  },
};

const MOCK_TICKET_CLOSED = {
  ...MOCK_TICKET,
  status: "CLOSED",
  closedAt: new Date("2026-04-07T10:00:00Z").toISOString(),
  closedReason: "Resolved by maintenance",
};

const MOCK_TICKET_RESOLVED = {
  ...MOCK_TICKET,
  status: "RESOLVED",
  resolvedAt: new Date("2026-04-06T10:00:00Z").toISOString(),
};

const MOCK_TICKET_OPEN = {
  ...MOCK_TICKET,
  status: "OPEN",
};

const MOCK_TICKET_NO_UNIT = {
  ...MOCK_TICKET,
  createdByUser: { name: "No Unit User", userUnits: [] },
};

const MOCK_TICKET_WITH_MESSAGES = {
  ...MOCK_TICKET,
  messages: [
    {
      id: "msg-1",
      ticketId: "t-1",
      authorId: "u-2",
      authorRole: "RESIDENT",
      content: "Please fix this ASAP",
      isInternal: false,
      createdAt: new Date("2026-04-02T10:00:00Z").toISOString(),
      attachments: [],
    },
    {
      id: "msg-2",
      ticketId: "t-1",
      authorId: "u-1",
      authorRole: "ADMIN",
      content: "Internal note: checking with maintenance team",
      isInternal: true,
      createdAt: new Date("2026-04-03T10:00:00Z").toISOString(),
      attachments: [],
    },
  ],
};

// ── Helper ────────────────────────────────────────────────────────────────────

async function renderPage(
  ticketId = "t-1",
  userOverride: typeof MOCK_ADMIN | typeof MOCK_READ_NOTIFY_ADMIN = MOCK_ADMIN,
) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <QueryClientProvider client={qc}>
        <AuthContext.Provider
          value={{
            user: userOverride,
            isLoading: false,
            isAuthenticated: true,
            signOut: vi.fn(),
            switchSociety: vi.fn(),
          }}
        >
          <Suspense fallback={<div>Loading…</div>}>
            <AdminResidentTicketDetailPage params={Promise.resolve({ ticketId })} />
          </Suspense>
        </AuthContext.Provider>
      </QueryClientProvider>,
    );
  });
  return result;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AdminResidentTicketDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAdminResidentTicketDetail.mockResolvedValue(MOCK_TICKET);
    mockPostAdminResidentMessage.mockResolvedValue({});
    mockChangeAdminResidentTicketStatus.mockResolvedValue(undefined);
    mockChangeAdminResidentTicketPriority.mockResolvedValue(undefined);
    mockLinkTicketPetition.mockResolvedValue(MOCK_TICKET);
    mockUploadAdminResidentAttachment.mockResolvedValue({ id: "att-1" });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ petition: { id: "pet-2" }, ticket: {} }),
    });
  });

  // ── Loading / Error states ─────────────────────────────────────────────────

  it("shows not found when ticket is null", async () => {
    mockGetAdminResidentTicketDetail.mockResolvedValue(null);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Ticket not found.")).toBeInTheDocument();
    });
  });

  // ── Loaded state ───────────────────────────────────────────────────────────

  it("renders ticket header with ticket number and subject", async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("#42 — Broken elevator")).toBeInTheDocument();
    });
  });

  it("renders resident name and unit in description", async () => {
    await renderPage();
    await waitFor(() => {
      // description contains "Priya Sharma · B-201 · Created..."
      expect(screen.getByText(/Priya Sharma.*B-201/)).toBeInTheDocument();
    });
  });

  it("renders description content", async () => {
    await renderPage();
    await waitFor(() => {
      expect(
        screen.getByText("The elevator has been stuck between floors 3 and 4."),
      ).toBeInTheDocument();
    });
  });

  it("renders conversation thread with internal notes for admin", async () => {
    mockGetAdminResidentTicketDetail.mockResolvedValue(MOCK_TICKET_WITH_MESSAGES);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Please fix this ASAP")).toBeInTheDocument();
    });
    // Internal note should also be visible for admin (showInternal=true)
    expect(screen.getByText("Internal Note")).toBeInTheDocument();
    expect(screen.getByText("Internal note: checking with maintenance team")).toBeInTheDocument();
  });

  // ── Reply form ─────────────────────────────────────────────────────────────

  it("renders reply form for FULL_ACCESS admin on non-closed ticket", async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Type your message…")).toBeInTheDocument();
    });
    expect(screen.getByText("Send Reply")).toBeInTheDocument();
  });

  it("does NOT render reply form for READ_NOTIFY admin", async () => {
    await renderPage("t-1", MOCK_READ_NOTIFY_ADMIN);
    await waitFor(() => {
      expect(screen.getByText("#42 — Broken elevator")).toBeInTheDocument();
    });
    expect(screen.queryByPlaceholderText("Type your message…")).not.toBeInTheDocument();
  });

  it("does NOT render reply form when ticket is CLOSED", async () => {
    mockGetAdminResidentTicketDetail.mockResolvedValue(MOCK_TICKET_CLOSED);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("#42 — Broken elevator")).toBeInTheDocument();
    });
    expect(screen.queryByPlaceholderText("Type your message…")).not.toBeInTheDocument();
  });

  it("shows closed state message when ticket is CLOSED", async () => {
    mockGetAdminResidentTicketDetail.mockResolvedValue(MOCK_TICKET_CLOSED);
    await renderPage();
    await waitFor(() => {
      expect(
        screen.getByText("This ticket is closed. No further replies are allowed."),
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Reason: Resolved by maintenance")).toBeInTheDocument();
  });

  it("toggles internal note mode", async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Reply to resident")).toBeInTheDocument();
    });
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    expect(screen.getByText("Internal note (not visible to resident)")).toBeInTheDocument();
    expect(screen.getByText("Add Note")).toBeInTheDocument();
  });

  it("submits reply and shows success toast", async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Type your message…")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByPlaceholderText("Type your message…"), {
      target: { value: "We are on it" },
    });
    fireEvent.click(screen.getByText("Send Reply"));
    await waitFor(() => {
      expect(mockPostAdminResidentMessage).toHaveBeenCalledWith(
        "t-1",
        expect.objectContaining({ content: "We are on it", isInternal: false }),
      );
      expect(mockToastSuccess).toHaveBeenCalledWith("Reply sent");
    });
  });

  it("shows error toast when reply fails", async () => {
    mockPostAdminResidentMessage.mockRejectedValue(new Error("Network error"));
    await renderPage();
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Type your message…")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByPlaceholderText("Type your message…"), {
      target: { value: "Test reply" },
    });
    fireEvent.click(screen.getByText("Send Reply"));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Network error");
    });
  });

  it("shows Sending… button text while reply mutation is pending", async () => {
    mockPostAdminResidentMessage.mockImplementation(() => new Promise(() => {}));
    await renderPage();
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Type your message…")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByPlaceholderText("Type your message…"), {
      target: { value: "pending reply" },
    });
    fireEvent.click(screen.getByText("Send Reply"));
    await waitFor(() => {
      expect(screen.getByText("Sending…")).toBeInTheDocument();
    });
  });

  it("shows 'Internal note added' toast when submitting internal note", async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Type your message…")).toBeInTheDocument();
    });
    // Toggle internal checkbox
    const checkbox = screen.getByRole("checkbox");
    fireEvent.click(checkbox);
    fireEvent.change(screen.getByPlaceholderText("Type your message…"), {
      target: { value: "Internal note content" },
    });
    fireEvent.click(screen.getByText("Add Note"));
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Internal note added");
    });
  });

  it("renders header description without unit when ticket has no unit", async () => {
    mockGetAdminResidentTicketDetail.mockResolvedValue(MOCK_TICKET_NO_UNIT);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("#42 — Broken elevator")).toBeInTheDocument();
    });
    // Description should show name without unit (appears in header and sidebar)
    expect(screen.getAllByText(/No Unit User/).length).toBeGreaterThan(0);
  });

  // ── Status actions ─────────────────────────────────────────────────────────

  it("renders status action buttons for FULL_ACCESS admin on IN_PROGRESS ticket", async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Actions")).toBeInTheDocument();
    });
    // IN_PROGRESS valid transitions: AWAITING_RESIDENT, RESOLVED, CLOSED
    expect(screen.getByText("Awaiting Resident")).toBeInTheDocument();
    expect(screen.getByText("Mark Resolved")).toBeInTheDocument();
    expect(screen.getByText("Close Ticket")).toBeInTheDocument();
  });

  it("renders correct status buttons for OPEN ticket", async () => {
    mockGetAdminResidentTicketDetail.mockResolvedValue(MOCK_TICKET_OPEN);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Actions")).toBeInTheDocument();
    });
    // OPEN valid transitions: IN_PROGRESS, CLOSED
    expect(screen.getByText("Mark In Progress")).toBeInTheDocument();
    expect(screen.getByText("Close Ticket")).toBeInTheDocument();
  });

  it("does NOT render actions card for CLOSED ticket", async () => {
    mockGetAdminResidentTicketDetail.mockResolvedValue(MOCK_TICKET_CLOSED);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("#42 — Broken elevator")).toBeInTheDocument();
    });
    expect(screen.queryByText("Actions")).not.toBeInTheDocument();
  });

  it("does NOT render actions card for READ_NOTIFY admin", async () => {
    await renderPage("t-1", MOCK_READ_NOTIFY_ADMIN);
    await waitFor(() => {
      expect(screen.getByText("#42 — Broken elevator")).toBeInTheDocument();
    });
    expect(screen.queryByText("Actions")).not.toBeInTheDocument();
  });

  it("calls changeAdminResidentTicketStatus when action button clicked", async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Mark Resolved")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Mark Resolved"));
    await waitFor(() => {
      expect(mockChangeAdminResidentTicketStatus).toHaveBeenCalledWith(
        "t-1",
        expect.objectContaining({ status: "RESOLVED" }),
      );
      expect(mockToastSuccess).toHaveBeenCalledWith("Status updated");
    });
  });

  it("shows error toast when status change fails", async () => {
    mockChangeAdminResidentTicketStatus.mockRejectedValue(new Error("Status update failed"));
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Mark Resolved")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Mark Resolved"));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Status update failed");
    });
  });

  // ── Priority ───────────────────────────────────────────────────────────────

  it("renders priority dropdown for FULL_ACCESS admin on non-closed ticket", async () => {
    await renderPage();
    await waitFor(() => {
      // Priority card has a Select combobox; Details card has a row — verify combobox exists
      expect(screen.getAllByRole("combobox").length).toBeGreaterThan(0);
    });
  });

  it("does NOT render priority dropdown for READ_NOTIFY admin", async () => {
    await renderPage("t-1", MOCK_READ_NOTIFY_ADMIN);
    await waitFor(() => {
      expect(screen.getByText("#42 — Broken elevator")).toBeInTheDocument();
    });
    // READ_NOTIFY admin should see no combobox selects (no priority dropdown)
    expect(screen.queryAllByRole("combobox").length).toBe(0);
  });

  it("calls changeAdminResidentTicketPriority when priority changes", async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getAllByRole("combobox").length).toBeGreaterThan(0);
    });
    // Open the priority select (first combobox in the sidebar)
    const prioritySelect = screen.getAllByRole("combobox")[0];
    fireEvent.click(prioritySelect);
    await waitFor(() => {
      const urgentOption = screen.getByRole("option", { name: "Urgent" });
      fireEvent.click(urgentOption);
    });
    await waitFor(() => {
      expect(mockChangeAdminResidentTicketPriority).toHaveBeenCalledWith(
        "t-1",
        expect.objectContaining({ priority: "URGENT" }),
      );
      expect(mockToastSuccess).toHaveBeenCalledWith("Priority updated");
    });
  });

  it("shows error toast when priority change fails", async () => {
    mockChangeAdminResidentTicketPriority.mockRejectedValue(new Error("Priority update failed"));
    await renderPage();
    await waitFor(() => {
      expect(screen.getAllByRole("combobox").length).toBeGreaterThan(0);
    });
    const prioritySelect = screen.getAllByRole("combobox")[0];
    fireEvent.click(prioritySelect);
    await waitFor(() => {
      fireEvent.click(screen.getByRole("option", { name: "Urgent" }));
    });
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Priority update failed");
    });
  });

  // ── Petition card ──────────────────────────────────────────────────────────

  it("shows 'No petition linked' when no petition", async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("No petition linked")).toBeInTheDocument();
    });
  });

  it("shows petition details when petition is linked", async () => {
    mockGetAdminResidentTicketDetail.mockResolvedValue(MOCK_TICKET_WITH_PETITION);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Fix elevator urgently")).toBeInTheDocument();
    });
    expect(screen.getByText("Complaint")).toBeInTheDocument();
    expect(screen.getByText("DRAFT")).toBeInTheDocument();
    expect(screen.getByText("View petition")).toBeInTheDocument();
    expect(screen.getByText("Unlink")).toBeInTheDocument();
  });

  it("calls linkTicketPetition(null) when Unlink is clicked", async () => {
    mockGetAdminResidentTicketDetail.mockResolvedValue(MOCK_TICKET_WITH_PETITION);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Unlink")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Unlink"));
    await waitFor(() => {
      expect(mockLinkTicketPetition).toHaveBeenCalledWith("t-1", null);
    });
  });

  it("shows link by ID input when no petition linked", async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Petition ID")).toBeInTheDocument();
    });
  });

  it("calls linkTicketPetition when Link button clicked", async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Petition ID")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByPlaceholderText("Petition ID"), {
      target: { value: "pet-123" },
    });
    fireEvent.click(screen.getByText("Link"));
    await waitFor(() => {
      expect(mockLinkTicketPetition).toHaveBeenCalledWith("t-1", "pet-123");
    });
  });

  it("shows create petition buttons for FULL_ACCESS admin", async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("+ Complaint")).toBeInTheDocument();
    });
    expect(screen.getByText("+ Petition")).toBeInTheDocument();
    expect(screen.getByText("+ Notice")).toBeInTheDocument();
  });

  it("calls createPetitionFromTicket API when create petition button clicked", async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("+ Complaint")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("+ Complaint"));
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/admin/resident-support/t-1/create-petition",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ type: "COMPLAINT" }),
        }),
      );
      expect(mockToastSuccess).toHaveBeenCalledWith("Petition created and linked");
    });
  });

  it("shows error toast when create petition API fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: { message: "Failed to create" } }),
    });
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("+ Complaint")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("+ Complaint"));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Failed to create");
    });
  });

  it("shows fallback error when create petition API returns no message", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("+ Complaint")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("+ Complaint"));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Failed to create petition");
    });
  });

  // ── Details card ───────────────────────────────────────────────────────────

  it("renders details card with ticket metadata", async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Details")).toBeInTheDocument();
    });
    expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
  });

  it("shows resolvedAt date in details when ticket resolved", async () => {
    mockGetAdminResidentTicketDetail.mockResolvedValue(MOCK_TICKET_RESOLVED);
    await renderPage();
    await waitFor(() => {
      // "06 Apr 2026" appears as the resolved date in the details card
      expect(screen.getByText("06 Apr 2026")).toBeInTheDocument();
    });
  });

  it("shows closedAt date in details when ticket closed", async () => {
    mockGetAdminResidentTicketDetail.mockResolvedValue(MOCK_TICKET_CLOSED);
    await renderPage();
    await waitFor(() => {
      // "07 Apr 2026" appears as the closed date in the details card
      expect(screen.getByText("07 Apr 2026")).toBeInTheDocument();
    });
  });

  // ── Link petition error ────────────────────────────────────────────────────

  it("shows error toast when link petition fails", async () => {
    mockLinkTicketPetition.mockRejectedValue(new Error("Link failed"));
    await renderPage();
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Petition ID")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByPlaceholderText("Petition ID"), {
      target: { value: "pet-bad" },
    });
    fireEvent.click(screen.getByText("Link"));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Link failed");
    });
  });

  // ── Upload attachment ──────────────────────────────────────────────────────

  it("renders TicketAttachments section", async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Attachments/)).toBeInTheDocument();
    });
  });

  // ── Back link ──────────────────────────────────────────────────────────────

  it("renders back link to list page", async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("#42 — Broken elevator")).toBeInTheDocument();
    });
    const backLink = document.querySelector('a[href="/admin/resident-support"]');
    expect(backLink).toBeInTheDocument();
  });
});
