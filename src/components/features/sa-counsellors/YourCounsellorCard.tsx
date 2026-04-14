"use client";

import { useQuery } from "@tanstack/react-query";
import { Mail, Shield, ShieldOff } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMyCounsellor } from "@/services/counsellors";

export function YourCounsellorCard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-counsellor"],
    queryFn: getMyCounsellor,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your Counsellor</CardTitle>
          <CardDescription>Loading…</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your Counsellor</CardTitle>
          <CardDescription>Could not load — please refresh.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!data?.counsellor) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <ShieldOff className="text-muted-foreground h-5 w-5" />
            <div>
              <CardTitle className="text-base">Your Counsellor</CardTitle>
              <CardDescription>
                No counsellor is currently assigned to your society. Escalation channel is
                unavailable.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  const c = data.counsellor;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start gap-3">
          <Shield className="mt-0.5 h-5 w-5 text-emerald-600" />
          <div className="min-w-0 flex-1">
            <CardTitle className="text-base">Your Counsellor</CardTitle>
            <CardDescription>
              Platform-appointed advisor for your society — informational only.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center gap-3">
          <div className="bg-muted flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full">
            {c.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={c.photoUrl} alt={c.name} className="h-10 w-10 object-cover" />
            ) : (
              <span className="text-muted-foreground font-medium">
                {c.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium">{c.name}</p>
            <p className="text-muted-foreground flex items-center gap-1 truncate text-xs">
              <Mail className="h-3 w-3" />
              {c.email}
            </p>
          </div>
        </div>
        {c.publicBlurb && (
          <p className="text-muted-foreground border-t pt-2 text-xs">{c.publicBlurb}</p>
        )}
      </CardContent>
    </Card>
  );
}
