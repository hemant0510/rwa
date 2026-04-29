/**
 * Generates docs/business/incorporation-brief-for-ca.pdf
 * Run: npx tsx scripts/generate-ca-brief-pdf.tsx
 *
 * Uses the project's existing @react-pdf/renderer dependency so we don't
 * need a separate Chromium / wkhtmltopdf install.
 */

import React from "react";

import path from "path";
import process from "process";

import { Document, Page, StyleSheet, Text, View, renderToFile } from "@react-pdf/renderer";

const ink = "#1a1a1a";
const muted = "#5b6470";
const rule = "#d8dde4";
const accent = "#0e7c66";
const warnBg = "#fff7e6";
const warnBorder = "#ffd591";
const warnInk = "#874d00";
const tableHeadBg = "#f5f7f9";

const s = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 40,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: ink,
    lineHeight: 1.45,
  },

  // Header
  header: { borderBottomWidth: 2, borderBottomColor: ink, paddingBottom: 12, marginBottom: 16 },
  eyebrow: { fontSize: 8, color: muted, letterSpacing: 1.2, marginBottom: 4 },
  title: { fontSize: 17, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  metaRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 4 },
  metaItem: { fontSize: 9, color: muted, marginRight: 14, marginBottom: 2 },
  metaLabel: { fontFamily: "Helvetica-Bold", color: ink },

  // Section
  h2: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: accent,
    marginTop: 16,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: rule,
  },

  // Text
  p: { marginBottom: 6 },
  bold: { fontFamily: "Helvetica-Bold" },
  italic: { fontFamily: "Helvetica-Oblique" },

  // Bullets / ordered list
  bulletRow: { flexDirection: "row", marginBottom: 4 },
  bulletDot: { width: 12, fontSize: 10 },
  bulletText: { flex: 1 },

  // Warn callout
  warn: {
    backgroundColor: warnBg,
    borderWidth: 1,
    borderColor: warnBorder,
    borderRadius: 4,
    padding: 10,
    marginVertical: 8,
    color: warnInk,
    fontSize: 9.5,
  },

  // Question box
  qbox: {
    borderWidth: 1,
    borderColor: rule,
    borderRadius: 4,
    padding: 10,
    marginVertical: 5,
  },
  qid: {
    fontFamily: "Helvetica-Bold",
    color: accent,
    fontSize: 9,
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  qtext: { fontSize: 10, marginBottom: 4 },
  qwhy: { fontSize: 8.5, color: muted, fontFamily: "Helvetica-Oblique" },

  // Table
  table: { marginVertical: 6 },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: tableHeadBg,
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: rule,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: rule,
  },
  th: { fontSize: 9, fontFamily: "Helvetica-Bold", color: ink },
  td: { fontSize: 9, color: ink },

  // Sign-off
  signoff: {
    marginTop: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: rule,
    fontSize: 9.5,
    color: muted,
  },

  // Footer
  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 8,
    color: muted,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: rule,
  },
});

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <View style={s.bulletRow}>
      <Text style={s.bulletDot}>•</Text>
      <Text style={s.bulletText}>{children}</Text>
    </View>
  );
}

function Numbered({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <View style={s.bulletRow}>
      <Text style={[s.bulletDot, { width: 16 }]}>{n}.</Text>
      <Text style={s.bulletText}>{children}</Text>
    </View>
  );
}

function Q({
  id,
  question,
  why,
}: {
  id: string;
  question: React.ReactNode;
  why?: React.ReactNode;
}) {
  return (
    <View style={s.qbox} wrap={false}>
      <Text style={s.qid}>{id}</Text>
      <Text style={s.qtext}>{question}</Text>
      {why && <Text style={s.qwhy}>{why}</Text>}
    </View>
  );
}

