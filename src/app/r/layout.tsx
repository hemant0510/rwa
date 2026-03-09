"use client";

import { useState } from "react";

import { SocietySwitcher } from "@/components/features/SocietySwitcher";
import { Header } from "@/components/layout/Header";
import { ResidentSidebar, ResidentMobileSidebar } from "@/components/layout/ResidentSidebar";
import { useAuth } from "@/hooks/useAuth";

export default function ResidentLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, signOut } = useAuth();
  const societyName = user?.societyName || "RWA Connect";
  const isMultiSociety = user?.multiSociety ?? false;

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
