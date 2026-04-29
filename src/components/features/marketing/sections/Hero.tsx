import Image from "next/image";
import Link from "next/link";

import {
  ArrowRight,
  BadgeCheck,
  FileSignature,
  ShieldCheck,
  Smartphone,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";

const TRUST_PILLS = [
  { icon: Smartphone, label: "Zero-fee UPI" },
  { icon: FileSignature, label: "Digital petitions" },
  { icon: ShieldCheck, label: "Counsellor program" },
  { icon: Users, label: "Household registry" },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Decorative gradient backdrop */}
      <div
        aria-hidden="true"
        className="from-primary/10 via-background to-background pointer-events-none absolute inset-0 bg-gradient-to-b"
      />
      <div
        aria-hidden="true"
        className="bg-primary/15 pointer-events-none absolute -top-32 -right-32 h-96 w-96 rounded-full blur-3xl"
      />
      <div
        aria-hidden="true"
        className="bg-chart-2/15 pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 rounded-full blur-3xl"
      />

      <div className="relative mx-auto max-w-7xl px-4 pt-16 pb-12 sm:px-6 sm:pt-24 lg:pt-28">
        <div className="mx-auto max-w-4xl text-center">
          <div className="bg-primary/10 text-primary border-primary/20 mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium">
            <BadgeCheck className="h-3.5 w-3.5" />
            Built for Indian housing societies
          </div>
          <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            The operating system for your{" "}
            <span className="from-primary to-chart-2 bg-gradient-to-br bg-clip-text text-transparent">
              housing society
            </span>
            .
          </h1>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg leading-relaxed sm:text-xl">
            Onboard residents in 60 seconds. Collect fees over UPI with zero gateway charges. Run
            petitions, community events, and resident support — from one app your secretary,
            treasurer, and residents will actually use.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register-society">
              <Button size="lg" className="w-full sm:w-auto">
                Get started — 14-day trial
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                See pricing
              </Button>
            </Link>
          </div>

          <p className="text-muted-foreground mt-5 text-xs">
            14-day free trial · No credit card · DPDP-aligned · ₹0 UPI fees
          </p>

          {/* Differentiator pills */}
          <div className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-2">
            {TRUST_PILLS.map((pill) => (
              <span
                key={pill.label}
                className="bg-background/80 border-border text-foreground inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm shadow-sm backdrop-blur"
              >
                <pill.icon className="text-primary h-4 w-4" />
                {pill.label}
              </span>
            ))}
          </div>

          {/* Built-by strip */}
          <a
            href="https://navaratech.in"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground mt-8 inline-flex items-center gap-2 text-xs transition-colors"
            aria-label="A product by Navara Tech — opens navaratech.in"
          >
            <span>From the team at</span>
            <Image
              src="/marketing/navara-logo.svg"
              alt="Navara Tech"
              width={90}
              height={24}
              className="h-5 w-auto dark:hidden"
              priority={false}
            />
            <Image
              src="/marketing/navara-logo-reversed.svg"
              alt="Navara Tech"
              width={90}
              height={24}
              className="hidden h-5 w-auto dark:block"
              priority={false}
            />
          </a>
        </div>

        {/* Dashboard mockup placeholder */}
        <div className="mx-auto mt-16 max-w-5xl">
          <div className="from-primary/30 to-chart-2/30 rounded-2xl bg-gradient-to-br p-1 shadow-2xl">
            <div className="bg-background overflow-hidden rounded-xl border">
              <div className="bg-muted/40 flex items-center gap-1.5 border-b px-4 py-3">
                <div className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
                <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
                <div className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
                <div className="bg-background text-muted-foreground ml-3 flex-1 rounded px-3 py-1 text-xs">
                  rwaconnect.in/admin
                </div>
              </div>
              <DashboardMockup />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DashboardMockup() {
  const stats = [
    { label: "Residents", value: "248", trend: "+12 this month" },
    { label: "Fees collected", value: "₹4.8L", trend: "92% paid" },
    { label: "Open tickets", value: "7", trend: "3 escalated" },
    { label: "Events live", value: "2", trend: "Holi + AGM" },
  ];

  return (
    <div className="grid gap-4 p-6 sm:grid-cols-12 sm:gap-6">
      {/* Sidebar skeleton */}
      <div className="hidden flex-col gap-2 sm:col-span-3 sm:flex lg:col-span-2">
        <div className="bg-primary/15 h-8 rounded-md" />
        <div className="bg-muted h-7 rounded-md" />
        <div className="bg-muted h-7 rounded-md" />
        <div className="bg-muted h-7 rounded-md" />
        <div className="bg-muted h-7 rounded-md" />
      </div>

      <div className="sm:col-span-9 lg:col-span-10">
        {/* Page header */}
        <div className="mb-5 flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-foreground text-base font-semibold">Society Overview</div>
            <div className="text-muted-foreground text-xs">Greenwood Residency · Sector 15</div>
          </div>
          <div className="from-primary to-chart-2 rounded-md bg-gradient-to-r px-3 py-1.5 text-xs font-medium text-white">
            Pro plan
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-card rounded-lg border p-3">
              <div className="text-muted-foreground text-xs">{s.label}</div>
              <div className="text-foreground mt-1 text-xl font-bold">{s.value}</div>
              <div className="text-primary mt-0.5 text-[10px]">{s.trend}</div>
            </div>
          ))}
        </div>

        {/* Activity rows */}
        <div className="mt-5 space-y-2">
          {[
            "Arjun K. paid ₹12,000 via UPI · UTR 24042…",
            "Petition: Water-pressure complaint · 23 of 50 signed",
            "Counsellor escalation acknowledged · ticket #341",
          ].map((row) => (
            <div
              key={row}
              className="bg-muted/40 text-foreground flex items-center justify-between rounded-md px-3 py-2 text-xs"
            >
              <span className="truncate">{row}</span>
              <span className="text-muted-foreground ml-3 shrink-0 text-[10px]">just now</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
