import { APP_NAME, APP_URL } from "@/lib/constants";

function wrapEmail(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="540" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
          <tr>
            <td style="background-color:#18181b;padding:24px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">${APP_NAME}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              ${body}
              <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0;">
              <p style="margin:0;color:#a1a1aa;font-size:12px;">
                Support: <a href="mailto:support@rwa-connect.example" style="color:#3b82f6;">support@rwa-connect.example</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function getPaymentReceivedEmailHtml(params: {
  societyName: string;
  amount: number;
  invoiceNo: string;
  paymentDate: string;
}) {
  return wrapEmail(
    "Payment Received",
    `<h2 style="margin:0 0 8px;color:#18181b;font-size:18px;">Payment Received</h2>
     <p style="margin:0 0 16px;color:#52525b;font-size:14px;line-height:1.6;">
       Dear ${params.societyName} Admin,<br><br>
       We have recorded your subscription payment.
     </p>
     <ul style="margin:0 0 16px;padding-left:18px;color:#374151;font-size:14px;line-height:1.7;">
       <li>Amount: ₹${params.amount.toLocaleString("en-IN")}</li>
       <li>Invoice No: ${params.invoiceNo}</li>
       <li>Payment Date: ${params.paymentDate}</li>
     </ul>
     <p style="margin:0;color:#52525b;font-size:14px;">You can review details on your subscription page in ${APP_NAME}.</p>`,
  );
}

export function getInvoiceGeneratedEmailHtml(params: {
  societyName: string;
  invoiceNo: string;
  amount: number;
  dueDate: string;
}) {
  return wrapEmail(
    "Invoice Generated",
    `<h2 style="margin:0 0 8px;color:#18181b;font-size:18px;">New Subscription Invoice</h2>
     <p style="margin:0 0 16px;color:#52525b;font-size:14px;line-height:1.6;">
       Dear ${params.societyName} Admin,<br><br>
       A new invoice has been generated for your subscription.
     </p>
     <ul style="margin:0 0 16px;padding-left:18px;color:#374151;font-size:14px;line-height:1.7;">
       <li>Invoice No: ${params.invoiceNo}</li>
       <li>Amount Due: ₹${params.amount.toLocaleString("en-IN")}</li>
       <li>Due Date: ${params.dueDate}</li>
     </ul>
     <p style="margin:0;color:#52525b;font-size:14px;">Login here: <a href="${APP_URL}" style="color:#3b82f6;">${APP_URL}</a></p>`,
  );
}

export function getSubscriptionReminderEmailHtml(params: {
  societyName: string;
  subject: string;
  message: string;
}) {
  return wrapEmail(
    params.subject,
    `<h2 style="margin:0 0 8px;color:#18181b;font-size:18px;">${params.subject}</h2>
     <p style="margin:0;color:#52525b;font-size:14px;line-height:1.6;">
       Dear ${params.societyName} Admin,<br><br>
       ${params.message}
     </p>`,
  );
}
