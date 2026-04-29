import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import {
  SearchResults,
  type SearchResultsData,
} from "@/components/features/sa-search/SearchResults";

// Mock next/link to render a plain anchor
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    onClick,
    ...props
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <a href={href} onClick={onClick} {...props}>
      {children}
    </a>
  ),
}));

const EMPTY_RESULTS: SearchResultsData = {
  societies: [],
  residents: [],
  payments: [],
  events: [],
  petitions: [],
};

function makeResults(overrides: Partial<SearchResultsData> = {}): SearchResultsData {
  return { ...EMPTY_RESULTS, ...overrides };
}

describe("SearchResults", () => {
  it("shows 'No results found' when all categories are empty", () => {
    render(<SearchResults results={EMPTY_RESULTS} onSelect={vi.fn()} />);
    expect(screen.getByText("No results found")).toBeInTheDocument();
  });

  describe("societies", () => {
    const results = makeResults({
      societies: [
        {
          id: "soc-1",
          name: "Greenwood Residency",
          societyCode: "GRNW01",
          status: "ACTIVE",
          city: "Gurgaon",
        },
      ],
    });

    it("renders society results with name and code", () => {
      render(<SearchResults results={results} onSelect={vi.fn()} />);
      expect(screen.getByText("Greenwood Residency")).toBeInTheDocument();
      expect(screen.getByText(/GRNW01/)).toBeInTheDocument();
    });

    it("renders society status badge", () => {
      render(<SearchResults results={results} onSelect={vi.fn()} />);
      expect(screen.getByText("ACTIVE")).toBeInTheDocument();
    });

    it("links to society detail page", () => {
      render(<SearchResults results={results} onSelect={vi.fn()} />);
      const link = screen.getByText("Greenwood Residency").closest("a");
      expect(link).toHaveAttribute("href", "/sa/societies/soc-1");
    });

    it("shows city in secondary text", () => {
      render(<SearchResults results={results} onSelect={vi.fn()} />);
      expect(screen.getByText(/Gurgaon/)).toBeInTheDocument();
    });

    it("handles null city", () => {
      const noCity = makeResults({
        societies: [
          { id: "soc-2", name: "Test Society", societyCode: "TST01", status: "TRIAL", city: null },
        ],
      });
      render(<SearchResults results={noCity} onSelect={vi.fn()} />);
      expect(screen.getByText("TST01")).toBeInTheDocument();
    });
  });

  describe("residents", () => {
    const results = makeResults({
      residents: [
        {
          id: "u-1",
          name: "John Doe",
          email: "john@test.com",
          status: "ACTIVE",
          societyId: "soc-1",
          society: { name: "Greenwood Residency" },
        },
      ],
    });

    it("renders resident name and society", () => {
      render(<SearchResults results={results} onSelect={vi.fn()} />);
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("Greenwood Residency")).toBeInTheDocument();
    });

    it("links to society detail page", () => {
      render(<SearchResults results={results} onSelect={vi.fn()} />);
      const link = screen.getByText("John Doe").closest("a");
      expect(link).toHaveAttribute("href", "/sa/societies/soc-1");
    });

    it("falls back to /sa/residents when societyId is null", () => {
      const noSociety = makeResults({
        residents: [
          {
            id: "u-2",
            name: "Orphan User",
            email: "orphan@test.com",
            status: "PENDING",
            societyId: null,
            society: null,
          },
        ],
      });
      render(<SearchResults results={noSociety} onSelect={vi.fn()} />);
      const link = screen.getByText("Orphan User").closest("a");
      expect(link).toHaveAttribute("href", "/sa/residents");
    });

    it("shows email when society is null", () => {
      const noSociety = makeResults({
        residents: [
          {
            id: "u-2",
            name: "Orphan User",
            email: "orphan@test.com",
            status: "PENDING",
            societyId: null,
            society: null,
          },
        ],
      });
      render(<SearchResults results={noSociety} onSelect={vi.fn()} />);
      expect(screen.getByText("orphan@test.com")).toBeInTheDocument();
    });
  });

  describe("payments", () => {
    const results = makeResults({
      payments: [
        {
          id: "pay-1",
          amount: 5000,
          receiptNo: "REC-001",
          referenceNo: "REF-123",
          paymentDate: "2026-03-15",
          societyId: "soc-1",
          user: { name: "John Doe" },
          society: { name: "Greenwood Residency" },
        },
      ],
    });

    it("renders payment amount and receipt number", () => {
      render(<SearchResults results={results} onSelect={vi.fn()} />);
      expect(screen.getByText(/REC-001/)).toBeInTheDocument();
      expect(screen.getByText(/5,000/)).toBeInTheDocument();
    });

    it("renders resident name and society in secondary text", () => {
      render(<SearchResults results={results} onSelect={vi.fn()} />);
      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      expect(screen.getByText(/Greenwood Residency/)).toBeInTheDocument();
    });

    it("links to society page", () => {
      render(<SearchResults results={results} onSelect={vi.fn()} />);
      const link = screen.getByText(/REC-001/).closest("a");
      expect(link).toHaveAttribute("href", "/sa/societies/soc-1");
    });
  });

  describe("events", () => {
    const results = makeResults({
      events: [
        {
          id: "ev-1",
          title: "Holi Celebration",
          status: "PUBLISHED",
          societyId: "soc-1",
          society: { name: "Greenwood Residency" },
        },
      ],
    });

    it("renders event title and society", () => {
      render(<SearchResults results={results} onSelect={vi.fn()} />);
      expect(screen.getByText("Holi Celebration")).toBeInTheDocument();
      expect(screen.getByText("Greenwood Residency")).toBeInTheDocument();
    });

    it("renders event status badge", () => {
      render(<SearchResults results={results} onSelect={vi.fn()} />);
      expect(screen.getByText("PUBLISHED")).toBeInTheDocument();
    });
  });

  describe("petitions", () => {
    const results = makeResults({
      petitions: [
        {
          id: "pet-1",
          title: "Speed breaker needed",
          status: "PUBLISHED",
          societyId: "soc-1",
          society: { name: "Greenwood Residency" },
        },
      ],
    });

    it("renders petition title and society", () => {
      render(<SearchResults results={results} onSelect={vi.fn()} />);
      expect(screen.getByText("Speed breaker needed")).toBeInTheDocument();
      expect(screen.getByText("Greenwood Residency")).toBeInTheDocument();
    });
  });

  describe("interaction", () => {
    it("calls onSelect when a result is clicked", async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const results = makeResults({
        societies: [
          {
            id: "soc-1",
            name: "Greenwood Residency",
            societyCode: "GRNW01",
            status: "ACTIVE",
            city: "Gurgaon",
          },
        ],
      });

      render(<SearchResults results={results} onSelect={onSelect} />);
      await user.click(screen.getByText("Greenwood Residency"));
      expect(onSelect).toHaveBeenCalledTimes(1);
    });
  });

  describe("category headers", () => {
    it("renders category headers for populated groups", () => {
      const results = makeResults({
        societies: [
          { id: "soc-1", name: "Test", societyCode: "T01", status: "ACTIVE", city: null },
        ],
        events: [
          {
            id: "ev-1",
            title: "Event",
            status: "PUBLISHED",
            societyId: "soc-1",
            society: { name: "Test" },
          },
        ],
      });

      render(<SearchResults results={results} onSelect={vi.fn()} />);
      expect(screen.getByText("Societies")).toBeInTheDocument();
      expect(screen.getByText("Events")).toBeInTheDocument();
      // Empty categories should not render headers
      expect(screen.queryByText("Residents")).not.toBeInTheDocument();
      expect(screen.queryByText("Payments")).not.toBeInTheDocument();
      expect(screen.queryByText("Petitions")).not.toBeInTheDocument();
    });
  });

  describe("unknown status colors", () => {
    it("renders unknown status without color class", () => {
      const results = makeResults({
        societies: [
          { id: "soc-1", name: "Test", societyCode: "T01", status: "UNKNOWN_STATUS", city: null },
        ],
      });
      render(<SearchResults results={results} onSelect={vi.fn()} />);
      expect(screen.getByText("UNKNOWN_STATUS")).toBeInTheDocument();
    });
  });
});
