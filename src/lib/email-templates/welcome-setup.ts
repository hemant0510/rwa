import { APP_NAME } from "@/lib/constants";

export function getWelcomeSetupEmailHtml(
  name: string,
  societyName: string,
  setupUrl: string,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to ${societyName}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:#18181b;padding:24px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.025em;">${APP_NAME}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 8px;color:#18181b;font-size:18px;font-weight:600;">Welcome to ${societyName}!</h2>
              <p style="margin:0 0 24px;color:#52525b;font-size:14px;line-height:1.6;">
                Hi ${name},<br><br>
                Your resident account has been set up by your society admin. Click the button below to create your password and access your account.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="background-color:#18181b;border-radius:8px;">
                    <a href="${setupUrl}" target="_blank" style="display:inline-block;padding:12px 32px;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;">
                      Create My Password
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 16px;color:#71717a;font-size:13px;line-height:1.5;">
                This link will expire in <strong>7 days</strong>. If you did not expect this email, please contact your society admin.
              </p>
              <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0;">
              <p style="margin:0;color:#a1a1aa;font-size:12px;line-height:1.5;">
                If the button doesn&rsquo;t work, copy and paste this link into your browser:<br>
                <a href="${setupUrl}" style="color:#3b82f6;word-break:break-all;">${setupUrl}</a>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#fafafa;padding:16px 32px;text-align:center;border-top:1px solid #e4e4e7;">
              <p style="margin:0;color:#a1a1aa;font-size:11px;">&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
