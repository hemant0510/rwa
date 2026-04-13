import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/r/profile",
}));

vi.mock("@/lib/utils/compress-image", () => ({
  compressImage: vi.fn().mockImplementation((f: File) => Promise.resolve(f)),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

global.fetch = mockFetch;

import ResidentProfilePage from "@/app/r/profile/page";
import { AuthContext } from "@/hooks/useAuth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderWithProviders(fetchResponse: Record<string, unknown> | null = null) {
  if (fetchResponse) {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fetchResponse),
    });
  }

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const value = {
    user: {
      id: "u1",
      name: "Test User",
      role: "RESIDENT" as const,
      permission: null,
      societyId: "soc-1",
      societyName: "Eden Estate",
      societyCode: "EDEN",
      societyStatus: "ACTIVE",
      trialEndsAt: null,
      isTrialExpired: false,
      multiSociety: false,
      societies: null,
    },
    isLoading: false,
    isAuthenticated: true,
    signOut: vi.fn(),
    switchSociety: vi.fn(),
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={value}>
        <ResidentProfilePage />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

const profileData = {
  id: "u1",
  name: "Hemant Bhagat",
  email: "hemant@example.com",
  mobile: "9876543210",
  rwaid: "EDEN-001",
  status: "ACTIVE_PAID",
  ownershipType: "OWNER",
  societyName: "Eden Estate",
  unit: "A-101",
  designation: null as string | null,
};

/**
 * Route-aware fetch mock: profile always returns profileData,
 * id-proof and ownership-proof return the given URLs.
 */
function setupRoutedFetch(
  idProofUrl: string | null = null,
  ownershipProofUrl: string | null = null,
  photoUrl: string | null = null,
) {
  mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
    const method = (opts?.method ?? "GET").toUpperCase();
    if (url === "/api/v1/residents/me" && method === "GET") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
    }
    if (url === "/api/v1/residents/me/photo" && method === "GET") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ url: photoUrl }) });
    }
    if (url.includes("id-proof") && method === "GET") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ url: idProofUrl }) });
    }
    if (url.includes("ownership-proof") && method === "GET") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ url: ownershipProofUrl }),
      });
    }
    // Default for mutation responses (POST/DELETE)
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
}

// ---------------------------------------------------------------------------
// Profile page — static rendering
// ---------------------------------------------------------------------------

