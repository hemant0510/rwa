import Link from "next/link";

import { ArrowRight, BadgeCheck, Calculator, Calendar, FileText, ShieldCheck } from "lucide-react";

import { CtaBand } from "@/components/features/marketing/sections/CtaBand";
import { Button } from "@/components/ui/button";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "For Admins — RWA Connect",
  description:
    "Run your society without spreadsheets, WhatsApp groups, and Excel hell. Built for secretaries, treasurers, and presidents.",
};

const PAINS = [
  {
    icon: Calculator,
    pain: "Fee chasing month after month",
    fix: "Live fee dashboard, pro-rata maths, UPI claim flow with one-click verification. Reminders go out via WhatsApp + email.",
  },
  {
    icon: FileText,
    pain: "Bank reconciliation by hand",
    fix: "Resident submits the UTR after paying. You match against your bank statement, click confirm. Auto receipt emailed.",
  },
  {
    icon: Calendar,
    pain: "AGM logistics chaos",
    fix: "Free RSVP events with attendee list. Past minutes, governing body roster, designations — all surfaced in the app.",
  },
];

export default function ForAdminsPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="from-primary/10 via-background to-background pointer-events-none absolute inset-0 bg-gradient-to-b"
        />
        <div className="relative mx-auto max-w-4xl px-4 pt-20 pb-12 text-center sm:px-6">
          <p className="text-primary mb-3 text-sm font-semibold tracking-wide uppercase">
            For RWA admins
          </p>
          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Run your society without spreadsheets, WhatsApp groups, and Excel hell.
          </h1>
          <p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-lg">
            Built for secretaries, treasurers, and presidents who actually want their evenings back.
          </p>
          <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register-society">
              <Button size="lg" className="w-full sm:w-auto">
                Start 14-day trial
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                See pricing
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="mb-12 text-center text-3xl font-bold tracking-tight">
          The three jobs RWA admins hate — fixed
        </h2>
        <div className="grid gap-6 lg:grid-cols-3">
          {PAINS.map((p) => (
            <div key={p.pain} className="bg-card rounded-2xl border p-7">
              <div className="from-primary to-chart-2 text-primary-foreground mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br">
                <p.icon className="h-6 w-6" />
              </div>
              <h3 className="text-foreground mb-2 text-lg font-semibold">{p.pain}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{p.fix}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-muted/30 border-y">
        <div className="mx-auto max-w-5xl px-4 py-16 text-center sm:px-6">
          <ShieldCheck className="text-primary mx-auto mb-4 h-10 w-10" />
          <h2 className="mb-4 text-2xl font-bold tracking-tight sm:text-3xl">
            Trustworthy by design
          </h2>
          <p className="text-muted-foreground mx-auto mb-8 max-w-2xl text-lg">
            Built around the DPDP Act 2023. Audit logs on every admin action. Role-based access so
            your treasurer can&apos;t see what your secretary edited.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              "DPDP-aligned",
              "Postgres RLS isolation",
              "Audit log per action",
              "Role-based access",
              "Brute-force resistance",
            ].map((tag) => (
              <span
                key={tag}
                className="bg-background border-border inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm shadow-sm"
              >
                <BadgeCheck className="text-primary h-4 w-4" />
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
