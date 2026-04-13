"use client";

import { useState } from "react";

import Link from "next/link";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

import { FamilyMemberCard } from "@/components/features/family/FamilyMemberCard";
import { FamilyMemberDialog } from "@/components/features/family/FamilyMemberDialog";
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
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { type FamilyMember, deleteFamilyMember, getFamilyMembers } from "@/services/family";

const MEMBER_LIMIT = 15;

export default function ResidentFamilyPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<FamilyMember | null>(null);
  const [removingMember, setRemovingMember] = useState<FamilyMember | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["family"],
    queryFn: getFamilyMembers,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteFamilyMember(id),
    onSuccess: () => {
      toast.success("Family member removed");
      void queryClient.invalidateQueries({ queryKey: ["family"] });
      void queryClient.invalidateQueries({ queryKey: ["profile-summary"] });
      setRemovingMember(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to remove family member");
    },
  });

  function handleAdd() {
    setEditingMember(null);
    setDialogOpen(true);
  }

  function handleEdit(member: FamilyMember) {
    setEditingMember(member);
    setDialogOpen(true);
  }

  function handleRemove(member: FamilyMember) {
    setRemovingMember(member);
  }

  function handleSaved() {
    void queryClient.invalidateQueries({ queryKey: ["family"] });
    void queryClient.invalidateQueries({ queryKey: ["profile-summary"] });
  }

  if (isLoading) return <PageSkeleton />;

  if (isError) {
    return (
      <div className="space-y-4">
        <BackHeader />
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700">Unable to load family members.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  /* v8 ignore next */
  const members = data ?? [];
  const limitReached = members.length >= MEMBER_LIMIT;

  return (
    <div className="space-y-4">
      <BackHeader>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={limitReached ? 0 : -1}>
                <Button onClick={handleAdd} disabled={limitReached} className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Add Member
                </Button>
              </span>
            </TooltipTrigger>
            {limitReached && (
              <TooltipContent>Maximum {MEMBER_LIMIT} members allowed</TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      </BackHeader>

      {limitReached && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
          {members.length}/{MEMBER_LIMIT} members — remove one to add new
        </div>
      )}

      {members.length === 0 ? (
        <EmptyState
          icon={<Users className="text-muted-foreground h-8 w-8" />}
          title="No family members yet"
          description="Add your spouse, children, parents, or other dependents who live with you."
          action={
            <Button onClick={handleAdd} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Add your first family member
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {members.map((m) => (
            <FamilyMemberCard key={m.id} member={m} onEdit={handleEdit} onRemove={handleRemove} />
          ))}
        </div>
      )}

      <FamilyMemberDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        member={editingMember}
        onSaved={handleSaved}
      />

      <AlertDialog
        open={removingMember !== null}
        onOpenChange={(open) => !open && setRemovingMember(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove family member?</AlertDialogTitle>
            <AlertDialogDescription>
              {removingMember
                ? `${removingMember.name} will be removed from your household. This can be undone by re-adding them.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={removeMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                /* v8 ignore start */
                if (removingMember) removeMutation.mutate(removingMember.id);
                /* v8 ignore stop */
              }}
            >
              {/* v8 ignore start */}
              {removeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {/* v8 ignore stop */}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BackHeader({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Link
        href="/r/profile"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Profile
      </Link>
      {children}
    </div>
  );
}
