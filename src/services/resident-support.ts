import type {
  CreateResidentTicketInput,
  CreateResidentTicketMessageInput,
  ChangeResidentTicketStatusInput,
  ChangeResidentTicketPriorityInput,
  LinkPetitionInput,
} from "@/lib/validations/resident-support";
import type {
  AssigneeItem,
  AttachmentItem,
  PaginatedResidentTickets,
  ResidentTicketDetail,
  ResidentTicketStats,
} from "@/types/resident-support";

const RESIDENT_BASE = "/api/v1/residents/me/support";
const ADMIN_BASE = "/api/v1/admin/resident-support";

// ─── Resident API ─────────────────────────────────────────────────

export async function getResidentTickets(
  filters: Record<string, string> = {},
): Promise<PaginatedResidentTickets> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v) params.set(k, v);
  }
  const res = await fetch(`${RESIDENT_BASE}?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch tickets");
  return res.json();
}

export async function createResidentTicket(
  data: CreateResidentTicketInput,
): Promise<ResidentTicketDetail> {
  const res = await fetch(RESIDENT_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message ?? "Failed to create ticket");
  }
  return res.json();
}

export async function getResidentTicketDetail(id: string): Promise<ResidentTicketDetail> {
  const res = await fetch(`${RESIDENT_BASE}/${id}`);
  if (!res.ok) throw new Error("Failed to fetch ticket detail");
  return res.json();
}

export async function postResidentTicketMessage(
  id: string,
  data: CreateResidentTicketMessageInput,
): Promise<unknown> {
  const res = await fetch(`${RESIDENT_BASE}/${id}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message ?? "Failed to post message");
  }
  return res.json();
}

export async function reopenResidentTicket(id: string): Promise<void> {
  const res = await fetch(`${RESIDENT_BASE}/${id}/reopen`, { method: "POST" });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message ?? "Failed to reopen ticket");
  }
}

export async function getResidentUnreadCount(): Promise<{ count: number }> {
  const res = await fetch(`${RESIDENT_BASE}/unread-count`);
  if (!res.ok) throw new Error("Failed to fetch unread count");
  return res.json();
}

export async function uploadResidentTicketAttachment(
  ticketId: string,
  file: File,
  messageId?: string,
): Promise<AttachmentItem> {
  const formData = new FormData();
  formData.append("file", file);
  if (messageId) formData.append("messageId", messageId);
  const res = await fetch(`${RESIDENT_BASE}/${ticketId}/attachments`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message ?? "Failed to upload attachment");
  }
  return res.json();
}

export async function getResidentTicketAttachments(ticketId: string): Promise<AttachmentItem[]> {
  const res = await fetch(`${RESIDENT_BASE}/${ticketId}/attachments`);
  if (!res.ok) throw new Error("Failed to fetch attachments");
  return res.json();
}

export async function linkResidentTicketPetition(
  ticketId: string,
  petitionId: string | null,
): Promise<ResidentTicketDetail> {
  const res = await fetch(`${RESIDENT_BASE}/${ticketId}/link-petition`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ petitionId } satisfies LinkPetitionInput),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message ?? "Failed to link petition");
  }
  return res.json();
}

// ─── Admin API ────────────────────────────────────────────────────

export async function getAdminResidentTickets(
  filters: Record<string, string> = {},
): Promise<PaginatedResidentTickets> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v) params.set(k, v);
  }
  const res = await fetch(`${ADMIN_BASE}?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch resident tickets");
  return res.json();
}

export async function getAdminResidentStats(): Promise<ResidentTicketStats> {
  const res = await fetch(`${ADMIN_BASE}/stats`);
  if (!res.ok) throw new Error("Failed to fetch resident ticket stats");
  return res.json();
}

export async function getAdminResidentTicketDetail(id: string): Promise<ResidentTicketDetail> {
  const res = await fetch(`${ADMIN_BASE}/${id}`);
  if (!res.ok) throw new Error("Failed to fetch ticket detail");
  return res.json();
}

export async function postAdminResidentMessage(
  id: string,
  data: CreateResidentTicketMessageInput,
): Promise<unknown> {
  const res = await fetch(`${ADMIN_BASE}/${id}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to post message");
  return res.json();
}

