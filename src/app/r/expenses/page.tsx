"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Receipt } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { TableSkeleton } from "@/components/ui/LoadingSkeleton";
import { useAuth } from "@/hooks/useAuth";
import { getExpenses, getExpenseSummary } from "@/services/expenses";

export default function ResidentExpensesPage() {
  const { user } = useAuth();
  const societyId = user?.societyId ?? "";

  const { data: summary } = useQuery({
    queryKey: ["expenses", societyId, "summary"],
    queryFn: () => getExpenseSummary(societyId),
    enabled: !!societyId,
  });

  const { data: expenses, isLoading } = useQuery({
    queryKey: ["expenses", societyId, "resident-view"],
    queryFn: () => getExpenses(societyId, { limit: 50 }),
    enabled: !!societyId,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Society Expenses</h1>

      {summary && (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground text-sm">Total Expenses</p>
              <p className="text-xl font-bold">
                {"\u20B9"}
                {summary.totalExpenses.toLocaleString("en-IN")}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground text-sm">Balance</p>
              <p
                className={`text-xl font-bold ${summary.balanceInHand >= 0 ? "text-green-600" : "text-red-600"}`}
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
          <CardHeader className="pb-3">
            <CardTitle className="text-base">By Category</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {summary.categoryBreakdown.map((cat) => (
              <div key={cat.category} className="flex items-center justify-between text-sm">
                <span className="capitalize">{cat.category.toLowerCase().replace(/_/g, " ")}</span>
                <span className="font-medium">
                  {"\u20B9"}
                  {cat.total.toLocaleString("en-IN")}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : !expenses?.data?.length ? (
        <EmptyState
          icon={<Receipt className="text-muted-foreground h-8 w-8" />}
          title="No expenses recorded"
          description="Society expenses will appear here for transparency."
        />
      ) : (
        <div className="space-y-2">
          {expenses.data
            .filter((e) => e.status === "ACTIVE")
            .map((expense) => (
              <div
                key={expense.id}
                className="flex items-center justify-between rounded-md border px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{expense.description}</p>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs capitalize">
                      {expense.category.toLowerCase().replace(/_/g, " ")}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {format(new Date(expense.date), "dd MMM yyyy")}
                    </span>
                  </div>
                </div>
                <p className="font-medium">
                  {"\u20B9"}
                  {Number(expense.amount).toLocaleString("en-IN")}
                </p>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
