import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockCreateFamilyMember,
  mockUpdateFamilyMember,
  mockUploadPhoto,
  mockUploadIdProof,
  mockCompressImage,
} = vi.hoisted(() => ({
  mockCreateFamilyMember: vi.fn(),
  mockUpdateFamilyMember: vi.fn(),
  mockUploadPhoto: vi.fn(),
  mockUploadIdProof: vi.fn(),
  mockCompressImage: vi.fn(),
}));

vi.mock("@/services/family", () => ({
  createFamilyMember: mockCreateFamilyMember,
  updateFamilyMember: mockUpdateFamilyMember,
  uploadFamilyMemberPhoto: mockUploadPhoto,
  uploadFamilyMemberIdProof: mockUploadIdProof,
}));

vi.mock("@/lib/utils/compress-image", () => ({
  compressImage: mockCompressImage,
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { FamilyMemberDialog } from "@/components/features/family/FamilyMemberDialog";
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
  isEmergencyContact: false,
  emergencyPriority: null,
  medicalNotes: null,
  isActive: true,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCompressImage.mockImplementation(async (f: File) => f);
  mockCreateFamilyMember.mockResolvedValue({ ...baseMember, id: "new-id" });
  mockUpdateFamilyMember.mockResolvedValue(baseMember);
  mockUploadPhoto.mockResolvedValue({ url: "https://x.com/photo" });
  mockUploadIdProof.mockResolvedValue({ url: "https://x.com/id" });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("FamilyMemberDialog — create flow", () => {
  it("renders the create title and description", () => {
    render(<FamilyMemberDialog open onOpenChange={vi.fn()} member={null} onSaved={vi.fn()} />);
    expect(screen.getByText("Add Family Member")).toBeInTheDocument();
  });

  it("creates a member when valid fields submitted", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();
    render(<FamilyMemberDialog open onOpenChange={onOpenChange} member={null} onSaved={onSaved} />);

    await user.type(screen.getByLabelText(/^Name/), "Test Person");
    await user.type(screen.getByLabelText(/Specify Relationship/), "Family Friend");
    await user.click(screen.getByRole("button", { name: /add member/i }));

    await waitFor(() => {
      expect(mockCreateFamilyMember).toHaveBeenCalled();
    });
    expect(toast.success).toHaveBeenCalledWith("Family member added");
    expect(onSaved).toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("shows validation error when required name is missing", async () => {
    const user = userEvent.setup();
    render(<FamilyMemberDialog open onOpenChange={vi.fn()} member={null} onSaved={vi.fn()} />);
    await user.type(screen.getByLabelText(/Specify Relationship/), "Friend");
    await user.click(screen.getByRole("button", { name: /add member/i }));
    await waitFor(() => {
      expect(mockCreateFamilyMember).not.toHaveBeenCalled();
    });
  });

  it("requires otherRelationship when relationship is OTHER", async () => {
    const user = userEvent.setup();
    render(<FamilyMemberDialog open onOpenChange={vi.fn()} member={null} onSaved={vi.fn()} />);
    await user.type(screen.getByLabelText(/^Name/), "Person");
    await user.click(screen.getByRole("button", { name: /add member/i }));
    await waitFor(() => {
      expect(screen.getByText(/please specify the relationship/i)).toBeInTheDocument();
    });
  });

  it("toggles emergency priority field on switch", async () => {
    const user = userEvent.setup();
    render(<FamilyMemberDialog open onOpenChange={vi.fn()} member={null} onSaved={vi.fn()} />);
    expect(screen.queryByText("Primary")).not.toBeInTheDocument();
    await user.click(screen.getByLabelText(/emergency contact/i));
    await waitFor(() => {
      expect(screen.getByText("Primary")).toBeInTheDocument();
      expect(screen.getByText("Secondary")).toBeInTheDocument();
    });
  });

  it("requires emergency priority when emergency contact is on", async () => {
    const user = userEvent.setup();
    render(<FamilyMemberDialog open onOpenChange={vi.fn()} member={null} onSaved={vi.fn()} />);
    await user.type(screen.getByLabelText(/^Name/), "Person");
    await user.type(screen.getByLabelText(/Specify Relationship/), "Friend");
    await user.click(screen.getByLabelText(/emergency contact/i));
    await user.click(screen.getByRole("button", { name: /add member/i }));
    await waitFor(() => {
      expect(screen.getByText(/select primary or secondary/i)).toBeInTheDocument();
    });
  });

  it("uploads photo and id-proof after creating member", async () => {
    const user = userEvent.setup();
    render(<FamilyMemberDialog open onOpenChange={vi.fn()} member={null} onSaved={vi.fn()} />);

    await user.type(screen.getByLabelText(/^Name/), "Person");
    await user.type(screen.getByLabelText(/Specify Relationship/), "Friend");

    const photo = new File(["x"], "p.jpg", { type: "image/jpeg" });
    const idDoc = new File(["y"], "id.pdf", { type: "application/pdf" });
    fireEvent.change(screen.getByLabelText(/photo/i), { target: { files: [photo] } });
    fireEvent.change(screen.getByLabelText(/id proof/i), { target: { files: [idDoc] } });

    expect(screen.getByText(/Selected: p\.jpg/)).toBeInTheDocument();
    expect(screen.getByText(/Selected: id\.pdf/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /add member/i }));

    await waitFor(() => {
      expect(mockUploadPhoto).toHaveBeenCalledWith("new-id", photo);
      expect(mockUploadIdProof).toHaveBeenCalledWith("new-id", idDoc);
    });
  });

  it("shows toast when photo upload fails but member is saved", async () => {
    mockUploadPhoto.mockRejectedValueOnce(new Error("net"));
    const user = userEvent.setup();
    render(<FamilyMemberDialog open onOpenChange={vi.fn()} member={null} onSaved={vi.fn()} />);

    await user.type(screen.getByLabelText(/^Name/), "Person");
    await user.type(screen.getByLabelText(/Specify Relationship/), "Friend");
    fireEvent.change(screen.getByLabelText(/photo/i), {
      target: { files: [new File(["x"], "p.jpg", { type: "image/jpeg" })] },
    });
    await user.click(screen.getByRole("button", { name: /add member/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Photo upload failed — member saved");
    });
  });

  it("shows toast when id proof upload fails but member is saved", async () => {
    mockUploadIdProof.mockRejectedValueOnce(new Error("net"));
    const user = userEvent.setup();
    render(<FamilyMemberDialog open onOpenChange={vi.fn()} member={null} onSaved={vi.fn()} />);

    await user.type(screen.getByLabelText(/^Name/), "Person");
    await user.type(screen.getByLabelText(/Specify Relationship/), "Friend");
    fireEvent.change(screen.getByLabelText(/id proof/i), {
      target: { files: [new File(["x"], "id.pdf", { type: "application/pdf" })] },
    });
    await user.click(screen.getByRole("button", { name: /add member/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("ID proof upload failed — member saved");
    });
  });

  it("surfaces server error toast when create fails", async () => {
    mockCreateFamilyMember.mockRejectedValueOnce(new Error("Boom"));
    const user = userEvent.setup();
    render(<FamilyMemberDialog open onOpenChange={vi.fn()} member={null} onSaved={vi.fn()} />);

    await user.type(screen.getByLabelText(/^Name/), "Person");
    await user.type(screen.getByLabelText(/Specify Relationship/), "Friend");
    await user.click(screen.getByRole("button", { name: /add member/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Boom");
    });
  });

  it("shows generic error toast when create fails with non-Error", async () => {
    mockCreateFamilyMember.mockRejectedValueOnce("oops");
    const user = userEvent.setup();
    render(<FamilyMemberDialog open onOpenChange={vi.fn()} member={null} onSaved={vi.fn()} />);

    await user.type(screen.getByLabelText(/^Name/), "Person");
    await user.type(screen.getByLabelText(/Specify Relationship/), "Friend");
    await user.click(screen.getByRole("button", { name: /add member/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to save family member");
    });
  });

  it("invokes onOpenChange(false) when Cancel clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(<FamilyMemberDialog open onOpenChange={onOpenChange} member={null} onSaved={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("FamilyMemberDialog — edit flow", () => {
  it("renders edit title and prefilled name", () => {
    render(
      <FamilyMemberDialog open onOpenChange={vi.fn()} member={baseMember} onSaved={vi.fn()} />,
    );
    expect(screen.getByText("Edit Family Member")).toBeInTheDocument();
    expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe("Asha Bhagat");
  });

  it("calls updateFamilyMember on save", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(
      <FamilyMemberDialog open onOpenChange={vi.fn()} member={baseMember} onSaved={onSaved} />,
    );
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => {
      expect(mockUpdateFamilyMember).toHaveBeenCalledWith("fm-1", expect.any(Object));
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it("re-initialises when the open prop transitions to true", () => {
    const { rerender } = render(
      <FamilyMemberDialog open={false} onOpenChange={vi.fn()} member={null} onSaved={vi.fn()} />,
    );
    rerender(
      <FamilyMemberDialog open onOpenChange={vi.fn()} member={baseMember} onSaved={vi.fn()} />,
    );
    expect((screen.getByLabelText(/^Name/) as HTMLInputElement).value).toBe("Asha Bhagat");
  });

  it("prefills empty fields when editing a member with all nulls", () => {
    render(
      <FamilyMemberDialog
        open
        onOpenChange={vi.fn()}
        member={{
          ...baseMember,
          otherRelationship: "Friend",
          dateOfBirth: null,
          bloodGroup: null,
          mobile: null,
          email: null,
          occupation: null,
          medicalNotes: "Asthmatic",
          relationship: "OTHER",
        }}
        onSaved={vi.fn()}
      />,
    );
    expect((screen.getByLabelText(/Specify Relationship/) as HTMLInputElement).value).toBe(
      "Friend",
    );
    expect((screen.getByLabelText(/Date of Birth/) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText(/Mobile/) as HTMLInputElement).value).toBe("");
    expect((screen.getByLabelText(/Medical Notes/) as HTMLTextAreaElement).value).toBe("Asthmatic");
  });

  it("renders prefilled emergency priority radio when editing emergency contact", () => {
    render(
      <FamilyMemberDialog
        open
        onOpenChange={vi.fn()}
        member={{ ...baseMember, isEmergencyContact: true, emergencyPriority: 2 }}
        onSaved={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Secondary")).toBeChecked();
  });

  it("toggles priority value when user clicks a different option", async () => {
    const user = userEvent.setup();
    render(
      <FamilyMemberDialog
        open
        onOpenChange={vi.fn()}
        member={{ ...baseMember, isEmergencyContact: true, emergencyPriority: 2 }}
        onSaved={vi.fn()}
      />,
    );
    await user.click(screen.getByLabelText("Primary"));
    expect(screen.getByLabelText("Primary")).toBeChecked();
  });
});

describe("FamilyMemberDialog — Select interactions", () => {
  it("changes relationship via Select dropdown and clears OTHER input", async () => {
    const user = userEvent.setup();
    render(<FamilyMemberDialog open onOpenChange={vi.fn()} member={null} onSaved={vi.fn()} />);
    expect(screen.getByLabelText(/Specify Relationship/)).toBeInTheDocument();
    await user.click(screen.getByLabelText(/^Relationship/));
    await user.click(await screen.findByRole("option", { name: "Mother" }));
    await waitFor(() => {
      expect(screen.queryByLabelText(/Specify Relationship/)).not.toBeInTheDocument();
    });
  });

  it("shows mobile validation error on invalid number", async () => {
    const user = userEvent.setup();
    render(<FamilyMemberDialog open onOpenChange={vi.fn()} member={null} onSaved={vi.fn()} />);
    await user.type(screen.getByLabelText(/^Name/), "Person");
    await user.type(screen.getByLabelText(/Specify Relationship/), "Friend");
    await user.type(screen.getByLabelText(/Mobile/), "12345");
    await user.click(screen.getByRole("button", { name: /add member/i }));
    await waitFor(() => {
      expect(screen.getByText(/valid 10-digit mobile/i)).toBeInTheDocument();
    });
  });

  it("sets blood group via Select dropdown", async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    render(<FamilyMemberDialog open onOpenChange={vi.fn()} member={null} onSaved={onSaved} />);
    await user.type(screen.getByLabelText(/^Name/), "Person");
    await user.type(screen.getByLabelText(/Specify Relationship/), "Friend");

    await user.click(screen.getByLabelText(/Blood Group/));
    await user.click(await screen.findByRole("option", { name: "A+" }));

    await user.click(screen.getByRole("button", { name: /add member/i }));

    await waitFor(() => {
      expect(mockCreateFamilyMember).toHaveBeenCalledWith(
        expect.objectContaining({ bloodGroup: "A_POS" }),
      );
    });
  });
});
