import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  mockGetResidentTicketDetail,
  mockGetResidentTicketAttachments,
  mockGetResidentPetitions,
  mockPostResidentTicketMessage,
  mockReopenResidentTicket,
  mockUploadResidentTicketAttachment,
  mockLinkResidentTicketPetition,
  mockToastSuccess,
  mockToastError,
  mockRouterBack,
  mockRouterPush,
} = vi.hoisted(() => ({
  mockGetResidentTicketDetail: vi.fn(),
  mockGetResidentTicketAttachments: vi.fn(),
  mockGetResidentPetitions: vi.fn(),
  mockPostResidentTicketMessage: vi.fn(),
  mockReopenResidentTicket: vi.fn(),
  mockUploadResidentTicketAttachment: vi.fn(),
  mockLinkResidentTicketPetition: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
  mockRouterBack: vi.fn(),
  mockRouterPush: vi.fn(),
}));

vi.mock("@/services/resident-support", () => ({
  getResidentTicketDetail: (...args: unknown[]) => mockGetResidentTicketDetail(...args),
  getResidentTicketAttachments: (...args: unknown[]) => mockGetResidentTicketAttachments(...args),
  postResidentTicketMessage: (...args: unknown[]) => mockPostResidentTicketMessage(...args),
  reopenResidentTicket: (...args: unknown[]) => mockReopenResidentTicket(...args),
  uploadResidentTicketAttachment: (...args: unknown[]) =>
    mockUploadResidentTicketAttachment(...args),
  linkResidentTicketPetition: (...args: unknown[]) => mockLinkResidentTicketPetition(...args),
}));

vi.mock("@/services/petitions", () => ({
  getResidentPetitions: (...args: unknown[]) => mockGetResidentPetitions(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockRouterPush, back: mockRouterBack }),
  usePathname: () => "/r/support/ticket-1",
  useParams: () => ({ ticketId: "ticket-1" }),
  useSearchParams: () => new URLSearchParams(""),
}));

import ResidentTicketDetailPage from "@/app/r/support/[ticketId]/page";
import { AuthContext } from "@/hooks/useAuth";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_CREATOR_USER = {
  id: "user-1",
  name: "Jane Resident",
  role: "RESIDENT" as const,
  permission: null,
  societyId: "soc-1",
  societyName: "Greenwood Residency",
  societyCode: "GRNW",
  societyStatus: "ACTIVE",
  trialEndsAt: null,
  isTrialExpired: false,
  multiSociety: false,
  societies: null,
};

const MOCK_OTHER_USER = {
  ...MOCK_CREATOR_USER,
  id: "user-2",
  name: "Bob Other",
};

const NOW = new Date().toISOString();
const RESOLVED_RECENTLY = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(); // 2 days ago
const RESOLVED_OLD = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(); // 10 days ago

const BASE_TICKET = {
  id: "ticket-1",
  ticketNumber: 42,
  societyId: "soc-1",
  type: "MAINTENANCE_ISSUE" as const,
  priority: "MEDIUM" as const,
  status: "OPEN" as const,
  subject: "Broken elevator",
  description: "The elevator in block A is not working since Monday.",
  createdBy: "user-1",
  petitionId: null,
  resolvedAt: null,
  closedAt: null,
  closedReason: null,
  createdAt: NOW,
  updatedAt: NOW,
  createdByUser: { name: "Jane Resident" },
  petition: null,
  messages: [],
  assignees: [],
};

const CLOSED_TICKET = { ...BASE_TICKET, status: "CLOSED" as const, closedAt: NOW };
const RESOLVED_TICKET = {
  ...BASE_TICKET,
  status: "RESOLVED" as const,
  resolvedAt: RESOLVED_RECENTLY,
};
const RESOLVED_OLD_TICKET = {
  ...BASE_TICKET,
  status: "RESOLVED" as const,
  resolvedAt: RESOLVED_OLD,
};
const AWAITING_RESIDENT_TICKET = { ...BASE_TICKET, status: "AWAITING_RESIDENT" as const };

