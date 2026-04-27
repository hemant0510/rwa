import {
  CalendarDays,
  FileSignature,
  LifeBuoy,
  MessageSquare,
  QrCode,
  Receipt,
  ShieldCheck,
  Smartphone,
  Users,
  Vote,
} from "lucide-react";

import { FeatureModuleSection } from "@/components/features/marketing/features/FeatureModuleSection";
import { CtaBand } from "@/components/features/marketing/sections/CtaBand";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Features — RWA Connect",
  description:
    "Ten product modules covering household registry, fee collection, expenses, support tickets, petitions, community events, counsellor program, governance, communication, and platform trust.",
};

const MODULES = [
  {
    id: "household",
    eyebrow: "Module 01",
    title: "Resident management & household registry",
    description:
      "Onboard residents in 60 seconds. Each household tracks family, vehicles, pets, and helpers under one roof — every dependent gets a sub-ID for gate pass and amenity check-in.",
    bullets: [
      "QR-based onboarding (60-second resident join)",
      "Digital RWAID cards, usable for gate pass, gym, amenity",
      "Family members under one household with sub-IDs (M1, M2…)",
      "Vehicle registry with owner attribution + plate-number search",
      "Pet & domestic helper registry",
      "Resident profile, photo, contact details — owned by the resident",
    ],
    icon: Users,
    accent: "from-violet-500 to-violet-600",
  },
  {
    id: "payments",
    eyebrow: "Module 02",
    title: "Zero-fee UPI fee collection",
    description:
      "Residents scan your society's UPI QR, pay through GPay/PhonePe/Paytm, submit the UTR — you confirm in one click. No gateway fees. Pro-rata maths handled automatically.",
    bullets: [
      "Pro-rata calculations for mid-cycle joiners",
      "Multiple payment modes: cash, bank transfer, UPI, manual",
      "Zero-fee UPI QR claim flow with admin verification",
      "Resident fee dashboard + payment history across years",
      "PDF receipts auto-generated and emailed",
      "48-hour correction window on entries (then locked for audit)",
    ],
    icon: QrCode,
    accent: "from-emerald-500 to-emerald-600",
  },
  {
    id: "fees",
    eyebrow: "Module 03",
    title: "Expense tracking & financial transparency",
    description:
      "Categorise every expense. Attach receipts. Show residents exactly where their maintenance fee goes — and watch on-time payment rates climb.",
    bullets: [
      "Category-wise expense ledger with receipt attachments",
      "Resident-visible expense view (toggle per society)",
      "Quarterly + annual expense reports",
      "48-hour correction window matching payment entries",
    ],
    icon: Receipt,
    accent: "from-blue-500 to-blue-600",
  },
  {
    id: "tickets",
    eyebrow: "Module 04",
    title: "Resident support tickets",
    description:
      "Nine ticket types covering every society pain point. Society-wide visibility means duplicates self-resolve. Convert any complaint into a formal petition with one click.",
    bullets: [
      "9 ticket types: maintenance, security, noise, parking, cleanliness, billing, amenity, neighbour dispute, suggestion",
      "Society-wide ticket visibility — see neighbours' issues",
      "Status lifecycle: OPEN → IN_PROGRESS → AWAITING → RESOLVED",
      "Admin triage with priority assignment",
      "One-click conversion to formal petition",
    ],
    icon: LifeBuoy,
    accent: "from-amber-500 to-amber-600",
  },
  {
    id: "petitions",
    eyebrow: "Module 05",
    title: "Petitions & complaints with digital signatures",
    description:
      "Draft a formal petition. Upload the letter as PDF. Residents sign on their phone — draw or upload signature. Download a compiled PDF with every signature inline, ready to submit.",
    bullets: [
      "Three types: COMPLAINT, PETITION, NOTICE",
      "Admin uploads the formal letter (PDF)",
      "Residents sign — draw on screen OR upload image",
      "Live signature counter with configurable target",
      "Compiled PDF report with all signatures inline",
      "WhatsApp notification on submission",
    ],
    icon: FileSignature,
    accent: "from-rose-500 to-rose-600",
  },
  {
    id: "events",
    eyebrow: "Module 06",
    title: "Community events with 4 fee models",
    description:
      "From AGMs to Holi parties to Mata ki Chowki — every event has a different pricing model. We ship all four in one module, plus per-event expense tracking.",
    bullets: [
      "FREE — RSVP only (AGM, cleanup drive)",
      "FIXED — set price upfront (workshop, swimming pool pass)",
      "FLEXIBLE — poll first, set price after based on interest",
      "CONTRIBUTION — open voluntary donation",
      "Per-person or per-household charge unit",
      "Event expense ledger — show collected vs spent",
    ],
    icon: CalendarDays,
    accent: "from-orange-500 to-orange-600",
  },
  {
    id: "counsellor",
    eyebrow: "Module 07",
    title: "Counsellor program — independent escalation",
    description:
      "When residents and admins deadlock, a platform-appointed Counsellor mediates. Available across all plans. Counsellor sees only the ticket — never your finances.",
    bullets: [
      "Platform-appointed ombudsperson with society portfolio",
      "Two escalation paths: admin-initiated OR 10 resident votes",
      "Configurable vote threshold per society",
      "Counsellor sees only escalated tickets — never finances",
      "Audit log of every counsellor action",
      "Available across all plans, no extra cost",
    ],
    icon: ShieldCheck,
    accent: "from-teal-500 to-teal-600",
  },
  {
    id: "governance",
    eyebrow: "Module 08",
    title: "Governance & office-bearers",
    description:
      "Surface your committee on the residents app. Names, photos, designations, terms. Office-bearer history kept for accountability.",
    bullets: [
      "Governing body roster (President, Treasurer, Secretary, Members)",
      "Designations with terms, photos, contact",
      "Office-bearer history",
    ],
    icon: Vote,
    accent: "from-indigo-500 to-indigo-600",
  },
  {
    id: "communication",
    eyebrow: "Module 09",
    title: "Communication that actually reaches everyone",
    description:
      "One announcement, three channels — in-app, WhatsApp, email. Templates registered for the events that matter: registration, approval, payment, broadcasts.",
    bullets: [
      "Single push fans out to in-app, WhatsApp, email",
      "Registered templates for registration, approval, payment",
      "Fee reminder, broadcast, event/petition published",
      "WhatsApp delivery on supported events (when WATI configured)",
    ],
    icon: MessageSquare,
    accent: "from-cyan-500 to-cyan-600",
  },
  {
    id: "trust",
    eyebrow: "Module 10",
    title: "Platform trust & reliability",
    description:
      "Database-level isolation between societies. Audit log on every privileged action. Built around the DPDP Act 2023. PWA installable on Android and iOS.",
    bullets: [
      "Role-based access: SA, Admin, Counsellor, Resident — scoped exactly",
      "Postgres RLS for tenant isolation between societies",
      "Audit log of every privileged action",
      "DPDP Act 2023 alignment",
      "Rate-limited auth, brute-force resistance",
      "PWA — installable on Android & iOS, offline read",
    ],
    icon: Smartphone,
    accent: "from-slate-500 to-slate-600",
  },
] as const;

export default function FeaturesPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="from-primary/10 via-background to-background pointer-events-none absolute inset-0 bg-gradient-to-b"
        />
        <div className="relative mx-auto max-w-4xl px-4 pt-20 pb-12 text-center sm:px-6">
          <p className="text-primary mb-3 text-sm font-semibold tracking-wide uppercase">
            What we ship
          </p>
          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Ten modules. One platform. No half-finished features.
          </h1>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
            Every feature below is in the codebase today — not on a roadmap. We don&apos;t ship
            promises.
          </p>
        </div>
      </section>

      <div className="divide-border divide-y">
        {MODULES.map((mod, i) => (
          <FeatureModuleSection key={mod.id} {...mod} align={i % 2 === 0 ? "left" : "right"} />
        ))}
      </div>

      <CtaBand />
    </>
  );
}
