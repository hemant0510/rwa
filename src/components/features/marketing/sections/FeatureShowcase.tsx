import Link from "next/link";

import {
  ArrowRight,
  FileSignature,
  LifeBuoy,
  QrCode,
  Receipt,
  ShieldCheck,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface Module {
  icon: typeof Users;
  title: string;
  description: string;
  href: string;
  accent: string;
}

const MODULES: Module[] = [
  {
    icon: Users,
    title: "Household Registry",
    description:
      "Family, vehicles, pets, helpers — under one household with sub-IDs for gate pass and amenities.",
    href: "/features#household",
    accent: "from-violet-500/20 to-violet-500/5 text-violet-600 dark:text-violet-400",
  },
  {
    icon: QrCode,
    title: "Zero-fee UPI Payments",
    description:
      "Residents scan your society's UPI QR, pay, submit UTR. You verify in one click. ₹0 gateway.",
    href: "/features#payments",
    accent: "from-emerald-500/20 to-emerald-500/5 text-emerald-600 dark:text-emerald-400",
  },
  {
    icon: Receipt,
    title: "Fee + Expense Ledger",
    description:
      "Pro-rata maths handled. Categorised expenses with receipts. Residents see exactly where the money went.",
    href: "/features#fees",
    accent: "from-blue-500/20 to-blue-500/5 text-blue-600 dark:text-blue-400",
  },
  {
    icon: LifeBuoy,
    title: "Resident Support Tickets",
    description:
      "9 categories. Society-wide visibility. One-click convert any complaint into a formal petition.",
    href: "/features#tickets",
    accent: "from-amber-500/20 to-amber-500/5 text-amber-600 dark:text-amber-400",
  },
  {
    icon: FileSignature,
    title: "Petitions with Digital Signatures",
    description:
      "Upload the formal letter. Residents sign on screen or upload a scan. Download a compiled PDF report.",
    href: "/features#petitions",
    accent: "from-rose-500/20 to-rose-500/5 text-rose-600 dark:text-rose-400",
  },
  {
    icon: ShieldCheck,
    title: "Counsellor Program",
    description:
      "When admin and residents deadlock, a platform-appointed ombudsperson steps in. 10 resident votes triggers escalation.",
    href: "/features#counsellor",
    accent: "from-teal-500/20 to-teal-500/5 text-teal-600 dark:text-teal-400",
  },
];

export function FeatureShowcase() {
  return (
    <section className="bg-muted/20 border-y">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Six modules. One platform. Every job your society needs.
          </h2>
          <p className="text-muted-foreground text-lg">
            Each module ships as a finished feature, not a checkbox in a roadmap.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {MODULES.map((mod) => (
            <Link
              key={mod.title}
              href={mod.href}
              className="group bg-card hover:border-primary/40 hover:shadow-primary/5 relative overflow-hidden rounded-2xl border p-6 transition-all hover:-translate-y-0.5 hover:shadow-lg"
            >
              <div
                className={cn(
                  "mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br",
                  mod.accent,
                )}
              >
                <mod.icon className="h-6 w-6" />
              </div>
              <h3 className="text-foreground mb-2 text-lg font-semibold">{mod.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{mod.description}</p>
              <div className="text-primary mt-4 inline-flex items-center gap-1 text-sm font-medium opacity-0 transition-opacity group-hover:opacity-100">
                Learn more <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/features"
            className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline"
          >
            See all 10 product modules <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
