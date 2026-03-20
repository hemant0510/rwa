const API_BASE = "/api/v1";

export interface ReportSummary {
  sessionYear: string;
  totalResidents: number;
  paidCount: number;
  pendingCount: number;
  totalCollected: number;
  totalOutstanding: number;
  totalExpenses: number;
  balance: number;
}

export async function getReportSummary(
  societyId: string,
  session?: string,
): Promise<ReportSummary> {
  const params = session ? `?session=${session}` : "";
  const res = await fetch(`${API_BASE}/societies/${societyId}/reports/summary${params}`);
  if (!res.ok) throw new Error("Failed to fetch report summary");
  return res.json() as Promise<ReportSummary>;
}

export type ReportType =
  | "paid-list"
  | "pending-list"
  | "directory"
  | "expense-summary"
  | "collection-summary";

export async function downloadReport(
  societyId: string,
  reportType: ReportType,
  format: "pdf" | "excel",
  session?: string,
): Promise<void> {
  const params = new URLSearchParams({ format });
  if (session) params.set("session", session);

  const res = await fetch(`${API_BASE}/societies/${societyId}/reports/${reportType}?${params}`);

  if (!res.ok) throw new Error("Failed to generate report");

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  const ext = format === "excel" ? "xlsx" : "pdf";
  const filename = match?.[1] ?? `${reportType}.${ext}`;

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
