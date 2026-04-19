"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  BarChart3,
  Building2,
  LayoutDashboard,
  LifeBuoy,
  Settings,
  Ticket,
  User,
} from "lucide-react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/counsellor", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/counsellor/societies", label: "Societies", icon: Building2 },
  { href: "/counsellor/tickets", label: "Tickets", icon: Ticket },
  { href: "/counsellor/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/counsellor/onboarding", label: "Onboarding", icon: LifeBuoy },
  { href: "/counsellor/profile", label: "Profile", icon: User },
  { href: "/counsellor/settings", label: "Settings", icon: Settings },
];

function isItemActive(pathname: string | null, href: string, exact?: boolean) {
  if (!pathname) return false;
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function SidebarContent({ counsellorName }: { counsellorName?: string }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-6 py-4">
        <h2 className="truncate text-lg font-bold">Counsellor</h2>
        <p className="text-muted-foreground text-xs">{counsellorName || "Counsellor Portal"}</p>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive = isItemActive(pathname, item.href, item.exact);
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
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function CounsellorSidebar({ counsellorName }: { counsellorName?: string }) {
  return (
    <aside className="bg-background hidden w-[240px] shrink-0 border-r lg:block">
      <SidebarContent counsellorName={counsellorName} />
    </aside>
  );
}

export function CounsellorMobileSidebar({
  open,
  onOpenChange,
  counsellorName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  counsellorName?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[240px] p-0">
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
        <SidebarContent counsellorName={counsellorName} />
      </SheetContent>
    </Sheet>
  );
}
