"use client";

import { User, Phone, Mail, Home, Shield, LogOut } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

// TODO: Fetch from auth context
const PROFILE = {
  name: "Resident User",
  mobile: "9876543210",
  email: "resident@example.com",
  rwaid: "RWA-HR-GUR-122001-001-2025-001",
  society: "Eden Estate RWA",
  unit: "S22-St7-H245",
  ownershipType: "OWNER",
  status: "ACTIVE_PAID",
  registeredAt: "2025-04-01",
  approvedAt: "2025-04-02",
};

export default function ResidentProfilePage() {
  const { signOut } = useAuth();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Profile</h1>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="bg-primary/10 flex h-16 w-16 items-center justify-center rounded-full">
              <User className="text-primary h-8 w-8" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{PROFILE.name}</h2>
              <p className="text-muted-foreground font-mono text-sm">{PROFILE.rwaid}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Phone className="text-muted-foreground h-4 w-4" />
              <span className="text-sm">+91 {PROFILE.mobile}</span>
            </div>
            {PROFILE.email && (
              <div className="flex items-center gap-3">
                <Mail className="text-muted-foreground h-4 w-4" />
                <span className="text-sm">{PROFILE.email}</span>
              </div>
            )}
            <div className="flex items-center gap-3">
              <Home className="text-muted-foreground h-4 w-4" />
              <span className="text-sm">
                {PROFILE.unit} &mdash; {PROFILE.society}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Shield className="text-muted-foreground h-4 w-4" />
              <span className="text-sm">{PROFILE.ownershipType}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Status</span>
            <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
              Active
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">WhatsApp Consent</span>
            <Badge variant="outline">Enabled</Badge>
          </div>
        </CardContent>
      </Card>

      <Button variant="outline" className="text-destructive w-full" onClick={signOut}>
        <LogOut className="mr-2 h-4 w-4" />
        Sign Out
      </Button>
    </div>
  );
}
