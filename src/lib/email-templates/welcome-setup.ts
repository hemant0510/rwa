import {
  emailButton,
  emailCallout,
  emailDivider,
  emailFallbackLink,
  emailGreeting,
  emailHeading,
  emailLayout,
  emailMutedNote,
  emailParagraph,
  escapeHtml,
} from "@/lib/email-templates/layout";

export function getWelcomeSetupEmailHtml(
  name: string,
  societyName: string,
  setupUrl: string,
): string {
  const body = [
    emailHeading(`Welcome to ${societyName}`),
    emailGreeting(name),
    emailParagraph(
      `Your resident account on <strong>${escapeHtml(societyName)}</strong> has been set up by your society admin. Click the button below to create your password and access your account.`,
    ),
    emailButton({ href: setupUrl, label: "Create My Password" }),
    emailCallout(
      "<strong>What you can do once signed in:</strong> pay maintenance via UPI (zero fee), see expenses, raise complaints, sign petitions, and manage your household — all from your phone.",
      "info",
    ),
    emailMutedNote(
      "This link will expire in 7 days. If you weren't expecting this email, please contact your society admin.",
    ),
    emailDivider(),
    emailFallbackLink({ href: setupUrl }),
  ].join("\n");

  return emailLayout({
    preheader: `Welcome to ${societyName} — set up your account in 60 seconds`,
    body,
    eyebrow: "Resident invitation",
  });
}
