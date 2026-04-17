"use client";

import { useState, useRef, useEffect, Suspense } from "react";

import { useParams, useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Calendar,
  Download,
  Eye,
  FileText,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSocietyId } from "@/hooks/useSocietyId";
import {
  closePetitionSchema,
  updatePetitionSchema,
  type ClosePetitionInput,
  type UpdatePetitionInput,
} from "@/lib/validations/petition";
import {
  closePetition,
  deletePetition,
  downloadReport,
  downloadSignedDoc,
  extendDeadline,
  getPetition,
  getSignatures,
  publishPetition,
  removeSignature,
  submitPetition,
  updatePetition,
  uploadDocument,
  type Petition,
} from "@/services/petitions";

// ── Constants ──────────────────────────────────────────────────────────────

const PETITION_TYPES = ["COMPLAINT", "PETITION", "NOTICE"] as const;

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Badge helpers ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: "border-gray-200 bg-gray-100 text-gray-700",
    PUBLISHED: "border-blue-200 bg-blue-50 text-blue-700",
    SUBMITTED: "border-green-200 bg-green-50 text-green-700",
    CLOSED: "border-red-200 bg-red-50 text-red-700",
  };
  return (
    <Badge variant="outline" className={map[status] ?? "border-gray-200 bg-gray-100 text-gray-700"}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </Badge>
  );
}

function TypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    COMPLAINT: "border-red-200 bg-red-50 text-red-700",
    PETITION: "border-blue-200 bg-blue-50 text-blue-700",
    NOTICE: "border-yellow-200 bg-yellow-50 text-yellow-700",
  };
  return (
    <Badge variant="outline" className={map[type] ?? "border-gray-200 bg-gray-100 text-gray-700"}>
      {type.charAt(0) + type.slice(1).toLowerCase()}
    </Badge>
  );
}

