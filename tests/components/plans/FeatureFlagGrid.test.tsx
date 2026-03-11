import React from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import { FeatureFlagGrid } from "@/components/features/plans/FeatureFlagGrid";
import type { PlanFeatures } from "@/types/plan";

const allEnabled: PlanFeatures = {
  resident_management: true,
  fee_collection: true,
  expense_tracking: true,
  basic_reports: true,
  advanced_reports: true,
  whatsapp: true,
  elections: true,
  ai_insights: true,
  api_access: true,
  multi_admin: true,
};

const allDisabled: PlanFeatures = {
  resident_management: false,
  fee_collection: false,
  expense_tracking: false,
  basic_reports: false,
  advanced_reports: false,
  whatsapp: false,
  elections: false,
  ai_insights: false,
  api_access: false,
  multi_admin: false,
};

const mixed: PlanFeatures = {
  resident_management: true,
  fee_collection: true,
  expense_tracking: true,
  basic_reports: true,
  advanced_reports: false,
  whatsapp: false,
  elections: false,
  ai_insights: false,
  api_access: false,
  multi_admin: false,
};

describe("FeatureFlagGrid", () => {
  describe("readonly mode", () => {
    it("renders all 10 feature labels", () => {
      render(<FeatureFlagGrid value={allEnabled} readonly />);
      expect(screen.getByText("Resident Management")).toBeInTheDocument();
      expect(screen.getByText("Fee Collection")).toBeInTheDocument();
      expect(screen.getByText("Expense Tracking")).toBeInTheDocument();
      expect(screen.getByText("Basic Reports")).toBeInTheDocument();
      expect(screen.getByText("Advanced Reports & Analytics")).toBeInTheDocument();
      expect(screen.getByText("WhatsApp Notifications")).toBeInTheDocument();
      expect(screen.getByText("Elections Module")).toBeInTheDocument();
      expect(screen.getByText("AI-Powered Insights")).toBeInTheDocument();
      expect(screen.getByText("API Access")).toBeInTheDocument();
      expect(screen.getByText("Multiple Admins")).toBeInTheDocument();
    });

    it("shows 'Included' for enabled features in readonly mode", () => {
      render(<FeatureFlagGrid value={allEnabled} readonly />);
      const included = screen.getAllByText("Included");
      expect(included).toHaveLength(10);
    });

    it("shows 'Not included' for disabled features in readonly mode", () => {
      render(<FeatureFlagGrid value={allDisabled} readonly />);
      const notIncluded = screen.getAllByText("Not included");
      expect(notIncluded).toHaveLength(10);
    });

    it("shows 'Included' and 'Not included' for mixed features", () => {
      render(<FeatureFlagGrid value={mixed} readonly />);
      expect(screen.getAllByText("Included")).toHaveLength(4);
      expect(screen.getAllByText("Not included")).toHaveLength(6);
    });

    it("does not render Switch controls in readonly mode", () => {
      render(<FeatureFlagGrid value={allEnabled} readonly />);
      expect(screen.queryByRole("switch")).toBeNull();
    });
  });

  describe("editable mode (with onChange)", () => {
    it("renders Switch controls when onChange is provided and not readonly", () => {
      const onChange = vi.fn();
      render(<FeatureFlagGrid value={allEnabled} onChange={onChange} />);
      const switches = screen.getAllByRole("switch");
      expect(switches).toHaveLength(10);
    });

    it("does not render Included/Not included badges when editable", () => {
      const onChange = vi.fn();
      render(<FeatureFlagGrid value={allEnabled} onChange={onChange} />);
      expect(screen.queryByText("Included")).toBeNull();
      expect(screen.queryByText("Not included")).toBeNull();
    });

    it("calls onChange with updated features when switch is toggled", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<FeatureFlagGrid value={mixed} onChange={onChange} />);

      // Toggle the first switch (resident_management: true → false)
      const switches = screen.getAllByRole("switch");
      await user.click(switches[0]);

      expect(onChange).toHaveBeenCalledWith(
        expect.objectContaining({ resident_management: false }),
      );
    });

    it("calls onChange with enabled=true when disabled feature is toggled on", async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<FeatureFlagGrid value={mixed} onChange={onChange} />);

      // Toggle the 5th switch (advanced_reports: false → true)
      const switches = screen.getAllByRole("switch");
      await user.click(switches[4]);

      expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ advanced_reports: true }));
    });

    it("does not render Switch when onChange is omitted (no-op readonly-like)", () => {
      render(<FeatureFlagGrid value={allEnabled} />);
      expect(screen.queryByRole("switch")).toBeNull();
    });
  });

  describe("class-based conditional rendering", () => {
    it("applies enabled styling for true features", () => {
      const { container } = render(<FeatureFlagGrid value={allEnabled} readonly />);
      // Enabled feature rows have border-primary/20 bg-primary/5 class
      const rows = container.querySelectorAll("[class*='border-primary']");
      expect(rows.length).toBeGreaterThan(0);
    });

    it("applies disabled styling for false features", () => {
      const { container } = render(<FeatureFlagGrid value={allDisabled} readonly />);
      // Disabled feature rows have border-border bg-muted/30 class
      const rows = container.querySelectorAll("[class*='bg-muted']");
      expect(rows.length).toBeGreaterThan(0);
    });
  });
});
