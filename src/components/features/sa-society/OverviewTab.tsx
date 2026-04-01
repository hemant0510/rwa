"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface OverviewTabProps {
  society: {
    name: string;
    status: string;
    societyCode: string;
    city?: string;
    state?: string;
    type?: string;
    totalResidents?: number;
    totalUnits?: number;
    createdAt: string;
  };
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  TRIAL: "bg-blue-100 text-blue-700",
  SUSPENDED: "bg-red-100 text-red-700",
  OFFBOARDED: "bg-gray-100 text-gray-700",
};

export function OverviewTab({ society }: OverviewTabProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Society Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{society.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Code</span>
            <span className="font-mono">{society.societyCode}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <Badge
              variant="outline"
              className={`border-0 text-xs ${STATUS_COLORS[society.status] ?? ""}`}
            >
              {society.status}
            </Badge>
          </div>
          {society.city && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Location</span>
              <span>
                {society.city}
                {society.state ? `, ${society.state}` : ""}
              </span>
            </div>
          )}
          {society.type && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <span>{society.type.replace(/_/g, " ")}</span>
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Quick Stats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Residents</span>
            <span className="font-medium">{society.totalResidents ?? 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Units</span>
            <span className="font-medium">{society.totalUnits ?? 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Created</span>
            <span>{new Date(society.createdAt).toLocaleDateString("en-IN")}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
