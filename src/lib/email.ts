import nodemailer from "nodemailer";

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;

/**
 * Check if SMTP environment variables are configured.
 * If not, email verification is automatically disabled.
 */
export function isEmailConfigured(): boolean {
  return !!(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
  }
  return transporter;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!isEmailConfigured()) {
    console.warn("[Email] SMTP not configured — skipping email to", to);
    return;
  }

  const transport = getTransporter();
  await transport.sendMail({
    from: SMTP_FROM,
    to,
    subject,
    html,
  });
}
