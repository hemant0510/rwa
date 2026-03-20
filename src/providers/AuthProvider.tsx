"use client";

import { useState, useCallback, useEffect } from "react";

import { useRouter } from "next/navigation";

import { AuthContext } from "@/hooks/useAuth";
import type { SocietySummary } from "@/hooks/useAuth";
import { setActiveSocietyId, clearActiveSocietyId } from "@/lib/active-society";
import { createClient } from "@/lib/supabase/client";
import type { AdminPermission, UserRole } from "@/types/user";

import type { AuthChangeEvent, AuthResponse, Session } from "@supabase/supabase-js";

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
  multiSociety: boolean;
  societies: SocietySummary[] | null;
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
        multiSociety: data.multiSociety ?? false,
        societies: (data.societies as SocietySummary[] | null) ?? null,
      });
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();

    // Initial auth check
    void supabase.auth.getUser().then((result: AuthResponse) => {
      const authUser = result.data.user;
      if (authUser) {
        fetchMe().finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
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
    clearActiveSocietyId();
    setUser(null);
    router.push(isSuperAdmin ? "/super-admin-login" : "/login");
    router.refresh();
  }, [router, user?.role]);

  const switchSociety = useCallback(
    async (societyId: string) => {
      setActiveSocietyId(societyId);
      await fetchMe();
      router.refresh();
    },
    [fetchMe, router],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        signOut,
        switchSociety,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
