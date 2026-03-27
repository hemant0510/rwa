"use client";

import { useRef, useState } from "react";

import SignatureCanvas from "react-signature-canvas";

import { Button } from "@/components/ui/button";

interface SignaturePadProps {
  onSignature: (dataUrl: string) => void;
  disabled?: boolean;
}

export function SignaturePad({ onSignature, disabled = false }: SignaturePadProps) {
  const canvasRef = useRef<SignatureCanvas | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);

  function handleClear() {
    canvasRef.current?.clear();
    setHasDrawn(false);
  }

  function handleConfirm() {
    if (!canvasRef.current) return;

    if (canvasRef.current.isEmpty()) {
      return; // Prevent blank signature submission
    }

    const dataUrl = canvasRef.current.getTrimmedCanvas().toDataURL("image/png");
    onSignature(dataUrl);
  }

  return (
    <div className="space-y-3">
      <div className="rounded-md border border-gray-300 bg-white">
        <SignatureCanvas
          ref={canvasRef}
          canvasProps={{
            className: "w-full",
            height: 200,
            style: { width: "100%", height: 200 },
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
