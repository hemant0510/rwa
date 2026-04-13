"use client";

import { useState } from "react";

import { useQuery } from "@tanstack/react-query";
import {
  ChevronLeft,
  ChevronRight,
  Home,
  Info,
  Loader2,
  Mail,
  Phone,
  Search,
  Users,
} from "lucide-react";

import { VehicleSearchTab } from "@/components/features/directory/VehicleSearchTab";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { fetchResidentDirectory } from "@/services/resident-directory";

const OWNERSHIP_LABELS: Record<string, string> = {
  OWNER: "Owner",
  TENANT: "Tenant",
  OTHER: "Other",
};

const OWNERSHIP_COLORS: Record<string, string> = {
  OWNER: "border-green-200 bg-green-50 text-green-700",
  TENANT: "border-blue-200 bg-blue-50 text-blue-700",
  OTHER: "border-gray-200 bg-gray-50 text-gray-600",
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function ResidentDirectoryPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading } = useQuery({
    queryKey: ["resident-directory", search, page],
    queryFn: () => fetchResidentDirectory({ search: search || undefined, page, limit }),
    enabled: !!user,
  });

  const residents = data?.residents ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / limit);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Resident Directory</h1>
          <p className="text-muted-foreground text-sm">Members of your society</p>
        </div>
        {total > 0 && (
          <span className="text-muted-foreground text-sm tabular-nums">
            {total} {total === 1 ? "resident" : "residents"}
          </span>
        )}
      </div>

      <Tabs defaultValue="people">
        <TabsList>
          <TabsTrigger value="people">People</TabsTrigger>
          <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
        </TabsList>

        <TabsContent value="people" className="space-y-4">
          <div className="bg-primary/5 text-primary flex items-start gap-2 rounded-md border border-blue-100 px-3 py-2 text-xs">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <p>
              Only residents who have opted in to the directory appear here. You can change your own
              visibility in your Profile → Directory Settings.
            </p>
          </div>

          <div className="relative max-w-sm">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
              aria-label="Search residents"
            />
          </div>

          {isLoading ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <Loader2 className="text-primary h-8 w-8 animate-spin" />
            </div>
          ) : residents.length === 0 ? (
            <EmptyState
              icon={<Users className="text-muted-foreground h-8 w-8" />}
              title="No residents found"
              description={
                search ? "Try a different search term." : "No other residents in your society yet."
              }
            />
          ) : (
            <>
              <div className="bg-card divide-y rounded-xl border shadow-sm">
                {residents.map((resident) => (
                  <div
                    key={resident.id}
                    className="hover:bg-muted/40 flex items-center gap-4 px-4 py-3.5 transition-colors sm:px-5"
                  >
                    <Avatar size="lg">
                      {resident.photoUrl && (
                        <AvatarImage src={resident.photoUrl} alt={resident.name} />
                      )}
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {getInitials(resident.name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold">{resident.name}</span>
                        {resident.ownershipType && (
                          <Badge
                            variant="outline"
                            className={`text-[10px] leading-tight ${OWNERSHIP_COLORS[resident.ownershipType] ?? ""}`}
                          >
                            {OWNERSHIP_LABELS[resident.ownershipType] ?? resident.ownershipType}
                          </Badge>
                        )}
                      </div>
                      <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-5 gap-y-1 text-xs">
                        {resident.unit && (
                          <span className="flex items-center gap-1.5">
                            <Home className="h-3 w-3 shrink-0" />
                            {resident.unit}
                          </span>
                        )}
                        <span className="flex items-center gap-1.5">
                          <Mail className="h-3 w-3 shrink-0" />
                          <span className="truncate">{resident.email}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Phone className="h-3 w-3 shrink-0" />
                          {resident.mobile}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between">
                  <p className="text-muted-foreground text-xs">
                    Page {page} of {totalPages}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="vehicles">
          <VehicleSearchTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
