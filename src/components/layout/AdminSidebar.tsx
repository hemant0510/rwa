"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useQuery } from "@tanstack/react-query";
import {
  Bell,
  Calendar,
  CreditCard,
  Crown,
  FileSignature,
  FileText,
  Headphones,
  LayoutDashboard,
  LifeBuoy,
  MessageSquare,
  Receipt,
  Settings,
  Upload,
  Users,
} from "lucide-react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { getAdminPendingClaimsCount } from "@/services/admin-payment-claims";
import { getUnreadAnnouncements } from "@/services/announcements";
import { getAdminResidentUnreadCount } from "@/services/resident-support";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/residents", label: "Residents", icon: Users },
  { href: "/admin/fees", label: "Fees", icon: CreditCard },
  { href: "/admin/expenses", label: "Expenses", icon: Receipt },
  { href: "/admin/events", label: "Events", icon: Calendar },
  { href: "/admin/petitions", label: "Petitions", icon: FileSignature },
  { href: "/admin/reports", label: "Reports", icon: FileText },
  { href: "/admin/broadcast", label: "Broadcast", icon: MessageSquare },
  { href: "/admin/governing-body", label: "Governing Body", icon: Crown },
  { href: "/admin/migration", label: "Migration", icon: Upload },
  { href: "/admin/resident-support", label: "Resident Support", icon: Headphones },
  { href: "/admin/support", label: "Support", icon: LifeBuoy },
  { href: "/admin/announcements", label: "Announcements", icon: Bell },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

function SidebarContent({
  societyName,
  queryString,
}: {
  societyName?: string;
  queryString?: string;
}) {
  const pathname = usePathname();
  const qs = queryString || "";
  const { user } = useAuth();
  const sid = queryString ? new URLSearchParams(queryString.replace(/^\?/, "")).get("sid") : null;
  const societyId = sid ?? user?.societyId ?? "";

  const { data: announcements = [] } = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: getUnreadAnnouncements,
    staleTime: 60_000,
  });

  const { data: pendingClaimsData } = useQuery({
    queryKey: ["fees-pending-count", societyId],
    queryFn: () => getAdminPendingClaimsCount(societyId),
    staleTime: 30_000,
    enabled: !!societyId,
  });

  const { data: residentUnreadData } = useQuery({
    queryKey: ["admin-resident-support-unread"],
    queryFn: getAdminResidentUnreadCount,
    staleTime: 30_000,
    enabled: !!societyId,
  });

  const unreadCount = announcements.length;
  const pendingClaimsCount = pendingClaimsData?.count ?? 0;
  const residentUnreadCount = residentUnreadData?.count ?? 0;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-6 py-4">
        <h2 className="truncate text-lg font-bold">RWA Admin</h2>
        <p className="text-muted-foreground text-xs">{societyName || "Admin Portal"}</p>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive = pathname?.includes(item.href);
          const isAnnouncements = item.href === "/admin/announcements";
          const isFees = item.href === "/admin/fees";
          const isResidentSupport = item.href === "/admin/resident-support";
          return (
            <Link
              key={item.href}
              href={`${item.href}${qs}`}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {isAnnouncements && unreadCount > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-xs leading-none font-semibold",
                    isActive ? "bg-primary-foreground text-primary" : "bg-red-500 text-white",
                  )}
                >
                  {unreadCount}
                </span>
              )}
              {isFees && pendingClaimsCount > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-xs leading-none font-semibold",
                    isActive
                      ? "bg-primary-foreground text-primary"
                      : "bg-destructive text-destructive-foreground",
                  )}
                >
                  {pendingClaimsCount}
                </span>
              )}
              {isResidentSupport && residentUnreadCount > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-xs leading-none font-semibold",
                    isActive ? "bg-primary-foreground text-primary" : "bg-red-500 text-white",
                  )}
                >
                  {residentUnreadCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function AdminSidebar({
  societyName,
  queryString,
}: {
  societyName?: string;
  queryString?: string;
}) {
  return (
    <aside className="bg-background hidden w-[240px] shrink-0 border-r lg:block">
      <SidebarContent societyName={societyName} queryString={queryString} />
    </aside>
  );
}

export function AdminMobileSidebar({
  open,
  onOpenChange,
  societyName,
  queryString,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  societyName?: string;
  queryString?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[240px] p-0">
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
        <SidebarContent societyName={societyName} queryString={queryString} />
      </SheetContent>
    </Sheet>
  );
}
