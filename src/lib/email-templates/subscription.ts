import { APP_NAME, APP_URL } from "@/lib/constants";
import {
  emailButton,
  emailCallout,
  emailGreeting,
  emailHeading,
  emailInfoTable,
  emailLayout,
  emailLink,
  emailParagraph,
  escapeHtml,
} from "@/lib/email-templates/layout";

const INR = (amount: number) =>
  `&#8377;${amount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export function getPaymentReceivedEmailHtml(params: {
  societyName: string;
  amount: number;
  invoiceNo: string;
  paymentDate: string;
}) {
  const body = [
    emailHeading("Payment received"),
    emailGreeting(`${params.societyName} Admin`),
    emailParagraph("We've recorded your subscription payment. Thank you!"),
    emailInfoTable([
      { label: "Amount", value: INR(params.amount) },
      { label: "Invoice number", value: escapeHtml(params.invoiceNo) },
      { label: "Payment date", value: escapeHtml(params.paymentDate) },
    ]),
    emailParagraph(
      `You can review the invoice and download a receipt from your subscription page in ${escapeHtml(APP_NAME)}.`,
    ),
    emailButton({ href: `${APP_URL}/admin/settings/subscription`, label: "View Subscription" }),
  ].join("\n");

  return emailLayout({
    preheader: `Payment of ${INR(params.amount)} received for invoice ${params.invoiceNo}`,
    body,
    eyebrow: "Subscription billing",
  });
}

export function getInvoiceGeneratedEmailHtml(params: {
  societyName: string;
  invoiceNo: string;
  amount: number;
  dueDate: string;
}) {
  const body = [
    emailHeading("New subscription invoice"),
    emailGreeting(`${params.societyName} Admin`),
    emailParagraph("A new invoice has been generated for your RWA Connect subscription."),
    emailInfoTable([
      { label: "Invoice number", value: escapeHtml(params.invoiceNo) },
      { label: "Amount due", value: INR(params.amount) },
      { label: "Due date", value: escapeHtml(params.dueDate) },
    ]),
    emailButton({ href: `${APP_URL}/admin/settings/subscription`, label: "View Invoice" }),
    emailParagraph(
      `Or sign in directly at ${emailLink(APP_URL, APP_URL.replace(/^https?:\/\//, ""))}.`,
    ),
  ].join("\n");

  return emailLayout({
    preheader: `Invoice ${params.invoiceNo} for ${INR(params.amount)} — due ${params.dueDate}`,
    body,
    eyebrow: "Subscription billing",
  });
}

export function getSubscriptionReminderEmailHtml(params: {
  societyName: string;
  subject: string;
  message: string;
}) {
  const body = [
    emailHeading(params.subject),
    emailGreeting(`${params.societyName} Admin`),
    emailCallout(escapeHtml(params.message), "warning"),
    emailButton({ href: `${APP_URL}/admin/settings/subscription`, label: "Open Subscription" }),
  ].join("\n");

  return emailLayout({
    preheader: params.subject,
    body,
    eyebrow: "Subscription reminder",
  });
}
