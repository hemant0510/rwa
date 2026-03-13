"use client";

import { use, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  Building2,
  CreditCard,
  Copy,
  LayoutDashboard,
  Pencil,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { SubscriptionStatusCard } from "@/components/features/subscription/SubscriptionStatusCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { INDIAN_STATES, APP_URL } from "@/lib/constants";
import { getSociety, deleteSociety } from "@/services/societies";
import { SOCIETY_TYPE_LABELS } from "@/types/society";

export default function SocietyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const { data: society, isLoading } = useQuery({
    queryKey: ["societies", id],
    queryFn: () => getSociety(id),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteSociety(id),
    onSuccess: () => {
      toast.success("Society deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["societies"] });
      router.push("/sa/societies");
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  if (isLoading) return <PageSkeleton />;
  if (!society) return <p className="text-muted-foreground">Society not found.</p>;

  const registrationUrl = `${APP_URL}/register/${society.societyCode}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/sa/societies">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <PageHeader title={society.name}>
          <Badge
            variant="outline"
            className={
              society.status === "ACTIVE"
                ? "border-green-200 bg-green-50 text-green-700"
                : society.status === "TRIAL"
                  ? "border-yellow-200 bg-yellow-50 text-yellow-700"
                  : "border-red-200 bg-red-50 text-red-700"
            }
          >
            {society.status}
          </Badge>
        </PageHeader>
      </div>

      <div className="flex gap-2">
        <Link
          href={`/admin/dashboard?sid=${society.id}&sname=${encodeURIComponent(society.name)}&scode=${encodeURIComponent(society.societyCode)}`}
        >
          <Button variant="default" size="sm">
            <LayoutDashboard className="mr-2 h-4 w-4" />
            View Dashboard
          </Button>
        </Link>
        <Link href={`/sa/societies/${id}/edit`}>
          <Button variant="outline" size="sm">
            <Pencil className="mr-2 h-4 w-4" />
            Edit Society
          </Button>
        </Link>
        <Link href={`/sa/societies/${id}/billing`}>
          <Button variant="outline" size="sm">
            <CreditCard className="mr-2 h-4 w-4" />
            Billing
          </Button>
        </Link>
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Society
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {society.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the society, all its residents, fees, and expenses. The
                admin&apos;s login account will also be removed. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Society Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow label="Society ID" value={society.societyId} />
            <DetailRow label="Code" value={society.societyCode} />
            <DetailRow label="Type" value={SOCIETY_TYPE_LABELS[society.type] || society.type} />
            <DetailRow label="State" value={INDIAN_STATES[society.state] || society.state} />
            <DetailRow label="City" value={society.city} />
            <DetailRow label="Pincode" value={society.pincode} />
            <DetailRow
              label="Onboarded"
              value={format(new Date(society.onboardingDate), "dd MMM yyyy")}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Fee Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow
              label="Joining Fee"
              value={`\u20B9${Number(society.joiningFee).toLocaleString("en-IN")}`}
            />
            <DetailRow
              label="Annual Fee"
              value={`\u20B9${Number(society.annualFee).toLocaleString("en-IN")}`}
            />
            <DetailRow label="Grace Period" value={`${society.gracePeriodDays} days`} />
            <DetailRow label="Session Start" value="April" />
            <DetailRow label="Plan" value={society.plan} />
          </CardContent>
        </Card>
      </div>

      <SubscriptionStatusCard societyId={id} />

      <Card>
        <CardHeader>
          <CardTitle>Registration Link</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/50 flex items-center gap-2 rounded-md border px-3 py-2">
            <code className="flex-1 truncate text-sm">{registrationUrl}</code>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                navigator.clipboard.writeText(registrationUrl);
                toast.success("Link copied!");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-muted-foreground mt-2 text-sm">
            Share this link or generate a QR poster for residents to register.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
