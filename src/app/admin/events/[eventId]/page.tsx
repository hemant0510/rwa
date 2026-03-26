"use client";

import { useState } from "react";

import { useParams, useRouter } from "next/navigation";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  IndianRupee,
  Info,
  Loader2,
  Plus,
  Users,
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
  addEventExpenseSchema,
  cancelEventSchema,
  recordEventPaymentSchema,
  settleEventSchema,
  triggerPaymentSchema,
  updateEventSchema,
  type AddEventExpenseInput,
  type CancelEventInput,
  type RecordEventPaymentInput,
  type SettleEventInput,
  type TriggerPaymentInput,
  type UpdateEventInput,
} from "@/lib/validations/event";
import {
  addEventExpense,
  cancelEvent,
  completeEvent,
  deleteEvent,
  getEvent,
  getEventFinances,
  getRegistrations,
  publishEvent,
  recordEventPayment,
  settleEvent,
  triggerPayment,
  updateEvent,
  type CommunityEvent,
  type EventFinanceSummary,
  type EventRegistration,
} from "@/services/events";

// ── Constants ──────────────────────────────────────────────────────────────

const PAYMENT_MODE_LABELS: Record<string, string> = {
  CASH: "Cash",
  UPI: "UPI",
  BANK_TRANSFER: "Bank Transfer",
  OTHER: "Other",
};

const EVENT_EXPENSE_CATEGORIES = [
  "MAINTENANCE",
  "SECURITY",
  "CLEANING",
  "STAFF_SALARY",
  "INFRASTRUCTURE",
  "UTILITIES",
  "EMERGENCY",
  "ADMINISTRATIVE",
  "OTHER",
] as const;

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  MAINTENANCE: "Maintenance",
  SECURITY: "Security",
  CLEANING: "Cleaning",
  STAFF_SALARY: "Staff Salary",
  INFRASTRUCTURE: "Infrastructure",
  UTILITIES: "Utilities",
  EMERGENCY: "Emergency",
  ADMINISTRATIVE: "Administrative",
  OTHER: "Other",
};

const EVENT_CATEGORY_LABELS: Record<string, string> = {
  FESTIVAL: "Festival",
  SPORTS: "Sports",
  WORKSHOP: "Workshop",
  CULTURAL: "Cultural",
  MEETING: "Meeting",
  OTHER: "Other",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(amount: number | string | null | undefined) {
  if (amount == null) return "—";
  return `₹${Number(amount).toLocaleString("en-IN")}`;
}

function computeAmountDue(event: CommunityEvent, reg: EventRegistration): number {
  if (!event.feeAmount) return 0;
  return event.chargeUnit === "PER_PERSON"
    ? Number(event.feeAmount) * reg.memberCount
    : Number(event.feeAmount);
}

// ── Badge helpers ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: "border-gray-200 bg-gray-100 text-gray-700",
    PUBLISHED: "border-blue-200 bg-blue-50 text-blue-700",
    COMPLETED: "border-green-200 bg-green-50 text-green-700",
    CANCELLED: "border-red-200 bg-red-50 text-red-700",
  };
  return (
    <Badge variant="outline" className={map[status] ?? ""}>
      {status}
    </Badge>
  );
}

function FeeModelBadge({ model }: { model: string }) {
  const map: Record<string, string> = {
    FREE: "border-gray-200 bg-gray-100 text-gray-700",
    FIXED: "border-purple-200 bg-purple-50 text-purple-700",
    FLEXIBLE: "border-orange-200 bg-orange-50 text-orange-700",
    CONTRIBUTION: "border-teal-200 bg-teal-50 text-teal-700",
  };
  return (
    <Badge variant="outline" className={map[model] ?? ""}>
      {model}
    </Badge>
  );
}

function ChargeUnitBadge({ unit }: { unit: string }) {
  return (
    <Badge variant="secondary" className="text-xs">
      {unit === "PER_PERSON" ? "Per Person" : "Per Household"}
    </Badge>
  );
}

