import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetMe = vi.hoisted(() => vi.fn());
const mockUpdateMe = vi.hoisted(() => vi.fn());
const mockToastSuccess = vi.hoisted(() => vi.fn());
const mockToastError = vi.hoisted(() => vi.fn());

vi.mock("@/services/counsellor-self", () => ({
  getMe: mockGetMe,
  updateMe: mockUpdateMe,
}));
vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import CounsellorProfilePage from "@/app/counsellor/(authed)/profile/page";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CounsellorProfilePage />
    </QueryClientProvider>,
  );
}

const profile = {
  id: "c-1",
  authUserId: "auth-1",
  email: "asha@x.com",
  mobile: "+91 9876543210",
  name: "Asha Patel",
  nationalId: null,
  photoUrl: null,
  bio: "Experienced",
  publicBlurb: "Neutral advisor",
  isActive: true,
  mfaRequired: true,
  mfaEnrolledAt: new Date().toISOString(),
  lastLoginAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function submitForm() {
  const button = screen.getByRole("button", { name: /Save Changes/ });
  const form = button.closest("form");
  if (!form) throw new Error("No form");
  fireEvent.submit(form);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CounsellorProfilePage", () => {
  it("renders loading state", () => {
    mockGetMe.mockImplementation(() => new Promise(() => {}));
    const { container } = renderPage();
    expect(container.querySelector('[class*="animate-pulse"]')).toBeTruthy();
  });

  it("renders error banner on query failure", async () => {
    mockGetMe.mockRejectedValue(new Error("server"));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Failed to load profile/)).toBeInTheDocument();
    });
  });

  it("hydrates form fields from /me response", async () => {
    mockGetMe.mockResolvedValue(profile);
    renderPage();
    await waitFor(() => {
      expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Asha Patel");
    });
    expect((screen.getByLabelText("Mobile") as HTMLInputElement).value).toBe("+91 9876543210");
  });

  it("hydrates form with empty strings when fields are null", async () => {
    mockGetMe.mockResolvedValue({ ...profile, mobile: null, bio: null, publicBlurb: null });
    renderPage();
    await waitFor(() => {
      expect((screen.getByLabelText("Mobile") as HTMLInputElement).value).toBe("");
    });
  });

  it("shows validation toast when input is invalid (bad mobile)", async () => {
    mockGetMe.mockResolvedValue(profile);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByLabelText("Mobile")).toBeInTheDocument());
    await user.clear(screen.getByLabelText("Mobile"));
    await user.type(screen.getByLabelText("Mobile"), "abc");
    submitForm();
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });
    expect(mockUpdateMe).not.toHaveBeenCalled();
  });

  it("submits trimmed payload and shows success toast", async () => {
    mockGetMe.mockResolvedValue(profile);
    mockUpdateMe.mockResolvedValue({
      id: "c-1",
      name: "New Name",
      email: "asha@x.com",
      mobile: null,
      bio: null,
      publicBlurb: null,
      photoUrl: null,
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByLabelText("Name")).toBeInTheDocument());
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "  New Name  ");
    submitForm();
    await waitFor(() => {
      expect(mockUpdateMe).toHaveBeenCalled();
    });
    expect(mockUpdateMe.mock.calls[0][0]).toEqual(expect.objectContaining({ name: "New Name" }));
    await waitFor(() => expect(mockToastSuccess).toHaveBeenCalledWith("Profile updated"));
  });

  it("converts empty mobile/bio/publicBlurb to null", async () => {
    mockGetMe.mockResolvedValue(profile);
    mockUpdateMe.mockResolvedValue({
      id: "c-1",
      name: "Asha Patel",
      email: "asha@x.com",
      mobile: null,
      bio: null,
      publicBlurb: null,
      photoUrl: null,
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByLabelText("Mobile")).toBeInTheDocument());
    await user.clear(screen.getByLabelText("Mobile"));
    await user.clear(screen.getByLabelText(/Bio/));
    await user.clear(screen.getByLabelText(/Public blurb/));
    submitForm();
    await waitFor(() => expect(mockUpdateMe).toHaveBeenCalled());
    expect(mockUpdateMe.mock.calls[0][0]).toEqual(
      expect.objectContaining({ mobile: null, bio: null, publicBlurb: null }),
    );
  });

  it("shows toast.error when update fails", async () => {
    mockGetMe.mockResolvedValue(profile);
    mockUpdateMe.mockRejectedValue(new Error("conflict"));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByLabelText("Name")).toBeInTheDocument());
    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Updated");
    submitForm();
    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith("conflict"));
  });
});