describe("ResidentProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders documents section heading", async () => {
    renderWithProviders(profileData);
    await waitFor(() => {
      expect(screen.getByText("My Documents")).toBeInTheDocument();
    });
  });

  it("renders user name", async () => {
    renderWithProviders(profileData);
    await waitFor(() => {
      expect(screen.getByText("Hemant Bhagat")).toBeInTheDocument();
    });
  });

  it("renders RWAID", async () => {
    renderWithProviders(profileData);
    await waitFor(() => {
      expect(screen.getByText("EDEN-001")).toBeInTheDocument();
    });
  });

  it("renders phone number", async () => {
    renderWithProviders(profileData);
    await waitFor(() => {
      expect(screen.getByText("+91 9876543210")).toBeInTheDocument();
    });
  });

  it("renders email", async () => {
    renderWithProviders(profileData);
    await waitFor(() => {
      expect(screen.getByText("hemant@example.com")).toBeInTheDocument();
    });
  });

  it("renders unit and society name", async () => {
    renderWithProviders(profileData);
    await waitFor(() => {
      expect(screen.getByText("A-101 — Eden Estate")).toBeInTheDocument();
    });
  });

  it("renders ownership type label", async () => {
    renderWithProviders(profileData);
    await waitFor(() => {
      expect(screen.getByText("Owner")).toBeInTheDocument();
    });
  });

  it("renders account status badge with label", async () => {
    renderWithProviders(profileData);
    await waitFor(() => {
      expect(screen.getByText("Active (Paid)")).toBeInTheDocument();
    });
  });

  it("shows designation when user has one", async () => {
    renderWithProviders({ ...profileData, designation: "President" });
    await waitFor(() => {
      expect(screen.getByText("President")).toBeInTheDocument();
    });
  });

  it("does not show designation when null", async () => {
    renderWithProviders(profileData);
    await waitFor(() => {
      expect(screen.getByText("Hemant Bhagat")).toBeInTheDocument();
    });
    expect(screen.queryByText("President")).not.toBeInTheDocument();
  });

  it("shows unable to load message on null profile", async () => {
    mockFetch.mockResolvedValue({ ok: false });
    renderWithProviders(null);
    // The query will fail, profile will be undefined
    await waitFor(() => {
      expect(screen.getByText("Unable to load profile.")).toBeInTheDocument();
    });
  });

  it("does not have sign out button", async () => {
    renderWithProviders(profileData);
    await waitFor(() => {
      expect(screen.getByText("Hemant Bhagat")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /sign out/i })).not.toBeInTheDocument();
  });

  it("does not show RWAID when null", async () => {
    renderWithProviders({ ...profileData, rwaid: null });
    await waitFor(() => {
      expect(screen.getByText("Hemant Bhagat")).toBeInTheDocument();
    });
    expect(screen.queryByText("EDEN-001")).not.toBeInTheDocument();
  });

  it("shows raw status as label and default color for unknown status", async () => {
    renderWithProviders({ ...profileData, status: "UNKNOWN_STATUS" });
    await waitFor(() => {
      expect(screen.getByText("UNKNOWN_STATUS")).toBeInTheDocument();
    });
  });

  it("does not show email section when email is null", async () => {
    renderWithProviders({ ...profileData, email: null });
    await waitFor(() => {
      expect(screen.getByText("Hemant Bhagat")).toBeInTheDocument();
    });
    expect(screen.queryByText("hemant@example.com")).not.toBeInTheDocument();
  });

  it("shows society-specific subtitle when societyName is present", async () => {
    renderWithProviders(profileData);
    await waitFor(() => {
      expect(
        screen.getByText("For Eden Estate · Each society requires separate documents"),
      ).toBeInTheDocument();
    });
  });

  it("shows generic subtitle when societyName is null", async () => {
    renderWithProviders({ ...profileData, societyName: null });
    await waitFor(() => {
      expect(screen.getByText("Each society requires separate documents")).toBeInTheDocument();
    });
  });

  it("falls back to OTHER ownership labels when ownershipType is null", async () => {
    renderWithProviders({ ...profileData, ownershipType: null });
    await waitFor(() => {
      expect(screen.getByText("Other")).toBeInTheDocument();
    });
  });

  it("does not show unit/society row when both unit and societyName are null", async () => {
    renderWithProviders({ ...profileData, unit: null, societyName: null });
    await waitFor(() => {
      expect(screen.getByText("Hemant Bhagat")).toBeInTheDocument();
    });
    expect(screen.queryByText("A-101")).not.toBeInTheDocument();
    expect(screen.queryByText("Eden Estate")).not.toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// DocCard — document state rendering
// ---------------------------------------------------------------------------

describe("DocCard — document state", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows Upload button and Pending badge when no document exists", async () => {
    setupRoutedFetch(null, null);
    renderWithProviders(null);
    await waitFor(() => screen.getByText("Hemant Bhagat"));
    // Two DocCards, both pending
    const uploadBtns = await screen.findAllByRole("button", { name: /^upload$/i });
    expect(uploadBtns.length).toBeGreaterThanOrEqual(1);
    const pendingBadges = screen.getAllByText("Pending");
    expect(pendingBadges.length).toBe(2);
  });

  it("shows Uploaded badge and view/replace/delete buttons when id-proof URL exists", async () => {
    setupRoutedFetch("https://example.com/id-proof.jpg", null);
    renderWithProviders(null);
    // Wait for the view button to appear (hasDoc=true branch)
    await waitFor(() => expect(screen.getByTitle("View document")).toBeInTheDocument());
    expect(screen.getByTitle("Replace document")).toBeInTheDocument();
    expect(screen.getByTitle("Remove document")).toBeInTheDocument();
    expect(screen.getAllByText("Uploaded")).toHaveLength(1);
  });

  it("shows Uploaded badge for both DocCards when both URLs exist", async () => {
    setupRoutedFetch("https://example.com/id-proof.jpg", "https://example.com/ownership-proof.pdf");
    renderWithProviders(null);
    await waitFor(() => expect(screen.getAllByText("Uploaded")).toHaveLength(2));
  });

  it("opens document in new tab when View button is clicked", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    setupRoutedFetch("https://example.com/id-proof.jpg", null);
    renderWithProviders(null);
    const viewBtn = await screen.findByTitle("View document");
    fireEvent.click(viewBtn);
    expect(openSpy).toHaveBeenCalledWith("https://example.com/id-proof.jpg", "_blank");
    openSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// DocCard — upload flow
// ---------------------------------------------------------------------------

describe("DocCard — upload flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls POST and shows success toast on successful upload", async () => {
    setupRoutedFetch(null, null);
    renderWithProviders(null);
    await waitFor(() => screen.getByText("Hemant Bhagat"));

    // Trigger file change on the first hidden file input (id-proof card)
    const fileInputs = document.querySelectorAll<HTMLInputElement>(
      'input[type="file"]:not([data-testid="photo-input"])',
    );
    const file = new File(["content"], "id.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("uploaded successfully"));
    });
  });

  it("shows error toast with server message when upload fails", async () => {
    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      const method = (opts?.method ?? "GET").toUpperCase();
      if (method === "POST") {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: { message: "File too large" } }),
        });
      }
      if (url === "/api/v1/residents/me") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ url: null }) });
    });

    renderWithProviders(null);
    await waitFor(() => screen.getByText("Hemant Bhagat"));

    const fileInputs = document.querySelectorAll<HTMLInputElement>(
      'input[type="file"]:not([data-testid="photo-input"])',
    );
    const file = new File(["content"], "id.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("File too large");
    });
  });

  it("shows fallback error message when server returns no error message", async () => {
    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      const method = (opts?.method ?? "GET").toUpperCase();
      if (method === "POST") {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({}),
        });
      }
      if (url === "/api/v1/residents/me") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ url: null }) });
    });

    renderWithProviders(null);
    await waitFor(() => screen.getByText("Hemant Bhagat"));

    const fileInputs = document.querySelectorAll<HTMLInputElement>(
      'input[type="file"]:not([data-testid="photo-input"])',
    );
    const file = new File(["content"], "id.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Upload failed");
    });
  });

  it("allows replacing a document (Replace button triggers file input)", async () => {
    setupRoutedFetch("https://example.com/id-proof.jpg", null);
    renderWithProviders(null);

    // Wait for hasDoc=true state
    await waitFor(() => screen.getByTitle("Replace document"));

    // After POST, GET returns updated URL
    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      const method = (opts?.method ?? "GET").toUpperCase();
      if (method === "POST") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      if (url === "/api/v1/residents/me") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      }
      if (url.includes("id-proof")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ url: "https://example.com/id-proof-new.jpg" }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ url: null }) });
    });

    // Trigger file change on the file input
    const fileInputs = document.querySelectorAll<HTMLInputElement>(
      'input[type="file"]:not([data-testid="photo-input"])',
    );
    const file = new File(["content"], "new-id.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("uploaded successfully"));
    });
  });

  it("clicking Upload button triggers file input click", async () => {
    setupRoutedFetch(null, null);
    renderWithProviders(null);
    await waitFor(() => screen.getByText("Hemant Bhagat"));

    // Spy on the file input's click method
    const fileInputs = document.querySelectorAll<HTMLInputElement>(
      'input[type="file"]:not([data-testid="photo-input"])',
    );
    const clickSpy = vi.spyOn(fileInputs[0], "click").mockImplementation(() => {});
    const uploadBtn = screen.getAllByRole("button", { name: /^upload$/i })[0];
    fireEvent.click(uploadBtn);
    expect(clickSpy).toHaveBeenCalled();
  });

  it("does nothing when doc file input change fires with no files", async () => {
    setupRoutedFetch(null, null);
    renderWithProviders(null);
    await waitFor(() => screen.getByText("Hemant Bhagat"));

    const fileInputs = document.querySelectorAll<HTMLInputElement>(
      'input[type="file"]:not([data-testid="photo-input"])',
    );
    fireEvent.change(fileInputs[0], { target: { files: [] } });

    // No upload should be triggered
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows 'Uploading…' text on Upload button while upload is in progress", async () => {
    let resolvePost!: (v: unknown) => void;
    const postPending = new Promise((resolve) => {
      resolvePost = resolve;
    });

    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      const method = (opts?.method ?? "GET").toUpperCase();
      if (method === "POST") return postPending;
      if (url === "/api/v1/residents/me") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ url: null }) });
    });

    renderWithProviders(null);
    await waitFor(() => screen.getByText("Hemant Bhagat"));

    const fileInputs = document.querySelectorAll<HTMLInputElement>(
      'input[type="file"]:not([data-testid="photo-input"])',
    );
    const file = new File(["content"], "id.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });

    await waitFor(() => expect(screen.getByText("Uploading…")).toBeInTheDocument());

    // Resolve the pending upload
    resolvePost({ ok: true, json: () => Promise.resolve({}) });
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });

  it("clicking Replace button triggers file input click", async () => {
    setupRoutedFetch("https://example.com/id-proof.jpg", null);
    renderWithProviders(null);
    await waitFor(() => screen.getByTitle("Replace document"));

    const fileInputs = document.querySelectorAll<HTMLInputElement>(
      'input[type="file"]:not([data-testid="photo-input"])',
    );
    const clickSpy = vi.spyOn(fileInputs[0], "click").mockImplementation(() => {});
    fireEvent.click(screen.getByTitle("Replace document"));
    expect(clickSpy).toHaveBeenCalled();
  });

  it("shows spinner on Replace button while upload is in progress (hasDoc=true)", async () => {
    let resolvePost!: (v: unknown) => void;
    const postPending = new Promise((resolve) => {
      resolvePost = resolve;
    });

    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      const method = (opts?.method ?? "GET").toUpperCase();
      if (method === "POST") return postPending;
      if (url === "/api/v1/residents/me") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      }
      if (url.includes("id-proof")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ url: "https://example.com/id-proof.jpg" }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ url: null }) });
    });

    renderWithProviders(null);
    await waitFor(() => screen.getByTitle("Replace document"));

    const fileInputs = document.querySelectorAll<HTMLInputElement>(
      'input[type="file"]:not([data-testid="photo-input"])',
    );
    const file = new File(["content"], "id.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInputs[0], { target: { files: [file] } });

    // Replace button should be disabled while uploading
    await waitFor(() => expect(screen.getByTitle("Replace document")).toBeDisabled());

    resolvePost({ ok: true, json: () => Promise.resolve({}) });
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });
});

