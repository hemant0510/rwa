import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetMyCounsellor = vi.hoisted(() => vi.fn());

vi.mock("@/services/counsellors", () => ({
  getMyCounsellor: mockGetMyCounsellor,
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";

import { YourCounsellorCard } from "@/components/features/sa-counsellors/YourCounsellorCard";

function renderCard() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <YourCounsellorCard />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("YourCounsellorCard", () => {
  it("renders loading state initially", () => {
    mockGetMyCounsellor.mockImplementation(() => new Promise(() => {}));
    renderCard();
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("renders empty state when no counsellor assigned", async () => {
    mockGetMyCounsellor.mockResolvedValue({ counsellor: null });
    renderCard();
    await waitFor(() => {
      expect(screen.getByText(/No counsellor is currently assigned/)).toBeInTheDocument();
    });
  });

  it("renders error state when query fails", async () => {
    mockGetMyCounsellor.mockRejectedValue(new Error("server"));
    renderCard();
    await waitFor(() => {
      expect(screen.getByText(/Could not load/)).toBeInTheDocument();
    });
  });

  it("renders counsellor name, email, and blurb when assigned", async () => {
    mockGetMyCounsellor.mockResolvedValue({
      counsellor: {
        id: "c-1",
        name: "Asha Patel",
        email: "asha@x.com",
        publicBlurb: "Neutral advisor",
        photoUrl: null,
        assignedAt: new Date().toISOString(),
      },
    });
    renderCard();
    await waitFor(() => {
      expect(screen.getByText("Asha Patel")).toBeInTheDocument();
      expect(screen.getByText("asha@x.com")).toBeInTheDocument();
      expect(screen.getByText("Neutral advisor")).toBeInTheDocument();
    });
  });

  it("renders initial-letter avatar when no photo", async () => {
    mockGetMyCounsellor.mockResolvedValue({
      counsellor: {
        id: "c-1",
        name: "Asha",
        email: "asha@x.com",
        publicBlurb: null,
        photoUrl: null,
        assignedAt: new Date().toISOString(),
      },
    });
    renderCard();
    await waitFor(() => {
      expect(screen.getByText("A")).toBeInTheDocument();
    });
  });

  it("renders <img> when photoUrl is provided", async () => {
    mockGetMyCounsellor.mockResolvedValue({
      counsellor: {
        id: "c-1",
        name: "Asha",
        email: "asha@x.com",
        publicBlurb: null,
        photoUrl: "https://cdn.example.com/asha.jpg",
        assignedAt: new Date().toISOString(),
      },
    });
    renderCard();
    await waitFor(() => {
      expect(screen.getByRole("img", { name: "Asha" })).toBeInTheDocument();
    });
  });

  it("does NOT render blurb section when blurb is null", async () => {
    mockGetMyCounsellor.mockResolvedValue({
      counsellor: {
        id: "c-1",
        name: "Asha",
        email: "asha@x.com",
        publicBlurb: null,
        photoUrl: null,
        assignedAt: new Date().toISOString(),
      },
    });
    renderCard();
    await waitFor(() => expect(screen.getByText("Asha")).toBeInTheDocument());
    expect(screen.queryByText("Neutral advisor")).not.toBeInTheDocument();
  });
});
