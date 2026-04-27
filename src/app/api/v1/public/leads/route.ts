// Anonymous by design — accepts contact-form submissions from the public site.
// Honeypot anti-spam + Zod validation. Sends two emails:
//   1. Operator notification → LEADS_INBOX_EMAIL (env) or SMTP_USER fallback
//   2. Auto-reply acknowledgement → the submitter's email
// Both emails use the shared branded layout in src/lib/email-templates/layout.ts
// See: execution_plan/plans/pre-auth-experience.md §4.2

import type { NextResponse } from "next/server";

import { errorResponse, parseBody, successResponse } from "@/lib/api-helpers";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import {
  getLeadAutoReplyEmailHtml,
  getLeadOperatorEmailHtml,
} from "@/lib/email-templates/contact-lead";
import { leadSchema } from "@/lib/validations/lead";

const LEAD_DESTINATION =
  process.env.LEADS_INBOX_EMAIL ?? process.env.SMTP_USER ?? "rwaconnect360@gmail.com";

export async function POST(request: Request): Promise<NextResponse> {
  const { data, error } = await parseBody(request, leadSchema);
  if (error) return error;

  // Honeypot — silently succeed for bots so they don't retry
  if (data.honeypot && data.honeypot.length > 0) {
    return successResponse({ ok: true });
  }

  console.info("[lead] new contact submission", {
    name: data.name,
    email: data.email,
    societyName: data.societyName,
    emailConfigured: isEmailConfigured(),
  });

  if (isEmailConfigured()) {
    // Fan out: operator notification + submitter auto-reply.
    // Both run in parallel; failures are logged but never block the user response.
    const operatorEmail = sendEmail(
      LEAD_DESTINATION,
      `New lead: ${data.name}${data.societyName ? ` — ${data.societyName}` : ""}`,
      getLeadOperatorEmailHtml(data),
    ).catch((err: unknown) => {
      console.error("[lead] failed to send operator notification", err);
    });

    const submitterAutoReply = sendEmail(
      data.email,
      "Thanks for reaching out — RWA Connect",
      getLeadAutoReplyEmailHtml(data),
    ).catch((err: unknown) => {
      console.error("[lead] failed to send submitter auto-reply", err);
    });

    await Promise.all([operatorEmail, submitterAutoReply]);
  }

  return successResponse({ ok: true });
}

// Block other methods so we don't return HTML 404s
export async function GET() {
  return errorResponse({ code: "METHOD_NOT_ALLOWED", message: "POST only", status: 405 });
}
