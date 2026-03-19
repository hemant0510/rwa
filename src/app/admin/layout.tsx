"use client";

import { useState } from "react";

import Link from "next/link";

import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { SocietySwitcher } from "@/components/features/SocietySwitcher";
import { TrialBanner } from "@/components/features/TrialBanner";
import { AdminSidebar, AdminMobileSidebar } from "@/components/layout/AdminSidebar";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useIdleTimeout } from "@/hooks/useIdleTimeout";
import { useSocietyId } from "@/hooks/useSocietyId";
import { ADMIN_SESSION_TIMEOUT_MS } from "@/lib/constants";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, signOut } = useAuth();
  const { societyName: overrideName, isSuperAdminViewing, saQueryString } = useSocietyId();

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

  const societyName = isSuperAdminViewing
    ? (overrideName ?? "Society")
    : user?.societyName || "RWA Connect";

  return (
    <div className="flex h-screen overflow-hidden">
      <AdminSidebar societyName={societyName} queryString={saQueryString} />
      <AdminMobileSidebar
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        societyName={societyName}
        queryString={saQueryString}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        {isSuperAdminViewing && (
          <div className="flex items-center gap-3 border-b border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-200">
            <span className="flex-1">
              Viewing as <strong>{societyName}</strong>
            </span>
            <Link href="/sa/dashboard">
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                <ArrowLeft className="h-3 w-3" />
                Super Admin Dashboard
              </Button>
            </Link>
          </div>
        )}
        <Header
          title="RWA Admin"
          subtitle={societyName}
          userName={user?.name || "Admin"}
          showMenuButton
          onMenuToggle={() => setSidebarOpen(true)}
          onSignOut={isSuperAdminViewing ? undefined : signOut}
          societySwitcher={
            !isSuperAdminViewing && user?.multiSociety ? <SocietySwitcher /> : undefined
          }
        />
        {!isSuperAdminViewing && <TrialBanner />}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
