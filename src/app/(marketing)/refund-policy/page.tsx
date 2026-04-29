import Link from "next/link";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund Policy — RWA Connect",
  description: "Subscription refunds, payment-claim disputes, and how we handle cancellations.",
};

export default function RefundPolicyPage() {
  return (
    <article className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-10">
        <p className="text-primary mb-2 text-sm font-semibold tracking-wide uppercase">Legal</p>
        <h1 className="mb-3 text-4xl font-bold tracking-tight">Refund Policy</h1>
        <p className="text-muted-foreground text-sm">Last updated: April 2026</p>
      </header>

      <div className="prose prose-sm max-w-none space-y-8 text-sm leading-relaxed">
        <section>
          <h2 className="mb-3 text-xl font-semibold">1. Subscription refunds</h2>
          <p>
            Subscriptions to RWA Connect are billed in advance for the chosen billing cycle
            (monthly, annual, 2-year, or 3-year). We do not refund partial periods after a
            cancellation — your subscription remains active until the end of the current cycle.
          </p>
          <p className="mt-3">
            <strong>Plan switches</strong> are pro-rated automatically: upgrading mid-cycle
            generates a proportional charge for the remaining period; downgrading generates a
            proportional credit applied to future invoices. There is no charge or credit if the
            switch is at the boundary of a cycle.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">2. Free trial</h2>
          <p>
            Every plan includes a 14-day free trial. No card is collected at signup. If you do not
            convert to a paid plan within 14 days, your society subscription expires automatically —
            no refund applies because nothing was charged.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">3. Payment-claim disputes</h2>
          <p>
            Resident fee payments processed through the UPI claim flow are between the resident and
            the society. RWA Connect facilitates the claim/verification flow but never holds the
            money — funds go directly bank-to-bank.
          </p>
          <p className="mt-3">
            Admin entries (manual fee payments, expense entries) have a 48-hour correction window
            after creation. After 48 hours, entries are locked for audit integrity. Corrections
            beyond that window require a Super Admin override — contact support.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">4. Force majeure</h2>
          <p>
            Service disruptions caused by events outside our reasonable control (natural disasters,
            power-grid failure, infrastructure provider outage, regulatory action) do not entitle
            customers to refunds, though we do credit documented downtime against the next invoice
            on a best-effort basis.
          </p>
        </section>

        <section>
          <h2 className="mb-3 text-xl font-semibold">5. Disputes</h2>
          <p>
            For billing disputes, contact{" "}
            <Link href="mailto:support@rwaconnect.in" className="text-primary underline">
              support@rwaconnect.in
            </Link>{" "}
            with the invoice number and the nature of the dispute. We respond within 3 business
            days. Disputes are resolved under the laws of India, with jurisdiction in Gurugram,
            Haryana.
          </p>
        </section>
      </div>

      <div className="text-muted-foreground mt-12 border-t pt-6 text-center text-xs">
        <Link href="/terms" className="hover:text-foreground underline">
          Terms of Service
        </Link>{" "}
        ·{" "}
        <Link href="/privacy" className="hover:text-foreground underline">
          Privacy Policy
        </Link>
      </div>
    </article>
  );
}
