import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

import { SuperAdminShell } from "./super-admin-shell";

export default async function SuperAdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/super-admin-login");
  }

  const superAdmin = await prisma.superAdmin.findUnique({
    where: { authUserId: user.id },
    select: { isActive: true },
  });

  if (!superAdmin?.isActive) {
    redirect("/super-admin-login");
  }

  return <SuperAdminShell>{children}</SuperAdminShell>;
}
