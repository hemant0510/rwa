import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCounsellor = vi.hoisted(() => vi.fn());
const mockUpdateCounsellor = vi.hoisted(() => vi.fn());
const mockResendInvite = vi.hoisted(() => vi.fn());
const mockDeleteCounsellor = vi.hoisted(() => vi.fn());
const mockToastSuccess = vi.hoisted(() => vi.fn());
const mockToastError = vi.hoisted(() => vi.fn());
const mockUseParams = vi.hoisted(() => vi.fn(() => ({ id: "c-1" })));

vi.mock("next/navigation", () => ({
  useParams: mockUseParams,
}));
vi.mock("@/services/counsellors", () => ({
  getCounsellor: mockGetCounsellor,
  updateCounsellor: mockUpdateCounsellor,
  resendCounsellorInvite: mockResendInvite,
  deleteCounsellor: mockDeleteCounsellor,
}));

vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

vi.mock("@/components/features/sa-counsellors/CounsellorProfileCard", () => ({
  CounsellorProfileCard: ({ counsellor }: { counsellor: { name: string } }) => (
    <div data-testid="profile-card">{counsellor.name}</div>
  ),
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import CounsellorDetailPage from "@/app/sa/counsellors/[id]/page";

function renderPage(id = "c-1") {
  mockUseParams.mockReturnValue({ id });
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CounsellorDetailPage />
    </QueryClientProvider>,
  );
}

const activeOnboarded = {
  id: "c-1",
  name: "Asha Patel",
  email: "asha@x.com",
  isActive: true,
  mfaEnrolledAt: new Date().toISOString(),
};

const activePendingInvite = { ...activeOnboarded, mfaEnrolledAt: null };
const suspended = { ...activeOnboarded, isActive: false };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CounsellorDetailPage", () => {
  it("renders back link", async () => {
    mockGetCounsellor.mockResolvedValue(activeOnboarded);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Back to counsellors/)).toBeInTheDocument();
    });
  });

  it("shows loading skeleton while fetching", async () => {
    mockGetCounsellor.mockImplementation(() => new Promise(() => {}));
    const { container } = renderPage();
    await waitFor(() => {
      expect(container.querySelector('[class*="animate-pulse"]')).toBeTruthy();
    });
  });

  it("renders error banner on query failure", async () => {
    mockGetCounsellor.mockRejectedValue(new Error("boom"));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Failed to load counsellor/)).toBeInTheDocument();
    });
  });

  it("renders profile card, Suspend, and Remove buttons for active onboarded", async () => {
    mockGetCounsellor.mockResolvedValue(activeOnboarded);
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("profile-card")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Suspend/ })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Remove/ })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /Resend invite/ })).not.toBeInTheDocument();
  });

  it("shows Resend invite button when active but not onboarded", async () => {
    mockGetCounsellor.mockResolvedValue(activePendingInvite);
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Resend invite/ })).toBeInTheDocument();
    });
  });

  it("shows Reactivate button when suspended", async () => {
    mockGetCounsellor.mockResolvedValue(suspended);
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Reactivate/ })).toBeInTheDocument();
    });
  });

  it("calls updateCounsellor(isActive=false) when Suspend clicked", async () => {
    mockGetCounsellor.mockResolvedValue(activeOnboarded);
    mockUpdateCounsellor.mockResolvedValue({ id: "c-1", isActive: false });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Suspend/ })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Suspend/ }));
    await waitFor(() => {
      expect(mockUpdateCounsellor).toHaveBeenCalledWith("c-1", { isActive: false });
      expect(mockToastSuccess).toHaveBeenCalledWith("Counsellor suspended");
    });
  });

  it("calls updateCounsellor(isActive=true) when Reactivate clicked", async () => {
    mockGetCounsellor.mockResolvedValue(suspended);
    mockUpdateCounsellor.mockResolvedValue({ id: "c-1", isActive: true });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Reactivate/ })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Reactivate/ }));
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Counsellor reactivated");
    });
  });

  it("shows toast.error when toggleActive fails", async () => {
    mockGetCounsellor.mockResolvedValue(activeOnboarded);
    mockUpdateCounsellor.mockRejectedValue(new Error("update failed"));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Suspend/ })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /Suspend/ }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("update failed");
    });
  });

  it("calls resendCounsellorInvite when Resend invite clicked", async () => {
    mockGetCounsellor.mockResolvedValue(activePendingInvite);
    mockResendInvite.mockResolvedValue({ id: "c-1", sent: true });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Resend invite/ })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /Resend invite/ }));
    await waitFor(() => {
      expect(mockResendInvite).toHaveBeenCalled();
      expect(mockToastSuccess).toHaveBeenCalledWith("Invitation email resent");
    });
  });

  it("shows toast.error when resend invite fails", async () => {
    mockGetCounsellor.mockResolvedValue(activePendingInvite);
    mockResendInvite.mockRejectedValue(new Error("rate limit"));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Resend invite/ })).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: /Resend invite/ }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("rate limit");
    });
  });

  it("opens confirmation dialog when Remove clicked", async () => {
    mockGetCounsellor.mockResolvedValue(activeOnboarded);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByRole("button", { name: /Remove/ })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Remove/ }));
    await waitFor(() => {
      expect(screen.getByText("Remove this counsellor?")).toBeInTheDocument();
    });
  });

  it("calls deleteCounsellor when Yes, remove is confirmed", async () => {
    mockGetCounsellor.mockResolvedValue(activeOnboarded);
    mockDeleteCounsellor.mockResolvedValue({ id: "c-1", deleted: true });
    const originalLocation = globalThis.location;
    Object.defineProperty(globalThis, "location", {
      configurable: true,
      value: { ...originalLocation, href: "" },
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByRole("button", { name: /Remove/ })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Remove/ }));
    await waitFor(() => expect(screen.getByText(/Yes, remove/)).toBeInTheDocument());
    await user.click(screen.getByText(/Yes, remove/));
    await waitFor(() => {
      expect(mockDeleteCounsellor).toHaveBeenCalled();
      expect(mockToastSuccess).toHaveBeenCalledWith("Counsellor removed");
    });
  });

  it("shows toast.error when delete fails", async () => {
    mockGetCounsellor.mockResolvedValue(activeOnboarded);
    mockDeleteCounsellor.mockRejectedValue(new Error("del failed"));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByRole("button", { name: /Remove/ })).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Remove/ }));
    await waitFor(() => expect(screen.getByText(/Yes, remove/)).toBeInTheDocument());
    await user.click(screen.getByText(/Yes, remove/));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("del failed");
    });
  });
});
