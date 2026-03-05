"use client";

import { useContext, createContext } from "react";

import type { UserRole, AdminPermission } from "@/types/user";

interface AuthContextValue {
  user: {
    id: string;
    name: string;
    role: UserRole | "SUPER_ADMIN";
    permission: AdminPermission | null;
    societyId: string | null;
    societyName: string | null;
    societyCode: string | null;
    societyStatus: string | null;
    trialEndsAt: string | null;
    isTrialExpired: boolean;
  } | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  signOut: async () => {},
});

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
