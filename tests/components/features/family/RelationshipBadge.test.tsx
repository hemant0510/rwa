import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  RELATIONSHIP_LABELS,
  RelationshipBadge,
} from "@/components/features/family/RelationshipBadge";

describe("RelationshipBadge", () => {
  it.each(Object.entries(RELATIONSHIP_LABELS))("renders %s as %s", (key, label) => {
    if (key === "OTHER") return; // tested separately
    render(<RelationshipBadge relationship={key} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it("renders OTHER label when otherRelationship is empty", () => {
    render(<RelationshipBadge relationship="OTHER" />);
    expect(screen.getByText("Other")).toBeInTheDocument();
  });

  it("renders custom otherRelationship label when provided", () => {
    render(<RelationshipBadge relationship="OTHER" otherRelationship="Family Friend" />);
    expect(screen.getByText("Family Friend")).toBeInTheDocument();
  });

  it("falls back to raw key for unknown relationship", () => {
    render(<RelationshipBadge relationship="ALIEN" />);
    expect(screen.getByText("ALIEN")).toBeInTheDocument();
  });

  it("treats whitespace-only otherRelationship as empty", () => {
    render(<RelationshipBadge relationship="OTHER" otherRelationship="   " />);
    expect(screen.getByText("Other")).toBeInTheDocument();
  });
});
