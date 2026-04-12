"use client";

import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  CalendarDays,
  CalendarX,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Minus,
  Plus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import {
  cancelRegistration,
  getResidentEventFinances,
  getResidentEvents,
  registerForEvent,
} from "@/services/events";
import type { ResidentCommunityEvent } from "@/services/events";

// ── Constants ──

const FEE_MODEL_LABELS: Record<string, string> = {
  FREE: "Free",
  FIXED: "Fixed",
  FLEXIBLE: "Flexible",
  CONTRIBUTION: "Contribution",
};

const CATEGORY_LABELS: Record<string, string> = {
  FESTIVAL: "Festival",
  SPORTS: "Sports",
  WORKSHOP: "Workshop",
  CULTURAL: "Cultural",
  MEETING: "Meeting",
  OTHER: "Other",
};

const DISPOSAL_LABELS: Record<string, string> = {
  REFUNDED: "Refunded to participants",
  TRANSFERRED_TO_FUND: "Transferred to society fund",
  CARRIED_FORWARD: "Carried forward",
  FROM_SOCIETY_FUND: "Covered by society fund",
  ADDITIONAL_COLLECTION: "Additional collection",
};

// ── Helpers ──

function getFeeDisplay(event: ResidentCommunityEvent): string {
  const { feeModel, feeAmount, chargeUnit, suggestedAmount } = event;
  const unit = chargeUnit === "PER_PERSON" ? "person" : "household";

  if (feeModel === "FREE") return "Free Event";
  if (feeModel === "FIXED" && feeAmount != null) {
    return `₹${feeAmount.toLocaleString("en-IN")}/${unit}`;
  }
  if (feeModel === "FLEXIBLE") {
    if (feeAmount == null) return "Interest check — pricing TBD";
    return `₹${feeAmount.toLocaleString("en-IN")}/${unit}`;
  }
  if (feeModel === "CONTRIBUTION") {
    if (suggestedAmount != null) {
      return `Open contribution (suggested ₹${suggestedAmount.toLocaleString("en-IN")})`;
    }
    return "Open contribution";
  }
  return "";
}

function getAmountDue(event: ResidentCommunityEvent, memberCount: number): number | null {
  const { feeModel, feeAmount, chargeUnit } = event;
  if (feeModel === "FREE" || feeModel === "CONTRIBUTION" || feeAmount == null) return null;
  return chargeUnit === "PER_PERSON" ? feeAmount * memberCount : feeAmount;
}

function isRegistrationOpen(event: ResidentCommunityEvent): boolean {
  if (event.status !== "PUBLISHED") return false;
  if (event.registrationDeadline && new Date(event.registrationDeadline) < new Date()) return false;
  return true;
}

function isEventFull(event: ResidentCommunityEvent): boolean {
  if (!event.maxParticipants || !event._count) return false;
  return event._count.registrations >= event.maxParticipants;
}

function getCardRegistrationBadge(event: ResidentCommunityEvent) {
  const reg = event.myRegistration;
  if (!reg || reg.status === "CANCELLED") return null;

  const classMap: Record<string, string> = {
    CONFIRMED: "bg-green-50 text-green-700 border-green-200",
    PENDING: "bg-amber-50 text-amber-700 border-amber-200",
    INTERESTED: "bg-blue-50 text-blue-700 border-blue-200",
  };
  const labelMap: Record<string, string> = {
    CONFIRMED: "Going ✓",
    PENDING: "Payment due",
    INTERESTED: "Interested",
  };

  return (
    <Badge variant="secondary" className={classMap[reg.status] ?? ""}>
      {labelMap[reg.status] ?? reg.status}
    </Badge>
  );
}

// ── Sub-components ──

interface ActionButtonProps {
  event: ResidentCommunityEvent;
  memberCount: number;
  setMemberCount: (n: number) => void;
  onRegister: (eventId: string, memberCount: number) => void;
  onCancel: (eventId: string) => void;
  isRegistering: boolean;
  isCancelling: boolean;
}

