import {
  emailButton,
  emailDivider,
  emailFallbackLink,
  emailGreeting,
  emailHeading,
  emailLayout,
  emailMutedNote,
  emailParagraph,
} from "@/lib/email-templates/layout";

export function getPasswordResetEmailHtml(name: string, resetUrl: string): string {
  const body = [
    emailHeading("Reset your password"),
    emailGreeting(name),
    emailParagraph(
      "We received a request to reset the password for your RWA Connect account. Click the button below to set a new one.",
    ),
    emailButton({ href: resetUrl, label: "Reset Password" }),
    emailMutedNote(
      "This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email — your account is still secure.",
    ),
    emailDivider(),
    emailFallbackLink({ href: resetUrl }),
  ].join("\n");

  return emailLayout({
    preheader: "Reset your RWA Connect password — link valid for 1 hour",
    body,
  });
}
