"use client";

import { use, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  Building2,
  CheckCircle,
  Clock,
  Copy,
  CreditCard,
  Database,
  FileBarChart,
  History,
  IndianRupee,
  LayoutDashboard,
  Loader2,
  Megaphone,
  Pencil,
  ScrollText,
  Shield,
  Trash2,
  UserPlus,
  Users,
  Wallet,
  XCircle,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { APP_URL, INDIAN_STATES } from "@/lib/constants";
import {
  getSABroadcasts,
  getSAEvents,
  getSAExpenses,
  getSAFees,
  getSAGoverningBody,
  getSAMigrations,
  getSAPetitions,
  getSAReport,
  getSAResidents,
  getSASettings,
} from "@/services/sa-society-deep-dive";
import { activateAdmin, deleteSociety, getSociety } from "@/services/societies";
import type { ActivateAdminInput } from "@/services/societies";
import { SOCIETY_TYPE_LABELS } from "@/types/society";

type AdminMode = "new" | "existing";

interface StatusChange {
  id: string;
  fromStatus: string;
  toStatus: string;
  reason: string;
  note?: string | null;
  gracePeriodEnd?: string | null;
  notifiedAdmin: boolean;
  performedBy: string;
  createdAt: string;
}

async function suspendSociety(
  id: string,
  data: { reason: string; gracePeriodDays: number; notifyAdmin: boolean },
) {
  const res = await fetch(`/api/v1/super-admin/societies/${id}/suspend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? "Failed to suspend society");
  return json as { success: boolean };
}

async function reactivateSociety(id: string, data: { note?: string; notifyAdmin: boolean }) {
  const res = await fetch(`/api/v1/super-admin/societies/${id}/reactivate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? "Failed to reactivate society");
  return json as { success: boolean };
}

async function offboardSociety(id: string, data: { reason: string; confirmationCode: string }) {
  const res = await fetch(`/api/v1/super-admin/societies/${id}/offboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? "Failed to offboard society");
  return json as { success: boolean };
}

async function getStatusHistory(id: string): Promise<StatusChange[]> {
  const res = await fetch(`/api/v1/super-admin/societies/${id}/status-history`);
  if (!res.ok) throw new Error("Failed to fetch status history");
  return res.json() as Promise<StatusChange[]>;
}

export default function SocietyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activateOpen, setActivateOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");

  // Lifecycle modal state
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [offboardOpen, setOffboardOpen] = useState(false);
  const [offboardStep, setOffboardStep] = useState(1);

  // Suspend form
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendGraceDays, setSuspendGraceDays] = useState(7);
  const [suspendNotify, setSuspendNotify] = useState(true);

  // Reactivate form
  const [reactivateNote, setReactivateNote] = useState("");
  const [reactivateNotify, setReactivateNotify] = useState(true);

  // Offboard form
  const [offboardReason, setOffboardReason] = useState("");
  const [offboardCode, setOffboardCode] = useState("");

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

  const { data: statusHistory = [] } = useQuery({
    queryKey: ["society-status-history", id],
    queryFn: () => getStatusHistory(id),
  });

  // Lazy-loaded tab queries
  const { data: residents } = useQuery({
    queryKey: ["sa-residents", id],
    queryFn: () => getSAResidents(id),
    enabled: activeTab === "residents",
  });

  const { data: fees } = useQuery({
    queryKey: ["sa-fees", id],
    queryFn: () => getSAFees(id),
    enabled: activeTab === "fees",
  });

  const { data: expenses } = useQuery({
    queryKey: ["sa-expenses", id],
    queryFn: () => getSAExpenses(id),
    enabled: activeTab === "expenses",
  });

  const { data: events } = useQuery({
    queryKey: ["sa-events", id],
    queryFn: () => getSAEvents(id),
    enabled: activeTab === "events",
  });

  const { data: petitions } = useQuery({
    queryKey: ["sa-petitions", id],
    queryFn: () => getSAPetitions(id),
    enabled: activeTab === "petitions",
  });

  const { data: broadcasts } = useQuery({
    queryKey: ["sa-broadcasts", id],
    queryFn: () => getSABroadcasts(id),
    enabled: activeTab === "broadcasts",
  });

  const { data: governingBody } = useQuery({
    queryKey: ["sa-governing-body", id],
    queryFn: () => getSAGoverningBody(id),
    enabled: activeTab === "governing-body",
  });

  const { data: migrations } = useQuery({
    queryKey: ["sa-migrations", id],
    queryFn: () => getSAMigrations(id),
    enabled: activeTab === "migrations",
  });

  const { data: settings } = useQuery({
    queryKey: ["sa-settings", id],
    queryFn: () => getSASettings(id),
    enabled: activeTab === "settings",
  });

  const { data: collectionReport } = useQuery({
    queryKey: ["sa-report-collection", id],
    queryFn: () => getSAReport(id, "collection-summary"),
    enabled: activeTab === "reports",
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

  const suspendMutation = useMutation({
    mutationFn: () =>
      suspendSociety(id, {
        reason: suspendReason,
        gracePeriodDays: suspendGraceDays,
        notifyAdmin: suspendNotify,
      }),
    onSuccess: () => {
      toast.success("Society suspended");
      queryClient.invalidateQueries({ queryKey: ["societies", id] });
      queryClient.invalidateQueries({ queryKey: ["society-status-history", id] });
      setSuspendOpen(false);
      setSuspendReason("");
      setSuspendGraceDays(7);
      setSuspendNotify(true);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const reactivateMutation = useMutation({
    mutationFn: () =>
      reactivateSociety(id, { note: reactivateNote || undefined, notifyAdmin: reactivateNotify }),
    onSuccess: () => {
      toast.success("Society reactivated");
      queryClient.invalidateQueries({ queryKey: ["societies", id] });
      queryClient.invalidateQueries({ queryKey: ["society-status-history", id] });
      setReactivateOpen(false);
      setReactivateNote("");
      setReactivateNotify(true);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const offboardMutation = useMutation({
    mutationFn: () =>
      offboardSociety(id, { reason: offboardReason, confirmationCode: offboardCode }),
    onSuccess: () => {
      toast.success("Society offboarded");
      queryClient.invalidateQueries({ queryKey: ["societies", id] });
      queryClient.invalidateQueries({ queryKey: ["society-status-history", id] });
      setOffboardOpen(false);
      setOffboardStep(1);
      setOffboardReason("");
      setOffboardCode("");
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
  const canSuspend = society.status === "ACTIVE" || society.status === "TRIAL";
  const canReactivate = society.status === "SUSPENDED";
  const canOffboard =
    society.status === "ACTIVE" || society.status === "TRIAL" || society.status === "SUSPENDED";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/sa/societies">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <PageHeader title={society.name}>
          <StatusBadge status={society.status} />
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

        {canSuspend && (
          <Button
            variant="outline"
            size="sm"
            className="border-orange-300 text-orange-700 hover:bg-orange-50"
            onClick={() => setSuspendOpen(true)}
          >
            <AlertTriangle className="mr-2 h-4 w-4" />
            Suspend
          </Button>
        )}
        {canReactivate && (
          <Button
            variant="outline"
            size="sm"
            className="border-green-300 text-green-700 hover:bg-green-50"
            onClick={() => setReactivateOpen(true)}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Reactivate
          </Button>
        )}
        {canOffboard && (
          <Button
            variant="outline"
            size="sm"
            className="border-red-300 text-red-700 hover:bg-red-50"
            onClick={() => {
              setOffboardStep(1);
              setOffboardOpen(true);
            }}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Offboard
          </Button>
        )}

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

      {/* Main content tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="residents">Residents</TabsTrigger>
          <TabsTrigger value="fees">Fees</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="petitions">Petitions</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="broadcasts">Broadcasts</TabsTrigger>
          <TabsTrigger value="governing-body">Governing Body</TabsTrigger>
          <TabsTrigger value="migrations">Migrations</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ── */}
        <TabsContent value="overview" className="space-y-6 pt-4">
          <div className="grid gap-6 md:grid-cols-2">
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

          {/* Status History timeline (moved from old Status History tab) */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Status Change History
                {statusHistory.length > 0 && (
                  <span className="bg-muted ml-1.5 rounded px-1.5 py-0.5 text-xs font-medium">
                    {statusHistory.length}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statusHistory.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  No status changes recorded yet.
                </p>
              ) : (
                <div className="relative space-y-0">
                  {statusHistory.map((change, idx) => (
                    <div key={change.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div
                          className={`mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${getStatusChangeColor(change.toStatus)}`}
                        >
                          {getStatusChangeIcon(change.toStatus)}
                        </div>
                        {idx < statusHistory.length - 1 && (
                          <div className="bg-border my-1 w-px flex-1" />
                        )}
                      </div>
                      <div className="pb-6">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {change.fromStatus} → {change.toStatus}
                          </span>
                          {change.notifiedAdmin && (
                            <Badge variant="outline" className="text-xs">
                              Admin notified
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {format(new Date(change.createdAt), "dd MMM yyyy, hh:mm a")}
                        </p>
                        <p className="mt-1 text-sm">{change.reason}</p>
                        {change.note && (
                          <p className="text-muted-foreground mt-0.5 text-sm italic">
                            Note: {change.note}
                          </p>
                        )}
                        {change.gracePeriodEnd && (
                          <p className="mt-0.5 text-sm text-orange-600">
                            <Clock className="mr-1 inline h-3 w-3" />
                            Grace period until:{" "}
                            {format(new Date(change.gracePeriodEnd), "dd MMM yyyy")}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Residents Tab ── */}
        <TabsContent value="residents" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Residents ({(residents as { total?: number } | undefined)?.total ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!residents ? (
                <p className="text-muted-foreground py-4 text-sm">Loading...</p>
              ) : (residents as { data: Record<string, unknown>[] }).data.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center text-sm">
                  No residents found.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pr-4 pb-2 font-medium">Name</th>
                        <th className="pr-4 pb-2 font-medium">RWAID</th>
                        <th className="pr-4 pb-2 font-medium">Status</th>
                        <th className="pr-4 pb-2 font-medium">Unit</th>
                        <th className="pr-4 pb-2 font-medium">Type</th>
                        <th className="pb-2 font-medium">Mobile</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(residents as { data: Record<string, unknown>[] }).data.map(
                        (r: Record<string, unknown>) => (
                          <tr key={r.id as string} className="hover:bg-muted/50">
                            <td className="py-2 pr-4 font-medium">{r.name as string}</td>
                            <td className="text-muted-foreground py-2 pr-4 font-mono text-xs">
                              {(r.rwaid as string) ?? "—"}
                            </td>
                            <td className="py-2 pr-4">
                              <Badge variant="outline" className="text-xs">
                                {r.status as string}
                              </Badge>
                            </td>
                            <td className="text-muted-foreground py-2 pr-4 text-xs">
                              {(
                                r.userUnits as Array<{ unit: { displayLabel: string } }> | undefined
                              )?.[0]?.unit?.displayLabel ?? "—"}
                            </td>
                            <td className="text-muted-foreground py-2 pr-4 text-xs">
                              {r.ownershipType as string}
                            </td>
                            <td className="text-muted-foreground py-2 text-xs">
                              {r.mobile as string}
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Fees Tab ── */}
        <TabsContent value="fees" className="pt-4">
          <div className="space-y-4">
            {!fees ? (
              <p className="text-muted-foreground py-4 text-sm">Loading...</p>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-4">
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-muted-foreground text-xs">Total Due</p>
                      <p className="text-xl font-bold">
                        ₹
                        {Number((fees as Record<string, unknown>).totalDue ?? 0).toLocaleString(
                          "en-IN",
                        )}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-muted-foreground text-xs">Collected</p>
                      <p className="text-xl font-bold text-green-600">
                        ₹
                        {Number(
                          (fees as Record<string, unknown>).totalCollected ?? 0,
                        ).toLocaleString("en-IN")}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-muted-foreground text-xs">Outstanding</p>
                      <p className="text-xl font-bold text-orange-600">
                        ₹
                        {Number(
                          (fees as Record<string, unknown>).totalOutstanding ?? 0,
                        ).toLocaleString("en-IN")}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-muted-foreground text-xs">Collection Rate</p>
                      <p className="text-xl font-bold">
                        {((fees as Record<string, unknown>).collectionRate as string) ?? "—"}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <IndianRupee className="h-4 w-4" />
                      Fee Records
                      {(fees as Record<string, unknown>).sessionYear
                        ? ` — ${(fees as Record<string, unknown>).sessionYear as string}`
                        : ""}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {((fees as { data?: Record<string, unknown>[] }).data ?? []).length === 0 ? (
                      <p className="text-muted-foreground py-4 text-center text-sm">
                        No fee records found.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left">
                              <th className="pr-4 pb-2 font-medium">Name</th>
                              <th className="pr-4 pb-2 font-medium">Unit</th>
                              <th className="pr-4 pb-2 font-medium">Amount Due</th>
                              <th className="pr-4 pb-2 font-medium">Amount Paid</th>
                              <th className="pr-4 pb-2 font-medium">Balance</th>
                              <th className="pb-2 font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {((fees as { data?: Record<string, unknown>[] }).data ?? []).map(
                              (f: Record<string, unknown>) => (
                                <tr key={f.id as string} className="hover:bg-muted/50">
                                  <td className="py-2 pr-4 font-medium">{f.name as string}</td>
                                  <td className="text-muted-foreground py-2 pr-4 text-xs">
                                    {f.unit as string}
                                  </td>
                                  <td className="py-2 pr-4">
                                    ₹{Number(f.amountDue ?? 0).toLocaleString("en-IN")}
                                  </td>
                                  <td className="py-2 pr-4 text-green-600">
                                    ₹{Number(f.amountPaid ?? 0).toLocaleString("en-IN")}
                                  </td>
                                  <td className="py-2 pr-4 text-orange-600">
                                    ₹{Number(f.balance ?? 0).toLocaleString("en-IN")}
                                  </td>
                                  <td className="py-2">
                                    <Badge variant="outline" className="text-xs">
                                      {f.status as string}
                                    </Badge>
                                  </td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </TabsContent>

        {/* ── Expenses Tab ── */}
        <TabsContent value="expenses" className="pt-4">
          <div className="space-y-4">
            {!expenses ? (
              <p className="text-muted-foreground py-4 text-sm">Loading...</p>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-muted-foreground text-xs">Total Expenses</p>
                      <p className="text-xl font-bold text-red-600">
                        ₹
                        {Number(
                          (expenses as Record<string, unknown>).totalExpenses ?? 0,
                        ).toLocaleString("en-IN")}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-4">
                      <p className="text-muted-foreground text-xs">Balance in Hand</p>
                      <p className="text-xl font-bold text-blue-600">
                        ₹
                        {Number(
                          (expenses as Record<string, unknown>).balanceInHand ?? 0,
                        ).toLocaleString("en-IN")}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Wallet className="h-4 w-4" />
                      Expense Records
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {((expenses as { data?: Record<string, unknown>[] }).data ?? []).length ===
                    0 ? (
                      <p className="text-muted-foreground py-4 text-center text-sm">
                        No expenses found.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left">
                              <th className="pr-4 pb-2 font-medium">Date</th>
                              <th className="pr-4 pb-2 font-medium">Category</th>
                              <th className="pr-4 pb-2 font-medium">Amount</th>
                              <th className="pr-4 pb-2 font-medium">Description</th>
                              <th className="pb-2 font-medium">Logged By</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {((expenses as { data?: Record<string, unknown>[] }).data ?? []).map(
                              (e: Record<string, unknown>) => (
                                <tr key={e.id as string} className="hover:bg-muted/50">
                                  <td className="text-muted-foreground py-2 pr-4 text-xs">
                                    {e.date
                                      ? format(new Date(e.date as string), "dd MMM yyyy")
                                      : "—"}
                                  </td>
                                  <td className="py-2 pr-4">
                                    <Badge variant="outline" className="text-xs">
                                      {e.category as string}
                                    </Badge>
                                  </td>
                                  <td className="py-2 pr-4 font-medium text-red-600">
                                    ₹{Number(e.amount ?? 0).toLocaleString("en-IN")}
                                  </td>
                                  <td className="text-muted-foreground py-2 pr-4 text-xs">
                                    {e.description as string}
                                  </td>
                                  <td className="text-muted-foreground py-2 text-xs">
                                    {e.loggedBy as string}
                                  </td>
                                </tr>
                              ),
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </TabsContent>

        {/* ── Events Tab ── */}
        <TabsContent value="events" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Events ({(events as { total?: number } | undefined)?.total ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!events ? (
                <p className="text-muted-foreground py-4 text-sm">Loading...</p>
              ) : (events as { data: Record<string, unknown>[] }).data.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center text-sm">No events found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pr-4 pb-2 font-medium">Title</th>
                        <th className="pr-4 pb-2 font-medium">Category</th>
                        <th className="pr-4 pb-2 font-medium">Status</th>
                        <th className="pr-4 pb-2 font-medium">Date</th>
                        <th className="pb-2 font-medium">Registrations</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(events as { data: Record<string, unknown>[] }).data.map(
                        (ev: Record<string, unknown>) => (
                          <tr key={ev.id as string} className="hover:bg-muted/50">
                            <td className="py-2 pr-4 font-medium">{ev.title as string}</td>
                            <td className="text-muted-foreground py-2 pr-4 text-xs">
                              {ev.category as string}
                            </td>
                            <td className="py-2 pr-4">
                              <Badge variant="outline" className="text-xs">
                                {ev.status as string}
                              </Badge>
                            </td>
                            <td className="text-muted-foreground py-2 pr-4 text-xs">
                              {ev.eventDate
                                ? format(new Date(ev.eventDate as string), "dd MMM yyyy")
                                : "—"}
                            </td>
                            <td className="text-muted-foreground py-2 text-xs">
                              {(ev.registrationCount as string) ?? "—"}
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Petitions Tab ── */}
        <TabsContent value="petitions" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ScrollText className="h-4 w-4" />
                Petitions ({(petitions as { total?: number } | undefined)?.total ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!petitions ? (
                <p className="text-muted-foreground py-4 text-sm">Loading...</p>
              ) : (petitions as { data: Record<string, unknown>[] }).data.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center text-sm">
                  No petitions found.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pr-4 pb-2 font-medium">Title</th>
                        <th className="pr-4 pb-2 font-medium">Type</th>
                        <th className="pr-4 pb-2 font-medium">Status</th>
                        <th className="pr-4 pb-2 font-medium">Signatures</th>
                        <th className="pb-2 font-medium">Created</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(petitions as { data: Record<string, unknown>[] }).data.map(
                        (p: Record<string, unknown>) => (
                          <tr key={p.id as string} className="hover:bg-muted/50">
                            <td className="py-2 pr-4 font-medium">{p.title as string}</td>
                            <td className="text-muted-foreground py-2 pr-4 text-xs">
                              {p.type as string}
                            </td>
                            <td className="py-2 pr-4">
                              <Badge variant="outline" className="text-xs">
                                {p.status as string}
                              </Badge>
                            </td>
                            <td className="text-muted-foreground py-2 pr-4 text-xs">
                              {(p.signatureCount as string) ?? "0"}
                            </td>
                            <td className="text-muted-foreground py-2 text-xs">
                              {p.createdAt
                                ? format(new Date(p.createdAt as string), "dd MMM yyyy")
                                : "—"}
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Reports Tab ── */}
        <TabsContent value="reports" className="pt-4">
          <div className="space-y-4">
            {!collectionReport ? (
              <p className="text-muted-foreground py-4 text-sm">Loading...</p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileBarChart className="h-4 w-4" />
                      Collection Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <DetailRow
                      label="Session Year"
                      value={
                        ((collectionReport as Record<string, unknown>).sessionYear as string) ?? "—"
                      }
                    />
                    <DetailRow
                      label="Total Due"
                      value={`₹${Number((collectionReport as Record<string, unknown>).totalDue ?? 0).toLocaleString("en-IN")}`}
                    />
                    <DetailRow
                      label="Total Collected"
                      value={`₹${Number((collectionReport as Record<string, unknown>).totalCollected ?? 0).toLocaleString("en-IN")}`}
                    />
                    <DetailRow
                      label="Outstanding"
                      value={`₹${Number((collectionReport as Record<string, unknown>).totalOutstanding ?? 0).toLocaleString("en-IN")}`}
                    />
                    <DetailRow
                      label="Collection Rate"
                      value={
                        ((collectionReport as Record<string, unknown>).collectionRate as string) ??
                        "—"
                      }
                    />
                    <DetailRow
                      label="Total Residents"
                      value={String(
                        (collectionReport as Record<string, unknown>).totalResidents ?? "—",
                      )}
                    />
                    <DetailRow
                      label="Fully Paid"
                      value={String((collectionReport as Record<string, unknown>).fullyPaid ?? "—")}
                    />
                    <DetailRow
                      label="Partially Paid"
                      value={String(
                        (collectionReport as Record<string, unknown>).partiallyPaid ?? "—",
                      )}
                    />
                    <DetailRow
                      label="Unpaid"
                      value={String((collectionReport as Record<string, unknown>).unpaid ?? "—")}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileBarChart className="h-4 w-4" />
                      Download Report
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-muted-foreground text-sm">
                      Download the full PDF collection summary report for this society.
                    </p>
                    <a
                      href={`/api/v1/societies/${id}/reports/collection-summary?format=pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" className="w-full">
                        <FileBarChart className="mr-2 h-4 w-4" />
                        Download PDF Report
                      </Button>
                    </a>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Broadcasts Tab ── */}
        <TabsContent value="broadcasts" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="h-4 w-4" />
                Broadcasts ({(broadcasts as { total?: number } | undefined)?.total ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!broadcasts ? (
                <p className="text-muted-foreground py-4 text-sm">Loading...</p>
              ) : (broadcasts as { data: Record<string, unknown>[] }).data.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center text-sm">
                  No broadcasts found.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pr-4 pb-2 font-medium">Date</th>
                        <th className="pr-4 pb-2 font-medium">Message</th>
                        <th className="pr-4 pb-2 font-medium">Filter</th>
                        <th className="pr-4 pb-2 font-medium">Count</th>
                        <th className="pb-2 font-medium">Sent By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(broadcasts as { data: Record<string, unknown>[] }).data.map(
                        (b: Record<string, unknown>) => (
                          <tr key={b.id as string} className="hover:bg-muted/50">
                            <td className="text-muted-foreground py-2 pr-4 text-xs">
                              {b.createdAt
                                ? format(new Date(b.createdAt as string), "dd MMM yyyy")
                                : "—"}
                            </td>
                            <td className="py-2 pr-4 text-xs">
                              {((b.message as string) ?? "").length > 80
                                ? `${(b.message as string).slice(0, 80)}…`
                                : (b.message as string)}
                            </td>
                            <td className="text-muted-foreground py-2 pr-4 text-xs">
                              {(b.recipientFilter as string) ?? "All"}
                            </td>
                            <td className="text-muted-foreground py-2 pr-4 text-xs">
                              {(b.recipientCount as string) ?? "—"}
                            </td>
                            <td className="text-muted-foreground py-2 text-xs">
                              {b.sentBy as string}
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Governing Body Tab ── */}
        <TabsContent value="governing-body" className="pt-4">
          <div className="space-y-4">
            {!governingBody ? (
              <p className="text-muted-foreground py-4 text-sm">Loading...</p>
            ) : (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-4 w-4" />
                      Members (
                      {
                        ((governingBody as { members?: Record<string, unknown>[] }).members ?? [])
                          .length
                      }
                      )
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {((governingBody as { members?: Record<string, unknown>[] }).members ?? [])
                      .length === 0 ? (
                      <p className="text-muted-foreground py-4 text-center text-sm">
                        No governing body members found.
                      </p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-left">
                              <th className="pr-4 pb-2 font-medium">Designation</th>
                              <th className="pr-4 pb-2 font-medium">Name</th>
                              <th className="pr-4 pb-2 font-medium">Mobile</th>
                              <th className="pb-2 font-medium">Assigned Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {(
                              (governingBody as { members?: Record<string, unknown>[] }).members ??
                              []
                            ).map((m: Record<string, unknown>) => (
                              <tr key={m.id as string} className="hover:bg-muted/50">
                                <td className="py-2 pr-4">
                                  <Badge variant="outline" className="text-xs">
                                    {m.designation as string}
                                  </Badge>
                                </td>
                                <td className="py-2 pr-4 font-medium">{m.name as string}</td>
                                <td className="text-muted-foreground py-2 pr-4 font-mono text-xs">
                                  {m.mobile
                                    ? `${(m.mobile as string).slice(0, 4)}******${(m.mobile as string).slice(-2)}`
                                    : "—"}
                                </td>
                                <td className="text-muted-foreground py-2 text-xs">
                                  {m.assignedAt
                                    ? format(new Date(m.assignedAt as string), "dd MMM yyyy")
                                    : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {(governingBody as { designations?: Record<string, unknown>[] }).designations &&
                  (
                    (governingBody as { designations?: Record<string, unknown>[] }).designations ??
                    []
                  ).length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          Designations
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {(
                            (governingBody as { designations?: Record<string, unknown>[] })
                              .designations ?? []
                          ).map((d: Record<string, unknown>) => (
                            <Badge key={d.id as string} variant="outline">
                              {d.name as string}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
              </>
            )}
          </div>
        </TabsContent>

        {/* ── Migrations Tab ── */}
        <TabsContent value="migrations" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Migration Batches ({(migrations as { total?: number } | undefined)?.total ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!migrations ? (
                <p className="text-muted-foreground py-4 text-sm">Loading...</p>
              ) : (migrations as { data: Record<string, unknown>[] }).data.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center text-sm">
                  No migration batches found.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pr-4 pb-2 font-medium">Date</th>
                        <th className="pr-4 pb-2 font-medium">Total Rows</th>
                        <th className="pr-4 pb-2 font-medium">Valid</th>
                        <th className="pr-4 pb-2 font-medium">Errors</th>
                        <th className="pr-4 pb-2 font-medium">Imported</th>
                        <th className="pr-4 pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium">Uploaded By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {(migrations as { data: Record<string, unknown>[] }).data.map(
                        (m: Record<string, unknown>) => (
                          <tr key={m.id as string} className="hover:bg-muted/50">
                            <td className="text-muted-foreground py-2 pr-4 text-xs">
                              {m.createdAt
                                ? format(new Date(m.createdAt as string), "dd MMM yyyy")
                                : "—"}
                            </td>
                            <td className="text-muted-foreground py-2 pr-4 text-xs">
                              {m.totalRows as string}
                            </td>
                            <td className="py-2 pr-4 text-xs text-green-600">
                              {m.validRows as string}
                            </td>
                            <td className="py-2 pr-4 text-xs text-red-600">
                              {m.errorRows as string}
                            </td>
                            <td className="py-2 pr-4 text-xs text-blue-600">
                              {m.importedRows as string}
                            </td>
                            <td className="py-2 pr-4">
                              <Badge variant="outline" className="text-xs">
                                {m.status as string}
                              </Badge>
                            </td>
                            <td className="text-muted-foreground py-2 text-xs">
                              {m.uploadedBy as string}
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Settings Tab ── */}
        <TabsContent value="settings" className="pt-4">
          <div className="space-y-4">
            {!settings ? (
              <p className="text-muted-foreground py-4 text-sm">Loading...</p>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Building2 className="h-4 w-4" />
                        Society Info
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <DetailRow
                        label="Name"
                        value={((settings as Record<string, unknown>).name as string) ?? "—"}
                      />
                      <DetailRow
                        label="Code"
                        value={((settings as Record<string, unknown>).societyCode as string) ?? "—"}
                      />
                      <DetailRow
                        label="Type"
                        value={((settings as Record<string, unknown>).type as string) ?? "—"}
                      />
                      <DetailRow
                        label="City"
                        value={((settings as Record<string, unknown>).city as string) ?? "—"}
                      />
                      <DetailRow
                        label="State"
                        value={((settings as Record<string, unknown>).state as string) ?? "—"}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <CreditCard className="h-4 w-4" />
                        Fee Config
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <DetailRow
                        label="Joining Fee"
                        value={`₹${Number((settings as Record<string, unknown>).joiningFee ?? 0).toLocaleString("en-IN")}`}
                      />
                      <DetailRow
                        label="Annual Fee"
                        value={`₹${Number((settings as Record<string, unknown>).annualFee ?? 0).toLocaleString("en-IN")}`}
                      />
                      <DetailRow
                        label="Grace Period"
                        value={`${((settings as Record<string, unknown>).gracePeriodDays as string) ?? 0} days`}
                      />
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <ScrollText className="h-4 w-4" />
                        Current Subscription
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <DetailRow
                        label="Plan"
                        value={((settings as Record<string, unknown>).plan as string) ?? "—"}
                      />
                      <DetailRow
                        label="Status"
                        value={
                          ((settings as Record<string, unknown>).subscriptionStatus as string) ??
                          "—"
                        }
                      />
                      <DetailRow
                        label="Expires"
                        value={
                          (settings as Record<string, unknown>).subscriptionExpiry
                            ? format(
                                new Date(
                                  (settings as Record<string, unknown>)
                                    .subscriptionExpiry as string,
                                ),
                                "dd MMM yyyy",
                              )
                            : "—"
                        }
                      />
                    </CardContent>
                  </Card>
                </div>

                {(settings as { feeSessions?: Record<string, unknown>[] }).feeSessions &&
                  ((settings as { feeSessions?: Record<string, unknown>[] }).feeSessions ?? [])
                    .length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <IndianRupee className="h-4 w-4" />
                          Fee Sessions
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b text-left">
                                <th className="pr-4 pb-2 font-medium">Session Year</th>
                                <th className="pr-4 pb-2 font-medium">Status</th>
                                <th className="pr-4 pb-2 font-medium">Joining Fee</th>
                                <th className="pb-2 font-medium">Annual Fee</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {(
                                (settings as { feeSessions?: Record<string, unknown>[] })
                                  .feeSessions ?? []
                              ).map((s: Record<string, unknown>) => (
                                <tr key={s.id as string} className="hover:bg-muted/50">
                                  <td className="py-2 pr-4 font-medium">
                                    {s.sessionYear as string}
                                  </td>
                                  <td className="py-2 pr-4">
                                    <Badge variant="outline" className="text-xs">
                                      {s.status as string}
                                    </Badge>
                                  </td>
                                  <td className="py-2 pr-4">
                                    ₹{Number(s.joiningFee ?? 0).toLocaleString("en-IN")}
                                  </td>
                                  <td className="py-2">
                                    ₹{Number(s.annualFee ?? 0).toLocaleString("en-IN")}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </CardContent>
                    </Card>
                  )}
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Suspend Modal */}
      <Sheet open={suspendOpen} onOpenChange={setSuspendOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Suspend Society</SheetTitle>
            <SheetDescription>
              Suspend {society.name}. The society will lose access after any grace period.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-5 py-5">
            <div className="space-y-2">
              <Label htmlFor="suspendReason">
                Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="suspendReason"
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="e.g., Non-payment for 3 consecutive months"
                rows={3}
              />
              <p className="text-muted-foreground text-xs">Min 10 characters, max 500</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gracePeriod">Grace Period (days)</Label>
              <Input
                id="gracePeriod"
                type="number"
                min={0}
                max={30}
                value={suspendGraceDays}
                onChange={(e) => setSuspendGraceDays(Number(e.target.value))}
              />
              <p className="text-muted-foreground text-xs">
                0 = immediate, up to 30 days read-only access
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input
                id="suspendNotify"
                type="checkbox"
                checked={suspendNotify}
                onChange={(e) => setSuspendNotify(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="suspendNotify">Notify primary admin via WhatsApp</Label>
            </div>
          </div>
          <SheetFooter>
            <Button
              onClick={() => suspendMutation.mutate()}
              disabled={suspendMutation.isPending || suspendReason.length < 10}
              className="w-full bg-orange-600 text-white hover:bg-orange-700"
            >
              {suspendMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Suspend Society
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Reactivate Modal */}
      <Sheet open={reactivateOpen} onOpenChange={setReactivateOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Reactivate Society</SheetTitle>
            <SheetDescription>
              Restore access for {society.name} and set status back to ACTIVE.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-5 py-5">
            <div className="space-y-2">
              <Label htmlFor="reactivateNote">Note (optional)</Label>
              <Textarea
                id="reactivateNote"
                value={reactivateNote}
                onChange={(e) => setReactivateNote(e.target.value)}
                placeholder="e.g., Payment received, access restored"
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="reactivateNotify"
                type="checkbox"
                checked={reactivateNotify}
                onChange={(e) => setReactivateNotify(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="reactivateNotify">Notify primary admin via WhatsApp</Label>
            </div>
          </div>
          <SheetFooter>
            <Button
              onClick={() => reactivateMutation.mutate()}
              disabled={reactivateMutation.isPending}
              className="w-full bg-green-600 text-white hover:bg-green-700"
            >
              {reactivateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reactivate Society
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Offboard Wizard */}
      <Sheet
        open={offboardOpen}
        onOpenChange={(open) => {
          setOffboardOpen(open);
          if (!open) {
            setOffboardStep(1);
            setOffboardReason("");
            setOffboardCode("");
          }
        }}
      >
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Offboard Society — Step {offboardStep} of 2</SheetTitle>
            <SheetDescription>
              {offboardStep === 1
                ? "Review this action. Offboarding is permanent — data is retained but access is revoked."
                : "Confirm by entering the society code."}
            </SheetDescription>
          </SheetHeader>

          {offboardStep === 1 && (
            <div className="space-y-5 py-5">
              <div className="rounded-md border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/30">
                <p className="text-sm font-medium text-red-700 dark:text-red-400">
                  Warning: This action is irreversible
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-red-600 dark:text-red-400">
                  <li>Society status → OFFBOARDED</li>
                  <li>Active subscription will be cancelled</li>
                  <li>All admin logins will be disabled</li>
                  <li>Data is preserved for compliance (not deleted)</li>
                </ul>
              </div>
              <div className="space-y-2">
                <Label htmlFor="offboardReason">
                  Reason <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="offboardReason"
                  value={offboardReason}
                  onChange={(e) => setOffboardReason(e.target.value)}
                  placeholder="e.g., Society permanently closed, RWA dissolved"
                  rows={3}
                />
                <p className="text-muted-foreground text-xs">Min 10 characters</p>
              </div>
              <SheetFooter>
                <Button
                  onClick={() => setOffboardStep(2)}
                  disabled={offboardReason.length < 10}
                  className="w-full bg-red-600 text-white hover:bg-red-700"
                >
                  Next: Confirm Identity
                </Button>
              </SheetFooter>
            </div>
          )}

          {offboardStep === 2 && (
            <div className="space-y-5 py-5">
              <div className="space-y-2">
                <Label htmlFor="offboardCode">
                  Type the society code to confirm:{" "}
                  <code className="bg-muted rounded px-1 text-sm font-bold">
                    {society.societyCode}
                  </code>
                </Label>
                <Input
                  id="offboardCode"
                  value={offboardCode}
                  onChange={(e) => setOffboardCode(e.target.value)}
                  placeholder={society.societyCode}
                />
              </div>
              <SheetFooter className="flex gap-2">
                <Button variant="outline" onClick={() => setOffboardStep(1)} className="flex-1">
                  Back
                </Button>
                <Button
                  onClick={() => offboardMutation.mutate()}
                  disabled={offboardMutation.isPending || offboardCode !== society.societyCode}
                  className="flex-1 bg-red-600 text-white hover:bg-red-700"
                >
                  {offboardMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Confirm Offboard
                </Button>
              </SheetFooter>
            </div>
          )}
        </SheetContent>
      </Sheet>

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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: "border-green-200 bg-green-50 text-green-700",
    TRIAL: "border-yellow-200 bg-yellow-50 text-yellow-700",
    SUSPENDED: "border-orange-200 bg-orange-50 text-orange-700",
    OFFBOARDED: "border-gray-200 bg-gray-50 text-gray-600",
  };
  return (
    <Badge variant="outline" className={map[status] ?? "border-gray-200"}>
      {status}
    </Badge>
  );
}

function getStatusChangeColor(status: string) {
  const map: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-700",
    TRIAL: "bg-yellow-100 text-yellow-700",
    SUSPENDED: "bg-orange-100 text-orange-700",
    OFFBOARDED: "bg-gray-100 text-gray-600",
  };
  return map[status] ?? "bg-gray-100 text-gray-600";
}

function getStatusChangeIcon(status: string) {
  if (status === "ACTIVE") return <CheckCircle className="h-4 w-4" />;
  if (status === "SUSPENDED") return <AlertTriangle className="h-4 w-4" />;
  if (status === "OFFBOARDED") return <XCircle className="h-4 w-4" />;
  return <Clock className="h-4 w-4" />;
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
