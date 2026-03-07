"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { CheckCircle, Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type VerifyState = "loading" | "success" | "error";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const hasToken = Boolean(token);
  const [state, setState] = useState<VerifyState>(hasToken ? "loading" : "error");
  const [message, setMessage] = useState(
    hasToken ? "" : "Invalid verification link. No token provided.",
  );

  useEffect(() => {
    if (!token) return;

    const verify = async () => {
      try {
        const res = await fetch(`/api/v1/auth/verify-email?token=${token}`);
        const data = (await res.json()) as {
          success?: boolean;
          message?: string;
          error?: { message?: string };
        };

        if (res.ok && data.success) {
          setState("success");
          setMessage(data.message ?? "Email verified successfully!");
        } else {
          setState("error");
          setMessage(data.error?.message ?? "Verification failed. Please try again.");
        }
      } catch {
        setState("error");
        setMessage("Something went wrong. Please try again.");
      }
    };

    verify();
  }, [token]);

  return (
    <Card className="w-full max-w-md text-center">
      <CardContent className="space-y-4 pt-8 pb-6">
        {state === "loading" && (
          <>
            <Loader2 className="text-primary mx-auto h-12 w-12 animate-spin" />
            <p className="text-muted-foreground text-sm">Verifying your email...</p>
          </>
        )}

        {state === "success" && (
          <>
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            <h2 className="text-xl font-bold">Email Verified!</h2>
            <p className="text-muted-foreground text-sm">{message}</p>
            <Button asChild className="w-full">
              <Link href="/login">Sign In</Link>
            </Button>
          </>
        )}

        {state === "error" && (
          <>
            <XCircle className="text-destructive mx-auto h-12 w-12" />
            <h2 className="text-xl font-bold">Verification Failed</h2>
            <p className="text-muted-foreground text-sm">{message}</p>
            <div className="space-y-2">
              <Button variant="outline" asChild className="w-full">
                <Link href="/login">Back to Sign In</Link>
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
