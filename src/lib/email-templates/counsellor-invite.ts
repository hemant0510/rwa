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
  emailUnorderedList,
} from "@/lib/email-templates/layout";

export function getCounsellorInviteEmailHtml(name: string, setupUrl: string): string {
  const body = [
    emailHeading("You've been invited as a Counsellor"),
    emailGreeting(name),
    emailParagraph(
      "You have been appointed as a Counsellor on RWA Connect — a platform-appointed ombudsperson who helps mediate between residents and society admins.",
    ),
    emailButton({ href: setupUrl, label: "Set Up Account" }),
    emailCallout(
      "<strong>What happens next:</strong> create your password, enrol in multi-factor authentication, and complete a short onboarding. Then you'll see the societies assigned to you and any escalated tickets.",
      "info",
    ),
    emailUnorderedList([
      "You only see <strong>escalated tickets</strong> — never finances or routine resident data.",
      "Your access is read-mostly. You post advisory notes; admins close tickets.",
      "Every action you take is recorded in an audit log.",
    ]),
    emailMutedNote(
      "This link expires in 24 hours. If you weren't expecting this invitation, you can safely ignore this email.",
    ),
    emailDivider(),
    emailFallbackLink({ href: setupUrl }),
  ].join("\n");

  return emailLayout({
    preheader: "Your Counsellor account is ready — set your password and enrol MFA",
    body,
    eyebrow: "Counsellor program",
  });
}
