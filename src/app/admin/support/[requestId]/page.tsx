"use client";

import { use } from "react";

import { useQuery } from "@tanstack/react-query";

import { ConversationThread } from "@/components/features/support/ConversationThread";
import { PriorityBadge } from "@/components/features/support/PriorityBadge";
import { SupportStatusBadge } from "@/components/features/support/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { getAdminRequestDetail } from "@/services/support";

export default function AdminSupportDetailPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = use(params);

  const { data: request, isLoading } = useQuery({
    queryKey: ["admin-support-detail", requestId],
    queryFn: () => getAdminRequestDetail(requestId),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!request) {
    return <p className="text-muted-foreground py-8 text-center">Request not found</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader title={`#${request.requestNumber} — ${request.subject}`}>
        <div className="flex gap-2">
          <PriorityBadge priority={request.priority} />
          <SupportStatusBadge status={request.status} />
        </div>
      </PageHeader>

      <Card>
        <CardContent className="pt-6">
          <p className="text-sm">{request.description}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conversation</CardTitle>
        </CardHeader>
        <CardContent>
          <ConversationThread messages={request.messages} />
        </CardContent>
      </Card>
    </div>
  );
}
