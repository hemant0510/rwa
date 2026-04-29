// Renders every email template to public/_email-preview/<name>.html
// so you can open them in a browser to inspect the new branded design.
// Usage: npx tsx scripts/preview-emails.ts

import { mkdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import {
  getLeadAutoReplyEmailHtml,
  getLeadOperatorEmailHtml,
} from "../src/lib/email-templates/contact-lead";
import { getCounsellorInviteEmailHtml } from "../src/lib/email-templates/counsellor-invite";
import { getPasswordResetEmailHtml } from "../src/lib/email-templates/password-reset";
import {
  getInvoiceGeneratedEmailHtml,
  getPaymentReceivedEmailHtml,
  getSubscriptionReminderEmailHtml,
} from "../src/lib/email-templates/subscription";
import { getVerificationEmailHtml } from "../src/lib/email-templates/verification";
import { getWelcomeSetupEmailHtml } from "../src/lib/email-templates/welcome-setup";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "_email-preview");
mkdirSync(OUT, { recursive: true });

const samples: Record<string, string> = {
  "verification.html": getVerificationEmailHtml(
    "Arjun Kapoor",
    "https://rwaconnect.in/verify?token=abc123",
  ),
  "password-reset.html": getPasswordResetEmailHtml(
    "Arjun Kapoor",
    "https://rwaconnect.in/reset?token=xyz456",
  ),
  "welcome-setup.html": getWelcomeSetupEmailHtml(
    "Priya Sharma",
    "Greenwood Residency",
    "https://rwaconnect.in/setup?token=qwe789",
  ),
  "counsellor-invite.html": getCounsellorInviteEmailHtml(
    "Dr. Meera Iyer",
    "https://rwaconnect.in/counsellor/set-password?token=zxc321",
  ),
  "subscription-payment-received.html": getPaymentReceivedEmailHtml({
    societyName: "Greenwood Residency",
    amount: 17990,
    invoiceNo: "INV-2026-0042",
    paymentDate: "27 Apr 2026",
  }),
  "subscription-invoice.html": getInvoiceGeneratedEmailHtml({
    societyName: "Greenwood Residency",
    invoiceNo: "INV-2026-0043",
    amount: 17990,
    dueDate: "10 May 2026",
  }),
  "subscription-reminder.html": getSubscriptionReminderEmailHtml({
    societyName: "Greenwood Residency",
    subject: "Your Community plan renews in 7 days",
    message:
      "Your annual subscription expires on 10 May 2026. Pay by then to avoid any interruption to WhatsApp notifications, petitions, and community events.",
  }),
  "lead-operator.html": getLeadOperatorEmailHtml({
    name: "Hemant Bhagat",
    email: "hemant1234bhagat@gmail.com",
    phone: "+91 98765 43210",
    societyName: "Greenwood Residency",
    unitCount: "180",
    message: "Saw the new design — wanted to test the branded email template.",
    honeypot: "",
  }),
  "lead-autoreply.html": getLeadAutoReplyEmailHtml({
    name: "Hemant Bhagat",
    email: "hemant1234bhagat@gmail.com",
    phone: "",
    societyName: "Greenwood Residency",
    unitCount: "",
    message: "",
    honeypot: "",
  }),
};

const indexLines = [
  "<!DOCTYPE html><html><head><meta charset='utf-8'><title>RWA Connect — Email Templates</title>",
  "<style>body{font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;background:#f4f4f5;padding:40px;max-width:720px;margin:0 auto;color:#111;}h1{font-size:24px;margin:0 0 6px;}p{color:#555;margin:0 0 24px;}ul{list-style:none;padding:0;}li{margin:0 0 10px;}a{display:block;padding:14px 18px;background:#fff;border:1px solid #e4e4e7;border-radius:10px;color:#0d9488;text-decoration:none;font-weight:600;}a:hover{border-color:#0d9488;}</style></head><body>",
  "<h1>RWA Connect — Email Template Previews</h1>",
  "<p>All templates use the shared branded layout (teal gradient header, Navara Tech footer attribution).</p>",
  "<ul>",
];
for (const file of Object.keys(samples)) {
  writeFileSync(join(OUT, file), samples[file]);
  indexLines.push(
    `<li><a href="./${file}">${file.replace(".html", "").replace(/-/g, " ")}</a></li>`,
  );
}
indexLines.push("</ul></body></html>");
writeFileSync(join(OUT, "index.html"), indexLines.join("\n"));

console.log(`Wrote ${Object.keys(samples).length + 1} files to ${OUT}`);
console.log("Open: http://localhost:3000/_email-preview/index.html");