// ---------------------------------------------------------------------------
// DocCard — delete flow
// ---------------------------------------------------------------------------

describe("DocCard — delete flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls DELETE and shows success toast when delete succeeds", async () => {
    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      const method = (opts?.method ?? "GET").toUpperCase();
      if (method === "DELETE") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true }) });
      }
      if (url === "/api/v1/residents/me") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      }
      if (url.includes("id-proof") && method === "GET") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ url: "https://example.com/id-proof.jpg" }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ url: null }) });
    });

    renderWithProviders(null);
    const deleteBtn = await screen.findByTitle("Remove document");
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("removed"));
    });
  });

  it("shows error toast when delete request fails", async () => {
    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      const method = (opts?.method ?? "GET").toUpperCase();
      if (method === "DELETE") {
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
      }
      if (url === "/api/v1/residents/me") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      }
      if (url.includes("id-proof") && method === "GET") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ url: "https://example.com/id-proof.jpg" }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ url: null }) });
    });

    renderWithProviders(null);
    const deleteBtn = await screen.findByTitle("Remove document");
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Failed to remove"));
    });
  });

  it("shows Delete button as disabled while deleting is in progress", async () => {
    let resolveDelete!: (v: unknown) => void;
    const deletePending = new Promise((resolve) => {
      resolveDelete = resolve;
    });

    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      const method = (opts?.method ?? "GET").toUpperCase();
      if (method === "DELETE") return deletePending;
      if (url === "/api/v1/residents/me") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      }
      if (url.includes("id-proof") && method === "GET") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ url: "https://example.com/id-proof.jpg" }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ url: null }) });
    });

    renderWithProviders(null);
    const deleteBtn = await screen.findByTitle("Remove document");
    fireEvent.click(deleteBtn);

    // While deleting, button should be disabled
    await waitFor(() => expect(screen.getByTitle("Remove document")).toBeDisabled());

    resolveDelete({ ok: true, json: () => Promise.resolve({ success: true }) });
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });
});

