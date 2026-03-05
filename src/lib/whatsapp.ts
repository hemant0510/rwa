/**
 * WhatsApp Business API (WATI) integration service.
 * Sends templated messages via WATI API.
 *
 * Required env vars:
 * - WATI_API_URL: WATI API base URL
 * - WATI_API_KEY: WATI API bearer token
 */

const WATI_API_URL = process.env.WATI_API_URL || "";
const WATI_API_KEY = process.env.WATI_API_KEY || "";

interface WatiTemplateParam {
  name: string;
  value: string;
}

interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

async function sendTemplateMessage(
  mobile: string,
  templateName: string,
  params: WatiTemplateParam[],
): Promise<SendResult> {
  if (!WATI_API_URL || !WATI_API_KEY) {
    console.warn("[WhatsApp] WATI not configured, skipping message send");
    return { success: false, error: "WATI not configured" };
  }

  try {
    const res = await fetch(
      `${WATI_API_URL}/api/v1/sendTemplateMessage?whatsappNumber=91${mobile}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WATI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          template_name: templateName,
          broadcast_name: `auto_${Date.now()}`,
          parameters: params,
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      console.error("[WhatsApp] Send failed:", err);
      return { success: false, error: err };
    }

    const data = await res.json();
    return { success: true, messageId: data.messageId };
  } catch (err) {
    console.error("[WhatsApp] Send error:", err);
    return { success: false, error: String(err) };
  }
}

// === Template message senders ===

export async function sendRegistrationConfirmation(
  mobile: string,
  residentName: string,
  societyName: string,
) {
  return sendTemplateMessage(mobile, "registration_confirmation", [
    { name: "1", value: residentName },
    { name: "2", value: societyName },
  ]);
}

export async function sendApprovalNotification(
  mobile: string,
  residentName: string,
  rwaid: string,
  societyName: string,
) {
  return sendTemplateMessage(mobile, "approval_notification", [
    { name: "1", value: residentName },
    { name: "2", value: rwaid },
    { name: "3", value: societyName },
  ]);
}

export async function sendRejectionNotification(
  mobile: string,
  residentName: string,
  reason: string,
) {
  return sendTemplateMessage(mobile, "rejection_notification", [
    { name: "1", value: residentName },
    { name: "2", value: reason },
  ]);
}

export async function sendPaymentReceipt(
  mobile: string,
  residentName: string,
  amount: string,
  receiptNo: string,
  sessionYear: string,
) {
  return sendTemplateMessage(mobile, "payment_receipt", [
    { name: "1", value: residentName },
    { name: "2", value: amount },
    { name: "3", value: receiptNo },
    { name: "4", value: sessionYear },
  ]);
}

export async function sendFeeReminder(
  mobile: string,
  residentName: string,
  amount: string,
  dueDate: string,
) {
  return sendTemplateMessage(mobile, "fee_reminder", [
    { name: "1", value: residentName },
    { name: "2", value: amount },
    { name: "3", value: dueDate },
  ]);
}

export async function sendBroadcastMessage(mobile: string, message: string) {
  return sendTemplateMessage(mobile, "broadcast_message", [{ name: "1", value: message }]);
}