const penaltyRows: Array<[string, string, string]> = [
  ["Failure of reasonable security safeguards", "Rs. 250 crore", "Sec. 8(5)"],
  ["Failure to notify a personal data breach", "Rs. 200 crore", "Sec. 8(6)"],
  ["Failure of children's-data obligations", "Rs. 200 crore", "Sec. 9"],
  ["Significant Data Fiduciary obligations failure", "Rs. 150 crore", "Sec. 10"],
  ["Any other breach of the Act / Rules", "Rs. 50 crore", "residual"],
  ["False / frivolous complaints by Data Principal", "Rs. 10,000", "Sec. 15"],
];

const colWidths = { failure: "55%", penalty: "25%", ref: "20%" };

function PenaltyTable() {
  return (
    <View style={s.table} wrap={false}>
      <View style={s.tableHeader}>
        <Text style={[s.th, { width: colWidths.failure }]}>Failure</Text>
        <Text style={[s.th, { width: colWidths.penalty }]}>Max penalty</Text>
        <Text style={[s.th, { width: colWidths.ref }]}>Act ref</Text>
      </View>
      {penaltyRows.map(([failure, penalty, ref], i) => (
        <View style={[s.tableRow, i % 2 === 1 ? { backgroundColor: "#fafbfc" } : {}]} key={ref + i}>
          <Text style={[s.td, { width: colWidths.failure }]}>{failure}</Text>
          <Text style={[s.td, { width: colWidths.penalty }]}>{penalty}</Text>
          <Text style={[s.td, { width: colWidths.ref }]}>{ref}</Text>
        </View>
      ))}
    </View>
  );
}

