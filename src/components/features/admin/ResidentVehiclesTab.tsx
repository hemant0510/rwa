"use client";

import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Car, Check, ExternalLink, Loader2, Pencil, X } from "lucide-react";
import { toast } from "sonner";

import { VEHICLE_TYPE_LABELS } from "@/components/features/vehicles/VehicleCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/input";
import {
  type AdminVehicle,
  type AdminVehicleUpdateInput,
  getResidentVehicles,
  updateAdminVehicle,
} from "@/services/admin-residents";

interface ResidentVehiclesTabProps {
  residentId: string;
}

type EditableField = "parkingSlot" | "stickerNumber" | "evSlot" | "validFrom" | "validTo";

interface EditingState {
  vehicleId: string;
  field: EditableField;
  value: string;
}

const FIELD_LABELS: Record<EditableField, string> = {
  parkingSlot: "Parking Slot",
  stickerNumber: "Sticker #",
  evSlot: "EV Slot",
  validFrom: "Valid From",
  validTo: "Valid To",
};

const DATE_FIELDS: EditableField[] = ["validFrom", "validTo"];

export function ResidentVehiclesTab({ residentId }: ResidentVehiclesTabProps) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-resident", residentId, "vehicles"],
    queryFn: () => getResidentVehicles(residentId),
  });

  const [editing, setEditing] = useState<EditingState | null>(null);

  const updateMutation = useMutation({
    mutationFn: (args: { id: string; data: AdminVehicleUpdateInput }) =>
      updateAdminVehicle(args.id, args.data),
    onSuccess: () => {
      toast.success("Vehicle updated");
      void queryClient.invalidateQueries({ queryKey: ["admin-resident", residentId, "vehicles"] });
      setEditing(null);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update vehicle");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="text-primary h-6 w-6 animate-spin" aria-hidden="true" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-4 text-center">
        <p className="text-sm text-red-700">Unable to load vehicles.</p>
        <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  /* v8 ignore start */
  const vehicles: AdminVehicle[] = data ?? [];
  /* v8 ignore stop */

  if (vehicles.length === 0) {
    return (
      <EmptyState
        icon={<Car className="text-muted-foreground h-8 w-8" />}
        title="No vehicles"
        description="This resident has not registered any vehicles yet."
      />
    );
  }

  function handleEditStart(vehicleId: string, field: EditableField, current: string | null) {
    setEditing({ vehicleId, field, value: current ?? "" });
  }

  function handleEditSave() {
    if (!editing) return;
    const value = editing.value.trim() === "" ? null : editing.value;
    updateMutation.mutate({
      id: editing.vehicleId,
      data: { [editing.field]: value } as AdminVehicleUpdateInput,
    });
  }

  function handleEditCancel() {
    setEditing(null);
  }

  return (
    <div className="space-y-4">
      {vehicles.map((v) => (
        <div
          key={v.id}
          className={`rounded-md border ${v.isActive ? "bg-white" : "bg-muted/30 opacity-70"} p-4 shadow-sm`}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-semibold">{v.registrationNumber}</span>
                <Badge variant="secondary" className="text-xs">
                  {VEHICLE_TYPE_LABELS[v.vehicleType] ?? v.vehicleType}
                </Badge>
                {!v.isActive && (
                  <Badge variant="outline" className="border-slate-200 text-xs text-slate-500">
                    Inactive
                  </Badge>
                )}
              </div>
              <p className="text-muted-foreground mt-1 text-xs">
                {[v.make, v.model, v.colour].filter(Boolean).join(" · ") || "—"}
                {v.unit?.displayLabel && ` · Unit ${v.unit.displayLabel}`}
                {v.owner?.name && ` · Owner: ${v.owner.name}`}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              {v.rcDocSignedUrl && (
                <a
                  href={v.rcDocSignedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary inline-flex items-center gap-1 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  RC
                </a>
              )}
              {v.insuranceSignedUrl && (
                <a
                  href={v.insuranceSignedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary inline-flex items-center gap-1 hover:underline"
                >
                  <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  Insurance
                </a>
              )}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {(Object.keys(FIELD_LABELS) as EditableField[]).map((field) => {
              const isEditing = editing?.vehicleId === v.id && editing.field === field;
              const value =
                field === "parkingSlot"
                  ? v.parkingSlot
                  : field === "stickerNumber"
                    ? v.stickerNumber
                    : field === "evSlot"
                      ? v.evSlot
                      : field === "validFrom"
                        ? v.validFrom
                        : v.validTo;
              return (
                <div key={field} className="flex flex-col gap-1">
                  <span className="text-muted-foreground text-[10px] font-medium uppercase">
                    {FIELD_LABELS[field]}
                  </span>
                  {isEditing ? (
                    <div className="flex items-center gap-1">
                      <Input
                        aria-label={`${FIELD_LABELS[field]} input`}
                        value={editing.value}
                        type={DATE_FIELDS.includes(field) ? "date" : "text"}
                        onChange={(e) =>
                          setEditing((prev) =>
                            /* v8 ignore next */
                            prev ? { ...prev, value: e.target.value } : null,
                          )
                        }
                        className="h-7 text-xs"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-emerald-600"
                        aria-label={`Save ${FIELD_LABELS[field]}`}
                        disabled={updateMutation.isPending}
                        onClick={handleEditSave}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-slate-500"
                        aria-label={`Cancel ${FIELD_LABELS[field]}`}
                        onClick={handleEditCancel}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-slate-700">{value || "—"}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-muted-foreground h-6 w-6"
                        aria-label={`Edit ${FIELD_LABELS[field]}`}
                        onClick={() => handleEditStart(v.id, field, value)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
