"use client";

import { User } from "lucide-react";

import { InternalNote } from "@/components/features/support/InternalNote";
import type { MessageItem } from "@/services/support";

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface ConversationThreadProps {
  messages: MessageItem[];
  showInternal?: boolean;
}

export function ConversationThread({ messages, showInternal = false }: ConversationThreadProps) {
  const visible = showInternal ? messages : messages.filter((m) => !m.isInternal);

  if (visible.length === 0) {
    return <p className="text-muted-foreground py-4 text-center text-sm">No messages yet</p>;
  }

  return (
    <div className="space-y-3">
      {visible.map((msg) => {
        if (msg.isInternal) {
          return (
            <InternalNote key={msg.id} content={msg.content} timestamp={timeAgo(msg.createdAt)} />
          );
        }

        const isAdmin = msg.authorRole === "ADMIN";
        return (
          <div
            key={msg.id}
            className={`rounded-md border p-3 ${isAdmin ? "mr-8 ml-0" : "mr-0 ml-8 border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20"}`}
          >
            <div className="mb-1 flex items-center gap-2">
              <User className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">{isAdmin ? "Admin" : "Super Admin"}</span>
              <span className="text-muted-foreground text-xs">{timeAgo(msg.createdAt)}</span>
            </div>
            <p className="text-sm">{msg.content}</p>
          </div>
        );
      })}
    </div>
  );
}

export { timeAgo };
