import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

import { CounsellorShell } from "./counsellor-shell";

export default async function CounsellorAuthedLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/counsellor/login");
  }

  const counsellor = await prisma.counsellor.findUnique({
    where: { authUserId: user.id },
    select: { id: true, name: true, isActive: true, mfaEnrolledAt: true },
  });

  if (!counsellor?.isActive) {
    redirect("/counsellor/login");
  }

  return <CounsellorShell counsellorName={counsellor.name}>{children}</CounsellorShell>;
}
