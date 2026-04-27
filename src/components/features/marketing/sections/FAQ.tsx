"use client";

import { useState } from "react";

import Link from "next/link";

import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

interface FAQItem {
  question: string;
  answer: React.ReactNode;
}

const ITEMS: FAQItem[] = [
  {
    question: "What does it cost?",
    answer: (
      <>
        Plans start at ₹499/month for societies up to 150 units. Every plan includes a 14-day free
        trial — no credit card required.{" "}
        <Link href="/pricing" className="text-primary underline">
          See full pricing
        </Link>
        .
      </>
    ),
  },
  {
    question: "Can residents pay online?",
    answer:
      "Yes — UPI QR is included on every plan, with zero gateway fees. The resident pays from their bank to the society's bank directly, then submits the UTR for one-click verification. Card / netbanking via Razorpay is on the roadmap.",
  },
  {
    question: "Is my society's data safe?",
    answer: (
      <>
        Database-level isolation between societies via Postgres row-level security. Audit log on
        every privileged action. DPDP-aligned.{" "}
        <Link href="/security" className="text-primary underline">
          Read our security overview
        </Link>
        .
      </>
    ),
  },
  {
    question: "Do residents need to install an app?",
    answer:
      "No native install required. RWA Connect is a Progressive Web App — residents can add it to home screen on Android or iOS, or just open the link in any browser.",
  },
  {
    question: "What if my admin and committee disagree?",
    answer:
      "Either side can escalate to a platform-appointed Counsellor — an independent ombudsperson. Residents need 10 votes to escalate; admins can escalate directly. The Counsellor sees only the ticket, never your finances.",
  },
  {
    question: "How do I get help?",
    answer: (
      <>
        Email, WhatsApp, or in-app ticket. Response SLAs vary by plan.{" "}
        <Link href="/contact" className="text-primary underline">
          Contact us
        </Link>{" "}
        — we usually reply within a few hours.
      </>
    ),
  },
];

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <p className="text-primary mb-3 text-sm font-semibold tracking-wide uppercase">
          Frequently asked
        </p>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Six honest questions, six honest answers
        </h2>
      </div>

      <div className="mx-auto max-w-3xl space-y-3">
        {ITEMS.map((item, i) => {
          const isOpen = openIndex === i;
          return (
            <div
              key={item.question}
              className={cn(
                "bg-card overflow-hidden rounded-xl border transition-all",
                isOpen ? "border-primary/40 shadow-sm" : "hover:border-primary/30",
              )}
            >
              <button
                type="button"
                onClick={() => setOpenIndex(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                aria-expanded={isOpen}
              >
                <span className="text-foreground text-sm font-semibold sm:text-base">
                  {item.question}
                </span>
                <ChevronDown
                  className={cn(
                    "text-muted-foreground h-4 w-4 shrink-0 transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
              </button>
              {isOpen ? (
                <div className="text-muted-foreground border-t px-6 py-4 text-sm leading-relaxed">
                  {item.answer}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
