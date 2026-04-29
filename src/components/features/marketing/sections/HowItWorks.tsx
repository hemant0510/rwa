import { Building2, QrCode, UserCheck } from "lucide-react";

const STEPS = [
  {
    number: "01",
    icon: Building2,
    title: "Register your society",
    description:
      "Name, type, plan, admin account. Three steps. About two minutes. Free 14-day trial — no credit card.",
  },
  {
    number: "02",
    icon: QrCode,
    title: "Invite your residents",
    description:
      "Share the society QR code on WhatsApp. Residents scan, fill profile, submit. Your phone book becomes a directory.",
  },
  {
    number: "03",
    icon: UserCheck,
    title: "Approve, and you're live",
    description:
      "Vet documents, approve, RWAID issued. Household registry, fees, tickets, and petitions unlock for that resident.",
  },
];

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <p className="text-primary mb-3 text-sm font-semibold tracking-wide uppercase">
          From signup to live in a weekend
        </p>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {STEPS.map((step, i) => (
          <div key={step.number} className="relative">
            {i < STEPS.length - 1 ? (
              <div
                aria-hidden="true"
                className="from-primary/40 absolute top-12 left-full hidden h-px w-full bg-gradient-to-r to-transparent lg:block"
              />
            ) : null}
            <div className="bg-card relative h-full rounded-2xl border p-7">
              <div className="from-primary to-chart-2 text-primary-foreground mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br">
                <step.icon className="h-6 w-6" />
              </div>
              <div className="text-muted-foreground mb-2 text-xs font-semibold tracking-widest">
                STEP {step.number}
              </div>
              <h3 className="text-foreground mb-3 text-xl font-semibold">{step.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
