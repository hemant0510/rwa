import Image from "next/image";
import Link from "next/link";

import { ArrowRight, Building2, Eye, HeartHandshake, Lock } from "lucide-react";

import { CtaBand } from "@/components/features/marketing/sections/CtaBand";
import { Button } from "@/components/ui/button";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — RWA Connect",
  description: "Built by Navara Tech, for every Indian housing society.",
};

const VALUES = [
  {
    icon: Lock,
    title: "Privacy first",
    body: "Built around DPDP from day one. No tracking cookies. We never sell data.",
  },
  {
    icon: Eye,
    title: "Transparency",
    body: "Residents see expenses, payments, and petitions. Admins see audit logs.",
  },
  {
    icon: HeartHandshake,
    title: "Fairness",
    body: "Counsellor program means no one's stuck arguing in a WhatsApp group.",
  },
  {
    icon: Building2,
    title: "Built for India",
    body: "UPI-first payments. Hindi/English UI on the roadmap. Made for our societies.",
  },
];

export default function AboutPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="from-primary/10 via-background to-background pointer-events-none absolute inset-0 bg-gradient-to-b"
        />
        <div className="relative mx-auto max-w-3xl px-4 pt-20 pb-12 text-center sm:px-6">
          <p className="text-primary mb-3 text-sm font-semibold tracking-wide uppercase">
            Our story
          </p>
          <h1 className="mb-6 text-4xl font-bold tracking-tight sm:text-5xl">
            Built for every Indian RWA.
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            RWA Connect was born from years of watching housing societies run on spreadsheets,
            WhatsApp groups, and faith. We built the platform we wished existed for our own
            communities — full-featured, honestly priced, and India-first. Then we shared it.
          </p>

          <a
            href="https://navaratech.in"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:border-primary/40 bg-background/80 mt-8 inline-flex items-center gap-3 rounded-xl border px-5 py-3 transition-all hover:shadow-md"
            aria-label="Visit navaratech.in"
          >
            <span className="text-muted-foreground text-xs tracking-wide uppercase">
              A product by
            </span>
            <Image
              src="/marketing/navara-logo.svg"
              alt="Navara Tech"
              width={130}
              height={34}
              className="h-7 w-auto dark:hidden"
            />
            <Image
              src="/marketing/navara-logo-reversed.svg"
              alt="Navara Tech"
              width={130}
              height={34}
              className="hidden h-7 w-auto dark:block"
            />
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <div className="space-y-8">
          <div>
            <h2 className="mb-3 text-2xl font-bold tracking-tight">Mission</h2>
            <p className="text-muted-foreground text-base leading-relaxed">
              Make running an Indian housing society a 30-minute weekly task — not a second job for
              the secretary. Give residents a way to pay, raise issues, sign petitions, and see
              where their money went, without hunting down a committee member.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-bold tracking-tight">Why we exist</h2>
            <p className="text-muted-foreground text-base leading-relaxed">
              Indian housing societies are mid-sized organisations running on volunteer time. The
              software available was either too enterprise (priced for chains of skyscrapers) or too
              thin (a glorified WhatsApp group with a fee log). RWA Connect sits in the middle:
              full-featured, honestly priced, India-first.
            </p>
          </div>

          <div>
            <h2 className="mb-3 text-2xl font-bold tracking-tight">The team behind RWA Connect</h2>
            <p className="text-muted-foreground text-base leading-relaxed">
              RWA Connect is built and maintained by{" "}
              <a
                href="https://navaratech.in"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-medium hover:underline"
              >
                Navara Tech
              </a>{" "}
              — a Bengaluru-based product company on a mission to empower Indian communities. Our
              tagline says it best: <em>&ldquo;Empowering communities. Elevating lives.&rdquo;</em>{" "}
              Alongside RWA Connect, we build Icon Fly — a travel planning product. Both products
              share a single conviction: software for Indian users should be honest, India-first,
              and built by people who use it themselves.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-muted/30 border-y">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="mb-10 text-center text-3xl font-bold tracking-tight">What we believe</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((v) => (
              <div key={v.title} className="bg-card rounded-2xl border p-6 text-center">
                <div className="bg-primary/10 text-primary mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl">
                  <v.icon className="h-6 w-6" />
                </div>
                <h3 className="text-foreground mb-2 text-base font-semibold">{v.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{v.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
        <h2 className="mb-3 text-2xl font-bold tracking-tight">Talk to us</h2>
        <p className="text-muted-foreground mb-6 text-base">
          Got a question? Want a demo? Curious about the counsellor program?
        </p>
        <Link href="/contact">
          <Button size="lg">
            Contact us
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </section>

      <CtaBand />
    </>
  );
}
