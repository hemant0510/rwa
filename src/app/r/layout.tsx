"use client";

import { useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { SocietySwitcher } from "@/components/features/SocietySwitcher";
import { Header } from "@/components/layout/Header";
import { ResidentSidebar, ResidentMobileSidebar } from "@/components/layout/ResidentSidebar";
import { useAuth } from "@/hooks/useAuth";

async function fetchPhotoUrl(): Promise<string | null> {
  const res = await fetch("/api/v1/residents/me/photo");
  if (!res.ok) return null;
  const data = (await res.json()) as { url: string | null };
  return data.url;
}

export default function ResidentLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, signOut } = useAuth();
  const societyName = user?.societyName || "RWA Connect";
  const isMultiSociety = user?.multiSociety ?? false;

  const { data: photoUrl } = useQuery({
    queryKey: ["resident-photo", user?.societyId],
    queryFn: fetchPhotoUrl,
    staleTime: 10 * 60 * 1000,
    enabled: !!user,
  });

  return (
    <div className="flex h-screen overflow-hidden">
      <ResidentSidebar societyName={societyName} />
      <ResidentMobileSidebar
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        societyName={societyName}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          title="RWA Connect"
          subtitle={societyName}
          userName={user?.name || "Resident"}
          userPhotoUrl={photoUrl ?? null}
          profileHref="/r/profile"
          showMenuButton
          onMenuToggle={() => setSidebarOpen(true)}
          onSignOut={signOut}
          societySwitcher={isMultiSociety ? <SocietySwitcher /> : undefined}
        />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
