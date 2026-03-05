"use client";

import { useState, useCallback, useEffect } from "react";

import { useRouter } from "next/navigation";

import { AuthContext } from "@/hooks/useAuth";
import { createClient } from "@/lib/supabase/client";
import type { AdminPermission, UserRole } from "@/types/user";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole | "SUPER_ADMIN";
  permission: AdminPermission | null;
  societyId: string | null;
  societyName: string | null;
  societyCode: string | null;
  societyStatus: string | null;
  trialEndsAt: string | null;
  isTrialExpired: boolean;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/auth/me");
      if (!res.ok) {
        setUser(null);
        return;
      }
      const data = (await res.json()) as AuthUser & Record<string, unknown>;
      setUser({
        id: data.id,
        name: data.name,
        email: data.email,
        role: data.role,
        permission: data.permission,
        societyId: data.societyId,
        societyName: data.societyName ?? null,
        societyCode: data.societyCode ?? null,
        societyStatus: data.societyStatus ?? null,
        trialEndsAt: data.trialEndsAt ?? null,
        isTrialExpired: data.isTrialExpired ?? false,
      });
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();

    // Initial auth check
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (authUser) {
        fetchMe().finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        fetchMe();
      } else {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchMe]);

  const signOut = useCallback(async () => {
    const isSuperAdmin = user?.role === "SUPER_ADMIN";
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    router.push(isSuperAdmin ? "/super-admin-login" : "/login");
    router.refresh();
  }, [router, user?.role]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
