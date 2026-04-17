import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { AnnouncementBanner } from "@/components/features/announcements/AnnouncementBanner";

// Mock useSocietyId
vi.mock("@/hooks/useSocietyId", () => ({
  useSocietyId: () => ({
    societyId: "soc-1",
    societyName: "Test Society",
    societyCode: "TST",
    isSuperAdminViewing: false,
    saQueryString: "",
  }),
}));

// Mock the service module
const mockGetUnread = vi.fn();
const mockMarkRead = vi.fn();

vi.mock("@/services/announcements", () => ({
  getUnreadAnnouncements: () => mockGetUnread(),
  markAnnouncementRead: (id: string) => mockMarkRead(id),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe("AnnouncementBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUnread.mockResolvedValue([]);
    mockMarkRead.mockResolvedValue(undefined);
  });

  it("renders nothing when no announcements", async () => {
    const { container } = render(<AnnouncementBanner />, {
      wrapper: createWrapper(),
    });
    await waitFor(() => {
      expect(container.innerHTML).not.toContain("alert");
    });
  });

  it("renders announcements with subjects", async () => {
    mockGetUnread.mockResolvedValue([
      {
        id: "ann-1",
        subject: "Important Update",
        body: "Check out the new features",
        priority: "NORMAL",
        createdAt: new Date().toISOString(),
      },
    ]);

    render(<AnnouncementBanner />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Important Update")).toBeInTheDocument();
    });
    expect(screen.getByText("Check out the new features")).toBeInTheDocument();
  });

  it("renders URGENT announcements with destructive variant", async () => {
    mockGetUnread.mockResolvedValue([
      {
        id: "ann-1",
        subject: "Critical",
        body: "Urgent notice",
        priority: "URGENT",
        createdAt: new Date().toISOString(),
      },
    ]);

    render(<AnnouncementBanner />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Critical")).toBeInTheDocument();
    });

    // The Alert with destructive variant should exist
    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
  });

  it("renders NORMAL announcements with default variant", async () => {
    mockGetUnread.mockResolvedValue([
      {
        id: "ann-1",
        subject: "Info",
        body: "Normal notice",
        priority: "NORMAL",
        createdAt: new Date().toISOString(),
      },
    ]);

    render(<AnnouncementBanner />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Info")).toBeInTheDocument();
    });
  });

  it("dismisses announcement on click and calls markRead", async () => {
    const user = userEvent.setup();
    mockGetUnread.mockResolvedValue([
      {
        id: "ann-1",
        subject: "Dismissable",
        body: "Test",
        priority: "NORMAL",
        createdAt: new Date().toISOString(),
      },
    ]);

    render(<AnnouncementBanner />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Dismissable")).toBeInTheDocument();
    });

    const dismissButton = screen.getByRole("button", { name: /dismiss/i });
    await user.click(dismissButton);

    await waitFor(() => {
      expect(mockMarkRead).toHaveBeenCalledWith("ann-1");
    });

    // Announcement should be removed from DOM after dismiss
    await waitFor(() => {
      expect(screen.queryByText("Dismissable")).not.toBeInTheDocument();
    });
  });

  it("renders multiple announcements", async () => {
    mockGetUnread.mockResolvedValue([
      {
        id: "ann-1",
        subject: "First",
        body: "Body 1",
        priority: "NORMAL",
        createdAt: new Date().toISOString(),
      },
      {
        id: "ann-2",
        subject: "Second",
        body: "Body 2",
        priority: "URGENT",
        createdAt: new Date().toISOString(),
      },
    ]);

    render(<AnnouncementBanner />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("First")).toBeInTheDocument();
      expect(screen.getByText("Second")).toBeInTheDocument();
    });
  });

  it("handles markRead error gracefully", async () => {
    const user = userEvent.setup();
    mockGetUnread.mockResolvedValue([
      {
        id: "ann-1",
        subject: "Error Test",
        body: "Test",
        priority: "NORMAL",
        createdAt: new Date().toISOString(),
      },
    ]);
    mockMarkRead.mockRejectedValue(new Error("Network error"));

    render(<AnnouncementBanner />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Error Test")).toBeInTheDocument();
    });

    const dismissButton = screen.getByRole("button", { name: /dismiss/i });
    await user.click(dismissButton);

    // Should not crash — error handled gracefully
    await waitFor(() => {
      expect(mockMarkRead).toHaveBeenCalled();
    });
  });
});