const Brief = () => (
  <Document
    title="Incorporation of Navara Tech Private Limited and Related Compliance Setup"
    author="Hemant Bhagat"
    subject="Brief for Chartered Accountant"
  >
    <Page size="A4" style={s.page}>
      {/* HEADER */}
      <View style={s.header}>
        <Text style={s.eyebrow}>BRIEF FOR CHARTERED ACCOUNTANT</Text>
        <Text style={s.title}>
          Incorporation of Navara Tech Private Limited &amp; Related Compliance Setup
        </Text>
        <View style={s.metaRow}>
          <Text style={s.metaItem}>
            <Text style={s.metaLabel}>Founder: </Text>Hemant Bhagat
          </Text>
          <Text style={s.metaItem}>
            <Text style={s.metaLabel}>Current entity: </Text>Navara Tech (Sole Proprietorship)
          </Text>
          <Text style={s.metaItem}>
            <Text style={s.metaLabel}>Product: </Text>RWA Connect 360
          </Text>
          <Text style={s.metaItem}>
            <Text style={s.metaLabel}>Prepared: </Text>27 April 2026
          </Text>
        </View>
      </View>

      {/* 1. WHY I AM WRITING */}
      <Text style={s.h2}>1. Why I am writing</Text>
      <Text style={s.p}>
        I run a SaaS product, <Text style={s.bold}>RWA Connect 360</Text>, currently operated under
        my sole proprietorship <Text style={s.bold}>Navara Tech</Text> (logo trademark already
        secured in the sole prop&apos;s name). The product manages society admin and resident data —
        name, mobile, email, ID-proof scans, vehicle plates, payment history — for Resident Welfare
        Associations.
      </Text>
      <Text style={s.p}>
        I am about to onboard the first paying societies, with thousands of residents collectively
        within the next month. Before that happens, I need to make a series of legal/financial
        decisions about the right entity structure and the compliance posture for the{" "}
        <Text style={s.bold}>Digital Personal Data Protection Act, 2023</Text> (DPDP Act).
      </Text>
      <Text style={s.p}>
        I am specifically seeking your advice on the items in <Text style={s.bold}>Section 4</Text>.
        Sections 2 and 3 give you the context you&apos;ll need to answer them.
      </Text>

      {/* 2. BACKGROUND */}
      <Text style={s.h2}>2. Background — what RWA Connect 360 does</Text>
      <Bullet>
        <Text style={s.bold}>Product: </Text>a multi-tenant web app where each Resident Welfare
        Association (RWA) gets its own workspace. Society admins onboard residents; residents log in
        to pay dues, raise issues, register vehicles/family members, sign petitions, attend events.
      </Bullet>
      <Bullet>
        <Text style={s.bold}>Data held per resident: </Text>full name, mobile, email, photo, ID
        proof (Aadhaar/PAN/passport scan), ownership-proof, family members (including minors as
        dependents), vehicles, pets, fee payment history, support tickets.
      </Bullet>
      <Bullet>
        <Text style={s.bold}>Hosting: </Text>Supabase Postgres in the Mumbai region (AWS ap-south-1,
        project rwa-connect-prod) — data stays in India. Vercel for the app, Razorpay for payments,
        transactional SMTP via a third-party provider.
      </Bullet>
      <Bullet>
        <Text style={s.bold}>Scale outlook (next 12 months): </Text>5 to 25 societies; 5,000 to
        50,000 residents; revenue model is per-society subscription.
      </Bullet>
      <Bullet>
        <Text style={s.bold}>Existing IP: </Text>trademark on the{" "}
        <Text style={s.italic}>Navara Tech</Text> logo, registered in the sole prop&apos;s name.
      </Bullet>

      {/* 3. THE DPDP PROBLEM */}
      <Text style={s.h2}>3. The DPDP Act problem with running as a sole proprietorship</Text>
      <Text style={s.p}>
        The DPDP Act 2023 (Act No. 22 of 2023, in force) applies to any &ldquo;Data Fiduciary&rdquo;
        — i.e., the entity that decides why and how personal data is processed. That is Navara Tech.
        Penalties under the Schedule of the Act include:
      </Text>
      <PenaltyTable />
      <Text style={s.p}>
        The Government may also <Text style={s.bold}>double any penalty</Text> by Gazette
        notification (Sec. 42), and after two adverse Board orders may direct intermediaries to{" "}
        <Text style={s.bold}>block public access</Text> to a Fiduciary&apos;s services (Sec. 37).
      </Text>
      <View style={s.warn} wrap={false}>
        <Text>
          <Text style={s.bold}>The personal liability concern. </Text>Under a sole proprietorship
          there is no corporate veil. Any monetary penalty under the Act would attach to me
          personally — my bank balances, property, future income. Under a Private Limited Company,
          the company bears the penalty; director-level liability exists for specific breaches but
          is bounded and defensible.
        </Text>
      </View>
      <Text style={s.p}>
        Separately, the Act&apos;s <Text style={s.bold}>Sec. 17(3) startup exemption</Text> can
        carve out smaller Fiduciaries from Sec. 5, 8(3), 8(7), 10, and 11. The likely gateway for
        that exemption is DPIIT recognition (Startup India), and DPIIT does not recognise sole
        proprietorships — only Pvt Ltd, LLP, and Partnership Firms are eligible. So the sole prop
        locks me out of a meaningful future relief.
      </Text>
      <Text style={s.p}>
        Vendor Data Processing Agreements (DPAs) under Sec. 8(2) — required from Supabase, Vercel,
        Razorpay, etc. — are also typically refused or restricted to corporate entities, not
        individuals.
      </Text>
    </Page>

    {/* PAGE 2+ — QUESTIONS */}
    <Page size="A4" style={s.page}>
      <Text style={s.h2}>4. What I want to do — and where I need your guidance</Text>
      <Text style={s.p}>
        My intent is to incorporate <Text style={s.bold}>Navara Tech Private Limited</Text> before
        signing the first paying society, transfer the trademark from the sole prop to the new
        company, and then immediately apply for DPIIT recognition. I&apos;d like your help on the
        items below.
      </Text>

      <Q
        id="Q1 — INCORPORATION TIMELINE & COST"
        question={
          <>
            What is the realistic end-to-end timeline (CIN issued, PAN, TAN, bank account
            operational) for a single-founder Pvt Ltd via SPICe+? What is the typical all-in cost if
            you handle it (versus me using an online service like Vakilsearch / Cleartax / Razorpay
            Rize)?
          </>
        }
        why="Why I need to know: I am trying to time launch around incorporation completion."
      />

      <Q
        id="Q2 — DIRECTOR / SHAREHOLDER STRUCTURE FOR A SINGLE FOUNDER"
        question={
          <>
            A Pvt Ltd needs at least 2 directors and 2 shareholders. As a solo founder, the standard
            pattern is to add a family member as a second director/shareholder (e.g. with a nominal
            1% stake). Is that the route you&apos;d recommend, or would an OPC (One Person Company)
            be a better fit given my plans to raise external funding later?
          </>
        }
        why="Why: OPC is simpler today but conversion is forced when turnover/capital crosses thresholds, and OPC cannot raise equity funding directly. I want the structure I won't regret in 18 months."
      />

      <Q
        id="Q3 — AUTHORISED & PAID-UP CAPITAL RECOMMENDATION"
        question={
          <>
            What authorised capital and paid-up capital do you recommend at incorporation given (a)
            minimal stamp-duty exposure, (b) headroom for a future fund raise without immediate
            increase, and (c) the optics of B2B contracts with RWAs?
          </>
        }
      />

      <Q
        id="Q4 — TRADEMARK ASSIGNMENT FROM SOLE PROP TO PVT LTD"
        question={
          <>
            The &ldquo;Navara Tech&rdquo; logo is trademarked in the sole prop&apos;s name. What is
            the cleanest process to assign it to the new Pvt Ltd post-incorporation, what is the IPO
            India fee/timeline, and is there any tax exposure on the assignment?
          </>
        }
      />

      <Q
        id="Q5 — TAX IMPLICATIONS OF THE TRANSITION"
        question={
          <>
            Are there tax events triggered by moving the operating business (no real revenue yet,
            some pre-launch expenses booked under the sole prop) into the Pvt Ltd? Should pre-
            launch expenses be transferred via a slump-sale / business-transfer agreement, or is it
            cleaner to write them off and start the Pvt Ltd&apos;s books fresh?
          </>
        }
      />

      <Q
        id="Q6 — GST REGISTRATION TIMING"
        question={
          <>
            The Pvt Ltd will be billing RWAs (B2B) on a per-society subscription. I expect to cross
            Rs. 20 lakh annual turnover quickly. Should I register for GST at incorporation, or wait
            until invoicing starts? Any voluntary-registration benefits to flag?
          </>
        }
      />

      <Q
        id="Q7 — DPIIT (STARTUP INDIA) RECOGNITION"
        question={
          <>
            Once incorporated, I want to apply for DPIIT recognition (free, online). Can you (or
            your team) handle the application, or do I do it myself? What documentation will you
            need from me, and how long does it typically take to get the recognition certificate?
          </>
        }
        why="Why: DPIIT recognition is the likely gateway to the Sec. 17(3) startup exemption under the DPDP Act, and unlocks the Sec. 80-IAC tax holiday."
      />

      <Q
        id="Q8 — SEC. 80-IAC TAX HOLIDAY ELIGIBILITY"
        question={
          <>
            If we get DPIIT recognition, are we eligible for the Sec. 80-IAC 100% tax holiday on
            profits for 3 of the first 10 years? What&apos;s the application process and timing?
          </>
        }
      />

      <Q
        id="Q9 — BANK ACCOUNT & FUND FLOW"
        question={
          <>
            Which banks do you recommend for a new Pvt Ltd current account given (a) Razorpay
            settlement reliability, (b) low minimum-balance requirements at this stage, (c) good
            internet-banking / API access for reconciliation? I currently use ICICI personally.
          </>
        }
      />

      <Q
        id="Q10 — COMPLIANCE CALENDAR & ONGOING FEES"
        question={
          <>
            Once incorporated, what is the recurring compliance calendar I&apos;ll need to follow
            (board meetings, AGM, ROC filings, statutory audit, ITR, GST returns, professional tax,
            PF/ESI thresholds)? What&apos;s your typical retainer for handling these end-to-end?
          </>
        }
      />

      <Q
        id="Q11 — VENDOR AGREEMENTS & SIGNATORY AUTHORITY"
        question={
          <>
            Once the Pvt Ltd is incorporated, I&apos;ll need Data Processing Agreements with
            Supabase, Vercel, Razorpay, and an SMTP provider — all under DPDP Act Sec. 8(2).
            I&apos;ll be the authorised signatory. Is there any board resolution /
            authorised-signatory document I should prepare upfront so vendors don&apos;t push back?
          </>
        }
      />

      <Q
        id="Q12 — DPDP RULES & DATA PROTECTION BOARD NOTIFICATIONS"
        question={
          <>
            I understand the DPDP Rules (the operational details: breach notification format,
            grievance SLA, parental-consent mechanism) are still being notified by MeitY. Do you
            monitor those, or can you point me to a service / counsel who does, so I can update our
            compliance posture as the Rules drop?
          </>
        }
        why="Why: Several items in our internal plan are placeholders pending the Rules."
      />

      <Q
        id="Q13 — COUNSEL REFERRAL FOR LEGAL REVIEW"
        question={
          <>
            Separately from the CA work, I will need a one-shot legal review of our Privacy Policy,
            Terms of Service, Refund Policy, and the standard B2B agreement we&apos;ll use with
            RWAs. Can you refer a tech / data-law counsel you&apos;ve worked with?
          </>
        }
      />

      {/* 5. SUMMARY */}
      <Text style={s.h2}>5. Summary of what I&apos;d like from you in the next call</Text>
      <Numbered n={1}>
        A go / no-go on incorporating Pvt Ltd before signing the first paying society.
      </Numbered>
      <Numbered n={2}>
        Quote (or estimate) for handling end-to-end incorporation, including SPICe+, PAN, TAN, GST
        registration, bank-account assistance.
      </Numbered>
      <Numbered n={3}>Recommendation on directorship and capital structure (Q2 + Q3).</Numbered>
      <Numbered n={4}>
        Plan for trademark assignment and pre-launch-expense treatment (Q4 + Q5).
      </Numbered>
      <Numbered n={5}>DPIIT and Sec. 80-IAC application path (Q7 + Q8).</Numbered>
      <Numbered n={6}>Annual retainer proposal for ongoing compliance (Q10).</Numbered>
      <Numbered n={7}>Counsel referral for the legal review (Q13).</Numbered>

      {/* SIGN-OFF */}
      <View style={s.signoff}>
        <Text style={s.p}>
          Thank you for your time. I&apos;m happy to provide any additional information you need
          before our call. The DPDP exposure is genuinely time-sensitive for me — I would like to
          start the incorporation process within the next two weeks if that aligns with your
          availability.
        </Text>
        <Text style={[s.p, { color: ink, marginTop: 6 }]}>
          <Text style={s.bold}>Hemant Bhagat</Text>
          {"\n"}
          <Text style={{ color: muted }}>hemant1234bhagat@gmail.com</Text>
        </Text>
      </View>

      {/* Page footer */}
      <View style={s.footer} fixed>
        <Text>
          Generated 27 April 2026 — for the personal use of Hemant Bhagat and his appointed CA
        </Text>
        <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
    </Page>
  </Document>
);

async function main() {
  const outPath = path.resolve("docs/business/incorporation-brief-for-ca.pdf");
  await renderToFile(<Brief />, outPath);
  console.log(`[ca-brief] PDF written to ${outPath}`);
}

main().catch((err: unknown) => {
  console.error("[ca-brief] failed:", err);
  process.exit(1);
});
