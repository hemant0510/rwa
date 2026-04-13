import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetFamilyMembers, mockDeleteFamilyMember } = vi.hoisted(() => ({
  mockGetFamilyMembers: vi.fn(),
  mockDeleteFamilyMember: vi.fn(),
}));

vi.mock("@/services/family", () => ({
  getFamilyMembers: mockGetFamilyMembers,
  deleteFamilyMember: mockDeleteFamilyMember,
  createFamilyMember: vi.fn(),
  updateFamilyMember: vi.fn(),
  uploadFamilyMemberPhoto: vi.fn(),
  uploadFamilyMemberIdProof: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/features/family/FamilyMemberDialog", () => ({
  FamilyMemberDialog: ({ open, onSaved }: { open: boolean; onSaved: () => void }) =>
    open ? (
      <div data-testid="family-dialog">
        <button onClick={onSaved}>trigger-saved</button>
      </div>
    ) : null,
}));

import ResidentFamilyPage from "@/app/r/profile/family/page";
import type { FamilyMember } from "@/services/family";

const members: FamilyMember[] = [
  {
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
  },
];

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <ResidentFamilyPage />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetFamilyMembers.mockResolvedValue(members);
  mockDeleteFamilyMember.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ResidentFamilyPage", () => {
  it("renders loading skeleton then the member grid", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Asha Bhagat")).toBeInTheDocument();
    });
    expect(screen.getByRole("link", { name: /back to profile/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add member/i })).toBeInTheDocument();
  });

  it("shows error state and retries when Try again is clicked", async () => {
    mockGetFamilyMembers.mockRejectedValueOnce(new Error("boom"));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/unable to load family members/i)).toBeInTheDocument();
    });
    mockGetFamilyMembers.mockResolvedValueOnce(members);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => {
      expect(screen.getByText("Asha Bhagat")).toBeInTheDocument();
    });
  });

  it("renders empty state and opens dialog when Add first member is clicked", async () => {
    mockGetFamilyMembers.mockResolvedValueOnce([]);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/no family members yet/i)).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /add your first family member/i }));
    expect(screen.getByTestId("family-dialog")).toBeInTheDocument();
  });

  it("opens dialog when the top Add Member button is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Asha Bhagat")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /add member/i }));
    expect(screen.getByTestId("family-dialog")).toBeInTheDocument();
  });

  it("opens dialog in edit mode when a card's edit button is clicked", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Asha Bhagat")).toBeInTheDocument();
    });
    await user.click(screen.getByLabelText(/edit asha bhagat/i));
    expect(screen.getByTestId("family-dialog")).toBeInTheDocument();
  });

  it("opens remove confirmation and deletes the member", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Asha Bhagat")).toBeInTheDocument();
    });
    await user.click(screen.getByLabelText(/remove asha bhagat/i));
    expect(screen.getByText(/remove family member\?/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^remove$/i }));
    await waitFor(() => {
      expect(mockDeleteFamilyMember).toHaveBeenCalledWith("fm-1");
    });
    expect(toast.success).toHaveBeenCalledWith("Family member removed");
  });

  it("cancels remove confirmation without calling delete", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Asha Bhagat")).toBeInTheDocument();
    });
    await user.click(screen.getByLabelText(/remove asha bhagat/i));
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(mockDeleteFamilyMember).not.toHaveBeenCalled();
  });

  it("surfaces delete error toast", async () => {
    mockDeleteFamilyMember.mockRejectedValueOnce(new Error("Nope"));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Asha Bhagat")).toBeInTheDocument();
    });
    await user.click(screen.getByLabelText(/remove asha bhagat/i));
    await user.click(screen.getByRole("button", { name: /^remove$/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Nope");
    });
  });

  it("surfaces generic delete error toast when error has no message", async () => {
    mockDeleteFamilyMember.mockRejectedValueOnce(new Error(""));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Asha Bhagat")).toBeInTheDocument();
    });
    await user.click(screen.getByLabelText(/remove asha bhagat/i));
    await user.click(screen.getByRole("button", { name: /^remove$/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Failed to remove family member");
    });
  });

  it("shows limit-reached banner and disables Add Member when 15 members exist", async () => {
    const fifteen: FamilyMember[] = Array.from({ length: 15 }, (_, i) => ({
      ...members[0],
      id: `fm-${i + 1}`,
      memberSeq: i + 1,
      memberId: `EDN-DLH-0042-M${i + 1}`,
      name: `Member ${i + 1}`,
    }));
    mockGetFamilyMembers.mockResolvedValueOnce(fifteen);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/15\/15 members/i)).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /add member/i })).toBeDisabled();
  });

  it("calls onSaved callback without throwing", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Asha Bhagat")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /add member/i }));
    await user.click(screen.getByRole("button", { name: /trigger-saved/i }));
    expect(screen.getByTestId("family-dialog")).toBeInTheDocument();
  });
});
