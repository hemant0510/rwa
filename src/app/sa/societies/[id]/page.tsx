"use client";

import { use, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  Building2,
  CreditCard,
  Copy,
  IndianRupee,
  LayoutDashboard,
  Loader2,
  Pencil,
  Shield,
  Trash2,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { SubscriptionStatusCard } from "@/components/features/subscription/SubscriptionStatusCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { INDIAN_STATES, APP_URL } from "@/lib/constants";
import { activateAdmin, deleteSociety, getSociety } from "@/services/societies";
import type { ActivateAdminInput } from "@/services/societies";
import { SOCIETY_TYPE_LABELS } from "@/types/society";

type AdminMode = "new" | "existing";

export default function SocietyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);

  // Activate admin form state
  const [adminMode, setAdminMode] = useState<AdminMode>("new");
  const [permission, setPermission] = useState<"FULL_ACCESS" | "READ_NOTIFY">("FULL_ACCESS");
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newMobile, setNewMobile] = useState("");
  const [residentSearch, setResidentSearch] = useState("");
  const [residentResults, setResidentResults] = useState<
    { id: string; name: string; email: string; mobile: string | null }[]
  >([]);
  const [residentSearching, setResidentSearching] = useState(false);
  const [selectedResidentId, setSelectedResidentId] = useState("");

  const { data: society, isLoading } = useQuery({
    queryKey: ["societies", id],
    queryFn: () => getSociety(id),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteSociety(id),
    onSuccess: () => {
      toast.success("Society deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["societies"] });
      router.push("/sa/societies");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const activateMutation = useMutation({
    mutationFn: (data: ActivateAdminInput) => activateAdmin(id, data),
    onSuccess: (res) => {
      toast.success(res.message);
      queryClient.invalidateQueries({ queryKey: ["societies", id] });
      setActivateOpen(false);
      resetActivateForm();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function resetActivateForm() {
    setAdminMode("new");
    setPermission("FULL_ACCESS");
    setNewName("");
    setNewEmail("");
    setNewPassword("");
    setNewMobile("");
    setResidentSearch("");
    setResidentResults([]);
    setSelectedResidentId("");
  }

  async function searchResidents(query: string) {
    setResidentSearch(query);
    setSelectedResidentId("");
    if (query.length < 2) {
      setResidentResults([]);
      return;
    }
    setResidentSearching(true);
    try {
      const res = await fetch(
        `/api/v1/residents?societyId=${id}&search=${encodeURIComponent(query)}&limit=10&status=ACTIVE`,
      );
      if (res.ok) {
        const json = (await res.json()) as {
          data: { id: string; name: string; email: string; mobile: string | null }[];
        };
        setResidentResults(json.data);
      }
    } finally {
      setResidentSearching(false);
    }
  }

  function handleActivateSubmit() {
    if (adminMode === "existing") {
      if (!selectedResidentId) {
        toast.error("Please select a resident");
        return;
      }
      activateMutation.mutate({
        name: "",
        email: "",
        permission,
        existingUserId: selectedResidentId,
      });
    } else {
      if (!newName || !newEmail || !newPassword) {
        toast.error("Name, email, and password are required");
        return;
      }
      activateMutation.mutate({
        name: newName,
        email: newEmail,
        password: newPassword,
        mobile: newMobile || undefined,
        permission,
      });
    }
  }

  if (isLoading) return <PageSkeleton />;
  if (!society) return <p className="text-muted-foreground">Society not found.</p>;

  const registrationUrl = `${APP_URL}/register/${society.societyCode}`;
  const primaryAdmin = society.admins?.find((a) => a.adminPermission === "FULL_ACCESS");
  const supportingAdmin = society.admins?.find((a) => a.adminPermission === "READ_NOTIFY");
  const canAddPrimary = !primaryAdmin;
  const canAddSupporting = !supportingAdmin;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/sa/societies">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <PageHeader title={society.name}>
          <Badge
            variant="outline"
            className={
              society.status === "ACTIVE"
                ? "border-green-200 bg-green-50 text-green-700"
                : society.status === "TRIAL"
                  ? "border-yellow-200 bg-yellow-50 text-yellow-700"
                  : "border-red-200 bg-red-50 text-red-700"
            }
          >
            {society.status}
          </Badge>
        </PageHeader>
      </div>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/admin/dashboard?sid=${society.id}&sname=${encodeURIComponent(society.name)}&scode=${encodeURIComponent(society.societyCode)}`}
        >
          <Button variant="default" size="sm">
            <LayoutDashboard className="mr-2 h-4 w-4" />
            View Dashboard
          </Button>
        </Link>
        <Link href={`/sa/societies/${id}/edit`}>
          <Button variant="outline" size="sm">
            <Pencil className="mr-2 h-4 w-4" />
            Edit Society
          </Button>
        </Link>
        <Link href={`/sa/societies/${id}/billing`}>
          <Button variant="outline" size="sm">
            <CreditCard className="mr-2 h-4 w-4" />
            Billing
          </Button>
        </Link>
        <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Society
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {society.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the society, all its residents, fees, and expenses. The
                admin&apos;s login account will also be removed. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 rounded-lg p-2">
                <Users className="text-primary h-5 w-5" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Total Residents</p>
                <p className="text-2xl font-bold">{society.residentCount ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900/30">
                <IndianRupee className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Fees Collected</p>
                <p className="text-2xl font-bold">
                  ₹{(society.feeStats?.totalCollected ?? 0).toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
                <Wallet className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Current Balance</p>
                <p className="text-2xl font-bold">
                  ₹{(society.balance ?? 0).toLocaleString("en-IN")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Society Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Society Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow label="Society ID" value={society.societyId} />
            <DetailRow label="Code" value={society.societyCode} />
            <DetailRow label="Type" value={SOCIETY_TYPE_LABELS[society.type] || society.type} />
            <DetailRow label="State" value={INDIAN_STATES[society.state] || society.state} />
            <DetailRow label="City" value={society.city} />
            <DetailRow label="Pincode" value={society.pincode} />
            <DetailRow
              label="Onboarded"
              value={format(new Date(society.onboardingDate), "dd MMM yyyy")}
            />
          </CardContent>
        </Card>

        {/* Fee Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-4 w-4" />
              Fee Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow
              label="Joining Fee"
              value={`₹${Number(society.joiningFee).toLocaleString("en-IN")}`}
            />
            <DetailRow
              label="Annual Fee"
              value={`₹${Number(society.annualFee).toLocaleString("en-IN")}`}
            />
            <DetailRow label="Grace Period" value={`${society.gracePeriodDays} days`} />
            <DetailRow label="Session Start" value="April" />
            <DetailRow label="Plan" value={society.plan} />
          </CardContent>
        </Card>
      </div>

      <SubscriptionStatusCard societyId={id} />

      {/* Admin Team */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Admin Team
          </CardTitle>
          {(canAddPrimary || canAddSupporting) && (
            <Button size="sm" onClick={() => setActivateOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Activate Admin
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {!primaryAdmin && !supportingAdmin && (
            <p className="text-muted-foreground text-sm">
              No admins activated yet. Use &quot;Activate Admin&quot; to add the primary admin.
            </p>
          )}
          {primaryAdmin && (
            <AdminRow
              label="Primary Admin"
              name={primaryAdmin.name}
              email={primaryAdmin.email}
              mobile={primaryAdmin.mobile}
              hasLogin={!!primaryAdmin.authUserId}
              since={primaryAdmin.createdAt}
            />
          )}
          {supportingAdmin && (
            <AdminRow
              label="Supporting Admin"
              name={supportingAdmin.name}
              email={supportingAdmin.email}
              mobile={supportingAdmin.mobile}
              hasLogin={!!supportingAdmin.authUserId}
              since={supportingAdmin.createdAt}
            />
          )}
        </CardContent>
      </Card>

      {/* Registration Link */}
      <Card>
        <CardHeader>
          <CardTitle>Registration Link</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-muted/50 flex items-center gap-2 rounded-md border px-3 py-2">
            <code className="flex-1 truncate text-sm">{registrationUrl}</code>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                navigator.clipboard.writeText(registrationUrl);
                toast.success("Link copied!");
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-muted-foreground mt-2 text-sm">
            Share this link with residents to register for this society.
          </p>
        </CardContent>
      </Card>

      {/* Activate Admin Sheet */}
      <Sheet
        open={activateOpen}
        onOpenChange={(open) => {
          setActivateOpen(open);
          if (!open) resetActivateForm();
        }}
      >
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Activate Admin</SheetTitle>
            <SheetDescription>
              Add a Primary or Supporting admin for {society.name}.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5 py-5">
            {/* Permission */}
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={permission}
                onValueChange={(v) => setPermission(v as "FULL_ACCESS" | "READ_NOTIFY")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FULL_ACCESS" disabled={!canAddPrimary}>
                    Primary Admin (Full Access){!canAddPrimary ? " — already exists" : ""}
                  </SelectItem>
                  <SelectItem value="READ_NOTIFY" disabled={!canAddSupporting}>
                    Supporting Admin (Read + Notify){!canAddSupporting ? " — already exists" : ""}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Mode toggle */}
            <div className="space-y-2">
              <Label>Admin source</Label>
              <Tabs value={adminMode} onValueChange={(v) => setAdminMode(v as AdminMode)}>
                <TabsList className="w-full">
                  <TabsTrigger value="new" className="flex-1">
                    New Admin
                  </TabsTrigger>
                  <TabsTrigger value="existing" className="flex-1">
                    Existing Resident
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {adminMode === "new" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label htmlFor="adminName">
                    Full Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="adminName"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Rajesh Kumar"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="adminEmail">
                    Email <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="adminEmail"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="admin@eden.com"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="adminPassword">
                    Password <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="adminPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 8 characters"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="adminMobile">Mobile (Optional)</Label>
                  <div className="flex gap-2">
                    <span className="bg-muted text-muted-foreground flex items-center rounded-md border px-3 text-sm">
                      +91
                    </span>
                    <Input
                      id="adminMobile"
                      value={newMobile}
                      onChange={(e) => setNewMobile(e.target.value)}
                      placeholder="9876543210"
                      maxLength={10}
                    />
                  </div>
                </div>
              </div>
            )}

            {adminMode === "existing" && (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label>Search Resident</Label>
                  <Input
                    value={residentSearch}
                    onChange={(e) => searchResidents(e.target.value)}
                    placeholder="Search by name or email..."
                  />
                  {residentSearching && <p className="text-muted-foreground text-xs">Searching…</p>}
                  {residentResults.length > 0 && (
                    <div className="mt-1 max-h-48 space-y-1 overflow-y-auto rounded-md border p-2">
                      {residentResults.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                            selectedResidentId === r.id
                              ? "bg-primary text-primary-foreground"
                              : "hover:bg-accent"
                          }`}
                          onClick={() => setSelectedResidentId(r.id)}
                        >
                          <div className="font-medium">{r.name}</div>
                          <div className="text-xs opacity-70">{r.email}</div>
                        </button>
                      ))}
                    </div>
                  )}
                  {residentSearch.length >= 2 &&
                    !residentSearching &&
                    residentResults.length === 0 && (
                      <p className="text-muted-foreground text-xs">No residents found.</p>
                    )}
                </div>
              </div>
            )}
          </div>

          <SheetFooter>
            <Button
              onClick={handleActivateSubmit}
              disabled={activateMutation.isPending}
              className="w-full"
            >
              {activateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Activate Admin
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

interface AdminRowProps {
  label: string;
  name: string;
  email: string;
  mobile: string | null;
  hasLogin: boolean;
  since: string;
}

function AdminRow({ label, name, email, mobile, hasLogin, since }: AdminRowProps) {
  return (
    <div className="flex items-start justify-between rounded-md border px-4 py-3">
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{name}</span>
          {!hasLogin && (
            <Badge
              variant="outline"
              className="border-yellow-200 bg-yellow-50 text-xs text-yellow-700"
            >
              No login
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground text-xs">{email}</p>
        {mobile && <p className="text-muted-foreground text-xs">{mobile}</p>}
      </div>
      <div className="text-right">
        <Badge variant="outline" className="text-xs">
          {label}
        </Badge>
        <p className="text-muted-foreground mt-1 text-xs">
          Since {format(new Date(since), "dd MMM yyyy")}
        </p>
      </div>
    </div>
  );
}
