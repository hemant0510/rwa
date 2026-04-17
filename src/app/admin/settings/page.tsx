"use client";

import { useState } from "react";

import Link from "next/link";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CalendarPlus,
  ChevronRight,
  CreditCard,
  Loader2,
  QrCode,
} from "lucide-react";
import { toast } from "sonner";

import { YourCounsellorCard } from "@/components/features/sa-counsellors/YourCounsellorCard";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSocietyId } from "@/hooks/useSocietyId";

interface FeeSession {
  id: string;
  sessionYear: string;
  annualFee: number;
  joiningFee: number;
  sessionStart: string;
  sessionEnd: string;
  gracePeriodEnd: string;
  status: string;
}

interface Settings {
  emailVerificationRequired: boolean;
  joiningFee: number;
  annualFee: number;
  gracePeriodDays: number;
  feeSessionStartMonth: number;
  feeSessions: FeeSession[];
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const SESSION_STATUS_COLORS: Record<string, string> = {
  UPCOMING: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  ACTIVE: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  COMPLETED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

async function fetchSettings(societyId?: string): Promise<Settings> {
  const qs = societyId ? `?societyId=${encodeURIComponent(societyId)}` : "";
  const res = await fetch(`/api/v1/admin/settings${qs}`);
  if (!res.ok) throw new Error("Failed to fetch settings");
  return res.json() as Promise<Settings>;
}

async function updateSettings(data: Partial<Settings>): Promise<Settings> {
  const res = await fetch("/api/v1/admin/settings", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = (await res.json()) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? "Failed to update settings");
  }
  return res.json() as Promise<Settings>;
}

async function createFeeSession(year: number): Promise<FeeSession & { message: string }> {
  const res = await fetch("/api/v1/admin/fee-sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ year }),
  });
  if (!res.ok) {
    const err = (await res.json()) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? "Failed to create fee session");
  }
  return res.json() as Promise<FeeSession & { message: string }>;
}

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const { societyId, isSuperAdminViewing, saQueryString } = useSocietyId();

  const { data: settings, isLoading } = useQuery({
    queryKey: ["admin-settings", societyId],
    queryFn: () => fetchSettings(isSuperAdminViewing ? societyId : undefined),
  });

  const mutation = useMutation({
    mutationFn: updateSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(["admin-settings"], data);
      toast.success("Settings updated");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) return <PageSkeleton />;

  const hasActiveSession = settings?.feeSessions.some((s) => s.status === "ACTIVE");

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your society settings" />

      {/* Your Counsellor Card */}
      <YourCounsellorCard />

      {/* Subscription Payment Card */}
      <Link href={`/admin/settings/subscription${saQueryString}`}>
        <Card className="hover:bg-muted/50 cursor-pointer transition-colors">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <CreditCard className="text-muted-foreground h-5 w-5" />
              <div>
                <CardTitle className="text-base">Subscription Payment</CardTitle>
                <CardDescription>
                  Pay your society&apos;s platform subscription via UPI
                </CardDescription>
              </div>
            </div>
            <ChevronRight className="text-muted-foreground h-4 w-4" />
          </CardHeader>
        </Card>
      </Link>

      {/* Payment Setup Card */}
      <Link href={`/admin/settings/payment-setup${saQueryString}`}>
        <Card className="hover:bg-muted/50 cursor-pointer transition-colors">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <QrCode className="text-muted-foreground h-5 w-5" />
              <div>
                <CardTitle className="text-base">Payment Setup</CardTitle>
                <CardDescription>
                  Configure UPI ID and QR code for online fee collection
                </CardDescription>
              </div>
            </div>
            <ChevronRight className="text-muted-foreground h-4 w-4" />
          </CardHeader>
        </Card>
      </Link>

      {/* Email Verification Card */}
      <Card>
        <CardHeader>
          <CardTitle>Email Verification</CardTitle>
          <CardDescription>
            Control whether new users must verify their email before accessing the system
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="emailVerification">Require Email Verification</Label>
              <p className="text-muted-foreground text-xs">
                When enabled, new admins and residents must verify their email to login
              </p>
            </div>
            <div className="flex items-center gap-2">
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <Switch
                id="emailVerification"
                checked={settings?.emailVerificationRequired ?? true}
                disabled={mutation.isPending}
                onCheckedChange={(checked) =>
                  mutation.mutate({ emailVerificationRequired: checked })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Fee Configuration Card */}
      <FeeConfigCard
        settings={settings}
        hasActiveSession={!!hasActiveSession}
        isPending={mutation.isPending}
        onSave={(data) => mutation.mutate(data)}
      />

      {/* Fee Sessions Card */}
      <FeeSessionsCard
        sessions={settings?.feeSessions ?? []}
        onSessionCreated={() => queryClient.invalidateQueries({ queryKey: ["admin-settings"] })}
      />
    </div>
  );
}

interface FeeConfigCardProps {
  settings: Settings | undefined;
  hasActiveSession: boolean;
  isPending: boolean;
  onSave: (data: Partial<Settings>) => void;
}

