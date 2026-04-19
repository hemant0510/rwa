import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import AuthErrorPage from "@/app/auth/auth-error/page";

describe("AuthErrorPage", () => {
  it("renders the expired-link heading and guidance", () => {
    render(<AuthErrorPage />);
    expect(screen.getByText("Link Expired or Already Used")).toBeInTheDocument();
    expect(screen.getByText(/Email links can only be used once/i)).toBeInTheDocument();
  });

  it("renders a home link", () => {
    render(<AuthErrorPage />);
    const link = screen.getByRole("link", { name: "Go to Home" });
    expect(link).toHaveAttribute("href", "/");
  });
});
