"use client";

import Link from "next/link";

import { AlertTriangle, Car, ChevronRight } from "lucide-react";

import {
  DeclarationToggle,
  type DeclarationStatus,
} from "@/components/features/profile/DeclarationToggle";
import { Card, CardContent } from "@/components/ui/card";

export interface VehicleExpiryAlert {
  id: string;
  registrationNumber: string;
  rcStatus: string;
  insuranceStatus: string;
  pucStatus: string;
}

interface ProfileVehiclesCardProps {
  vehicleCount: number;
  firstReg: string | null;
  vehicleStatus: DeclarationStatus;
  expiryAlerts: VehicleExpiryAlert[];
  onDeclareNone: () => void;
  onUndoDeclaration: () => void;
  pending?: boolean;
}

function expiringBadges(alert: VehicleExpiryAlert): string[] {
  const out: string[] = [];
  if (alert.rcStatus === "EXPIRED") out.push("RC expired");
  else if (alert.rcStatus === "EXPIRING_SOON") out.push("RC expiring");
  if (alert.insuranceStatus === "EXPIRED") out.push("Insurance expired");
  else if (alert.insuranceStatus === "EXPIRING_SOON") out.push("Insurance expiring");
  if (alert.pucStatus === "EXPIRED") out.push("PUC expired");
  else if (alert.pucStatus === "EXPIRING_SOON") out.push("PUC expiring");
  return out;
}

export function ProfileVehiclesCard({
  vehicleCount,
  firstReg,
  vehicleStatus,
  expiryAlerts,
  onDeclareNone,
  onUndoDeclaration,
  pending = false,
}: ProfileVehiclesCardProps) {
  const hasVehicles = vehicleCount > 0;

  return (
    <Card className="border-0 shadow-md">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className="bg-primary/10 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg">
              <Car className="text-primary h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800">Vehicles</p>
              <p className="text-muted-foreground truncate text-xs">
                {hasVehicles
                  ? firstReg
                    ? `${vehicleCount} registered · ${firstReg}`
                    : `${vehicleCount} registered`
                  : "Declare or register your vehicle"}
              </p>
            </div>
          </div>
          {hasVehicles && (
            <Link
              href="/r/profile/vehicles"
              className="text-primary inline-flex shrink-0 items-center gap-1 text-xs font-medium hover:underline"
              aria-label="View vehicles"
            >
              View vehicles
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>

        {hasVehicles && expiryAlerts.length > 0 && (
          <ul className="mt-3 space-y-1.5 border-t pt-3">
            {expiryAlerts.map((a) => {
              const tags = expiringBadges(a);
              if (tags.length === 0) return null;
              return (
                <li key={a.id} className="flex items-center gap-2 text-xs text-amber-700">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="font-mono text-slate-700">{a.registrationNumber}</span>
                  <span className="text-amber-700">— {tags.join(", ")}</span>
                </li>
              );
            })}
          </ul>
        )}

        {!hasVehicles && (
          <div className="mt-3 border-t pt-3">
            <DeclarationToggle
              status={vehicleStatus}
              declareLabel="I don't have any vehicles"
              declaredLabel="You've declared no vehicles"
              onDeclareNone={onDeclareNone}
              onUndo={onUndoDeclaration}
              pending={pending}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
