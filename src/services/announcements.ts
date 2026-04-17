import type { CreateAnnouncementInput } from "@/lib/validations/announcement";

const SA_BASE = "/api/v1/super-admin/announcements";
const ADMIN_BASE = "/api/v1/admin/announcements";

// --- SA: Platform Announcements ---

export interface AnnouncementItem {
  id: string;
  subject: string;
  body: string;
  priority: string;
  scope: string;
  societyIds: string[];
  sentVia: string[];
  createdBy: string;
  createdAt: string;
  _count?: { reads: number };
}

export interface AnnouncementDetail extends AnnouncementItem {
  _count: { reads: number };
  totalTargeted: number;
}

export async function getAnnouncements(): Promise<AnnouncementItem[]> {
  const res = await fetch(SA_BASE);
  if (!res.ok) throw new Error("Failed to fetch announcements");
  return res.json() as Promise<AnnouncementItem[]>;
}

export async function createAnnouncement(data: CreateAnnouncementInput): Promise<AnnouncementItem> {
  const res = await fetch(SA_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message ?? "Failed to create announcement");
  }
  return res.json() as Promise<AnnouncementItem>;
}

export async function getAnnouncementDetail(id: string): Promise<AnnouncementDetail> {
  const res = await fetch(`${SA_BASE}/${id}`);
  if (!res.ok) throw new Error("Failed to fetch announcement detail");
  return res.json() as Promise<AnnouncementDetail>;
}

// --- Admin: Unread Announcements ---

export interface AdminAnnouncementItem {
  id: string;
  subject: string;
  body: string;
  priority: string;
  createdAt: string;
}

export async function getUnreadAnnouncements(societyId?: string): Promise<AdminAnnouncementItem[]> {
  const url = societyId ? `${ADMIN_BASE}?societyId=${encodeURIComponent(societyId)}` : ADMIN_BASE;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch unread announcements");
  return res.json() as Promise<AdminAnnouncementItem[]>;
}

export async function markAnnouncementRead(id: string): Promise<void> {
  const res = await fetch(`${ADMIN_BASE}/${id}/read`, { method: "POST" });
  if (!res.ok) throw new Error("Failed to mark announcement as read");
}
