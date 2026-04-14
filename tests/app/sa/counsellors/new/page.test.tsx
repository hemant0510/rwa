import { describe, it, expect, vi } from "vitest";

vi.mock("@/components/features/sa-counsellors/CounsellorCreateForm", () => ({
  CounsellorCreateForm: () => <div data-testid="create-form" />,
}));

import { render, screen } from "@testing-library/react";

import NewCounsellorPage from "@/app/sa/counsellors/new/page";

describe("NewCounsellorPage", () => {
  it("renders page header, back link, and form", () => {
    render(<NewCounsellorPage />);
    expect(screen.getByText("New Counsellor")).toBeInTheDocument();
    expect(screen.getByText(/Back to counsellors/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Back to counsellors/ })).toHaveAttribute(
      "href",
      "/sa/counsellors",
    );
    expect(screen.getByTestId("create-form")).toBeInTheDocument();
  });
});
