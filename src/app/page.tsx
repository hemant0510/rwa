import Link from "next/link";

import { Building2, Shield, Users, CreditCard, Receipt, MessageSquare } from "lucide-react";

import { Button } from "@/components/ui/button";

const features = [
  {
    icon: Building2,
    title: "Society Onboarding",
    desc: "Register any society type — apartments, villas, independent houses",
  },
  {
    icon: Users,
    title: "Resident Management",
    desc: "QR-based registration, approval workflow, digital RWAID cards",
  },
  {
    icon: CreditCard,
    title: "Fee Collection",
    desc: "Pro-rata calculations, multiple payment modes, auto receipts",
  },
  {
    icon: Receipt,
    title: "Expense Tracking",
    desc: "Category-wise expenses, correction windows, resident transparency",
  },
  {
    icon: MessageSquare,
    title: "WhatsApp Alerts",
    desc: "Automated notifications for payments, approvals, and broadcasts",
  },
  {
    icon: Shield,
    title: "Secure & Transparent",
    desc: "Role-based access, audit trails, and complete financial visibility",
  },
];

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 border-b backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Building2 className="text-primary h-6 w-6" />
            <span className="text-xl font-bold">RWA Connect</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
            <Link href="/register-society">
              <Button variant="outline" size="sm">
                Register Society
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 py-20 text-center">
          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Modern RWA Management, <span className="text-primary">Simplified</span>
          </h1>
          <p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-lg">
            Digital-first platform for Resident Welfare Associations. Manage residents, collect
            fees, track expenses, and communicate — all in one place.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/register-society">
              <Button size="lg">Get Started</Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                Sign In
              </Button>
            </Link>
          </div>
        </section>

        <section className="bg-muted/30 border-t py-16">
          <div className="mx-auto max-w-6xl px-4">
            <h2 className="mb-10 text-center text-2xl font-bold">Everything your RWA needs</h2>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <div key={f.title} className="bg-card rounded-lg border p-6">
                  <f.icon className="text-primary mb-3 h-8 w-8" />
                  <h3 className="mb-1 font-semibold">{f.title}</h3>
                  <p className="text-muted-foreground text-sm">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="text-muted-foreground border-t py-6 text-center text-sm">
        <p>RWA Connect &mdash; Built for Indian housing societies</p>
      </footer>
    </div>
  );
}
