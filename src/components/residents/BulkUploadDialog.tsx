"use client";

import { useRef, useState, useCallback } from "react";

import { Download, FileUp, Loader2, Upload, X } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { bulkUploadResidents, type BulkResidentRecord } from "@/services/residents";

type ParsedRow = BulkResidentRecord & { _rowIndex: number };

type ValidationError = {
  rowIndex: number;
  row: Record<string, string>;
  errors: string[];
};

type UploadResult = {
  rowIndex: number;
  success: boolean;
  rwaid?: string;
  error?: string;
  row?: ParsedRow;
};

type Step = "upload" | "validate" | "processing" | "done";

const CURRENT_YEAR = new Date().getFullYear();

function validateRow(
  row: Record<string, string>,
  index: number,
): { valid: ParsedRow | null; errors: string[] } {
  const errors: string[] = [];

  const fullName = row["Full Name"]?.trim() ?? "";
  const email = row["Email"]?.trim() ?? "";
  const mobile = row["Mobile"]?.trim() ?? "";
  const ownershipRaw = row["Ownership Type"]?.trim().toUpperCase() ?? "";
  const flatNo = row["Flat/Unit Number"]?.trim() ?? "";
  const towerBlock = row["Block/Tower"]?.trim() ?? "";
  const floorLevel = row["Floor Level"]?.trim().toUpperCase() ?? "";
  const yearRaw = row["Registration Year"]?.trim() ?? "";

  if (fullName.length < 2) errors.push("Full Name is required (min 2 chars)");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push("Invalid email address");
  if (!/^[6-9]\d{9}$/.test(mobile)) errors.push("Mobile must be a valid 10-digit Indian number");
  if (ownershipRaw !== "OWNER" && ownershipRaw !== "TENANT")
    errors.push("Ownership Type must be OWNER or TENANT");

  let registrationYear: number | undefined;
  if (yearRaw !== "") {
    const y = parseInt(yearRaw, 10);
    if (isNaN(y) || y < 2010 || y > CURRENT_YEAR + 1) {
      errors.push(`Registration Year must be between 2010 and ${CURRENT_YEAR + 1}`);
    } else {
      registrationYear = y;
    }
  }

  if (errors.length > 0) return { valid: null, errors };

  return {
    valid: {
      _rowIndex: index,
      fullName,
      email,
      mobile,
      ownershipType: ownershipRaw as "OWNER" | "TENANT",
      unitAddress:
        flatNo || towerBlock || floorLevel
          ? {
              flatNo: flatNo || undefined,
              towerBlock: towerBlock || undefined,
              floorLevel: floorLevel || undefined,
            }
          : undefined,
      registrationYear,
    },
    errors: [],
  };
}

function downloadCsv(rows: Record<string, string>[], filename: string) {
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  societyCode: string;
  onSuccess: () => void;
}