function RegistrationStatusBadge({ status }: { status: string }) {
  if (status === "PAID") {
    return (
      <Badge variant="outline" className="border-green-200 bg-green-50 text-xs text-green-700">
        <Check className="mr-1 h-3 w-3" />
        Paid
      </Badge>
    );
  }
  if (status === "PENDING") {
    return (
      <Badge variant="outline" className="border-yellow-200 bg-yellow-50 text-xs text-yellow-700">
        Pending
      </Badge>
    );
  }
  if (status === "GOING") {
    return (
      <Badge variant="outline" className="border-blue-200 bg-blue-50 text-xs text-blue-700">
        <Check className="mr-1 h-3 w-3" />
        Going
      </Badge>
    );
  }
  if (status === "INTERESTED") {
    return (
      <Badge variant="outline" className="border-gray-200 bg-gray-50 text-xs text-gray-700">
        Interested
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-xs">
      {status}
    </Badge>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { societyId } = useSocietyId();
  const router = useRouter();
  const queryClient = useQueryClient();

  // ── Dialog state ──
  const [publishConfirm, setPublishConfirm] = useState(false);
  const [completeConfirm, setCompleteConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [cancelDialog, setCancelDialog] = useState(false);
  const [triggerPaymentDialog, setTriggerPaymentDialog] = useState(false);
  const [settleDialog, setSettleDialog] = useState(false);
  const [editDialog, setEditDialog] = useState(false);
  const [addExpenseDialog, setAddExpenseDialog] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState<{
    open: boolean;
    registration: EventRegistration | null;
  }>({ open: false, registration: null });

  // Settle disposition state (not in react-hook-form since it's dynamic)
  const [surplusDisposal, setSurplusDisposal] = useState<string>("");
  const [deficitDisposition, setDeficitDisposition] = useState<string>("");

  // ── Queries ──
  const { data: event, isLoading } = useQuery({
    queryKey: ["event", societyId, eventId],
    queryFn: () => getEvent(societyId, eventId),
    enabled: !!societyId && !!eventId,
  });

  // Registrations from separate endpoint (for refresh after payment)
  const { data: registrationsData } = useQuery({
    queryKey: ["registrations", societyId, eventId],
    queryFn: () => getRegistrations(societyId, eventId),
    enabled: !!societyId && !!eventId,
  });

  const { data: finances } = useQuery({
    queryKey: ["finances", societyId, eventId],
    queryFn: () => getEventFinances(societyId, eventId),
    enabled: !!societyId && !!eventId,
  });

  // Use registrations from separate query if available, fall back to empty
  const registrations: EventRegistration[] = registrationsData?.data ?? [];

  // ── Forms ──
  const cancelForm = useForm<CancelEventInput>({
    resolver: zodResolver(cancelEventSchema),
    defaultValues: { reason: "" },
  });

  const triggerForm = useForm<TriggerPaymentInput>({
    resolver: zodResolver(triggerPaymentSchema),
    defaultValues: { feeAmount: 0 },
  });

  const paymentForm = useForm<RecordEventPaymentInput>({
    resolver: zodResolver(recordEventPaymentSchema),
    defaultValues: {
      amount: 0,
      paymentMode: "CASH",
      paymentDate: new Date().toISOString().split("T")[0],
      referenceNo: "",
      notes: "",
    },
  });

  const expenseForm = useForm<AddEventExpenseInput>({
    resolver: zodResolver(addEventExpenseSchema),
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      amount: 0,
      category: "OTHER",
      description: "",
      receiptUrl: null,
    },
  });

  const settleForm = useForm<SettleEventInput>({
    resolver: zodResolver(settleEventSchema),
    defaultValues: { notes: "" },
  });

  const editForm = useForm<UpdateEventInput>({
    resolver: zodResolver(updateEventSchema),
  });

  // Watched form values — useWatch avoids incompatible-library warning
  const watchedExpenseCategory = useWatch({ control: expenseForm.control, name: "category" });
  const watchedEditCategory = useWatch({ control: editForm.control, name: "category" });
  const watchedEditFeeModel = useWatch({ control: editForm.control, name: "feeModel" });
  const watchedEditChargeUnit = useWatch({ control: editForm.control, name: "chargeUnit" });

  // ── Mutations ──
  const invalidateEvent = () => {
    queryClient.invalidateQueries({ queryKey: ["event", societyId, eventId] });
    queryClient.invalidateQueries({ queryKey: ["registrations", societyId, eventId] });
    queryClient.invalidateQueries({ queryKey: ["finances", societyId, eventId] });
  };

  const publishMutation = useMutation({
    mutationFn: () => publishEvent(societyId, eventId),
    onSuccess: () => {
      toast.success("Event published!");
      setPublishConfirm(false);
      invalidateEvent();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const completeMutation = useMutation({
    mutationFn: () => completeEvent(societyId, eventId),
    onSuccess: () => {
      toast.success("Event marked as completed!");
      setCompleteConfirm(false);
      invalidateEvent();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteEvent(societyId, eventId),
    onSuccess: () => {
      toast.success("Event deleted.");
      router.push("/admin/events");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const cancelMutation = useMutation({
    mutationFn: (data: CancelEventInput) => cancelEvent(societyId, eventId, data),
    onSuccess: () => {
      toast.success("Event cancelled.");
      setCancelDialog(false);
      cancelForm.reset();
      invalidateEvent();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const triggerMutation = useMutation({
    mutationFn: (data: TriggerPaymentInput) => triggerPayment(societyId, eventId, data),
    onSuccess: (res) => {
      toast.success(`Payment triggered! ${res.transitionedCount} residents notified.`);
      setTriggerPaymentDialog(false);
      triggerForm.reset();
      invalidateEvent();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const paymentMutation = useMutation({
    mutationFn: (data: RecordEventPaymentInput) =>
      recordEventPayment(societyId, eventId, paymentDialog.registration!.id, data),
    onSuccess: () => {
      toast.success("Payment recorded!");
      setPaymentDialog({ open: false, registration: null });
      paymentForm.reset({
        amount: 0,
        paymentMode: "CASH",
        paymentDate: new Date().toISOString().split("T")[0],
        referenceNo: "",
        notes: "",
      });
      invalidateEvent();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addExpenseMutation = useMutation({
    mutationFn: (data: AddEventExpenseInput) => addEventExpense(societyId, eventId, data),
    onSuccess: () => {
      toast.success("Expense added!");
      setAddExpenseDialog(false);
      expenseForm.reset({
        date: new Date().toISOString().split("T")[0],
        amount: 0,
        category: "OTHER",
        description: "",
        receiptUrl: null,
      });
      invalidateEvent();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const settleMutation = useMutation({
    mutationFn: (data: SettleEventInput) => settleEvent(societyId, eventId, data),
    onSuccess: () => {
      toast.success("Event settled!");
      setSettleDialog(false);
      settleForm.reset();
      setSurplusDisposal("");
      setDeficitDisposition("");
      invalidateEvent();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateEventInput) => updateEvent(societyId, eventId, data),
    onSuccess: () => {
      toast.success("Event updated!");
      setEditDialog(false);
      editForm.reset();
      invalidateEvent();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Helpers ──
  function openPaymentDialog(reg: EventRegistration) {
    const amount = event ? computeAmountDue(event, reg) : 0;
    paymentForm.reset({
      amount,
      paymentMode: "CASH",
      paymentDate: new Date().toISOString().split("T")[0],
      referenceNo: "",
      notes: "",
    });
    setPaymentDialog({ open: true, registration: reg });
  }

  function openEditDialog(ev: CommunityEvent) {
    editForm.reset({
      title: ev.title,
      description: ev.description ?? undefined,
      category: ev.category as UpdateEventInput["category"],
      feeModel: ev.feeModel as UpdateEventInput["feeModel"],
      chargeUnit: ev.chargeUnit as UpdateEventInput["chargeUnit"],
      eventDate: ev.eventDate.split("T")[0],
      location: ev.location ?? undefined,
      registrationDeadline: ev.registrationDeadline
        ? ev.registrationDeadline.split("T")[0]
        : undefined,
      feeAmount: ev.feeAmount ?? undefined,
      estimatedBudget: ev.estimatedBudget ?? undefined,
      minParticipants: ev.minParticipants ?? undefined,
      maxParticipants: ev.maxParticipants ?? undefined,
      suggestedAmount: ev.suggestedAmount ?? undefined,
    });
    setEditDialog(true);
  }

  function handleSettle(data: SettleEventInput) {
    const net = finances ? finances.totalCollected - finances.totalExpenses : 0;
    const payload: SettleEventInput = {
      ...data,
      surplusDisposal:
        net > 0 && surplusDisposal
          ? (surplusDisposal as SettleEventInput["surplusDisposal"])
          : null,
      deficitDisposition:
        net < 0 && deficitDisposition
          ? (deficitDisposition as SettleEventInput["deficitDisposition"])
          : null,
    };
    settleMutation.mutate(payload);
  }

  // ── Computed values ──
  const watchedPaymentMode = useWatch({ control: paymentForm.control, name: "paymentMode" });
  const watchedFeeAmount = useWatch({ control: triggerForm.control, name: "feeAmount" }) ?? 0;

  const isFlexibleNoFee = event?.feeModel === "FLEXIBLE" && event.feeAmount == null;

  const interestedCount = registrations.length;
  const interestedHouseholds = new Set(registrations.map((r) => r.user?.email ?? r.userId)).size;

  const paidCount = registrations.filter((r) => r.payment != null).length;
  const totalCount = registrations.length;
  const totalCollectedFromRegs = registrations.reduce(
    (sum, r) => sum + (r.payment ? Number(r.payment.amount) : 0),
    0,
  );

  const estimatedPerPerson =
    isFlexibleNoFee && event?.estimatedBudget && interestedCount > 0
      ? Math.ceil(Number(event.estimatedBudget) / interestedCount)
      : null;

  const expectedTotalFromTrigger =
    watchedFeeAmount && interestedCount > 0
      ? event?.chargeUnit === "PER_PERSON"
        ? watchedFeeAmount * registrations.reduce((s, r) => s + r.memberCount, 0)
        : watchedFeeAmount * interestedCount
      : 0;

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="py-24 text-center">
        <p className="text-muted-foreground">Event not found.</p>
        <Button variant="ghost" className="mt-4" onClick={() => router.push("/admin/events")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Events
        </Button>
      </div>
    );
  }

  // ── Finances derived ──
  const net = finances ? finances.totalCollected - finances.totalExpenses : 0;
  const expensesChangedSinceSettlement =
    finances?.isSettled &&
    event.settledAt &&
    finances.expenses.some((e) => new Date(e.date) > new Date(event.settledAt!));

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => router.push("/admin/events")} className="gap-1">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">{event.title}</h1>
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <span>{formatDate(event.eventDate)}</span>
              {event.location && <span>{event.location}</span>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={event.status} />
              <FeeModelBadge model={event.feeModel} />
              {event.feeModel !== "FREE" && event.chargeUnit && (
                <ChargeUnitBadge unit={event.chargeUnit} />
              )}
              {event.feeAmount != null && (
                <Badge variant="secondary">{formatCurrency(event.feeAmount)}</Badge>
              )}
              <Badge variant="secondary">
                {EVENT_CATEGORY_LABELS[event.category] ?? event.category}
              </Badge>
            </div>
          </div>

          {/* ── Action Buttons ── */}
          <div className="flex flex-wrap items-center gap-2">
            {event.status === "DRAFT" && (
              <>
                <Button variant="outline" size="sm" onClick={() => openEditDialog(event)}>
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive border-red-200 hover:bg-red-50"
                  onClick={() => setDeleteConfirm(true)}
                >
                  Delete
                </Button>
                <Button size="sm" onClick={() => setPublishConfirm(true)}>
                  Publish
                </Button>
              </>
            )}
            {event.status === "PUBLISHED" && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive border-red-200 hover:bg-red-50"
                  onClick={() => setCancelDialog(true)}
                >
                  Cancel Event
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCompleteConfirm(true)}>
                  Mark Complete
                </Button>
                {isFlexibleNoFee && (
                  <Button size="sm" onClick={() => setTriggerPaymentDialog(true)}>
                    <IndianRupee className="mr-1 h-4 w-4" />
                    Set Price & Trigger Payment
                  </Button>
                )}
              </>
            )}
            {event.status === "COMPLETED" && (
              <Button size="sm" onClick={() => setSettleDialog(true)}>
                <IndianRupee className="mr-1 h-4 w-4" />
                {finances?.isSettled ? "Re-settle" : "Settle Event"}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="registrations">
        <TabsList>
          <TabsTrigger value="registrations">
            <Users className="mr-1 h-4 w-4" />
            Registrations
          </TabsTrigger>
          <TabsTrigger value="finances">
            <IndianRupee className="mr-1 h-4 w-4" />
            Finances
          </TabsTrigger>
          <TabsTrigger value="details">
            <Info className="mr-1 h-4 w-4" />
            Details
          </TabsTrigger>
        </TabsList>

        {/* ── Registrations Tab ── */}
        <TabsContent value="registrations" className="space-y-4 pt-4">
          {/* FLEXIBLE with no fee set — polling phase */}
          {isFlexibleNoFee ? (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Interest Poll</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Users className="text-muted-foreground h-5 w-5" />
                    <p className="text-sm">
                      <span className="text-lg font-bold">{interestedCount}</span> people interested
                      from <span className="font-semibold">{interestedHouseholds}</span> households
                    </p>
                  </div>
                  {event.minParticipants && (
                    <div className="space-y-1">
                      <div className="text-muted-foreground flex justify-between text-xs">
                        <span>Progress toward minimum</span>
                        <span>
                          {interestedCount} / {event.minParticipants}
                        </span>
                      </div>
                      <Progress
                        value={Math.min(100, (interestedCount / event.minParticipants) * 100)}
                      />
                    </div>
                  )}
                  {estimatedPerPerson != null && (
                    <p className="text-muted-foreground text-sm">
                      Estimated per person:{" "}
                      <span className="font-semibold text-orange-700">
                        {formatCurrency(estimatedPerPerson)}
                      </span>{" "}
                      (based on budget ÷ interested)
                    </p>
                  )}
                  <Button onClick={() => setTriggerPaymentDialog(true)}>
                    <IndianRupee className="mr-1 h-4 w-4" />
                    Set Price & Trigger Payment
                  </Button>
                </CardContent>
              </Card>

              {/* Interest list */}
              {registrations.length > 0 && (
                <RegistrationsTable
                  event={event}
                  registrations={registrations}
                  showPaymentAction={false}
                  onRecordPayment={openPaymentDialog}
                />
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {/* Paid progress for FIXED / FLEXIBLE after trigger / CONTRIBUTION */}
              {event.feeModel !== "FREE" && event.feeAmount != null && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">Collection Progress</p>
                        <p className="text-muted-foreground text-sm">
                          Paid: {paidCount}/{totalCount} people &middot;{" "}
                          {formatCurrency(totalCollectedFromRegs)} collected
                        </p>
                      </div>
                      <Progress value={totalCount > 0 ? (paidCount / totalCount) * 100 : 0} />
                    </div>
                  </CardContent>
                </Card>
              )}

              {registrations.length > 0 ? (
                <RegistrationsTable
                  event={event}
                  registrations={registrations}
                  showPaymentAction={event.feeModel !== "FREE" && event.feeAmount != null}
                  onRecordPayment={openPaymentDialog}
                />
              ) : (
                <Card>
                  <CardContent className="text-muted-foreground py-8 text-center">
                    No registrations yet.
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* ── Finances Tab ── */}
        <TabsContent value="finances" className="space-y-4 pt-4">
          {event.feeModel === "FREE" ? (
            <Card>
              <CardContent className="text-muted-foreground py-8 text-center">
                This is a free event — no financial tracking required.
              </CardContent>
            </Card>
          ) : finances ? (
            <FinancesPanel
              event={event}
              finances={finances}
              net={net}
              expensesChangedSinceSettlement={!!expensesChangedSinceSettlement}
              onAddExpense={() => setAddExpenseDialog(true)}
              onSettle={() => setSettleDialog(true)}
            />
          ) : (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
            </div>
          )}
        </TabsContent>

        {/* ── Details Tab ── */}
        <TabsContent value="details" className="space-y-4 pt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Event Details</CardTitle>
              {event.status === "DRAFT" && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEditDialog(event)}>
                    Edit
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive border-red-200 hover:bg-red-50"
                    onClick={() => setDeleteConfirm(true)}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <DetailRow label="Title" value={event.title} />
              <DetailRow
                label="Category"
                value={EVENT_CATEGORY_LABELS[event.category] ?? event.category}
              />
              <DetailRow label="Event Date" value={formatDate(event.eventDate)} />
              {event.location && <DetailRow label="Location" value={event.location} />}
              {event.registrationDeadline && (
                <DetailRow
                  label="Registration Deadline"
                  value={formatDate(event.registrationDeadline)}
                />
              )}
              <DetailRow label="Fee Model" value={event.feeModel} />
              {event.feeModel !== "FREE" && event.chargeUnit && (
                <DetailRow
                  label="Charge Unit"
                  value={event.chargeUnit === "PER_PERSON" ? "Per Person" : "Per Household"}
                />
              )}
              {event.feeAmount != null && (
                <DetailRow label="Fee Amount" value={formatCurrency(event.feeAmount)} />
              )}
              {event.estimatedBudget != null && (
                <DetailRow label="Estimated Budget" value={formatCurrency(event.estimatedBudget)} />
              )}
              {event.suggestedAmount != null && (
                <DetailRow label="Suggested Amount" value={formatCurrency(event.suggestedAmount)} />
              )}
              {event.minParticipants != null && (
                <DetailRow label="Min Participants" value={String(event.minParticipants)} />
              )}
              {event.maxParticipants != null && (
                <DetailRow label="Max Participants" value={String(event.maxParticipants)} />
              )}
              <DetailRow label="Status" value={event.status} />
              <DetailRow label="Created By" value={event.creator.name} />
              <DetailRow label="Created At" value={formatDate(event.createdAt)} />
              {event.publishedAt && (
                <DetailRow label="Published At" value={formatDate(event.publishedAt)} />
              )}
              {event.paymentTriggeredAt && (
                <DetailRow
                  label="Payment Triggered At"
                  value={formatDate(event.paymentTriggeredAt)}
                />
              )}
              {event.cancellationReason && (
                <div className="sm:col-span-2">
                  <DetailRow label="Cancellation Reason" value={event.cancellationReason} />
                </div>
              )}
              {event.description && (
                <div className="sm:col-span-2">
                  <p className="text-muted-foreground text-sm">Description</p>
                  <p className="mt-0.5 text-sm">{event.description}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ═══════════════════════ DIALOGS ═══════════════════════ */}

      {/* Publish Confirm */}
      <Dialog open={publishConfirm} onOpenChange={setPublishConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Publish Event</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            This will make the event visible to all residents. They can register once it&apos;s
            published.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={() => publishMutation.mutate()} disabled={publishMutation.isPending}>
              {publishMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Publish
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Confirm */}
      <Dialog open={completeConfirm} onOpenChange={setCompleteConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Mark Event as Completed</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            This will mark the event as completed. You can then record final expenses and settle
            finances.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompleteConfirm(false)}>
              Cancel
            </Button>
            <Button onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending}>
              {completeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Mark Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={deleteConfirm} onOpenChange={setDeleteConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Event</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Are you sure you want to delete <span className="font-semibold">{event.title}</span>?
            This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Event Dialog */}
      <Dialog
        open={cancelDialog}
        onOpenChange={(open) => {
          if (!open) {
            setCancelDialog(false);
            cancelForm.reset();
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel Event</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={cancelForm.handleSubmit((data) => cancelMutation.mutate(data))}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>
                Reason for cancellation <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Explain why the event is being cancelled"
                aria-invalid={!!cancelForm.formState.errors.reason}
                {...cancelForm.register("reason")}
              />
              {cancelForm.formState.errors.reason && (
                <p className="text-destructive text-sm">
                  {cancelForm.formState.errors.reason.message}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCancelDialog(false);
                  cancelForm.reset();
                }}
              >
                Back
              </Button>
              <Button type="submit" variant="destructive" disabled={cancelMutation.isPending}>
                {cancelMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Cancel Event
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Trigger Payment Dialog */}
      <Dialog
        open={triggerPaymentDialog}
        onOpenChange={(open) => {
          if (!open) {
            setTriggerPaymentDialog(false);
            triggerForm.reset();
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Set Price & Trigger Payment</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={triggerForm.handleSubmit((data) => triggerMutation.mutate(data))}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>
                Fee Amount (₹) {event.chargeUnit === "PER_PERSON" ? "per person" : "per household"}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                min={1}
                aria-invalid={!!triggerForm.formState.errors.feeAmount}
                {...triggerForm.register("feeAmount", { valueAsNumber: true })}
              />
              {triggerForm.formState.errors.feeAmount && (
                <p className="text-destructive text-sm">
                  {triggerForm.formState.errors.feeAmount.message}
                </p>
              )}
            </div>
            {watchedFeeAmount > 0 && (
              <div className="bg-muted/40 space-y-1 rounded-md border px-4 py-3 text-sm">
                <p className="text-muted-foreground">
                  This will notify{" "}
                  <span className="text-foreground font-semibold">{interestedCount}</span>{" "}
                  residents.
                </p>
                <p className="text-muted-foreground">
                  Total expected collection:{" "}
                  <span className="text-foreground font-semibold">
                    {formatCurrency(expectedTotalFromTrigger)}
                  </span>
                </p>
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setTriggerPaymentDialog(false);
                  triggerForm.reset();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={triggerMutation.isPending}>
                {triggerMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm &amp; Trigger
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog
        open={paymentDialog.open}
        onOpenChange={(open) => {
          if (!open) setPaymentDialog({ open: false, registration: null });
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          {paymentDialog.registration && (
            <form
              onSubmit={paymentForm.handleSubmit((data) => paymentMutation.mutate(data))}
              className="space-y-4"
            >
              {/* Resident info */}
              <div className="bg-muted/40 space-y-1 rounded-md border px-4 py-3 text-sm">
                <p className="font-medium">{paymentDialog.registration.user.name}</p>
                <p className="text-muted-foreground">
                  Members: {paymentDialog.registration.memberCount}
                </p>
                {event.feeAmount != null && (
                  <p className="text-muted-foreground">
                    Amount due:{" "}
                    <span className="text-foreground font-semibold">
                      {formatCurrency(computeAmountDue(event, paymentDialog.registration))}
                    </span>
                  </p>
                )}
              </div>

              {/* Amount field */}
              <div className="space-y-2">
                <Label>
                  Amount (₹) <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  min={1}
                  readOnly={event.feeModel !== "CONTRIBUTION"}
                  aria-invalid={!!paymentForm.formState.errors.amount}
                  {...paymentForm.register("amount", { valueAsNumber: true })}
                />
                {paymentForm.formState.errors.amount && (
                  <p className="text-destructive text-sm">
                    {paymentForm.formState.errors.amount.message}
                  </p>
                )}
              </div>

              {/* Payment mode */}
              <div className="space-y-2">
                <Label>
                  Payment Mode <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={watchedPaymentMode}
                  onValueChange={(v) =>
                    paymentForm.setValue("paymentMode", v as RecordEventPaymentInput["paymentMode"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_MODE_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Reference number — required for UPI / Bank Transfer */}
              {(watchedPaymentMode === "UPI" || watchedPaymentMode === "BANK_TRANSFER") && (
                <div className="space-y-2">
                  <Label>
                    Reference No. <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="Transaction ID"
                    aria-invalid={!!paymentForm.formState.errors.referenceNo}
                    {...paymentForm.register("referenceNo")}
                  />
                  {paymentForm.formState.errors.referenceNo && (
                    <p className="text-destructive text-sm">
                      {paymentForm.formState.errors.referenceNo.message}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label>
                  Payment Date <span className="text-destructive">*</span>
                </Label>
                <Input type="date" {...paymentForm.register("paymentDate")} />
              </div>

              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Input placeholder="Any additional notes" {...paymentForm.register("notes")} />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPaymentDialog({ open: false, registration: null })}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={paymentMutation.isPending}>
                  {paymentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Record Payment
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Expense Dialog */}
      <Dialog
        open={addExpenseDialog}
        onOpenChange={(open) => {
          if (!open) {
            setAddExpenseDialog(false);
            expenseForm.reset({
              date: new Date().toISOString().split("T")[0],
              amount: 0,
              category: "OTHER",
              description: "",
              receiptUrl: null,
            });
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Event Expense</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={expenseForm.handleSubmit((data) => addExpenseMutation.mutate(data))}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  Date <span className="text-destructive">*</span>
                </Label>
                <Input type="date" {...expenseForm.register("date")} />
              </div>
              <div className="space-y-2">
                <Label>
                  Amount (₹) <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  min={1}
                  aria-invalid={!!expenseForm.formState.errors.amount}
                  {...expenseForm.register("amount", { valueAsNumber: true })}
                />
                {expenseForm.formState.errors.amount && (
                  <p className="text-destructive text-sm">
                    {expenseForm.formState.errors.amount.message}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                Category <span className="text-destructive">*</span>
              </Label>
              <Select
                value={watchedExpenseCategory}
                onValueChange={(v) =>
                  expenseForm.setValue("category", v as AddEventExpenseInput["category"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {EXPENSE_CATEGORY_LABELS[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                Description <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="What was this expense for?"
                aria-invalid={!!expenseForm.formState.errors.description}
                {...expenseForm.register("description")}
              />
              {expenseForm.formState.errors.description && (
                <p className="text-destructive text-sm">
                  {expenseForm.formState.errors.description.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Receipt URL (optional)</Label>
              <Input type="url" placeholder="https://..." {...expenseForm.register("receiptUrl")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setAddExpenseDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={addExpenseMutation.isPending}>
                {addExpenseMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Expense
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Settle Event Dialog */}
      <Dialog
        open={settleDialog}
        onOpenChange={(open) => {
          if (!open) {
            setSettleDialog(false);
            settleForm.reset();
            setSurplusDisposal("");
            setDeficitDisposition("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{finances?.isSettled ? "Re-settle Event" : "Settle Event"}</DialogTitle>
          </DialogHeader>
          {finances && (
            <form onSubmit={settleForm.handleSubmit(handleSettle)} className="space-y-4">
              {/* Summary */}
              <div className="bg-muted/40 space-y-2 rounded-md border px-4 py-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Collected</span>
                  <span className="font-medium">{formatCurrency(finances.totalCollected)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Expenses</span>
                  <span className="font-medium">{formatCurrency(finances.totalExpenses)}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="font-medium">{net >= 0 ? "Surplus" : "Deficit"}</span>
                  <span className={`font-bold ${net >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {net >= 0 ? "+" : ""}
                    {formatCurrency(Math.abs(net))}
                  </span>
                </div>
              </div>

              {/* Surplus disposal */}
              {net > 0 && (
                <div className="space-y-2">
                  <Label>
                    Surplus Disposal <span className="text-destructive">*</span>
                  </Label>
                  <div className="space-y-2">
                    {(
                      [
                        { value: "TRANSFERRED_TO_FUND", label: "Transfer to Society Fund" },
                        { value: "CARRIED_FORWARD", label: "Carry Forward to Next Event" },
                        { value: "REFUNDED", label: "Refund to Participants" },
                      ] as const
                    ).map((opt) => (
                      <label
                        key={opt.value}
                        className="flex cursor-pointer items-center gap-2 text-sm"
                      >
                        <input
                          type="radio"
                          name="surplusDisposal"
                          value={opt.value}
                          checked={surplusDisposal === opt.value}
                          onChange={(e) => setSurplusDisposal(e.target.value)}
                          className="accent-primary"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Deficit disposition */}
              {net < 0 && (
                <div className="space-y-2">
                  <Label>
                    Deficit Disposition <span className="text-destructive">*</span>
                  </Label>
                  <div className="space-y-2">
                    {(
                      [
                        { value: "FROM_SOCIETY_FUND", label: "Cover from Society Fund" },
                        {
                          value: "ADDITIONAL_COLLECTION",
                          label: "Collect additional from participants",
                        },
                      ] as const
                    ).map((opt) => (
                      <label
                        key={opt.value}
                        className="flex cursor-pointer items-center gap-2 text-sm"
                      >
                        <input
                          type="radio"
                          name="deficitDisposition"
                          value={opt.value}
                          checked={deficitDisposition === opt.value}
                          onChange={(e) => setDeficitDisposition(e.target.value)}
                          className="accent-primary"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {net === 0 && (
                <p className="text-sm font-medium text-green-600">
                  <Check className="mr-1 inline h-4 w-4" />
                  Balanced: ₹0 surplus or deficit
                </p>
              )}

              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Input placeholder="Settlement notes" {...settleForm.register("notes")} />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setSettleDialog(false);
                    settleForm.reset();
                    setSurplusDisposal("");
                    setDeficitDisposition("");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    settleMutation.isPending ||
                    (net > 0 && !surplusDisposal) ||
                    (net < 0 && !deficitDisposition)
                  }
                >
                  {settleMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirm Settlement
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Event Dialog (DRAFT only) */}
      <Dialog
        open={editDialog}
        onOpenChange={(open) => {
          if (!open) {
            setEditDialog(false);
            editForm.reset();
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Event</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={editForm.handleSubmit((data) => updateMutation.mutate(data))}
            className="max-h-[70vh] space-y-4 overflow-y-auto pr-1"
          >
            <div className="space-y-2">
              <Label>
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                aria-invalid={!!editForm.formState.errors.title}
                {...editForm.register("title")}
              />
              {editForm.formState.errors.title && (
                <p className="text-destructive text-sm">
                  {editForm.formState.errors.title.message}
                </p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={watchedEditCategory}
                  onValueChange={(v) =>
                    editForm.setValue("category", v as UpdateEventInput["category"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EVENT_CATEGORY_LABELS).map(([val, label]) => (
                      <SelectItem key={val} value={val}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  Event Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="date"
                  aria-invalid={!!editForm.formState.errors.eventDate}
                  {...editForm.register("eventDate")}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input {...editForm.register("location")} />
            </div>
            <div className="space-y-2">
              <Label>Registration Deadline</Label>
              <Input type="date" {...editForm.register("registrationDeadline")} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Fee Model</Label>
                <Select
                  value={watchedEditFeeModel}
                  onValueChange={(v) =>
                    editForm.setValue("feeModel", v as UpdateEventInput["feeModel"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FREE">Free</SelectItem>
                    <SelectItem value="FIXED">Fixed</SelectItem>
                    <SelectItem value="FLEXIBLE">Flexible</SelectItem>
                    <SelectItem value="CONTRIBUTION">Contribution</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Charge Unit</Label>
                <Select
                  value={watchedEditChargeUnit}
                  onValueChange={(v) =>
                    editForm.setValue("chargeUnit", v as UpdateEventInput["chargeUnit"])
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PER_PERSON">Per Person</SelectItem>
                    <SelectItem value="PER_HOUSEHOLD">Per Household</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Fee Amount (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  {...editForm.register("feeAmount", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label>Estimated Budget (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  {...editForm.register("estimatedBudget", { valueAsNumber: true })}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Min Participants</Label>
                <Input
                  type="number"
                  min={1}
                  {...editForm.register("minParticipants", { valueAsNumber: true })}
                />
              </div>
              <div className="space-y-2">
                <Label>Max Participants</Label>
                <Input
                  type="number"
                  min={1}
                  {...editForm.register("maxParticipants", { valueAsNumber: true })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input {...editForm.register("description")} />
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
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

interface RegistrationsTableProps {
  event: CommunityEvent;
  registrations: EventRegistration[];
  showPaymentAction: boolean;
  onRecordPayment: (reg: EventRegistration) => void;
}

function RegistrationsTable({
  event,
  registrations,
  showPaymentAction,
  onRecordPayment,
}: RegistrationsTableProps) {
  const isFree = event.feeModel === "FREE";
  const isContribution = event.feeModel === "CONTRIBUTION";

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="hidden sm:table-cell">Members</TableHead>
            {!isFree && <TableHead>{isContribution ? "Contributed" : "Due Amount"}</TableHead>}
            <TableHead>Status</TableHead>
            {showPaymentAction && <TableHead className="text-right">Action</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {registrations.map((reg) => {
            const amountDue =
              !isFree && event.feeAmount != null ? computeAmountDue(event, reg) : null;
            const contributed = reg.payment ? Number(reg.payment.amount) : null;
            const hasPaid = reg.payment != null;

            return (
              <TableRow key={reg.id}>
                <TableCell>
                  <p className="font-medium">{reg.user.name}</p>
                  <p className="text-muted-foreground text-xs">{reg.user.email}</p>
                </TableCell>
                <TableCell className="hidden sm:table-cell">{reg.memberCount}</TableCell>
                {!isFree && (
                  <TableCell>
                    {isContribution
                      ? contributed != null
                        ? `₹${contributed.toLocaleString("en-IN")}`
                        : "—"
                      : amountDue != null
                        ? `₹${amountDue.toLocaleString("en-IN")}`
                        : "—"}
                  </TableCell>
                )}
                <TableCell>
                  {isFree ? (
                    <Badge
                      variant="outline"
                      className="border-blue-200 bg-blue-50 text-xs text-blue-700"
                    >
                      <Check className="mr-1 h-3 w-3" />
                      Going
                    </Badge>
                  ) : (
                    <RegistrationStatusBadge status={hasPaid ? "PAID" : reg.status} />
                  )}
                </TableCell>
                {showPaymentAction && (
                  <TableCell className="text-right">
                    {!hasPaid && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8"
                        onClick={() => onRecordPayment(reg)}
                      >
                        {isContribution ? "Record Contribution" : "Record Payment"}
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

interface FinancesPanelProps {
  event: CommunityEvent;
  finances: EventFinanceSummary;
  net: number;
  expensesChangedSinceSettlement: boolean;
  onAddExpense: () => void;
  onSettle: () => void;
}

function FinancesPanel({
  event,
  finances,
  net,
  expensesChangedSinceSettlement,
  onAddExpense,
  onSettle,
}: FinancesPanelProps) {
  return (
    <div className="space-y-6">
      {/* Warning if expenses changed after settlement */}
      {expensesChangedSinceSettlement && (
        <div className="flex items-start gap-3 rounded-md border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Expenses changed since settlement</p>
            <p className="mt-0.5 text-xs">
              One or more expenses were added after the event was settled. Consider re-settling.
            </p>
          </div>
        </div>
      )}

      {/* Collection summary */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900/30">
                <IndianRupee className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Total Collected</p>
                <p className="text-2xl font-bold">
                  {`₹${finances.totalCollected.toLocaleString("en-IN")}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-yellow-100 p-2 dark:bg-yellow-900/30">
                <IndianRupee className="h-5 w-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Still Pending</p>
                <p className="text-2xl font-bold">
                  {`₹${finances.pendingAmount.toLocaleString("en-IN")}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expenses section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Event Expenses</CardTitle>
          {event.status !== "CANCELLED" && (
            <Button size="sm" variant="outline" onClick={onAddExpense}>
              <Plus className="mr-1 h-4 w-4" />
              Add Expense
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {finances.expenses.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Description</TableHead>
                    <TableHead className="hidden sm:table-cell">Category</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {finances.expenses.map((exp) => (
                    <TableRow key={exp.id}>
                      <TableCell className="font-medium">{exp.description}</TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Badge variant="secondary" className="text-xs">
                          {EXPENSE_CATEGORY_LABELS[exp.category] ?? exp.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(exp.date)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {`₹${Number(exp.amount).toLocaleString("en-IN")}`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-muted-foreground py-4 text-center text-sm">
              No expenses recorded yet.
            </p>
          )}

          {/* Totals */}
          <div className="space-y-1 border-t pt-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Expenses</span>
              <span className="font-medium">
                {`₹${finances.totalExpenses.toLocaleString("en-IN")}`}
              </span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span>{net >= 0 ? "Net Surplus" : "Net Deficit"}</span>
              <span className={net >= 0 ? "text-green-600" : "text-red-600"}>
                {net >= 0 ? "+" : ""}
                {`₹${Math.abs(net).toLocaleString("en-IN")}`}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settlement info */}
      {finances.isSettled && event.settledAt && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Check className="h-4 w-4 text-green-600" />
              Settlement Record
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <DetailRow label="Settled On" value={formatDate(event.settledAt)} />
            {finances.surplusDisposal && (
              <DetailRow
                label="Surplus Disposal"
                value={
                  finances.surplusDisposal === "TRANSFERRED_TO_FUND"
                    ? "Transferred to Fund"
                    : finances.surplusDisposal === "CARRIED_FORWARD"
                      ? "Carried Forward"
                      : "Refunded"
                }
              />
            )}
            {finances.deficitDisposition && (
              <DetailRow
                label="Deficit Disposition"
                value={
                  finances.deficitDisposition === "FROM_SOCIETY_FUND"
                    ? "From Society Fund"
                    : "Additional Collection"
                }
              />
            )}
            {finances.settlementNotes && (
              <div className="sm:col-span-2">
                <DetailRow label="Notes" value={finances.settlementNotes} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Settle / Re-settle CTA */}
      {event.status === "COMPLETED" && (
        <div className="flex justify-end">
          <Button onClick={onSettle}>
            <IndianRupee className="mr-1 h-4 w-4" />
            {finances.isSettled ? "Re-settle Event" : "Settle Event"}
          </Button>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground text-sm">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}
