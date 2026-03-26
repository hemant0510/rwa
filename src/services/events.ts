import type {
  AddEventExpenseInput,
  CancelEventInput,
  CreateEventInput,
  RecordEventPaymentInput,
  RegisterEventInput,
  SettleEventInput,
  TriggerPaymentInput,
  UpdateEventInput,
} from "@/lib/validations/event";

const API_BASE = "/api/v1";

// ── Types ──

export interface CommunityEvent {
  id: string;
  societyId: string;
  title: string;
  description: string | null;
  category: string;
  feeModel: string;
  chargeUnit: string;
  eventDate: string;
  location: string | null;
  registrationDeadline: string | null;
  feeAmount: number | null;
  estimatedBudget: number | null;
  minParticipants: number | null;
  maxParticipants: number | null;
  suggestedAmount: number | null;
  status: string;
  cancellationReason: string | null;
  publishedAt: string | null;
  paymentTriggeredAt: string | null;
  settledAt: string | null;
  surplusAmount: number | null;
  surplusDisposal: string | null;
  deficitDisposition: string | null;
  settlementNotes: string | null;
  createdAt: string;
  creator: { name: string };
  _count?: {
    registrations: number;
  };
}

export interface EventRegistration {
  id: string;
  eventId: string;
  userId: string;
  status: string;
  memberCount: number;
  registeredAt: string;
  cancelledAt: string | null;
  user: { name: string; email: string; mobile: string | null };
  payment: EventPayment | null;
}

export interface EventPayment {
  id: string;
  amount: number;
  paymentMode: string;
  referenceNo: string | null;
  receiptNo: string;
  paymentDate: string;
  notes: string | null;
}

export interface EventFinanceSummary {
  totalCollected: number;
  pendingAmount: number;
  totalExpenses: number;
  netAmount: number;
  expenses: Array<{
    id: string;
    description: string;
    amount: number;
    category: string;
    date: string;
  }>;
  isSettled: boolean;
  settledAt: string | null;
  surplusAmount: number | null;
  surplusDisposal: string | null;
  deficitDisposition: string | null;
  settlementNotes: string | null;
}

// ── Admin: Events ──

export async function getEvents(
  societyId: string,
  params?: { status?: string; category?: string; page?: number; limit?: number },
) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.category) searchParams.set("category", params.category);
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  const res = await fetch(`${API_BASE}/societies/${societyId}/events?${searchParams}`);
  if (!res.ok) throw new Error("Failed to fetch events");
  return res.json() as Promise<{
    data: CommunityEvent[];
    total: number;
    page: number;
    limit: number;
  }>;
}

export async function createEvent(societyId: string, data: CreateEventInput) {
  const res = await fetch(`${API_BASE}/societies/${societyId}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to create event");
  }
  return res.json() as Promise<CommunityEvent>;
}

export async function getEvent(societyId: string, eventId: string) {
  const res = await fetch(`${API_BASE}/societies/${societyId}/events/${eventId}`);
  if (!res.ok) throw new Error("Failed to fetch event");
  return res.json() as Promise<CommunityEvent>;
}

export async function updateEvent(societyId: string, eventId: string, data: UpdateEventInput) {
  const res = await fetch(`${API_BASE}/societies/${societyId}/events/${eventId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to update event");
  }
  return res.json() as Promise<CommunityEvent>;
}

export async function deleteEvent(societyId: string, eventId: string) {
  const res = await fetch(`${API_BASE}/societies/${societyId}/events/${eventId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to delete event");
  }
  return res.json() as Promise<{ message: string }>;
}

// ── Admin: Event Actions ──

export async function publishEvent(societyId: string, eventId: string) {
  const res = await fetch(`${API_BASE}/societies/${societyId}/events/${eventId}/publish`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to publish event");
  }
  return res.json() as Promise<CommunityEvent>;
}

export async function triggerPayment(
  societyId: string,
  eventId: string,
  data: TriggerPaymentInput,
) {
  const res = await fetch(`${API_BASE}/societies/${societyId}/events/${eventId}/trigger-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to trigger payment");
  }
  return res.json() as Promise<CommunityEvent & { transitionedCount: number }>;
}

export async function cancelEvent(societyId: string, eventId: string, data: CancelEventInput) {
  const res = await fetch(`${API_BASE}/societies/${societyId}/events/${eventId}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to cancel event");
  }
  return res.json() as Promise<CommunityEvent>;
}

export async function completeEvent(societyId: string, eventId: string) {
  const res = await fetch(`${API_BASE}/societies/${societyId}/events/${eventId}/complete`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to complete event");
  }
  return res.json() as Promise<CommunityEvent>;
}

// ── Admin: Registrations & Payments ──

export async function getRegistrations(
  societyId: string,
  eventId: string,
  params?: { status?: string; page?: number; limit?: number },
) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  const res = await fetch(
    `${API_BASE}/societies/${societyId}/events/${eventId}/registrations?${searchParams}`,
  );
  if (!res.ok) throw new Error("Failed to fetch registrations");
  return res.json() as Promise<{
    data: EventRegistration[];
    total: number;
    page: number;
    limit: number;
  }>;
}

export async function recordEventPayment(
  societyId: string,
  eventId: string,
  regId: string,
  data: RecordEventPaymentInput,
) {
  const res = await fetch(
    `${API_BASE}/societies/${societyId}/events/${eventId}/registrations/${regId}/payment`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    },
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to record payment");
  }
  return res.json() as Promise<EventPayment>;
}

// ── Admin: Finances ──

export async function getEventFinances(societyId: string, eventId: string) {
  const res = await fetch(`${API_BASE}/societies/${societyId}/events/${eventId}/finances`);
  if (!res.ok) throw new Error("Failed to fetch finances");
  return res.json() as Promise<EventFinanceSummary>;
}

export async function addEventExpense(
  societyId: string,
  eventId: string,
  data: AddEventExpenseInput,
) {
  const res = await fetch(`${API_BASE}/societies/${societyId}/events/${eventId}/expenses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to add expense");
  }
  return res.json();
}

export async function settleEvent(societyId: string, eventId: string, data: SettleEventInput) {
  const res = await fetch(`${API_BASE}/societies/${societyId}/events/${eventId}/settle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to settle event");
  }
  return res.json() as Promise<CommunityEvent>;
}

// ── Resident: Events ──

export async function getResidentEvents(params?: { upcoming?: boolean; all?: boolean }) {
  const searchParams = new URLSearchParams();
  if (params?.upcoming) searchParams.set("upcoming", "true");
  if (params?.all) searchParams.set("all", "true");
  const res = await fetch(`${API_BASE}/residents/me/events?${searchParams}`);
  if (!res.ok) throw new Error("Failed to fetch events");
  return res.json() as Promise<{ data: CommunityEvent[] }>;
}

export async function registerForEvent(eventId: string, data: RegisterEventInput) {
  const res = await fetch(`${API_BASE}/residents/me/events/${eventId}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to register");
  }
  return res.json() as Promise<EventRegistration>;
}

export async function cancelRegistration(eventId: string) {
  const res = await fetch(`${API_BASE}/residents/me/events/${eventId}/register`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to cancel registration");
  }
  return res.json() as Promise<EventRegistration>;
}

export async function getResidentEventFinances(eventId: string) {
  const res = await fetch(`${API_BASE}/residents/me/events/${eventId}/finances`);
  if (!res.ok) throw new Error("Failed to fetch event finances");
  return res.json() as Promise<EventFinanceSummary>;
}
