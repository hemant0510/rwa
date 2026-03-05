"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { CreditCard, Home, Receipt, User } from "lucide-react";

import { cn } from "@/lib/utils";

const tabs = [
  { href: "/r/home", label: "Home", icon: Home },
  { href: "/r/payments", label: "Payments", icon: CreditCard },
  { href: "/r/expenses", label: "Expenses", icon: Receipt },
  { href: "/r/profile", label: "Profile", icon: User },
];

export function ResidentBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="bg-background fixed inset-x-0 bottom-0 z-50 border-t">
      <div className="flex h-16 items-center justify-around">
        {tabs.map((tab) => {
          const isActive = pathname?.includes(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 text-xs transition-colors",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              <tab.icon className={cn("h-5 w-5", isActive && "text-primary")} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
