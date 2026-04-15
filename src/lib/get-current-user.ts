import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import type { AdminPermission, UserRole } from "@/types/user";

import { getActiveSocietyId } from "./active-society-server";

export interface CurrentUser {
  userId: string;
  authUserId: string;
  societyId: string;
  role: UserRole;
  adminPermission: AdminPermission | null;
  name: string;
}

/**
 * Centralized user resolution for API routes.
 * Reads Supabase auth + active-society cookie to scope the user lookup.
 *
 * @param requiredRole - Optional role filter ("RWA_ADMIN" or "RESIDENT")
 * @returns CurrentUser or null if not authenticated / not found / wrong role
 */
export async function getCurrentUser(
  requiredRole?: "RWA_ADMIN" | "RESIDENT",
): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const activeSocietyId = await getActiveSocietyId();

  const where: Record<string, unknown> = { authUserId: authUser.id };
  if (requiredRole) where.role = requiredRole;
  if (activeSocietyId) where.societyId = activeSocietyId;

  const user = await prisma.user.findFirst({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      societyId: true,
      role: true,
      adminPermission: true,
    },
  });

  if (!user || !user.societyId) return null;

  return {
    userId: user.id,
    authUserId: authUser.id,
    societyId: user.societyId,
    role: user.role as UserRole,
    adminPermission: user.adminPermission as AdminPermission | null,
    name: user.name,
  };
}

/**
 * Convenience wrapper: gets an admin with FULL_ACCESS permission.
 * Replaces the duplicated getAdminSocietyId() / getAdminWithSociety() helpers.
 */
export async function getFullAccessAdmin(): Promise<CurrentUser | null> {
  const user = await getCurrentUser("RWA_ADMIN");
  if (!user || user.adminPermission !== "FULL_ACCESS") return null;
  return user;
}

export interface AdminContext {
  userId: string | null;
  authUserId: string;
  societyId: string;
  role: UserRole | "SUPER_ADMIN";
  adminPermission: AdminPermission | null;
  name: string;
  isSuperAdmin: boolean;
}

/**
 * Admin context resolver that grants Super Admins read access to any society.
 *
 * Use this in admin GET endpoints that need to support both:
 *  - A regular RWA_ADMIN viewing their own society, AND
 *  - A SUPER_ADMIN viewing-as that society via the dashboard impersonation flow.
 *
 * Behavior:
 *  - If the caller is an RWA_ADMIN, returns their normal context. If a
 *    targetSocietyId is supplied and does not match, returns null.
 *  - If the caller is an active SUPER_ADMIN, returns a synthetic FULL_ACCESS
 *    context scoped to targetSocietyId. The targetSocietyId MUST be supplied;
 *    otherwise we return null (a Super Admin without a target society is not a
 *    valid admin caller).
 *  - For mutating endpoints (POST/PATCH/DELETE), keep using getCurrentUser /
 *    getFullAccessAdmin so writes remain attributable to a real User row.
 */
export async function getAdminContext(
  targetSocietyId: string | null | undefined,
): Promise<AdminContext | null> {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const admin = await prisma.user.findFirst({
    where: { authUserId: authUser.id, role: "RWA_ADMIN" },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, societyId: true, role: true, adminPermission: true },
  });

  if (admin?.societyId) {
    if (targetSocietyId && admin.societyId !== targetSocietyId) return null;
    return {
      userId: admin.id,
      authUserId: authUser.id,
      societyId: admin.societyId,
      role: admin.role as UserRole,
      adminPermission: admin.adminPermission as AdminPermission | null,
      name: admin.name,
      isSuperAdmin: false,
    };
  }

  if (!targetSocietyId) return null;

  const superAdmin = await prisma.superAdmin.findUnique({
    where: { authUserId: authUser.id },
    select: { id: true, email: true, name: true, isActive: true },
  });
  if (!superAdmin?.isActive) return null;

  return {
    userId: null,
    authUserId: authUser.id,
    societyId: targetSocietyId,
    role: "SUPER_ADMIN",
    adminPermission: "FULL_ACCESS",
    name: superAdmin.name,
    isSuperAdmin: true,
  };
}
