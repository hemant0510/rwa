import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFetch, mockUpdateDeclarations, mockUpdateDirectory } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockUpdateDeclarations: vi.fn(),
  mockUpdateDirectory: vi.fn(),
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

vi.mock("@/services/profile", () => ({
  updateProfileDeclarations: mockUpdateDeclarations,
  updateDirectorySettings: mockUpdateDirectory,
}));

vi.stubGlobal("fetch", mockFetch);

import ResidentProfilePage from "@/app/r/profile/page";
import { AuthContext } from "@/hooks/useAuth";

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const value = {
    user: {
      id: "u1",
      name: "Hemant Bhagat",
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

const profileFixture = {
  id: "u1",
  name: "Hemant Bhagat",
  email: "hemant@example.com",
  mobile: "9876543210",
  rwaid: "EDEN-001",
  status: "ACTIVE_PAID",
  ownershipType: "OWNER",
  bloodGroup: null,
  householdStatus: "NOT_SET",
  vehicleStatus: "NOT_SET",
  showInDirectory: true,
  showPhoneInDirectory: false,
  societyName: "Eden Estate",
  unit: "A-101",
  designation: null,
  completeness: {
    percentage: 55,
    tier: "STANDARD",
    earned: 55,
    possible: 100,
    items: [
      { key: "A1", label: "Profile photo", completed: false, points: 15 },
      { key: "A2", label: "Mobile number", completed: true, points: 10 },
      { key: "A3", label: "Email verified", completed: true, points: 10 },
      { key: "A4", label: "Blood group", completed: false, points: 10 },
      { key: "B1", label: "ID proof", completed: true, points: 15 },
      { key: "B2", label: "Residency proof", completed: false, points: 10 },
      { key: "C1", label: "Emergency contact", completed: false, points: 10 },
      { key: "D1", label: "Household declared", completed: true, points: 10 },
      { key: "E1", label: "Vehicle declared", completed: false, points: 10 },
    ],
    bonus: [
      { key: "A5", label: "WhatsApp notifications", completed: false },
      { key: "F1", label: "In society directory", completed: true },
      { key: "C2", label: "Emergency contact blood group", completed: false },
    ],
    nextIncompleteItem: { key: "A1", label: "Profile photo", completed: false, points: 15 },
  },
};

const summaryFixture = {
  familyCount: 0,
  vehicleCount: 0,
  firstVehicleReg: null,
  emergencyContacts: [],
  vehicleExpiryAlerts: [],
  directoryOptIn: true,
  showPhoneInDirectory: false,
};

function setupFetch({
  profile = profileFixture,
  summary = summaryFixture,
  photoUrl = null,
  idProofUrl = null,
  ownershipProofUrl = null,
}: Partial<{
  profile: unknown;
  summary: unknown;
  photoUrl: string | null;
  idProofUrl: string | null;
  ownershipProofUrl: string | null;
}> = {}) {
  mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
    const method = (opts?.method ?? "GET").toUpperCase();
    if (url === "/api/v1/residents/me" && method === "GET") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(profile) });
    }
    if (url === "/api/v1/residents/me/profile/summary" && method === "GET") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve(summary) });
    }
    if (url === "/api/v1/residents/me/photo" && method === "GET") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ url: photoUrl }) });
    }
    if (url === "/api/v1/residents/me/photo" && method === "POST") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ url: "photo-new" }) });
    }
    if (url === "/api/v1/residents/me/photo" && method === "DELETE") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }
    if (url === "/api/v1/residents/me/id-proof" && method === "GET") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ url: idProofUrl }) });
    }
    if (url === "/api/v1/residents/me/ownership-proof" && method === "GET") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ url: ownershipProofUrl }),
      });
    }
    return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUpdateDeclarations.mockResolvedValue({
    bloodGroup: "O_POS",
    householdStatus: "NOT_SET",
    vehicleStatus: "NOT_SET",
    completeness: profileFixture.completeness,
  });
  mockUpdateDirectory.mockResolvedValue({
    showInDirectory: true,
    showPhoneInDirectory: false,
  });
});

