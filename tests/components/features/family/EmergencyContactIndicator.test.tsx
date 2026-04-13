import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EmergencyContactIndicator } from "@/components/features/family/EmergencyContactIndicator";

describe("EmergencyContactIndicator", () => {
  it("renders nothing when isEmergencyContact is false", () => {
    const { container } = render(<EmergencyContactIndicator isEmergencyContact={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders Primary label and red colour for priority 1", () => {
    render(<EmergencyContactIndicator isEmergencyContact priority={1} />);
    const badge = screen.getByLabelText(/primary priority/i);
    expect(badge).toHaveTextContent("Primary");
    expect(badge.className).toContain("red");
  });

  it("renders Secondary label and amber colour for priority 2", () => {
    render(<EmergencyContactIndicator isEmergencyContact priority={2} />);
    const badge = screen.getByLabelText(/secondary priority/i);
    expect(badge).toHaveTextContent("Secondary");
    expect(badge.className).toContain("amber");
  });

  it("renders fallback Emergency label when priority is null", () => {
    render(<EmergencyContactIndicator isEmergencyContact priority={null} />);
    const badge = screen.getByLabelText(/emergency priority/i);
    expect(badge).toHaveTextContent("Emergency");
  });

  it("merges className prop into the badge", () => {
    render(<EmergencyContactIndicator isEmergencyContact priority={1} className="extra-class" />);
    const badge = screen.getByLabelText(/primary priority/i);
    expect(badge.className).toContain("extra-class");
  });
});
