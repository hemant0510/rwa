import Link from "next/link";

export const metadata = {
  title: "Terms of Service — RWA Connect",
  description: "Terms governing your use of the Eden Estate RWA Connect platform.",
};

export default function TermsOfServicePage() {
  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-8">
          <Link href="/login" className="text-primary text-sm hover:underline">
            ← Back to Login
          </Link>
        </div>

        <h1 className="mb-2 text-3xl font-bold">Terms of Service</h1>
        <p className="text-muted-foreground mb-8 text-sm">Last updated: March 2026</p>

        <div className="prose prose-sm max-w-none space-y-8 text-sm leading-relaxed">
          <section>
            <h2 className="mb-3 text-xl font-semibold">1. Acceptance of Terms</h2>
            <p>
              By registering or logging into RWA Connect (&ldquo;the platform&rdquo;), you agree to
              be bound by these Terms of Service. If you do not agree, do not use the platform.
              These terms apply to all users including residents, RWA admins, and super admins.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">2. Description of Service</h2>
            <p>
              RWA Connect is a resident management platform for housing societies. It provides tools
              for resident registration, membership fee collection, expense tracking, announcements,
              and community administration. The platform is operated by and for the Residents
              Welfare Association of each registered society.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">3. User Accounts</h2>
            <ul className="list-disc space-y-1 pl-6">
              <li>
                You are responsible for maintaining the confidentiality of your login credentials.
              </li>
              <li>You must provide accurate and complete information during registration.</li>
              <li>
                You must notify the RWA Admin immediately if you suspect unauthorized use of your
                account.
              </li>
              <li>
                Accounts are non-transferable. Sharing your credentials with others is prohibited.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">4. Resident Data and Consent</h2>
            <p>
              By registering, you consent to the collection and processing of your personal data as
              described in our{" "}
              <Link href="/privacy" className="text-primary underline">
                Privacy Policy
              </Link>
              . This includes your name, contact details, unit information, identity proof
              documents, and fee payment history.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">5. Admin Responsibilities</h2>
            <p>RWA Admin accounts carry elevated responsibilities:</p>
            <ul className="list-disc space-y-1 pl-6">
              <li>Admins must only approve residents who are genuine occupants of the society.</li>
              <li>Financial records entered must be accurate and complete.</li>
              <li>
                Admins must not use the platform to harass, discriminate, or misuse resident data.
              </li>
              <li>All admin actions are logged in an immutable audit trail for accountability.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">6. Prohibited Use</h2>
            <p>You must not:</p>
            <ul className="list-disc space-y-1 pl-6">
              <li>Use the platform for any unlawful purpose</li>
              <li>Attempt to gain unauthorized access to other users&apos; data</li>
              <li>Submit false or misleading information</li>
              <li>Interfere with or disrupt the platform&apos;s infrastructure</li>
              <li>Scrape, copy, or reproduce platform data without written consent</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">7. Intellectual Property</h2>
            <p>
              The RWA Connect platform, including its design, code, and content, is proprietary. The
              resident data entered into the platform belongs to the respective society&apos;s RWA
              and its residents. No license to reproduce or distribute platform software is granted.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">8. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, RWA Connect is provided &ldquo;as is&rdquo;
              without warranty of any kind. We are not liable for any indirect, incidental, or
              consequential damages arising from use of the platform. Our total liability shall not
              exceed the amount paid by your society for the service in the preceding 12 months.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">9. Termination</h2>
            <p>
              The RWA Admin may deactivate a resident&apos;s account at any time. Your access to
              historical records after deactivation is subject to the data retention terms in the
              Privacy Policy. Misuse of admin privileges may result in immediate revocation of admin
              access.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">10. Governing Law</h2>
            <p>
              These terms are governed by the laws of India. Any disputes shall be subject to the
              exclusive jurisdiction of the courts of Gurugram, Haryana. The platform operates in
              compliance with the Information Technology Act, 2000, the Digital Personal Data
              Protection Act, 2023, and applicable RBI guidelines for digital payments.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-xl font-semibold">11. Changes to Terms</h2>
            <p>
              We may revise these terms at any time. Continued use of the platform after changes are
              posted constitutes acceptance of the new terms. Significant changes will be
              communicated via the platform&apos;s announcement feature.
            </p>
          </section>
        </div>

        <div className="text-muted-foreground mt-10 border-t pt-6 text-center text-xs">
          <Link href="/privacy" className="hover:text-foreground underline">
            Privacy Policy
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
