import { prisma } from "@/lib/prisma";

type AdminAuthClient = {
  auth: {
    admin: {
      createUser: (args: { email: string; password: string; email_confirm: boolean }) => Promise<{
        data: { user: { id: string } | null } | null;
        error: { message?: string } | null;
      }>;
      listUsers: (args: { page: number; perPage: number }) => Promise<{
        data: { users: Array<{ id: string; email?: string | null }> } | null;
        error: { message?: string } | null;
      }>;
      updateUserById: (
        id: string,
        attrs: { password: string },
      ) => Promise<{ error: { message?: string } | null }>;
    };
  };
};

export type ResolveAuthUserResult =
  | { ok: true; authUserId: string; adopted: boolean }
  | { ok: false; code: "EMAIL_CLAIMED_BY_OTHER_ROLE" | "AUTH_ERROR"; message: string };

function isAlreadyRegisteredError(message: string | undefined): boolean {
  if (!message) return false;
  return /already (registered|been registered|exists)/i.test(message);
}

async function findAuthUserIdByEmail(
  admin: AdminAuthClient,
  email: string,
): Promise<string | null> {
  const target = email.toLowerCase();
  const perPage = 200;
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error || !data) return null;
    const match = data.users.find((u) => u.email?.toLowerCase() === target);
    if (match) return match.id;
    if (data.users.length < perPage) return null;
  }
  return null;
}

async function isAuthUserClaimedByOtherRole(authUserId: string): Promise<boolean> {
  const [user, superAdmin] = await Promise.all([
    prisma.user.findFirst({ where: { authUserId }, select: { id: true } }),
    prisma.superAdmin.findUnique({ where: { authUserId }, select: { id: true } }),
  ]);
  return Boolean(user || superAdmin);
}

/**
 * Returns an auth user id to link a new Counsellor to.
 *
 * If no auth user exists for `email`, creates one. If one already exists but
 * is orphaned (no Prisma row references it), adopts it. If it's claimed by a
 * User or SuperAdmin, rejects — the email is taken by another role.
 */
export async function resolveCounsellorAuthUserId(
  admin: AdminAuthClient,
  email: string,
): Promise<ResolveAuthUserResult> {
  const randomPassword = `tmp_${crypto.randomUUID()}`;
  const createRes = await admin.auth.admin.createUser({
    email,
    password: randomPassword,
    email_confirm: true,
  });

  if (createRes.data?.user) {
    return { ok: true, authUserId: createRes.data.user.id, adopted: false };
  }

  if (!isAlreadyRegisteredError(createRes.error?.message)) {
    return {
      ok: false,
      code: "AUTH_ERROR",
      message: createRes.error?.message ?? "Failed to create auth account",
    };
  }

  const existingId = await findAuthUserIdByEmail(admin, email);
  if (!existingId) {
    return {
      ok: false,
      code: "AUTH_ERROR",
      message: createRes.error?.message ?? "Failed to create auth account",
    };
  }

  if (await isAuthUserClaimedByOtherRole(existingId)) {
    return {
      ok: false,
      code: "EMAIL_CLAIMED_BY_OTHER_ROLE",
      message: "This email is already registered under a different role.",
    };
  }

  // Wipe the orphan's stale password so Supabase's "new password must differ
  // from current" check can't reject a user's first password choice on the
  // setup page.
  const resetRes = await admin.auth.admin.updateUserById(existingId, {
    password: `tmp_${crypto.randomUUID()}`,
  });
  if (resetRes.error) {
    return {
      ok: false,
      code: "AUTH_ERROR",
      message: resetRes.error.message ?? "Failed to reset adopted auth account",
    };
  }

  return { ok: true, authUserId: existingId, adopted: true };
}
