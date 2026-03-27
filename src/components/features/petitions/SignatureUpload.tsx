"use client";

import { useRef, useState } from "react";

import { Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { compressImage } from "@/lib/utils/compress-image";

interface SignatureUploadProps {
  onSignature: (dataUrl: string) => void;
  disabled?: boolean;
}

const MAX_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_TYPES = ["image/png", "image/jpeg"];

export function SignatureUpload({ onSignature, disabled = false }: SignatureUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError("Only PNG and JPG images are allowed");
      return;
    }

    if (file.size > MAX_SIZE) {
      setError("Image must be under 2MB");
      return;
    }

    const compressed = await compressImage(file);

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
    };
    reader.readAsDataURL(compressed);
  }

  function handleClear() {
    setPreview(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleConfirm() {
    if (!preview) return;
    onSignature(preview);
  }

  return (
    <div className="space-y-3">
      {!preview ? (
        <label
          className={`flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-gray-300 p-6 transition hover:border-gray-400 ${disabled ? "pointer-events-none opacity-50" : ""}`}
        >
          <Upload className="mb-2 h-8 w-8 text-gray-400" />
          <span className="text-muted-foreground text-sm">Upload signature image (PNG/JPG)</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={handleFileChange}
            disabled={disabled}
          />
        </label>
      ) : (
        <div className="relative rounded-md border border-gray-300 bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Signature preview" className="mx-auto max-h-[200px]" />
          <button
            type="button"
            className="absolute top-1 right-1 rounded-full bg-gray-100 p-1 hover:bg-gray-200"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {preview && (
        <Button type="button" size="sm" onClick={handleConfirm} disabled={disabled}>
          Confirm Signature
        </Button>
      )}
    </div>
  );
}
