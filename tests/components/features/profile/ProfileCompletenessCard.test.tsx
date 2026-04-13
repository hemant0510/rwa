import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ProfileCompletenessCard } from "@/components/features/profile/ProfileCompletenessCard";
import type { CompletenessResult } from "@/types/user";

function makeCompleteness(overrides: Partial<CompletenessResult> = {}): CompletenessResult {
  return {
    percentage: 55,
    tier: "STANDARD",
    earned: 55,
    possible: 100,
    items: [
      { key: "A1", label: "Profile photo", completed: true, points: 15 },
      { key: "A2", label: "Mobile number", completed: true, points: 10 },
      { key: "A3", label: "Email verified", completed: false, points: 10 },
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
    nextIncompleteItem: { key: "A3", label: "Email verified", completed: false, points: 10 },
    ...overrides,
  };
}

describe("ProfileCompletenessCard", () => {
  it("renders percentage, tier label, next-step CTA, items checklist, Extras section", () => {
    render(<ProfileCompletenessCard completeness={makeCompleteness()} />);
    expect(screen.getByLabelText(/55% complete/i)).toBeInTheDocument();
    expect(screen.getByText("Standard")).toBeInTheDocument();
    expect(screen.getByText(/Next: Email verified/)).toBeInTheDocument();
    expect(screen.getByText("Profile photo")).toBeInTheDocument();
    expect(screen.getByText("Extras")).toBeInTheDocument();
    expect(screen.getByText("WhatsApp notifications")).toBeInTheDocument();
  });

  it("BASIC tier renders gray styling", () => {
    render(
      <ProfileCompletenessCard
        completeness={makeCompleteness({ percentage: 20, tier: "BASIC" })}
      />,
    );
    expect(screen.getByText("Basic")).toBeInTheDocument();
  });

  it("COMPLETE tier renders blue styling", () => {
    render(
      <ProfileCompletenessCard
        completeness={makeCompleteness({ percentage: 80, tier: "COMPLETE" })}
      />,
    );
    expect(screen.getByText("Complete")).toBeInTheDocument();
  });

  it("VERIFIED tier renders green styling and hides next CTA when all done", () => {
    render(
      <ProfileCompletenessCard
        completeness={makeCompleteness({
          percentage: 100,
          tier: "VERIFIED",
          nextIncompleteItem: null,
        })}
      />,
    );
    expect(screen.getByText("Verified")).toBeInTheDocument();
    expect(screen.getByText(/all core items complete/i)).toBeInTheDocument();
  });

  it("next CTA links to /r/profile/family when nextIncompleteItem is C1 (emergency)", () => {
    render(
      <ProfileCompletenessCard
        completeness={makeCompleteness({
          nextIncompleteItem: {
            key: "C1",
            label: "Emergency contact",
            completed: false,
            points: 10,
          },
        })}
      />,
    );
    expect(screen.getByRole("link", { name: /next: emergency/i })).toHaveAttribute(
      "href",
      "/r/profile/family",
    );
  });

  it("next CTA links to /r/profile/vehicles when nextIncompleteItem is E1", () => {
    render(
      <ProfileCompletenessCard
        completeness={makeCompleteness({
          nextIncompleteItem: {
            key: "E1",
            label: "Vehicle declared",
            completed: false,
            points: 10,
          },
        })}
      />,
    );
    expect(screen.getByRole("link", { name: /next: vehicle/i })).toHaveAttribute(
      "href",
      "/r/profile/vehicles",
    );
  });

  it("falls back to /r/profile when nextIncompleteItem key not in map", () => {
    render(
      <ProfileCompletenessCard
        completeness={makeCompleteness({
          nextIncompleteItem: {
            key: "XX",
            label: "Unknown item",
            completed: false,
            points: 5,
          },
        })}
      />,
    );
    expect(screen.getByRole("link", { name: /next: unknown item/i })).toHaveAttribute(
      "href",
      "/r/profile",
    );
  });

  it("renders items with strike-through when completed and highlights incomplete items", () => {
    const { container } = render(<ProfileCompletenessCard completeness={makeCompleteness()} />);
    expect(container.querySelectorAll(".line-through").length).toBeGreaterThan(0);
  });
});
