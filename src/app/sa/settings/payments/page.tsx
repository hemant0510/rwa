"use client";

import { useQuery } from "@tanstack/react-query";

import { PlatformPaymentSetupForm } from "@/components/features/settings/PlatformPaymentSetupForm";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { getPlatformPaymentSetup } from "@/services/payment-setup";

export default function PlatformPaymentSetupPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["platform-payment-setup"],
    queryFn: getPlatformPaymentSetup,
  });

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Setup"
        description="Configure platform UPI details for subscription payment collection"
      />

      {data && <PlatformPaymentSetupForm initialValues={data} />}
    </div>
  );
}
