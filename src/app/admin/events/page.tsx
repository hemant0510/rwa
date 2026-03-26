"use client";

import { useState, Suspense } from "react";

import { useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Plus, Loader2 } from "lucide-react";
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
import { createEventSchema, type CreateEventInput } from "@/lib/validations/event";
import { getEvents, createEvent } from "@/services/events";

// ── Constants ──

const EVENT_STATUSES = ["DRAFT", "PUBLISHED", "COMPLETED", "CANCELLED"] as const;
const EVENT_CATEGORIES = [
  "FESTIVAL",
  "SPORTS",
  "WORKSHOP",
  "CULTURAL",
  "MEETING",
  "OTHER",
] as const;
const FEE_MODELS = ["FREE", "FIXED", "FLEXIBLE", "CONTRIBUTION"] as const;
const CHARGE_UNITS = ["PER_PERSON", "PER_HOUSEHOLD"] as const;

const CATEGORY_LABELS: Record<string, string> = {
  FESTIVAL: "Festival",
  SPORTS: "Sports",
  WORKSHOP: "Workshop",
  CULTURAL: "Cultural",
  MEETING: "Meeting",
  OTHER: "Other",
};

const FEE_MODEL_LABELS: Record<string, string> = {
  FREE: "Free",
  FIXED: "Fixed",
  FLEXIBLE: "Flexible",
  CONTRIBUTION: "Contribution",
};

const CHARGE_UNIT_LABELS: Record<string, string> = {
  PER_PERSON: "Per Person",
  PER_HOUSEHOLD: "Per Household",
};

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
    COMPLETED: "border-green-200 bg-green-50 text-green-700",
    CANCELLED: "border-red-200 bg-red-50 text-red-700",
  };
  const cls = variants[status] ?? "border-gray-200 bg-gray-50 text-gray-700";
  return (
    <Badge variant="outline" className={cls}>
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </Badge>
  );
}

function FeeModelBadge({ feeModel }: { feeModel: string }) {
  const variants: Record<string, string> = {
    FREE: "border-gray-200 bg-gray-50 text-gray-700",
    FIXED: "border-purple-200 bg-purple-50 text-purple-700",
    FLEXIBLE: "border-orange-200 bg-orange-50 text-orange-700",
    CONTRIBUTION: "border-teal-200 bg-teal-50 text-teal-700",
  };
  const cls = variants[feeModel] ?? "border-gray-200 bg-gray-50 text-gray-700";
  return (
    <Badge variant="outline" className={cls}>
      {FEE_MODEL_LABELS[feeModel] ?? feeModel}
    </Badge>
  );
}

// ── Page shell (required for useSocietyId which calls useSearchParams) ──

export default function EventsPage() {
  return (
    <Suspense fallback={<TableSkeleton rows={5} />}>
      <EventsPageInner />
    </Suspense>
  );
}

// ── Inner page ──

