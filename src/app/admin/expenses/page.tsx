"use client";

import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, IndianRupee, Receipt, RotateCcw, Loader2 } from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSocietyId } from "@/hooks/useSocietyId";
import { EXPENSE_CATEGORIES } from "@/lib/constants";
import { createExpenseSchema, type CreateExpenseInput } from "@/lib/validations/expense";
import { getExpenses, getExpenseSummary, createExpense, reverseExpense } from "@/services/expenses";

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

export default function ExpensesPage() {
  const { societyId } = useSocietyId();
  const queryClient = useQueryClient();
  const [addDialog, setAddDialog] = useState(false);
  const [reverseDialog, setReverseDialog] = useState<{
    open: boolean;
    expenseId: string;
    description: string;
  }>({
    open: false,
    expenseId: "",
    description: "",
  });
  const [reverseReason, setReverseReason] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);

  const { data: summary } = useQuery({
    queryKey: ["expenses", societyId, "summary"],
    queryFn: () => getExpenseSummary(societyId),
    enabled: !!societyId,
  });

  const { data: expenses, isLoading } = useQuery({
    queryKey: ["expenses", societyId, { category: categoryFilter, page }],
    queryFn: () =>
      getExpenses(societyId, {
        category: categoryFilter === "all" ? undefined : categoryFilter,
        page,
      }),
    enabled: !!societyId,
  });

  const form = useForm<CreateExpenseInput>({
    resolver: zodResolver(createExpenseSchema),
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      amount: 0,
      category: "MAINTENANCE",
      description: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateExpenseInput) => createExpense(societyId, data),
    onSuccess: () => {
      toast.success("Expense logged!");
      setAddDialog(false);
      form.reset();
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reverseMutation = useMutation({
    mutationFn: () => reverseExpense(societyId, reverseDialog.expenseId, { reason: reverseReason }),
    onSuccess: () => {
      toast.success("Expense reversed!");
      setReverseDialog({ open: false, expenseId: "", description: "" });
      setReverseReason("");
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Expense Ledger" description="Track society expenses">
        <Button onClick={() => setAddDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Log Expense
        </Button>
      </PageHeader>

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
                    {"\u20B9"}
                    {summary.totalExpenses.toLocaleString("en-IN")}
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
                    {"\u20B9"}
                    {summary.totalCollected.toLocaleString("en-IN")}
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
                {"\u20B9"}
                {summary.balanceInHand.toLocaleString("en-IN")}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {summary && summary.categoryBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {summary.categoryBreakdown.map((cat) => (
                <div
                  key={cat.category}
                  className="flex items-center justify-between rounded-md border px-3 py-2"
                >
                  <span className="text-sm capitalize">
                    {cat.category.toLowerCase().replace(/_/g, " ")}
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs">
                      {cat.percentage}%
                    </Badge>
                    <span className="text-sm font-medium">
                      {"\u20B9"}
                      {cat.total.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3">
        <Select
          value={categoryFilter}
          onValueChange={(v) => {
            setCategoryFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[200px]">
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
      </div>

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
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.data.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell>{format(new Date(expense.date), "dd MMM")}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs capitalize">
                      {expense.category.toLowerCase().replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden max-w-[200px] truncate md:table-cell">
                    {expense.description}
                  </TableCell>
                  <TableCell className="font-medium">
                    {"\u20B9"}
                    {Number(expense.amount).toLocaleString("en-IN")}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden text-sm sm:table-cell">
                    {expense.logger?.name}
                  </TableCell>
                  <TableCell>
                    {expense.status === "REVERSED" ? (
                      <Badge variant="outline" className="border-red-200 bg-red-50 text-red-700">
                        Reversed
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
                  <TableCell className="text-right">
                    {expense.status === "ACTIVE" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8"
                        onClick={() =>
                          setReverseDialog({
                            open: true,
                            expenseId: expense.id,
                            description: expense.description,
                          })
                        }
                      >
                        <RotateCcw className="mr-1 h-3 w-3" />
                        Reverse
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
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

      {/* Add Expense Dialog */}
      <Dialog open={addDialog} onOpenChange={setAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log New Expense</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={form.handleSubmit((data) => createMutation.mutate(data))}
            className="space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  Date <span className="text-destructive">*</span>
                </Label>
                <Input type="date" {...form.register("date")} />
              </div>
              <div className="space-y-2">
                <Label>
                  Amount (INR) <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="number"
                  min={1}
                  aria-invalid={!!form.formState.errors.amount}
                  {...form.register("amount", { valueAsNumber: true })}
                />
                {form.formState.errors.amount && (
                  <p className="text-destructive text-sm">{form.formState.errors.amount.message}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                Category <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.watch("category")}
                onValueChange={(v) =>
                  form.setValue("category", v as CreateExpenseInput["category"])
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
                aria-invalid={!!form.formState.errors.description}
                {...form.register("description")}
              />
              {form.formState.errors.description && (
                <p className="text-destructive text-sm">
                  {form.formState.errors.description.message}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Log Expense
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reverse Expense Dialog */}
      <Dialog
        open={reverseDialog.open}
        onOpenChange={(open) => {
          if (!open) setReverseDialog({ open: false, expenseId: "", description: "" });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reverse Expense</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground text-sm">
            Reversing: &quot;{reverseDialog.description}&quot;
          </p>
          <div className="space-y-2">
            <Label>Reason</Label>
            <Input
              placeholder="Why is this expense being reversed?"
              value={reverseReason}
              onChange={(e) => setReverseReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReverseDialog({ open: false, expenseId: "", description: "" })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={reverseReason.length < 5 || reverseMutation.isPending}
              onClick={() => reverseMutation.mutate()}
            >
              {reverseMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reverse Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