function MethodBadge({ method }: { method: string }) {
  if (method === "DRAWN") {
    return (
      <Badge variant="outline" className="border-purple-200 bg-purple-50 text-xs text-purple-700">
        Drawn
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="border-teal-200 bg-teal-50 text-xs text-teal-700">
      Uploaded
    </Badge>
  );
}

// ── PDF Viewer (blob-based to bypass X-Frame-Options) ─────────────────────

function DocumentViewer({
  societyId,
  petitionId,
  downloadUrl,
  documentUrl,
}: {
  societyId: string;
  petitionId: string;
  downloadUrl: string;
  documentUrl: string;
}) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const isDocx = documentUrl.endsWith(".docx");
  // Direct API URL — used for the mobile "Open PDF" link
  const docApiUrl = `/api/v1/societies/${societyId}/petitions/${petitionId}/document`;
  const label = isDocx ? "Download Document" : "Download PDF";

  // Fetch the PDF as a blob so the desktop iframe uses a blob: URL.
  // This is necessary because putting a Next.js API route directly in an iframe
  // can cause the middleware to intercept/redirect the request before the PDF
  // bytes are returned, leaving the iframe blank.
  useEffect(() => {
    if (isDocx) return;
    let objectUrl: string | null = null;
    fetch(docApiUrl)
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.blob();
      })
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
      })
      .catch(() => setLoadError(true));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [docApiUrl, isDocx]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Petition Document</p>
        <Button variant="outline" size="sm" asChild>
          <a href={downloadUrl} target="_blank" rel="noopener noreferrer" download>
            <Download className="mr-1 h-4 w-4" />
            {label}
          </a>
        </Button>
      </div>

      {isDocx ? (
        /* DOCX — browsers can't render Word docs inline */
        <div className="flex flex-col items-center gap-3 rounded-md border bg-gray-50 py-12">
          <FileText className="text-muted-foreground h-10 w-10" />
          <p className="text-muted-foreground text-sm">Word document — preview not available.</p>
          <Button variant="outline" size="sm" asChild>
            <a href={downloadUrl} target="_blank" rel="noopener noreferrer" download>
              <Download className="mr-1 h-4 w-4" />
              Download DOCX
            </a>
          </Button>
        </div>
      ) : (
        <>
          {/* Mobile — iOS Safari can't render blob: URLs in iframes */}
          <div className="block md:hidden">
            <div className="flex flex-col items-center gap-3 rounded-md border bg-gray-50 py-12">
              <FileText className="text-muted-foreground h-10 w-10" />
              <p className="text-muted-foreground text-sm">
                PDF preview is not available on mobile.
              </p>
              <Button variant="outline" size="sm" asChild>
                <a href={docApiUrl} target="_blank" rel="noopener noreferrer">
                  <Eye className="mr-1 h-4 w-4" />
                  Open PDF
                </a>
              </Button>
            </div>
          </div>

          {/* Desktop — blob URL fetched via authenticated JS fetch */}
          <div className="hidden overflow-hidden rounded-md border md:block">
            {loadError ? (
              <div className="text-muted-foreground flex h-[600px] items-center justify-center gap-2">
                <span>Failed to load document preview.</span>
                <a href={docApiUrl} target="_blank" rel="noopener noreferrer" className="underline">
                  Open in new tab
                </a>
              </div>
            ) : !blobUrl ? (
              <div className="flex h-[600px] items-center justify-center">
                <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
              </div>
            ) : (
              <iframe src={blobUrl} title="Petition Document" className="h-[600px] w-full" />
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Page shell ─────────────────────────────────────────────────────────────

export default function PetitionDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        </div>
      }
    >
      <PetitionDetailPageInner />
    </Suspense>
  );
}

// ── Inner page ─────────────────────────────────────────────────────────────

function PetitionDetailPageInner() {
  const { petitionId } = useParams<{ petitionId: string }>();
  const { societyId, saQueryString } = useSocietyId();
  const router = useRouter();
  const queryClient = useQueryClient();

  // ── Dialog state ──
  const [uploadDialog, setUploadDialog] = useState(false);
  const [publishConfirm, setPublishConfirm] = useState(false);
  const [submitConfirm, setSubmitConfirm] = useState(false);
  const [closeDialog, setCloseDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [removeSignatureId, setRemoveSignatureId] = useState<string | null>(null);
  const [extendDeadlineDialog, setExtendDeadlineDialog] = useState(false);
  const [newDeadline, setNewDeadline] = useState("");

  // ── File upload state ──
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Queries ──
  const { data: petition, isLoading } = useQuery({
    queryKey: ["petition", societyId, petitionId],
    queryFn: () => getPetition(societyId, petitionId),
    enabled: !!societyId && !!petitionId,
    staleTime: 0,
  });

  const { data: signaturesData } = useQuery({
    queryKey: ["signatures", societyId, petitionId],
    queryFn: () => getSignatures(societyId, petitionId),
    enabled: !!societyId && !!petitionId,
    staleTime: 0,
  });

  const signatures = signaturesData?.data ?? [];
  const signatureCount = petition?.signatureCount ?? signatures.length;

  // ── Forms ──
  const closeForm = useForm<ClosePetitionInput>({
    resolver: zodResolver(closePetitionSchema),
    defaultValues: { reason: "" },
  });

  const editForm = useForm<UpdatePetitionInput>({
    resolver: zodResolver(updatePetitionSchema),
  });

  const watchedEditType = useWatch({ control: editForm.control, name: "type" });

  // ── Invalidation helper ──
  function invalidatePetition() {
    queryClient.invalidateQueries({ queryKey: ["petition", societyId, petitionId] });
    queryClient.invalidateQueries({ queryKey: ["signatures", societyId, petitionId] });
    queryClient.invalidateQueries({ queryKey: ["petitions"] });
  }

  // ── Mutations ──
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => uploadDocument(societyId, petitionId, file),
    onSuccess: () => {
      toast.success("Document uploaded!");
      setUploadDialog(false);
      setSelectedFile(null);
      /* v8 ignore start -- ref.current is always attached when onSuccess fires */
      if (fileInputRef.current) fileInputRef.current.value = "";
      /* v8 ignore stop */
      invalidatePetition();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const publishMutation = useMutation({
    mutationFn: () => publishPetition(societyId, petitionId),
    onSuccess: () => {
      toast.success("Petition published!");
      setPublishConfirm(false);
      invalidatePetition();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const submitMutation = useMutation({
    mutationFn: () => submitPetition(societyId, petitionId),
    onSuccess: () => {
      toast.success("Petition submitted!");
      setSubmitConfirm(false);
      invalidatePetition();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const closeMutation = useMutation({
    mutationFn: (data: ClosePetitionInput) => closePetition(societyId, petitionId, data),
    onSuccess: () => {
      toast.success("Petition closed.");
      setCloseDialog(false);
      closeForm.reset();
      invalidatePetition();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdatePetitionInput) => updatePetition(societyId, petitionId, data),
    onSuccess: () => {
      toast.success("Petition updated!");
      setEditDialog(false);
      editForm.reset();
      invalidatePetition();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deletePetition(societyId, petitionId),
    onSuccess: () => {
      toast.success("Petition deleted.");
      router.push(`/admin/petitions${saQueryString}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeSignatureMutation = useMutation({
    mutationFn: (sigId: string) => removeSignature(societyId, petitionId, sigId),
    onSuccess: () => {
      toast.success("Signature removed.");
      setRemoveSignatureId(null);
      invalidatePetition();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const extendDeadlineMutation = useMutation({
    mutationFn: (deadline: string | null) => extendDeadline(societyId, petitionId, deadline),
    onSuccess: () => {
      toast.success("Deadline updated.");
      setExtendDeadlineDialog(false);
      setNewDeadline("");
      invalidatePetition();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Helpers ──
  function openEditDialog(p: Petition) {
    editForm.reset({
      title: p.title,
      description: p.description ?? undefined,
      type: p.type as UpdatePetitionInput["type"],
      targetAuthority: p.targetAuthority ?? undefined,
      minSignatures: p.minSignatures ?? undefined,
      deadline: p.deadline ? p.deadline.split("T")[0] : undefined,
    });
    setEditDialog(true);
  }

  const [signedDocPending, setSignedDocPending] = useState(false);

  async function handleDownloadReport() {
    try {
      const blob = await downloadReport(societyId, petitionId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `petition-report-${petitionId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to download report");
    }
  }

  async function handleDownloadSignedDoc() {
    try {
      setSignedDocPending(true);
      const blob = await downloadSignedDoc(societyId, petitionId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `signed-doc-${petitionId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to download signed document");
    } finally {
      setSignedDocPending(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setSelectedFile(null);
      return;
    }
    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowed.includes(file.type)) {
      toast.error("Only PDF and DOCX files are allowed.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      toast.error("File size must be 10 MB or less.");
      e.target.value = "";
      return;
    }
    setSelectedFile(file);
  }

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!petition) {
    return (
      <div className="py-24 text-center">
        <p className="text-muted-foreground">Petition not found.</p>
        <Button
          variant="ghost"
          className="mt-4"
          onClick={() => router.push(`/admin/petitions${saQueryString}`)}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Petitions
        </Button>
      </div>
    );
  }

  const isDraft = petition.status === "DRAFT";
  const isPublished = petition.status === "PUBLISHED";
  const isSubmitted = petition.status === "SUBMITTED";
  const isClosed = petition.status === "CLOSED";
  const isReadOnly = isSubmitted || isClosed;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="space-y-4">
        <Button
          variant="ghost"
          onClick={() => router.push(`/admin/petitions${saQueryString}`)}
          className="gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">{petition.title}</h1>

            {petition.targetAuthority && (
              <p className="text-muted-foreground text-sm">Target: {petition.targetAuthority}</p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={petition.status} />
              <TypeBadge type={petition.type} />
            </div>

            {/* Signature progress */}
            <p className="text-muted-foreground text-sm">
              {petition.minSignatures != null
                ? `${signatureCount} of ${petition.minSignatures} signatures`
                : `${signatureCount} signature${signatureCount !== 1 ? "s" : ""}`}
            </p>

            {/* Closed reason */}
            {isClosed && petition.closedReason && (
              <p className="text-sm text-red-600">Closed reason: {petition.closedReason}</p>
            )}
          </div>

          {/* ── Action Buttons ── */}
          <div className="flex flex-wrap items-center gap-2">
            {isDraft && (
              <>
                <Button variant="outline" size="sm" onClick={() => setUploadDialog(true)}>
                  <Upload className="mr-1 h-4 w-4" />
                  Upload Document
                </Button>
                <Button variant="outline" size="sm" onClick={() => openEditDialog(petition)}>
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setDeleteConfirm(true)}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Delete
                </Button>
                <Button size="sm" onClick={() => setPublishConfirm(true)}>
                  Publish
                </Button>
              </>
            )}

            {isPublished && (
              <>
                {petition.documentUrl && signatureCount > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadSignedDoc}
                    disabled={signedDocPending}
                  >
                    {signedDocPending ? (
                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-1 h-4 w-4" />
                    )}
                    Signed Document
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setNewDeadline(petition.deadline ? petition.deadline.split("T")[0] : "");
                    setExtendDeadlineDialog(true);
                  }}
                >
                  <Calendar className="mr-1 h-4 w-4" />
                  Extend Deadline
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => setCloseDialog(true)}
                >
                  Close
                </Button>
                <Button size="sm" onClick={() => setSubmitConfirm(true)}>
                  Submit
                </Button>
              </>
            )}

            {isReadOnly && petition.documentUrl && signatureCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadSignedDoc}
                disabled={signedDocPending}
              >
                {signedDocPending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-1 h-4 w-4" />
                )}
                Signed Document
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="document">
        <TabsList>
          <TabsTrigger value="document">
            <FileText className="mr-1 h-4 w-4" />
            Document
          </TabsTrigger>
          <TabsTrigger value="signatures">
            <Eye className="mr-1 h-4 w-4" />
            Signatures
          </TabsTrigger>
          <TabsTrigger value="details">Details</TabsTrigger>
        </TabsList>

        {/* ── Document Tab ── */}
        <TabsContent value="document" className="space-y-4 pt-4">
          {petition.documentSignedUrl && petition.documentUrl ? (
            <DocumentViewer
              societyId={societyId}
              petitionId={petitionId}
              downloadUrl={petition.documentSignedUrl}
              documentUrl={petition.documentUrl}
            />
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-4 py-12">
                <FileText className="text-muted-foreground h-12 w-12" />
                <div className="text-center">
                  <p className="font-medium">No document uploaded</p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {isDraft
                      ? "Upload a PDF document to attach it to this petition."
                      : "No document was attached to this petition."}
                  </p>
                </div>
                {isDraft && (
                  <Button onClick={() => setUploadDialog(true)}>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Document
                  </Button>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Signatures Tab ── */}
        <TabsContent value="signatures" className="space-y-4 pt-4">
          {/* Signature count + progress */}
          <Card>
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  {signatureCount} signature{signatureCount !== 1 ? "s" : ""}
                  {petition.minSignatures != null && ` of ${petition.minSignatures} required`}
                </p>
                <Button variant="outline" size="sm" onClick={handleDownloadReport}>
                  <Download className="mr-1 h-4 w-4" />
                  Download Report
                </Button>
              </div>
              {petition.minSignatures != null && (
                <div className="space-y-1">
                  <Progress
                    value={Math.min(100, (signatureCount / petition.minSignatures) * 100)}
                    className="h-2"
                  />
                  <p className="text-muted-foreground text-xs">
                    {Math.round((signatureCount / petition.minSignatures) * 100)}% of target
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Signatures table */}
          {signatures.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden sm:table-cell">Contact</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="hidden md:table-cell">Date Signed</TableHead>
                    <TableHead>Signature</TableHead>
                    {isPublished && <TableHead className="w-[80px]">Action</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {signatures.map((sig) => (
                    <TableRow key={sig.id}>
                      <TableCell className="font-medium">{sig.user.name}</TableCell>
                      <TableCell className="text-muted-foreground hidden text-sm sm:table-cell">
                        {sig.user.mobile ?? sig.user.email}
                      </TableCell>
                      <TableCell>
                        <MethodBadge method={sig.method} />
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
                        {formatDate(sig.signedAt)}
                      </TableCell>
                      <TableCell>
                        {sig.signatureUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={sig.signatureUrl}
                            alt="Signature"
                            className="h-10 w-20 object-contain"
                          />
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      {isPublished && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => setRemoveSignatureId(sig.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Card>
              <CardContent className="text-muted-foreground py-8 text-center text-sm">
                No signatures yet.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Details Tab ── */}
        <TabsContent value="details" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Petition Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Title
                  </dt>
                  <dd className="mt-1 text-sm font-medium">{petition.title}</dd>
                </div>

                <div>
                  <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Type
                  </dt>
                  <dd className="mt-1">
                    <TypeBadge type={petition.type} />
                  </dd>
                </div>

                {petition.targetAuthority && (
                  <div>
                    <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      Target Authority
                    </dt>
                    <dd className="mt-1 text-sm">{petition.targetAuthority}</dd>
                  </div>
                )}

                <div>
                  <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Status
                  </dt>
                  <dd className="mt-1">
                    <StatusBadge status={petition.status} />
                  </dd>
                </div>

                {petition.minSignatures != null && (
                  <div>
                    <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      Min Signatures
                    </dt>
                    <dd className="mt-1 text-sm">{petition.minSignatures}</dd>
                  </div>
                )}

                {petition.deadline && (
                  <div>
                    <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      Deadline
                    </dt>
                    <dd className="mt-1 text-sm">{formatDate(petition.deadline)}</dd>
                  </div>
                )}

                {petition.publishedAt && (
                  <div>
                    <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      Published At
                    </dt>
                    <dd className="mt-1 text-sm">{formatDate(petition.publishedAt)}</dd>
                  </div>
                )}

                {petition.submittedAt && (
                  <div>
                    <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      Submitted At
                    </dt>
                    <dd className="mt-1 text-sm">{formatDate(petition.submittedAt)}</dd>
                  </div>
                )}

                <div>
                  <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Created At
                  </dt>
                  <dd className="mt-1 text-sm">{formatDate(petition.createdAt)}</dd>
                </div>

                <div>
                  <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                    Created By
                  </dt>
                  <dd className="mt-1 text-sm">{petition.creator.name}</dd>
                </div>

                {petition.description && (
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                      Description
                    </dt>
                    <dd className="mt-1 text-sm whitespace-pre-wrap">{petition.description}</dd>
                  </div>
                )}

                {isClosed && petition.closedReason && (
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium tracking-wide text-red-600 uppercase">
                      Closed Reason
                    </dt>
                    <dd className="mt-1 text-sm text-red-700">{petition.closedReason}</dd>
                  </div>
                )}
              </dl>

              {isDraft && (
                <div className="flex gap-2 border-t pt-4">
                  <Button variant="outline" size="sm" onClick={() => openEditDialog(petition)}>
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                    onClick={() => setDeleteConfirm(true)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Dialog: Upload Document ── */}
      <Dialog
        open={uploadDialog}
        onOpenChange={(open) => {
          /* v8 ignore start -- controlled dialog: onOpenChange only fires with open=false; ref always attached */
          if (!open) {
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }
          /* v8 ignore stop */
          setUploadDialog(open);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="petition-doc-file">
                PDF Document <span className="text-destructive">*</span>
              </Label>
              <Input
                id="petition-doc-file"
                type="file"
                accept="application/pdf,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx"
                ref={fileInputRef}
                onChange={handleFileChange}
              />
              <p className="text-muted-foreground text-xs">PDF or DOCX, max 10 MB.</p>
            </div>
            {selectedFile && (
              <p className="text-sm">
                Selected: <span className="font-medium">{selectedFile.name}</span>{" "}
                <span className="text-muted-foreground">
                  ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                </span>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setUploadDialog(false);
                setSelectedFile(null);
                /* v8 ignore start -- ref.current is always attached */
                if (fileInputRef.current) fileInputRef.current.value = "";
                /* v8 ignore stop */
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={!selectedFile || uploadMutation.isPending}
              onClick={() => {
                /* v8 ignore start -- button is disabled when selectedFile is null */
                if (selectedFile) uploadMutation.mutate(selectedFile);
                /* v8 ignore stop */
              }}
            >
              {uploadMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Publish Confirm ── */}
      <Dialog open={publishConfirm} onOpenChange={setPublishConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Publish Petition?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Publishing will make this petition visible to residents so they can sign it. You cannot
            edit the petition after publishing.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishConfirm(false)}>
              Cancel
            </Button>
            <Button disabled={publishMutation.isPending} onClick={() => publishMutation.mutate()}>
              {publishMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Submit Confirm ── */}
      <Dialog open={submitConfirm} onOpenChange={setSubmitConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Submit Petition?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Submitting will mark this petition as formally submitted to the target authority. No
            further signatures can be collected after submission.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubmitConfirm(false)}>
              Cancel
            </Button>
            <Button disabled={submitMutation.isPending} onClick={() => submitMutation.mutate()}>
              {submitMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Close ── */}
      <Dialog
        open={closeDialog}
        onOpenChange={(open) => {
          /* v8 ignore start -- controlled dialog: onOpenChange only fires with open=false */
          if (!open) closeForm.reset();
          /* v8 ignore stop */
          setCloseDialog(open);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Close Petition</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={closeForm.handleSubmit((data) => closeMutation.mutate(data))}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="close-reason">
                Reason <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="close-reason"
                className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[100px] w-full rounded-md border px-3 py-2 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Explain why this petition is being closed (3–1000 characters)..."
                aria-invalid={!!closeForm.formState.errors.reason}
                {...closeForm.register("reason")}
              />
              {closeForm.formState.errors.reason && (
                <p className="text-destructive text-sm">
                  {closeForm.formState.errors.reason.message}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCloseDialog(false);
                  closeForm.reset();
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-red-600 hover:bg-red-700"
                disabled={closeMutation.isPending}
                onClick={closeForm.handleSubmit((data) => closeMutation.mutate(data))}
              >
                {closeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Close Petition
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Edit ── */}
      <Dialog
        open={editDialog}
        onOpenChange={(open) => {
          /* v8 ignore start -- controlled dialog: onOpenChange only fires with open=false */
          if (!open) editForm.reset();
          /* v8 ignore stop */
          setEditDialog(open);
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Petition</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={editForm.handleSubmit((data) => updateMutation.mutate(data))}
            className="space-y-4"
          >
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="edit-title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-title"
                placeholder="Petition title"
                aria-invalid={!!editForm.formState.errors.title}
                {...editForm.register("title")}
              />
              {editForm.formState.errors.title && (
                <p className="text-destructive text-sm">
                  {editForm.formState.errors.title.message}
                </p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="edit-description">Description (optional)</Label>
              <textarea
                id="edit-description"
                className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Describe this petition..."
                {...editForm.register("description")}
              />
            </div>

            {/* Type */}
            <div className="space-y-2">
              <Label htmlFor="edit-type">
                Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={watchedEditType}
                onValueChange={(v) => editForm.setValue("type", v as UpdatePetitionInput["type"])}
              >
                <SelectTrigger id="edit-type" aria-invalid={!!editForm.formState.errors.type}>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {PETITION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.charAt(0) + t.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* v8 ignore start -- type always has a valid value from select, validation error unreachable */}
              {editForm.formState.errors.type && (
                <p className="text-destructive text-sm">{editForm.formState.errors.type.message}</p>
              )}
              {/* v8 ignore stop */}
            </div>

            {/* Target Authority */}
            <div className="space-y-2">
              <Label htmlFor="edit-authority">Target Authority (optional)</Label>
              <Input
                id="edit-authority"
                placeholder="e.g. Municipal Corporation"
                {...editForm.register("targetAuthority")}
              />
            </div>

            {/* Min Signatures */}
            <div className="space-y-2">
              <Label htmlFor="edit-min-signatures">Minimum Signatures (optional)</Label>
              <Input
                id="edit-min-signatures"
                type="number"
                min={1}
                placeholder="e.g. 100"
                aria-invalid={!!editForm.formState.errors.minSignatures}
                {...editForm.register("minSignatures", {
                  setValueAs: (v) => (v === "" || v == null ? null : parseInt(String(v), 10)),
                })}
              />
              {editForm.formState.errors.minSignatures && (
                <p className="text-destructive text-sm">
                  {editForm.formState.errors.minSignatures.message}
                </p>
              )}
            </div>

            {/* Deadline */}
            <div className="space-y-2">
              <Label htmlFor="edit-deadline">Deadline (optional)</Label>
              <Input
                id="edit-deadline"
                type="date"
                aria-invalid={!!editForm.formState.errors.deadline}
                {...editForm.register("deadline")}
              />
              {/* v8 ignore start -- deadline is optional/nullable, validation error unreachable in practice */}
              {editForm.formState.errors.deadline && (
                <p className="text-destructive text-sm">
                  {editForm.formState.errors.deadline.message}
                </p>
              )}
              {/* v8 ignore stop */}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditDialog(false);
                  editForm.reset();
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={updateMutation.isPending}
                onClick={editForm.handleSubmit((data) => updateMutation.mutate(data))}
              >
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Delete Confirm ── */}
      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Petition?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            This action cannot be undone. The petition and all associated data will be permanently
            removed.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Remove Signature Confirm ── */}
      <Dialog
        open={!!removeSignatureId}
        onOpenChange={(open) => {
          /* v8 ignore start -- controlled dialog: onOpenChange only fires with open=false */
          if (!open) setRemoveSignatureId(null);
          /* v8 ignore stop */
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Remove Signature?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            This will permanently remove this signature from the petition. The resident will need to
            sign again if they wish to re-submit.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveSignatureId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={removeSignatureMutation.isPending}
              onClick={() => {
                /* v8 ignore next -- defensive guard; dialog only opens when removeSignatureId is set */
                if (removeSignatureId) removeSignatureMutation.mutate(removeSignatureId);
              }}
            >
              {removeSignatureMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Extend Deadline ── */}
      <Dialog
        open={extendDeadlineDialog}
        onOpenChange={(open) => {
          /* v8 ignore start -- controlled dialog: onOpenChange only fires with open=false */
          if (!open) {
            setExtendDeadlineDialog(false);
            setNewDeadline("");
          }
          /* v8 ignore stop */
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Extend Deadline</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-muted-foreground text-sm">
              Set a new deadline for this petition. Leave empty to remove the deadline.
            </p>
            <div className="space-y-2">
              <Label htmlFor="extend-deadline-input">Deadline (optional)</Label>
              <Input
                id="extend-deadline-input"
                type="date"
                value={newDeadline}
                onChange={(e) => setNewDeadline(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setExtendDeadlineDialog(false);
                setNewDeadline("");
              }}
            >
              Cancel
            </Button>
            <Button
              disabled={extendDeadlineMutation.isPending}
              onClick={() => extendDeadlineMutation.mutate(newDeadline || null)}
            >
              {extendDeadlineMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
