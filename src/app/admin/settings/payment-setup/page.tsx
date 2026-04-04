"use client";

import { useQuery } from "@tanstack/react-query";

import { PaymentSetupForm } from "@/components/features/settings/PaymentSetupForm";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { useSocietyId } from "@/hooks/useSocietyId";
import { getPaymentSetup } from "@/services/payment-setup";

export default function PaymentSetupPage() {
  const { societyId } = useSocietyId();

  const { data, isLoading } = useQuery({
    queryKey: ["payment-setup", societyId],
    queryFn: () => getPaymentSetup(societyId),
    enabled: !!societyId,
  });

  if (isLoading || !data) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment Setup"
        description="Configure UPI payment details for fee collection"
      />
      <PaymentSetupForm societyId={societyId} initialValues={data} />
    </div>
  );
}
