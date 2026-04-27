import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/features/marketing/contact/LeadForm", () => ({
  LeadForm: () => <div data-testid="lead-form" />,
}));

import ContactPage, { metadata } from "@/app/(marketing)/contact/page";

describe("Contact page", () => {
  it("exports the expected metadata", () => {
    expect(metadata.title).toBe("Contact — RWA Connect");
    expect(metadata.description).toMatch(/respond within 24 hours/i);
  });

  it("renders the hero copy", () => {
    render(<ContactPage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Talk to us. We respond fast.",
    );
    expect(screen.getByText(/Demo, pricing question/)).toBeInTheDocument();
  });

  it("renders the WhatsApp channel card with correct href", () => {
    render(<ContactPage />);
    const wa = screen.getByRole("link", { name: /whatsapp/i });
    expect(wa).toHaveAttribute("href", "https://wa.me/911234567890");
    expect(wa).toHaveAttribute("target", "_blank");
    expect(wa).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("renders the email channel pointing at rwaconnect360@gmail.com (not hello@rwaconnect.in)", () => {
    render(<ContactPage />);
    const email = screen.getByRole("link", { name: /email/i });
    expect(email).toHaveAttribute("href", "mailto:rwaconnect360@gmail.com");
    expect(screen.getByText("rwaconnect360@gmail.com")).toBeInTheDocument();
    expect(screen.queryByText("hello@rwaconnect.in")).not.toBeInTheDocument();
  });

  it("renders the phone channel with tel: href and no target attribute", () => {
    render(<ContactPage />);
    const phone = screen.getByRole("link", { name: /^phone/i });
    expect(phone).toHaveAttribute("href", "tel:+911234567890");
    expect(phone).not.toHaveAttribute("target");
  });

  it("renders the LeadForm inside the message section", () => {
    render(<ContactPage />);
    expect(screen.getByText("Send us a message")).toBeInTheDocument();
    expect(screen.getByTestId("lead-form")).toBeInTheDocument();
  });
});
