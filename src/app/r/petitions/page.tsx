"use client";

import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckCircle2, Clock, FileSignature, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { SignaturePad } from "@/components/features/petitions/SignaturePad";
import { SignatureUpload } from "@/components/features/petitions/SignatureUpload";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import {
  getResidentPetition,
  getResidentPetitions,
  revokeSignature,
  signPetition,
} from "@/services/petitions";
import type { Petition } from "@/services/petitions";

// ── Constants ──

const TYPE_COLORS: Record<string, string> = {
  COMPLAINT: "border-red-200 bg-red-50 text-red-700",
  PETITION: "border-blue-200 bg-blue-50 text-blue-700",
  NOTICE: "border-yellow-200 bg-yellow-50 text-yellow-700",
};

const STATUS_COLORS: Record<string, string> = {
  PUBLISHED: "border-blue-200 bg-blue-50 text-blue-700",
  SUBMITTED: "border-green-200 bg-green-50 text-green-700",
};

// ── Helpers ──

function getSignatureCountLabel(count: number, min: number | null): string {
  if (min != null) return `${count} of ${min} signed`;
  return `${count} signed`;
}

// ── Main Page ──

export default function ResidentPetitionsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [signMode, setSignMode] = useState<"DRAWN" | "UPLOADED" | null>(null);

  // ── Queries ──

  const { data: petitionsData, isLoading } = useQuery({
    queryKey: ["resident-petitions"],
    queryFn: () => getResidentPetitions(),
    enabled: !!user,
  });

  const petitions = petitionsData?.data ?? [];

  const { data: petitionDetail } = useQuery({
    queryKey: ["resident-petition", selectedId],
    queryFn: () => getResidentPetition(selectedId!),
    enabled: !!selectedId,
  });

  // ── Mutations ──

  const signMutation = useMutation({
    mutationFn: (data: { method: "DRAWN" | "UPLOADED"; signatureDataUrl: string }) =>
      signPetition(selectedId!, data),
    onSuccess: () => {
      toast.success("Petition signed!");
      setSignMode(null);
      void queryClient.invalidateQueries({ queryKey: ["resident-petitions"] });
      void queryClient.invalidateQueries({ queryKey: ["resident-petition", selectedId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revokeMutation = useMutation({
    mutationFn: () => revokeSignature(selectedId!),
    onSuccess: () => {
      toast.success("Signature revoked.");
      void queryClient.invalidateQueries({ queryKey: ["resident-petitions"] });
      void queryClient.invalidateQueries({ queryKey: ["resident-petition", selectedId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Handlers ──

  const handleSelectPetition = (petition: Petition) => {
    setSelectedId(petition.id);
    setSignMode(null);
  };

  const handleSheetOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedId(null);
      setSignMode(null);
    }
  };

  const handleSignature = (dataUrl: string) => {
    if (!signMode) return;
    signMutation.mutate({ method: signMode, signatureDataUrl: dataUrl });
  };

  // ── Render ──

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Petitions</h1>
      </div>

      {isLoading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
        </div>
      ) : petitions.length === 0 ? (
        <EmptyState
          icon={<FileSignature className="text-muted-foreground h-8 w-8" />}
          title="No Petitions"
          description="No active petitions at the moment."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {petitions.map((petition) => (
            <Card
              key={petition.id}
              className="hover:bg-muted/30 cursor-pointer transition-colors"
              onClick={() => handleSelectPetition(petition)}
            >
              <CardContent className="space-y-3 pt-4 pb-4">
                {/* Title + type badge */}
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm leading-tight font-semibold">{petition.title}</h3>
                  <Badge
                    variant="outline"
                    className={`shrink-0 text-xs ${TYPE_COLORS[petition.type] ?? ""}`}
                  >
                    {petition.type}
                  </Badge>
                </div>

                {/* Meta */}
                <div className="text-muted-foreground space-y-1 text-xs">
                  {petition.targetAuthority && (
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      {petition.targetAuthority}
                    </div>
                  )}
                  {petition.deadline && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      Deadline: {format(new Date(petition.deadline), "dd MMM yyyy")}
                    </div>
                  )}
                </div>

                {/* Signature count */}
                <p className="text-muted-foreground text-xs">
                  {getSignatureCountLabel(petition._count?.signatures ?? 0, petition.minSignatures)}
                </p>

                {/* Status + submitted line */}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className={`text-xs ${STATUS_COLORS[petition.status] ?? ""}`}
                  >
                    {petition.status}
                  </Badge>

                  {petition.status === "SUBMITTED" && petition.submittedAt && (
                    <p className="text-muted-foreground text-xs">
                      Submitted{petition.targetAuthority ? ` to ${petition.targetAuthority}` : ""}{" "}
                      on {format(new Date(petition.submittedAt), "dd MMM yyyy")}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Petition Detail Sheet ── */}
      <Sheet open={!!selectedId} onOpenChange={handleSheetOpenChange}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          {petitionDetail && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle>{petitionDetail.title}</SheetTitle>
              </SheetHeader>

              <div className="space-y-4">
                {/* Type + status badges */}
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant="outline"
                    className={`text-xs ${TYPE_COLORS[petitionDetail.type] ?? ""}`}
                  >
                    {petitionDetail.type}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`text-xs ${STATUS_COLORS[petitionDetail.status] ?? ""}`}
                  >
                    {petitionDetail.status}
                  </Badge>
                </div>

                {/* Meta */}
                <div className="text-muted-foreground space-y-1.5 text-sm">
                  {petitionDetail.targetAuthority && (
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0" />
                      {petitionDetail.targetAuthority}
                    </div>
                  )}
                  {petitionDetail.deadline && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 shrink-0" />
                      Deadline: {format(new Date(petitionDetail.deadline), "dd MMM yyyy")}
                    </div>
                  )}
                </div>

                {/* Description */}
                {petitionDetail.description && (
                  <p className="text-muted-foreground text-sm">{petitionDetail.description}</p>
                )}

                {/* Submitted info */}
                {petitionDetail.status === "SUBMITTED" && petitionDetail.submittedAt && (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                    <p className="text-sm text-green-800">
                      Submitted
                      {petitionDetail.targetAuthority
                        ? ` to ${petitionDetail.targetAuthority}`
                        : ""}{" "}
                      on {format(new Date(petitionDetail.submittedAt), "dd MMM yyyy")}
                    </p>
                  </div>
                )}

                {/* Signature count + progress */}
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">
                    {getSignatureCountLabel(
                      petitionDetail.signatureCount,
                      petitionDetail.minSignatures,
                    )}
                  </p>
                  {petitionDetail.minSignatures != null && (
                    <Progress
                      value={Math.min(
                        (petitionDetail.signatureCount / petitionDetail.minSignatures) * 100,
                        100,
                      )}
                      className="h-2"
                    />
                  )}
                </div>

                {/* PDF viewer */}
                {petitionDetail.documentSignedUrl ? (
                  <iframe
                    src={petitionDetail.documentSignedUrl}
                    className="h-[400px] w-full rounded-md border"
                    title="Petition document"
                  />
                ) : petitionDetail.documentUrl ? (
                  <a
                    href={petitionDetail.documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary flex items-center gap-1.5 text-sm underline"
                  >
                    <FileText className="h-4 w-4" />
                    Download PDF
                  </a>
                ) : null}

                <Separator />

                {/* Action area */}
                <div className="space-y-3">
                  {/* SUBMITTED — read only */}
                  {petitionDetail.status === "SUBMITTED" && (
                    <p className="text-muted-foreground text-sm">
                      This petition has been submitted and is no longer accepting signatures.
                    </p>
                  )}

                  {/* PUBLISHED — already signed */}
                  {petitionDetail.status === "PUBLISHED" && petitionDetail.mySignature && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="text-sm font-medium">
                          You signed on{" "}
                          {format(new Date(petitionDetail.mySignature.signedAt), "dd MMM yyyy")}
                        </span>
                      </div>
                      {!signMode && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-destructive/30 text-destructive hover:bg-destructive/5 w-full"
                          disabled={revokeMutation.isPending}
                          onClick={() => revokeMutation.mutate()}
                        >
                          {revokeMutation.isPending && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Revoke Signature
                        </Button>
                      )}
                    </div>
                  )}

                  {/* PUBLISHED — not yet signed */}
                  {petitionDetail.status === "PUBLISHED" && !petitionDetail.mySignature && (
                    <div className="space-y-3">
                      {!signMode ? (
                        <Button className="w-full" onClick={() => setSignMode("DRAWN")}>
                          Sign Petition
                        </Button>
                      ) : (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">Sign this Petition</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSignMode(null)}
                              disabled={signMutation.isPending}
                            >
                              Cancel
                            </Button>
                          </div>

                          <Tabs
                            value={signMode === "UPLOADED" ? "upload" : "draw"}
                            onValueChange={(v) =>
                              setSignMode(v === "upload" ? "UPLOADED" : "DRAWN")
                            }
                          >
                            <TabsList className="w-full">
                              <TabsTrigger value="draw" className="flex-1">
                                Draw
                              </TabsTrigger>
                              <TabsTrigger value="upload" className="flex-1">
                                Upload
                              </TabsTrigger>
                            </TabsList>

                            <TabsContent value="draw" className="mt-3">
                              <SignaturePad
                                onSignature={handleSignature}
                                disabled={signMutation.isPending}
                              />
                            </TabsContent>

                            <TabsContent value="upload" className="mt-3">
                              <SignatureUpload
                                onSignature={handleSignature}
                                disabled={signMutation.isPending}
                              />
                            </TabsContent>
                          </Tabs>

                          {signMutation.isPending && (
                            <div className="flex items-center justify-center gap-2 text-sm">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Submitting signature…
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
