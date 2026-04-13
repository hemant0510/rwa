import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  BLOOD_GROUP_LABELS,
  FamilyMemberCard,
} from "@/components/features/family/FamilyMemberCard";
import type { FamilyMember } from "@/services/family";

const baseMember: FamilyMember = {
  id: "fm-1",
  memberId: "EDN-DLH-0042-M1",
  memberSeq: 1,
  name: "Asha Bhagat",
  relationship: "MOTHER",
  otherRelationship: null,
  dateOfBirth: "1965-04-20",
  age: 60,
  bloodGroup: "O_POS",
  mobile: "9876543210",
  email: "asha@example.com",
  occupation: "Retired",
  photoUrl: null,
  idProofSignedUrl: null,
  isEmergencyContact: true,
  emergencyPriority: 1,
  medicalNotes: null,
  isActive: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("FamilyMemberCard", () => {
  it("renders name, relationship, age, blood group, mobile, email, member id", () => {
    render(<FamilyMemberCard member={baseMember} onEdit={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText("Asha Bhagat")).toBeInTheDocument();
    expect(screen.getByText("Mother")).toBeInTheDocument();
    expect(screen.getByText("60y")).toBeInTheDocument();
    expect(screen.getByText("O+")).toBeInTheDocument();
    expect(screen.getByText("+91 9876543210")).toBeInTheDocument();
    expect(screen.getByText("asha@example.com")).toBeInTheDocument();
    expect(screen.getByText("EDN-DLH-0042-M1")).toBeInTheDocument();
  });

  it("renders the emergency contact indicator when isEmergencyContact is true", () => {
    render(<FamilyMemberCard member={baseMember} onEdit={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByLabelText(/primary priority/i)).toBeInTheDocument();
  });

  it("hides the emergency indicator when not an emergency contact", () => {
    render(
      <FamilyMemberCard
        member={{ ...baseMember, isEmergencyContact: false, emergencyPriority: null }}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText(/priority/i)).not.toBeInTheDocument();
  });

  it("renders initials avatar when no photo", () => {
    render(<FamilyMemberCard member={baseMember} onEdit={vi.fn()} onRemove={vi.fn()} />);
    expect(screen.getByText("AB")).toBeInTheDocument();
  });

  it("renders Image when photoUrl is set", () => {
    render(
      <FamilyMemberCard
        member={{ ...baseMember, photoUrl: "/photo.jpg" }}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    const img = screen.getByAltText("Asha Bhagat");
    expect(img).toBeInTheDocument();
    expect(img.tagName).toBe("IMG");
  });

  it("hides age row when age is null", () => {
    render(
      <FamilyMemberCard
        member={{ ...baseMember, age: null }}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.queryByText(/^\d+y$/)).not.toBeInTheDocument();
  });

  it("hides blood group, member id, mobile, email when not provided", () => {
    render(
      <FamilyMemberCard
        member={{
          ...baseMember,
          bloodGroup: null,
          memberId: null,
          mobile: null,
          email: null,
        }}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.queryByText("O+")).not.toBeInTheDocument();
    expect(screen.queryByText("EDN-DLH-0042-M1")).not.toBeInTheDocument();
    expect(screen.queryByText(/\+91/)).not.toBeInTheDocument();
    expect(screen.queryByText("asha@example.com")).not.toBeInTheDocument();
  });

  it("falls back to raw blood group when missing from label map", () => {
    render(
      <FamilyMemberCard
        member={{ ...baseMember, bloodGroup: "RARE" }}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText("RARE")).toBeInTheDocument();
  });

  it("invokes onEdit and onRemove with the member when buttons clicked", () => {
    const onEdit = vi.fn();
    const onRemove = vi.fn();
    render(<FamilyMemberCard member={baseMember} onEdit={onEdit} onRemove={onRemove} />);
    fireEvent.click(screen.getByLabelText(/edit asha/i));
    fireEvent.click(screen.getByLabelText(/remove asha/i));
    expect(onEdit).toHaveBeenCalledWith(baseMember);
    expect(onRemove).toHaveBeenCalledWith(baseMember);
  });

  it("uses User icon fallback when name has no usable initials", () => {
    const { container } = render(
      <FamilyMemberCard
        member={{ ...baseMember, name: " " }}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("exposes BLOOD_GROUP_LABELS for reuse", () => {
    expect(BLOOD_GROUP_LABELS.A_POS).toBe("A+");
    expect(BLOOD_GROUP_LABELS.UNKNOWN).toBe("Unknown");
  });
});
