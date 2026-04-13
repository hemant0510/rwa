"use client";

import { useState } from "react";

import Link from "next/link";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Car, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { VehicleCard } from "@/components/features/vehicles/VehicleCard";
import { VehicleDialog } from "@/components/features/vehicles/VehicleDialog";
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
import { getFamilyMembers } from "@/services/family";
import { deleteVehicle, getVehicles, type Vehicle } from "@/services/vehicles";

const PAGE_SIZE = 10;

interface MeResponse {
  units: Array<{ id: string; displayLabel: string }>;
}

async function fetchMe(): Promise<MeResponse> {
  const res = await fetch("/api/v1/residents/me");
  if (!res.ok) throw new Error("Failed to load profile");
  return res.json();
}

export default function ResidentVehiclesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [removing, setRemoving] = useState<Vehicle | null>(null);

  const vehiclesQuery = useQuery({
    queryKey: ["vehicles", page],
    queryFn: () => getVehicles({ page, limit: PAGE_SIZE }),
  });

  const meQuery = useQuery({ queryKey: ["me"], queryFn: fetchMe });
  const familyQuery = useQuery({ queryKey: ["family"], queryFn: getFamilyMembers });

  const removeMutation = useMutation({
    mutationFn: (id: string) => deleteVehicle(id),
    onSuccess: () => {
      toast.success("Vehicle deactivated");
      void queryClient.invalidateQueries({ queryKey: ["vehicles"] });
      void queryClient.invalidateQueries({ queryKey: ["profile-summary"] });
      setRemoving(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to deactivate vehicle");
    },
  });

  function handleAdd() {
    setEditingVehicle(null);
    setDialogOpen(true);
  }

  function handleEdit(vehicle: Vehicle) {
    setEditingVehicle(vehicle);
    setDialogOpen(true);
  }

  function handleDeactivate(vehicle: Vehicle) {
    setRemoving(vehicle);
  }

  function handleSaved() {
    void queryClient.invalidateQueries({ queryKey: ["vehicles"] });
    void queryClient.invalidateQueries({ queryKey: ["profile-summary"] });
  }

  if (vehiclesQuery.isLoading) return <PageSkeleton />;

  if (vehiclesQuery.isError) {
    return (
      <div className="space-y-4">
        <BackHeader />
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700">Unable to load vehicles.</p>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => void vehiclesQuery.refetch()}
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }

  /* v8 ignore start */
  const data = vehiclesQuery.data ?? { vehicles: [], total: 0, page: 1, limit: PAGE_SIZE };
  const units = meQuery.data?.units ?? [];
  const familyMembers = familyQuery.data ?? [];
  /* v8 ignore stop */
  const vehicles = data.vehicles;
  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const dependents = familyMembers.map((m) => ({ id: m.id, name: m.name }));

  return (
    <div className="space-y-4">
      <BackHeader>
        <Button onClick={handleAdd} className="gap-2">
          <Car className="h-4 w-4" />
          Add Vehicle
        </Button>
      </BackHeader>

      {vehicles.length === 0 ? (
        <EmptyState
          icon={<Car className="text-muted-foreground h-8 w-8" />}
          title="No vehicles registered"
          description="Add your car, bike, or any vehicle parked at your unit."
          action={
            <Button onClick={handleAdd} className="gap-2">
              <Car className="h-4 w-4" />
              Register your first vehicle
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {vehicles.map((v) => (
              <VehicleCard
                key={v.id}
                vehicle={v}
                onEdit={handleEdit}
                onDeactivate={handleDeactivate}
              />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-muted-foreground text-xs">
                Page {data.page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      <VehicleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        vehicle={editingVehicle}
        units={units}
        dependents={dependents}
        onSaved={handleSaved}
      />

      <AlertDialog open={removing !== null} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate vehicle?</AlertDialogTitle>
            <AlertDialogDescription>
              {removing
                ? `${removing.registrationNumber} will be removed from your active vehicles. Re-add to restore.`
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
                if (removing) removeMutation.mutate(removing.id);
                /* v8 ignore stop */
              }}
            >
              {/* v8 ignore start */}
              {removeMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {/* v8 ignore stop */}
              Deactivate
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
