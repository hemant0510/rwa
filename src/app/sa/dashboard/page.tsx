"use client";

import Link from "next/link";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertTriangle,
  Bell,
  Building2,
  CheckCircle,
  Clock,
  DollarSign,
  Plus,
  ScrollText,
  TrendingUp,
  XCircle,
} from "lucide-react";
import {
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getPlanDistribution,
  getGrowthStats,
  getRevenueStats,
  getSuperAdminStats,
} from "@/services/super-admin";

// ─── Palette for plan distribution chart ─────────────────────────────────────

const CHART_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ec4899", "#14b8a6", "#f97316"];

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  colorClass,
  isLoading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  colorClass: string;
  isLoading: boolean;
}) {
  if (isLoading) return <CardSkeleton />;
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg p-2 ${colorClass}`}>{icon}</div>
          <div>
            <p className="text-muted-foreground text-sm">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatCurrency(val: number) {
  if (val >= 100_000) return `₹${(val / 100_000).toFixed(1)}L`;
  if (val >= 1_000) return `₹${(val / 1_000).toFixed(1)}K`;
  return `₹${val.toLocaleString()}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SuperAdminDashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["super-admin", "stats"],
    queryFn: getSuperAdminStats,
  });

  const { data: revenue, isLoading: revenueLoading } = useQuery({
    queryKey: ["super-admin", "stats", "revenue"],
    queryFn: getRevenueStats,
  });

  const { data: growth, isLoading: growthLoading } = useQuery({
    queryKey: ["super-admin", "stats", "growth"],
    queryFn: getGrowthStats,
  });

  const { data: distribution = [], isLoading: distLoading } = useQuery({
    queryKey: ["super-admin", "stats", "plan-distribution"],
    queryFn: getPlanDistribution,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Platform overview across all societies" />

      {/* Row 1: 8 KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<Building2 className="text-primary h-5 w-5" />}
          label="Total Societies"
          value={stats?.total ?? 0}
          colorClass="bg-primary/10"
          isLoading={statsLoading}
        />
        <KpiCard
          icon={<CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />}
          label="Active"
          value={stats?.active ?? 0}
          colorClass="bg-green-100 dark:bg-green-900/30"
          isLoading={statsLoading}
        />
        <KpiCard
          icon={<Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />}
          label="Trial"
          value={stats?.trial ?? 0}
          colorClass="bg-yellow-100 dark:bg-yellow-900/30"
          isLoading={statsLoading}
        />
        <KpiCard
          icon={<XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />}
          label="Suspended"
          value={stats?.suspended ?? 0}
          colorClass="bg-red-100 dark:bg-red-900/30"
          isLoading={statsLoading}
        />
        <KpiCard
          icon={<TrendingUp className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />}
          label="MRR"
          value={revenue ? formatCurrency(revenue.mrr) : "—"}
          colorClass="bg-indigo-100 dark:bg-indigo-900/30"
          isLoading={revenueLoading}
        />
        <KpiCard
          icon={<Clock className="h-5 w-5 text-orange-600 dark:text-orange-400" />}
          label="Expiring in 30 Days"
          value={revenue?.expiring30d ?? 0}
          colorClass="bg-orange-100 dark:bg-orange-900/30"
          isLoading={revenueLoading}
        />
        <KpiCard
          icon={<AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />}
          label="Overdue Invoices"
          value={revenue?.overdueCount ?? 0}
          colorClass="bg-rose-100 dark:bg-rose-900/30"
          isLoading={revenueLoading}
        />
        <KpiCard
          icon={<DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />}
          label="Revenue This Month"
          value={revenue ? formatCurrency(revenue.totalRevenueThisMonth) : "—"}
          colorClass="bg-emerald-100 dark:bg-emerald-900/30"
          isLoading={revenueLoading}
        />
      </div>

      {/* Row 2: Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Society Growth */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Society Growth</CardTitle>
          </CardHeader>
          <CardContent>
            {growthLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={growth?.data ?? []}>
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v: string) => v.slice(0, 6)}
                  />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={false}
                    name="Societies"
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Plan Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Plan Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {distLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : distribution.length === 0 ? (
              <div className="text-muted-foreground flex h-48 items-center justify-center text-sm">
                No active subscriptions
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={distribution}
                    dataKey="count"
                    nameKey="planName"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {distribution.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [`${value} societies`]} />
                  <Legend iconSize={10} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Recently Onboarded + Expiring Subscriptions */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Recently Onboarded */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recently Onboarded</CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : !stats?.recentSocieties?.length ? (
              <p className="text-muted-foreground text-sm">No societies onboarded yet.</p>
            ) : (
              <div className="space-y-2">
                {stats.recentSocieties.slice(0, 5).map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-md border px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium">{s.name}</p>
                      <p className="text-muted-foreground text-xs">{s.city}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          s.status === "ACTIVE"
                            ? "border-green-200 bg-green-50 text-green-700"
                            : s.status === "TRIAL"
                              ? "border-yellow-200 bg-yellow-50 text-yellow-700"
                              : "border-red-200 bg-red-50 text-red-700"
                        }
                      >
                        {s.status}
                      </Badge>
                      <span className="text-muted-foreground text-xs">
                        {format(new Date(s.onboardingDate), "dd MMM")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expiring Subscriptions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expiring Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <ExpiringSubscriptions />
          </CardContent>
        </Card>
      </div>

      {/* Row 4: Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link href="/sa/societies/new">
              <Button variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Onboard Society
              </Button>
            </Link>
            <Link href="/sa/billing">
              <Button variant="outline">
                <Bell className="mr-2 h-4 w-4" />
                Send Bulk Reminder
              </Button>
            </Link>
            <Link href="/sa/audit-logs">
              <Button variant="outline">
                <ScrollText className="mr-2 h-4 w-4" />
                View Audit Log
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Expiring Subscriptions (inline sub-component) ────────────────────────────

function ExpiringSubscriptions() {
  const { data, isLoading } = useQuery({
    queryKey: ["super-admin", "billing", "expiring-soon-dashboard"],
    queryFn: async () => {
      const res = await fetch("/api/v1/super-admin/billing/expiring?days=30&limit=5");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json() as Promise<
        { societyId: string; societyName: string; currentPeriodEnd: string }[]
      >;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (!data?.length) {
    return (
      <p className="text-muted-foreground text-sm">
        No subscriptions expiring in the next 30 days.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {data.map((s) => (
        <div
          key={s.societyId}
          className="flex items-center justify-between rounded-md border px-3 py-2"
        >
          <p className="text-sm font-medium">{s.societyName}</p>
          <span className="text-muted-foreground text-xs">
            Expires {format(new Date(s.currentPeriodEnd), "dd MMM yyyy")}
          </span>
        </div>
      ))}
    </div>
  );
}