function FeeConfigCard({ settings, hasActiveSession, isPending, onSave }: FeeConfigCardProps) {
  const [joiningFee, setJoiningFee] = useState<string>("");
  const [annualFee, setAnnualFee] = useState<string>("");
  const [gracePeriodDays, setGracePeriodDays] = useState<string>("");
  const [feeSessionStartMonth, setFeeSessionStartMonth] = useState<string>("");
  const [dirty, setDirty] = useState(false);

  // Initialize from settings on first load
  const initialized = useState(false);
  if (settings && !initialized[0]) {
    setJoiningFee(String(settings.joiningFee));
    setAnnualFee(String(settings.annualFee));
    setGracePeriodDays(String(settings.gracePeriodDays));
    setFeeSessionStartMonth(String(settings.feeSessionStartMonth));
    initialized[1](true);
  }

  const handleSave = () => {
    const data: Partial<Settings> = {};
    const jf = Number(joiningFee);
    const af = Number(annualFee);
    const gp = Number(gracePeriodDays);
    const sm = Number(feeSessionStartMonth);

    if (!isNaN(jf) && jf >= 0 && jf <= 100000) data.joiningFee = jf;
    if (!isNaN(af) && af >= 0 && af <= 100000) data.annualFee = af;
    if (!isNaN(gp) && gp >= 1 && gp <= 365) data.gracePeriodDays = gp;
    if (!isNaN(sm) && sm >= 1 && sm <= 12) data.feeSessionStartMonth = sm;

    onSave(data);
    setDirty(false);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fee Configuration</CardTitle>
        <CardDescription>Set default fees and session parameters for your society</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasActiveSession && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-400">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              An active fee session exists. Changes here apply to newly created sessions and newly
              approved residents only. Existing fee records are unaffected.
            </p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="joiningFee">Joining Fee (INR)</Label>
            <Input
              id="joiningFee"
              type="number"
              min={0}
              max={100000}
              value={joiningFee}
              onChange={(e) => {
                setJoiningFee(e.target.value);
                setDirty(true);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="annualFee">Annual Fee (INR)</Label>
            <Input
              id="annualFee"
              type="number"
              min={0}
              max={100000}
              value={annualFee}
              onChange={(e) => {
                setAnnualFee(e.target.value);
                setDirty(true);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gracePeriod">Grace Period (days)</Label>
            <Input
              id="gracePeriod"
              type="number"
              min={1}
              max={365}
              value={gracePeriodDays}
              onChange={(e) => {
                setGracePeriodDays(e.target.value);
                setDirty(true);
              }}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sessionStartMonth">Session Start Month</Label>
            <Select
              value={feeSessionStartMonth}
              onValueChange={(val) => {
                setFeeSessionStartMonth(val);
                setDirty(true);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((month, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={isPending || !dirty}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Fee Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface FeeSessionsCardProps {
  sessions: FeeSession[];
  onSessionCreated: () => void;
}

function FeeSessionsCard({ sessions, onSessionCreated }: FeeSessionsCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [year, setYear] = useState<string>(String(new Date().getFullYear()));

  const createMutation = useMutation({
    mutationFn: (y: number) => createFeeSession(y),
    onSuccess: (data) => {
      toast.success(data.message);
      setDialogOpen(false);
      onSessionCreated();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleCreate = () => {
    const y = Number(year);
    if (isNaN(y) || y < 2024 || y > 2100) {
      toast.error("Enter a valid year between 2024 and 2100");
      return;
    }
    createMutation.mutate(y);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Fee Sessions</CardTitle>
          <CardDescription>Manage yearly fee collection sessions</CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <CalendarPlus className="mr-2 h-4 w-4" />
              Create Session
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Fee Session</DialogTitle>
              <DialogDescription>
                Create a new fee session for the specified year. Fees will be snapshotted from
                current settings.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
              <Label htmlFor="sessionYear">Start Year</Label>
              <Input
                id="sessionYear"
                type="number"
                min={2024}
                max={2100}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="e.g., 2025 for session 2025-26"
              />
              <p className="text-muted-foreground text-xs">
                Session will be created as {year}-{String(Number(year) + 1).slice(2)}
              </p>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Session
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {sessions.length === 0 ? (
          <EmptyState
            title="No fee sessions"
            description="Create your first fee session to start collecting fees."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session Year</TableHead>
                  <TableHead>Annual Fee</TableHead>
                  <TableHead>Joining Fee</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="font-medium">{session.sessionYear}</TableCell>
                    <TableCell>
                      {new Intl.NumberFormat("en-IN", {
                        style: "currency",
                        currency: "INR",
                        maximumFractionDigits: 0,
                      }).format(session.annualFee)}
                    </TableCell>
                    <TableCell>
                      {new Intl.NumberFormat("en-IN", {
                        style: "currency",
                        currency: "INR",
                        maximumFractionDigits: 0,
                      }).format(session.joiningFee)}
                    </TableCell>
                    <TableCell>
                      {new Date(session.sessionStart).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      {new Date(session.sessionEnd).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`border-0 font-medium ${SESSION_STATUS_COLORS[session.status] ?? ""}`}
                      >
                        {session.status}
                      </Badge>
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
