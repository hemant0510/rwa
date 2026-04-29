import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import {
  SocietyHealthTable,
  healthColor,
  healthBg,
  formatCurrency,
  timeAgo,
} from "@/components/features/operations/SocietyHealthTable";
import type { SocietyHealthItem } from "@/services/operations";

// Mock next/link to render a plain anchor
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function makeSociety(overrides: Partial<SocietyHealthItem> = {}): SocietyHealthItem {
  return {
    id: "soc-1",
    name: "Greenwood Residency",
    status: "ACTIVE",
    residents: 120,
    collectionRate: 85.5,
    balance: 250000,
    events30d: 3,
    petitions30d: 1,
    lastAdminLogin: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    healthScore: 82,
    ...overrides,
  };
}

describe("SocietyHealthTable", () => {
  describe("loading state", () => {
    it("renders skeleton placeholders while loading", () => {
      const { container } = render(<SocietyHealthTable societies={[]} isLoading={true} />);
      const skeletons = container.querySelectorAll("[class*='animate-pulse']");
      expect(skeletons.length).toBeGreaterThanOrEqual(1);
    });

    it("does not render table when loading", () => {
      render(<SocietyHealthTable societies={[]} isLoading={true} />);
      expect(screen.queryByRole("table")).not.toBeInTheDocument();
    });
  });

  describe("empty state", () => {
    it("shows empty message when no societies", () => {
      render(<SocietyHealthTable societies={[]} isLoading={false} />);
      expect(screen.getByText("No societies found")).toBeInTheDocument();
    });
  });

  describe("with data", () => {
    const societies = [
      makeSociety({ id: "soc-1", name: "Greenwood Residency", healthScore: 82 }),
      makeSociety({
        id: "soc-2",
        name: "Green Valley",
        status: "TRIAL",
        healthScore: 55,
        collectionRate: 60,
        balance: 1500,
        lastAdminLogin: null,
      }),
    ];

    it("renders a table with society rows", () => {
      render(<SocietyHealthTable societies={societies} isLoading={false} />);
      expect(screen.getByRole("table")).toBeInTheDocument();
      expect(screen.getByText("Greenwood Residency")).toBeInTheDocument();
      expect(screen.getByText("Green Valley")).toBeInTheDocument();
    });

    it("renders society name as a link to society detail page", () => {
      render(<SocietyHealthTable societies={societies} isLoading={false} />);
      const link = screen.getByText("Greenwood Residency").closest("a");
      expect(link).toHaveAttribute("href", "/sa/societies/soc-1");
    });

    it("displays status badges", () => {
      render(<SocietyHealthTable societies={societies} isLoading={false} />);
      expect(screen.getByText("ACTIVE")).toBeInTheDocument();
      expect(screen.getByText("TRIAL")).toBeInTheDocument();
    });

    it("displays resident count", () => {
      render(
        <SocietyHealthTable societies={[makeSociety({ residents: 120 })]} isLoading={false} />,
      );
      expect(screen.getByText("120")).toBeInTheDocument();
    });

    it("displays collection rate with percent symbol", () => {
      render(
        <SocietyHealthTable
          societies={[makeSociety({ collectionRate: 85.5 })]}
          isLoading={false}
        />,
      );
      expect(screen.getByText("85.5%")).toBeInTheDocument();
    });

    it("displays formatted balance", () => {
      render(
        <SocietyHealthTable societies={[makeSociety({ balance: 250000 })]} isLoading={false} />,
      );
      expect(screen.getByText("\u20B92.5L")).toBeInTheDocument();
    });

    it("displays events and petitions counts", () => {
      render(
        <SocietyHealthTable
          societies={[makeSociety({ events30d: 3, petitions30d: 1 })]}
          isLoading={false}
        />,
      );
      expect(screen.getByText("3")).toBeInTheDocument();
      expect(screen.getByText("1")).toBeInTheDocument();
    });

    it("displays health score badge", () => {
      render(
        <SocietyHealthTable societies={[makeSociety({ healthScore: 82 })]} isLoading={false} />,
      );
      expect(screen.getByText("82")).toBeInTheDocument();
    });

    it("shows 'Never' when lastAdminLogin is null", () => {
      render(
        <SocietyHealthTable
          societies={[makeSociety({ lastAdminLogin: null })]}
          isLoading={false}
        />,
      );
      expect(screen.getByText("Never")).toBeInTheDocument();
    });

    it("shows relative time when lastAdminLogin is provided", () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      render(
        <SocietyHealthTable
          societies={[makeSociety({ lastAdminLogin: twoHoursAgo })]}
          isLoading={false}
        />,
      );
      expect(screen.getByText("2h ago")).toBeInTheDocument();
    });

    it("renders SUSPENDED status color", () => {
      render(
        <SocietyHealthTable societies={[makeSociety({ status: "SUSPENDED" })]} isLoading={false} />,
      );
      expect(screen.getByText("SUSPENDED")).toBeInTheDocument();
    });

    it("renders unknown status without color class", () => {
      render(
        <SocietyHealthTable societies={[makeSociety({ status: "UNKNOWN" })]} isLoading={false} />,
      );
      expect(screen.getByText("UNKNOWN")).toBeInTheDocument();
    });

    it("renders the card title", () => {
      render(<SocietyHealthTable societies={[]} isLoading={false} />);
      expect(screen.getByText("Society Health")).toBeInTheDocument();
    });
  });
});

describe("healthColor", () => {
  it("returns green for score >= 80", () => {
    expect(healthColor(80)).toContain("green");
    expect(healthColor(100)).toContain("green");
  });

  it("returns yellow for score >= 50 and < 80", () => {
    expect(healthColor(50)).toContain("yellow");
    expect(healthColor(79)).toContain("yellow");
  });

  it("returns red for score < 50", () => {
    expect(healthColor(0)).toContain("red");
    expect(healthColor(49)).toContain("red");
  });
});

describe("healthBg", () => {
  it("returns green background for score >= 80", () => {
    expect(healthBg(80)).toContain("bg-green");
  });

  it("returns yellow background for score >= 50 and < 80", () => {
    expect(healthBg(50)).toContain("bg-yellow");
  });

  it("returns red background for score < 50", () => {
    expect(healthBg(49)).toContain("bg-red");
  });
});

describe("formatCurrency", () => {
  it("formats values >= 1L with L suffix", () => {
    expect(formatCurrency(100_000)).toBe("\u20B91.0L");
    expect(formatCurrency(250_000)).toBe("\u20B92.5L");
  });

  it("formats values >= 1K with K suffix", () => {
    expect(formatCurrency(1_000)).toBe("\u20B91.0K");
    expect(formatCurrency(50_000)).toBe("\u20B950.0K");
  });

  it("formats values < 1K with locale string", () => {
    expect(formatCurrency(500)).toBe("\u20B9500");
    expect(formatCurrency(0)).toBe("\u20B90");
  });
});

describe("timeAgo", () => {
  it("returns 'just now' for timestamps less than 1 hour ago", () => {
    const recent = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    expect(timeAgo(recent)).toBe("just now");
  });

  it("returns hours ago for timestamps less than 24 hours", () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(threeHoursAgo)).toBe("3h ago");
  });

  it("returns days ago for timestamps 24+ hours", () => {
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(twoDaysAgo)).toBe("2d ago");
  });
});
