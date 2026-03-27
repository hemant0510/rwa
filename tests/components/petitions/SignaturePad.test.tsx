import React from "react";

import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock react-signature-canvas
const mockClear = vi.fn();
const mockIsEmpty = vi.fn();
const mockGetTrimmedCanvas = vi.fn();
const onBeginRef = { current: undefined as (() => void) | undefined };

vi.mock("react-signature-canvas", () => ({
  default: React.forwardRef(function MockSignatureCanvas(
    props: { onBegin?: () => void; canvasProps?: Record<string, unknown> },
    ref: React.Ref<unknown>,
  ) {
    // Store callback in a ref-like object (not a reassignment during render)
    React.useEffect(() => {
      onBeginRef.current = props.onBegin;
    }, [props.onBegin]);
    React.useImperativeHandle(ref, () => ({
      clear: mockClear,
      isEmpty: mockIsEmpty,
      getTrimmedCanvas: mockGetTrimmedCanvas,
    }));
    return <canvas data-testid="signature-canvas" {...(props.canvasProps ?? {})} />;
  }),
}));

import { SignaturePad } from "@/components/features/petitions/SignaturePad";

describe("SignaturePad", () => {
  const mockOnSignature = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    onBeginRef.current = undefined;
    mockIsEmpty.mockReturnValue(false);
    mockGetTrimmedCanvas.mockReturnValue({
      toDataURL: vi.fn(() => "data:image/png;base64,abc123"),
    });
  });

  it("renders canvas and buttons", () => {
    render(<SignaturePad onSignature={mockOnSignature} />);
    expect(screen.getByTestId("signature-canvas")).toBeInTheDocument();
    expect(screen.getByText("Clear")).toBeInTheDocument();
    expect(screen.getByText("Confirm Signature")).toBeInTheDocument();
  });

  it("Confirm button is disabled before drawing", () => {
    render(<SignaturePad onSignature={mockOnSignature} />);
    expect(screen.getByText("Confirm Signature")).toBeDisabled();
  });

  it("Confirm button enables after drawing starts", () => {
    render(<SignaturePad onSignature={mockOnSignature} />);
    act(() => {
      onBeginRef.current?.();
    });
    expect(screen.getByText("Confirm Signature")).toBeEnabled();
  });

  it("calls onSignature with data URL on confirm", () => {
    render(<SignaturePad onSignature={mockOnSignature} />);
    act(() => {
      onBeginRef.current?.();
    });
    fireEvent.click(screen.getByText("Confirm Signature"));
    expect(mockGetTrimmedCanvas).toHaveBeenCalled();
    expect(mockOnSignature).toHaveBeenCalledWith("data:image/png;base64,abc123");
  });

  it("does not call onSignature if canvas is empty", () => {
    mockIsEmpty.mockReturnValue(true);
    render(<SignaturePad onSignature={mockOnSignature} />);
    act(() => {
      onBeginRef.current?.();
    });
    fireEvent.click(screen.getByText("Confirm Signature"));
    expect(mockOnSignature).not.toHaveBeenCalled();
  });

  it("clears canvas and disables confirm on Clear click", () => {
    render(<SignaturePad onSignature={mockOnSignature} />);
    act(() => {
      onBeginRef.current?.();
    });
    fireEvent.click(screen.getByText("Clear"));
    expect(mockClear).toHaveBeenCalled();
    expect(screen.getByText("Confirm Signature")).toBeDisabled();
  });

  it("disables buttons when disabled prop is true", () => {
    render(<SignaturePad onSignature={mockOnSignature} disabled />);
    expect(screen.getByText("Clear")).toBeDisabled();
    expect(screen.getByText("Confirm Signature")).toBeDisabled();
  });
});
