"use client";

import { useState } from "react";

import Link from "next/link";

import { useQuery } from "@tanstack/react-query";
import {
  Users,
  CreditCard,
  Clock,
  IndianRupee,
  Megaphone,
  TrendingUp,
  AlertTriangle,
  Link2,
  Copy,
  Check,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { Progress } from "@/components/ui/progress";
import { useSocietyId } from "@/hooks/useSocietyId";
import { APP_URL } from "@/lib/constants";
import { getUnreadAnnouncements } from "@/services/announcements";
import { getExpenseSummary } from "@/services/expenses";
import { getFeeDashboard } from "@/services/fees";
import { getResidents } from "@/services/residents";

export default function AdminDashboardPage() {
  const { societyId, societyCode, saQueryString } = useSocietyId();
  const [copied, setCopied] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  const { data: announcements = [] } = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: getUnreadAnnouncements,
  });

  const visibleAnnouncements = announcements.filter((a) => !dismissedIds.includes(a.id));
  const registrationUrl = societyCode ? `${APP_URL}/register/${societyCode}` : null;

  const { data: residents, isLoading: loadingResidents } = useQuery({
    queryKey: ["residents", societyId, { status: undefined }],
    queryFn: () => getResidents(societyId),
    enabled: !!societyId,
  });

  const { data: pendingResidents } = useQuery({
    queryKey: ["residents", societyId, { status: "PENDING_APPROVAL" }],
    queryFn: () => getResidents(societyId, { status: "PENDING_APPROVAL" }),
    enabled: !!societyId,
  });

  const { data: fees, isLoading: loadingFees } = useQuery({
    queryKey: ["fees", societyId],
    queryFn: () => getFeeDashboard(societyId),
    enabled: !!societyId,
  });

  const { data: expenseSummary } = useQuery({
    queryKey: ["expenses", societyId, "summary"],
    queryFn: () => getExpenseSummary(societyId),
    enabled: !!societyId,
  });

  const isLoading = loadingResidents || loadingFees;

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Overview of your society" />

      {/* Platform Announcement Banners */}
      {visibleAnnouncements.map((ann) => (
        <div
          key={ann.id}
          className={`flex items-start gap-3 rounded-lg border p-4 ${
            ann.priority === "URGENT"
              ? "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200"
              : "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200"
          }`}
        >
          <Megaphone className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{ann.subject}</p>
            <p className="mt-0.5 text-sm opacity-90">{ann.body}</p>
          </div>
          <button
            className="shrink-0 opacity-60 hover:opacity-100"
            onClick={() => setDismissedIds((prev) => [...prev, ann.id])}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}

      {registrationUrl && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 rounded-lg p-2">
                <Link2 className="text-primary h-5 w-5" />
              </div>
              <div className="flex-1 space-y-2">
                <div>
                  <p className="text-sm font-medium">Resident Registration Link</p>
                  <p className="text-muted-foreground text-xs">
                    Share this link with residents so they can self-register for your society.
                  </p>
                </div>
                <div className="bg-muted/50 flex items-center gap-2 rounded-md border px-3 py-2">
                  <code className="flex-1 truncate text-sm">{registrationUrl}</code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => {
                      navigator.clipboard.writeText(registrationUrl);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                    }}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-lg p-2">
                  <Users className="text-primary h-5 w-5" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Total Residents</p>
                  <p className="text-2xl font-bold">{residents?.total ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-yellow-100 p-2 dark:bg-yellow-900/30">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Pending Approvals</p>
                  <p className="text-2xl font-bold">{pendingResidents?.total ?? 0}</p>
                </div>
              </div>
              {(pendingResidents?.total ?? 0) > 0 && (
                <Link
                  href={`/admin/residents?status=PENDING_APPROVAL${saQueryString ? `&${saQueryString.slice(1)}` : ""}`}
                  className="mt-2 block"
                >
                  <Button variant="link" size="sm" className="h-auto p-0 text-xs">
                    Review now
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900/30">
                  <IndianRupee className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Fees Collected</p>
                  <p className="text-2xl font-bold">
                    {"\u20B9"}
                    {(fees?.totalCollected ?? 0).toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Balance in Hand</p>
                  <p className="text-2xl font-bold">
                    {"\u20B9"}
                    {(expenseSummary?.balanceInHand ?? 0).toLocaleString("en-IN")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {fees && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Collection Progress
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>
                {"\u20B9"}
                {fees.totalCollected.toLocaleString("en-IN")} / {"\u20B9"}
                {fees.totalDue.toLocaleString("en-IN")}
              </span>
              <span className="font-medium">{fees.collectionRate}%</span>
            </div>
            <Progress value={fees.collectionRate} />
            <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
              {fees.stats?.map((s) => (
                <span key={s.status}>
                  {s.status}: {s._count}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href={`/admin/residents?status=PENDING_APPROVAL${saQueryString ? `&${saQueryString.slice(1)}` : ""}`}
            >
              <Button variant="outline" className="w-full justify-start">
                <Clock className="mr-2 h-4 w-4" />
                Review Pending Approvals ({pendingResidents?.total ?? 0})
              </Button>
            </Link>
            <Link href={`/admin/fees${saQueryString}`}>
              <Button variant="outline" className="w-full justify-start">
                <CreditCard className="mr-2 h-4 w-4" />
                Manage Fee Collection
              </Button>
            </Link>
            <Link href={`/admin/expenses${saQueryString}`}>
              <Button variant="outline" className="w-full justify-start">
                <IndianRupee className="mr-2 h-4 w-4" />
                Log an Expense
              </Button>
            </Link>
            <Link href={`/admin/broadcast${saQueryString}`}>
              <Button variant="outline" className="w-full justify-start">
                <Users className="mr-2 h-4 w-4" />
                Send Broadcast
              </Button>
            </Link>
          </CardContent>
        </Card>

        {expenseSummary && expenseSummary.categoryBreakdown.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Expense Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {expenseSummary.categoryBreakdown.slice(0, 5).map((cat) => (
                <div key={cat.category} className="flex items-center justify-between text-sm">
                  <span className="capitalize">
                    {cat.category.toLowerCase().replace(/_/g, " ")}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">{cat.percentage}%</span>
                    <span className="font-medium">
                      {"\u20B9"}
                      {cat.total.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
