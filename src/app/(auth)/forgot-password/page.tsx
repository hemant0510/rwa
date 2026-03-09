"use client";

import { useState } from "react";

import Link from "next/link";

import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, Loader2, Mail } from "lucide-react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@/lib/validations/auth";

export default function ForgotPasswordPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const handleSubmit = async (data: ForgotPasswordInput) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setIsSuccess(true);
      }
    } catch {
      // Still show success to not leak email existence
      setIsSuccess(true);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <Card className="w-full max-w-md text-center">
        <CardContent className="space-y-4 pt-8 pb-6">
          <Mail className="text-primary mx-auto h-12 w-12" />
          <h2 className="text-xl font-bold">Check Your Email</h2>
          <p className="text-muted-foreground text-sm">
            If an account with that email exists, we&apos;ve sent a password reset link. Please
            check your inbox and spam folder.
          </p>
          <Button variant="outline" asChild className="w-full">
            <Link href="/login">Back to Sign In</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="bg-primary/10 mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full">
          <KeyRound className="text-primary h-6 w-6" />
        </div>
        <CardTitle className="text-2xl">Forgot Password</CardTitle>
        <CardDescription>
          Enter your email address and we&apos;ll send you a link to reset your password
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
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
          <Button className="w-full" type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send Reset Link
          </Button>
        </form>
        <div className="text-muted-foreground mt-4 text-center text-sm">
          Remember your password?{" "}
          <Link href="/login" className="text-primary underline">
            Sign in
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
