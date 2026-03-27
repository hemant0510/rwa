"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { CalendarDays, CreditCard, FileSignature, Home, Receipt, User } from "lucide-react";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/r/home", label: "Home", icon: Home },
  { href: "/r/payments", label: "Payments", icon: CreditCard },
  { href: "/r/expenses", label: "Expenses", icon: Receipt },
  { href: "/r/events", label: "Events", icon: CalendarDays },
  { href: "/r/petitions", label: "Petitions", icon: FileSignature },
  { href: "/r/profile", label: "Profile", icon: User },
];

function SidebarContent({ societyName }: { societyName?: string }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b px-6 py-4">
        <h2 className="truncate text-lg font-bold">RWA Connect</h2>
        <p className="text-muted-foreground text-xs">{societyName || "Resident Portal"}</p>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const isActive = pathname?.includes(item.href);
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
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function ResidentSidebar({ societyName }: { societyName?: string }) {
  return (
    <aside className="bg-background hidden w-[240px] shrink-0 border-r lg:block">
      <SidebarContent societyName={societyName} />
    </aside>
  );
}

export function ResidentMobileSidebar({
  open,
  onOpenChange,
  societyName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  societyName?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[240px] p-0">
        <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
        <SidebarContent societyName={societyName} />
      </SheetContent>
    </Sheet>
  );
}
