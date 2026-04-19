"use client";

import { useState } from "react";

import { CounsellorMobileSidebar, CounsellorSidebar } from "@/components/layout/CounsellorSidebar";
import { Header } from "@/components/layout/Header";
import { useAuth } from "@/hooks/useAuth";

interface CounsellorShellProps {
  counsellorName: string;
  children: React.ReactNode;
}

export function CounsellorShell({ counsellorName, children }: CounsellorShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { signOut } = useAuth();

  return (
    <div className="flex h-screen overflow-hidden">
      <CounsellorSidebar counsellorName={counsellorName} />
      <CounsellorMobileSidebar
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        counsellorName={counsellorName}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          title="Counsellor"
          subtitle={counsellorName}
          userName={counsellorName}
          profileHref="/counsellor/profile"
          showMenuButton
          onMenuToggle={() => setSidebarOpen(true)}
          onSignOut={signOut}
        />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
