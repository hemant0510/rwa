const API_BASE = "/api/v1";

export interface ValidationError {
  row: number;
  field: string;
  message: string;
}

export interface ValidateResult {
  total: number;
  valid: number;
  invalid: number;
  errors: ValidationError[];
  preview: {
    rowIndex: number;
    fullName: string;
    email: string;
    mobile: string;
    ownershipType: string;
    feeStatus: string;
    unitFields: Record<string, string>;
  }[];
}

export interface ImportRecord {
  fullName: string;
  email: string;
  mobile: string;
  ownershipType: string;
  feeStatus: string;
  unitFields: Record<string, string>;
}

export interface ImportRecordResult {
  rowIndex: number;
  success: boolean;
  rwaid?: string;
  error?: string;
}

export interface ImportResult {
  results: ImportRecordResult[];
  summary: { total: number; imported: number; failed: number };
}

export async function downloadMigrationTemplate(societyId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/societies/${societyId}/migration/template`);
  if (!res.ok) throw new Error("Failed to download template");

  const blob = await res.blob();
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match?.[1] ?? "migration-template.xlsx";

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function validateMigrationFile(
  societyId: string,
  file: File,
): Promise<ValidateResult> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/societies/${societyId}/migration/validate`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? "Validation failed");
  }

  return res.json() as Promise<ValidateResult>;
}

export async function importMigrationRecords(
  societyId: string,
  records: ImportRecord[],
): Promise<ImportResult> {
  const res = await fetch(`${API_BASE}/societies/${societyId}/migration/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ records }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? "Import failed");
  }

  return res.json() as Promise<ImportResult>;
}

export type ImportStreamEvent =
  | {
      type: "progress";
      rowIndex: number;
      total: number;
      processed: number;
      imported: number;
      failed: number;
    }
  | { type: "result"; rowIndex: number; success: boolean; rwaid?: string; error?: string }
  | { type: "done"; summary: { total: number; imported: number; failed: number } }
  | { type: "error"; message: string };

/**
 * Streams import progress via SSE.
 * Calls onEvent for each parsed SSE message until the stream closes.
 */
export async function importMigrationRecordsStream(
  societyId: string,
  records: ImportRecord[],
  onEvent: (event: ImportStreamEvent) => void,
): Promise<void> {
  const res = await fetch(`${API_BASE}/societies/${societyId}/migration/import-stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ records }),
  });

  if (!res.ok || !res.body) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: { message?: string } }).error?.message ?? "Import failed");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const event = JSON.parse(line.slice(6)) as ImportStreamEvent;
          onEvent(event);
        } catch {
          // malformed SSE line — skip
        }
      }
    }
  }
}
