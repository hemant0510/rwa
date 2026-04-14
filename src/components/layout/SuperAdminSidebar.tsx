"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  Bell,
  Building2,
  LayoutDashboard,
  Layers,
  LifeBuoy,
  Megaphone,
  ReceiptIndianRupee,
  ScrollText,
  Settings,
  Shield,
  Tag,
  Users,
} from "lucide-react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { getSaPendingSubClaimsCount } from "@/services/subscription-payment-claims";

const navItems = [
  { href: "/sa/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sa/notifications", label: "Alerts", icon: Bell },
  { href: "/sa/societies", label: "Societies", icon: Building2 },
  { href: "/sa/billing", label: "Billing", icon: ReceiptIndianRupee },
  { href: "/sa/plans", label: "Plans", icon: Layers },
  { href: "/sa/discounts", label: "Discounts", icon: Tag },
  { href: "/sa/residents", label: "Residents", icon: Users },
  { href: "/sa/counsellors", label: "Counsellors", icon: Shield },
  { href: "/sa/operations", label: "Operations", icon: Activity },
  { href: "/sa/announcements", label: "Announcements", icon: Megaphone },
  { href: "/sa/support", label: "Support", icon: LifeBuoy },
  { href: "/sa/audit-logs", label: "Audit Logs", icon: ScrollText },
  { href: "/sa/settings", label: "Settings", icon: Settings },
];

function SidebarContent() {
  const pathname = usePathname();

  const { data: pendingSubClaimsData } = useQuery({
    queryKey: ["sa-sub-claims-pending-count"],
    queryFn: getSaPendingSubClaimsCount,
    staleTime: 30_000,
  });
  const pendingSubCount = pendingSubClaimsData?.count ?? 0;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-6 py-4">
        <h2 className="text-lg font-bold">RWA Connect</h2>
        <p className="text-muted-foreground text-xs">Super Admin</p>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive = pathname?.includes(item.href);
          const isBilling = item.href === "/sa/billing";
          const badge = isBilling && pendingSubCount > 0 ? pendingSubCount : null;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {badge && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-xs leading-none font-semibold",
                    isActive
                      ? "bg-primary-foreground text-primary"
                      : "bg-destructive text-destructive-foreground",
                  )}
                >
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function SuperAdminSidebar() {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="bg-background hidden w-[280px] shrink-0 border-r lg:block">
        <SidebarContent />
      </aside>
    </>
  );
}

export function SuperAdminMobileSidebar({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[280px] p-0">
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
        <SidebarContent />
      </SheetContent>
    </Sheet>
  );
}
