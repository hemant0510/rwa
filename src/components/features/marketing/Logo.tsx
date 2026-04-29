import Link from "next/link";

import { Building2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface LogoProps {
  href?: string;
  size?: "sm" | "md" | "lg";
  asLink?: boolean;
  showWordmark?: boolean;
  className?: string;
}

const SIZE_MAP = {
  sm: { icon: "h-5 w-5", text: "text-base", gap: "gap-1.5" },
  md: { icon: "h-6 w-6", text: "text-lg", gap: "gap-2" },
  lg: { icon: "h-8 w-8", text: "text-xl", gap: "gap-2.5" },
} as const;

export function Logo({
  href = "/",
  size = "md",
  asLink = true,
  showWordmark = true,
  className,
}: LogoProps) {
  const dims = SIZE_MAP[size];

  const content = (
    <span className={cn("flex items-center", dims.gap, className)}>
      <span
        className={cn(
          "from-primary to-chart-2 inline-flex items-center justify-center rounded-lg bg-gradient-to-br p-1.5 text-white shadow-sm",
        )}
        aria-hidden="true"
      >
        <Building2 className={dims.icon} />
      </span>
      {showWordmark ? (
        <span className={cn("text-foreground font-bold tracking-tight", dims.text)}>
          RWA Connect
        </span>
      ) : null}
    </span>
  );

  if (!asLink) return content;

  return (
    <Link
      href={href}
      aria-label="RWA Connect — home"
      className="focus-visible:ring-ring rounded-md transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      {content}
    </Link>
  );
}
