"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckCheck, Megaphone } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { useSocietyId } from "@/hooks/useSocietyId";
import type { AdminAnnouncementItem } from "@/services/announcements";
import { getUnreadAnnouncements, markAnnouncementRead } from "@/services/announcements";

const PRIORITY_STYLES: Record<string, string> = {
  URGENT:
    "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400",
  NORMAL:
    "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-400",
};

function AnnouncementCard({
  item,
  onMarkRead,
  isMarkingRead,
}: {
  item: AdminAnnouncementItem;
  onMarkRead: (id: string) => void;
  isMarkingRead: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 transition-colors ${PRIORITY_STYLES[item.priority] ?? PRIORITY_STYLES.NORMAL}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold">{item.subject}</span>
            {item.priority === "URGENT" && (
              <Badge variant="outline" className="border-red-300 bg-red-100 text-xs text-red-700">
                URGENT
              </Badge>
            )}
          </div>
          <p className="text-sm leading-relaxed opacity-90">{item.body}</p>
          <p className="text-xs opacity-60">
            {format(new Date(item.createdAt), "dd MMM yyyy, hh:mm a")}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          onClick={() => onMarkRead(item.id)}
          disabled={isMarkingRead}
        >
          <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
          Mark Read
        </Button>
      </div>
    </div>
  );
}

export default function AdminAnnouncementsPage() {
  const { societyId } = useSocietyId();
  const queryClient = useQueryClient();

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["admin-announcements", societyId],
    queryFn: () => getUnreadAnnouncements(societyId),
    enabled: !!societyId,
  });

  const markReadMutation = useMutation({
    mutationFn: markAnnouncementRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
    },
  });

  const urgentItems = announcements.filter((a) => a.priority === "URGENT");
  const normalItems = announcements.filter((a) => a.priority !== "URGENT");

  return (
    <div className="space-y-6">
      <PageHeader title="Platform Announcements" description="Messages from the platform team">
        {announcements.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              announcements.forEach((a) => markReadMutation.mutate(a.id));
            }}
            disabled={markReadMutation.isPending}
          >
            <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
            Mark All Read
          </Button>
        )}
      </PageHeader>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : announcements.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16">
            <Megaphone className="text-muted-foreground h-12 w-12" />
            <p className="text-muted-foreground text-sm">No unread announcements</p>
            <p className="text-muted-foreground text-xs">
              All caught up! Check back later for updates from the platform team.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {urgentItems.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-red-700 dark:text-red-400">
                Urgent ({urgentItems.length})
              </h2>
              {urgentItems.map((item) => (
                <AnnouncementCard
                  key={item.id}
                  item={item}
                  onMarkRead={(id) => markReadMutation.mutate(id)}
                  isMarkingRead={markReadMutation.isPending}
                />
              ))}
            </div>
          )}

          {normalItems.length > 0 && (
            <div className="space-y-3">
              {urgentItems.length > 0 && (
                <h2 className="text-muted-foreground text-sm font-semibold">
                  General ({normalItems.length})
                </h2>
              )}
              {normalItems.map((item) => (
                <AnnouncementCard
                  key={item.id}
                  item={item}
                  onMarkRead={(id) => markReadMutation.mutate(id)}
                  isMarkingRead={markReadMutation.isPending}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
