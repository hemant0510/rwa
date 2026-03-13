"use client";

import Link from "next/link";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ExpiringSubscriptionsPanel({
  items,
}: {
  items: Array<{ societyId: string; societyName: string; currentPeriodEnd: string }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Expiring Soon
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">No subscriptions expiring in this range.</p>
        ) : (
          items.slice(0, 10).map((item) => (
            <div
              key={item.societyId}
              className="flex items-center justify-between rounded-md border p-3"
            >
              <div>
                <p className="text-sm font-medium">{item.societyName}</p>
                <p className="text-muted-foreground text-xs">
                  Ends on {new Date(item.currentPeriodEnd).toLocaleDateString()}
                </p>
              </div>
              <Link href={`/sa/societies/${item.societyId}/billing`}>
                <Button size="sm" variant="outline">
                  Review
                </Button>
              </Link>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
