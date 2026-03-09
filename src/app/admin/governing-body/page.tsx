"use client";

import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Edit2, Loader2, Plus, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSocietyId } from "@/hooks/useSocietyId";
import {
  assignMember,
  createDesignation,
  deleteDesignation,
  fetchGoverningBody,
  removeMember,
  renameDesignation,
} from "@/services/governing-body";
import type { GoverningBodyMember } from "@/services/governing-body";

export default function GoverningBodyPage() {
  const queryClient = useQueryClient();
  const { societyId } = useSocietyId();

  const { data, isLoading } = useQuery({
    queryKey: ["governing-body"],
    queryFn: fetchGoverningBody,
  });

  const members = data?.members ?? [];
  const designations = data?.designations ?? [];

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["governing-body"] });

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Governing Body"
        description="Manage committee designations and assign members"
      />

      <DesignationsCard designations={designations} onChanged={invalidate} />

      <MembersCard
        members={members}
        designations={designations}
        societyId={societyId}
        onChanged={invalidate}
      />
    </div>
  );
}

/* ─── Designations Card ─── */

interface DesignationsCardProps {
  designations: { id: string; name: string; sortOrder: number }[];
  onChanged: () => void;
}

function DesignationsCard({ designations, onChanged }: DesignationsCardProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const addMutation = useMutation({
    mutationFn: (name: string) => createDesignation(name),
    onSuccess: (data) => {
      toast.success(data.message);
      setAddOpen(false);
      setNewName("");
      onChanged();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameDesignation(id, name),
    onSuccess: (data) => {
      toast.success(data.message);
      setEditingId(null);
      onChanged();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDesignation(id),
    onSuccess: (data) => {
      toast.success(data.message);
      onChanged();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Designations</CardTitle>
          <CardDescription>Define committee positions for your society</CardDescription>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Designation</DialogTitle>
              <DialogDescription>Create a new committee position</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <Label htmlFor="designationName">Name</Label>
              <Input
                id="designationName"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g., Chairperson"
                maxLength={50}
              />
            </div>
            <DialogFooter>
              <Button
                onClick={() => addMutation.mutate(newName)}
                disabled={addMutation.isPending || newName.trim().length < 2}
              >
                {addMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {designations.length === 0 ? (
          <EmptyState title="No designations" description="Add designations to get started." />
        ) : (
          <div className="space-y-2">
            {designations.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-md border px-4 py-2"
              >
                {editingId === d.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-8 max-w-[200px]"
                      maxLength={50}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && editName.trim().length >= 2) {
                          renameMutation.mutate({ id: d.id, name: editName.trim() });
                        }
                        if (e.key === "Escape") setEditingId(null);
                      }}
                    />
                    <Button
                      size="sm"
                      onClick={() => renameMutation.mutate({ id: d.id, name: editName.trim() })}
                      disabled={renameMutation.isPending || editName.trim().length < 2}
                    >
                      {renameMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        "Save"
                      )}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground text-xs font-medium">
                        {d.sortOrder}
                      </span>
                      <span className="text-sm font-medium">{d.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(d.id);
                          setEditName(d.name);
                        }}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(d.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Members Card ─── */

interface MembersCardProps {
  members: GoverningBodyMember[];
  designations: { id: string; name: string; sortOrder: number }[];
  societyId: string;
  onChanged: () => void;
}

function MembersCard({ members, designations, societyId, onChanged }: MembersCardProps) {
  const [assignOpen, setAssignOpen] = useState(false);
  const [residentSearch, setResidentSearch] = useState("");
  const [residents, setResidents] = useState<{ id: string; name: string; mobile: string | null }[]>(
    [],
  );
  const [searching, setSearching] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedDesignationId, setSelectedDesignationId] = useState("");

  const assignMutation = useMutation({
    mutationFn: () => assignMember(selectedUserId, selectedDesignationId),
    onSuccess: (data) => {
      toast.success(data.message);
      setAssignOpen(false);
      resetAssignForm();
      onChanged();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeMutation = useMutation({
    mutationFn: (memberId: string) => removeMember(memberId),
    onSuccess: (data) => {
      toast.success(data.message);
      onChanged();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const resetAssignForm = () => {
    setResidentSearch("");
    setResidents([]);
    setSelectedUserId("");
    setSelectedDesignationId("");
  };

  const searchResidents = async (query: string) => {
    setResidentSearch(query);
    if (query.length < 2) {
      setResidents([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(
        `/api/v1/residents?societyId=${societyId}&search=${encodeURIComponent(query)}&limit=10&status=ACTIVE`,
      );
      if (res.ok) {
        const json = (await res.json()) as {
          data: { id: string; name: string; mobile: string | null }[];
        };
        setResidents(json.data);
      }
    } finally {
      setSearching(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Members</CardTitle>
          <CardDescription>Residents assigned to governing body positions</CardDescription>
        </div>
        <Dialog
          open={assignOpen}
          onOpenChange={(open) => {
            setAssignOpen(open);
            if (!open) resetAssignForm();
          }}
        >
          <DialogTrigger asChild>
            <Button size="sm">
              <UserPlus className="mr-2 h-4 w-4" />
              Assign Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Member</DialogTitle>
              <DialogDescription>
                Search for a resident and assign them a designation
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Search Resident</Label>
                <Input
                  value={residentSearch}
                  onChange={(e) => searchResidents(e.target.value)}
                  placeholder="Search by name or mobile..."
                />
                {searching && <p className="text-muted-foreground text-xs">Searching...</p>}
                {residents.length > 0 && (
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
                    {residents.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                          selectedUserId === r.id
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-accent"
                        }`}
                        onClick={() => setSelectedUserId(r.id)}
                      >
                        <div className="font-medium">{r.name}</div>
                        {r.mobile && <div className="text-xs opacity-70">{r.mobile}</div>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Designation</Label>
                <Select value={selectedDesignationId} onValueChange={setSelectedDesignationId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select designation" />
                  </SelectTrigger>
                  <SelectContent>
                    {designations.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => assignMutation.mutate()}
                disabled={assignMutation.isPending || !selectedUserId || !selectedDesignationId}
              >
                {assignMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Assign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <EmptyState
            icon={<Crown className="text-muted-foreground h-8 w-8" />}
            title="No members assigned"
            description="Assign residents to governing body positions to get started."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Mobile</TableHead>
                  <TableHead>Designation</TableHead>
                  <TableHead className="hidden md:table-cell">Assigned</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <div className="font-medium">{m.name}</div>
                      <div className="text-muted-foreground text-xs sm:hidden">
                        {m.mobile ?? m.email}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{m.mobile ?? "—"}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="border-0 bg-purple-100 font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                      >
                        {m.designation}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
                      {new Date(m.assignedAt).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => removeMutation.mutate(m.id)}
                        disabled={removeMutation.isPending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
