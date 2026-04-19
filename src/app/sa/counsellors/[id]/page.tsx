"use client";

import { useState } from "react";

import Link from "next/link";
import { useParams } from "next/navigation";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, Mail, PauseCircle, PlayCircle, Plus, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { CounsellorAuditPanel } from "@/components/features/sa-counsellors/CounsellorAuditPanel";
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
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCounsellorLifecycleState } from "@/lib/counsellor/lifecycle-state";
import {
  deleteCounsellor,
  getCounsellor,
  listCounsellorAssignments,
  resendCounsellorInvite,
  revokeAssignment,
  updateCounsellor,
} from "@/services/counsellors";

export default function CounsellorDetailPage() {
  /* v8 ignore start */
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  /* v8 ignore stop */
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<{ societyId: string; name: string } | null>(
    null,
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ["counsellor", id],
    queryFn: () => getCounsellor(id),
  });

  const { data: assignmentsData, isLoading: assignmentsLoading } = useQuery({
    queryKey: ["counsellor-assignments", id],
    queryFn: () => listCounsellorAssignments(id),
    enabled: Boolean(id),
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

  const revokeOne = useMutation({
    mutationFn: (societyId: string) => revokeAssignment(id, societyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["counsellor-assignments", id] });
      queryClient.invalidateQueries({ queryKey: ["counsellor", id] });
      toast.success("Society revoked");
      setRevokeTarget(null);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setRevokeTarget(null);
    },
  });

  const assignments = assignmentsData?.assignments ?? [];

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
        description="Profile, assignments, and lifecycle controls."
      />

      {isLoading && <CardSkeleton />}

      {error && (
        <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-4 text-sm">
          Failed to load counsellor: {error.message}
        </div>
      )}

      {data && (
        <Tabs defaultValue="profile">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="societies">Societies ({assignments.length})</TabsTrigger>
            <TabsTrigger value="audit">Audit</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4 pt-4">
            <CounsellorProfileCard counsellor={data} />

            <div className="flex flex-wrap items-center gap-2 border-t pt-4">
              {(() => {
                const state = getCounsellorLifecycleState(data);
                return (
                  <>
                    {state === "INVITE_PENDING" && (
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

                    {state === "SUSPENDED" && (
                      <Button
                        variant="outline"
                        onClick={() => toggleActive.mutate(true)}
                        disabled={toggleActive.isPending}
                      >
                        <PlayCircle className="mr-1 h-4 w-4" />
                        Reactivate
                      </Button>
                    )}

                    {(state === "AWAITING_FIRST_LOGIN" || state === "ACTIVE") && (
                      <Button
                        variant="outline"
                        onClick={() => toggleActive.mutate(false)}
                        disabled={toggleActive.isPending}
                      >
                        <PauseCircle className="mr-1 h-4 w-4" />
                        Suspend
                      </Button>
                    )}
                  </>
                );
              })()}

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
          </TabsContent>

          <TabsContent value="societies" className="space-y-4 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/sa/counsellors/${id}/assign`}>
                <Button>
                  <Plus className="mr-1 h-4 w-4" />
                  Assign societies
                </Button>
              </Link>
              <Link href={`/sa/counsellors/${id}/transfer`}>
                <Button variant="outline">
                  <Repeat className="mr-1 h-4 w-4" />
                  Transfer portfolio
                </Button>
              </Link>
            </div>

            {assignmentsLoading && <CardSkeleton />}

            {!assignmentsLoading && assignments.length === 0 && (
              <EmptyState
                icon={<Plus className="text-muted-foreground h-8 w-8" />}
                title="No societies assigned yet"
                description="Use Assign societies to attach this counsellor to societies."
              />
            )}

            {assignments.length > 0 && (
              <div className="overflow-hidden rounded-md border">
                {assignments.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{a.society.name}</p>
                        {a.isPrimary && (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                            PRIMARY
                          </span>
                        )}
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {a.society.societyCode} · {a.society.city}, {a.society.state} ·{" "}
                        {a.society.totalUnits} units
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setRevokeTarget({ societyId: a.societyId, name: a.society.name })
                      }
                    >
                      Revoke
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="audit" className="space-y-4 pt-4">
            <CounsellorAuditPanel counsellorId={id} />
          </TabsContent>
        </Tabs>
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

      <AlertDialog
        open={revokeTarget !== null}
        onOpenChange={(open) => !open && setRevokeTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke {revokeTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Revoking will hide all current escalations from this counsellor&apos;s inbox. Open
              escalations will be returned to the RWA Admin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revokeOne.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => revokeTarget && revokeOne.mutate(revokeTarget.societyId)}
              disabled={revokeOne.isPending}
            >
              Yes, revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
