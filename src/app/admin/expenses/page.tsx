"use client";

import { useState, useRef } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import {
  Plus,
  IndianRupee,
  Receipt,
  RotateCcw,
  Loader2,
  Pencil,
  Clock,
  ExternalLink,
  Paperclip,
  X,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSocietyId } from "@/hooks/useSocietyId";
import { EXPENSE_CATEGORIES, MAX_FILE_SIZE, ALLOWED_FILE_TYPES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import {
  createExpenseSchema,
  updateExpenseSchema,
  type CreateExpenseInput,
  type UpdateExpenseInput,
} from "@/lib/validations/expense";
import {
  getExpenses,
  getExpenseSummary,
  createExpense,
  updateExpense,
  reverseExpense,
  type Expense,
} from "@/services/expenses";

const CATEGORY_LABELS: Record<string, string> = {
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

function correctionWindowRemaining(windowEnds: string | null): string | null {
  if (!windowEnds) return null;
  const ends = new Date(windowEnds);
  if (new Date() > ends) return null;
  return formatDistanceToNow(ends, { addSuffix: false });
}

function CorrectionWindowBadge({ windowEnds }: { windowEnds: string | null }) {
  const remaining = correctionWindowRemaining(windowEnds);
  if (!remaining) return null;
  return (
    <Badge variant="outline" className="gap-1 border-blue-200 bg-blue-50 text-xs text-blue-700">
      <Clock className="h-3 w-3" />
      {remaining} to edit
    </Badge>
  );
}

async function uploadReceipt(file: File, societyId: string): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${societyId}/${Date.now()}.${ext}`;
  const supabase = createClient();

  const { error } = await supabase.storage.from("expense-receipts").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  if (error) throw new Error(`Receipt upload failed: ${error.message}`);

  const { data } = supabase.storage.from("expense-receipts").getPublicUrl(path);
  return data.publicUrl;
}

export default function ExpensesPage() {
  const { societyId } = useSocietyId();
  const queryClient = useQueryClient();

  // Dialog / sheet state
  const [addDialog, setAddDialog] = useState(false);
  const [detailSheet, setDetailSheet] = useState<{ open: boolean; expense: Expense | null }>({
    open: false,
    expense: null,
  });
  const [editDialog, setEditDialog] = useState(false);
  const [reverseDialog, setReverseDialog] = useState<{
    open: boolean;
    expenseId: string;
    description: string;
    amount: number;
  }>({ open: false, expenseId: "", description: "", amount: 0 });
  const [reverseReason, setReverseReason] = useState("");

  // Filters
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  // Receipt upload state
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queries
  const { data: summary } = useQuery({
    queryKey: ["expenses", societyId, "summary"],
    queryFn: () => getExpenseSummary(societyId),
    enabled: !!societyId,
  });

  const { data: expenses, isLoading } = useQuery({
    queryKey: [
      "expenses",
      societyId,
      { category: categoryFilter, scope: scopeFilter, from: dateFrom, to: dateTo, page },
    ],
    queryFn: () =>
      getExpenses(societyId, {
        category: categoryFilter === "all" ? undefined : categoryFilter,
        scope: scopeFilter === "all" ? undefined : scopeFilter,
        from: dateFrom || undefined,
        to: dateTo || undefined,
        page,
      }),
    enabled: !!societyId,
  });

  // Forms
  const addForm = useForm<CreateExpenseInput>({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      amount: 0,
      category: "MAINTENANCE",
      description: "",
    },
  });

  const editForm = useForm<UpdateExpenseInput>({
    resolver: zodResolver(updateExpenseSchema),
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async (data: CreateExpenseInput) => {
      let receiptUrl: string | null = null;
      if (receiptFile) {
        setReceiptUploading(true);
        try {
          receiptUrl = await uploadReceipt(receiptFile, societyId);
        } finally {
          setReceiptUploading(false);
        }
      }
      return createExpense(societyId, { ...data, receiptUrl });
    },
    onSuccess: () => {
      toast.success("Expense logged!");
      setAddDialog(false);
      addForm.reset();
      setReceiptFile(null);
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: (data: UpdateExpenseInput) =>
      updateExpense(societyId, detailSheet.expense!.id, data),
    onSuccess: () => {
      toast.success("Expense updated!");
      setEditDialog(false);
      setDetailSheet({ open: false, expense: null });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reverseMutation = useMutation({
    mutationFn: () => reverseExpense(societyId, reverseDialog.expenseId, { reason: reverseReason }),
    onSuccess: () => {
      toast.success("Expense reversed!");
      setReverseDialog({ open: false, expenseId: "", description: "", amount: 0 });
      setReverseReason("");
      setDetailSheet({ open: false, expense: null });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function openDetail(expense: Expense) {
    setDetailSheet({ open: true, expense });
  }

  function openEdit(expense: Expense) {
    editForm.reset({
      amount: Number(expense.amount),
      category: expense.category as UpdateExpenseInput["category"],
      description: expense.description,
    });
    setEditDialog(true);
  }

  function openReverse(expense: Expense) {
    setReverseDialog({
      open: true,
      expenseId: expense.id,
      description: expense.description,
      amount: Number(expense.amount),
    });
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File must be under 5MB");
      return;
    }
    if (!ALLOWED_FILE_TYPES.includes(file.type as (typeof ALLOWED_FILE_TYPES)[number])) {
      toast.error("Only JPG, PNG, or PDF files are allowed");
      return;
    }
    setReceiptFile(file);
  }

  const watchedAmount = addForm.watch("amount");
  const balanceImpact = summary
    ? {
        current: summary.balanceInHand,
        after: summary.balanceInHand - (watchedAmount || 0),
      }
    : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Expense Ledger" description="Track society expenses">
        <Button onClick={() => setAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Log Expense
        </Button>
      </PageHeader>

      {/* Summary Cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-red-100 p-2 dark:bg-red-900/30">
                  <Receipt className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Total Expenses</p>
                  <p className="text-2xl font-bold">
                    ₹{summary.totalExpenses.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900/30">
                  <IndianRupee className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Total Collected</p>
                  <p className="text-2xl font-bold">
                    ₹{summary.totalCollected.toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-sm">Balance in Hand</p>
              <p
                className={`text-2xl font-bold ${summary.balanceInHand >= 0 ? "text-green-600" : "text-red-600"}`}
              >
                ₹{summary.balanceInHand.toLocaleString("en-IN")}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Category Breakdown */}
      {summary && summary.categoryBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {summary.categoryBreakdown.map((cat) => (
              <div key={cat.category} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="capitalize">
                    {CATEGORY_LABELS[cat.category] ?? cat.category.toLowerCase().replace(/_/g, " ")}
                  </span>
                  <span className="font-medium">
                    ₹{cat.total.toLocaleString("en-IN")}{" "}
                    <span className="text-muted-foreground font-normal">({cat.percentage}%)</span>
                  </span>
                </div>
                <div className="bg-secondary h-2 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full rounded-full transition-all"
                    style={{ width: `${cat.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={categoryFilter}
          onValueChange={(v) => {
            setCategoryFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {EXPENSE_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={scopeFilter}
          onValueChange={(v) => {
            setScopeFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Expenses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Expenses</SelectItem>
            <SelectItem value="general">General Only</SelectItem>
            <SelectItem value="event">Event Only</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Label className="text-muted-foreground text-sm">From</Label>
          <Input
            type="date"
            className="w-[150px]"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-muted-foreground text-sm">To</Label>
          <Input
            type="date"
            className="w-[150px]"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
          />
        </div>
        {(dateFrom || dateTo) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDateFrom("");
              setDateTo("");
              setPage(1);
            }}
          >
            <X className="mr-1 h-3 w-3" />
            Clear dates
          </Button>
        )}
      </div>

      {/* Expense Table */}
      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : expenses?.data?.length ? (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="hidden md:table-cell">Description</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="hidden sm:table-cell">Logged By</TableHead>
                <TableHead className="hidden lg:table-cell">Edit Window</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.data.map((expense) => {
                const isReversed = expense.status === "REVERSED";
                const rowClass = isReversed ? "opacity-60" : "cursor-pointer hover:bg-muted/50";
                const cellClass = isReversed ? "line-through" : "";
                return (
                  <TableRow
                    key={expense.id}
                    className={rowClass}
                    onClick={() => !isReversed && openDetail(expense)}
                  >
                    <TableCell className={cellClass}>
                      {format(new Date(expense.date), "dd MMM")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`text-xs capitalize ${cellClass}`}>
                        {(
                          CATEGORY_LABELS[expense.category] ??
                          expense.category.toLowerCase().replace(/_/g, " ")
                        ).toLowerCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className={`hidden max-w-[200px] md:table-cell ${cellClass}`}>
                      <span className="truncate">{expense.description}</span>
                      {expense.event && (
                        <Badge
                          variant="outline"
                          className="ml-2 gap-1 border-purple-200 bg-purple-50 text-xs text-purple-700"
                        >
                          {expense.event.title}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell
                      className={`font-medium ${isReversed ? "text-red-500 line-through" : Number(expense.amount) < 0 ? "text-red-600" : ""}`}
                    >
                      {Number(expense.amount) < 0 ? "−" : ""}₹
                      {Math.abs(Number(expense.amount)).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-sm sm:table-cell">
                      {expense.logger?.name}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {!isReversed && (
                        <CorrectionWindowBadge windowEnds={expense.correctionWindowEnds} />
                      )}
                    </TableCell>
                    <TableCell>
                      {isReversed ? (
                        <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                          Reversed
                        </Badge>
                      ) : Number(expense.amount) < 0 ? (
                        <Badge
                          variant="outline"
                          className="border-orange-200 bg-orange-50 text-orange-700"
                        >
                          Reversal Entry
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-green-200 bg-green-50 text-green-700"
                        >
                          Active
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center">
            No expenses found. Click &quot;Log Expense&quot; to add one.
          </CardContent>
        </Card>
      )}

      {/* Expense Detail Sheet */}
      <Sheet
        open={detailSheet.open}
        onOpenChange={(open) => {
          if (!open) setDetailSheet({ open: false, expense: null });
        }}
      >
        <SheetContent className="w-full sm:max-w-md">
          {detailSheet.expense && (
            <>
              <SheetHeader>
                <SheetTitle>Expense Details</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <DetailRow
                  label="Date"
                  value={format(new Date(detailSheet.expense.date), "dd MMMM yyyy")}
                />
                <DetailRow
                  label="Amount"
                  value={`₹${Math.abs(Number(detailSheet.expense.amount)).toLocaleString("en-IN")}`}
                />
                <DetailRow
                  label="Category"
                  value={
                    CATEGORY_LABELS[detailSheet.expense.category] ??
                    detailSheet.expense.category.toLowerCase().replace(/_/g, " ")
                  }
                />
                <DetailRow label="Description" value={detailSheet.expense.description} />
                <DetailRow label="Logged By" value={detailSheet.expense.logger?.name ?? "—"} />
                <DetailRow
                  label="Logged At"
                  value={format(new Date(detailSheet.expense.createdAt), "dd MMM yyyy 'at' HH:mm")}
                />
                {detailSheet.expense.receiptUrl && (
                  <div>
                    <p className="text-muted-foreground mb-1 text-sm">Receipt</p>
                    <a
                      href={detailSheet.expense.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View Receipt
                    </a>
                  </div>
                )}
                {detailSheet.expense.status === "ACTIVE" && (
                  <div className="pt-2">
                    <CorrectionWindowBadge windowEnds={detailSheet.expense.correctionWindowEnds} />
                    {correctionWindowRemaining(detailSheet.expense.correctionWindowEnds) && (
                      <p className="text-muted-foreground mt-1 text-xs">
                        You can edit this expense while the window is open.
                      </p>
                    )}
                  </div>
                )}
                {detailSheet.expense.reversalNote && (
                  <DetailRow label="Reversal Reason" value={detailSheet.expense.reversalNote} />
                )}
              </div>

              {detailSheet.expense.status === "ACTIVE" && (
                <div className="mt-8 flex gap-2">
                  {correctionWindowRemaining(detailSheet.expense.correctionWindowEnds) && (
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => openEdit(detailSheet.expense!)}
                    >
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => openReverse(detailSheet.expense!)}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reverse
                  </Button>
                </div>
              )}
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Add Expense Dialog */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log New Expense</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={addForm.handleSubmit((data) => createMutation.mutate(data))}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  Date <span className="text-destructive">*</span>
                </Label>
                <Input type="date" {...addForm.register("date")} />
              </div>
              <div className="space-y-2">
                <Label>
                  Amount (₹) <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  min={1}
                  aria-invalid={!!addForm.formState.errors.amount}
                  {...addForm.register("amount", { valueAsNumber: true })}
                />
                {addForm.formState.errors.amount && (
                  <p className="text-destructive text-sm">
                    {addForm.formState.errors.amount.message}
                  </p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                Category <span className="text-destructive">*</span>
              </Label>
              <Select
                value={addForm.watch("category")}
                onValueChange={(v) =>
                  addForm.setValue("category", v as CreateExpenseInput["category"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
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
                aria-invalid={!!addForm.formState.errors.description}
                {...addForm.register("description")}
              />
              {addForm.formState.errors.description && (
                <p className="text-destructive text-sm">
                  {addForm.formState.errors.description.message}
                </p>
              )}
            </div>

            {/* Receipt upload */}
            <div className="space-y-2">
              <Label>Receipt / Invoice (optional)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                className="hidden"
                onChange={handleFileSelect}
              />
              {receiptFile ? (
                <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <Paperclip className="text-muted-foreground h-4 w-4" />
                    <span className="max-w-[200px] truncate">{receiptFile.name}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => {
                      setReceiptFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Paperclip className="mr-2 h-4 w-4" />
                  Attach receipt (JPG, PNG, PDF — max 5MB)
                </Button>
              )}
            </div>

            {/* Balance impact preview */}
            {balanceImpact && watchedAmount > 0 && (
              <div className="bg-muted/40 space-y-1 rounded-md border px-4 py-3 text-sm">
                <p className="font-medium">Balance Impact</p>
                <div className="text-muted-foreground flex justify-between">
                  <span>Current Balance</span>
                  <span>₹{balanceImpact.current.toLocaleString("en-IN")}</span>
                </div>
                <div className="text-muted-foreground flex justify-between">
                  <span>This Expense</span>
                  <span className="text-red-600">−₹{watchedAmount.toLocaleString("en-IN")}</span>
                </div>
                <div className="mt-1 flex justify-between border-t pt-1 font-medium">
                  <span>New Balance</span>
                  <span className={balanceImpact.after >= 0 ? "text-green-600" : "text-red-600"}>
                    ₹{balanceImpact.after.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="submit" disabled={createMutation.isPending || receiptUploading}>
                {(createMutation.isPending || receiptUploading) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {receiptUploading ? "Uploading..." : "Log Expense"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Expense Dialog (correction within 24h) */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Expense</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={editForm.handleSubmit((data) => updateMutation.mutate(data))}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Amount (₹)</Label>
              <Input
                type="number"
                min={1}
                aria-invalid={!!editForm.formState.errors.amount}
                {...editForm.register("amount", { valueAsNumber: true })}
              />
              {editForm.formState.errors.amount && (
                <p className="text-destructive text-sm">
                  {editForm.formState.errors.amount.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={editForm.watch("category")}
                onValueChange={(v) =>
                  editForm.setValue("category", v as UpdateExpenseInput["category"])
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                placeholder="Description"
                aria-invalid={!!editForm.formState.errors.description}
                {...editForm.register("description")}
              />
              {editForm.formState.errors.description && (
                <p className="text-destructive text-sm">
                  {editForm.formState.errors.description.message}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialog(false)}>
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

      {/* Reverse Expense Dialog */}
      <Dialog
        open={reverseDialog.open}
        onOpenChange={(open) => {
          if (!open) setReverseDialog({ open: false, expenseId: "", description: "", amount: 0 });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reverse Expense</DialogTitle>
          </DialogHeader>
          <div className="bg-muted/40 space-y-1 rounded-md border px-4 py-3 text-sm">
            <p className="font-medium">{reverseDialog.description}</p>
            <p className="text-muted-foreground">₹{reverseDialog.amount.toLocaleString("en-IN")}</p>
          </div>
          <p className="text-muted-foreground text-sm">
            This will mark the original as reversed and create a −₹
            {reverseDialog.amount.toLocaleString("en-IN")} entry. Both entries remain for audit.
          </p>
          <div className="space-y-2">
            <Label>
              Reason for Reversal <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="Why is this expense being reversed?"
              value={reverseReason}
              onChange={(e) => setReverseReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setReverseDialog({ open: false, expenseId: "", description: "", amount: 0 })
              }
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={reverseReason.length < 5 || reverseMutation.isPending}
              onClick={() => reverseMutation.mutate()}
            >
              {reverseMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Reversal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
