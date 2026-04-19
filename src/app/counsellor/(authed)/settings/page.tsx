"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { useQuery } from "@tanstack/react-query";
import { LogOut, RotateCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { createClient } from "@/lib/supabase/client";
import { getMe } from "@/services/counsellor-self";

export default function CounsellorSettingsPage() {
  const router = useRouter();
  const [confirmReset, setConfirmReset] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["counsellor-me"],
    queryFn: getMe,
  });

  async function handleResetMfa() {
    setIsResetting(true);
    try {
      const supabase = createClient();
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.[0];
      if (!totp) {
        toast.error("No MFA factor found.");
        setConfirmReset(false);
        return;
      }
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: totp.id });
      if (unenrollError) {
        toast.error(unenrollError.message);
        return;
      }
      const syncRes = await fetch("/api/v1/counsellor/mfa-status", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrolled: false }),
      });
      if (!syncRes.ok) {
        toast.error("MFA was reset, but account state could not be updated.");
        return;
      }
      toast.success("MFA reset. Please re-enrol from the set-password page.");
      setConfirmReset(false);
      router.push("/counsellor/set-password");
    } catch {
      toast.error("Failed to reset MFA.");
    } finally {
      setIsResetting(false);
    }
  }

  async function handleSignOut() {
    setIsSigningOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      toast.success("Signed out.");
      router.push("/counsellor/login");
    } catch {
      toast.error("Failed to sign out.");
    } finally {
      setIsSigningOut(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Multi-factor authentication and account controls."
      />

      {isLoading && <CardSkeleton />}

      {error && (
        <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-4 text-sm">
          Failed to load settings: {error.message}
        </div>
      )}

      {data && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-emerald-600" />
                <div className="flex-1">
                  <CardTitle className="text-base">Multi-factor authentication</CardTitle>
                  <CardDescription>
                    {data.mfaEnrolledAt
                      ? "TOTP factor active. You'll need it on every sign-in."
                      : "MFA is not yet enrolled. Complete setup before logging in again."}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                onClick={() => setConfirmReset(true)}
                disabled={!data.mfaEnrolledAt || isResetting}
              >
                <RotateCw className="mr-1 h-4 w-4" />
                Reset MFA
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sign out</CardTitle>
              <CardDescription>End this session on the current device.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={handleSignOut} disabled={isSigningOut}>
                <LogOut className="mr-1 h-4 w-4" />
                Sign out
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      <AlertDialog open={confirmReset} onOpenChange={setConfirmReset}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset MFA?</AlertDialogTitle>
            <AlertDialogDescription>
              Your current authenticator factor will be removed. You will be sent to the
              set-password page to re-enrol before you can log in again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResetting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetMfa} disabled={isResetting}>
              Yes, reset
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
