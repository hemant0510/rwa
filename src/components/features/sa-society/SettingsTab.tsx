"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface SocietySettings {
  emailVerificationRequired?: boolean;
  joiningFee?: number;
  annualFee?: number;
  gracePeriodDays?: number;
  feeSessionStartMonth?: number;
}

interface SettingsTabProps {
  settings: SocietySettings | undefined;
  isLoading: boolean;
}

const MONTH_NAMES = [
  "",
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function SettingsTab({ settings, isLoading }: SettingsTabProps) {
  if (isLoading) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (!settings)
    return <p className="text-muted-foreground py-8 text-center text-sm">Settings not available</p>;

  const items = [
    {
      label: "Email Verification Required",
      value: settings.emailVerificationRequired ? "Yes" : "No",
    },
    {
      label: "Joining Fee",
      value:
        settings.joiningFee !== undefined
          ? `\u20B9${settings.joiningFee.toLocaleString("en-IN")}`
          : "—",
    },
    {
      label: "Annual Fee",
      value:
        settings.annualFee !== undefined
          ? `\u20B9${settings.annualFee.toLocaleString("en-IN")}`
          : "—",
    },
    {
      label: "Grace Period",
      value: settings.gracePeriodDays !== undefined ? `${settings.gracePeriodDays} days` : "—",
    },
    {
      label: "Fee Session Start",
      value: settings.feeSessionStartMonth ? MONTH_NAMES[settings.feeSessionStartMonth] : "—",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Society Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {items.map((item) => (
          <div key={item.label} className="flex justify-between">
            <span className="text-muted-foreground">{item.label}</span>
            <span className="font-medium">{item.value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
