"use client";

import { useEffect, useRef, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { type Resolver, useForm } from "react-hook-form";
import { toast } from "sonner";

import { RegistrationNumberInput } from "@/components/features/vehicles/RegistrationNumberInput";
import {
  VEHICLE_TYPE_ICONS,
  VEHICLE_TYPE_LABELS,
} from "@/components/features/vehicles/VehicleCard";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { compressImage } from "@/lib/utils/compress-image";
import { type VehicleInput, vehicleSchema } from "@/lib/validations/vehicle";
import {
  createVehicle,
  updateVehicle,
  uploadVehicleInsurance,
  uploadVehiclePhoto,
  uploadVehicleRc,
  type Vehicle,
} from "@/services/vehicles";

interface ResidentUnit {
  id: string;
  displayLabel: string;
}

interface DependentOption {
  id: string;
  name: string;
}

interface VehicleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: Vehicle | null;
  units: ResidentUnit[];
  dependents: DependentOption[];
  onSaved: () => void;
}

type FormValues = VehicleInput;

const VEHICLE_TYPE_OPTIONS = Object.entries(VEHICLE_TYPE_LABELS) as Array<[string, string]>;

const SELF_VALUE = "__self__";

function emptyDefaults(units: ResidentUnit[]): FormValues {
  return {
    registrationNumber: "",
    vehicleType: "FOUR_WHEELER",
    make: "",
    model: "",
    colour: "",
    unitId: units[0]?.id ?? "",
    dependentOwnerId: null,
    parkingSlot: "",
    insuranceExpiry: undefined,
    pucExpiry: undefined,
    rcExpiry: undefined,
    fastagId: "",
    notes: "",
  } as unknown as FormValues;
}

function vehicleToDefaults(vehicle: Vehicle): FormValues {
  return {
    registrationNumber: vehicle.registrationNumber,
    vehicleType: vehicle.vehicleType as FormValues["vehicleType"],
    make: vehicle.make ?? "",
    model: vehicle.model ?? "",
    colour: vehicle.colour ?? "",
    unitId: vehicle.unitId,
    dependentOwnerId: vehicle.dependentOwnerId,
    parkingSlot: vehicle.parkingSlot ?? "",
    insuranceExpiry: vehicle.insuranceExpiry ?? undefined,
    pucExpiry: vehicle.pucExpiry ?? undefined,
    rcExpiry: vehicle.rcExpiry ?? undefined,
    fastagId: vehicle.fastagId ?? "",
    notes: vehicle.notes ?? "",
  } as unknown as FormValues;
}

