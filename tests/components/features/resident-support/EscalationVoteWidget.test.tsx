import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetStatus, mockCast, mockWithdraw } = vi.hoisted(() => ({
  mockGetStatus: vi.fn(),
  mockCast: vi.fn(),
  mockWithdraw: vi.fn(),
}));

vi.mock("@/services/resident-support", () => ({
  getResidentEscalationStatus: mockGetStatus,
  castEscalationVote: mockCast,
  withdrawEscalationVote: mockWithdraw,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";

import { EscalationVoteWidget } from "@/components/features/resident-support/EscalationVoteWidget";

function renderWidget(props: Partial<React.ComponentProps<typeof EscalationVoteWidget>> = {}) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <EscalationVoteWidget ticketId="t-1" canVote={true} {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("EscalationVoteWidget", () => {
  it("renders loading state before data arrives", () => {
    mockGetStatus.mockImplementation(() => new Promise(() => {}));
    renderWidget();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders vote progress when not yet escalated", async () => {
    mockGetStatus.mockResolvedValue({
      ticketId: "t-1",
      threshold: 5,
      voteCount: 2,
      hasVoted: false,
      escalationCreated: false,
    });
    renderWidget();
    await waitFor(() => {
      expect(screen.getByText(/2 of 5 resident votes/)).toBeInTheDocument();
    });
  });

  it("shows Support escalation button when canVote and not voted", async () => {
    mockGetStatus.mockResolvedValue({
      ticketId: "t-1",
      threshold: 5,
      voteCount: 1,
      hasVoted: false,
      escalationCreated: false,
    });
    renderWidget();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Support escalation/i })).toBeInTheDocument();
    });
  });

  it("shows Withdraw my vote when hasVoted is true", async () => {
    mockGetStatus.mockResolvedValue({
      ticketId: "t-1",
      threshold: 5,
      voteCount: 3,
      hasVoted: true,
      escalationCreated: false,
    });
    renderWidget();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Withdraw my vote/i })).toBeInTheDocument();
    });
  });

  it("hides voting buttons when canVote is false", async () => {
    mockGetStatus.mockResolvedValue({
      ticketId: "t-1",
      threshold: 5,
      voteCount: 1,
      hasVoted: false,
      escalationCreated: false,
    });
    renderWidget({ canVote: false });
    await waitFor(() => expect(screen.getByText(/1 of 5/)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /Support escalation/i })).not.toBeInTheDocument();
  });

  it("renders escalated success copy when escalationCreated is true", async () => {
    mockGetStatus.mockResolvedValue({
      ticketId: "t-1",
      threshold: 5,
      voteCount: 5,
      hasVoted: true,
      escalationCreated: true,
    });
    renderWidget();
    await waitFor(() => {
      expect(screen.getByText(/has been escalated to the society counsellor/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /Support escalation/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Withdraw my vote/i })).not.toBeInTheDocument();
  });

  it("calls castEscalationVote and shows threshold-reached toast when escalationCreated true", async () => {
    mockGetStatus.mockResolvedValue({
      ticketId: "t-1",
      threshold: 5,
      voteCount: 4,
      hasVoted: false,
      escalationCreated: false,
    });
    mockCast.mockResolvedValue({
      ticketId: "t-1",
      threshold: 5,
      voteCount: 5,
      hasVoted: true,
      escalationCreated: true,
    });
    renderWidget();
    const btn = await screen.findByRole("button", { name: /Support escalation/i });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(mockCast).toHaveBeenCalledWith("t-1");
      expect(toast.success).toHaveBeenCalledWith(
        "Threshold reached — ticket escalated to counsellor",
      );
    });
  });

  it("calls castEscalationVote and shows vote-recorded toast when threshold not yet reached", async () => {
    mockGetStatus.mockResolvedValue({
      ticketId: "t-1",
      threshold: 5,
      voteCount: 2,
      hasVoted: false,
      escalationCreated: false,
    });
    mockCast.mockResolvedValue({
      ticketId: "t-1",
      threshold: 5,
      voteCount: 3,
      hasVoted: true,
      escalationCreated: false,
    });
    renderWidget();
    const btn = await screen.findByRole("button", { name: /Support escalation/i });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Your vote has been recorded");
    });
  });

  it("shows toast.error when cast fails", async () => {
    mockGetStatus.mockResolvedValue({
      ticketId: "t-1",
      threshold: 5,
      voteCount: 2,
      hasVoted: false,
      escalationCreated: false,
    });
    mockCast.mockRejectedValue(new Error("cast boom"));
    renderWidget();
    const btn = await screen.findByRole("button", { name: /Support escalation/i });
    fireEvent.click(btn);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("cast boom"));
  });

  it("calls withdrawEscalationVote and shows withdrawn toast", async () => {
    mockGetStatus.mockResolvedValue({
      ticketId: "t-1",
      threshold: 5,
      voteCount: 3,
      hasVoted: true,
      escalationCreated: false,
    });
    mockWithdraw.mockResolvedValue({
      ticketId: "t-1",
      threshold: 5,
      voteCount: 2,
      hasVoted: false,
      escalationCreated: false,
    });
    renderWidget();
    const btn = await screen.findByRole("button", { name: /Withdraw my vote/i });
    fireEvent.click(btn);
    await waitFor(() => {
      expect(mockWithdraw).toHaveBeenCalledWith("t-1");
      expect(toast.success).toHaveBeenCalledWith("Your vote has been withdrawn");
    });
  });

  it("shows toast.error when withdraw fails", async () => {
    mockGetStatus.mockResolvedValue({
      ticketId: "t-1",
      threshold: 5,
      voteCount: 3,
      hasVoted: true,
      escalationCreated: false,
    });
    mockWithdraw.mockRejectedValue(new Error("withdraw boom"));
    renderWidget();
    const btn = await screen.findByRole("button", { name: /Withdraw my vote/i });
    fireEvent.click(btn);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("withdraw boom"));
  });

  it("caps progress at 100% when voteCount exceeds threshold", async () => {
    mockGetStatus.mockResolvedValue({
      ticketId: "t-1",
      threshold: 3,
      voteCount: 5,
      hasVoted: true,
      escalationCreated: false,
    });
    renderWidget();
    await waitFor(() => expect(screen.getByText(/5 of 3/)).toBeInTheDocument());
  });
});
