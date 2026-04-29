import Link from "next/link";

import { Database, FileLock, Globe, KeyRound, Mail, ShieldCheck } from "lucide-react";

import { CtaBand } from "@/components/features/marketing/sections/CtaBand";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security — RWA Connect",
  description:
    "DPDP-aligned. Postgres RLS for tenant isolation. Audit logs. Rate limiting. Read our security overview.",
};

const SECTIONS = [
  {
    id: "data-protection",
    icon: ShieldCheck,
    title: "Data protection",
    body: [
      "Built to align with India's Digital Personal Data Protection Act, 2023 (DPDP Act). Privacy policy enumerates collected data, purposes, retention, and data-subject rights.",
      "Data is hosted in the Asia-Pacific (Supabase ap-south region) — no cross-border transfer required.",
      "Encryption in transit (TLS 1.2+) and at rest (AES-256) for all stored data.",
    ],
  },
  {
    id: "access-control",
    icon: KeyRound,
    title: "Access control",
    body: [
      "Four roles, scoped exactly: Super Admin, RWA Admin, Counsellor, Resident.",
      "Residents never see admin pages. Admins never see other societies. Counsellors never see your finances.",
      "Multi-factor authentication required for Super Admin and Counsellor accounts.",
    ],
  },
  {
    id: "isolation",
    icon: Database,
    title: "Database isolation",
    body: [
      "Every multi-tenant table has Postgres Row-Level Security (RLS) policies enforced at the database layer — not just the application layer.",
      "A query for one society's data physically cannot return rows from another society's data — even in the case of an application bug.",
      "Tested with cross-society isolation E2E tests on every release.",
    ],
  },
  {
    id: "operations",
    icon: Globe,
    title: "Operations",
    body: [
      "Daily encrypted backups via Supabase Pro — point-in-time recovery available.",
      "Production errors surface in Sentry within seconds — we know about issues before users report them.",
      "Rate-limited login and forgot-password flows to resist brute-force attacks.",
    ],
  },
  {
    id: "compliance",
    icon: FileLock,
    title: "Compliance posture",
    body: [
      "DPDP Act 2023 — privacy policy enumerates data-subject rights (access, correction, erasure, nomination). Self-service DSAR (data subject access request) flows are on the roadmap; today, residents request via their RWA Admin or via support.",
      "Information Technology Act 2000 — data privacy and security obligations.",
      "RBI / NPCI rules for any UPI surface — your money never transits our systems on UPI claim flow.",
      "Note: We are DPDP-aligned, not formally certified. Our gap list (consent record metadata, self-service DSAR, breach-response runbook, named DPO) is published with each release. Email security@rwaconnect.in for the current status.",
    ],
  },
  {
    id: "disclosure",
    icon: Mail,
    title: "Responsible disclosure",
    body: [
      "Found a security issue? We want to know.",
      "Email security@rwaconnect.in with details — we acknowledge within 48 hours.",
      "We don't pursue legal action against good-faith researchers.",
    ],
  },
];

export default function SecurityPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="from-primary/10 via-background to-background pointer-events-none absolute inset-0 bg-gradient-to-b"
        />
        <div className="relative mx-auto max-w-3xl px-4 pt-20 pb-12 text-center sm:px-6">
          <p className="text-primary mb-3 text-sm font-semibold tracking-wide uppercase">Trust</p>
          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Security by design, not by promise.
          </h1>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
            We protect your residents&apos; data the way we&apos;d want our own protected.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:grid lg:grid-cols-12 lg:gap-10">
        <aside className="hidden lg:col-span-3 lg:block">
          <nav className="sticky top-24 space-y-1" aria-label="Security topics">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="text-muted-foreground hover:text-foreground hover:bg-accent block rounded-md px-3 py-2 text-sm transition-colors"
              >
                {s.title}
              </a>
            ))}
          </nav>
        </aside>

        <div className="space-y-12 lg:col-span-9">
          {SECTIONS.map((s) => (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              <div className="mb-4 flex items-center gap-3">
                <div className="bg-primary/10 text-primary inline-flex h-10 w-10 items-center justify-center rounded-xl">
                  <s.icon className="h-5 w-5" />
                </div>
                <h2 className="text-2xl font-bold tracking-tight">{s.title}</h2>
              </div>
              <ul className="text-muted-foreground space-y-3 text-base leading-relaxed">
                {s.body.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          ))}

          <div className="bg-muted/40 rounded-2xl border p-6">
            <p className="text-muted-foreground text-sm">
              Want a deeper dive (data flow diagrams, architecture, audit reports)? Email{" "}
              <Link
                href="mailto:security@rwaconnect.in"
                className="text-primary font-medium underline"
              >
                security@rwaconnect.in
              </Link>{" "}
              — we&apos;ll send a security pack under NDA.
            </p>
          </div>
        </div>
      </div>

      <CtaBand />
    </>
  );
}
