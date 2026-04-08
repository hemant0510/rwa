"use client";

import { useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { Home, Loader2, Mail, Phone, Search, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { fetchResidentDirectory } from "@/services/resident-directory";

const OWNERSHIP_LABELS: Record<string, string> = {
  OWNER: "Owner",
  TENANT: "Tenant",
  OTHER: "Other",
};

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
      <div>
        <h1 className="text-2xl font-bold">Resident Directory</h1>
        <p className="text-muted-foreground text-sm">Members of your society</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder="Search by name or email..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="pl-9"
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
          <p className="text-muted-foreground text-sm">
            Showing {residents.length} of {total} residents
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {residents.map((resident) => (
              <Card key={resident.id}>
                <CardContent className="space-y-3 pt-4 pb-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm leading-tight font-semibold">{resident.name}</h3>
                    {resident.ownershipType && (
                      <Badge variant="outline" className="shrink-0 text-xs">
                        {OWNERSHIP_LABELS[resident.ownershipType] ?? resident.ownershipType}
                      </Badge>
                    )}
                  </div>

                  <div className="text-muted-foreground space-y-1.5 text-xs">
                    {resident.unit && (
                      <div className="flex items-center gap-2">
                        <Home className="h-3.5 w-3.5 shrink-0" />
                        <span>{resident.unit}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{resident.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span>{resident.mobile}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="text-muted-foreground hover:text-foreground text-sm disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-muted-foreground text-sm">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="text-muted-foreground hover:text-foreground text-sm disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