function RegistrationAction({
  event,
  memberCount,
  setMemberCount,
  onRegister,
  onCancel,
  isRegistering,
  isCancelling,
}: ActionButtonProps) {
  const { myRegistration, feeModel, chargeUnit, paymentTriggeredAt } = event;
  const reg = myRegistration;

  // Already registered (non-cancelled)
  if (reg && reg.status !== "CANCELLED") {
    if (reg.status === "CONFIRMED") {
      return (
        <div className="flex items-center gap-2 text-green-600">
          <CheckCircle2 className="h-5 w-5" />
          <span className="font-medium">
            {feeModel === "CONTRIBUTION" ? "Participating ✓" : "Going ✓"}
          </span>
        </div>
      );
    }

    if (reg.status === "INTERESTED") {
      return (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-blue-600">
            <Clock className="h-4 w-4" />
            <span className="text-sm font-medium">
              You&apos;re interested ({reg.memberCount} member
              {reg.memberCount > 1 ? "s" : ""})
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-destructive/30 text-destructive hover:bg-destructive/5 w-full"
            disabled={isCancelling}
            onClick={() => onCancel(event.id)}
          >
            {isCancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Cancel Interest
          </Button>
        </div>
      );
    }

    if (reg.status === "PENDING") {
      const amtDue = getAmountDue(event, reg.memberCount);
      return (
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-medium text-amber-800">Payment Required</p>
            {amtDue != null && (
              <p className="mt-1 text-lg font-bold text-amber-900">
                ₹{amtDue.toLocaleString("en-IN")}{" "}
                <span className="text-sm font-normal">
                  ({reg.memberCount} member{reg.memberCount > 1 ? "s" : ""})
                </span>
              </p>
            )}
            <p className="mt-1 text-xs text-amber-700">
              Pay admin and they&apos;ll record your payment.
            </p>
          </div>
          {!reg.payment && (
            <Button
              variant="outline"
              size="sm"
              className="border-destructive/30 text-destructive hover:bg-destructive/5 w-full"
              disabled={isCancelling}
              onClick={() => onCancel(event.id)}
            >
              {isCancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cancel Registration
            </Button>
          )}
        </div>
      );
    }
  }

  // Not registered (or cancelled)
  if (event.status === "COMPLETED") {
    return <p className="text-muted-foreground text-sm">This event has ended.</p>;
  }

  if (!isRegistrationOpen(event)) {
    const deadlinePassed =
      event.registrationDeadline && new Date(event.registrationDeadline) < new Date();
    return (
      <p className="text-muted-foreground text-sm">
        {deadlinePassed ? "Registration closed" : "Registration not open"}
      </p>
    );
  }

  if (isEventFull(event)) {
    return <p className="text-destructive text-sm font-medium">Event full</p>;
  }

  const showMemberSelector = chargeUnit === "PER_PERSON";
  const amtDue = getAmountDue(event, memberCount);

  const buttonLabel =
    feeModel === "FREE"
      ? "I'm In"
      : feeModel === "FLEXIBLE" && !paymentTriggeredAt
        ? "I'm Interested"
        : feeModel === "CONTRIBUTION"
          ? "I'm Participating"
          : amtDue != null
            ? `Register (₹${amtDue.toLocaleString("en-IN")})`
            : "Register";

  return (
    <div className="space-y-4">
      {showMemberSelector && (
        <div className="space-y-2">
          <p className="text-sm font-medium">How many family members?</p>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setMemberCount(Math.max(1, memberCount - 1))}
              disabled={memberCount <= 1}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-8 text-center text-lg font-bold">{memberCount}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setMemberCount(Math.min(10, memberCount + 1))}
              disabled={memberCount >= 10}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          {amtDue != null && event.feeAmount != null && (
            <p className="text-muted-foreground text-sm">
              {memberCount} × ₹{event.feeAmount.toLocaleString("en-IN")} = ₹
              {amtDue.toLocaleString("en-IN")}
            </p>
          )}
        </div>
      )}
      <Button
        className="w-full"
        disabled={isRegistering}
        onClick={() => onRegister(event.id, memberCount)}
      >
        {isRegistering && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {buttonLabel}
      </Button>
    </div>
  );
}

// ── Main Page ──

export default function ResidentEventsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showAll, setShowAll] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ResidentCommunityEvent | null>(null);
  const [memberCount, setMemberCount] = useState(1);

  // ── Queries ──

  const { data, isLoading } = useQuery({
    queryKey: ["resident-events", showAll],
    queryFn: () => getResidentEvents(showAll ? { all: true } : { upcoming: true }),
    enabled: !!user,
  });

  const events = data?.data ?? [];

  const isSettledCompleted =
    !!selectedEvent && selectedEvent.status === "COMPLETED" && !!selectedEvent.settledAt;

  const { data: finances, isLoading: financesLoading } = useQuery({
    queryKey: ["resident-event-finances", selectedEvent?.id],
    queryFn: () => getResidentEventFinances(selectedEvent!.id),
    enabled: isSettledCompleted,
  });

  // ── Mutations ──

  const registerMutation = useMutation({
    mutationFn: ({ eventId, count }: { eventId: string; count: number }) =>
      registerForEvent(eventId, { memberCount: count }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["resident-events"] });
      toast.success("Registered successfully!");
      setSelectedEvent(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (eventId: string) => cancelRegistration(eventId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["resident-events"] });
      toast.success("Registration cancelled");
      setSelectedEvent(null);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // ── Handlers ──

  const handleSelectEvent = (event: ResidentCommunityEvent) => {
    setSelectedEvent(event);
    setMemberCount(1);
  };

  const handleSheetOpenChange = (open: boolean) => {
    if (!open) setSelectedEvent(null);
  };

  // ── Render ──

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Community Events</h1>
        <Button variant="outline" size="sm" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Upcoming only" : "View all"}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="text-muted-foreground h-8 w-8" />}
          title="No events"
          description={showAll ? "No events to display." : "No upcoming events at the moment."}
        />
      ) : (
        <div className="bg-card divide-y rounded-xl border shadow-sm">
          {events.map((event) => {
            const eventDate = new Date(event.eventDate);
            const regBadge = getCardRegistrationBadge(event);
            return (
              <button
                key={event.id}
                type="button"
                className="hover:bg-muted/40 flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors sm:px-5"
                onClick={() => handleSelectEvent(event)}
              >
                {/* Date block */}
                <div className="bg-primary/8 border-primary/20 flex w-12 shrink-0 flex-col items-center rounded-lg border py-2">
                  <span className="text-primary text-xs font-semibold uppercase">
                    {format(eventDate, "MMM")}
                  </span>
                  <span className="text-primary text-xl leading-tight font-bold">
                    {format(eventDate, "d")}
                  </span>
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                    <span className="text-sm leading-tight font-semibold">{event.title}</span>
                    <Badge variant="outline" className="shrink-0 text-[10px] leading-tight">
                      {CATEGORY_LABELS[event.category] ?? event.category}
                    </Badge>
                  </div>

                  <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                    {event.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {event.location}
                      </span>
                    )}
                    <span className="text-primary font-medium">{getFeeDisplay(event)}</span>
                  </div>

                  {(regBadge || event.status === "COMPLETED") && (
                    <div className="mt-1.5 flex items-center gap-2">
                      {regBadge}
                      {event.status === "COMPLETED" && event.settledAt && (
                        <span className="text-primary text-xs font-medium">View summary →</span>
                      )}
                      {event.status === "COMPLETED" && !event.settledAt && (
                        <Badge variant="secondary" className="text-[10px]">
                          Completed
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Event Detail Sheet ── */}
      <Sheet open={!!selectedEvent} onOpenChange={handleSheetOpenChange}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          {selectedEvent && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle>{selectedEvent.title}</SheetTitle>
              </SheetHeader>

              <div className="space-y-4">
                {/* Meta */}
                <div className="text-muted-foreground space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 shrink-0" />
                    {format(new Date(selectedEvent.eventDate), "dd MMM yyyy, h:mm a")}
                  </div>
                  {selectedEvent.location && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 shrink-0" />
                      {selectedEvent.location}
                    </div>
                  )}
                  {selectedEvent._count && (
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 shrink-0" />
                      {selectedEvent._count.registrations} registered
                    </div>
                  )}
                </div>

                {/* Fee info */}
                <div className="bg-muted/30 rounded-lg border p-3">
                  <p className="text-muted-foreground text-xs">Participation</p>
                  <p className="mt-0.5 font-semibold">{getFeeDisplay(selectedEvent)}</p>
                  {selectedEvent.feeModel === "FLEXIBLE" &&
                    !selectedEvent.paymentTriggeredAt &&
                    selectedEvent.estimatedBudget != null && (
                      <p className="text-muted-foreground mt-1 text-xs">
                        Estimated budget: ₹{selectedEvent.estimatedBudget.toLocaleString("en-IN")}
                      </p>
                    )}
                  {selectedEvent.feeModel === "FLEXIBLE" &&
                    !selectedEvent.paymentTriggeredAt &&
                    selectedEvent.minParticipants != null && (
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        Min. participants: {selectedEvent.minParticipants}
                      </p>
                    )}
                </div>

                {/* Description */}
                {selectedEvent.description && (
                  <p className="text-muted-foreground text-sm">{selectedEvent.description}</p>
                )}

                {/* Badges */}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">
                    {CATEGORY_LABELS[selectedEvent.category] ?? selectedEvent.category}
                  </Badge>
                  <Badge variant="secondary">
                    {FEE_MODEL_LABELS[selectedEvent.feeModel] ?? selectedEvent.feeModel}
                  </Badge>
                  {selectedEvent.status === "COMPLETED" && (
                    <Badge variant="secondary" className="bg-gray-100 text-gray-600">
                      Completed
                    </Badge>
                  )}
                </div>

                {/* Registration deadline */}
                {selectedEvent.registrationDeadline && (
                  <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    <CalendarX className="h-3.5 w-3.5" />
                    Registration closes{" "}
                    {format(new Date(selectedEvent.registrationDeadline), "dd MMM yyyy")}
                  </p>
                )}

                <Separator />

                {/* Action area */}
                <div>
                  <p className="mb-3 text-sm font-medium">Your Registration</p>
                  <RegistrationAction
                    event={selectedEvent}
                    memberCount={memberCount}
                    setMemberCount={setMemberCount}
                    onRegister={(eventId, count) => registerMutation.mutate({ eventId, count })}
                    onCancel={(eventId) => cancelMutation.mutate(eventId)}
                    isRegistering={registerMutation.isPending}
                    isCancelling={cancelMutation.isPending}
                  />
                </div>

                {/* Financial summary — COMPLETED + SETTLED */}
                {isSettledCompleted && (
                  <>
                    <Separator />
                    <div>
                      <h3 className="mb-3 text-sm font-medium">Financial Summary</h3>
                      {financesLoading ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
                        </div>
                      ) : finances ? (
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                              <p className="text-muted-foreground text-xs">Total Collected</p>
                              <p className="font-semibold text-green-600">
                                ₹{finances.totalCollected.toLocaleString("en-IN")}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground text-xs">Total Expenses</p>
                              <p className="font-semibold">
                                ₹{finances.totalExpenses.toLocaleString("en-IN")}
                              </p>
                            </div>
                          </div>

                          <div className="rounded-lg border p-3">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium">
                                {finances.netAmount >= 0 ? "Surplus" : "Deficit"}
                              </p>
                              <p
                                className={`font-bold ${
                                  finances.netAmount >= 0 ? "text-green-600" : "text-red-600"
                                }`}
                              >
                                ₹{Math.abs(finances.netAmount).toLocaleString("en-IN")}
                              </p>
                            </div>
                            {finances.disposition && (
                              <p className="text-muted-foreground mt-1 text-xs">
                                {DISPOSAL_LABELS[finances.disposition] ?? finances.disposition}
                              </p>
                            )}
                          </div>

                          {finances.expenses.length > 0 && (
                            <div>
                              <p className="text-muted-foreground mb-2 text-xs">
                                Expense Breakdown
                              </p>
                              <div className="space-y-1.5">
                                {finances.expenses.map((exp, i) => (
                                  <div
                                    key={i}
                                    className="flex items-center justify-between text-sm"
                                  >
                                    <span className="text-muted-foreground">{exp.description}</span>
                                    <span className="font-medium">
                                      ₹{exp.amount.toLocaleString("en-IN")}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </>
                )}

                {/* COMPLETED but not yet settled */}
                {selectedEvent.status === "COMPLETED" && !selectedEvent.settledAt && (
                  <>
                    <Separator />
                    <p className="text-muted-foreground text-sm">
                      Event completed. Financial summary coming soon.
                    </p>
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
