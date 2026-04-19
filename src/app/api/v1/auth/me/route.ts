import { NextResponse } from "next/server";

import { getActiveSocietyId } from "@/lib/active-society-server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Check super_admins table first
  const superAdmin = await prisma.superAdmin.findUnique({
    where: { authUserId: authUser.id },
  });

  if (superAdmin) {
    return NextResponse.json({
      id: superAdmin.id,
      name: superAdmin.name,
      email: superAdmin.email,
      role: "SUPER_ADMIN" as const,
      societyId: null,
      permission: null,
      redirectTo: "/sa/dashboard",
      multiSociety: false,
      societies: null,
    });
  }

  // Check counsellors table (platform-level ombudspersons, no society scope)
  const counsellor = await prisma.counsellor.findUnique({
    where: { authUserId: authUser.id },
    select: { id: true, name: true, email: true, isActive: true },
  });

  if (counsellor) {
    if (!counsellor.isActive) {
      return NextResponse.json({ error: "Counsellor account is suspended" }, { status: 403 });
    }
    return NextResponse.json({
      id: counsellor.id,
      name: counsellor.name,
      email: counsellor.email,
      role: "COUNSELLOR" as const,
      societyId: null,
      permission: null,
      redirectTo: "/counsellor",
      multiSociety: false,
      societies: null,
    });
  }

  // Fetch ALL user records for this auth account (may belong to multiple societies)
  const allUsers = await prisma.user.findMany({
    where: { authUserId: authUser.id },
    orderBy: { createdAt: "desc" },
    include: {
      society: {
        select: {
          name: true,
          societyCode: true,
          status: true,
          trialEndsAt: true,
          emailVerificationRequired: true,
        },
      },
      governingBodyMembership: {
        select: {
          designation: {
            select: { name: true },
          },
        },
      },
    },
  });

  if (allUsers.length === 0) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Determine which user is active — prefer cookie, fall back to most recent
  const activeSocietyId = await getActiveSocietyId();
  const activeUser =
    (activeSocietyId ? allUsers.find((u) => u.societyId === activeSocietyId) : null) ?? allUsers[0];

  // Check if email verification is required and not done
  const emailVerificationRequired = activeUser.society?.emailVerificationRequired ?? false;
  if (emailVerificationRequired && !activeUser.isEmailVerified) {
    return NextResponse.json({
      emailVerified: false,
      email: activeUser.email,
      redirectTo: null,
    });
  }

  const redirectTo = activeUser.role === "RWA_ADMIN" ? "/admin/dashboard" : "/r/home";

  const isTrialExpired =
    activeUser.society?.status === "TRIAL" &&
    activeUser.society?.trialEndsAt != null &&
    new Date(activeUser.society.trialEndsAt) < new Date();

  const multiSociety = allUsers.length > 1;

  // Build societies array only when user belongs to 2+ societies
  const societies = multiSociety
    ? allUsers.map((u) => ({
        societyId: u.societyId,
        name: u.society?.name ?? null,
        code: u.society?.societyCode ?? null,
        role: u.role,
        status: u.status,
        designation: u.governingBodyMembership?.designation?.name ?? null,
      }))
    : null;

  return NextResponse.json({
    id: activeUser.id,
    name: activeUser.name,
    email: activeUser.email,
    role: activeUser.role,
    societyId: activeUser.societyId,
    permission: activeUser.adminPermission,
    redirectTo: multiSociety ? "/select-society" : redirectTo,
    emailVerified: true,
    societyName: activeUser.society?.name ?? null,
    societyCode: activeUser.society?.societyCode ?? null,
    societyStatus: activeUser.society?.status ?? null,
    trialEndsAt: activeUser.society?.trialEndsAt ?? null,
    isTrialExpired: isTrialExpired ?? false,
    multiSociety,
    societies,
  });
}
