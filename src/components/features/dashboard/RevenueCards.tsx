"use client";

import { IndianRupee, TrendingDown, TrendingUp, Wallet } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface RevenueData {
  totalRevenue: number;
  monthlyRevenue: number;
  pendingDues: number;
  collectionRate: number;
}

interface RevenueCardsProps {
  data: RevenueData | undefined;
  isLoading: boolean;
}

function formatCurrency(val: number): string {
  if (val >= 100_000) return `\u20B9${(val / 100_000).toFixed(1)}L`;
  if (val >= 1_000) return `\u20B9${(val / 1_000).toFixed(1)}K`;
  return `\u20B9${val.toLocaleString("en-IN")}`;
}

export function RevenueCards({ data, isLoading }: RevenueCardsProps) {
  const cards = [
    { label: "Total Revenue", value: data?.totalRevenue, icon: Wallet, color: "text-green-600" },
    { label: "This Month", value: data?.monthlyRevenue, icon: IndianRupee, color: "text-blue-600" },
    { label: "Pending Dues", value: data?.pendingDues, icon: TrendingDown, color: "text-red-600" },
    {
      label: "Collection Rate",
      value: data?.collectionRate,
      icon: TrendingUp,
      color: "text-purple-600",
      isPercent: true,
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="mb-2 h-4 w-20" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <card.icon className={`h-4 w-4 ${card.color}`} />
              <p className="text-muted-foreground text-xs">{card.label}</p>
            </div>
            <p className={`mt-1 text-2xl font-bold ${card.color}`}>
              {card.value !== undefined
                ? card.isPercent
                  ? `${card.value}%`
                  : formatCurrency(card.value)
                : "—"}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export { formatCurrency };