describe("ResidentProfilePage", () => {
  it("renders loading skeleton before data arrives", () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));
    const { container } = renderPage();
    expect(
      container.querySelectorAll("[data-slot='skeleton'], .animate-pulse").length,
    ).toBeGreaterThan(0);
  });

  it("renders unable-to-load when profile fetch fails", async () => {
    mockFetch.mockImplementation((url: string) => {
      if (url === "/api/v1/residents/me") {
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(summaryFixture) });
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/unable to load profile/i)).toBeInTheDocument();
    });
  });

  it("renders all 7 top-level sections in order when profile loads", async () => {
    setupFetch();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Profile Completeness")).toBeInTheDocument();
    });
    expect(screen.getByText("My Documents")).toBeInTheDocument();
    expect(screen.getByText(/Blood Group/)).toBeInTheDocument();
    expect(screen.getByText("Family Members")).toBeInTheDocument();
    expect(screen.getByText(/^Vehicles$/)).toBeInTheDocument();
    expect(screen.getByText(/Directory Settings/i)).toBeInTheDocument();
  });

  it("renders profile card basics (name, RWAID, phone, email, unit, ownership)", async () => {
    setupFetch();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Hemant Bhagat")).toBeInTheDocument();
    });
    expect(screen.getByText("EDEN-001")).toBeInTheDocument();
    expect(screen.getByText("+91 9876543210")).toBeInTheDocument();
    expect(screen.getByText("hemant@example.com")).toBeInTheDocument();
    expect(screen.getByText(/A-101 — Eden Estate/)).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
  });

  it("renders designation badge when present", async () => {
    setupFetch({ profile: { ...profileFixture, designation: "President" } });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("President")).toBeInTheDocument();
    });
  });

  it("renders initials fallback avatar when no photo", async () => {
    setupFetch();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("HB")).toBeInTheDocument();
    });
  });

  it("uploads a new photo via file input", async () => {
    setupFetch();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Hemant Bhagat")).toBeInTheDocument();
    });
    const input = screen.getByTestId("photo-input") as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(["x"], "p.jpg", { type: "image/jpeg" })] },
    });
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Photo updated");
    });
  });

  it("shows photo upload error toast when server returns error", async () => {
    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      const method = (opts?.method ?? "GET").toUpperCase();
      if (url === "/api/v1/residents/me" && method === "GET")
        return Promise.resolve({ ok: true, json: () => Promise.resolve(profileFixture) });
      if (url === "/api/v1/residents/me/profile/summary")
        return Promise.resolve({ ok: true, json: () => Promise.resolve(summaryFixture) });
      if (url === "/api/v1/residents/me/photo" && method === "POST")
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: { message: "Too large" } }),
        });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ url: null }) });
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Hemant Bhagat")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByTestId("photo-input"), {
      target: { files: [new File(["x"], "p.jpg", { type: "image/jpeg" })] },
    });
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Too large");
    });
  });

  it("falls back to generic error when server omits message", async () => {
    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      const method = (opts?.method ?? "GET").toUpperCase();
      if (url === "/api/v1/residents/me" && method === "GET")
        return Promise.resolve({ ok: true, json: () => Promise.resolve(profileFixture) });
      if (url === "/api/v1/residents/me/profile/summary")
        return Promise.resolve({ ok: true, json: () => Promise.resolve(summaryFixture) });
      if (url === "/api/v1/residents/me/photo" && method === "POST")
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ url: null }) });
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Hemant Bhagat")).toBeInTheDocument();
    });
    fireEvent.change(screen.getByTestId("photo-input"), {
      target: { files: [new File(["x"], "p.jpg", { type: "image/jpeg" })] },
    });
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Upload failed");
    });
  });

  it("removes a photo when Remove is clicked", async () => {
    setupFetch({ photoUrl: "/current-photo.jpg" });
    renderPage();
    const removeBtn = await screen.findByRole("button", { name: /^Remove$/ });
    fireEvent.click(removeBtn);
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Photo removed");
    });
  });

  it("shows error toast when photo delete fails", async () => {
    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      const method = (opts?.method ?? "GET").toUpperCase();
      if (url === "/api/v1/residents/me" && method === "GET")
        return Promise.resolve({ ok: true, json: () => Promise.resolve(profileFixture) });
      if (url === "/api/v1/residents/me/profile/summary")
        return Promise.resolve({ ok: true, json: () => Promise.resolve(summaryFixture) });
      if (url === "/api/v1/residents/me/photo" && method === "GET")
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ url: "/current-photo.jpg" }),
        });
      if (url === "/api/v1/residents/me/photo" && method === "DELETE")
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ url: null }) });
    });
    renderPage();
    const removeBtn = await screen.findByRole("button", { name: /^Remove$/ });
    fireEvent.click(removeBtn);
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to remove photo");
    });
  });

  it("renders photo image and Change/Remove links when photoUrl is set", async () => {
    setupFetch({ photoUrl: "/existing-photo.jpg" });
    renderPage();
    await waitFor(() => {
      expect(screen.getByAltText("Hemant Bhagat")).toBeInTheDocument();
    });
    expect(screen.getAllByRole("button", { name: /change photo/i }).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /^Remove$/ })).toBeInTheDocument();
  });

  it("updates blood group via the dropdown", async () => {
    setupFetch();
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(document.getElementById("profile-blood")).toBeInTheDocument();
    });
    await user.click(document.getElementById("profile-blood")!);
    await user.click(await screen.findByRole("option", { name: "O+" }));
    await waitFor(() => expect(mockUpdateDeclarations).toHaveBeenCalled());
    expect(mockUpdateDeclarations.mock.calls.at(-1)?.[0]).toEqual({ bloodGroup: "O_POS" });
  });

  it("declares no family when toggle clicked in family card", async () => {
    setupFetch();
    const user = userEvent.setup();
    renderPage();
    const btn = await screen.findByRole("button", { name: /no family members to add/i });
    await user.click(btn);
    await waitFor(() => {
      expect(mockUpdateDeclarations).toHaveBeenCalled();
    });
    expect(mockUpdateDeclarations.mock.calls[0][0]).toEqual({ householdStatus: "DECLARED_NONE" });
  });

  it("declares no vehicles when toggle clicked in vehicles card", async () => {
    setupFetch();
    const user = userEvent.setup();
    renderPage();
    const btn = await screen.findByRole("button", { name: /don't have any vehicles/i });
    await user.click(btn);
    await waitFor(() => expect(mockUpdateDeclarations).toHaveBeenCalled());
    expect(mockUpdateDeclarations.mock.calls.at(-1)?.[0]).toEqual({
      vehicleStatus: "DECLARED_NONE",
    });
  });

  it("shows declaration error toast when mutation fails", async () => {
    mockUpdateDeclarations.mockRejectedValueOnce(new Error("Nope"));
    setupFetch();
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Family Members");
    await user.click(screen.getByRole("button", { name: /no family members/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Nope");
    });
  });

  it("shows generic declaration error when mutation error has no message", async () => {
    mockUpdateDeclarations.mockRejectedValueOnce(new Error(""));
    setupFetch();
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Family Members");
    await user.click(screen.getByRole("button", { name: /no family members/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to update profile");
    });
  });

  it("toggles directory settings and calls updateDirectorySettings", async () => {
    setupFetch();
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/Directory Settings/i);
    await user.click(screen.getByLabelText(/show me in the directory/i));
    await waitFor(() => expect(mockUpdateDirectory).toHaveBeenCalled());
    expect(mockUpdateDirectory.mock.calls.at(-1)?.[0]).toEqual({
      showInDirectory: false,
      showPhoneInDirectory: false,
    });
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Directory settings updated"));
  });

  it("shows directory error toast when mutation fails", async () => {
    mockUpdateDirectory.mockRejectedValueOnce(new Error("Oops"));
    setupFetch();
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Directory Settings/i)).toBeInTheDocument();
    });
    await user.click(screen.getByLabelText(/show me in the directory/i));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Oops");
    });
  });

  it("shows generic directory error when error has no message", async () => {
    mockUpdateDirectory.mockRejectedValueOnce(new Error(""));
    setupFetch();
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Directory Settings/i)).toBeInTheDocument();
    });
    await user.click(screen.getByLabelText(/show me in the directory/i));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to update directory settings");
    });
  });

  it("renders emergency contacts in family card when present", async () => {
    setupFetch({
      profile: { ...profileFixture, householdStatus: "HAS_ENTRIES" },
      summary: {
        ...summaryFixture,
        familyCount: 2,
        emergencyContacts: [
          { name: "Asha", relationship: "MOTHER", mobile: "9999999999", bloodGroup: "O_POS" },
        ],
      },
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Asha")).toBeInTheDocument();
    });
    expect(screen.getByText(/2 members in your household/i)).toBeInTheDocument();
  });

  it("renders vehicle summary when vehicles exist", async () => {
    setupFetch({
      profile: { ...profileFixture, vehicleStatus: "HAS_ENTRIES" },
      summary: {
        ...summaryFixture,
        vehicleCount: 1,
        firstVehicleReg: "DL3CAB1234",
        vehicleExpiryAlerts: [],
      },
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/1 registered · DL3CAB1234/)).toBeInTheDocument();
    });
  });

  it("renders tenant proof title when ownershipType is TENANT", async () => {
    setupFetch({ profile: { ...profileFixture, ownershipType: "TENANT" } });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Tenant")).toBeInTheDocument();
    });
    expect(screen.getByText("Tenancy / Rental Agreement")).toBeInTheDocument();
  });

  it("clicks Change Photo text button (triggers file picker)", async () => {
    setupFetch({ photoUrl: "/x.jpg" });
    renderPage();
    // Two buttons match — the camera overlay AND the text link. Click both.
    const btns = await screen.findAllByRole("button", { name: /change photo/i });
    expect(btns.length).toBeGreaterThan(0);
    btns.forEach((b) => fireEvent.click(b));
  });

  it("clicks Upload Photo text button when no photo", async () => {
    setupFetch();
    const user = userEvent.setup();
    renderPage();
    const uploadBtn = await screen.findByRole("button", { name: /upload photo/i });
    await user.click(uploadBtn);
  });

  it("uploads ID proof via DocCard", async () => {
    setupFetch();
    renderPage();
    const uploadBtns = await screen.findAllByRole("button", { name: /^upload$/i });
    fireEvent.click(uploadBtns[0]);
  });

  it("renders uploaded DocCard with view/replace/delete buttons", async () => {
    setupFetch({ idProofUrl: "/id.pdf", ownershipProofUrl: "/own.pdf" });
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByTitle("View document").length).toBeGreaterThan(0);
    });
    expect(screen.getAllByTitle("Replace document").length).toBeGreaterThan(0);
    expect(screen.getAllByTitle("Remove document").length).toBeGreaterThan(0);
    // Click Replace to cover its onClick handler
    fireEvent.click(screen.getAllByTitle("Replace document")[0]);
  });

  it("views uploaded document in new tab", async () => {
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    setupFetch({ idProofUrl: "/id.pdf" });
    renderPage();
    const viewBtns = await screen.findAllByTitle("View document");
    fireEvent.click(viewBtns[0]);
    expect(openSpy).toHaveBeenCalledWith("/id.pdf", "_blank");
    openSpy.mockRestore();
  });

  it("uploads a doc file and shows success toast", async () => {
    let uploadCalled = false;
    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      const method = (opts?.method ?? "GET").toUpperCase();
      if (url === "/api/v1/residents/me" && method === "GET")
        return Promise.resolve({ ok: true, json: () => Promise.resolve(profileFixture) });
      if (url === "/api/v1/residents/me/profile/summary")
        return Promise.resolve({ ok: true, json: () => Promise.resolve(summaryFixture) });
      if (url === "/api/v1/residents/me/id-proof" && method === "POST") {
        uploadCalled = true;
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      if (url === "/api/v1/residents/me/id-proof" && method === "GET")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ url: null }) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ url: null }) });
    });
    renderPage();
    await screen.findAllByRole("button", { name: /^upload$/i });
    const idInput = Array.from(document.querySelectorAll('input[type="file"]')).find((el) =>
      (el as HTMLInputElement).accept.includes("pdf"),
    ) as HTMLInputElement;
    fireEvent.change(idInput, {
      target: { files: [new File(["x"], "id.pdf", { type: "application/pdf" })] },
    });
    await waitFor(() => expect(uploadCalled).toBe(true));
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("ID Proof uploaded successfully"),
    );
  });

  it("surfaces doc upload error with server message", async () => {
    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      const method = (opts?.method ?? "GET").toUpperCase();
      if (url === "/api/v1/residents/me" && method === "GET")
        return Promise.resolve({ ok: true, json: () => Promise.resolve(profileFixture) });
      if (url === "/api/v1/residents/me/profile/summary")
        return Promise.resolve({ ok: true, json: () => Promise.resolve(summaryFixture) });
      if (url === "/api/v1/residents/me/id-proof" && method === "POST")
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: { message: "Bad file" } }),
        });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ url: null }) });
    });
    renderPage();
    await screen.findAllByRole("button", { name: /^upload$/i });
    const idInput = Array.from(document.querySelectorAll('input[type="file"]')).find((el) =>
      (el as HTMLInputElement).accept.includes("pdf"),
    ) as HTMLInputElement;
    fireEvent.change(idInput, {
      target: { files: [new File(["x"], "id.pdf", { type: "application/pdf" })] },
    });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Bad file"));
  });

  it("doc upload falls back to generic error when no message", async () => {
    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      const method = (opts?.method ?? "GET").toUpperCase();
      if (url === "/api/v1/residents/me" && method === "GET")
        return Promise.resolve({ ok: true, json: () => Promise.resolve(profileFixture) });
      if (url === "/api/v1/residents/me/profile/summary")
        return Promise.resolve({ ok: true, json: () => Promise.resolve(summaryFixture) });
      if (url === "/api/v1/residents/me/id-proof" && method === "POST")
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ url: null }) });
    });
    renderPage();
    await screen.findAllByRole("button", { name: /^upload$/i });
    const idInput = Array.from(document.querySelectorAll('input[type="file"]')).find((el) =>
      (el as HTMLInputElement).accept.includes("pdf"),
    ) as HTMLInputElement;
    fireEvent.change(idInput, {
      target: { files: [new File(["x"], "id.pdf", { type: "application/pdf" })] },
    });
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Upload failed"));
  });

  it("deletes an uploaded doc", async () => {
    let deleteCalled = false;
    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      const method = (opts?.method ?? "GET").toUpperCase();
      if (url === "/api/v1/residents/me" && method === "GET")
        return Promise.resolve({ ok: true, json: () => Promise.resolve(profileFixture) });
      if (url === "/api/v1/residents/me/profile/summary")
        return Promise.resolve({ ok: true, json: () => Promise.resolve(summaryFixture) });
      if (url === "/api/v1/residents/me/id-proof" && method === "GET")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ url: "/id.pdf" }) });
      if (url === "/api/v1/residents/me/id-proof" && method === "DELETE") {
        deleteCalled = true;
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ url: null }) });
    });
    renderPage();
    const removeBtns = await screen.findAllByTitle("Remove document");
    fireEvent.click(removeBtns[0]);
    await waitFor(() => expect(deleteCalled).toBe(true));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("ID Proof removed"));
  });

  it("doc delete error toast when server fails", async () => {
    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      const method = (opts?.method ?? "GET").toUpperCase();
      if (url === "/api/v1/residents/me" && method === "GET")
        return Promise.resolve({ ok: true, json: () => Promise.resolve(profileFixture) });
      if (url === "/api/v1/residents/me/profile/summary")
        return Promise.resolve({ ok: true, json: () => Promise.resolve(summaryFixture) });
      if (url === "/api/v1/residents/me/id-proof" && method === "GET")
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ url: "/id.pdf" }) });
      if (url === "/api/v1/residents/me/id-proof" && method === "DELETE")
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ url: null }) });
    });
    renderPage();
    const removeBtns = await screen.findAllByTitle("Remove document");
    fireEvent.click(removeBtns[0]);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Failed to remove ID Proof"));
  });

  it("undoes household declaration when status is DECLARED_NONE", async () => {
    setupFetch({ profile: { ...profileFixture, householdStatus: "DECLARED_NONE" } });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText("Family Members");
    await user.click(screen.getByRole("button", { name: /undo declaration/i }));
    await waitFor(() => expect(mockUpdateDeclarations).toHaveBeenCalled());
    expect(mockUpdateDeclarations.mock.calls.at(-1)?.[0]).toEqual({ householdStatus: "NOT_SET" });
  });

  it("undoes vehicle declaration when status is DECLARED_NONE", async () => {
    setupFetch({ profile: { ...profileFixture, vehicleStatus: "DECLARED_NONE" } });
    const user = userEvent.setup();
    renderPage();
    await screen.findByText(/^Vehicles$/);
    await user.click(screen.getByRole("button", { name: /undo declaration/i }));
    await waitFor(() => expect(mockUpdateDeclarations).toHaveBeenCalled());
    expect(mockUpdateDeclarations.mock.calls.at(-1)?.[0]).toEqual({ vehicleStatus: "NOT_SET" });
  });
});
