import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { AuditLogTable, formatAction, formatDate } from "@/components/features/audit/AuditLogTable";

describe("AuditLogTable", () => {
  it("shows loading skeletons", () => {
    const { container } = render(<AuditLogTable logs={[]} isLoading={true} />);
    expect(container.querySelectorAll("[class*='animate-pulse']").length).toBeGreaterThanOrEqual(1);
  });

  it("shows empty message when no logs", () => {
    render(<AuditLogTable logs={[]} isLoading={false} />);
    expect(screen.getByText("No audit logs found")).toBeInTheDocument();
  });

  it("renders log entries", () => {
    const logs = [
      {
        id: "1",
        actionType: "SOCIETY_CREATED",
        entityType: "SOCIETY",
        entityId: "s-1",
        performedBy: "sa-1",
        performedByName: "Super Admin",
        details: "Created new society",
        createdAt: "2026-03-01T10:00:00Z",
      },
    ];
    render(<AuditLogTable logs={logs} isLoading={false} />);
    expect(screen.getByText("Society created")).toBeInTheDocument();
    expect(screen.getByText("Super Admin")).toBeInTheDocument();
    expect(screen.getByText("Created new society")).toBeInTheDocument();
  });

  it("renders null details as dash", () => {
    const logs = [
      {
        id: "1",
        actionType: "TEST",
        entityType: "ENTITY",
        entityId: null,
        performedBy: "sa-1",
        details: null,
        createdAt: "2026-03-01T10:00:00Z",
      },
    ];
    render(<AuditLogTable logs={logs} isLoading={false} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("falls back to performedBy when performedByName missing", () => {
    const logs = [
      {
        id: "1",
        actionType: "TEST",
        entityType: "ENTITY",
        entityId: null,
        performedBy: "sa-id-123",
        details: null,
        createdAt: "2026-03-01T10:00:00Z",
      },
    ];
    render(<AuditLogTable logs={logs} isLoading={false} />);
    expect(screen.getByText("sa-id-123")).toBeInTheDocument();
  });

  it("renders the title", () => {
    render(<AuditLogTable logs={[]} isLoading={false} />);
    expect(screen.getByText("Audit Logs")).toBeInTheDocument();
  });
});

describe("formatAction", () => {
  it("converts underscore actions to readable text", () => {
    expect(formatAction("SOCIETY_CREATED")).toBe("Society created");
    expect(formatAction("RESIDENT_APPROVED")).toBe("Resident approved");
  });
});

describe("formatDate", () => {
  it("formats date string", () => {
    const result = formatDate("2026-03-15T10:30:00Z");
    expect(result).toContain("15");
  });
});