export function BulkUploadDialog({ open, onOpenChange, societyCode, onSuccess }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string>("");
  const [validRows, setValidRows] = useState<ParsedRow[]>([]);
  const [invalidRows, setInvalidRows] = useState<ValidationError[]>([]);
  const [progress, setProgress] = useState(0);
  const [uploadResults, setUploadResults] = useState<UploadResult[]>([]);

  function resetState() {
    setStep("upload");
    setFileName("");
    setValidRows([]);
    setInvalidRows([]);
    setProgress(0);
    setUploadResults([]);
    setIsDragging(false);
  }

  function handleClose(open: boolean) {
    if (!open) resetState();
    onOpenChange(open);
  }

  function parseRawRows(rawRows: Record<string, string>[]) {
    const valid: ParsedRow[] = [];
    const invalid: ValidationError[] = [];

    rawRows.forEach((row, i) => {
      const { valid: parsed, errors } = validateRow(row, i);
      if (parsed) {
        valid.push(parsed);
      } else {
        invalid.push({ rowIndex: i, row, errors });
      }
    });

    setValidRows(valid);
    setInvalidRows(invalid);
    setStep("validate");
  }

  function parseFile(file: File) {
    setFileName(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "csv") {
      Papa.parse<Record<string, string>>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => parseRawRows(results.data),
      });
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: "" });
        parseRawRows(rows);
      };
      reader.readAsArrayBuffer(file);
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
    e.target.value = "";
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function downloadInvalidRows() {
    const rows = invalidRows.map(({ row, errors }) => ({
      ...row,
      "Validation Errors": errors.join("; "),
    }));
    downloadCsv(rows, "invalid-residents.csv");
  }

  async function startUpload() {
    setStep("processing");
    setProgress(0);

    const BATCH_SIZE = 10;
    const batches: ParsedRow[][] = [];
    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      batches.push(validRows.slice(i, i + BATCH_SIZE));
    }

    const allResults: UploadResult[] = [];

    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b];
      const records: BulkResidentRecord[] = batch.map(({ _rowIndex: _, ...r }) => r);

      try {
        const { results } = await bulkUploadResidents(societyCode, records);
        results.forEach((res, i) => {
          allResults.push({ ...res, row: batch[i] });
        });
      } catch {
        batch.forEach((row) => {
          allResults.push({
            rowIndex: row._rowIndex,
            success: false,
            error: "Batch failed — network or server error",
            row,
          });
        });
      }

      setProgress(Math.round(((b + 1) / batches.length) * 100));
    }

    setUploadResults(allResults);
    setStep("done");

    const anySuccess = allResults.some((r) => r.success);
    if (anySuccess) onSuccess();
  }

  function downloadFailedRows() {
    const failed = uploadResults.filter((r) => !r.success && r.row);
    const rows = failed.map(({ row, error }) => ({
      "Full Name": row?.fullName ?? "",
      Email: row?.email ?? "",
      Mobile: row?.mobile ?? "",
      "Ownership Type": row?.ownershipType ?? "",
      "Flat/Unit Number": row?.unitAddress?.flatNo ?? "",
      "Block/Tower": row?.unitAddress?.towerBlock ?? "",
      "Floor Level": row?.unitAddress?.floorLevel ?? "",
      "Registration Year": row?.registrationYear ? String(row.registrationYear) : "",
      Error: error ?? "",
    }));
    downloadCsv(rows, "failed-residents.csv");
  }

  const successCount = uploadResults.filter((r) => r.success).length;
  const failedCount = uploadResults.filter((r) => !r.success).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Residents</DialogTitle>
        </DialogHeader>

        {/* STEP 1: Upload */}
        {step === "upload" && (
          <div className="space-y-4">
            <div
              className={`cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
                isDragging
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/30 hover:border-primary/50"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp className="text-muted-foreground mx-auto mb-3 h-10 w-10" />
              <p className="text-sm font-medium">Drop your file here or click to browse</p>
              <p className="text-muted-foreground mt-1 text-xs">Supports .csv, .xlsx, .xls</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={onFileChange}
              />
            </div>

            <div className="flex items-center justify-center gap-2 text-sm">
              <Download className="text-muted-foreground h-4 w-4" />
              <a
                href="/templates/residents-import-template.csv"
                download
                className="text-primary hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                Download sample template
              </a>
              <span className="text-muted-foreground text-xs">
                (Full Name, Email, Mobile, Ownership Type, Flat, Block, Floor, Registration Year)
              </span>
            </div>
          </div>
        )}

        {/* STEP 2: Validation results */}
        {step === "validate" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-md border p-3">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">{fileName}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={resetState}>
                <X className="h-4 w-4" />
                Change file
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-md border p-3">
                <p className="text-2xl font-bold">{validRows.length + invalidRows.length}</p>
                <p className="text-muted-foreground text-xs">Total rows</p>
              </div>
              <div className="rounded-md border border-green-200 bg-green-50 p-3">
                <p className="text-2xl font-bold text-green-700">{validRows.length}</p>
                <p className="text-xs text-green-600">Valid</p>
              </div>
              <div className="rounded-md border border-red-200 bg-red-50 p-3">
                <p className="text-2xl font-bold text-red-700">{invalidRows.length}</p>
                <p className="text-xs text-red-600">Invalid</p>
              </div>
            </div>

            {invalidRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Invalid records</p>
                  <Button variant="outline" size="sm" onClick={downloadInvalidRows}>
                    <Download className="mr-1 h-3 w-3" />
                    Download invalid records
                  </Button>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Row</TableHead>
                        <TableHead>Name / Email</TableHead>
                        <TableHead>Errors</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invalidRows.map(({ rowIndex, row, errors }) => (
                        <TableRow key={rowIndex}>
                          <TableCell className="text-muted-foreground text-xs">
                            #{rowIndex + 2}
                          </TableCell>
                          <TableCell className="text-xs">
                            <p>{row["Full Name"] || "—"}</p>
                            <p className="text-muted-foreground">{row["Email"] || "—"}</p>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {errors.map((err) => (
                                <Badge
                                  key={err}
                                  variant="outline"
                                  className="border-red-200 bg-red-50 text-xs text-red-700"
                                >
                                  {err}
                                </Badge>
                              ))}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {validRows.length === 0 && (
              <p className="text-destructive text-center text-sm">
                No valid records to import. Fix the errors and re-upload.
              </p>
            )}
          </div>
        )}

        {/* STEP 3: Processing */}
        {step === "processing" && (
          <div className="space-y-4 py-4 text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-blue-500" />
            <p className="text-sm font-medium">Importing residents…</p>
            <Progress value={progress} className="h-2" />
            <p className="text-muted-foreground text-xs">{progress}% complete</p>
          </div>
        )}

        {/* STEP 4: Done */}
        {step === "done" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="rounded-md border border-green-200 bg-green-50 p-3">
                <p className="text-2xl font-bold text-green-700">{successCount}</p>
                <p className="text-xs text-green-600">Residents added</p>
              </div>
              <div className="rounded-md border border-red-200 bg-red-50 p-3">
                <p className="text-2xl font-bold text-red-700">{failedCount}</p>
                <p className="text-xs text-red-600">Failed</p>
              </div>
            </div>

            {uploadResults.filter((r) => r.success).length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>RWAID Assigned</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uploadResults
                      .filter((r) => r.success)
                      .map((r) => (
                        <TableRow key={r.rowIndex}>
                          <TableCell className="text-xs">{r.row?.fullName ?? "—"}</TableCell>
                          <TableCell className="text-xs">{r.row?.email ?? "—"}</TableCell>
                          <TableCell className="font-mono text-xs text-green-700">
                            {r.rwaid ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {failedCount > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-red-600">Failed records</p>
                  <Button variant="outline" size="sm" onClick={downloadFailedRows}>
                    <Download className="mr-1 h-3 w-3" />
                    Download failed records
                  </Button>
                </div>
                <div className="max-h-32 overflow-y-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name / Email</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {uploadResults
                        .filter((r) => !r.success)
                        .map((r) => (
                          <TableRow key={r.rowIndex}>
                            <TableCell className="text-xs">
                              <p>{r.row?.fullName ?? "—"}</p>
                              <p className="text-muted-foreground">{r.row?.email ?? "—"}</p>
                            </TableCell>
                            <TableCell className="text-xs text-red-600">
                              {r.error ?? "Unknown error"}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          {step === "upload" && (
            <Button variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
          )}

          {step === "validate" && (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button disabled={validRows.length === 0} onClick={startUpload}>
                <Upload className="mr-2 h-4 w-4" />
                Proceed with {validRows.length} valid record{validRows.length !== 1 ? "s" : ""}
              </Button>
            </>
          )}

          {step === "done" && <Button onClick={() => handleClose(false)}>Close</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