export function VehicleDialog({
  open,
  onOpenChange,
  vehicle,
  units,
  dependents,
  onSaved,
}: VehicleDialogProps) {
  const photoRef = useRef<HTMLInputElement>(null);
  const rcRef = useRef<HTMLInputElement>(null);
  const insuranceRef = useRef<HTMLInputElement>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [rcFile, setRcFile] = useState<File | null>(null);
  const [insuranceFile, setInsuranceFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [duplicateError, setDuplicateError] = useState<string | null>(null);
  const [limitError, setLimitError] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(vehicleSchema) as unknown as Resolver<FormValues>,
    defaultValues: vehicle ? vehicleToDefaults(vehicle) : emptyDefaults(units),
  });

  useEffect(() => {
    if (open) {
      form.reset(vehicle ? vehicleToDefaults(vehicle) : emptyDefaults(units));
      setPhotoFile(null);
      setRcFile(null);
      setInsuranceFile(null);
      setDuplicateError(null);
      setLimitError(null);
    }
  }, [open, vehicle, units, form]);

  const errors = form.formState.errors;
  const dependentSelectValue = form.watch("dependentOwnerId") ?? SELF_VALUE;

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setDuplicateError(null);
    setLimitError(null);

    try {
      const cleaned: FormValues = {
        ...values,
        make: values.make || undefined,
        model: values.model || undefined,
        colour: values.colour || undefined,
        parkingSlot: values.parkingSlot || undefined,
        fastagId: values.fastagId || undefined,
        notes: values.notes || undefined,
        insuranceExpiry: values.insuranceExpiry || undefined,
        pucExpiry: values.pucExpiry || undefined,
        rcExpiry: values.rcExpiry || undefined,
      };

      const saved = vehicle
        ? await updateVehicle(vehicle.id, cleaned)
        : await createVehicle(cleaned);

      if (photoFile) {
        toast.info("Uploading photo…");
        try {
          const compressed = await compressImage(photoFile);
          await uploadVehiclePhoto(saved.id, compressed);
        } catch {
          toast.error("Photo upload failed — vehicle saved");
        }
      }
      if (rcFile) {
        toast.info("Uploading RC…");
        try {
          await uploadVehicleRc(saved.id, rcFile);
        } catch {
          toast.error("RC upload failed — vehicle saved");
        }
      }
      if (insuranceFile) {
        toast.info("Uploading insurance…");
        try {
          await uploadVehicleInsurance(saved.id, insuranceFile);
        } catch {
          toast.error("Insurance upload failed — vehicle saved");
        }
      }

      toast.success(vehicle ? "Vehicle updated" : "Vehicle added");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save vehicle";
      if (/already registered/i.test(msg)) {
        setDuplicateError(msg);
      } else if (/limit/i.test(msg)) {
        setLimitError(msg);
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  }

  const showUnitDropdown = units.length > 1;
  const singleUnitLabel = units[0]?.displayLabel ?? "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{vehicle ? "Edit Vehicle" : "Add Vehicle"}</DialogTitle>
          <DialogDescription>
            {vehicle
              ? "Update the vehicle's details below."
              : "Register a vehicle parked at your unit."}
          </DialogDescription>
        </DialogHeader>

        {limitError && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {limitError}
          </div>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Registration Number */}
          <div className="space-y-1.5">
            <Label htmlFor="veh-reg">
              Registration Number <span className="text-destructive">*</span>
            </Label>
            <RegistrationNumberInput
              id="veh-reg"
              value={form.watch("registrationNumber") ?? ""}
              onChange={(v) => {
                form.setValue("registrationNumber", v, { shouldValidate: false });
                if (duplicateError) setDuplicateError(null);
              }}
              aria-invalid={!!errors.registrationNumber || !!duplicateError}
              aria-describedby={duplicateError ? "veh-reg-dup" : undefined}
            />
            {errors.registrationNumber && (
              <p className="text-destructive text-xs">{errors.registrationNumber.message}</p>
            )}
            {duplicateError && (
              <p id="veh-reg-dup" className="text-destructive text-xs">
                {duplicateError}
              </p>
            )}
          </div>

          {/* Vehicle Type */}
          <div className="space-y-1.5">
            <Label htmlFor="veh-type">
              Vehicle Type <span className="text-destructive">*</span>
            </Label>
            <Select
              value={form.watch("vehicleType")}
              onValueChange={(v) => form.setValue("vehicleType", v as FormValues["vehicleType"])}
            >
              <SelectTrigger id="veh-type" className="w-full">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {VEHICLE_TYPE_OPTIONS.map(([key, label]) => {
                  const Icon = VEHICLE_TYPE_ICONS[key];
                  return (
                    <SelectItem key={key} value={key}>
                      <span className="inline-flex items-center gap-2">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                        {label}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="veh-make">Make</Label>
              <Input id="veh-make" {...form.register("make")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="veh-model">Model</Label>
              <Input id="veh-model" {...form.register("model")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="veh-colour">Colour</Label>
              <Input id="veh-colour" {...form.register("colour")} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="veh-slot">Parking Slot</Label>
              <Input id="veh-slot" {...form.register("parkingSlot")} />
            </div>
          </div>

          {/* Unit */}
          <div className="space-y-1.5">
            <Label htmlFor="veh-unit">
              Unit <span className="text-destructive">*</span>
            </Label>
            {showUnitDropdown ? (
              <Select
                value={form.watch("unitId")}
                onValueChange={(v) => form.setValue("unitId", v)}
              >
                <SelectTrigger id="veh-unit" className="w-full">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.displayLabel}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input id="veh-unit" value={singleUnitLabel} disabled readOnly />
            )}
            {errors.unitId && <p className="text-destructive text-xs">Please select a unit</p>}
          </div>

          {/* Dependent Owner */}
          <div className="space-y-1.5">
            <Label htmlFor="veh-owner">Owner</Label>
            <Select
              value={dependentSelectValue}
              onValueChange={(v) => form.setValue("dependentOwnerId", v === SELF_VALUE ? null : v)}
            >
              <SelectTrigger id="veh-owner" className="w-full">
                <SelectValue placeholder="Self" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SELF_VALUE}>Self</SelectItem>
                {dependents.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="veh-ins-exp">Insurance Expiry</Label>
              <Input
                id="veh-ins-exp"
                type="date"
                {...form.register("insuranceExpiry", {
                  setValueAs: (v: string) => (v === "" ? undefined : v),
                })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="veh-puc-exp">PUC Expiry</Label>
              <Input
                id="veh-puc-exp"
                type="date"
                {...form.register("pucExpiry", {
                  setValueAs: (v: string) => (v === "" ? undefined : v),
                })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="veh-rc-exp">RC Expiry</Label>
              <Input
                id="veh-rc-exp"
                type="date"
                {...form.register("rcExpiry", {
                  setValueAs: (v: string) => (v === "" ? undefined : v),
                })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="veh-fastag">FASTag ID</Label>
            <Input id="veh-fastag" {...form.register("fastagId")} />
          </div>

          {/* File uploads */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="veh-photo">Vehicle Photo</Label>
              <Input
                id="veh-photo"
                ref={photoRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) =>
                  /* v8 ignore next */
                  setPhotoFile(e.target.files?.[0] ?? null)
                }
              />
              {photoFile && (
                <p className="text-muted-foreground text-xs">Selected: {photoFile.name}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="veh-rc-doc">RC Document</Label>
              <Input
                id="veh-rc-doc"
                ref={rcRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) =>
                  /* v8 ignore next */
                  setRcFile(e.target.files?.[0] ?? null)
                }
              />
              {rcFile && <p className="text-muted-foreground text-xs">Selected: {rcFile.name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="veh-ins-doc">Insurance Document</Label>
              <Input
                id="veh-ins-doc"
                ref={insuranceRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) =>
                  /* v8 ignore next */
                  setInsuranceFile(e.target.files?.[0] ?? null)
                }
              />
              {insuranceFile && (
                <p className="text-muted-foreground text-xs">Selected: {insuranceFile.name}</p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="veh-notes">Notes</Label>
            <Textarea
              id="veh-notes"
              rows={2}
              maxLength={300}
              placeholder="Optional notes (e.g. company-leased)."
              {...form.register("notes")}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {/* v8 ignore start */}
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {/* v8 ignore stop */}
              {vehicle ? "Save Changes" : "Add Vehicle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
