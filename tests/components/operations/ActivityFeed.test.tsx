import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { ActivityFeed, timeAgo } from "@/components/features/operations/ActivityFeed";
import type { ActivityItem } from "@/services/operations";

function makeActivity(overrides: Partial<ActivityItem> = {}): ActivityItem {
  return {
    type: "resident_approved",
    message: "Eden Estate approved 5 new residents",
    societyId: "soc-1",
    societyName: "Eden Estate",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    severity: "info",
    ...overrides,
  };
}

describe("ActivityFeed", () => {
  describe("loading state", () => {
    it("renders skeleton placeholders while loading", () => {
      const { container } = render(<ActivityFeed activities={[]} isLoading={true} />);
      const skeletons = container.querySelectorAll("[class*='animate-pulse']");
      expect(skeletons.length).toBeGreaterThanOrEqual(1);
    });

    it("does not render activity items when loading", () => {
      render(<ActivityFeed activities={[]} isLoading={true} />);
      expect(screen.queryByText("Eden Estate approved 5 new residents")).not.toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("shows empty message when no activities", () => {
      render(<ActivityFeed activities={[]} isLoading={false} />);
      expect(screen.getByText("No recent activity")).toBeInTheDocument();
    });
  });

  describe("with data", () => {
    it("renders activity messages", () => {
      const activities = [
        makeActivity({ message: "Eden Estate approved 5 new residents" }),
        makeActivity({
          message: "Green Valley created event: Holi Celebration",
          severity: "info",
        }),
      ];
      render(<ActivityFeed activities={activities} isLoading={false} />);
      expect(screen.getByText("Eden Estate approved 5 new residents")).toBeInTheDocument();
      expect(screen.getByText("Green Valley created event: Holi Celebration")).toBeInTheDocument();
    });

    it("shows relative timestamp for each activity", () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const activities = [makeActivity({ timestamp: twoHoursAgo })];
      render(<ActivityFeed activities={activities} isLoading={false} />);
      expect(screen.getByText("2h ago")).toBeInTheDocument();
    });

    it("renders info severity icon", () => {
      const { container } = render(
        <ActivityFeed activities={[makeActivity({ severity: "info" })]} isLoading={false} />,
      );
      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
      expect(icon?.classList.toString()).toContain("text-blue-500");
    });

    it("renders warning severity icon", () => {
      const { container } = render(
        <ActivityFeed activities={[makeActivity({ severity: "warning" })]} isLoading={false} />,
      );
      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
      expect(icon?.classList.toString()).toContain("text-yellow-500");
    });

    it("renders alert severity icon", () => {
      const { container } = render(
        <ActivityFeed activities={[makeActivity({ severity: "alert" })]} isLoading={false} />,
      );
      const icon = container.querySelector("svg");
      expect(icon).toBeInTheDocument();
      expect(icon?.classList.toString()).toContain("text-red-500");
    });

    it("renders multiple activities in order", () => {
      const activities = [
        makeActivity({ message: "First activity" }),
        makeActivity({ message: "Second activity" }),
        makeActivity({ message: "Third activity" }),
      ];
      render(<ActivityFeed activities={activities} isLoading={false} />);
      expect(screen.getByText("First activity")).toBeInTheDocument();
      expect(screen.getByText("Second activity")).toBeInTheDocument();
      expect(screen.getByText("Third activity")).toBeInTheDocument();
    });

    it("renders the card title", () => {
      render(<ActivityFeed activities={[]} isLoading={false} />);
      expect(screen.getByText("Recent Activity")).toBeInTheDocument();
    });

    it("shows 'just now' for very recent activity", () => {
      const justNow = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      render(
        <ActivityFeed activities={[makeActivity({ timestamp: justNow })]} isLoading={false} />,
      );
      expect(screen.getByText("just now")).toBeInTheDocument();
    });

    it("shows days ago for older activities", () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      render(
        <ActivityFeed activities={[makeActivity({ timestamp: threeDaysAgo })]} isLoading={false} />,
      );
      expect(screen.getByText("3d ago")).toBeInTheDocument();
    });
  });
});

describe("timeAgo", () => {
  it("returns 'just now' for timestamps less than 1 hour ago", () => {
    const recent = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    expect(timeAgo(recent)).toBe("just now");
  });

  it("returns hours ago for timestamps less than 24 hours", () => {
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(fiveHoursAgo)).toBe("5h ago");
  });

  it("returns days ago for timestamps 24+ hours", () => {
    const fourDaysAgo = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(fourDaysAgo)).toBe("4d ago");
  });
});
