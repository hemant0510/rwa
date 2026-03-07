"use client";

import { useSearchParams } from "next/navigation";

import { useAuth } from "@/hooks/useAuth";

/**
 * Resolves the current society context for admin pages.
 * Super admins can view any society via `?sid=<id>&sname=<name>&scode=<code>` query params.
 * Regular admins use their own society from auth context.
 */
export function useSocietyId() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const sid = searchParams.get("sid");
  const isSuperAdminViewing = user?.role === "SUPER_ADMIN" && !!sid;

  const societyId = isSuperAdminViewing ? sid : (user?.societyId ?? "");
  const societyName = isSuperAdminViewing
    ? (searchParams.get("sname") ?? "Society")
    : (user?.societyName ?? null);
  const societyCode = isSuperAdminViewing
    ? (searchParams.get("scode") ?? null)
    : (user?.societyCode ?? null);

  // Build the query string for preserving SA context across navigation
  const saQueryString = isSuperAdminViewing
    ? `?sid=${sid}&sname=${encodeURIComponent(societyName ?? "")}&scode=${encodeURIComponent(societyCode ?? "")}`
    : "";

  return { societyId, societyName, societyCode, isSuperAdminViewing, saQueryString };
}
