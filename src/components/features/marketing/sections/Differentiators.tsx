import { Database, FileSignature, ShieldCheck, Sparkles } from "lucide-react";

const DIFFS = [
  {
    icon: Sparkles,
    title: "Zero-fee payments by default",
    body: "Most platforms push you straight to a card gateway with 2% MDR. We ship UPI QR claim flow on every plan — direct bank-to-bank, no platform cut. Razorpay is opt-in, not mandatory.",
  },
  {
    icon: FileSignature,
    title: "Petitions are a real feature",
    body: "Not a forum. Not a poll. Upload the formal letter, residents sign on phone (draw or scan), download a submission-ready compiled PDF. Take it straight to the municipality.",
  },
  {
    icon: ShieldCheck,
    title: "Independent escalation channel",
    body: "When residents and admins deadlock, a platform-appointed Counsellor mediates. 10 resident votes trigger an automatic escalation. We're the only platform that ships this.",
  },
  {
    icon: Database,
    title: "Database isolation, not promises",
    body: "Postgres row-level security ensures one society's query cannot leak another's data. Audit log on every privileged action. Built around the DPDP Act 2023.",
  },
];

export function Differentiators() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <p className="text-primary mb-3 text-sm font-semibold tracking-wide uppercase">
          Why RWA Connect
        </p>
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          What sets us apart from the others
        </h2>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {DIFFS.map((d) => (
          <div
            key={d.title}
            className="from-primary/5 to-card border-primary/15 rounded-2xl border bg-gradient-to-br p-7"
          >
            <div className="bg-background border-primary/20 mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg border shadow-sm">
              <d.icon className="text-primary h-5 w-5" />
            </div>
            <h3 className="text-foreground mb-2 text-lg font-semibold">{d.title}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">{d.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
