import React from "react";

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCompressImage = vi.hoisted(() => vi.fn());

vi.mock("@/lib/utils/compress-image", () => ({
  compressImage: mockCompressImage,
}));

import { SignatureUpload } from "@/components/features/petitions/SignatureUpload";

function createFile(name: string, type: string, sizeBytes = 1024): File {
  const content = new Uint8Array(sizeBytes).fill(0);
  return new File([content], name, { type });
}

describe("SignatureUpload", () => {
  const mockOnSignature = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // By default, compressImage returns the file unchanged
    mockCompressImage.mockImplementation((file: File) => Promise.resolve(file));
  });

  it("renders upload area", () => {
    render(<SignatureUpload onSignature={mockOnSignature} />);
    expect(screen.getByText("Upload signature image (PNG/JPG)")).toBeInTheDocument();
  });

  it("shows error for invalid file type", async () => {
    render(<SignatureUpload onSignature={mockOnSignature} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [createFile("test.gif", "image/gif")] } });
    await waitFor(() => {
      expect(screen.getByText("Only PNG and JPG images are allowed")).toBeInTheDocument();
    });
  });

  it("shows error for oversized file", async () => {
    render(<SignatureUpload onSignature={mockOnSignature} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const bigFile = createFile("big.png", "image/png", 3 * 1024 * 1024);
    fireEvent.change(input, { target: { files: [bigFile] } });
    await waitFor(() => {
      expect(screen.getByText("Image must be under 2MB")).toBeInTheDocument();
    });
  });

  it("shows preview and confirm button for valid file", async () => {
    // Mock FileReader
    const mockDataUrl = "data:image/png;base64,abc123";
    const originalFileReader = globalThis.FileReader;

    class MockFileReader {
      result: string | null = null;
      onload: (() => void) | null = null;
      readAsDataURL() {
        this.result = mockDataUrl;
        this.onload?.();
      }
    }
    globalThis.FileReader = MockFileReader as unknown as typeof FileReader;

    render(<SignatureUpload onSignature={mockOnSignature} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [createFile("sig.png", "image/png")] } });

    await waitFor(() => {
      expect(screen.getByAltText("Signature preview")).toBeInTheDocument();
      expect(screen.getByText("Confirm Signature")).toBeInTheDocument();
    });

    globalThis.FileReader = originalFileReader;
  });

  it("calls onSignature with data URL on confirm", async () => {
    const mockDataUrl = "data:image/png;base64,abc123";
    const originalFileReader = globalThis.FileReader;

    class MockFileReader {
      result: string | null = null;
      onload: (() => void) | null = null;
      readAsDataURL() {
        this.result = mockDataUrl;
        this.onload?.();
      }
    }
    globalThis.FileReader = MockFileReader as unknown as typeof FileReader;

    render(<SignatureUpload onSignature={mockOnSignature} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [createFile("sig.png", "image/png")] } });

    await waitFor(() => {
      expect(screen.getByText("Confirm Signature")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Confirm Signature"));
    expect(mockOnSignature).toHaveBeenCalledWith(mockDataUrl);

    globalThis.FileReader = originalFileReader;
  });

  it("clears preview when X button is clicked", async () => {
    const mockDataUrl = "data:image/png;base64,abc123";
    const originalFileReader = globalThis.FileReader;

    class MockFileReader {
      result: string | null = null;
      onload: (() => void) | null = null;
      readAsDataURL() {
        this.result = mockDataUrl;
        this.onload?.();
      }
    }
    globalThis.FileReader = MockFileReader as unknown as typeof FileReader;

    render(<SignatureUpload onSignature={mockOnSignature} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [createFile("sig.png", "image/png")] } });

    await waitFor(() => {
      expect(screen.getByAltText("Signature preview")).toBeInTheDocument();
    });

    // Click the X button to clear
    const clearButton = screen
      .getByAltText("Signature preview")
      .parentElement?.querySelector("button");
    expect(clearButton).toBeTruthy();
    fireEvent.click(clearButton!);

    await waitFor(() => {
      expect(screen.queryByAltText("Signature preview")).not.toBeInTheDocument();
      expect(screen.getByText("Upload signature image (PNG/JPG)")).toBeInTheDocument();
    });

    globalThis.FileReader = originalFileReader;
  });

  it("does nothing when no file is selected", async () => {
    render(<SignatureUpload onSignature={mockOnSignature} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });
    // No error, no preview
    expect(screen.queryByAltText("Signature preview")).not.toBeInTheDocument();
    expect(screen.queryByText(/error/i)).not.toBeInTheDocument();
  });

  it("applies disabled styling when disabled prop is true", () => {
    render(<SignatureUpload onSignature={mockOnSignature} disabled />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input).toBeDisabled();
  });

  it("calls compressImage on valid file", async () => {
    const mockDataUrl = "data:image/png;base64,abc123";
    const originalFileReader = globalThis.FileReader;

    class MockFileReader {
      result: string | null = null;
      onload: (() => void) | null = null;
      readAsDataURL() {
        this.result = mockDataUrl;
        this.onload?.();
      }
    }
    globalThis.FileReader = MockFileReader as unknown as typeof FileReader;

    render(<SignatureUpload onSignature={mockOnSignature} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = createFile("sig.jpg", "image/jpeg");
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockCompressImage).toHaveBeenCalledWith(file);
    });

    globalThis.FileReader = originalFileReader;
  });
});
