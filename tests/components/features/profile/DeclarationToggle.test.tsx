import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DeclarationToggle } from "@/components/features/profile/DeclarationToggle";

describe("DeclarationToggle", () => {
  it("renders declare button when status is NOT_SET", () => {
    const onDeclareNone = vi.fn();
    render(
      <DeclarationToggle
        status="NOT_SET"
        declareLabel="I have no family members"
        declaredLabel="You've declared no family members"
        onDeclareNone={onDeclareNone}
        onUndo={vi.fn()}
      />,
    );
    const btn = screen.getByRole("button", { name: /I have no family members/i });
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onDeclareNone).toHaveBeenCalled();
  });

  it("renders declared state with Undo when status is DECLARED_NONE", () => {
    const onUndo = vi.fn();
    render(
      <DeclarationToggle
        status="DECLARED_NONE"
        declareLabel="I have no family members"
        declaredLabel="You've declared no family members"
        onDeclareNone={vi.fn()}
        onUndo={onUndo}
      />,
    );
    expect(screen.getByText(/You've declared no family members/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /undo declaration/i }));
    expect(onUndo).toHaveBeenCalled();
  });

  it("renders nothing when status is HAS_ENTRIES", () => {
    const { container } = render(
      <DeclarationToggle
        status="HAS_ENTRIES"
        declareLabel="x"
        declaredLabel="y"
        onDeclareNone={vi.fn()}
        onUndo={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("disables buttons when pending", () => {
    const { rerender } = render(
      <DeclarationToggle
        status="NOT_SET"
        declareLabel="Declare none"
        declaredLabel="Declared"
        onDeclareNone={vi.fn()}
        onUndo={vi.fn()}
        pending
      />,
    );
    expect(screen.getByRole("button", { name: /declare none/i })).toBeDisabled();
    rerender(
      <DeclarationToggle
        status="DECLARED_NONE"
        declareLabel="Declare none"
        declaredLabel="Declared"
        onDeclareNone={vi.fn()}
        onUndo={vi.fn()}
        pending
      />,
    );
    expect(screen.getByRole("button", { name: /undo declaration/i })).toBeDisabled();
  });
});
