"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Mail, Phone, Shield, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useAuth } from "@/hooks/useAuth";
import { fetchCommitteeMembers } from "@/services/resident-directory";

export default function ResidentGoverningBodyPage() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["resident-governing-body"],
    queryFn: fetchCommitteeMembers,
    enabled: !!user,
  });

  const members = data?.members ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Governing Body</h1>
        <p className="text-muted-foreground text-sm">Committee members of your society</p>
      </div>

      {isLoading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
        </div>
      ) : members.length === 0 ? (
        <EmptyState
          icon={<Shield className="text-muted-foreground h-8 w-8" />}
          title="No committee members"
          description="The governing body has not been set up yet."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((member) => (
            <Card key={member.id}>
              <CardContent className="space-y-3 pt-4 pb-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Users className="text-primary h-5 w-5 shrink-0" />
                    <h3 className="text-sm leading-tight font-semibold">{member.name}</h3>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {member.designation}
                  </Badge>
                </div>

                <div className="text-muted-foreground space-y-1.5 text-xs">
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{member.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span>{member.mobile}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
