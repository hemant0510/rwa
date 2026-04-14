import { forbiddenError, unauthorizedError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

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
}

type AuthResult = { data: SuperAdminContext; error: null } | { data: null; error: Response };

type CounsellorAuthResult =
  | { data: CounsellorAuthContext; error: null }
  | { data: null; error: Response };

export async function requireSuperAdmin(): Promise<AuthResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: unauthorizedError() };
  }

  const counsellor = await prisma.counsellor.findUnique({
    where: { authUserId: user.id },
    select: { id: true, authUserId: true, email: true, name: true, isActive: true },
  });

  if (!counsellor?.isActive) {
    return { data: null, error: forbiddenError("Counsellor access required") };
  }

  return {
    data: {
      counsellorId: counsellor.id,
      authUserId: counsellor.authUserId,
      email: counsellor.email,
      name: counsellor.name,
    },
    error: null,
  };
}
