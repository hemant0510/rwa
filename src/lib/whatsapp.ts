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

export async function sendEventPublished(
  mobile: string,
  residentName: string,
  eventTitle: string,
  eventDate: string,
  location: string,
  feeInfo: string,
) {
  return sendTemplateMessage(mobile, "event_published", [
    { name: "1", value: residentName },
    { name: "2", value: eventTitle },
    { name: "3", value: eventDate },
    { name: "4", value: location },
    { name: "5", value: feeInfo },
  ]);
}

export async function sendEventPaymentTriggered(
  mobile: string,
  residentName: string,
  eventTitle: string,
  pricePerUnit: string,
  totalDue: string,
) {
  return sendTemplateMessage(mobile, "event_payment_triggered", [
    { name: "1", value: residentName },
    { name: "2", value: eventTitle },
    { name: "3", value: pricePerUnit },
    { name: "4", value: totalDue },
  ]);
}

export async function sendEventCancelled(
  mobile: string,
  residentName: string,
  eventTitle: string,
  reason: string,
) {
  return sendTemplateMessage(mobile, "event_cancelled", [
    { name: "1", value: residentName },
    { name: "2", value: eventTitle },
    { name: "3", value: reason },
  ]);
}

export async function sendPetitionPublished(
  mobile: string,
  residentName: string,
  petitionTitle: string,
  petitionType: string,
  targetAuthority: string,
) {
  return sendTemplateMessage(mobile, "petition_published", [
    { name: "1", value: residentName },
    { name: "2", value: petitionTitle },
    { name: "3", value: petitionType },
    { name: "4", value: targetAuthority },
  ]);
}

export async function sendPetitionSubmitted(
  mobile: string,
  residentName: string,
  petitionTitle: string,
  targetAuthority: string,
  submittedDate: string,
) {
  return sendTemplateMessage(mobile, "petition_submitted", [
    { name: "1", value: residentName },
    { name: "2", value: petitionTitle },
    { name: "3", value: targetAuthority },
    { name: "4", value: submittedDate },
  ]);
}

export async function sendSocietySuspended(
  mobile: string,
  adminName: string,
  societyName: string,
  reason: string,
  gracePeriodEnd: string | null,
) {
  return sendTemplateMessage(mobile, "society_suspended", [
    { name: "1", value: adminName },
    { name: "2", value: societyName },
    { name: "3", value: reason },
    { name: "4", value: gracePeriodEnd ?? "immediately" },
  ]);
}

export async function sendSocietyReactivated(
  mobile: string,
  adminName: string,
  societyName: string,
) {
  return sendTemplateMessage(mobile, "society_reactivated", [
    { name: "1", value: adminName },
    { name: "2", value: societyName },
  ]);
}

export async function sendAdminPaymentClaimReceived(
  mobile: string,
  residentName: string,
  flatNo: string,
  amount: string,
  utrNumber: string,
) {
  return sendTemplateMessage(mobile, "admin_payment_claim_received", [
    { name: "1", value: residentName },
    { name: "2", value: flatNo },
    { name: "3", value: amount },
    { name: "4", value: utrNumber },
  ]);
}

export async function sendResidentPaymentConfirmed(
  mobile: string,
  amount: string,
  receiptNo: string,
) {
  return sendTemplateMessage(mobile, "resident_payment_confirmed", [
    { name: "1", value: amount },
    { name: "2", value: receiptNo },
  ]);
}

export async function sendResidentPaymentRejected(
  mobile: string,
  amount: string,
  rejectionReason: string,
) {
  return sendTemplateMessage(mobile, "resident_payment_rejected", [
    { name: "1", value: amount },
    { name: "2", value: rejectionReason },
  ]);
}

export async function sendAdminClaimReminder24h(mobile: string, pendingCount: string) {
  return sendTemplateMessage(mobile, "admin_claim_reminder_24h", [
    { name: "1", value: pendingCount },
  ]);
}

export async function sendAdminClaimReminder48h(mobile: string, pendingCount: string) {
  return sendTemplateMessage(mobile, "admin_claim_reminder_48h", [
    { name: "1", value: pendingCount },
  ]);
}

export async function sendAdminSubPaymentConfirmed(
  mobile: string,
  amount: string,
  periodStart: string,
  periodEnd: string,
) {
  return sendTemplateMessage(mobile, "admin_sub_payment_confirmed", [
    { name: "1", value: amount },
    { name: "2", value: periodStart },
    { name: "3", value: periodEnd },
  ]);
}

export async function sendAdminSubPaymentRejected(
  mobile: string,
  amount: string,
  rejectionReason: string,
) {
  return sendTemplateMessage(mobile, "admin_sub_payment_rejected", [
    { name: "1", value: amount },
    { name: "2", value: rejectionReason },
  ]);
}

export async function sendSocietyOffboarded(
  mobile: string,
  adminName: string,
  societyName: string,
) {
  return sendTemplateMessage(mobile, "society_offboarded", [
    { name: "1", value: adminName },
    { name: "2", value: societyName },
  ]);
}