export async function changeAdminResidentTicketStatus(
  id: string,
  data: ChangeResidentTicketStatusInput,
): Promise<void> {
  const res = await fetch(`${ADMIN_BASE}/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message ?? "Failed to change status");
  }
}

export async function changeAdminResidentTicketPriority(
  id: string,
  data: ChangeResidentTicketPriorityInput,
): Promise<void> {
  const res = await fetch(`${ADMIN_BASE}/${id}/priority`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message ?? "Failed to change priority");
  }
}

export async function linkTicketPetition(
  ticketId: string,
  petitionId: string | null,
): Promise<ResidentTicketDetail> {
  const res = await fetch(`${ADMIN_BASE}/${ticketId}/link-petition`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ petitionId } satisfies LinkPetitionInput),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message ?? "Failed to link petition");
  }
  return res.json();
}

export async function getAdminResidentUnreadCount(): Promise<{ count: number }> {
  const res = await fetch(`${ADMIN_BASE}/unread-count`);
  if (!res.ok) throw new Error("Failed to fetch unread count");
  return res.json();
}

export async function uploadAdminResidentAttachment(
  ticketId: string,
  file: File,
  messageId?: string,
): Promise<AttachmentItem> {
  const formData = new FormData();
  formData.append("file", file);
  if (messageId) formData.append("messageId", messageId);
  const res = await fetch(`${ADMIN_BASE}/${ticketId}/attachments`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message ?? "Failed to upload attachment");
  }
  return res.json();
}

export async function getAdminResidentAttachments(ticketId: string): Promise<AttachmentItem[]> {
  const res = await fetch(`${ADMIN_BASE}/${ticketId}/attachments`);
  if (!res.ok) throw new Error("Failed to fetch attachments");
  return res.json();
}

export async function addTicketAssignee(ticketId: string, userId: string): Promise<AssigneeItem> {
  const res = await fetch(`${ADMIN_BASE}/${ticketId}/assignees`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    const err = (await res.json()) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? "Failed to assign member");
  }
  return res.json() as Promise<AssigneeItem>;
}

export async function removeTicketAssignee(ticketId: string, userId: string): Promise<void> {
  const res = await fetch(
    `${ADMIN_BASE}/${ticketId}/assignees?userId=${encodeURIComponent(userId)}`,
    { method: "DELETE" },
  );
  if (!res.ok) {
    const err = (await res.json()) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? "Failed to remove assignee");
  }
}

// ─── Escalation API ───────────────────────────────────────────────

export interface EscalationStatus {
  ticketId: string;
  threshold: number;
  voteCount: number;
  hasVoted: boolean;
  escalationCreated: boolean;
}

export async function getResidentEscalationStatus(ticketId: string): Promise<EscalationStatus> {
  const res = await fetch(`${RESIDENT_BASE}/${ticketId}/escalation-status`);
  if (!res.ok) throw new Error("Failed to fetch escalation status");
  return res.json();
}

export async function castEscalationVote(ticketId: string): Promise<EscalationStatus> {
  const res = await fetch(`${RESIDENT_BASE}/${ticketId}/escalation-vote`, { method: "POST" });
  if (!res.ok) {
    const err = (await res.json()) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? "Failed to cast vote");
  }
  return res.json();
}

export async function withdrawEscalationVote(ticketId: string): Promise<EscalationStatus> {
  const res = await fetch(`${RESIDENT_BASE}/${ticketId}/escalation-vote`, { method: "DELETE" });
  if (!res.ok) {
    const err = (await res.json()) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? "Failed to withdraw vote");
  }
  return res.json();
}

export async function adminEscalateTicket(
  ticketId: string,
  reason: string,
): Promise<{ id: string }> {
  const res = await fetch(`${ADMIN_BASE}/${ticketId}/escalate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const err = (await res.json()) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? "Failed to escalate ticket");
  }
  return res.json();
}

export async function adminNotifyCounsellor(
  ticketId: string,
  reason: string,
): Promise<{ id: string }> {
  const res = await fetch(`${ADMIN_BASE}/${ticketId}/notify-counsellor`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const err = (await res.json()) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? "Failed to notify counsellor");
  }
  return res.json();
}

export async function adminWithdrawEscalation(
  ticketId: string,
  reason?: string,
): Promise<{ id: string }> {
  const res = await fetch(`${ADMIN_BASE}/${ticketId}/escalation`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: reason ?? null }),
  });
  if (!res.ok) {
    const err = (await res.json()) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? "Failed to withdraw escalation");
  }
  return res.json();
}
