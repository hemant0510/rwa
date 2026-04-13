import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  it("renders compact trigger with ring + tier badge", () => {
    render(<ProfileCompletenessCard completeness={makeCompleteness()} />);
    expect(screen.getByLabelText(/view profile completeness details/i)).toBeInTheDocument();
    // Ring shows percentage
    expect(screen.getByLabelText(/55% complete/i)).toBeInTheDocument();
    expect(screen.getByText("Standard")).toBeInTheDocument();
  });

  it("opens dialog with items + extras when trigger clicked", async () => {
    const user = userEvent.setup();
    render(<ProfileCompletenessCard completeness={makeCompleteness()} />);
    await user.click(screen.getByLabelText(/view profile completeness details/i));
    expect(screen.getByText("Profile Completeness")).toBeInTheDocument();
    expect(screen.getByText("Profile photo")).toBeInTheDocument();
    expect(screen.getByText("Extras")).toBeInTheDocument();
    expect(screen.getByText("WhatsApp notifications")).toBeInTheDocument();
  });

  it("shows Next CTA link in the dialog", async () => {
    const user = userEvent.setup();
    render(<ProfileCompletenessCard completeness={makeCompleteness()} />);
    await user.click(screen.getByLabelText(/view profile completeness details/i));
    expect(screen.getByText(/Next: Email verified/)).toBeInTheDocument();
  });

  it("BASIC tier renders gray styling in trigger", () => {
    render(
      <ProfileCompletenessCard
        completeness={makeCompleteness({ percentage: 20, tier: "BASIC" })}
      />,
    );
    expect(screen.getByText("Basic")).toBeInTheDocument();
  });

  it("COMPLETE tier renders blue styling in trigger", () => {
    render(
      <ProfileCompletenessCard
        completeness={makeCompleteness({ percentage: 80, tier: "COMPLETE" })}
      />,
    );
    expect(screen.getByText("Complete")).toBeInTheDocument();
  });

  it("VERIFIED tier dialog hides next CTA when all done", async () => {
    const user = userEvent.setup();
    render(
      <ProfileCompletenessCard
        completeness={makeCompleteness({
          percentage: 100,
          tier: "VERIFIED",
          nextIncompleteItem: null,
        })}
      />,
    );
    await user.click(screen.getByLabelText(/view profile completeness details/i));
    expect(screen.getByText(/all core items complete/i)).toBeInTheDocument();
  });

  it("next CTA in dialog links to /r/profile/family when nextIncompleteItem is C1", async () => {
    const user = userEvent.setup();
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
    await user.click(screen.getByLabelText(/view profile completeness details/i));
    expect(screen.getByRole("link", { name: /next: emergency/i })).toHaveAttribute(
      "href",
      "/r/profile/family",
    );
  });

  it("next CTA in dialog links to /r/profile/vehicles when nextIncompleteItem is E1", async () => {
    const user = userEvent.setup();
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
    await user.click(screen.getByLabelText(/view profile completeness details/i));
    expect(screen.getByRole("link", { name: /next: vehicle/i })).toHaveAttribute(
      "href",
      "/r/profile/vehicles",
    );
  });

  it("clicking a next CTA link closes the dialog", async () => {
    const user = userEvent.setup();
    render(<ProfileCompletenessCard completeness={makeCompleteness()} />);
    await user.click(screen.getByLabelText(/view profile completeness details/i));
    await user.click(screen.getByRole("link", { name: /next: email verified/i }));
    // After click, dialog closes — title not visible anymore
    expect(screen.queryByText("Profile Completeness")).not.toBeInTheDocument();
  });

  it("falls back to /r/profile when nextIncompleteItem key not in map", async () => {
    const user = userEvent.setup();
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
    await user.click(screen.getByLabelText(/view profile completeness details/i));
    expect(screen.getByRole("link", { name: /next: unknown item/i })).toHaveAttribute(
      "href",
      "/r/profile",
    );
  });

  it("dialog shows strike-through for completed items", async () => {
    const user = userEvent.setup();
    render(<ProfileCompletenessCard completeness={makeCompleteness()} />);
    await user.click(screen.getByLabelText(/view profile completeness details/i));
    // Dialog is portaled — query document.body
    expect(document.body.querySelectorAll(".line-through").length).toBeGreaterThan(0);
  });

  it("closes dialog when Close button is clicked", async () => {
    const user = userEvent.setup();
    render(<ProfileCompletenessCard completeness={makeCompleteness()} />);
    await user.click(screen.getByLabelText(/view profile completeness details/i));
    // Multiple close buttons (Radix's X icon + our Close button). Click the text one.
    const closeButtons = screen.getAllByRole("button", { name: /^close$/i });
    await user.click(closeButtons[closeButtons.length - 1]);
    expect(screen.queryByText("Profile Completeness")).not.toBeInTheDocument();
  });

  it("accepts a custom trigger element", async () => {
    const user = userEvent.setup();
    render(
      <ProfileCompletenessCard
        completeness={makeCompleteness()}
        trigger={<button type="button">Custom trigger</button>}
      />,
    );
    expect(screen.queryByLabelText(/view profile completeness details/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /custom trigger/i })).toBeInTheDocument();
    // Custom trigger doesn't open dialog (no onClick wired)
    await user.click(screen.getByRole("button", { name: /custom trigger/i }));
    expect(screen.queryByText("Profile Completeness")).not.toBeInTheDocument();
  });
});
