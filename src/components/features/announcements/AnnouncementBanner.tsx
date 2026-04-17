"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, X } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useSocietyId } from "@/hooks/useSocietyId";
import {
  getUnreadAnnouncements,
  markAnnouncementRead,
  type AdminAnnouncementItem,
} from "@/services/announcements";

export function AnnouncementBanner() {
  const { societyId } = useSocietyId();
  const queryClient = useQueryClient();

  const { data: announcements = [] } = useQuery({
    queryKey: ["admin-announcements-unread", societyId],
    queryFn: () => getUnreadAnnouncements(societyId),
    enabled: !!societyId,
  });

  const handleDismiss = async (id: string) => {
    try {
      await markAnnouncementRead(id);
      queryClient.setQueryData<AdminAnnouncementItem[]>(
        ["admin-announcements-unread", societyId],
        (old = []) => old.filter((a) => a.id !== id),
      );
    } catch {
      // Silently handle errors
    }
  };

  if (announcements.length === 0) return null;

  return (
    <div className="space-y-2">
      {announcements.map((a) => (
        <Alert key={a.id} variant={a.priority === "URGENT" ? "destructive" : "default"}>
          <Megaphone className="h-4 w-4" />
          <AlertTitle className="flex items-center justify-between">
            {a.subject}
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={() => handleDismiss(a.id)}
            >
              <X className="h-3.5 w-3.5" />
              <span className="sr-only">Dismiss</span>
            </Button>
          </AlertTitle>
          <AlertDescription className="line-clamp-2 text-sm">{a.body}</AlertDescription>
        </Alert>
      ))}
    </div>
  );
}
