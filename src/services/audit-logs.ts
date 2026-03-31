const API_BASE = "/api/v1/super-admin/audit-logs";

export interface AuditLogItem {
  id: string;
  createdAt: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  actionType: string;
  entityType: string;
  entityId: string;
  societyId: string | null;
  societyName: string | null;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
}

export interface AuditLogFilters {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  societyId?: string;
  actionType?: string;
  userId?: string;
  entityType?: string;
  order?: "asc" | "desc";
}

export interface AuditLogResponse {
  items: AuditLogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export async function getAuditLogs(filters: AuditLogFilters = {}): Promise<AuditLogResponse> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== "") params.set(k, String(v));
  }
  const res = await fetch(`${API_BASE}?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch audit logs");
  return res.json() as Promise<AuditLogResponse>;
}

export function buildExportUrl(filters: Omit<AuditLogFilters, "page" | "limit">): string {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== "") params.set(k, String(v));
  }
  return `${API_BASE}/export?${params.toString()}`;
}
