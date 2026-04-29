import Link from "next/link";

import { ArrowRight, Bell, FileSignature, Info, LifeBuoy, QrCode, Users } from "lucide-react";

import { CtaBand } from "@/components/features/marketing/sections/CtaBand";
import { Button } from "@/components/ui/button";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "For Residents — RWA Connect",
  description:
    "Pay your society dues in 30 seconds. Read announcements. Sign petitions. From your phone.",
};

const PERKS = [
  {
    icon: QrCode,
    title: "Pay dues in 30 seconds",
    body: "Scan your society's UPI QR. Pay via GPay/PhonePe/Paytm. Submit UTR. Done.",
  },
  {
    icon: Bell,
    title: "Never miss an announcement",
    body: "In-app, WhatsApp, and email — single push, three channels. No more lost group messages.",
  },
  {
    icon: Users,
    title: "Manage your household",
    body: "Add family, vehicles, pets, helpers — each gets a sub-ID for gate pass and amenities.",
  },
  {
    icon: LifeBuoy,
    title: "Raise issues that get heard",
    body: "Maintenance, security, noise, parking — see neighbours' tickets too, for transparency.",
  },
  {
    icon: FileSignature,
    title: "Sign petitions on your phone",
    body: "Draw a signature or upload a scan. Petitions get submitted to the municipality with your sign on file.",
  },
  {
    icon: Info,
    title: "See where your money goes",
    body: "Resident-visible expense ledger. Categorised, with receipts. Real transparency.",
  },
];

export default function ForResidentsPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="from-primary/10 via-background to-background pointer-events-none absolute inset-0 bg-gradient-to-b"
        />
        <div className="relative mx-auto max-w-4xl px-4 pt-20 pb-12 text-center sm:px-6">
          <p className="text-primary mb-3 text-sm font-semibold tracking-wide uppercase">
            For residents
          </p>
          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Pay your society dues in 30 seconds. From your phone.
          </h1>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg">
            Read announcements, sign petitions, raise complaints, manage your household — without a
            single trip to the secretary&apos;s flat.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PERKS.map((p) => (
            <div key={p.title} className="bg-card rounded-2xl border p-6">
              <div className="bg-primary/10 text-primary mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl">
                <p.icon className="h-5 w-5" />
              </div>
              <h3 className="text-foreground mb-2 text-base font-semibold">{p.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-muted/30 border-y">
        <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <div className="bg-background border-primary/30 mx-auto inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm">
            <Info className="text-primary h-4 w-4" />
            You don&apos;t sign up — your admin invites you
          </div>
          <h2 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">How residents join</h2>
          <p className="text-muted-foreground mt-3 text-base leading-relaxed">
            RWA Connect uses an invitation flow. Once your society is live, your admin shares a QR
            code on WhatsApp. You scan it, fill your profile, submit. Your admin verifies your
            documents and approves you. From then on, you&apos;re in.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/register-society">
              <Button size="lg" className="w-full sm:w-auto">
                I&apos;m an admin — get started
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="w-full sm:w-auto">
                I&apos;m a resident — ask my admin
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <CtaBand />
    </>
  );
}
