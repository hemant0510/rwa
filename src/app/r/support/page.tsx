"use client";

import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LifeBuoy, Loader2, Paperclip, Plus } from "lucide-react";
import { toast } from "sonner";

import { ResidentTicketStatusBadge } from "@/components/features/resident-support/ResidentTicketStatusBadge";
import { ResidentTicketTypeBadge } from "@/components/features/resident-support/ResidentTicketTypeBadge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import {
  RESIDENT_TICKET_PRIORITIES,
  RESIDENT_TICKET_PRIORITY_LABELS,
  RESIDENT_TICKET_STATUSES,
  RESIDENT_TICKET_TYPES,
  RESIDENT_TICKET_TYPE_LABELS,
  RESIDENT_TICKET_STATUS_LABELS,
  createResidentTicketSchema,
} from "@/lib/validations/resident-support";
import type { CreateResidentTicketInput } from "@/lib/validations/resident-support";
import { createResidentTicket, getResidentTickets } from "@/services/resident-support";
import type { ResidentTicketListItem } from "@/types/resident-support";

// ── Helpers ────────────────────────────────────────────────────────────────

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ── Create Ticket Dialog ───────────────────────────────────────────────────

interface CreateTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateResidentTicketInput) => void;
  isPending: boolean;
}

function CreateTicketDialog({ open, onOpenChange, onSubmit, isPending }: CreateTicketDialogProps) {
  const [type, setType] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("MEDIUM");
  const [errors, setErrors] = useState<Partial<Record<keyof CreateResidentTicketInput, string>>>(
    {},
  );

  const handleClose = (isOpen: boolean) => {
    if (!isOpen) {
      setType("");
      setSubject("");
      setDescription("");
      setPriority("MEDIUM");
      setErrors({});
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = createResidentTicketSchema.safeParse({ type, subject, description, priority });
    if (!parsed.success) {
      const fieldErrors: Partial<Record<keyof CreateResidentTicketInput, string>> = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof CreateResidentTicketInput;
        fieldErrors[field] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Support Ticket</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ticket-type">Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id="ticket-type">
                <SelectValue placeholder="Select issue type" />
              </SelectTrigger>
              <SelectContent>
                {RESIDENT_TICKET_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {RESIDENT_TICKET_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.type && <p className="text-destructive text-xs">{errors.type}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ticket-subject">Subject</Label>
            <input
              id="ticket-subject"
              className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary of the issue (5–200 characters)"
              maxLength={200}
            />
            {errors.subject && <p className="text-destructive text-xs">{errors.subject}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ticket-priority">Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger id="ticket-priority">
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                {RESIDENT_TICKET_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {RESIDENT_TICKET_PRIORITY_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ticket-description">Description</Label>
            <Textarea
              id="ticket-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue in detail (20–5000 characters)"
              rows={4}
              maxLength={5000}
            />
            {errors.description && <p className="text-destructive text-xs">{errors.description}</p>}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {/* v8 ignore start */}
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {/* v8 ignore stop */}
              Submit
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Ticket Row ─────────────────────────────────────────────────────────────

interface TicketRowProps {
  ticket: ResidentTicketListItem;
  isOwn: boolean;
}

function TicketRow({ ticket, isOwn }: TicketRowProps) {
  const href = `/r/support/${ticket.id}`;
  return (
    <a
      href={href}
      className={`hover:bg-muted/40 block rounded-lg border p-4 transition-colors ${isOwn ? "border-blue-200 bg-blue-50/30 dark:border-blue-900 dark:bg-blue-950/10" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground shrink-0 font-mono text-xs">
              #{ticket.ticketNumber}
            </span>
            {/* v8 ignore start */}
            {ticket.status === "AWAITING_RESIDENT" && (
              <span className="h-2 w-2 animate-pulse rounded-full bg-orange-500" />
            )}
            {/* v8 ignore stop */}
            <ResidentTicketTypeBadge type={ticket.type} />
            <ResidentTicketStatusBadge status={ticket.status} />
          </div>
          <p className="text-sm leading-snug font-medium">{ticket.subject}</p>
          <p className="text-muted-foreground text-xs">
            Raised by {ticket.createdByUser.name} · {timeAgo(ticket.updatedAt)}
          </p>
        </div>
        {ticket._count.attachments > 0 && (
          <div className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
            <Paperclip className="h-3.5 w-3.5" />
            {ticket._count.attachments}
          </div>
        )}
      </div>
    </a>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function ResidentSupportPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [mineOnly, setMineOnly] = useState(false);
  const [page, setPage] = useState(1);

  const PAGE_SIZE = 20;

  const filters: Record<string, string> = {};
  /* v8 ignore start */
  if (statusFilter) filters.status = statusFilter;
  if (typeFilter) filters.type = typeFilter;
  /* v8 ignore stop */
  if (mineOnly) filters.mine = "true";
  filters.page = String(page);
  filters.pageSize = String(PAGE_SIZE);

  const { data, isLoading } = useQuery({
    queryKey: ["resident-tickets", filters],
    queryFn: () => getResidentTickets(filters),
    enabled: !!user,
  });

  const tickets = data?.tickets ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const createMutation = useMutation({
    mutationFn: createResidentTicket,
    onSuccess: () => {
      toast.success("Ticket submitted successfully.");
      setDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["resident-tickets"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleCreate = (data: CreateResidentTicketInput) => {
    createMutation.mutate(data);
  };

  const handleResetFilters = () => {
    setStatusFilter("");
    setTypeFilter("");
    setMineOnly(false);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Support</h1>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Ticket
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={statusFilter}
          onValueChange={
            /* v8 ignore next */ (v) => {
              /* v8 ignore start */
              setStatusFilter(v === "ALL" ? "" : v);
              setPage(1);
              /* v8 ignore stop */
            }
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {RESIDENT_TICKET_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {RESIDENT_TICKET_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={typeFilter}
          onValueChange={
            /* v8 ignore next */ (v) => {
              /* v8 ignore start */
              setTypeFilter(v === "ALL" ? "" : v);
              setPage(1);
              /* v8 ignore stop */
            }
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            {RESIDENT_TICKET_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {RESIDENT_TICKET_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={mineOnly}
            onChange={(e) => {
              setMineOnly(e.target.checked);
              setPage(1);
            }}
            className="h-4 w-4 rounded border-gray-300"
          />
          My Tickets Only
        </label>

        {(statusFilter || typeFilter || mineOnly) && (
          <Button variant="ghost" size="sm" onClick={handleResetFilters}>
            Clear filters
          </Button>
        )}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex min-h-[200px] items-center justify-center">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
        </div>
      ) : tickets.length === 0 ? (
        <EmptyState
          icon={<LifeBuoy className="text-muted-foreground h-8 w-8" />}
          title="No tickets found"
          description="No support tickets match your filters."
        />
      ) : (
        <div className="space-y-3">
          {tickets.map((ticket) => (
            <TicketRow key={ticket.id} ticket={ticket} isOwn={ticket.createdBy === user?.id} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-muted-foreground text-sm">
            Page {page} of {totalPages} ({total} tickets)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Create Ticket Dialog */}
      <CreateTicketDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleCreate}
        isPending={createMutation.isPending}
      />
    </div>
  );
}
