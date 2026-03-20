"use client";

import { useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Building2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { loginSchema, type LoginInput } from "@/lib/validations/auth";

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const handleLogin = async (data: LoginInput) => {
    setIsLoading(true);
    try {
      // Server-side login (rate-limited)
      const loginRes = await fetch("/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, password: data.password }),
      });

      const loginBody = (await loginRes.json()) as {
        error?: { code?: string; message?: string };
      };

      if (!loginRes.ok) {
        if (loginRes.status === 429) {
          toast.error(loginBody.error?.message ?? "Too many attempts. Please try again later.");
        } else {
          toast.error(loginBody.error?.message ?? "Invalid credentials.");
        }
        return;
      }

      // Small delay to ensure cookies are set before server-side check
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Determine role and redirect
      const meRes = await fetch("/api/v1/auth/me");
      if (!meRes.ok) {
        toast.error("Account not found. Please contact your admin.");
        const supabase = createClient();
        await supabase.auth.signOut();
        return;
      }

      const me = (await meRes.json()) as {
        redirectTo: string | null;
        emailVerified?: boolean;
        email?: string;
      };

      // Handle unverified email
      if (me.emailVerified === false) {
        toast.error("Please verify your email before signing in.");
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push(`/check-email?email=${encodeURIComponent(me.email ?? data.email)}`);
        return;
      }

      toast.success("Login successful!");
      router.push(me.redirectTo ?? "/login");
      router.refresh();
    } catch (err) {
      console.error("Login error:", err);
      toast.error("Login failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="bg-primary/10 mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full">
          <Building2 className="text-primary h-6 w-6" />
        </div>
        <CardTitle className="text-2xl">RWA Connect</CardTitle>
        <CardDescription>Sign in with your email and password</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              aria-invalid={!!form.formState.errors.email}
              {...form.register("email")}
            />
            {form.formState.errors.email && (
              <p className="text-destructive text-sm">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">
              Password <span className="text-destructive">*</span>
            </Label>
            <Input
              id="password"
              type="password"
              aria-invalid={!!form.formState.errors.password}
              {...form.register("password")}
            />
            {form.formState.errors.password && (
              <p className="text-destructive text-sm">{form.formState.errors.password.message}</p>
            )}
          </div>
          <div className="text-right">
            <Link href="/forgot-password" className="text-primary text-sm hover:underline">
              Forgot password?
            </Link>
          </div>
          <Button className="w-full" type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign In
          </Button>
        </form>
        <div className="text-muted-foreground mt-4 text-center text-sm">
          New here?{" "}
          <Link href="/register-society" className="text-primary underline">
            Register your society
          </Link>
        </div>
        <div className="text-muted-foreground mt-3 text-center text-xs">
          By signing in, you agree to our{" "}
          <Link href="/terms" className="hover:text-foreground underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="hover:text-foreground underline">
            Privacy Policy
          </Link>
          .
        </div>
      </CardContent>
    </Card>
  );
}
