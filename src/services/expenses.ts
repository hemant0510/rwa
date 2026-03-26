import type {
  CreateExpenseInput,
  ReverseExpenseInput,
  UpdateExpenseInput,
} from "@/lib/validations/expense";

const API_BASE = "/api/v1";

export interface Expense {
  id: string;
  societyId: string;
  date: string;
  amount: number;
  category: string;
  description: string;
  status: "ACTIVE" | "REVERSED";
  receiptUrl: string | null;
  reversalNote: string | null;
  reversedAt: string | null;
  reversedBy: string | null;
  correctionWindowEnds: string | null;
  loggedBy: string;
  logger: { name: string };
  eventId: string | null;
  event: { title: string } | null;
  createdAt: string;
}

export interface ExpenseSummary {
  totalExpenses: number;
  totalCollected: number;
  balanceInHand: number;
  categoryBreakdown: {
    category: string;
    total: number;
    count: number;
    percentage: number;
  }[];
}

export async function getExpenses(
  societyId: string,
  params?: {
    category?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
    scope?: string;
  },
) {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set("category", params.category);
  if (params?.from) searchParams.set("from", params.from);
  if (params?.to) searchParams.set("to", params.to);
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.scope) searchParams.set("scope", params.scope);
  const res = await fetch(`${API_BASE}/societies/${societyId}/expenses?${searchParams}`);
  if (!res.ok) throw new Error("Failed to fetch expenses");
  return res.json() as Promise<{ data: Expense[]; total: number; page: number; limit: number }>;
}

export async function getExpenseSummary(societyId: string) {
  const res = await fetch(`${API_BASE}/societies/${societyId}/expenses/summary`);
  if (!res.ok) throw new Error("Failed to fetch expense summary");
  return res.json() as Promise<ExpenseSummary>;
}

export async function createExpense(societyId: string, data: CreateExpenseInput) {
  const res = await fetch(`${API_BASE}/societies/${societyId}/expenses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to create expense");
  }
  return res.json() as Promise<Expense>;
}

export async function updateExpense(
  societyId: string,
  expenseId: string,
  data: UpdateExpenseInput,
) {
  const res = await fetch(`${API_BASE}/societies/${societyId}/expenses/${expenseId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to update expense");
  }
  return res.json() as Promise<Expense>;
}

export async function reverseExpense(
  societyId: string,
  expenseId: string,
  data: ReverseExpenseInput,
) {
  const res = await fetch(`${API_BASE}/societies/${societyId}/expenses/${expenseId}/reverse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to reverse expense");
  }
  return res.json();
}
