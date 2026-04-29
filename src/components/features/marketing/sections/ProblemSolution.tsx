import { CheckCircle2, XCircle } from "lucide-react";

const PROBLEMS = [
  "Excel sheets for fee tracking, lost every audit",
  "WhatsApp groups for announcements, no record",
  "Paper signatures for petitions, scanned and lost",
  "Bank statement reconciliation by hand, every month",
  "No way to show residents where their money went",
];

const SOLUTIONS = [
  "Live fee dashboard with pro-rata, multi-cycle, audit log",
  "In-app + WhatsApp + email — single push, three channels",
  "Digital signatures with compiled PDF, submission-ready",
  "UPI claim flow: resident submits UTR, you click confirm",
  "Resident-visible expense ledger with categories and receipts",
];

export function ProblemSolution() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
          Stop running your society on{" "}
          <span className="text-destructive">spreadsheets and WhatsApp</span>.
        </h2>
        <p className="text-muted-foreground text-lg">
          Every RWA hits the same wall around 50 units. Here&apos;s what changes.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="bg-destructive/5 border-destructive/20 rounded-2xl border p-8">
          <h3 className="text-foreground mb-6 text-lg font-semibold">Today, without RWA Connect</h3>
          <ul className="space-y-4">
            {PROBLEMS.map((problem) => (
              <li key={problem} className="flex items-start gap-3 text-sm">
                <XCircle className="text-destructive mt-0.5 h-5 w-5 shrink-0" />
                <span className="text-foreground/80">{problem}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="from-primary/5 to-chart-2/5 border-primary/20 rounded-2xl border bg-gradient-to-br p-8">
          <h3 className="text-foreground mb-6 text-lg font-semibold">With RWA Connect</h3>
          <ul className="space-y-4">
            {SOLUTIONS.map((solution) => (
              <li key={solution} className="flex items-start gap-3 text-sm">
                <CheckCircle2 className="text-primary mt-0.5 h-5 w-5 shrink-0" />
                <span className="text-foreground">{solution}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
