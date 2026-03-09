"use client";

import { Building2, ChevronDown } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";

const ROLE_COLORS: Record<string, string> = {
  RWA_ADMIN: "border-blue-200 bg-blue-50 text-blue-700",
  RESIDENT: "border-green-200 bg-green-50 text-green-700",
};

const ROLE_LABELS: Record<string, string> = {
  RWA_ADMIN: "Admin",
  RESIDENT: "Resident",
};

export function SocietySwitcher() {
  const { user, switchSociety } = useAuth();

  const societies = user?.societies;
  if (!societies || societies.length < 2) return null;

  const currentName = user.societyName ?? "Select Society";
  const currentSociety = societies.find((s) => s.societyId === user.societyId);
  const otherSocieties = societies.filter((s) => s.societyId !== user.societyId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="hover:bg-accent flex items-center gap-2 rounded-md px-1 py-0.5 text-left transition-colors">
        <Building2 className="text-primary h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <span className="block truncate text-lg leading-tight font-semibold">{currentName}</span>
          {currentSociety && (
            <span className="text-muted-foreground block text-xs leading-tight">
              {currentSociety.designation ??
                ROLE_LABELS[currentSociety.role] ??
                currentSociety.role}
            </span>
          )}
        </div>
        <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
          Switch Society
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {otherSocieties.map((s) => (
            <DropdownMenuItem
              key={s.societyId}
              onClick={() => switchSociety(s.societyId)}
              className="cursor-pointer"
            >
              <div className="flex w-full items-center gap-3">
                <div className="bg-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
                  <Building2 className="text-muted-foreground h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.name ?? s.code ?? "Unknown"}</p>
                  <div className="flex items-center gap-1.5">
                    {s.code && (
                      <span className="text-muted-foreground font-mono text-xs">{s.code}</span>
                    )}
                    <Badge
                      variant="outline"
                      className={`h-4 px-1 text-[10px] leading-none ${s.designation ? "border-amber-300 bg-amber-50 text-amber-700" : (ROLE_COLORS[s.role] ?? "")}`}
                    >
                      {s.designation ?? ROLE_LABELS[s.role] ?? s.role}
                    </Badge>
                  </div>
                </div>
              </div>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
