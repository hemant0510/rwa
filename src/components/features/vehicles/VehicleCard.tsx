"use client";

import { Bike, Car, CircleSlash, MapPin, Pencil, Trash2, Truck, User, Zap } from "lucide-react";

import { ExpiryBadge, type ExpiryStatus } from "@/components/features/vehicles/ExpiryBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Vehicle } from "@/services/vehicles";

export const VEHICLE_TYPE_LABELS: Record<string, string> = {
  TWO_WHEELER: "Two-wheeler",
  TWO_WHEELER_EV: "Two-wheeler (EV)",
  FOUR_WHEELER: "Four-wheeler",
  FOUR_WHEELER_EV: "Four-wheeler (EV)",
  BICYCLE: "Bicycle",
  COMMERCIAL: "Commercial",
  OTHER: "Other",
};

export const VEHICLE_TYPE_ICONS: Record<string, typeof Car> = {
  TWO_WHEELER: Bike,
  TWO_WHEELER_EV: Zap,
  FOUR_WHEELER: Car,
  FOUR_WHEELER_EV: Zap,
  BICYCLE: Bike,
  COMMERCIAL: Truck,
  OTHER: CircleSlash,
};

interface VehicleCardProps {
  vehicle: Vehicle;
  onEdit: (vehicle: Vehicle) => void;
  onDeactivate: (vehicle: Vehicle) => void;
}

function formatRegDisplay(reg: string): string {
  // Pretty-format: DL3CAB1234 → DL 3C AB 1234
  const m = reg.match(/^([A-Z]{2})(\d{1,2})([A-Z]{1,3})(\d{4})$/);
  if (!m) return reg;
  return `${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
}

export function VehicleCard({ vehicle, onEdit, onDeactivate }: VehicleCardProps) {
  const TypeIcon = VEHICLE_TYPE_ICONS[vehicle.vehicleType] ?? Car;
  const typeLabel = VEHICLE_TYPE_LABELS[vehicle.vehicleType] ?? vehicle.vehicleType;
  const ownerLabel = vehicle.dependentOwner?.name
    ? `Owned by: ${vehicle.dependentOwner.name}`
    : "Self";
  const makeModel = [vehicle.make, vehicle.model].filter(Boolean).join(" ");

  return (
    <Card className="border-0 shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div
              aria-hidden="true"
              className="bg-primary/10 text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-md"
            >
              <TypeIcon className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p
                aria-label={`Registration ${vehicle.registrationNumber}`}
                className="truncate font-mono text-sm font-semibold tracking-wide text-slate-900"
              >
                {formatRegDisplay(vehicle.registrationNumber)}
              </p>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="text-xs font-medium">
                  {typeLabel}
                </Badge>
                {makeModel && <span className="text-muted-foreground text-xs">{makeModel}</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {vehicle.colour && (
            <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700">
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 rounded-full border border-slate-300"
                style={{ backgroundColor: vehicle.colour.toLowerCase() }}
              />
              {vehicle.colour}
            </span>
          )}
          <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
            <User className="h-3 w-3" aria-hidden="true" />
            {ownerLabel}
          </span>
          {vehicle.parkingSlot && (
            <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
              <MapPin className="h-3 w-3" aria-hidden="true" />
              Slot {vehicle.parkingSlot}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <ExpiryBadge
            label="Insurance"
            date={vehicle.insuranceExpiry}
            status={vehicle.insuranceStatus as ExpiryStatus}
          />
          <ExpiryBadge
            label="PUC"
            date={vehicle.pucExpiry}
            status={vehicle.pucStatus as ExpiryStatus}
          />
          <ExpiryBadge
            label="RC"
            date={vehicle.rcExpiry}
            status={vehicle.rcStatus as ExpiryStatus}
          />
        </div>

        <div className="flex justify-end gap-2 border-t pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => onEdit(vehicle)}
            aria-label={`Edit vehicle ${vehicle.registrationNumber}`}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-red-600 hover:text-red-700"
            onClick={() => onDeactivate(vehicle)}
            aria-label={`Deactivate vehicle ${vehicle.registrationNumber}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Deactivate
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
