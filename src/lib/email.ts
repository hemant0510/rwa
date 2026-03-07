import nodemailer from "nodemailer";

function getSmtpConfig() {
  return {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
  };
}

/**
 * Check if SMTP environment variables are configured.
 * If not, email verification is automatically disabled.
 */
export function isEmailConfigured(): boolean {
  const { host, user, pass } = getSmtpConfig();
  return !!(host && user && pass);
}

let transporter: nodemailer.Transporter | null = null;
let lastConfig = "";

function getTransporter(): nodemailer.Transporter {
  const config = getSmtpConfig();
  const configKey = `${config.host}:${config.port}:${config.user}:${config.pass}`;

  // Recreate transporter if config changed (e.g. env vars added after server start)
  if (!transporter || configKey !== lastConfig) {
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
    lastConfig = configKey;
  }
  return transporter;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!isEmailConfigured()) {
    console.warn("[Email] SMTP not configured — skipping email to", to);
    return;
  }

  const config = getSmtpConfig();
  const transport = getTransporter();
  await transport.sendMail({
    from: config.from,
    to,
    subject,
    html,
  });
}