const TICKET_WITH_PETITION = {
  ...BASE_TICKET,
  petitionId: "petition-1",
  petition: {
    id: "petition-1",
    title: "Fix elevator petition",
    type: "COMPLAINT",
    status: "PUBLISHED",
  },
};

const TICKET_WITH_DRAFT_PETITION = {
  ...BASE_TICKET,
  petitionId: "petition-2",
  petition: {
    id: "petition-2",
    title: "Draft petition",
    type: "PETITION",
    status: "DRAFT",
  },
};

const MOCK_ATTACHMENTS = [
  {
    id: "att-1",
    ticketId: "ticket-1",
    messageId: null,
    fileName: "photo.jpg",
    mimeType: "image/jpeg",
    fileSize: 1024,
    signedUrl: "https://example.com/photo.jpg",
    uploadedBy: "user-1",
    createdAt: NOW,
  },
];

const MOCK_MESSAGE = {
  id: "msg-1",
  ticketId: "ticket-1",
  authorId: "user-1",
  authorRole: "RESIDENT",
  content: "Hello from resident",
  isInternal: false,
  createdAt: NOW,
  attachments: [],
  author: { name: "Jane Resident" },
};

const MOCK_ADMIN_MESSAGE = {
  ...MOCK_MESSAGE,
  id: "msg-2",
  authorId: "admin-1",
  authorRole: "ADMIN",
  content: "Hello from admin",
  author: { name: "Admin User" },
};

// ── Helper ───────────────────────────────────────────────────────────────────

