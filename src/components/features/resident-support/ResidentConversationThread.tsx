"use client";

import { FileText, Image, User } from "lucide-react";

import type { ResidentTicketMessageItem } from "@/types/resident-support";

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface ResidentConversationThreadProps {
  messages: ResidentTicketMessageItem[];
  showInternal?: boolean;
}

export function ResidentConversationThread({
  messages,
  showInternal = false,
}: ResidentConversationThreadProps) {
  const visible = showInternal ? messages : messages.filter((m) => !m.isInternal);

  if (visible.length === 0) {
    return <p className="text-muted-foreground py-4 text-center text-sm">No messages yet</p>;
  }

  return (
    <div className="space-y-3">
      {visible.map((msg) => {
        if (msg.isInternal) {
          return (
            <div
              key={msg.id}
              className="rounded-md border border-dashed border-yellow-300 bg-yellow-50/50 p-3 dark:border-yellow-800 dark:bg-yellow-950/20"
            >
              <div className="mb-1 flex items-center gap-2">
                <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-400">
                  Internal Note
                </span>
                <span className="text-muted-foreground text-xs">{timeAgo(msg.createdAt)}</span>
              </div>
              <p className="text-sm">{msg.content}</p>
            </div>
          );
        }

        const isAdmin = msg.authorRole === "ADMIN";
        return (
          <div
            key={msg.id}
            className={`rounded-md border p-3 ${isAdmin ? "mr-8 ml-0 border-purple-200 bg-purple-50/50 dark:border-purple-900 dark:bg-purple-950/20" : "mr-0 ml-8 border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20"}`}
          >
            <div className="mb-1 flex items-center gap-2">
              <User className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">{msg.author.name}</span>
              <span className="text-muted-foreground text-xs">{timeAgo(msg.createdAt)}</span>
            </div>
            <p className="text-sm">{msg.content}</p>
            {msg.attachments.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {msg.attachments.map((att) => (
                  <a
                    key={att.id}
                    href={att.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs hover:bg-gray-50 dark:hover:bg-gray-900"
                  >
                    {att.mimeType.startsWith("image/") ? (
                      <Image className="h-3 w-3" />
                    ) : (
                      <FileText className="h-3 w-3" />
                    )}
                    {att.fileName}
                  </a>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export { timeAgo };
