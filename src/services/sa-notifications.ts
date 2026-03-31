import type { Alert, AlertPriority, AlertType } from "@/app/api/v1/super-admin/notifications/route";

export type { Alert, AlertPriority, AlertType };

export async function getNotifications(): Promise<Alert[]> {
  const res = await fetch("/api/v1/super-admin/notifications");
  if (!res.ok) throw new Error("Failed to fetch notifications");
  return res.json() as Promise<Alert[]>;
}
