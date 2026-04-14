"use client";

import { useState } from "react";

import Link from "next/link";
import { useParams } from "next/navigation";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Mail, PauseCircle, PlayCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { CounsellorProfileCard } from "@/components/features/sa-counsellors/CounsellorProfileCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  deleteCounsellor,
  getCounsellor,
  resendCounsellorInvite,
  updateCounsellor,
} from "@/services/counsellors";

export default function CounsellorDetailPage() {
  /* v8 ignore start */
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  /* v8 ignore stop */
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ["counsellor", id],
    queryFn: () => getCounsellor(id),
  });

  const toggleActive = useMutation({
    mutationFn: (next: boolean) => updateCounsellor(id, { isActive: next }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["counsellor", id] });
      queryClient.invalidateQueries({ queryKey: ["counsellors"] });
      toast.success(result.isActive ? "Counsellor reactivated" : "Counsellor suspended");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resendInvite = useMutation({
    mutationFn: () => resendCounsellorInvite(id),
    onSuccess: () => toast.success("Invitation email resent"),
    onError: (e: Error) => toast.error(e.message),
  });

  const removeCounsellor = useMutation({
    mutationFn: () => deleteCounsellor(id),
    onSuccess: () => {
      toast.success("Counsellor removed");
      globalThis.location.href = "/sa/counsellors";
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setConfirmDelete(false);
    },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/sa/counsellors"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="h-4 w-4" /> Back to counsellors
      </Link>

      <PageHeader
        title={data?.name ?? "Counsellor"}
        description="Profile and lifecycle controls."
      />

      {isLoading && <CardSkeleton />}

      {error && (
        <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-4 text-sm">
          Failed to load counsellor: {error.message}
        </div>
      )}

      {data && (
        <>
          <CounsellorProfileCard counsellor={data} />

          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            {data.isActive && !data.mfaEnrolledAt && (
              <Button
                variant="outline"
                onClick={() => resendInvite.mutate()}
                disabled={resendInvite.isPending}
              >
                <Mail className="mr-1 h-4 w-4" />
                {/* v8 ignore start */}
                {resendInvite.isPending ? "Sending..." : "Resend invite"}
                {/* v8 ignore stop */}
              </Button>
            )}

            {data.isActive ? (
              <Button
                variant="outline"
                onClick={() => toggleActive.mutate(false)}
                disabled={toggleActive.isPending}
              >
                <PauseCircle className="mr-1 h-4 w-4" />
                Suspend
              </Button>
            ) : (
              <Button
                variant="outline"
                onClick={() => toggleActive.mutate(true)}
                disabled={toggleActive.isPending}
              >
                <PlayCircle className="mr-1 h-4 w-4" />
                Reactivate
              </Button>
            )}

            <div className="flex-1" />

            <Button
              variant="destructive"
              onClick={() => setConfirmDelete(true)}
              disabled={removeCounsellor.isPending}
            >
              <Trash2 className="mr-1 h-4 w-4" />
              Remove
            </Button>
          </div>
        </>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this counsellor?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the counsellor, cascade-revoke all assignments, and
              disable the Supabase Auth account. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeCounsellor.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removeCounsellor.mutate()}
              disabled={removeCounsellor.isPending}
            >
              {removeCounsellor.isPending ? "Removing..." : "Yes, remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
