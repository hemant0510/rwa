"use client";

import { useState } from "react";

import { Header } from "@/components/layout/Header";
import { SuperAdminSidebar, SuperAdminMobileSidebar } from "@/components/layout/SuperAdminSidebar";
import { useAuth } from "@/hooks/useAuth";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { signOut } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden">
      <SuperAdminSidebar />
      <SuperAdminMobileSidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          title="RWA Connect — Super Admin"
          userName="Super Admin"
          showMenuButton
          onMenuToggle={() => setSidebarOpen(true)}
          onSignOut={signOut}
        />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
