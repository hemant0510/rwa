"use client";

import { useContext, createContext } from "react";

import type { UserRole, AdminPermission } from "@/types/user";

export interface SocietySummary {
  societyId: string;
  name: string | null;
  code: string | null;
  role: UserRole;
  status: string;
  designation: string | null;
}

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
    multiSociety: boolean;
    societies: SocietySummary[] | null;
  } | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  switchSociety: (societyId: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  signOut: async () => {},
  switchSociety: async () => {},
});

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
