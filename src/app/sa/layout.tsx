"use client";

import { useState } from "react";

import { toast } from "sonner";

import { Header } from "@/components/layout/Header";
import { SuperAdminSidebar, SuperAdminMobileSidebar } from "@/components/layout/SuperAdminSidebar";
import { useAuth } from "@/hooks/useAuth";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { ADMIN_SESSION_TIMEOUT_MS } from "@/lib/constants";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { signOut } = useAuth();

  useIdleTimeout({
    timeoutMs: ADMIN_SESSION_TIMEOUT_MS,
    onWarning: () => {
      toast.warning("Session expiring soon", {
        description: "You'll be signed out in 15 minutes due to inactivity.",
        duration: 10_000,
      });
    },
    onTimeout: () => {
      void signOut();
    },
  });

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