// ---------------------------------------------------------------------------
// Photo — rendering
// ---------------------------------------------------------------------------

describe("Photo — rendering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders initials fallback when no photo URL exists", async () => {
    setupRoutedFetch(null, null, null);
    renderWithProviders(null);
    await waitFor(() => screen.getByText("Hemant Bhagat"));
    // Initials "HB" should be rendered
    expect(screen.getByText("HB")).toBeInTheDocument();
  });

  it("renders photo image when photo URL exists", async () => {
    setupRoutedFetch(null, null, "https://example.com/photo.jpg");
    renderWithProviders(null);
    await waitFor(() => screen.getByText("Hemant Bhagat"));
    const img = await screen.findByAltText("Hemant Bhagat");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src");
  });

  it("shows 'Upload Photo' link when no photo exists", async () => {
    setupRoutedFetch(null, null, null);
    renderWithProviders(null);
    await waitFor(() => screen.getByText("Hemant Bhagat"));
    expect(screen.getByText("Upload Photo")).toBeInTheDocument();
  });

  it("shows 'Change Photo' and 'Remove' links when photo exists", async () => {
    setupRoutedFetch(null, null, "https://example.com/photo.jpg");
    renderWithProviders(null);
    await waitFor(() => screen.getByText("Hemant Bhagat"));
    await waitFor(() => {
      expect(screen.getByText("Change Photo")).toBeInTheDocument();
      expect(screen.getByText("Remove")).toBeInTheDocument();
    });
  });

  it("camera badge button has 'Change photo' aria-label", async () => {
    setupRoutedFetch(null, null, null);
    renderWithProviders(null);
    await waitFor(() => screen.getByText("Hemant Bhagat"));
    expect(screen.getByLabelText("Change photo")).toBeInTheDocument();
  });

  it("camera badge button click triggers photo file input", async () => {
    setupRoutedFetch(null, null, null);
    renderWithProviders(null);
    await waitFor(() => screen.getByText("Hemant Bhagat"));

    const photoInput = screen.getByTestId("photo-input") as HTMLInputElement;
    const clickSpy = vi.spyOn(photoInput, "click").mockImplementation(() => {});

    const cameraBadge = screen.getByLabelText("Change photo");
    fireEvent.click(cameraBadge);
    expect(clickSpy).toHaveBeenCalled();
  });

  it("'Change Photo' link click triggers photo file input when photo exists", async () => {
    setupRoutedFetch(null, null, "https://example.com/photo.jpg");
    renderWithProviders(null);
    await waitFor(() => screen.getByText("Hemant Bhagat"));
    await waitFor(() => screen.getByText("Change Photo"));

    const photoInput = screen.getByTestId("photo-input") as HTMLInputElement;
    const clickSpy = vi.spyOn(photoInput, "click").mockImplementation(() => {});

    fireEvent.click(screen.getByText("Change Photo"));
    expect(clickSpy).toHaveBeenCalled();
  });

  it("does not show 'Upload Photo' link when photo exists", async () => {
    setupRoutedFetch(null, null, "https://example.com/photo.jpg");
    renderWithProviders(null);
    await waitFor(() => screen.getByText("Hemant Bhagat"));
    await waitFor(() => screen.getByText("Change Photo"));
    expect(screen.queryByText("Upload Photo")).not.toBeInTheDocument();
  });

  it("does not show 'Change Photo' or 'Remove' links when no photo exists", async () => {
    setupRoutedFetch(null, null, null);
    renderWithProviders(null);
    await waitFor(() => screen.getByText("Hemant Bhagat"));
    expect(screen.queryByText("Change Photo")).not.toBeInTheDocument();
    expect(screen.queryByText("Remove")).not.toBeInTheDocument();
  });

  it("'Upload Photo' link click triggers photo file input when no photo exists", async () => {
    setupRoutedFetch(null, null, null);
    renderWithProviders(null);
    await waitFor(() => screen.getByText("Hemant Bhagat"));

    const photoInput = screen.getByTestId("photo-input") as HTMLInputElement;
    const clickSpy = vi.spyOn(photoInput, "click").mockImplementation(() => {});

    fireEvent.click(screen.getByText("Upload Photo"));
    expect(clickSpy).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Photo — upload flow
// ---------------------------------------------------------------------------

describe("Photo — upload flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls POST to photo endpoint and shows success toast on upload", async () => {
    setupRoutedFetch(null, null, null);
    renderWithProviders(null);
    await waitFor(() => screen.getByText("Hemant Bhagat"));

    const photoInput = screen.getByTestId("photo-input") as HTMLInputElement;
    const file = new File(["img"], "avatar.jpg", { type: "image/jpeg" });
    fireEvent.change(photoInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Photo updated");
    });
    // Verify POST was called to the photo endpoint
    expect(mockFetch).toHaveBeenCalledWith(
      "/api/v1/residents/me/photo",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("shows error toast with server message when photo upload fails", async () => {
    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      const method = (opts?.method ?? "GET").toUpperCase();
      if (url === "/api/v1/residents/me/photo" && method === "POST") {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: { message: "Image too large" } }),
        });
      }
      if (url === "/api/v1/residents/me" && method === "GET") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ url: null }) });
    });

    renderWithProviders(null);
    await waitFor(() => screen.getByText("Hemant Bhagat"));

    const photoInput = screen.getByTestId("photo-input") as HTMLInputElement;
    const file = new File(["img"], "avatar.jpg", { type: "image/jpeg" });
    fireEvent.change(photoInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Image too large");
    });
  });

  it("shows fallback error when photo upload fails without server message", async () => {
    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      const method = (opts?.method ?? "GET").toUpperCase();
      if (url === "/api/v1/residents/me/photo" && method === "POST") {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({}),
        });
      }
      if (url === "/api/v1/residents/me" && method === "GET") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ url: null }) });
    });

    renderWithProviders(null);
    await waitFor(() => screen.getByText("Hemant Bhagat"));

    const photoInput = screen.getByTestId("photo-input") as HTMLInputElement;
    const file = new File(["img"], "avatar.jpg", { type: "image/jpeg" });
    fireEvent.change(photoInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Upload failed");
    });
  });

  it("does nothing when photo file input change fires with no files", async () => {
    setupRoutedFetch(null, null, null);
    renderWithProviders(null);
    await waitFor(() => screen.getByText("Hemant Bhagat"));

    const photoInput = screen.getByTestId("photo-input") as HTMLInputElement;
    fireEvent.change(photoInput, { target: { files: [] } });

    // No upload should be triggered — no success or error toast
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("shows 'Uploading…' text on Upload Photo link while upload is in progress", async () => {
    let resolvePost!: (v: unknown) => void;
    const postPending = new Promise((resolve) => {
      resolvePost = resolve;
    });

    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      const method = (opts?.method ?? "GET").toUpperCase();
      if (url === "/api/v1/residents/me/photo" && method === "POST") return postPending;
      if (url === "/api/v1/residents/me" && method === "GET") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ url: null }) });
    });

    renderWithProviders(null);
    await waitFor(() => screen.getByText("Hemant Bhagat"));

    const photoInput = screen.getByTestId("photo-input") as HTMLInputElement;
    const file = new File(["img"], "avatar.jpg", { type: "image/jpeg" });
    fireEvent.change(photoInput, { target: { files: [file] } });

    // The Upload Photo text should change to "Uploading…"
    await waitFor(() => expect(screen.getByText("Uploading…")).toBeInTheDocument());

    resolvePost({ ok: true, json: () => Promise.resolve({}) });
    await waitFor(() => expect(toast.success).toHaveBeenCalled());
  });
});

