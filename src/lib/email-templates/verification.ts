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

export function getVerificationEmailHtml(name: string, verificationUrl: string): string {
  const body = [
    emailHeading("Verify your email"),
    emailGreeting(name),
    emailParagraph(
      "Thanks for signing up! Please verify your email address by clicking the button below — it takes one tap and unlocks the rest of your RWA Connect account.",
    ),
    emailButton({ href: verificationUrl, label: "Verify Email Address" }),
    emailMutedNote(
      "This link will expire in 24 hours. If you didn't create an account, you can safely ignore this email.",
    ),
    emailDivider(),
    emailFallbackLink({ href: verificationUrl }),
  ].join("\n");

  return emailLayout({
    preheader: "Verify your email to finish setting up your RWA Connect account",
    body,
  });
}
