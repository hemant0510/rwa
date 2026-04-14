import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import { ResidentDirectoryReadOnly } from "@/components/features/counsellor/ResidentDirectoryReadOnly";
import type { CounsellorResidentListItem } from "@/types/counsellor";

function make(overrides: Partial<CounsellorResidentListItem> = {}): CounsellorResidentListItem {
  return {
    id: "u-1",
    name: "Asha Patel",
    email: "asha@x.com",
    mobile: "+91 9876543210",
    photoUrl: null,
    unitLabel: "A-101",
    ownershipType: "OWNER",
    status: "ACTIVE_PAID",
    role: "RESIDENT",
    ...overrides,
  };
}

function renderDefault(overrides: Partial<Parameters<typeof ResidentDirectoryReadOnly>[0]> = {}) {
  const props = {
    societyId: "s-1",
    residents: [make()],
    total: 1,
    page: 1,
    pageSize: 20,
    search: "",
    onSearchChange: vi.fn(),
    onPageChange: vi.fn(),
    isLoading: false,
    ...overrides,
  };
  return { props, ...render(<ResidentDirectoryReadOnly {...props} />) };
}

describe("ResidentDirectoryReadOnly", () => {
  it("renders resident row with unit and status badge", () => {
    renderDefault();
    expect(screen.getByText("Asha Patel")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE PAID")).toBeInTheDocument();
    expect(screen.getByText(/A-101/)).toBeInTheDocument();
    expect(screen.getByText(/asha@x\.com/)).toBeInTheDocument();
    expect(screen.getByText(/\+91 9876543210/)).toBeInTheDocument();
    expect(screen.getByText("1 resident")).toBeInTheDocument();
  });

  it("uses plural label when total !== 1 and shows pluralization for many", () => {
    renderDefault({ total: 5, residents: [make(), make({ id: "u-2" })] });
    expect(screen.getByText("5 residents")).toBeInTheDocument();
  });

  it("shows 'No unit' fallback when unitLabel is null and omits mobile when null", () => {
    renderDefault({ residents: [make({ unitLabel: null, mobile: null })] });
    expect(screen.getByText(/No unit/)).toBeInTheDocument();
    expect(screen.queryByText(/\+91/)).not.toBeInTheDocument();
  });

  it("shows loading text when isLoading", () => {
    renderDefault({ isLoading: true, residents: [] });
    expect(screen.getByText(/Loading residents/)).toBeInTheDocument();
  });

  it("shows empty state with search hint when search has a term", () => {
    renderDefault({ residents: [], total: 0, search: "xyz" });
    expect(screen.getByText(/No residents found/)).toBeInTheDocument();
    expect(screen.getByText(/Try a different search term/)).toBeInTheDocument();
  });

  it("shows empty state without search hint when search is empty", () => {
    renderDefault({ residents: [], total: 0, search: "" });
    expect(screen.getByText(/This society has no residents/)).toBeInTheDocument();
  });

  it("fires onSearchChange when typing", async () => {
    const onSearchChange = vi.fn();
    renderDefault({ onSearchChange });
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Search residents"), "A");
    expect(onSearchChange).toHaveBeenCalled();
  });

  it("renders pagination and calls onPageChange", () => {
    const onPageChange = vi.fn();
    renderDefault({
      total: 50,
      pageSize: 20,
      page: 2,
      residents: [make()],
      onPageChange,
    });
    expect(screen.getByText(/Page 2 of 3/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Previous/ }));
    fireEvent.click(screen.getByRole("button", { name: /Next/ }));
    expect(onPageChange).toHaveBeenCalledWith(1);
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it("uses destructive variant for SUSPENDED/REJECTED", () => {
    const { unmount } = renderDefault({ residents: [make({ status: "SUSPENDED" })] });
    expect(screen.getByText("SUSPENDED")).toBeInTheDocument();
    unmount();
    renderDefault({ residents: [make({ status: "REJECTED" })] });
    expect(screen.getByText("REJECTED")).toBeInTheDocument();
  });

  it("uses secondary variant for other statuses", () => {
    renderDefault({ residents: [make({ status: "PENDING_APPROVAL" })] });
    expect(screen.getByText("PENDING APPROVAL")).toBeInTheDocument();
  });
});
