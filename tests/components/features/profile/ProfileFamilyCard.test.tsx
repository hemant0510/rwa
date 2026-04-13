import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ProfileFamilyCard } from "@/components/features/profile/ProfileFamilyCard";

const contact = {
  name: "Asha Bhagat",
  relationship: "MOTHER",
  mobile: "9876543210",
  bloodGroup: "O_POS",
};

describe("ProfileFamilyCard", () => {
  it("renders count and View family link when familyCount > 0", () => {
    render(
      <ProfileFamilyCard
        familyCount={3}
        householdStatus="HAS_ENTRIES"
        emergencyContacts={[contact]}
        onDeclareNone={vi.fn()}
        onUndoDeclaration={vi.fn()}
      />,
    );
    expect(screen.getByText(/3 members in your household/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view family/i })).toHaveAttribute(
      "href",
      "/r/profile/family",
    );
    expect(screen.getByText(/Asha Bhagat/)).toBeInTheDocument();
    expect(screen.getByText(/\+91 9876543210/)).toBeInTheDocument();
  });

  it("singular member label when count is 1", () => {
    render(
      <ProfileFamilyCard
        familyCount={1}
        householdStatus="HAS_ENTRIES"
        emergencyContacts={[]}
        onDeclareNone={vi.fn()}
        onUndoDeclaration={vi.fn()}
      />,
    );
    expect(screen.getByText(/1 member in your household/i)).toBeInTheDocument();
  });

  it("caps emergency contacts to 2 and omits mobile when null", () => {
    render(
      <ProfileFamilyCard
        familyCount={5}
        householdStatus="HAS_ENTRIES"
        emergencyContacts={[
          contact,
          { ...contact, name: "Ravi", mobile: null },
          { ...contact, name: "Zara" },
        ]}
        onDeclareNone={vi.fn()}
        onUndoDeclaration={vi.fn()}
      />,
    );
    expect(screen.getByText("Asha Bhagat")).toBeInTheDocument();
    expect(screen.getByText("Ravi")).toBeInTheDocument();
    expect(screen.queryByText("Zara")).not.toBeInTheDocument();
  });

  it("shows declaration toggle when familyCount is 0 and status is NOT_SET", () => {
    const onDeclareNone = vi.fn();
    render(
      <ProfileFamilyCard
        familyCount={0}
        householdStatus="NOT_SET"
        emergencyContacts={[]}
        onDeclareNone={onDeclareNone}
        onUndoDeclaration={vi.fn()}
      />,
    );
    const btn = screen.getByRole("button", { name: /no family members/i });
    fireEvent.click(btn);
    expect(onDeclareNone).toHaveBeenCalled();
  });

  it("shows declared-none state with Undo when DECLARED_NONE", () => {
    const onUndo = vi.fn();
    render(
      <ProfileFamilyCard
        familyCount={0}
        householdStatus="DECLARED_NONE"
        emergencyContacts={[]}
        onDeclareNone={vi.fn()}
        onUndoDeclaration={onUndo}
      />,
    );
    expect(screen.getByText(/You've declared no family members/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /undo declaration/i }));
    expect(onUndo).toHaveBeenCalled();
  });

  it("hides View family link when count is 0", () => {
    render(
      <ProfileFamilyCard
        familyCount={0}
        householdStatus="NOT_SET"
        emergencyContacts={[]}
        onDeclareNone={vi.fn()}
        onUndoDeclaration={vi.fn()}
      />,
    );
    expect(screen.queryByRole("link", { name: /view family/i })).not.toBeInTheDocument();
  });
});