function EventsPageInner() {
  const router = useRouter();
  const { societyId } = useSocietyId();
  const queryClient = useQueryClient();

  // Dialog state
  const [createDialog, setCreateDialog] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);

  // Query
  const { data: events, isLoading } = useQuery({
    queryKey: ["events", societyId, statusFilter, categoryFilter, page],
    queryFn: () =>
      getEvents(societyId, {
        status: statusFilter === "all" ? undefined : statusFilter,
        category: categoryFilter === "all" ? undefined : categoryFilter,
        page,
      }),
    enabled: !!societyId,
  });

  // Create form
  const createForm = useForm<CreateEventInput>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      feeModel: "FREE",
      chargeUnit: "PER_PERSON",
      category: "FESTIVAL",
      title: "",
      description: "",
      location: "",
      eventDate: "",
      registrationDeadline: "",
    },
  });

  const selectedFeeModel = useWatch({ control: createForm.control, name: "feeModel" });
  const selectedCategory = useWatch({ control: createForm.control, name: "category" });
  const selectedChargeUnit = useWatch({ control: createForm.control, name: "chargeUnit" });

  // Mutation
  const createMutation = useMutation({
    mutationFn: (data: CreateEventInput) => createEvent(societyId, data),
    onSuccess: () => {
      toast.success("Event created!");
      setCreateDialog(false);
      createForm.reset();
      queryClient.invalidateQueries({ queryKey: ["events"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // Nudge: COMPLETED but unsettled events
  const pendingSettlementCount =
    events?.data?.filter((e) => e.status === "COMPLETED" && !e.settledAt).length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Community Events" description="Manage society events">
        {pendingSettlementCount > 0 && (
          <Badge variant="outline" className="border-orange-200 bg-orange-50 text-orange-700">
            <Calendar className="mr-1 h-3 w-3" />
            {pendingSettlementCount} event{pendingSettlementCount > 1 ? "s" : ""} pending settlement
          </Badge>
        )}
        <Button onClick={() => setCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Event
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
            {EVENT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={categoryFilter}
          onValueChange={(v) => {
            setCategoryFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {EVENT_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Events Table */}
      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : events?.data?.length ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event Name</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="hidden sm:table-cell">Category</TableHead>
                <TableHead className="hidden md:table-cell">Fee Model</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Registrations</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.data.map((event) => (
                <TableRow
                  key={event.id}
                  className="hover:bg-muted/50 cursor-pointer"
                  onClick={() => router.push(`/admin/events/${event.id}`)}
                >
                  <TableCell className="font-medium">{event.title}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(event.eventDate)}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="secondary" className="text-xs">
                      {CATEGORY_LABELS[event.category] ?? event.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <FeeModelBadge feeModel={event.feeModel} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <StatusBadge status={event.status} />
                      {event.status === "COMPLETED" && (
                        <span
                          className={`text-xs ${event.settledAt ? "text-green-600" : "text-orange-600"}`}
                        >
                          {event.settledAt ? "Settled ✓" : "Pending settlement"}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {event._count?.registrations ?? 0}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center">
            No events found. Click &quot;Create Event&quot; to add one.
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {events && events.total > events.limit && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Showing {(events.page - 1) * events.limit + 1}–
            {Math.min(events.page * events.limit, events.total)} of {events.total}
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
              disabled={page * events.limit >= events.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Create Event Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Event</DialogTitle>
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
                placeholder="Event title"
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
                placeholder="Describe this event..."
                {...createForm.register("description")}
              />
            </div>

            {/* Category & Fee Model */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  Category <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={selectedCategory}
                  onValueChange={(v) =>
                    createForm.setValue("category", v as CreateEventInput["category"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {CATEGORY_LABELS[cat]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>
                  Fee Model <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={selectedFeeModel}
                  onValueChange={(v) => {
                    createForm.setValue("feeModel", v as CreateEventInput["feeModel"]);
                    // Reset fee-model-specific fields on change
                    createForm.setValue("feeAmount", null);
                    createForm.setValue("estimatedBudget", null);
                    createForm.setValue("minParticipants", null);
                    createForm.setValue("suggestedAmount", null);
                    if (v === "FREE") {
                      createForm.setValue("chargeUnit", "PER_HOUSEHOLD");
                    } else {
                      createForm.setValue("chargeUnit", "PER_PERSON");
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FEE_MODELS.map((fm) => (
                      <SelectItem key={fm} value={fm}>
                        {FEE_MODEL_LABELS[fm]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Charge Unit — hidden for FREE */}
            {selectedFeeModel !== "FREE" && (
              <div className="space-y-2">
                <Label>Charge Unit</Label>
                <Select
                  value={selectedChargeUnit}
                  onValueChange={(v) =>
                    createForm.setValue("chargeUnit", v as CreateEventInput["chargeUnit"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHARGE_UNITS.map((cu) => (
                      <SelectItem key={cu} value={cu}>
                        {CHARGE_UNIT_LABELS[cu]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Fee Amount — FIXED only */}
            {selectedFeeModel === "FIXED" && (
              <div className="space-y-2">
                <Label>
                  Fee Amount (₹) <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="0"
                  aria-invalid={!!createForm.formState.errors.feeAmount}
                  {...createForm.register("feeAmount", { valueAsNumber: true })}
                />
                {createForm.formState.errors.feeAmount && (
                  <p className="text-destructive text-sm">
                    {createForm.formState.errors.feeAmount.message}
                  </p>
                )}
              </div>
            )}

            {/* Estimated Budget — FLEXIBLE only */}
            {selectedFeeModel === "FLEXIBLE" && (
              <div className="space-y-2">
                <Label>Estimated Budget (₹)</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="0"
                  aria-invalid={!!createForm.formState.errors.estimatedBudget}
                  {...createForm.register("estimatedBudget", { valueAsNumber: true })}
                />
                {createForm.formState.errors.estimatedBudget && (
                  <p className="text-destructive text-sm">
                    {createForm.formState.errors.estimatedBudget.message}
                  </p>
                )}
              </div>
            )}

            {/* Min Participants — FLEXIBLE only */}
            {selectedFeeModel === "FLEXIBLE" && (
              <div className="space-y-2">
                <Label>Minimum Participants</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="e.g. 10"
                  {...createForm.register("minParticipants", { valueAsNumber: true })}
                />
              </div>
            )}

            {/* Suggested Amount — CONTRIBUTION only */}
            {selectedFeeModel === "CONTRIBUTION" && (
              <div className="space-y-2">
                <Label>Suggested Amount (₹)</Label>
                <Input
                  type="number"
                  min={1}
                  placeholder="0"
                  aria-invalid={!!createForm.formState.errors.suggestedAmount}
                  {...createForm.register("suggestedAmount", { valueAsNumber: true })}
                />
                {createForm.formState.errors.suggestedAmount && (
                  <p className="text-destructive text-sm">
                    {createForm.formState.errors.suggestedAmount.message}
                  </p>
                )}
              </div>
            )}

            {/* Event Date */}
            <div className="space-y-2">
              <Label>
                Event Date &amp; Time <span className="text-destructive">*</span>
              </Label>
              <Input
                type="datetime-local"
                aria-invalid={!!createForm.formState.errors.eventDate}
                {...createForm.register("eventDate")}
              />
              {createForm.formState.errors.eventDate && (
                <p className="text-destructive text-sm">
                  {createForm.formState.errors.eventDate.message}
                </p>
              )}
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label>Location (optional)</Label>
              <Input placeholder="e.g. Community Hall" {...createForm.register("location")} />
            </div>

            {/* Registration Deadline */}
            <div className="space-y-2">
              <Label>Registration Deadline (optional)</Label>
              <Input
                type="datetime-local"
                aria-invalid={!!createForm.formState.errors.registrationDeadline}
                {...createForm.register("registrationDeadline")}
              />
              {createForm.formState.errors.registrationDeadline && (
                <p className="text-destructive text-sm">
                  {createForm.formState.errors.registrationDeadline.message}
                </p>
              )}
            </div>

            {/* Max Participants */}
            <div className="space-y-2">
              <Label>Max Participants (optional)</Label>
              <Input
                type="number"
                min={1}
                placeholder="Leave blank for unlimited"
                {...createForm.register("maxParticipants", { valueAsNumber: true })}
              />
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
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Event
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
