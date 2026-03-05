const API_BASE = "/api/v1";

export interface Broadcast {
  id: string;
  societyId: string;
  message: string;
  recipientFilter: string;
  recipientCount: number;
  sentAt: string;
  sender: { name: string };
}

export async function getBroadcasts(societyId: string) {
  const res = await fetch(`${API_BASE}/societies/${societyId}/broadcasts`);
  if (!res.ok) throw new Error("Failed to fetch broadcasts");
  return res.json() as Promise<{ data: Broadcast[] }>;
}

export async function sendBroadcast(
  societyId: string,
  data: { message: string; recipientFilter: string; customRecipientIds?: string[] },
) {
  const res = await fetch(`${API_BASE}/societies/${societyId}/broadcasts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to send broadcast");
  }
  return res.json();
}
