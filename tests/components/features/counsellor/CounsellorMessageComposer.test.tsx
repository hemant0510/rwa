import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPost } = vi.hoisted(() => ({
  mockPost: vi.fn(),
}));

vi.mock("@/services/counsellor-self", () => ({
  postCounsellorMessage: mockPost,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";

import { CounsellorMessageComposer } from "@/components/features/counsellor/CounsellorMessageComposer";

function renderComposer(disabled = false) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>
      <CounsellorMessageComposer escalationId="e-1" disabled={disabled} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CounsellorMessageComposer", () => {
  it("renders advisory and private note toggles", () => {
    renderComposer();
    expect(screen.getByRole("button", { name: /Advisory to admin/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Private note/ })).toBeInTheDocument();
  });

  it("Post is disabled when content empty", () => {
    renderComposer();
    expect(screen.getByRole("button", { name: /Post/ })).toBeDisabled();
  });

  it("Post is disabled when disabled prop is true", () => {
    renderComposer(true);
    const ta = screen.getByPlaceholderText(/Visible to RWA admins/);
    fireEvent.change(ta, { target: { value: "Hello admin" } });
    expect(screen.getByRole("button", { name: /Post/ })).toBeDisabled();
  });

  it("posts ADVISORY_TO_ADMIN by default and shows success toast", async () => {
    mockPost.mockResolvedValueOnce({
      id: "m-1",
      authorRole: "COUNSELLOR",
      content: "Hello",
      kind: "ADVISORY_TO_ADMIN",
      isInternal: false,
      createdAt: "now",
    });
    renderComposer();
    const ta = screen.getByPlaceholderText(/Visible to RWA admins/);
    fireEvent.change(ta, { target: { value: "  Hello admin  " } });
    fireEvent.click(screen.getByRole("button", { name: /Post/ }));
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith("e-1", {
        content: "Hello admin",
        kind: "ADVISORY_TO_ADMIN",
      }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Advisory posted"));
  });

  it("switches to PRIVATE_NOTE and posts with correct kind", async () => {
    mockPost.mockResolvedValueOnce({
      id: "m-2",
      authorRole: "COUNSELLOR",
      content: "note",
      kind: "PRIVATE_NOTE",
      isInternal: true,
      createdAt: "now",
    });
    renderComposer();
    fireEvent.click(screen.getByRole("button", { name: /Private note/ }));
    const ta = screen.getByPlaceholderText(/Visible only to you/);
    fireEvent.change(ta, { target: { value: "Only me" } });
    fireEvent.click(screen.getByRole("button", { name: /Post/ }));
    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith("e-1", {
        content: "Only me",
        kind: "PRIVATE_NOTE",
      }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Private note saved"));
  });

  it("switches back to advisory after selecting private note", () => {
    renderComposer();
    fireEvent.click(screen.getByRole("button", { name: /Private note/ }));
    expect(screen.getByPlaceholderText(/Visible only to you/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Advisory to admin/ }));
    expect(screen.getByPlaceholderText(/Visible to RWA admins/)).toBeInTheDocument();
  });

  it("shows error toast on failure", async () => {
    mockPost.mockRejectedValueOnce(new Error("Nope"));
    renderComposer();
    const ta = screen.getByPlaceholderText(/Visible to RWA admins/);
    fireEvent.change(ta, { target: { value: "Hello admin" } });
    fireEvent.click(screen.getByRole("button", { name: /Post/ }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Nope"));
  });
});
