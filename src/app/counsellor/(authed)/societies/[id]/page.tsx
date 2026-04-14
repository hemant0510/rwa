"use client";

import { useState } from "react";

import Link from "next/link";
import { useParams } from "next/navigation";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";

import { ResidentDirectoryReadOnly } from "@/components/features/counsellor/ResidentDirectoryReadOnly";
import { SocietyProfileReadOnly } from "@/components/features/counsellor/SocietyProfileReadOnly";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getSociety,
  getSocietyGoverningBody,
  getSocietyResidents,
} from "@/services/counsellor-self";

export default function CounsellorSocietyDetailPage() {
  const params = useParams<{ id: string }>();
  const societyId = params.id;
  const [activeTab, setActiveTab] = useState<"profile" | "residents" | "governing-body">("profile");

  const societyQuery = useQuery({
    queryKey: ["counsellor-society", societyId],
    queryFn: () => getSociety(societyId),
  });

  return (
    <div className="space-y-6">
      <Link
        href="/counsellor/societies"
        className="text-muted-foreground inline-flex items-center gap-1 text-xs hover:underline"
      >
        <ArrowLeft className="h-3 w-3" /> Back to societies
      </Link>

      <PageHeader
        title={societyQuery.data?.name ?? "Society"}
        description={
          societyQuery.data
            ? `${societyQuery.data.societyCode} · ${societyQuery.data.city}, ${societyQuery.data.state}`
            : undefined
        }
      />

      {societyQuery.isLoading && <CardSkeleton />}

      {societyQuery.error && (
        <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-4 text-sm">
          Failed to load society: {societyQuery.error.message}
        </div>
      )}

      {societyQuery.data && (
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as typeof activeTab)}
          className="space-y-4"
        >
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="residents">Residents</TabsTrigger>
            <TabsTrigger value="governing-body">Governing body</TabsTrigger>
          </TabsList>

          <TabsContent value="profile">
            <SocietyProfileReadOnly society={societyQuery.data} />
          </TabsContent>

          <TabsContent value="residents">
            <ResidentsTab societyId={societyId} />
          </TabsContent>

          <TabsContent value="governing-body">
            <GoverningBodyTab societyId={societyId} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function ResidentsTab({ societyId }: { societyId: string }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const { data, isLoading, error } = useQuery({
    queryKey: ["counsellor-society-residents", societyId, page, search],
    queryFn: () => getSocietyResidents(societyId, { page, pageSize: 20, search }),
  });

  if (error) {
    return (
      <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-4 text-sm">
        Failed to load residents: {error.message}
      </div>
    );
  }

  return (
    <ResidentDirectoryReadOnly
      societyId={societyId}
      residents={data?.residents ?? []}
      total={data?.total ?? 0}
      page={data?.page ?? page}
      pageSize={data?.pageSize ?? 20}
      search={search}
      onSearchChange={(v) => {
        setSearch(v);
        setPage(1);
      }}
      onPageChange={setPage}
      isLoading={isLoading}
    />
  );
}

function GoverningBodyTab({ societyId }: { societyId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["counsellor-society-governing-body", societyId],
    queryFn: () => getSocietyGoverningBody(societyId),
  });

  if (isLoading) return <p className="text-muted-foreground text-sm">Loading members…</p>;

  if (error) {
    return (
      <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-4 text-sm">
        Failed to load governing body: {error.message}
      </div>
    );
  }

  if (!data || data.members.length === 0) {
    return (
      <EmptyState
        title="No governing body yet"
        description="This society has not assigned any office bearers."
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Office bearers</CardTitle>
      </CardHeader>
      <CardContent className="divide-y p-0">
        {data.members.map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{m.name}</p>
              <p className="text-muted-foreground truncate text-xs">
                {m.designation} · {m.email}
                {m.mobile && ` · ${m.mobile}`}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
