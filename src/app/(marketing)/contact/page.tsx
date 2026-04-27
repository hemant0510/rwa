import { Mail, MessageCircle, Phone } from "lucide-react";

import { LeadForm } from "@/components/features/marketing/contact/LeadForm";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact — RWA Connect",
  description: "WhatsApp, email, or fill the form. We respond within 24 hours.",
};

const CHANNELS = [
  {
    icon: MessageCircle,
    title: "WhatsApp",
    detail: "Fastest replies",
    href: "https://wa.me/911234567890",
    label: "+91 12345 67890",
  },
  {
    icon: Mail,
    title: "Email",
    detail: "For longer questions",
    href: "mailto:rwaconnect360@gmail.com",
    label: "rwaconnect360@gmail.com",
  },
  {
    icon: Phone,
    title: "Phone",
    detail: "Mon–Sat, 10 AM – 7 PM IST",
    href: "tel:+911234567890",
    label: "+91 12345 67890",
  },
];

export default function ContactPage() {
  return (
    <>
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="from-primary/10 via-background to-background pointer-events-none absolute inset-0 bg-gradient-to-b"
        />
        <div className="relative mx-auto max-w-3xl px-4 pt-20 pb-12 text-center sm:px-6">
          <p className="text-primary mb-3 text-sm font-semibold tracking-wide uppercase">
            Get in touch
          </p>
          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Talk to us. We respond fast.
          </h1>
          <p className="text-muted-foreground mx-auto max-w-xl text-lg">
            Demo, pricing question, integration help — pick a channel that suits you.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="mb-12 grid gap-4 sm:grid-cols-3">
          {CHANNELS.map((c) => (
            <a
              key={c.title}
              href={c.href}
              target={c.href.startsWith("http") ? "_blank" : undefined}
              rel={c.href.startsWith("http") ? "noopener noreferrer" : undefined}
              className="bg-card hover:border-primary/40 group flex items-center gap-4 rounded-2xl border p-5 transition-all hover:shadow-md"
            >
              <div className="bg-primary/10 text-primary inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl">
                <c.icon className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <div className="text-foreground text-sm font-semibold">{c.title}</div>
                <div className="text-muted-foreground text-xs">{c.detail}</div>
                <div className="text-foreground/80 mt-1 truncate text-xs">{c.label}</div>
              </div>
            </a>
          ))}
        </div>

        <div className="mx-auto max-w-2xl">
          <div className="bg-card rounded-2xl border p-7 shadow-sm sm:p-10">
            <h2 className="text-foreground mb-2 text-2xl font-bold">Send us a message</h2>
            <p className="text-muted-foreground mb-6 text-sm">
              Tell us about your society and what you&apos;re looking for. We&apos;ll get back
              within 24 hours.
            </p>
            <LeadForm />
          </div>
        </div>
      </section>
    </>
  );
}
