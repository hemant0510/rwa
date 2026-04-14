import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPush = vi.hoisted(() => vi.fn());
const mockCreateCounsellor = vi.hoisted(() => vi.fn());
const mockToastSuccess = vi.hoisted(() => vi.fn());
const mockToastError = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));
vi.mock("@/services/counsellors", () => ({
  createCounsellor: mockCreateCounsellor,
}));
vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CounsellorCreateForm } from "@/components/features/sa-counsellors/CounsellorCreateForm";

function renderForm() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CounsellorCreateForm />
    </QueryClientProvider>,
  );
}

function submitForm() {
  const button = screen.getByRole("button", { name: /Create Counsellor/ });
  const form = button.closest("form");
  if (!form) throw new Error("Form not found");
  fireEvent.submit(form);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CounsellorCreateForm", () => {
  it("renders all fields and submit button", () => {
    renderForm();
    expect(screen.getByText("Full name")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Mobile")).toBeInTheDocument();
    expect(screen.getByText("National ID (optional)")).toBeInTheDocument();
    expect(screen.getByText(/Bio \/ Qualifications/)).toBeInTheDocument();
    expect(screen.getByText("Public blurb")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create Counsellor/ })).toBeInTheDocument();
  });

  it("shows validation error when name is too short", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByPlaceholderText("counsellor@example.com"), "bad@email");
    submitForm();
    await waitFor(() => {
      expect(screen.getByText(/Name must be at least 2 characters/)).toBeInTheDocument();
    });
    expect(mockCreateCounsellor).not.toHaveBeenCalled();
  });

  it("shows validation error when email is invalid", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.type(screen.getByPlaceholderText("Asha Patel"), "Asha Patel");
    await user.type(screen.getByPlaceholderText("counsellor@example.com"), "not-an-email");
    submitForm();
    await waitFor(() => {
      expect(screen.getByText("Invalid email")).toBeInTheDocument();
    });
    expect(mockCreateCounsellor).not.toHaveBeenCalled();
  });

  it("calls createCounsellor with trimmed payload and shows success toast on success", async () => {
    mockCreateCounsellor.mockResolvedValue({ id: "c-1", name: "Asha", inviteSent: true });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByPlaceholderText("Asha Patel"), "  Asha Patel  ");
    await user.type(screen.getByPlaceholderText("counsellor@example.com"), "asha@eden.com");
    submitForm();

    await waitFor(() => {
      expect(mockCreateCounsellor).toHaveBeenCalled();
    });
    expect(mockCreateCounsellor.mock.calls[0][0]).toEqual(
      expect.objectContaining({ name: "Asha Patel", email: "asha@eden.com" }),
    );
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalled();
      expect(mockPush).toHaveBeenCalledWith("/sa/counsellors/c-1");
    });
  });

  it("shows informational success message when inviteSent is false", async () => {
    mockCreateCounsellor.mockResolvedValue({ id: "c-1", name: "Asha", inviteSent: false });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByPlaceholderText("Asha Patel"), "Asha Patel");
    await user.type(screen.getByPlaceholderText("counsellor@example.com"), "asha@eden.com");
    submitForm();

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(expect.stringContaining("Resend invite"));
    });
  });

  it("shows toast.error when mutation fails", async () => {
    mockCreateCounsellor.mockRejectedValue(new Error("duplicate email"));
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByPlaceholderText("Asha Patel"), "Asha Patel");
    await user.type(screen.getByPlaceholderText("counsellor@example.com"), "asha@eden.com");
    submitForm();

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("duplicate email");
    });
  });

  it("navigates to list on Cancel", async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole("button", { name: /Cancel/ }));
    expect(mockPush).toHaveBeenCalledWith("/sa/counsellors");
  });

  it("clears field error when the user edits the field", async () => {
    const user = userEvent.setup();
    renderForm();
    submitForm();
    await waitFor(() => {
      expect(screen.getByText(/Name must be at least 2 characters/)).toBeInTheDocument();
    });
    await user.type(screen.getByPlaceholderText("Asha Patel"), "Asha");
    expect(screen.queryByText(/Name must be at least 2 characters/)).not.toBeInTheDocument();
  });

  it("allows typing in mobile, nationalId, bio, and publicBlurb fields", async () => {
    mockCreateCounsellor.mockResolvedValue({ id: "c-1", name: "Asha", inviteSent: true });
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByPlaceholderText("Asha Patel"), "Asha Patel");
    await user.type(screen.getByPlaceholderText("counsellor@example.com"), "asha@eden.com");
    await user.type(screen.getByPlaceholderText("+91 9876543210"), "+91 9876543210");
    await user.type(screen.getByPlaceholderText("e.g. PAN, Aadhaar"), "AAAAA1111A");

    const textareas = screen.getAllByRole("textbox").filter((el) => el.tagName === "TEXTAREA");
    await user.type(textareas[0], "10 years ombudsperson experience");
    await user.type(textareas[1], "Neutral advisor");

    submitForm();

    await waitFor(() => {
      expect(mockCreateCounsellor).toHaveBeenCalled();
    });
    expect(mockCreateCounsellor.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        mobile: "+91 9876543210",
        nationalId: "AAAAA1111A",
        bio: "10 years ombudsperson experience",
        publicBlurb: "Neutral advisor",
      }),
    );
  });

  it("renders hints for bio and publicBlurb fields", () => {
    renderForm();
    expect(
      screen.getByText(/Longer description \u2014 visible only to SA and the counsellor/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Short public-facing description \u2014 up to 500 characters/),
    ).toBeInTheDocument();
  });
});
