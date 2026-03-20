"use client";

import { useState, useCallback } from "react";

import Link from "next/link";

import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/useAuth";
import {
  downloadMigrationTemplate,
  validateMigrationFile,
  importMigrationRecordsStream,
  type ValidateResult,
  type ImportStreamEvent,
} from "@/services/migration";

export default function MigrationPage() {
  const { user } = useAuth();
  const societyId = user?.societyId ?? "";

  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState<"upload" | "validating" | "preview" | "importing" | "done">(
    "upload",
  );
  const [result, setResult] = useState<ValidateResult | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [importProgress, setImportProgress] = useState<{
    processed: number;
    total: number;
    imported: number;
    failed: number;
  } | null>(null);

  const handleDownloadTemplate = async () => {
    if (!societyId) return;
    try {
      await downloadMigrationTemplate(societyId);
      toast.success("Template downloaded");
    } catch {
      toast.error("Failed to download template");
    }
  };

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    if (!selected.name.endsWith(".xlsx") && !selected.name.endsWith(".xls")) {
      toast.error("Please select an Excel file (.xlsx or .xls)");
      return;
    }
    setFile(selected);
  }, []);

  const handleValidate = async () => {
    if (!file || !societyId) return;
    setStep("validating");

    try {
      const validationResult = await validateMigrationFile(societyId, file);
      setResult(validationResult);
      setStep("preview");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Validation failed");
      setStep("upload");
    }
  };

  const handleImport = async () => {
    if (!result || !societyId) return;
    setStep("importing");
    setImportProgress({ processed: 0, total: result.valid, imported: 0, failed: 0 });

    try {
      const validRows = result.preview.filter((_, i) => {
        const rowNum = i + 2;
        return !result.errors.some((e) => e.row === rowNum);
      });

      let finalImported = 0;

      await importMigrationRecordsStream(societyId, validRows, (event: ImportStreamEvent) => {
        if (event.type === "progress") {
          setImportProgress({
            processed: event.processed,
            total: event.total,
            imported: event.imported,
            failed: event.failed,
          });
        } else if (event.type === "done") {
          finalImported = event.summary.imported;
        }
      });

      setImportedCount(finalImported);
      setImportProgress(null);
      setStep("done");
      toast.success(`Successfully imported ${finalImported} residents`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
      setImportProgress(null);
      setStep("preview");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Bulk Migration" description="Import residents from Excel">
        <Button variant="outline" onClick={handleDownloadTemplate} disabled={!societyId}>
          <Download className="mr-2 h-4 w-4" />
          Download Template
        </Button>
      </PageHeader>

      {step === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              Upload Excel File
            </CardTitle>
            <CardDescription>
              Download the template first, fill in resident data, then upload here for validation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center gap-4 rounded-lg border-2 border-dashed p-8">
              <FileSpreadsheet className="text-muted-foreground h-12 w-12" />
              <div className="text-center">
                <p className="font-medium">{file ? file.name : "Select an Excel file"}</p>
                <p className="text-muted-foreground text-sm">
                  {file ? `${(file.size / 1024).toFixed(1)} KB` : "Supports .xlsx and .xls files"}
                </p>
              </div>
              <label>
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Button variant="outline" asChild>
                  <span>{file ? "Change File" : "Browse Files"}</span>
                </Button>
              </label>
            </div>
            {file && (
              <Button className="w-full" onClick={handleValidate}>
                Validate & Preview
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {step === "validating" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="text-primary h-8 w-8 animate-spin" />
            <p className="font-medium">Validating your data...</p>
            <Progress value={60} className="w-64" />
          </CardContent>
        </Card>
      )}

      {step === "preview" && result && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold">{result.total}</p>
                <p className="text-muted-foreground text-sm">Total Rows</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-green-600">{result.valid}</p>
                <p className="text-muted-foreground text-sm">Valid Records</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-3xl font-bold text-red-600">{result.invalid}</p>
                <p className="text-muted-foreground text-sm">Errors Found</p>
              </CardContent>
            </Card>
          </div>

          {result.errors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Validation Errors
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Field</TableHead>
                        <TableHead>Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.errors.map((err, i) => (
                        <TableRow key={i}>
                          <TableCell>{err.row}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs capitalize">
                              {err.field}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {err.message}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setStep("upload");
                setFile(null);
                setResult(null);
              }}
            >
              Upload Different File
            </Button>
            <Button onClick={handleImport} disabled={result.valid === 0}>
              Import {result.valid} Valid Records
            </Button>
          </div>
        </>
      )}

      {step === "importing" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="text-primary h-8 w-8 animate-spin" />
            <p className="font-medium">Importing residents...</p>
            {importProgress ? (
              <>
                <Progress
                  value={
                    importProgress.total > 0
                      ? Math.round((importProgress.processed / importProgress.total) * 100)
                      : 0
                  }
                  className="w-64"
                />
                <p className="text-muted-foreground text-sm">
                  {importProgress.processed} of {importProgress.total} processed
                  {importProgress.imported > 0 && ` · ${importProgress.imported} imported`}
                  {importProgress.failed > 0 && ` · ${importProgress.failed} failed`}
                </p>
              </>
            ) : (
              <Progress value={0} className="w-64" />
            )}
          </CardContent>
        </Card>
      )}

      {step === "done" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <h2 className="text-xl font-bold">Import Complete!</h2>
            <p className="text-muted-foreground text-sm">
              {importedCount} residents have been imported successfully.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setStep("upload");
                  setFile(null);
                  setResult(null);
                  setImportedCount(0);
                }}
              >
                Import More
              </Button>
              <Link href="/admin/residents?status=MIGRATED_PENDING">
                <Button>View Imported</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
