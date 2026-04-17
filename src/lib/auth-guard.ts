import { forbiddenError, unauthorizedError } from "@/lib/api-helpers";
import { isCounsellorRoleEnabled } from "@/lib/counsellor/feature-flag";
import { getAuthUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

interface SuperAdminContext {
  superAdminId: string;
  authUserId: string;
  email: string;
}

interface CounsellorAuthContext {
  counsellorId: string;
  authUserId: string;
  email: string;
  name: string;
  isSuperAdmin: boolean;
}

type AuthResult = { data: SuperAdminContext; error: null } | { data: null; error: Response };

type CounsellorAuthResult =
  | { data: CounsellorAuthContext; error: null }
  | { data: null; error: Response };

export async function requireSuperAdmin(): Promise<AuthResult> {
  const user = await getAuthUser();
  if (!user) {
    return { data: null, error: unauthorizedError() };
  }

  const superAdmin = await prisma.superAdmin.findUnique({
    where: { authUserId: user.id },
    select: { id: true, authUserId: true, email: true, isActive: true },
  });

  if (!superAdmin?.isActive) {
    return { data: null, error: forbiddenError("Super admin access required") };
  }

  return {
    data: {
      superAdminId: superAdmin.id,
      authUserId: superAdmin.authUserId,
      email: superAdmin.email,
    },
    error: null,
  };
}

export async function requireCounsellor(): Promise<CounsellorAuthResult> {
  const enabled = await isCounsellorRoleEnabled();
  if (!enabled) {
    return { data: null, error: forbiddenError("Counsellor role is disabled") };
  }

  const user = await getAuthUser();
  if (!user) {
    return { data: null, error: unauthorizedError() };
  }

  const counsellor = await prisma.counsellor.findUnique({
    where: { authUserId: user.id },
    select: { id: true, authUserId: true, email: true, name: true, isActive: true },
  });

  if (counsellor?.isActive) {
    return {
      data: {
        counsellorId: counsellor.id,
        authUserId: user.id,
        email: counsellor.email,
        name: counsellor.name,
        isSuperAdmin: false,
      },
      error: null,
    };
  }

  // SA fallback — READ-ONLY access to counsellor features
  const sa = await prisma.superAdmin.findUnique({
    where: { authUserId: user.id },
    select: { id: true, email: true, name: true, isActive: true },
  });

  if (sa?.isActive) {
    return {
      data: {
        counsellorId: "__super_admin__",
        authUserId: user.id,
        email: sa.email,
        name: sa.name,
        isSuperAdmin: true,
      },
      error: null,
    };
  }

  return { data: null, error: forbiddenError("Counsellor access required") };
}
