"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Shield } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { superAdminLoginSchema, type SuperAdminLoginInput } from "@/lib/validations/auth";

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<SuperAdminLoginInput>({
    resolver: zodResolver(superAdminLoginSchema),
    defaultValues: { email: "", password: "" },
  });

  const handleLogin = async (data: SuperAdminLoginInput) => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      // Small delay to ensure cookies are set before server-side check
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify this is actually a super admin
      const res = await fetch("/api/v1/auth/me");
      if (!res.ok) {
        toast.error("Not authorized as Super Admin.");
        await supabase.auth.signOut();
        return;
      }

      const me = (await res.json()) as { role: string };
      if (me.role !== "SUPER_ADMIN") {
        toast.error("Not authorized as Super Admin.");
        await supabase.auth.signOut();
        return;
      }

      toast.success("Login successful!");
      router.push("/sa/dashboard");
      router.refresh();
    } catch {
      toast.error("Invalid credentials");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="bg-primary/10 mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full">
          <Shield className="text-primary h-6 w-6" />
        </div>
        <CardTitle className="text-2xl">Super Admin</CardTitle>
        <CardDescription>Sign in with your email and password</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@rwaconnect.in"
              {...form.register("email")}
            />
            {form.formState.errors.email && (
              <p className="text-destructive text-sm">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" {...form.register("password")} />
            {form.formState.errors.password && (
              <p className="text-destructive text-sm">{form.formState.errors.password.message}</p>
            )}
          </div>
          <Button className="w-full" type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign In
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
