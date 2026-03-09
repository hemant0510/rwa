"use client";

import { useEffect, useState } from "react";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle, KeyRound, Loader2, XCircle } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const formSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().min(8, "Confirm password is required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormInput = z.infer<typeof formSchema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [countdown, setCountdown] = useState(5);

  const form = useForm<FormInput>({
    resolver: zodResolver(formSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  // Countdown timer after success
  useEffect(() => {
    if (!isSuccess) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          router.push("/login");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isSuccess, router]);

  if (!token) {
    return (
      <Card className="w-full max-w-md text-center">
        <CardContent className="space-y-4 pt-8 pb-6">
          <XCircle className="text-destructive mx-auto h-12 w-12" />
          <h2 className="text-xl font-bold">Invalid Reset Link</h2>
          <p className="text-muted-foreground text-sm">
            This password reset link is invalid. Please request a new one.
          </p>
          <Button asChild className="w-full">
            <Link href="/forgot-password">Request New Reset Link</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isSuccess) {
    return (
      <Card className="w-full max-w-md text-center">
        <CardContent className="space-y-4 pt-8 pb-6">
          <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
          <h2 className="text-xl font-bold">Password Changed!</h2>
          <p className="text-muted-foreground text-sm">
            Your password has been reset successfully. Redirecting to sign in in {countdown}{" "}
            seconds...
          </p>
          <Button asChild className="w-full">
            <Link href="/login">Sign In Now</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const handleSubmit = async (data: FormInput) => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          password: data.password,
          confirmPassword: data.confirmPassword,
        }),
      });

      const result = (await res.json()) as {
        success?: boolean;
        error?: { message?: string };
      };

      if (res.ok && result.success) {
        setIsSuccess(true);
      } else {
        toast.error(result.error?.message ?? "Failed to reset password. Please try again.");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="bg-primary/10 mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full">
          <KeyRound className="text-primary h-6 w-6" />
        </div>
        <CardTitle className="text-2xl">Reset Password</CardTitle>
        <CardDescription>Enter your new password below</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">
              New Password <span className="text-destructive">*</span>
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Min 8 characters"
              aria-invalid={!!form.formState.errors.password}
              {...form.register("password")}
            />
            {form.formState.errors.password && (
              <p className="text-destructive text-sm">{form.formState.errors.password.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">
              Confirm Password <span className="text-destructive">*</span>
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              aria-invalid={!!form.formState.errors.confirmPassword}
              {...form.register("confirmPassword")}
            />
            {form.formState.errors.confirmPassword && (
              <p className="text-destructive text-sm">
                {form.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>
          <Button className="w-full" type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Reset Password
          </Button>
        </form>
        <div className="text-muted-foreground mt-4 text-center text-sm">
          <Link href="/login" className="text-primary underline">
            Back to Sign In
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
