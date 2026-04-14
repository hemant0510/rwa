"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Loader2, Shield } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

type Stage = "credentials" | "mfa";

export default function CounsellorLoginPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        toast.error(error.message);
        return;
      }

      // Check if MFA is required for this user
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.[0];
      if (!totp || totp.status !== "verified") {
        // No MFA enrolled — allowed for first-time users who'll go to onboarding.
        // But counsellors should always have MFA. Push them to set-password if missing.
        toast.info("Multi-factor authentication required. Please complete setup.");
        router.push("/counsellor/set-password");
        return;
      }

      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId: totp.id,
      });
      if (challengeError || !challenge) {
        toast.error(challengeError?.message ?? "Failed to start MFA challenge");
        await supabase.auth.signOut();
        return;
      }

      setFactorId(totp.id);
      setChallengeId(challenge.id);
      setStage("mfa");
    } catch {
      toast.error("Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleMfa(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId || !challengeId) return;
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code });
      if (error) {
        toast.error(error.message);
        return;
      }

      // Verify the user is actually a counsellor
      const res = await fetch("/api/v1/counsellor/me");
      if (!res.ok) {
        toast.error("Not authorized as a Counsellor.");
        await supabase.auth.signOut();
        return;
      }

      toast.success("Welcome back!");
      router.push("/counsellor");
      router.refresh();
    } catch {
      toast.error("Verification failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="bg-muted/50 flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <Shield className="h-6 w-6 text-emerald-600" />
          </div>
          <CardTitle className="text-2xl">Counsellor</CardTitle>
          <CardDescription>
            {stage === "credentials"
              ? "Sign in with your platform-issued credentials."
              : "Enter the 6-digit code from your authenticator app."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stage === "credentials" ? (
            <form onSubmit={handleCredentials} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <Button className="w-full" type="submit" disabled={isLoading}>
                {/* v8 ignore start */}
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {/* v8 ignore stop */}
                Sign In
              </Button>
            </form>
          ) : (
            <form onSubmit={handleMfa} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Authenticator code</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>
              <Button className="w-full" type="submit" disabled={isLoading || code.length !== 6}>
                {/* v8 ignore start */}
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {/* v8 ignore stop */}
                Verify
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStage("credentials");
                  setCode("");
                }}
                disabled={isLoading}
              >
                Back
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
