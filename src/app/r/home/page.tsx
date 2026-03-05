"use client";

import Link from "next/link";

import { useQuery } from "@tanstack/react-query";
import { CreditCard, Receipt, IndianRupee, Clock, XCircle, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";

interface ResidentProfile {
  id: string;
  name: string;
  rwaid: string | null;
  status: string;
  unit: string | null;
  societyName: string | null;
  currentFee: {
    sessionYear: string;
    amountDue: number;
    amountPaid: number;
    status: string;
  } | null;
}

export default function ResidentHomePage() {
  const { user } = useAuth();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["resident", "me"],
    queryFn: async () => {
      const res = await fetch("/api/v1/residents/me");
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json() as Promise<ResidentProfile>;
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!profile) return null;

  // Pending approval state
  if (profile.status === "PENDING_APPROVAL") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Welcome, {profile.name}</h1>
          <p className="text-muted-foreground text-sm">{user?.societyName}</p>
        </div>
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="flex items-start gap-3 pt-6">
            <Clock className="mt-0.5 h-5 w-5 shrink-0 text-yellow-600" />
            <div>
              <p className="font-medium text-yellow-800">Registration Pending</p>
              <p className="mt-1 text-sm text-yellow-700">
                Your registration is awaiting approval from the society admin. You will be notified
                once it is approved.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Rejected state
  if (profile.status === "REJECTED") {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Welcome, {profile.name}</h1>
          <p className="text-muted-foreground text-sm">{user?.societyName}</p>
        </div>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-start gap-3 pt-6">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div>
              <p className="font-medium text-red-800">Registration Not Approved</p>
              <p className="mt-1 text-sm text-red-700">
                Your registration was not approved. Please contact the society admin for more
                details.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Active state (ACTIVE_PENDING, ACTIVE_PAID, ACTIVE_OVERDUE, etc.)
  const feeStatusColor =
    profile.currentFee?.status === "PAID"
      ? "border-green-200 bg-green-50 text-green-700"
      : profile.currentFee?.status === "PENDING"
        ? "border-yellow-200 bg-yellow-50 text-yellow-700"
        : "border-red-200 bg-red-50 text-red-700";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {profile.name}</h1>
        <p className="text-muted-foreground text-sm">{user?.societyName}</p>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-muted-foreground text-xs">Your RWAID</p>
              <p className="font-mono text-sm font-medium">{profile.rwaid || "Pending"}</p>
              {profile.unit && (
                <p className="text-muted-foreground mt-1 text-xs">Unit: {profile.unit}</p>
              )}
            </div>
            <Badge variant="outline" className="border-green-200 bg-green-50 text-green-700">
              Active
            </Badge>
          </div>
        </CardContent>
      </Card>

      {profile.currentFee && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CreditCard className="h-4 w-4" />
              Current Session ({profile.currentFee.sessionYear})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">
                  {"\u20B9"}
                  {profile.currentFee.amountPaid.toLocaleString("en-IN")}
                  <span className="text-muted-foreground text-sm font-normal">
                    {" / \u20B9"}
                    {profile.currentFee.amountDue.toLocaleString("en-IN")}
                  </span>
                </p>
              </div>
              <Badge variant="outline" className={feeStatusColor}>
                {profile.currentFee.status}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Link href="/r/payments">
          <Card className="hover:bg-muted/50 cursor-pointer transition-colors">
            <CardContent className="flex flex-col items-center gap-2 pt-6 text-center">
              <IndianRupee className="text-primary h-8 w-8" />
              <p className="text-sm font-medium">Payment History</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/r/expenses">
          <Card className="hover:bg-muted/50 cursor-pointer transition-colors">
            <CardContent className="flex flex-col items-center gap-2 pt-6 text-center">
              <Receipt className="text-primary h-8 w-8" />
              <p className="text-sm font-medium">Society Expenses</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
