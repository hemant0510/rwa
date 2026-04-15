import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import {
  ResidentConversationThread,
  timeAgo,
} from "@/components/features/resident-support/ResidentConversationThread";
import type { ResidentTicketMessageItem } from "@/types/resident-support";

const baseMsg: ResidentTicketMessageItem = {
  id: "m-1",
  ticketId: "t-1",
  authorId: "u-1",
  authorRole: "RESIDENT",
  content: "Hello there",
  isInternal: false,
  kind: null,
  counsellorId: null,
  createdAt: new Date().toISOString(),
  attachments: [],
  author: { name: "Jane Resident" },
};

describe("ResidentConversationThread", () => {
  it("shows 'No messages yet' when messages array is empty", () => {
    render(<ResidentConversationThread messages={[]} />);
    expect(screen.getByText("No messages yet")).toBeInTheDocument();
  });

  it("renders resident message with author name", () => {
    render(<ResidentConversationThread messages={[baseMsg]} />);
    expect(screen.getByText("Jane Resident")).toBeInTheDocument();
    expect(screen.getByText("Hello there")).toBeInTheDocument();
  });

  it("renders admin message with author name", () => {
    const adminMsg: ResidentTicketMessageItem = {
      ...baseMsg,
      id: "m-2",
      authorRole: "ADMIN",
      content: "We will look into it",
      author: { name: "Admin User" },
    };
    render(<ResidentConversationThread messages={[adminMsg]} />);
    expect(screen.getByText("Admin User")).toBeInTheDocument();
    expect(screen.getByText("We will look into it")).toBeInTheDocument();
  });

  it("hides internal messages when showInternal is false (default)", () => {
    const internalMsg: ResidentTicketMessageItem = {
      ...baseMsg,
      id: "m-3",
      isInternal: true,
      content: "Secret internal note",
    };
    render(<ResidentConversationThread messages={[internalMsg]} />);
    expect(screen.queryByText("Secret internal note")).not.toBeInTheDocument();
    expect(screen.getByText("No messages yet")).toBeInTheDocument();
  });

  it("shows internal messages when showInternal is true with 'Internal Note' label", () => {
    const internalMsg: ResidentTicketMessageItem = {
      ...baseMsg,
      id: "m-3",
      isInternal: true,
      content: "Secret internal note",
    };
    render(<ResidentConversationThread messages={[internalMsg]} showInternal={true} />);
    expect(screen.getByText("Secret internal note")).toBeInTheDocument();
    expect(screen.getByText("Internal Note")).toBeInTheDocument();
  });

  it("shows attachment links when message has attachments", () => {
    const msgWithAttachments: ResidentTicketMessageItem = {
      ...baseMsg,
      attachments: [
        {
          id: "a-1",
          ticketId: "t-1",
          messageId: "m-1",
          fileName: "photo.jpg",
          mimeType: "image/jpeg",
          fileSize: 1024,
          signedUrl: "https://example.com/photo.jpg",
          uploadedBy: "u-1",
          createdAt: new Date().toISOString(),
        },
      ],
    };
    render(<ResidentConversationThread messages={[msgWithAttachments]} />);
    const link = screen.getByText("photo.jpg").closest("a");
    expect(link).toHaveAttribute("href", "https://example.com/photo.jpg");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("shows Image icon for image MIME types", () => {
    const msgWithImage: ResidentTicketMessageItem = {
      ...baseMsg,
      attachments: [
        {
          id: "a-1",
          ticketId: "t-1",
          messageId: "m-1",
          fileName: "photo.png",
          mimeType: "image/png",
          fileSize: 2048,
          signedUrl: "https://example.com/photo.png",
          uploadedBy: "u-1",
          createdAt: new Date().toISOString(),
        },
      ],
    };
    render(<ResidentConversationThread messages={[msgWithImage]} />);
    // Lucide Image renders an svg with class containing h-3 w-3
    const attachmentLink = screen.getByText("photo.png").closest("a");
    expect(attachmentLink).toBeInTheDocument();
    const svgs = attachmentLink!.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThanOrEqual(1);
  });

  it("shows FileText icon for non-image MIME types (PDF)", () => {
    const msgWithPdf: ResidentTicketMessageItem = {
      ...baseMsg,
      attachments: [
        {
          id: "a-2",
          ticketId: "t-1",
          messageId: "m-1",
          fileName: "document.pdf",
          mimeType: "application/pdf",
          fileSize: 4096,
          signedUrl: "https://example.com/document.pdf",
          uploadedBy: "u-1",
          createdAt: new Date().toISOString(),
        },
      ],
    };
    render(<ResidentConversationThread messages={[msgWithPdf]} />);
    const attachmentLink = screen.getByText("document.pdf").closest("a");
    expect(attachmentLink).toBeInTheDocument();
    const svgs = attachmentLink!.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThanOrEqual(1);
  });

  it("renders counsellor ADVISORY_TO_ADMIN message with advisory label and counsellor name", () => {
    const advisoryMsg: ResidentTicketMessageItem = {
      ...baseMsg,
      id: "m-adv",
      authorRole: "COUNSELLOR",
      kind: "ADVISORY_TO_ADMIN",
      counsellorId: "c-1",
      content: "Suggest mediation",
      author: null,
      counsellor: { name: "Counsellor A" },
    };
    render(<ResidentConversationThread messages={[advisoryMsg]} showInternal={true} />);
    expect(screen.getByText("Counsellor Advisory")).toBeInTheDocument();
    expect(screen.getByText("Counsellor A")).toBeInTheDocument();
    expect(screen.getByText("Suggest mediation")).toBeInTheDocument();
  });

  it("renders counsellor PRIVATE_NOTE with private note label when showInternal is true", () => {
    const privateNote: ResidentTicketMessageItem = {
      ...baseMsg,
      id: "m-pn",
      authorRole: "COUNSELLOR",
      kind: "PRIVATE_NOTE",
      counsellorId: "c-1",
      isInternal: true,
      content: "Private thought",
      author: null,
      counsellor: { name: "Counsellor B" },
    };
    render(<ResidentConversationThread messages={[privateNote]} showInternal={true} />);
    expect(screen.getByText("Counsellor Private Note")).toBeInTheDocument();
    expect(screen.getByText("Counsellor B")).toBeInTheDocument();
    expect(screen.getByText("Private thought")).toBeInTheDocument();
  });

  it("falls back to 'Counsellor' when private note has no counsellor name", () => {
    const privateNote: ResidentTicketMessageItem = {
      ...baseMsg,
      id: "m-pn2",
      authorRole: "COUNSELLOR",
      kind: "PRIVATE_NOTE",
      counsellorId: "c-1",
      isInternal: true,
      content: "Anonymous thought",
      author: null,
      counsellor: null,
    };
    render(<ResidentConversationThread messages={[privateNote]} showInternal={true} />);
    expect(screen.getByText("Counsellor")).toBeInTheDocument();
  });

  it("falls back to 'Counsellor' when advisory has no counsellor name", () => {
    const advisory: ResidentTicketMessageItem = {
      ...baseMsg,
      id: "m-adv2",
      authorRole: "COUNSELLOR",
      kind: "ADVISORY_TO_ADMIN",
      counsellorId: "c-1",
      content: "Anonymous advisory",
      author: null,
      counsellor: null,
    };
    render(<ResidentConversationThread messages={[advisory]} showInternal={true} />);
    expect(screen.getByText("Counsellor")).toBeInTheDocument();
  });

  it("falls back to 'User' when regular message has no author name", () => {
    const noAuthor: ResidentTicketMessageItem = {
      ...baseMsg,
      id: "m-na",
      author: null,
      counsellor: null,
    };
    render(<ResidentConversationThread messages={[noAuthor]} />);
    expect(screen.getByText("User")).toBeInTheDocument();
  });

  it("renders both admin and resident messages with their names", () => {
    const adminMsg: ResidentTicketMessageItem = {
      ...baseMsg,
      id: "m-2",
      authorRole: "ADMIN",
      content: "Admin reply",
      author: { name: "Admin User" },
    };
    render(<ResidentConversationThread messages={[baseMsg, adminMsg]} />);
    expect(screen.getByText("Jane Resident")).toBeInTheDocument();
    expect(screen.getByText("Admin User")).toBeInTheDocument();
    expect(screen.getByText("Hello there")).toBeInTheDocument();
    expect(screen.getByText("Admin reply")).toBeInTheDocument();
  });
});

describe("timeAgo", () => {
  it("returns 'just now' for recent timestamps", () => {
    const now = new Date().toISOString();
    expect(timeAgo(now)).toBe("just now");
  });

  it("returns hours for same-day timestamps", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(twoHoursAgo)).toBe("2h ago");
  });

  it("returns days for older timestamps", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(threeDaysAgo)).toBe("3d ago");
  });

  it("returns '1h ago' for exactly 1 hour", () => {
    const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(oneHourAgo)).toBe("1h ago");
  });

  it("returns '1d ago' for 24-47 hours ago", () => {
    const oneDayAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    expect(timeAgo(oneDayAgo)).toBe("1d ago");
  });
});
