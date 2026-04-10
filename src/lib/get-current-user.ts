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
