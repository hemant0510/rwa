import type { CreateRequestInput, CreateMessageInput } from "@/lib/validations/support";

const ADMIN_BASE = "/api/v1/admin/support";
const SA_BASE = "/api/v1/super-admin/support";

// --- Shared types ---

export interface ServiceRequestItem {
  id: string;
  requestNumber: number;
  type: string;
  priority: string;
  status: string;
  subject: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  society?: { name: string };
  createdByUser?: { name: string };
  _count?: { messages: number };
}

export interface ServiceRequestDetail extends ServiceRequestItem {
  resolvedAt: string | null;
  closedAt: string | null;
  closedReason: string | null;
  messages: MessageItem[];
}

export interface MessageItem {
  id: string;
  authorId: string;
  authorRole: string;
  content: string;
  isInternal: boolean;
  attachments: string[];
  createdAt: string;
}

// --- Admin API ---

export async function getAdminRequests(
  filters: Record<string, string> = {},
): Promise<{ data: ServiceRequestItem[]; total: number }> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v) params.set(k, v);
  }
  const res = await fetch(`${ADMIN_BASE}?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch support requests");
  return res.json();
}

export async function createRequest(data: CreateRequestInput): Promise<ServiceRequestItem> {
  const res = await fetch(ADMIN_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message ?? "Failed to create request");
  }
  return res.json();
}

export async function getAdminRequestDetail(id: string): Promise<ServiceRequestDetail> {
  const res = await fetch(`${ADMIN_BASE}/${id}`);
  if (!res.ok) throw new Error("Failed to fetch request detail");
  return res.json();
}

export async function postAdminMessage(id: string, data: CreateMessageInput): Promise<MessageItem> {
  const res = await fetch(`${ADMIN_BASE}/${id}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to post message");
  return res.json();
}

export async function reopenRequest(id: string): Promise<void> {
  const res = await fetch(`${ADMIN_BASE}/${id}/reopen`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message ?? "Failed to reopen request");
  }
}

export async function getUnreadCount(): Promise<{ count: number }> {
  const res = await fetch(`${ADMIN_BASE}/unread-count`);
  if (!res.ok) throw new Error("Failed to fetch unread count");
  return res.json();
}

// --- SA API ---

export async function getSARequests(
  filters: Record<string, string> = {},
): Promise<{ data: ServiceRequestItem[]; total: number }> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v) params.set(k, v);
  }
  const res = await fetch(`${SA_BASE}?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch support requests");
  return res.json();
}

export async function getSAStats(): Promise<Record<string, number | null>> {
  const res = await fetch(`${SA_BASE}/stats`);
  if (!res.ok) throw new Error("Failed to fetch support stats");
  return res.json();
}

export async function getSARequestDetail(id: string): Promise<ServiceRequestDetail> {
  const res = await fetch(`${SA_BASE}/${id}`);
  if (!res.ok) throw new Error("Failed to fetch request detail");
  return res.json();
}

export async function postSAMessage(id: string, data: CreateMessageInput): Promise<MessageItem> {
  const res = await fetch(`${SA_BASE}/${id}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to post message");
  return res.json();
}

export async function changeSAStatus(id: string, status: string, reason?: string): Promise<void> {
  const res = await fetch(`${SA_BASE}/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, reason }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message ?? "Failed to change status");
  }
}
