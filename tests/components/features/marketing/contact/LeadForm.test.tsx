import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockToast, mockFetch } = vi.hoisted(() => ({
  mockToast: { success: vi.fn(), error: vi.fn() },
  mockFetch: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: mockToast,
}));

global.fetch = mockFetch as unknown as typeof fetch;

import { LeadForm } from "@/components/features/marketing/contact/LeadForm";

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^name/i), "Arjun Kapoor");
  await user.type(screen.getByLabelText(/^email/i), "arjun@example.com");
  await user.type(screen.getByLabelText(/^phone/i), "9876543210");
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ ok: true }) });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("LeadForm — rendering", () => {
  it("renders the required asterisks on name, email, and phone", () => {
    const { container } = render(<LeadForm />);
    const nameLabel = screen.getByText("Name").closest("label");
    const emailLabel = screen.getByText("Email").closest("label");
    const phoneLabel = screen.getByText("Phone").closest("label");
    expect(nameLabel?.textContent).toContain("*");
    expect(emailLabel?.textContent).toContain("*");
    expect(phoneLabel?.textContent).toContain("*");
    expect(container.querySelectorAll("label span.text-destructive").length).toBeGreaterThanOrEqual(
      3,
    );
  });

  it("renders optional fields without asterisks", () => {
    render(<LeadForm />);
    expect(screen.getByLabelText(/society name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/number of units/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/how can we help/i)).toBeInTheDocument();
  });
});

describe("LeadForm — validation", () => {
  it("blocks submit and surfaces errors when required fields are empty", async () => {
    const user = userEvent.setup();
    render(<LeadForm />);
    await user.click(screen.getByRole("button", { name: /send message/i }));
    await waitFor(() => {
      expect(screen.getByText("Name is required")).toBeInTheDocument();
    });
    expect(screen.getByText("Phone is required")).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("shows the phone validation error when an invalid phone is entered", async () => {
    const user = userEvent.setup();
    render(<LeadForm />);
    await user.type(screen.getByLabelText(/^name/i), "Arjun");
    await user.type(screen.getByLabelText(/^email/i), "arjun@example.com");
    await user.type(screen.getByLabelText(/^phone/i), "abc");
    await user.click(screen.getByRole("button", { name: /send message/i }));
    await waitFor(() => {
      expect(screen.getByText("Valid phone required")).toBeInTheDocument();
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("does not call the API when only name is filled", async () => {
    const user = userEvent.setup();
    render(<LeadForm />);
    await user.type(screen.getByLabelText(/^name/i), "Arjun");
    await user.click(screen.getByRole("button", { name: /send message/i }));
    await waitFor(() => {
      expect(screen.getByText("Phone is required")).toBeInTheDocument();
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("shows the unit count error when non-numeric", async () => {
    const user = userEvent.setup();
    render(<LeadForm />);
    await fillRequired(user);
    await user.type(screen.getByLabelText(/number of units/i), "abc");
    await user.click(screen.getByRole("button", { name: /send message/i }));
    await waitFor(() => {
      expect(screen.getByText("Numbers only")).toBeInTheDocument();
    });
  });

  it("shows the society name error when it exceeds 200 characters", async () => {
    const user = userEvent.setup();
    render(<LeadForm />);
    await fillRequired(user);
    fireEvent.change(screen.getByLabelText(/society name/i), {
      target: { value: "x".repeat(201) },
    });
    await user.click(screen.getByRole("button", { name: /send message/i }));
    await waitFor(() => {
      expect(screen.getByText(/Too big/i)).toBeInTheDocument();
    });
  });
});

describe("LeadForm — submission", () => {
  it("posts to /api/v1/public/leads and shows success state on 2xx", async () => {
    const user = userEvent.setup();
    render(<LeadForm />);
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: /send message/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/public/leads",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(mockToast.success).toHaveBeenCalledWith("Thanks! We'll be in touch within 24 hours.");
    await waitFor(() => {
      expect(screen.getByText("Message received")).toBeInTheDocument();
    });
  });

  it("returns to the form when 'Send another' is clicked from the success state", async () => {
    const user = userEvent.setup();
    render(<LeadForm />);
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: /send message/i }));
    await waitFor(() => {
      expect(screen.getByText("Message received")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /send another/i }));
    expect(screen.getByLabelText(/^name/i)).toBeInTheDocument();
  });

  it("shows an error toast when the API returns non-OK", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}) });
    const user = userEvent.setup();
    render(<LeadForm />);
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: /send message/i }));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        "Could not submit — please try again or email us directly.",
      );
    });
    expect(screen.queryByText("Message received")).not.toBeInTheDocument();
  });

  it("shows a network error toast when fetch rejects", async () => {
    mockFetch.mockRejectedValueOnce(new Error("offline"));
    const user = userEvent.setup();
    render(<LeadForm />);
    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: /send message/i }));
    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith(
        "Network error — please try again or email us directly.",
      );
    });
  });
});