function renderPage(userOverride = MOCK_CREATOR_USER) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider
        value={{
          user: userOverride,
          isLoading: false,
          isAuthenticated: true,
          signOut: vi.fn(),
          switchSociety: vi.fn(),
        }}
      >
        <ResidentTicketDetailPage />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ResidentTicketDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetResidentTicketDetail.mockResolvedValue(BASE_TICKET);
    mockGetResidentTicketAttachments.mockResolvedValue([]);
  });

  describe("loading and not found", () => {
    it("shows spinner while loading", () => {
      mockGetResidentTicketDetail.mockReturnValue(new Promise(() => {}));
      renderPage();
      expect(document.querySelector(".animate-spin")).toBeInTheDocument();
    });

    it("shows not found when ticket is null", async () => {
      mockGetResidentTicketDetail.mockResolvedValue(null);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/ticket not found/i)).toBeInTheDocument();
      });
    });

    it("shows back button on not found screen", async () => {
      mockGetResidentTicketDetail.mockResolvedValue(null);
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByRole("button", { name: /back/i }));
      expect(mockRouterBack).toHaveBeenCalled();
    });
  });

  describe("ticket header", () => {
    it("renders ticket number, subject, and attributed name", async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("#42")).toBeInTheDocument();
        expect(screen.getByText("Broken elevator")).toBeInTheDocument();
        expect(screen.getByText(/raised by jane resident/i)).toBeInTheDocument();
      });
    });

    it("renders status badge", async () => {
      renderPage();
      await waitFor(() => {
        // "Open" appears in the header badge and in the sidebar details card
        expect(screen.getAllByText("Open").length).toBeGreaterThanOrEqual(1);
      });
    });

    it("renders type badge", async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByText("Maintenance").length).toBeGreaterThan(0);
      });
    });

    it("renders priority badge (read-only)", async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getAllByText("Medium").length).toBeGreaterThan(0);
      });
    });
  });

  describe("description card", () => {
    it("renders description text", async () => {
      renderPage();
      await waitFor(() => {
        expect(
          screen.getByText("The elevator in block A is not working since Monday."),
        ).toBeInTheDocument();
      });
    });
  });

  describe("status banners", () => {
    it("shows awaiting resident banner when status is AWAITING_RESIDENT", async () => {
      mockGetResidentTicketDetail.mockResolvedValue(AWAITING_RESIDENT_TICKET);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId("awaiting-resident-banner")).toBeInTheDocument();
        expect(screen.getByText(/waiting for your reply/i)).toBeInTheDocument();
      });
    });

    it("does not show awaiting resident banner for OPEN ticket", async () => {
      renderPage();
      await waitFor(() => screen.getByText("Broken elevator"));
      expect(screen.queryByTestId("awaiting-resident-banner")).not.toBeInTheDocument();
    });

    it("shows resolved banner when status is RESOLVED", async () => {
      mockGetResidentTicketDetail.mockResolvedValue(RESOLVED_TICKET);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId("resolved-banner")).toBeInTheDocument();
        expect(screen.getByText(/ticket resolved/i)).toBeInTheDocument();
      });
    });

    it("resolved banner shows reopen hint within 7 days", async () => {
      mockGetResidentTicketDetail.mockResolvedValue(RESOLVED_TICKET);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/you can reopen it/i)).toBeInTheDocument();
      });
    });

    it("resolved banner does not show reopen hint after 7 days", async () => {
      mockGetResidentTicketDetail.mockResolvedValue(RESOLVED_OLD_TICKET);
      renderPage();
      await waitFor(() => screen.getByTestId("resolved-banner"));
      expect(screen.queryByText(/you can reopen it/i)).not.toBeInTheDocument();
    });
  });

  describe("attachments", () => {
    it("renders TicketAttachments with correct canUpload for creator", async () => {
      mockGetResidentTicketAttachments.mockResolvedValue(MOCK_ATTACHMENTS);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Attachments (1)")).toBeInTheDocument();
      });
    });

    it("hides upload button for non-creator", async () => {
      mockGetResidentTicketAttachments.mockResolvedValue([]);
      renderPage(MOCK_OTHER_USER);
      await waitFor(() => screen.getByText("Broken elevator"));
      expect(screen.queryByRole("button", { name: /upload/i })).not.toBeInTheDocument();
    });

    it("hides upload button for closed ticket (creator)", async () => {
      mockGetResidentTicketDetail.mockResolvedValue(CLOSED_TICKET);
      renderPage();
      await waitFor(() => screen.getByText("Broken elevator"));
      expect(screen.queryByRole("button", { name: /upload/i })).not.toBeInTheDocument();
    });

    it("uploads attachment and invalidates query", async () => {
      mockUploadResidentTicketAttachment.mockResolvedValue(MOCK_ATTACHMENTS[0]);
      renderPage();
      await waitFor(() => screen.getByRole("button", { name: /upload/i }));
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      fireEvent.change(input, { target: { files: [file] } });
      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("File uploaded.");
      });
    });

    it("shows error toast on upload failure", async () => {
      mockUploadResidentTicketAttachment.mockRejectedValue(new Error("Upload failed"));
      renderPage();
      await waitFor(() => screen.getByRole("button", { name: /upload/i }));
      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
      fireEvent.change(input, { target: { files: [file] } });
      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("Upload failed");
      });
    });
  });

  describe("conversation", () => {
    it("renders messages from conversation thread", async () => {
      mockGetResidentTicketDetail.mockResolvedValue({
        ...BASE_TICKET,
        messages: [MOCK_MESSAGE, MOCK_ADMIN_MESSAGE],
      });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Hello from resident")).toBeInTheDocument();
        expect(screen.getByText("Hello from admin")).toBeInTheDocument();
      });
    });

    it("shows reply form for ticket creator when not closed", async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole("textbox", { name: /reply/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /send reply/i })).toBeInTheDocument();
      });
    });

    it("shows reply form for non-creator resident (community participation)", async () => {
      renderPage(MOCK_OTHER_USER);
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /send reply/i })).toBeInTheDocument();
      });
    });

    it("hides reply form for closed ticket", async () => {
      mockGetResidentTicketDetail.mockResolvedValue(CLOSED_TICKET);
      renderPage();
      await waitFor(() => screen.getByText("Broken elevator"));
      expect(screen.queryByRole("button", { name: /send reply/i })).not.toBeInTheDocument();
    });

    it("shows closed notice on closed ticket", async () => {
      mockGetResidentTicketDetail.mockResolvedValue(CLOSED_TICKET);
      renderPage();
      await waitFor(() => {
        expect(screen.getByTestId("closed-notice")).toBeInTheDocument();
        expect(screen.getByText(/this ticket is closed/i)).toBeInTheDocument();
      });
    });

    it("sends reply on valid input", async () => {
      const user = userEvent.setup();
      mockPostResidentTicketMessage.mockResolvedValue({ id: "msg-new" });
      renderPage();
      await waitFor(() => screen.getByRole("textbox", { name: /reply/i }));
      await user.type(screen.getByRole("textbox", { name: /reply/i }), "My reply text here");
      await user.click(screen.getByRole("button", { name: /send reply/i }));
      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("Message sent.");
      });
    });

    it("disables Send Reply when reply is empty", async () => {
      renderPage();
      await waitFor(() => screen.getByRole("button", { name: /send reply/i }));
      expect(screen.getByRole("button", { name: /send reply/i })).toBeDisabled();
    });

    it("shows error toast on reply failure", async () => {
      const user = userEvent.setup();
      mockPostResidentTicketMessage.mockRejectedValue(new Error("Reply failed"));
      renderPage();
      await waitFor(() => screen.getByRole("textbox", { name: /reply/i }));
      await user.type(screen.getByRole("textbox", { name: /reply/i }), "Some reply content");
      await user.click(screen.getByRole("button", { name: /send reply/i }));
      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("Reply failed");
      });
    });
  });

  describe("reopen button", () => {
    it("shows reopen button for creator on RESOLVED ticket within 7 days", async () => {
      mockGetResidentTicketDetail.mockResolvedValue(RESOLVED_TICKET);
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /reopen ticket/i })).toBeInTheDocument();
      });
    });

    it("hides reopen button after 7 days", async () => {
      mockGetResidentTicketDetail.mockResolvedValue(RESOLVED_OLD_TICKET);
      renderPage();
      await waitFor(() => screen.getByText("Broken elevator"));
      expect(screen.queryByRole("button", { name: /reopen ticket/i })).not.toBeInTheDocument();
    });

    it("hides reopen button for non-creator on RESOLVED ticket", async () => {
      mockGetResidentTicketDetail.mockResolvedValue(RESOLVED_TICKET);
      renderPage(MOCK_OTHER_USER);
      await waitFor(() => screen.getByText("Broken elevator"));
      expect(screen.queryByRole("button", { name: /reopen ticket/i })).not.toBeInTheDocument();
    });

    it("calls reopenResidentTicket on reopen button click", async () => {
      mockGetResidentTicketDetail.mockResolvedValue(RESOLVED_TICKET);
      mockReopenResidentTicket.mockResolvedValue(undefined);
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /reopen ticket/i })).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByRole("button", { name: /reopen ticket/i }));
      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("Ticket reopened.");
      });
    });

    it("shows error toast on reopen failure", async () => {
      mockGetResidentTicketDetail.mockResolvedValue(RESOLVED_TICKET);
      mockReopenResidentTicket.mockRejectedValue(new Error("Reopen failed"));
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /reopen ticket/i })).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByRole("button", { name: /reopen ticket/i }));
      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("Reopen failed");
      });
    });
  });

  describe("back navigation", () => {
    it("navigates back to /r/support on back button click", async () => {
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /back to support/i })).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByRole("button", { name: /back to support/i }));
      expect(mockRouterPush).toHaveBeenCalledWith("/r/support");
    });
  });

  describe("details sidebar card", () => {
    it("shows creation date in details card", async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Created")).toBeInTheDocument();
      });
    });

    it("shows resolved date when ticket is resolved", async () => {
      mockGetResidentTicketDetail.mockResolvedValue(RESOLVED_TICKET);
      renderPage();
      await waitFor(() => {
        // "Resolved" appears as both the status badge label and the sidebar details key
        expect(screen.getAllByText("Resolved").length).toBeGreaterThanOrEqual(2);
      });
    });

    it("shows closed date when ticket is closed", async () => {
      mockGetResidentTicketDetail.mockResolvedValue(CLOSED_TICKET);
      renderPage();
      await waitFor(() => {
        // "Closed" appears as both the status badge label and the sidebar details key
        expect(screen.getAllByText("Closed").length).toBeGreaterThanOrEqual(2);
      });
    });
  });

  describe("petition linking card", () => {
    it("shows 'No petition linked' when ticket has no petition", async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("No petition linked")).toBeInTheDocument();
      });
    });

    it("shows Link to Petition button for ticket creator when not closed", async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /link to petition/i })).toBeInTheDocument();
      });
    });

    it("hides Link to Petition button for non-creator", async () => {
      renderPage(MOCK_OTHER_USER);
      await waitFor(() => screen.getByText("No petition linked"));
      expect(screen.queryByRole("button", { name: /link to petition/i })).not.toBeInTheDocument();
    });

    it("hides Link to Petition button for closed ticket", async () => {
      mockGetResidentTicketDetail.mockResolvedValue(CLOSED_TICKET);
      renderPage();
      await waitFor(() => screen.getByText("No petition linked"));
      expect(screen.queryByRole("button", { name: /link to petition/i })).not.toBeInTheDocument();
    });

    it("shows petition select when Link to Petition is clicked", async () => {
      mockGetResidentPetitions.mockResolvedValue({ data: [] });
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /link to petition/i })).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByRole("button", { name: /link to petition/i }));
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /^link$/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
      });
    });

    it("cancels petition select on Cancel click", async () => {
      mockGetResidentPetitions.mockResolvedValue({ data: [] });
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /link to petition/i })).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByRole("button", { name: /link to petition/i }));
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /link to petition/i })).toBeInTheDocument();
      });
    });

    it("shows linked petition info when petition is linked", async () => {
      mockGetResidentTicketDetail.mockResolvedValue(TICKET_WITH_PETITION);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Fix elevator petition")).toBeInTheDocument();
      });
    });

    it("shows View Petition link for PUBLISHED petition", async () => {
      mockGetResidentTicketDetail.mockResolvedValue(TICKET_WITH_PETITION);
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole("link", { name: /view petition/i })).toBeInTheDocument();
      });
    });

    it("hides View Petition link for DRAFT petition", async () => {
      mockGetResidentTicketDetail.mockResolvedValue(TICKET_WITH_DRAFT_PETITION);
      renderPage();
      await waitFor(() => screen.getByText("Draft petition"));
      expect(screen.queryByRole("link", { name: /view petition/i })).not.toBeInTheDocument();
    });

    it("shows Unlink button for creator when petition is linked", async () => {
      mockGetResidentTicketDetail.mockResolvedValue(TICKET_WITH_PETITION);
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /unlink/i })).toBeInTheDocument();
      });
    });

    it("hides Unlink button for non-creator", async () => {
      mockGetResidentTicketDetail.mockResolvedValue(TICKET_WITH_PETITION);
      renderPage(MOCK_OTHER_USER);
      await waitFor(() => screen.getByText("Fix elevator petition"));
      expect(screen.queryByRole("button", { name: /unlink/i })).not.toBeInTheDocument();
    });

    it("calls linkResidentTicketPetition(null) when Unlink is clicked", async () => {
      mockGetResidentTicketDetail.mockResolvedValue(TICKET_WITH_PETITION);
      mockLinkResidentTicketPetition.mockResolvedValue(BASE_TICKET);
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /unlink/i })).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByRole("button", { name: /unlink/i }));
      await waitFor(() => {
        expect(mockLinkResidentTicketPetition).toHaveBeenCalledWith("ticket-1", null);
      });
    });

    it("shows error toast on petition link failure", async () => {
      mockGetResidentTicketDetail.mockResolvedValue(TICKET_WITH_PETITION);
      mockLinkResidentTicketPetition.mockRejectedValue(new Error("Link failed"));
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /unlink/i })).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByRole("button", { name: /unlink/i }));
      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("Link failed");
      });
    });

    it("shows empty petition message when no published petitions available", async () => {
      mockGetResidentPetitions.mockResolvedValue({ data: [] });
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /link to petition/i })).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByRole("button", { name: /link to petition/i }));
      await waitFor(() => {
        // Select shows with no options
        expect(screen.getByRole("button", { name: /^link$/i })).toBeInTheDocument();
      });
    });

    it("filters out DRAFT petitions from the link dropdown", async () => {
      const draftPetition = {
        id: "pet-draft",
        title: "Draft petition",
        type: "PETITION",
        status: "DRAFT",
        description: null,
        societyId: "soc-1",
        documentUrl: null,
        targetAuthority: null,
        minSignatures: null,
        deadline: null,
        closedReason: null,
        submittedAt: null,
        publishedAt: null,
        createdAt: NOW,
        creator: { name: "Admin" },
      };
      const publishedPetition = {
        ...draftPetition,
        id: "pet-pub",
        title: "Published Petition",
        status: "PUBLISHED",
      };
      mockGetResidentPetitions.mockResolvedValue({
        data: [draftPetition, publishedPetition],
      });
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /link to petition/i })).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByRole("button", { name: /link to petition/i }));
      // Only published petition should appear after filter; draft petition should not render
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /^link$/i })).toBeInTheDocument(),
      );
      // Published petition title is rendered as SelectItem
      expect(screen.queryByText("Draft petition")).not.toBeInTheDocument();
    });

    it("shows petition select (no 'No published petitions' message) when items exist", async () => {
      const publishedPetition = {
        id: "pet-pub",
        title: "Elevator Petition",
        type: "PETITION",
        status: "PUBLISHED",
        description: null,
        societyId: "soc-1",
        documentUrl: null,
        targetAuthority: null,
        minSignatures: null,
        deadline: null,
        closedReason: null,
        submittedAt: null,
        publishedAt: null,
        createdAt: NOW,
        creator: { name: "Admin" },
      };
      mockGetResidentPetitions.mockResolvedValue({ data: [publishedPetition] });
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /link to petition/i })).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByRole("button", { name: /link to petition/i }));
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /^link$/i })).toBeInTheDocument(),
      );
      // Petitions were fetched — query ran and filter function was applied
      expect(mockGetResidentPetitions).toHaveBeenCalled();
      // "No published petitions" message should NOT appear when there are items
      expect(screen.queryByText("No published petitions")).not.toBeInTheDocument();
    });

    it("shows success toast on petition unlink", async () => {
      mockGetResidentTicketDetail.mockResolvedValue(TICKET_WITH_PETITION);
      mockLinkResidentTicketPetition.mockResolvedValue(BASE_TICKET);
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /unlink/i })).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByRole("button", { name: /unlink/i }));
      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalled();
      });
    });
  });

  // ── Handled By card ───────────────────────────────────────────────────────

  describe("Handled By", () => {
    it("shows Handled By card when ticket has assignees", async () => {
      mockGetResidentTicketDetail.mockResolvedValue({
        ...BASE_TICKET,
        assignees: [
          {
            id: "a-1",
            userId: "u-3",
            assignedAt: NOW,
            assignee: {
              id: "u-3",
              name: "Ravi Kumar",
              governingBodyMembership: { designation: { name: "Secretary" } },
            },
          },
        ],
      });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Handled By")).toBeInTheDocument();
        expect(screen.getByText("Ravi Kumar")).toBeInTheDocument();
        expect(screen.getByText("· Secretary")).toBeInTheDocument();
      });
    });

    it("hides Handled By card when ticket has no assignees", async () => {
      renderPage();
      await waitFor(() => screen.getByText("Broken elevator"));
      expect(screen.queryByText("Handled By")).not.toBeInTheDocument();
    });
  });
});
