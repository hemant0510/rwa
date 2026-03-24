const BASE = "/api/v1";

export async function getBillingDashboard() {
  const res = await fetch(`${BASE}/super-admin/billing/dashboard`);
  if (!res.ok) throw new Error("Failed to fetch billing dashboard");
  return res.json();
}

export async function getSubscriptionList(filters?: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
    });
  }
  const res = await fetch(`${BASE}/super-admin/billing/subscriptions?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch subscriptions");
  return res.json();
}

export async function getExpiringSubscriptions(days = 30) {
  const res = await fetch(`${BASE}/super-admin/billing/expiring?days=${days}`);
  if (!res.ok) throw new Error("Failed to fetch expiring subscriptions");
  return res.json();
}

export async function recordSubscriptionPayment(
  societyId: string,
  data: {
    amount: number;
    paymentMode: "CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE" | "OTHER";
    referenceNo?: string;
    paymentDate: string;
    notes?: string;
    sendEmail?: boolean;
    billingOptionId?: string;
  },
) {
  const res = await fetch(`${BASE}/societies/${societyId}/subscription/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message ?? "Failed to record subscription payment");
  }
  return res.json();
}

export async function getSubscription(societyId: string) {
  const res = await fetch(`${BASE}/societies/${societyId}/subscription`);
  if (!res.ok) throw new Error("Failed to fetch subscription");
  return res.json() as Promise<{
    id: string;
    status: string;
    currentPeriodEnd: string | null;
    finalPrice: number | null;
    plan: {
      id: string;
      name: string;
      billingOptions: Array<{ id: string; billingCycle: string; price: number }>;
    } | null;
    billingOption: { id: string; billingCycle: string; price: number } | null;
  }>;
}

export async function getSubscriptionPayments(societyId: string) {
  const res = await fetch(`${BASE}/societies/${societyId}/subscription/payments`);
  if (!res.ok) throw new Error("Failed to fetch subscription payments");
  return res.json();
}

export async function correctSubscriptionPayment(
  societyId: string,
  paymentId: string,
  data: {
    amount?: number;
    paymentMode?: "CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE" | "OTHER";
    referenceNo?: string;
    notes?: string;
    reason: string;
  },
) {
  const res = await fetch(`${BASE}/societies/${societyId}/subscription/payments/${paymentId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message ?? "Failed to correct payment");
  }
  return res.json();
}

export async function reverseSubscriptionPayment(
  societyId: string,
  paymentId: string,
  data: { reason: string },
) {
  const res = await fetch(
    `${BASE}/societies/${societyId}/subscription/payments/${paymentId}/reverse`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message ?? "Failed to reverse payment");
  }
  return res.json();
}

export async function getInvoices(societyId: string) {
  const res = await fetch(`${BASE}/societies/${societyId}/subscription/invoices`);
  if (!res.ok) throw new Error("Failed to fetch invoices");
  return res.json();
}

export async function generateInvoice(
  societyId: string,
  data: { periodStart: string; periodEnd: string; dueDate: string; notes?: string },
) {
  const res = await fetch(`${BASE}/societies/${societyId}/subscription/invoices`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message ?? "Failed to generate invoice");
  }
  return res.json();
}

export async function getInvoiceDetail(societyId: string, invoiceId: string) {
  const res = await fetch(`${BASE}/societies/${societyId}/subscription/invoices/${invoiceId}`);
  if (!res.ok) throw new Error("Failed to fetch invoice detail");
  return res.json();
}

export async function updateInvoice(
  societyId: string,
  invoiceId: string,
  data: {
    status?: "UNPAID" | "PAID" | "PARTIALLY_PAID" | "OVERDUE" | "WAIVED" | "CANCELLED";
    notes?: string;
  },
) {
  const res = await fetch(`${BASE}/societies/${societyId}/subscription/invoices/${invoiceId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message ?? "Failed to update invoice");
  }
  return res.json();
}

export async function sendReminder(societyId: string, templateKey: string) {
  const res = await fetch(`${BASE}/super-admin/billing/send-reminder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ societyId, templateKey }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message ?? "Failed to send reminder");
  }
  return res.json();
}

export async function getAllPayments(params?: { page?: number; limit?: number }) {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  const res = await fetch(`${BASE}/super-admin/billing/payments?${query.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch all payments");
  return res.json();
}

export async function getAllInvoices(params?: { page?: number; limit?: number; status?: string }) {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.status) query.set("status", params.status);
  const res = await fetch(`${BASE}/super-admin/billing/invoices?${query.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch all invoices");
  return res.json();
}

export async function sendBulkReminders(societyIds: string[], templateKey: string) {
  const res = await fetch(`${BASE}/super-admin/billing/send-bulk-reminders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ societyIds, templateKey }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message ?? "Failed to send bulk reminders");
  }
  return res.json();
}
