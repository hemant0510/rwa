import { APP_NAME, APP_URL } from "@/lib/constants";
import {
  emailCallout,
  emailHeading,
  emailInfoTable,
  emailLayout,
  emailLink,
  emailMutedNote,
  emailParagraph,
  emailUnorderedList,
  escapeHtml,
} from "@/lib/email-templates/layout";
import type { LeadInput } from "@/lib/validations/lead";

/** Operator notification — sent to the Navara Tech / RWA Connect inbox. */
export function getLeadOperatorEmailHtml(data: LeadInput): string {
  const rows: { label: string; value: string }[] = [
    { label: "Name", value: escapeHtml(data.name) },
    { label: "Email", value: emailLink(`mailto:${data.email}`, data.email) },
  ];
  if (data.phone) {
    rows.push({ label: "Phone", value: emailLink(`tel:${data.phone}`, data.phone) });
  }
  if (data.societyName) rows.push({ label: "Society", value: escapeHtml(data.societyName) });
  if (data.unitCount) rows.push({ label: "Units", value: escapeHtml(String(data.unitCount)) });
  if (data.message) rows.push({ label: "Message", value: escapeHtml(data.message) });

  const body = [
    emailHeading(`New lead from ${APP_NAME}`),
    emailParagraph("Someone just submitted the contact form. Details below."),
    emailInfoTable(rows),
    emailMutedNote(
      `Reply directly to this email to respond to ${data.name}. Their email address is in the table above.`,
    ),
  ].join("\n");

  return emailLayout({
    preheader: `New lead: ${data.name}${data.societyName ? ` — ${data.societyName}` : ""}`,
    body,
    eyebrow: "Inbound lead",
  });
}

/** Auto-reply — sent to the submitter to acknowledge receipt. */
export function getLeadAutoReplyEmailHtml(data: LeadInput): string {
  const firstName = data.name.split(/\s+/)[0] || "there";
  const body = [
    emailHeading(`Thanks, ${firstName}!`),
    emailParagraph(
      "We've received your message at RWA Connect. Someone from our team will reach out within 24 hours during business days.",
    ),
    emailCallout(
      "<strong>What happens next:</strong> We'll review your note, and if you mentioned a society we'll prepare a quick demo of the modules most relevant to you.",
      "success",
    ),
    emailParagraph("In the meantime, feel free to explore:"),
    emailUnorderedList([
      `${emailLink(`${APP_URL}/features`, "Browse the full feature list")} — 10 modules covering residents, fees, expenses, petitions, and more`,
      `${emailLink(`${APP_URL}/pricing`, "See pricing")} — plans start at &#8377;499/month, 14-day free trial, no credit card`,
      `${emailLink(`${APP_URL}/security`, "Read our security overview")} — DPDP-aligned, Postgres RLS, audit logs`,
    ]),
    emailMutedNote(
      "If this wasn't you, please ignore this email — no action is needed and we won't contact you again.",
    ),
  ].join("\n");

  return emailLayout({
    preheader: "Thanks for reaching out — we'll be in touch within 24 hours",
    body,
    eyebrow: "Message received",
  });
}
