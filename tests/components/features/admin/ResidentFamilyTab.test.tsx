import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetFamily } = vi.hoisted(() => ({ mockGetFamily: vi.fn() }));

vi.mock("@/services/admin-residents", () => ({
  getResidentFamily: mockGetFamily,
}));

import { ResidentFamilyTab } from "@/components/features/admin/ResidentFamilyTab";
import type { AdminFamilyMember } from "@/services/admin-residents";

function renderTab() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ResidentFamilyTab residentId="r1" />
    </QueryClientProvider>,
  );
}

const base: AdminFamilyMember = {
  id: "d1",
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
  idProofSignedUrl: "https://x.com/id.pdf",
  isEmergencyContact: true,
  emergencyPriority: 1,
  medicalNotes: null,
  isActive: true,
  deactivatedAt: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => vi.clearAllMocks());

describe("ResidentFamilyTab", () => {
  it("renders loading spinner initially", () => {
    mockGetFamily.mockReturnValue(new Promise(() => {}));
    const { container } = renderTab();
    expect(container.querySelector("svg.animate-spin")).toBeInTheDocument();
  });

  it("renders error state and retries", async () => {
    mockGetFamily.mockRejectedValueOnce(new Error("boom"));
    const user = userEvent.setup();
    renderTab();
    await waitFor(() => {
      expect(screen.getByText(/unable to load family members/i)).toBeInTheDocument();
    });
    mockGetFamily.mockResolvedValueOnce([base]);
    await user.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => {
      expect(screen.getByText("Asha Bhagat")).toBeInTheDocument();
    });
  });

  it("renders empty state when no members", async () => {
    mockGetFamily.mockResolvedValue([]);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText(/no family members/i)).toBeInTheDocument();
    });
  });

  it("renders active members with blood, emergency, id proof link", async () => {
    mockGetFamily.mockResolvedValue([base]);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText("Asha Bhagat")).toBeInTheDocument();
    });
    expect(screen.getByText("Mother")).toBeInTheDocument();
    expect(screen.getByText("60")).toBeInTheDocument();
    expect(screen.getByText("O+")).toBeInTheDocument();
    expect(screen.getByLabelText(/emergency contact priority 1/i)).toBeInTheDocument();
    expect(screen.getByText("Primary")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view/i })).toHaveAttribute(
      "href",
      "https://x.com/id.pdf",
    );
    expect(screen.getByText("EDN-DLH-0042-M1")).toBeInTheDocument();
  });

  it("splits inactive members into a separate section with strikethrough", async () => {
    mockGetFamily.mockResolvedValue([
      base,
      {
        ...base,
        id: "d2",
        memberId: "EDN-DLH-0042-M2",
        name: "Past Member",
        isActive: false,
        deactivatedAt: "2025-01-01T00:00:00Z",
      },
    ]);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText("Past Member")).toBeInTheDocument();
    });
    expect(screen.getByText(/inactive \(1\)/i)).toBeInTheDocument();
  });

  it("renders SECONDARY priority label correctly", async () => {
    mockGetFamily.mockResolvedValue([{ ...base, emergencyPriority: 2 }]);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText("Secondary")).toBeInTheDocument();
    });
  });

  it("renders otherRelationship when relationship is OTHER", async () => {
    mockGetFamily.mockResolvedValue([
      { ...base, relationship: "OTHER", otherRelationship: "Family Friend" },
    ]);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText("Family Friend")).toBeInTheDocument();
    });
  });

  it("falls back to raw relationship code when label missing", async () => {
    mockGetFamily.mockResolvedValue([{ ...base, relationship: "WEIRD" }]);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText("WEIRD")).toBeInTheDocument();
    });
  });

  it("falls back to raw blood group code when label missing", async () => {
    mockGetFamily.mockResolvedValue([{ ...base, bloodGroup: "RARE" }]);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText("RARE")).toBeInTheDocument();
    });
  });

  it("renders em-dash when fields are null", async () => {
    mockGetFamily.mockResolvedValue([
      {
        ...base,
        age: null,
        bloodGroup: null,
        isEmergencyContact: false,
        emergencyPriority: null,
        idProofSignedUrl: null,
        memberId: null,
      },
    ]);
    renderTab();
    await waitFor(() => {
      expect(screen.getByText("Asha Bhagat")).toBeInTheDocument();
    });
    // 4 em-dashes across columns (age, blood, emergency, id-proof)
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(4);
  });
});
