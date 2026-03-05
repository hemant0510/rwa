"use client";

import { Header } from "@/components/layout/Header";
import { ResidentBottomNav } from "@/components/layout/ResidentBottomNav";
import { useAuth } from "@/hooks/useAuth";

export default function ResidentLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const societyName = user?.societyName || "RWA Connect";

  return (
    <div className="flex min-h-screen flex-col">
      <Header title={societyName} userName={user?.name || "Resident"} onSignOut={signOut} />
      <main className="flex-1 p-4 pb-20">{children}</main>
      <ResidentBottomNav />
    </div>
  );
}
