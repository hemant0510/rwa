import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import {
  TicketAttachments,
  formatFileSize,
} from "@/components/features/resident-support/TicketAttachments";
import type { AttachmentItem } from "@/types/resident-support";

const baseAttachment: AttachmentItem = {
  id: "a-1",
  ticketId: "t-1",
  messageId: "m-1",
  fileName: "photo.jpg",
  mimeType: "image/jpeg",
  fileSize: 1024,
  signedUrl: "https://example.com/photo.jpg",
  uploadedBy: "u-1",
  createdAt: new Date().toISOString(),
};

const pdfAttachment: AttachmentItem = {
  ...baseAttachment,
  id: "a-2",
  fileName: "document.pdf",
  mimeType: "application/pdf",
  fileSize: 2048000,
  signedUrl: "https://example.com/document.pdf",
};

describe("TicketAttachments", () => {
  const defaultProps = {
    attachments: [] as AttachmentItem[],
    canUpload: false,
    onUpload: vi.fn(),
  };

  it("shows 'No attachments' when empty", () => {
    render(<TicketAttachments {...defaultProps} />);
    expect(screen.getByText("No attachments")).toBeInTheDocument();
  });

  it("shows attachment count in header", () => {
    render(<TicketAttachments {...defaultProps} attachments={[baseAttachment, pdfAttachment]} />);
    expect(screen.getByText("Attachments (2)")).toBeInTheDocument();
  });

  it("shows zero count when no attachments", () => {
    render(<TicketAttachments {...defaultProps} />);
    expect(screen.getByText("Attachments (0)")).toBeInTheDocument();
  });

  it("lists attachments with file names", () => {
    render(<TicketAttachments {...defaultProps} attachments={[baseAttachment, pdfAttachment]} />);
    expect(screen.getByText("photo.jpg")).toBeInTheDocument();
    expect(screen.getByText("document.pdf")).toBeInTheDocument();
  });

  it("shows Image icon for image MIME types", () => {
    render(<TicketAttachments {...defaultProps} attachments={[baseAttachment]} />);
    const link = screen.getByText("photo.jpg").closest("a");
    expect(link).toBeInTheDocument();
    const svgs = link!.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThanOrEqual(1);
  });

  it("shows FileText icon for PDF", () => {
    render(<TicketAttachments {...defaultProps} attachments={[pdfAttachment]} />);
    const link = screen.getByText("document.pdf").closest("a");
    expect(link).toBeInTheDocument();
    const svgs = link!.querySelectorAll("svg");
    expect(svgs.length).toBeGreaterThanOrEqual(1);
  });

  it("renders attachment links with correct href", () => {
    render(<TicketAttachments {...defaultProps} attachments={[baseAttachment]} />);
    const link = screen.getByText("photo.jpg").closest("a");
    expect(link).toHaveAttribute("href", "https://example.com/photo.jpg");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("shows file size formatted correctly", () => {
    render(<TicketAttachments {...defaultProps} attachments={[baseAttachment, pdfAttachment]} />);
    expect(screen.getByText("1.0 KB")).toBeInTheDocument();
    expect(screen.getByText("2.0 MB")).toBeInTheDocument();
  });

  it("shows upload button when canUpload is true", () => {
    render(<TicketAttachments {...defaultProps} canUpload={true} />);
    expect(screen.getByRole("button", { name: /upload/i })).toBeInTheDocument();
  });

  it("hides upload button when canUpload is false", () => {
    render(<TicketAttachments {...defaultProps} canUpload={false} />);
    expect(screen.queryByRole("button", { name: /upload/i })).not.toBeInTheDocument();
  });

  it("shows 'Uploading...' when isUploading is true", () => {
    render(<TicketAttachments {...defaultProps} canUpload={true} isUploading={true} />);
    expect(screen.getByText("Uploading...")).toBeInTheDocument();
  });

  it("disables upload button when isUploading is true", () => {
    render(<TicketAttachments {...defaultProps} canUpload={true} isUploading={true} />);
    expect(screen.getByRole("button", { name: /uploading/i })).toBeDisabled();
  });

  it("calls onUpload when file is selected", () => {
    const onUpload = vi.fn();
    render(<TicketAttachments attachments={[]} canUpload={true} onUpload={onUpload} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(onUpload).toHaveBeenCalledWith(file);
  });

  it("does not call onUpload when no file is selected", () => {
    const onUpload = vi.fn();
    render(<TicketAttachments attachments={[]} canUpload={true} onUpload={onUpload} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });
    expect(onUpload).not.toHaveBeenCalled();
  });

  it("hides file input element", () => {
    render(<TicketAttachments {...defaultProps} canUpload={true} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toHaveClass("hidden");
  });

  it("clicks hidden file input when upload button is clicked", () => {
    render(<TicketAttachments attachments={[]} canUpload={true} onUpload={vi.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const clickSpy = vi.spyOn(input, "click");
    const uploadBtn = screen.getByRole("button", { name: /upload/i });
    fireEvent.click(uploadBtn);
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });
});

describe("formatFileSize", () => {
  it("returns bytes for small files", () => {
    expect(formatFileSize(500)).toBe("500 B");
  });

  it("returns bytes for 0", () => {
    expect(formatFileSize(0)).toBe("0 B");
  });

  it("returns KB for medium files", () => {
    expect(formatFileSize(1024)).toBe("1.0 KB");
    expect(formatFileSize(5120)).toBe("5.0 KB");
  });

  it("returns MB for large files", () => {
    expect(formatFileSize(1048576)).toBe("1.0 MB");
    expect(formatFileSize(2621440)).toBe("2.5 MB");
  });

  it("returns KB with decimal for non-round values", () => {
    expect(formatFileSize(1536)).toBe("1.5 KB");
  });
});
