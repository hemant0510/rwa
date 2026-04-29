import Image from "next/image";
import Link from "next/link";

import { Logo } from "@/components/features/marketing/Logo";
import { ThemeToggle } from "@/components/features/marketing/ThemeToggle";

interface FooterColumn {
  title: string;
  links: { label: string; href: string }[];
}

const FOOTER_COLUMNS: FooterColumn[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/features" },
      { label: "Pricing", href: "/pricing" },
      { label: "For Admins", href: "/for-admins" },
      { label: "For Residents", href: "/for-residents" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Security", href: "/security" },
      { label: "Get Started", href: "/register-society" },
      { label: "Sign in", href: "/login" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Refund Policy", href: "/refund-policy" },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="bg-muted/30 border-t">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Logo size="md" />
            <p className="text-muted-foreground mt-4 max-w-xs text-sm">
              The operating system for Indian housing societies. Built for residents, secretaries,
              and treasurers who actually want to use software.
            </p>
            <a
              href="https://navaratech.in"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:border-primary/40 bg-background/50 mt-6 inline-flex items-center gap-3 rounded-lg border px-4 py-3 transition-all hover:shadow-sm"
              aria-label="A product by Navara Tech — opens navaratech.in"
            >
              <span className="text-muted-foreground text-xs tracking-wide uppercase">
                A product by
              </span>
              <Image
                src="/marketing/navara-logo.svg"
                alt="Navara Tech"
                width={122}
                height={32}
                className="h-7 w-auto dark:hidden"
                priority={false}
              />
              <Image
                src="/marketing/navara-logo-reversed.svg"
                alt="Navara Tech"
                width={122}
                height={32}
                className="hidden h-7 w-auto dark:block"
                priority={false}
              />
            </a>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:col-span-8">
            {FOOTER_COLUMNS.map((col) => (
              <div key={col.title}>
                <h3 className="text-foreground text-sm font-semibold">{col.title}</h3>
                <ul className="mt-4 space-y-3">
                  {col.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t pt-8 sm:flex-row">
          <p className="text-muted-foreground text-xs">
            &copy; {new Date().getFullYear()}{" "}
            <a
              href="https://navaratech.in"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground underline-offset-2 hover:underline"
            >
              Navara Tech
            </a>
            . Empowering communities. Elevating lives.
          </p>
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground text-xs">DPDP-aligned · Made in India</span>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </footer>
  );
}
