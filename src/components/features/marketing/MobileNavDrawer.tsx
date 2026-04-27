"use client";

import { useState } from "react";

import Link from "next/link";

import { Menu } from "lucide-react";

import { Logo } from "@/components/features/marketing/Logo";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

interface NavItem {
  label: string;
  href: string;
}

interface MobileNavDrawerProps {
  navItems: NavItem[];
}

export function MobileNavDrawer({ navItems }: MobileNavDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Open menu" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[300px] sm:w-[360px]">
        <SheetHeader className="border-b">
          <SheetTitle>
            <Logo />
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-1 p-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="hover:bg-accent text-foreground rounded-md px-3 py-2.5 text-base font-medium transition-colors"
            >
              {item.label}
            </Link>
          ))}
          <div className="mt-4 flex flex-col gap-2 border-t pt-4">
            <Link href="/login" onClick={() => setOpen(false)}>
              <Button variant="outline" className="w-full">
                Sign in
              </Button>
            </Link>
            <Link href="/register-society" onClick={() => setOpen(false)}>
              <Button className="w-full">Get started</Button>
            </Link>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
