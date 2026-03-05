"use client";

import { useState } from "react";

import { Download, FileText, CreditCard, Receipt, Users, BarChart3 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/PageHeader";

const REPORTS = [
  {
    id: "fee-collection",
    title: "Fee Collection Report",
    description: "Session-wise fee collection status for all residents",
    icon: CreditCard,
    formats: ["PDF", "Excel"],
  },
  {
    id: "expense-ledger",
    title: "Expense Ledger",
    description: "Category-wise expense breakdown with totals",
    icon: Receipt,
    formats: ["PDF", "Excel"],
  },
  {
    id: "resident-directory",
    title: "Resident Directory",
    description: "Complete list of active residents with contact details",
    icon: Users,
    formats: ["PDF", "Excel"],
  },
  {
    id: "financial-summary",
    title: "Financial Summary",
    description: "Income vs expense summary with balance sheet",
    icon: BarChart3,
    formats: ["PDF"],
  },
  {
    id: "outstanding-dues",
    title: "Outstanding Dues",
    description: "List of residents with pending or overdue payments",
    icon: FileText,
    formats: ["PDF", "Excel"],
  },
];

export default function ReportsPage() {
  const [generating, setGenerating] = useState<string | null>(null);

  const handleGenerate = async (reportId: string, format: string) => {
    setGenerating(`${reportId}-${format}`);
    try {
      // TODO: Call report generation API
      await new Promise((r) => setTimeout(r, 1500));
      toast.success(`${format} report generated! Download will start shortly.`);
    } catch {
      toast.error("Failed to generate report");
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Generate and download reports" />

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
                {report.formats.map((format) => (
                  <Button
                    key={format}
                    variant="outline"
                    size="sm"
                    disabled={generating === `${report.id}-${format}`}
                    onClick={() => handleGenerate(report.id, format)}
                  >
                    <Download className="mr-1 h-3 w-3" />
                    {format}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
