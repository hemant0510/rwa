"use client";

import { useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { BulkReminderSheet } from "@/components/features/billing/BulkReminder";
import { BillingDashboardStats } from "@/components/features/billing/DashboardStats";
import { ExpiringSubscriptionsPanel } from "@/components/features/billing/ExpiringPanel";
import { SubscriptionListTable } from "@/components/features/billing/SubscriptionList";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getBillingDashboard,
  getExpiringSubscriptions,
  getSubscriptionList,
} from "@/services/billing";

export default function SuperAdminBillingPage() {
  const [status, setStatus] = useState("all");

  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ["sa-billing-dashboard"],
    queryFn: getBillingDashboard,
  });
  const { data: subscriptions = [], isLoading: subscriptionsLoading } = useQuery({
    queryKey: ["sa-billing-subscriptions", status],
    queryFn: () => getSubscriptionList({ status }),
  });
  const { data: expiring = [] } = useQuery({
    queryKey: ["sa-billing-expiring"],
    queryFn: () => getExpiringSubscriptions(30),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Billing" description="Subscription billing dashboard for all societies">
        <BulkReminderSheet
          societies={subscriptions.map((s: { societyId: string; societyName: string }) => ({
            id: s.societyId,
            name: s.societyName,
          }))}
        />
      </PageHeader>

      {!dashboardLoading && dashboard ? <BillingDashboardStats data={dashboard} /> : null}

      <ExpiringSubscriptionsPanel items={expiring} />

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="TRIAL">Trial</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="EXPIRED">Expired</SelectItem>
              <SelectItem value="SUSPENDED">Suspended</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {subscriptionsLoading ? (
          <p className="text-muted-foreground text-sm">Loading subscriptions...</p>
        ) : (
          <SubscriptionListTable rows={subscriptions} />
        )}
      </div>
    </div>
  );
}
