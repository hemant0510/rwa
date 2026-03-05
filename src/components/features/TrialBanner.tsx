"use client";

import { useState } from "react";

import { AlertTriangle } from "lucide-react";

import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";

export function TrialBanner() {
  const { user } = useAuth();

  const [now] = useState(() => Date.now());

  if (!user || user.societyStatus !== "TRIAL") return null;

  if (user.isTrialExpired) {
    return (
      <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Trial Expired</AlertTitle>
        <AlertDescription>
          Your free trial has ended. Please contact the super admin to subscribe and continue using
          all features.
        </AlertDescription>
      </Alert>
    );
  }

  // Show reminder when <= 3 days remain
  const trialEndsAt = user.trialEndsAt ? new Date(user.trialEndsAt) : null;
  if (trialEndsAt) {
    const daysRemaining = Math.ceil((trialEndsAt.getTime() - now) / (1000 * 60 * 60 * 24));

    if (daysRemaining <= 3) {
      return (
        <Alert className="rounded-none border-x-0 border-t-0 border-yellow-500 bg-yellow-50 text-yellow-800 dark:bg-yellow-950/20 dark:text-yellow-200">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Trial Ending Soon</AlertTitle>
          <AlertDescription>
            Your free trial ends in {daysRemaining} day{daysRemaining !== 1 ? "s" : ""}. Contact the
            super admin to continue.
          </AlertDescription>
        </Alert>
      );
    }
  }

  return null;
}
