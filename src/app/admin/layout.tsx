"use client";

import { useState } from "react";

import { TrialBanner } from "@/components/features/TrialBanner";
import { AdminSidebar, AdminMobileSidebar } from "@/components/layout/AdminSidebar";
import { Header } from "@/components/layout/Header";
import { useAuth } from "@/hooks/useAuth";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, signOut } = useAuth();
  const societyName = user?.societyName || "RWA Connect";

  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar societyName={societyName} />
      <AdminMobileSidebar
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        societyName={societyName}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          title={societyName}
          subtitle="Admin Portal"
          userName={user?.name || "Admin"}
          showMenuButton
          onMenuToggle={() => setSidebarOpen(true)}
          onSignOut={signOut}
        />
        <TrialBanner />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
