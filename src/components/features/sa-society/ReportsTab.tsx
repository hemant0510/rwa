"use client";

import { FileText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const REPORT_TYPES = [
  {
    type: "fee-collection",
    label: "Fee Collection Report",
    description: "Summary of all fee collections by session",
  },
  {
    type: "expense-summary",
    label: "Expense Summary",
    description: "Category-wise expense breakdown",
  },
  {
    type: "resident-directory",
    label: "Resident Directory",
    description: "Complete list of all residents with contact info",
  },
  {
    type: "financial-statement",
    label: "Financial Statement",
    description: "Income vs expenses with balance",
  },
];

interface ReportsTabProps {
  societyId: string;
  onGenerate?: (type: string) => void;
}

export function ReportsTab({ societyId, onGenerate }: ReportsTabProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {REPORT_TYPES.map((report) => (
        <Card key={report.type}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4" />
              {report.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-3 text-xs">{report.description}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onGenerate?.(report.type)}
              data-society-id={societyId}
            >
              Generate
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
