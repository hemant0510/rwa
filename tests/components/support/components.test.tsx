import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { ConversationThread } from "@/components/features/support/ConversationThread";
import { InternalNote } from "@/components/features/support/InternalNote";
import { PriorityBadge } from "@/components/features/support/PriorityBadge";
import { SupportStatusBadge } from "@/components/features/support/StatusBadge";
import type { MessageItem } from "@/services/support";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}));

describe("SupportStatusBadge", () => {
  it("renders known status with label", () => {
    render(<SupportStatusBadge status="OPEN" />);
    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  it("renders IN_PROGRESS status", () => {
    render(<SupportStatusBadge status="IN_PROGRESS" />);
    expect(screen.getByText("In Progress")).toBeInTheDocument();
  });

  it("renders unknown status as-is", () => {
    render(<SupportStatusBadge status="CUSTOM" />);
    expect(screen.getByText("CUSTOM")).toBeInTheDocument();
  });

  it("renders all status types", () => {
    const statuses = ["OPEN", "IN_PROGRESS", "AWAITING_ADMIN", "AWAITING_SA", "RESOLVED", "CLOSED"];
    for (const status of statuses) {
      const { unmount } = render(<SupportStatusBadge status={status} />);
      unmount();
    }
  });
});

describe("PriorityBadge", () => {
  it("renders priority text", () => {
    render(<PriorityBadge priority="HIGH" />);
    expect(screen.getByText("HIGH")).toBeInTheDocument();
  });

  it("renders all priority levels", () => {
    for (const priority of ["LOW", "MEDIUM", "HIGH", "URGENT"]) {
      const { unmount } = render(<PriorityBadge priority={priority} />);
      expect(screen.getByText(priority)).toBeInTheDocument();
      unmount();
    }
  });

  it("renders unknown priority", () => {
    render(<PriorityBadge priority="CUSTOM" />);
    expect(screen.getByText("CUSTOM")).toBeInTheDocument();
  });
});

describe("InternalNote", () => {
  it("renders content and timestamp", () => {
    render(<InternalNote content="Investigation note" timestamp="2h ago" />);
    expect(screen.getByText("Investigation note")).toBeInTheDocument();
    expect(screen.getByText("2h ago")).toBeInTheDocument();
  });

  it("shows Internal Note label", () => {
    render(<InternalNote content="Test" timestamp="now" />);
    expect(screen.getByText("Internal Note")).toBeInTheDocument();
  });
});

describe("ConversationThread", () => {
  const makeMessage = (overrides: Partial<MessageItem> = {}): MessageItem => ({
    id: "msg-1",
    authorId: "u-1",
    authorRole: "ADMIN",
    content: "Hello",
    isInternal: false,
    attachments: [],
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  });

  it("shows empty message when no messages", () => {
    render(<ConversationThread messages={[]} />);
    expect(screen.getByText("No messages yet")).toBeInTheDocument();
  });

  it("renders admin messages", () => {
    render(<ConversationThread messages={[makeMessage({ content: "Admin msg" })]} />);
    expect(screen.getByText("Admin msg")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("renders SA messages", () => {
    render(
      <ConversationThread
        messages={[makeMessage({ authorRole: "SUPER_ADMIN", content: "SA reply" })]}
      />,
    );
    expect(screen.getByText("SA reply")).toBeInTheDocument();
    expect(screen.getByText("Super Admin")).toBeInTheDocument();
  });

  it("hides internal notes by default", () => {
    render(
      <ConversationThread
        messages={[
          makeMessage({ content: "Public msg" }),
          makeMessage({ id: "msg-2", isInternal: true, content: "Secret note" }),
        ]}
      />,
    );
    expect(screen.getByText("Public msg")).toBeInTheDocument();
    expect(screen.queryByText("Secret note")).not.toBeInTheDocument();
  });

  it("shows internal notes when showInternal is true", () => {
    render(
      <ConversationThread
        messages={[makeMessage({ id: "msg-2", isInternal: true, content: "Secret note" })]}
        showInternal
      />,
    );
    expect(screen.getByText("Secret note")).toBeInTheDocument();
    expect(screen.getByText("Internal Note")).toBeInTheDocument();
  });

  it("shows relative timestamps", () => {
    render(
      <ConversationThread
        messages={[
          makeMessage({
            createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
          }),
        ]}
      />,
    );
    expect(screen.getByText("3h ago")).toBeInTheDocument();
  });

  it("shows days ago for older messages", () => {
    render(
      <ConversationThread
        messages={[
          makeMessage({
            createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
          }),
        ]}
      />,
    );
    expect(screen.getByText("2d ago")).toBeInTheDocument();
  });

  it("shows 'just now' for recent messages", () => {
    render(
      <ConversationThread
        messages={[
          makeMessage({
            createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
          }),
        ]}
      />,
    );
    expect(screen.getByText("just now")).toBeInTheDocument();
  });
});
