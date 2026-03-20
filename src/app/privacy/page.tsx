import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — RWA Connect",
  description:
    "How Eden Estate RWA Connect collects, uses, and protects your personal information.",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-8">
          <Link href="/login" className="text-primary text-sm hover:underline">
            ← Back to Login
          </Link>
        </div>

        <h1 className="mb-2 text-3xl font-bold">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8 text-sm">Last updated: March 2026</p>

        <div className="prose prose-sm max-w-none space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="mb-3 text-xl font-semibold">1. Introduction</h2>
            <p>
              RWA Connect (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;the platform&rdquo;) is
              operated by Eden Estate Residents Welfare Association. This Privacy Policy explains
              how we collect, use, store, and protect personal information submitted through this
              platform, in accordance with the Digital Personal Data Protection Act, 2023 (DPDP Act)
              and applicable Indian law.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">2. Information We Collect</h2>
            <ul className="list-disc space-y-1 pl-6">
              <li>
                <strong>Identity information:</strong> Full name, email address, mobile number,
                ownership type (Owner / Tenant)
              </li>
              <li>
                <strong>Unit information:</strong> Flat/plot/house number, floor, block/sector
              </li>
              <li>
                <strong>Identity proof:</strong> Scanned document uploaded during registration
                (Aadhaar, PAN, passport, etc.)
              </li>
              <li>
                <strong>Financial records:</strong> Membership fee payment history, receipt numbers,
                payment modes
              </li>
              <li>
                <strong>Activity data:</strong> Login timestamps, admin audit trail actions
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">3. How We Use Your Information</h2>
            <ul className="list-disc space-y-1 pl-6">
              <li>To manage resident registration and membership records</li>
              <li>To process and track annual membership fee payments</li>
              <li>To send email notifications (verification, receipts, announcements)</li>
              <li>To generate society reports for the RWA governing body</li>
              <li>To maintain an audit trail of administrative actions for accountability</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">4. Data Storage and Security</h2>
            <p>
              Your data is stored in a PostgreSQL database hosted on Supabase (Singapore region)
              with encryption at rest. Access is protected by row-level security policies ensuring
              each society can only access its own residents&apos; data. We do not sell or share
              your personal data with any third party.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">5. Data Retention</h2>
            <p>
              Resident data is retained for the duration of your membership and for 7 years after
              de-activation to comply with financial record-keeping requirements under Indian law.
              Identity proof documents may be deleted upon written request after membership ends,
              subject to any applicable legal hold.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">6. Your Rights (DPDP Act 2023)</h2>
            <p>Under the Digital Personal Data Protection Act, 2023, you have the right to:</p>
            <ul className="list-disc space-y-1 pl-6">
              <li>Access a summary of your personal data held by us</li>
              <li>Correct inaccurate or incomplete personal data</li>
              <li>Request erasure of your data (subject to retention obligations)</li>
              <li>Nominate a person to exercise your rights in the event of death or incapacity</li>
              <li>File a complaint with the Data Protection Board of India</li>
            </ul>
            <p className="mt-2">
              To exercise any of these rights, contact the RWA Admin at your registered email
              address.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">7. Cookies</h2>
            <p>
              We use strictly necessary session cookies to maintain your authenticated session. We
              do not use advertising, tracking, or analytics cookies.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">8. Changes to This Policy</h2>
            <p>
              We may update this policy from time to time. Changes will be posted on this page with
              an updated &ldquo;Last updated&rdquo; date. Continued use of the platform after any
              changes constitutes acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">9. Contact</h2>
            <p>
              For privacy-related queries, contact the RWA Admin through the registered email
              address for Eden Estate society. For disputes, the governing law is the laws of India
              and jurisdiction is Gurugram, Haryana.
            </p>
          </section>
        </div>

        <div className="text-muted-foreground mt-10 border-t pt-6 text-center text-xs">
          <Link href="/terms" className="hover:text-foreground underline">
            Terms of Service
          </Link>{" "}
          ·{" "}
          <Link href="/login" className="hover:text-foreground underline">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
