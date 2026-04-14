import Link from "next/link";
import { redirect } from "next/navigation";

import { Shield } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

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

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/counsellor" className="flex items-center gap-2 font-semibold">
            <Shield className="h-5 w-5 text-emerald-600" />
            Counsellor
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/counsellor/profile" className="hover:text-foreground text-zinc-600">
              Profile
            </Link>
            <Link href="/counsellor/settings" className="hover:text-foreground text-zinc-600">
              Settings
            </Link>
            <span className="text-zinc-500">{counsellor.name}</span>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-4">{children}</main>
    </div>
  );
}
