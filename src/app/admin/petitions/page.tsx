"use client";

import { useState, Suspense } from "react";

import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2 } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TableSkeleton } from "@/components/ui/LoadingSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
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
import { useSocietyId } from "@/hooks/useSocietyId";
import { createPetitionSchema, type CreatePetitionInput } from "@/lib/validations/petition";
import { getPetitions, createPetition } from "@/services/petitions";

// ── Constants ──

const PETITION_STATUSES = ["DRAFT", "PUBLISHED", "SUBMITTED", "CLOSED"] as const;
const PETITION_TYPES = ["COMPLAINT", "PETITION", "NOTICE"] as const;

// ── Helpers ──

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    DRAFT: "border-gray-200 bg-gray-50 text-gray-700",
    PUBLISHED: "border-blue-200 bg-blue-50 text-blue-700",
    SUBMITTED: "border-green-200 bg-green-50 text-green-700",
    CLOSED: "border-red-200 bg-red-50 text-red-700",
  };
  const cls = variants[status] ?? "border-gray-200 bg-gray-50 text-gray-700";
  return (
    <Badge variant="outline" className={cls}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </Badge>
  );
}

function TypeBadge({ type }: { type: string }) {
  const variants: Record<string, string> = {
    COMPLAINT: "border-red-200 bg-red-50 text-red-700",
    PETITION: "border-blue-200 bg-blue-50 text-blue-700",
    NOTICE: "border-yellow-200 bg-yellow-50 text-yellow-700",
  };
  const cls = variants[type] ?? "border-gray-200 bg-gray-50 text-gray-700";
  return (
    <Badge variant="outline" className={cls}>
      {type.charAt(0) + type.slice(1).toLowerCase()}
    </Badge>
  );
}

// ── Page shell (required for useSocietyId which calls useSearchParams) ──

export default function PetitionsPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={5} />}>
      <PetitionsPageInner />
    </Suspense>
  );
}

// ── Inner page ──

function PetitionsPageInner() {
  const router = useRouter();
  const { societyId } = useSocietyId();
  const queryClient = useQueryClient();

  // Dialog state
  const [createDialog, setCreateDialog] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);

  // Query
  const { data: petitions, isLoading } = useQuery({
    queryKey: ["petitions", societyId, statusFilter, typeFilter, page],
    queryFn: () =>
      getPetitions(societyId, {
        status: statusFilter === "all" ? undefined : statusFilter,
        type: typeFilter === "all" ? undefined : typeFilter,
        page,
      }),
    enabled: !!societyId,
  });

  // Create form
  const createForm = useForm<CreatePetitionInput>({
    resolver: zodResolver(createPetitionSchema),
    defaultValues: {
      title: "",
      description: "",
      type: "PETITION",
      targetAuthority: "",
      minSignatures: null,
      deadline: "",
    },
  });

  const selectedType = useWatch({ control: createForm.control, name: "type" });

  // Mutation
  const createMutation = useMutation({
    mutationFn: (data: CreatePetitionInput) => createPetition(societyId, data),
    onSuccess: () => {
      toast.success("Petition created!");
      setCreateDialog(false);
      createForm.reset();
      queryClient.invalidateQueries({ queryKey: ["petitions"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Petitions" description="Manage community petitions & complaints">
        <Button onClick={() => setCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Petition
        </Button>
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {PETITION_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {PETITION_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t.charAt(0) + t.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Petitions Table */}
      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : petitions?.data?.length ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="hidden sm:table-cell">Target Authority</TableHead>
                <TableHead className="hidden md:table-cell">Signatures</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {petitions.data.map((petition) => (
                <TableRow
                  key={petition.id}
                  className="hover:bg-muted/50 cursor-pointer"
                  onClick={() => router.push(`/admin/petitions/${petition.id}`)}
                >
                  <TableCell className="font-medium">{petition.title}</TableCell>
                  <TableCell>
                    <TypeBadge type={petition.type} />
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden text-sm sm:table-cell">
                    {petition.targetAuthority ?? "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {petition.minSignatures != null
                      ? `${petition._count?.signatures ?? 0}/${petition.minSignatures}`
                      : (petition._count?.signatures ?? 0)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={petition.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden text-sm sm:table-cell">
                    {formatDate(petition.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center">
            No petitions found.
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {petitions && petitions.total > petitions.limit && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Showing {(petitions.page - 1) * petitions.limit + 1}–
            {Math.min(petitions.page * petitions.limit, petitions.total)} of {petitions.total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page * petitions.limit >= petitions.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Create Petition Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Petition</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={createForm.handleSubmit((data) => createMutation.mutate(data))}
            className="space-y-4"
          >
            {/* Title */}
            <div className="space-y-2">
              <Label>
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Petition title"
                aria-invalid={!!createForm.formState.errors.title}
                {...createForm.register("title")}
              />
              {createForm.formState.errors.title && (
                <p className="text-destructive text-sm">
                  {createForm.formState.errors.title.message}
                </p>
              )}
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <textarea
                className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[80px] w-full rounded-md border px-3 py-2 text-sm shadow-sm focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Describe this petition..."
                {...createForm.register("description")}
              />
            </div>

            {/* Type */}
            <div className="space-y-2">
              <Label>
                Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={selectedType}
                onValueChange={(v) => createForm.setValue("type", v as CreatePetitionInput["type"])}
              >
                <SelectTrigger aria-invalid={!!createForm.formState.errors.type}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PETITION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t.charAt(0) + t.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {createForm.formState.errors.type && (
                <p className="text-destructive text-sm">
                  {createForm.formState.errors.type.message}
                </p>
              )}
            </div>

            {/* Target Authority */}
            <div className="space-y-2">
              <Label>Target Authority (optional)</Label>
              <Input
                placeholder="e.g. Municipal Corporation"
                {...createForm.register("targetAuthority")}
              />
            </div>

            {/* Min Signatures */}
            <div className="space-y-2">
              <Label>Minimum Signatures (optional)</Label>
              <Input
                type="number"
                min={1}
                placeholder="e.g. 100"
                {...createForm.register("minSignatures", {
                  setValueAs: (v) => (v === "" || v == null ? null : parseInt(String(v), 10)),
                })}
              />
              {createForm.formState.errors.minSignatures && (
                <p className="text-destructive text-sm">
                  {createForm.formState.errors.minSignatures.message}
                </p>
              )}
            </div>

            {/* Deadline */}
            <div className="space-y-2">
              <Label>Deadline (optional)</Label>
              <Input
                type="date"
                aria-invalid={!!createForm.formState.errors.deadline}
                {...createForm.register("deadline")}
              />
              {createForm.formState.errors.deadline && (
                <p className="text-destructive text-sm">
                  {createForm.formState.errors.deadline.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreateDialog(false);
                  createForm.reset();
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={createMutation.isPending}
                onClick={createForm.handleSubmit((data) => createMutation.mutate(data))}
              >
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Petition
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