// ---------------------------------------------------------------------------
// Photo — delete flow
// ---------------------------------------------------------------------------

describe("Photo — delete flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls DELETE to photo endpoint and shows success toast", async () => {
    setupRoutedFetch(null, null, "https://example.com/photo.jpg");
    renderWithProviders(null);
    await waitFor(() => screen.getByText("Hemant Bhagat"));

    const removeBtn = await screen.findByText("Remove");
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Photo removed");
    });
    expect(mockFetch).toHaveBeenCalledWith("/api/v1/residents/me/photo", { method: "DELETE" });
  });

  it("shows error toast when photo delete fails", async () => {
    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      const method = (opts?.method ?? "GET").toUpperCase();
      if (url === "/api/v1/residents/me/photo" && method === "DELETE") {
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
      }
      if (url === "/api/v1/residents/me" && method === "GET") {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(profileData) });
      }
      if (url === "/api/v1/residents/me/photo" && method === "GET") {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ url: "https://example.com/photo.jpg" }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ url: null }) });
    });

    renderWithProviders(null);
    await waitFor(() => screen.getByText("Hemant Bhagat"));

    const removeBtn = await screen.findByText("Remove");
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to remove photo");
    });
  });
});

// ---------------------------------------------------------------------------
// Family link card
// ---------------------------------------------------------------------------

describe("Family link card", () => {
  it("renders a link to /r/profile/family", async () => {
    setupRoutedFetch();
    renderWithProviders(null);
    await waitFor(() => screen.getByText("Hemant Bhagat"));
    const link = screen.getByRole("link", { name: /manage family members/i });
    expect(link).toHaveAttribute("href", "/r/profile/family");
    expect(screen.getByText("Family Members")).toBeInTheDocument();
  });
});
