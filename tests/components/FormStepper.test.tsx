import React from "react";

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { FormStepper } from "@/components/features/FormStepper";

const steps = [
  { number: 1, title: "Society Info", status: "completed" as const },
  { number: 2, title: "Plan Selection", status: "active" as const },
  { number: 3, title: "Fee Config", status: "pending" as const },
];

describe("FormStepper", () => {
  it("renders all step titles", () => {
    render(<FormStepper steps={steps} />);
    expect(screen.getByText("Society Info")).toBeInTheDocument();
    expect(screen.getByText("Plan Selection")).toBeInTheDocument();
    expect(screen.getByText("Fee Config")).toBeInTheDocument();
  });

  it("shows step numbers for non-completed steps", () => {
    render(<FormStepper steps={steps} />);
    // Step 2 (active) and step 3 (pending) show their numbers
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("shows checkmark icon for completed step instead of number", () => {
    const { container } = render(<FormStepper steps={steps} />);
    // Step 1 is completed — should have a check icon (svg), not "1" as text
    expect(screen.queryByText("1")).toBeNull();
    // Check that an svg (lucide Check icon) is present in the document
    const svgEl = container.querySelector("svg.lucide-check");
    expect(svgEl).not.toBeNull();
  });

  it("applies completed styling to completed step", () => {
    const { container } = render(<FormStepper steps={steps} />);
    // First step (completed) should have border-primary bg-primary class
    const stepCircles = container.querySelectorAll("[class*='rounded-full']");
    const firstCircle = stepCircles[0];
    expect(firstCircle.className).toContain("bg-primary");
  });

  it("applies active styling to active step", () => {
    const { container } = render(<FormStepper steps={steps} />);
    const stepCircles = container.querySelectorAll("[class*='rounded-full']");
    const secondCircle = stepCircles[1];
    expect(secondCircle.className).toContain("text-primary");
  });

  it("applies pending styling to pending step", () => {
    const { container } = render(<FormStepper steps={steps} />);
    const stepCircles = container.querySelectorAll("[class*='rounded-full']");
    const thirdCircle = stepCircles[2];
    expect(thirdCircle.className).toContain("text-muted-foreground");
  });

  it("renders connectors between steps (not after last step)", () => {
    const { container } = render(<FormStepper steps={steps} />);
    // There should be n-1 connector divs (one between each pair of steps)
    const connectors = container.querySelectorAll("[class*='h-0.5']");
    expect(connectors.length).toBe(steps.length - 1);
  });

  it("applies completed connector styling for completed steps", () => {
    const { container } = render(<FormStepper steps={steps} />);
    const connectors = container.querySelectorAll("[class*='h-0.5']");
    // First connector (after completed step) should have bg-primary
    expect(connectors[0].className).toContain("bg-primary");
  });

  it("applies pending connector styling for non-completed steps", () => {
    const { container } = render(<FormStepper steps={steps} />);
    const connectors = container.querySelectorAll("[class*='h-0.5']");
    // Second connector (after active step) should not have bg-primary
    expect(connectors[1].className).not.toContain("bg-primary");
    expect(connectors[1].className).toContain("bg-muted");
  });

  it("renders single step with no connector", () => {
    const { container } = render(
      <FormStepper steps={[{ number: 1, title: "Only Step", status: "active" }]} />,
    );
    const connectors = container.querySelectorAll("[class*='h-0.5']");
    expect(connectors.length).toBe(0);
    expect(screen.getByText("Only Step")).toBeInTheDocument();
  });

  it("title has active font styling for active step", () => {
    const { container } = render(<FormStepper steps={steps} />);
    // Active step title: "text-primary font-medium"
    const titles = container.querySelectorAll("[class*='mt-1']");
    expect(titles[1].className).toContain("text-primary");
    expect(titles[1].className).toContain("font-medium");
  });

  it("title has muted styling for non-active step", () => {
    const { container } = render(<FormStepper steps={steps} />);
    const titles = container.querySelectorAll("[class*='mt-1']");
    // Pending step (index 2) should have text-muted-foreground
    expect(titles[2].className).toContain("text-muted-foreground");
  });
});
