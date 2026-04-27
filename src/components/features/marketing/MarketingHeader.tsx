import Link from "next/link";

import { Logo } from "@/components/features/marketing/Logo";
import { MobileNavDrawer } from "@/components/features/marketing/MobileNavDrawer";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { label: "Features", href: "/features" },
  { label: "Pricing", href: "/pricing" },
  { label: "For Admins", href: "/for-admins" },
  { label: "For Residents", href: "/for-residents" },
  { label: "Contact", href: "/contact" },
];

export function MarketingHeader() {
  return (
    <>
      <a
        href="#main-content"
        className="bg-primary text-primary-foreground sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:px-3 focus:py-2 focus:text-sm focus:font-medium"
      >
        Skip to main content
      </a>
      <header className="bg-background sticky top-0 z-40 border-b">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6">
          <Logo />

          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-muted-foreground hover:text-foreground hover:bg-accent rounded-md px-3 py-2 text-sm font-medium transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 md:flex">
              <Link href="/login">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </Link>
              <Link href="/register-society">
                <Button size="sm">Get started</Button>
              </Link>
            </div>
            <MobileNavDrawer navItems={NAV_ITEMS} />
          </div>
        </div>
      </header>
    </>
  );
}
