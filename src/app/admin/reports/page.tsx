"use client";

import { useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Download, FileText, CreditCard, Receipt, Users, BarChart3, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { getReportSummary, downloadReport, type ReportType } from "@/services/reports";

function getAvailableSessions(currentSession: string): string[] {
  const [startYearStr] = currentSession.split("-");
  const startYear = parseInt(startYearStr);
  const sessions: string[] = [];
  for (let y = startYear; y >= startYear - 4; y--) {
    sessions.push(`${y}-${String(y + 1).slice(2)}`);
  }
  return sessions;
}

const REPORTS: {
  id: ReportType;
  title: string;
  description: string;
  icon: React.ElementType;
  formats: ("pdf" | "excel")[];
  needsSession: boolean;
}[] = [
  {
    id: "paid-list",
    title: "Fee Collection Report",
    description: "Session-wise fee collection status for paid residents",
    icon: CreditCard,
    formats: ["pdf", "excel"],
    needsSession: true,
  },
  {
    id: "expense-summary",
    title: "Expense Ledger",
    description: "Category-wise expense breakdown with totals",
    icon: Receipt,
    formats: ["pdf", "excel"],
    needsSession: true,
  },
  {
    id: "directory",
    title: "Resident Directory",
    description: "Complete list of active residents with contact details",
    icon: Users,
    formats: ["pdf", "excel"],
    needsSession: false,
  },
  {
    id: "collection-summary",
    title: "Financial Summary",
    description: "Income vs expense summary with balance sheet",
    icon: BarChart3,
    formats: ["pdf", "excel"],
    needsSession: true,
  },
  {
    id: "pending-list",
    title: "Outstanding Dues",
    description: "List of residents with pending or overdue payments",
    icon: FileText,
    formats: ["pdf", "excel"],
    needsSession: true,
  },
];

export default function ReportsPage() {
  const { user } = useAuth();
  const societyId = user?.societyId ?? "";

  const [generating, setGenerating] = useState<string | null>(null);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ["report-summary", societyId],
    queryFn: () => getReportSummary(societyId),
    enabled: !!societyId,
  });

  const currentSession = summary?.sessionYear ?? "";
  const [selectedSession, setSelectedSession] = useState<string>("");

  const activeSession = selectedSession || currentSession;
  const availableSessions = currentSession ? getAvailableSessions(currentSession) : [];

  const handleGenerate = async (reportId: ReportType, format: "pdf" | "excel") => {
    if (!societyId) return;
    const key = `${reportId}-${format}`;
    setGenerating(key);
    try {
      await downloadReport(societyId, reportId, format, activeSession || undefined);
      toast.success(`${format.toUpperCase()} report downloaded`);
    } catch {
      toast.error("Failed to generate report");
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Generate and download reports" />

      {/* Session selector + live summary */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-6 pt-6">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Session</span>
            {summaryLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Select
                value={activeSession}
                onValueChange={setSelectedSession}
                disabled={availableSessions.length === 0}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Select session" />
                </SelectTrigger>
                <SelectContent>
                  {availableSessions.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {summary && (
            <>
              <div className="text-center">
                <p className="text-lg font-bold text-green-600">{summary.paidCount}</p>
                <p className="text-muted-foreground text-xs">Paid</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold text-red-500">{summary.pendingCount}</p>
                <p className="text-muted-foreground text-xs">Pending</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold">
                  ₹{summary.totalCollected.toLocaleString("en-IN")}
                </p>
                <p className="text-muted-foreground text-xs">Collected</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold">
                  ₹{summary.totalExpenses.toLocaleString("en-IN")}
                </p>
                <p className="text-muted-foreground text-xs">Expenses</p>
              </div>
              <div className="text-center">
                <p
                  className={`text-lg font-bold ${summary.balance >= 0 ? "text-green-600" : "text-red-500"}`}
                >
                  ₹{summary.balance.toLocaleString("en-IN")}
                </p>
                <p className="text-muted-foreground text-xs">Balance</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {REPORTS.map((report) => (
          <Card key={report.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <report.icon className="text-primary h-4 w-4" />
                {report.title}
              </CardTitle>
              <CardDescription>{report.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {report.formats.map((format) => {
                  const key = `${report.id}-${format}`;
                  return (
                    <Button
                      key={format}
                      variant="outline"
                      size="sm"
                      disabled={generating === key || !societyId}
                      onClick={() => handleGenerate(report.id, format)}
                    >
                      {generating === key ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Download className="mr-1 h-3 w-3" />
                      )}
                      {format.toUpperCase()}
                    </Button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
