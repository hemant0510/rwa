"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  CreditCard,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Receipt,
  Settings,
  Upload,
  Users,
} from "lucide-react";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/residents", label: "Residents", icon: Users },
  { href: "/admin/fees", label: "Fees", icon: CreditCard },
  { href: "/admin/expenses", label: "Expenses", icon: Receipt },
  { href: "/admin/reports", label: "Reports", icon: FileText },
  { href: "/admin/broadcast", label: "Broadcast", icon: MessageSquare },
  { href: "/admin/migration", label: "Migration", icon: Upload },
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

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-6 py-4">
        <h2 className="truncate text-lg font-bold">{societyName || "RWA Connect"}</h2>
        <p className="text-muted-foreground text-xs">Admin Portal</p>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive = pathname?.includes(item.href);
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
              {item.label}
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
        <SidebarContent societyName={societyName} queryString={queryString} />
      </SheetContent>
    </Sheet>
  );
}
