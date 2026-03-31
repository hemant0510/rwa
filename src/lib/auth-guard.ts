import { forbiddenError, unauthorizedError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

interface SuperAdminContext {
  superAdminId: string;
  authUserId: string;
  email: string;
}

type AuthResult = { data: SuperAdminContext; error: null } | { data: null; error: Response };

/**
 * Verify the caller is an active super admin.
 * Returns the SA context on success, or a NextResponse error on failure.
 */
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
