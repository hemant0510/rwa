"use client";

import { useState, useEffect, useCallback } from "react";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VERIFICATION_RESEND_COOLDOWN_SECONDS } from "@/lib/constants";

export default function CheckEmailPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const startCooldown = useCallback(() => {
    setCooldown(VERIFICATION_RESEND_COOLDOWN_SECONDS);
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (!email || cooldown > 0) return;
    setIsResending(true);
    try {
      const res = await fetch("/api/v1/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        error?: { message?: string };
        alreadyVerified?: boolean;
      };

      if (data.alreadyVerified) {
        toast.success("Email already verified! You can sign in.");
        return;
      }

      if (!res.ok) {
        toast.error(data.error?.message ?? "Failed to resend email");
        return;
      }

      toast.success("Verification email sent!");
      startCooldown();
    } catch {
      toast.error("Failed to resend email. Please try again.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="bg-primary/10 mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full">
          <Mail className="text-primary h-6 w-6" />
        </div>
        <CardTitle className="text-xl">Check Your Email</CardTitle>
        <CardDescription>
          We&apos;ve sent a verification link to{" "}
          {email ? <strong className="text-foreground">{email}</strong> : "your email address"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-center text-sm">
          Click the link in the email to verify your account. The link expires in 24 hours.
        </p>

        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full"
            disabled={isResending || cooldown > 0 || !email}
            onClick={handleResend}
          >
            {isResending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend Verification Email"}
          </Button>
          <Button variant="ghost" className="w-full" asChild>
            <Link href="/login">Back to Sign In</Link>
          </Button>
        </div>

        <p className="text-muted-foreground text-center text-xs">
          Didn&apos;t receive the email? Check your spam folder or try resending.
        </p>
      </CardContent>
    </Card>
  );
}
