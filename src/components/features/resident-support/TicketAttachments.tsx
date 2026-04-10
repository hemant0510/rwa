"use client";

import { useRef } from "react";

import { FileText, Image, Paperclip, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { AttachmentItem } from "@/types/resident-support";

const ALLOWED_TYPES = "image/jpeg,image/png,image/webp,application/pdf";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface TicketAttachmentsProps {
  attachments: AttachmentItem[];
  canUpload: boolean;
  onUpload: (file: File) => void;
  isUploading?: boolean;
}

export function TicketAttachments({
  attachments,
  canUpload,
  onUpload,
  isUploading = false,
}: TicketAttachmentsProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
      /* v8 ignore start */
      if (inputRef.current) inputRef.current.value = "";
      /* v8 ignore stop */
    }
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="flex items-center gap-1 text-sm font-medium">
          <Paperclip className="h-4 w-4" />
          Attachments ({attachments.length})
        </h4>
        {canUpload && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={isUploading}
            >
              <Upload className="mr-1 h-3.5 w-3.5" />
              {isUploading ? "Uploading..." : "Upload"}
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept={ALLOWED_TYPES}
              onChange={handleFileChange}
              className="hidden"
            />
          </>
        )}
      </div>

      {attachments.length === 0 ? (
        <p className="text-muted-foreground text-sm">No attachments</p>
      ) : (
        <div className="space-y-2">
          {attachments.map((att) => (
            <a
              key={att.id}
              href={att.signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 rounded-md border p-2 hover:bg-gray-50 dark:hover:bg-gray-900"
            >
              {att.mimeType.startsWith("image/") ? (
                <Image className="h-5 w-5 text-blue-500" />
              ) : (
                <FileText className="h-5 w-5 text-red-500" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{att.fileName}</p>
                <p className="text-muted-foreground text-xs">{formatFileSize(att.fileSize)}</p>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export { formatFileSize };
