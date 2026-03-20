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
