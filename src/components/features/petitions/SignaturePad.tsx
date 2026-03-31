"use client";

import { useEffect, useRef, useState } from "react";

import SignatureCanvas from "react-signature-canvas";

import { Button } from "@/components/ui/button";

interface SignaturePadProps {
  onSignature: (dataUrl: string) => void;
  disabled?: boolean;
}

export function SignaturePad({ onSignature, disabled = false }: SignaturePadProps) {
  const canvasRef = useRef<SignatureCanvas | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(300);

  // Keep canvas internal pixel width in sync with its CSS width so touch/mouse
  // coordinates map correctly — prevents the "drawing appears offset" issue on
  // mobile and when the browser window is resized.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0].contentRect.width);
      if (w > 0) {
        setCanvasWidth(w);
        // Clear on resize to avoid distorted existing strokes
        canvasRef.current?.clear();
        setHasDrawn(false);
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function handleClear() {
    canvasRef.current?.clear();
    setHasDrawn(false);
  }

  function handleConfirm() {
    if (!canvasRef.current || canvasRef.current.isEmpty()) return;
    const dataUrl = canvasRef.current.getTrimmedCanvas().toDataURL("image/png");
    onSignature(dataUrl);
  }

  return (
    <div className="space-y-3">
      <div ref={containerRef} className="rounded-md border border-gray-300 bg-white">
        <SignatureCanvas
          ref={canvasRef}
          canvasProps={{
            width: canvasWidth,
            height: 200,
            style: { width: "100%", height: 200, display: "block" },
          }}
          onBegin={() => setHasDrawn(true)}
        />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={handleClear} disabled={disabled}>
          Clear
        </Button>
        <Button type="button" size="sm" onClick={handleConfirm} disabled={disabled || !hasDrawn}>
          Confirm Signature
        </Button>
      </div>
    </div>
  );
}
