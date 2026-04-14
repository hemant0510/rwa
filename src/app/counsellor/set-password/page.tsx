"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

type Stage = "password" | "mfa";

export default function CounsellorSetPasswordPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("password");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      const supabase = createClient();
      const { error: pwError } = await supabase.auth.updateUser({ password });
      if (pwError) {
        toast.error(pwError.message);
        return;
      }

      // Begin TOTP enrollment
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp" });
      if (enrollError || !data) {
        toast.error(enrollError?.message ?? "Failed to start MFA enrollment");
        return;
      }

      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setStage("mfa");
    } catch {
      toast.error("Failed to set password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId) return;
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId,
      });
      if (challengeError || !challenge) {
        toast.error(challengeError?.message ?? "Failed to challenge MFA factor");
        return;
      }
      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code,
      });
      if (verifyError) {
        toast.error(verifyError.message);
        return;
      }

      toast.success("Account ready! Continuing to onboarding.");
      router.push("/counsellor/onboarding");
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
            <ShieldCheck className="h-6 w-6 text-emerald-600" />
          </div>
          <CardTitle className="text-2xl">Set Up Your Account</CardTitle>
          <CardDescription>
            {stage === "password"
              ? "Choose a secure password (8+ characters)."
              : "Scan the QR code in an authenticator app, then enter the 6-digit code."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stage === "password" && (
            <form onSubmit={handleSetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  minLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  minLength={8}
                />
              </div>
              <Button className="w-full" type="submit" disabled={isLoading}>
                {/* v8 ignore start */}
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {/* v8 ignore stop */}
                Set Password & Continue
              </Button>
            </form>
          )}

          {stage === "mfa" && (
            <form onSubmit={handleVerify} className="space-y-4">
              {qrCode && (
                <div className="flex flex-col items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrCode}
                    alt="MFA QR code"
                    className="h-44 w-44 rounded border bg-white p-2"
                  />
                  {secret && (
                    <p className="text-muted-foreground font-mono text-xs break-all">
                      Or enter manually: <span className="font-semibold">{secret}</span>
                    </p>
                  )}
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="code">6-digit code</Label>
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
                Verify & Continue
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
