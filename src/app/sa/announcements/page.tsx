"use client";

import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Megaphone, Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { createAnnouncement, getAnnouncements } from "@/services/announcements";

const PRIORITY_COLORS: Record<string, string> = {
  NORMAL: "bg-gray-100 text-gray-700",
  URGENT: "bg-red-100 text-red-700",
};

export default function AnnouncementsPage() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [scope, setScope] = useState("ALL");

  const { data: announcements, isLoading } = useQuery({
    queryKey: ["sa-announcements"],
    queryFn: getAnnouncements,
  });

  const mutation = useMutation({
    mutationFn: createAnnouncement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sa-announcements"] });
      setShowForm(false);
      setSubject("");
      setBody("");
      setPriority("NORMAL");
      setScope("ALL");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({
      subject,
      body,
      priority: priority as "NORMAL" | "URGENT",
      scope: scope as "ALL" | "TARGETED",
      societyIds: [],
      sentVia: ["IN_APP"],
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        description="Communicate with society admins across the platform"
      >
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-1 h-4 w-4" />
          New Announcement
        </Button>
      </PageHeader>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Create Announcement</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Announcement subject (5-200 chars)"
                  required
                  minLength={5}
                  maxLength={200}
                />
              </div>
              <div>
                <Label htmlFor="body">Message</Label>
                <Textarea
                  id="body"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Announcement body (10-5000 chars, markdown supported)"
                  required
                  minLength={10}
                  maxLength={5000}
                  rows={5}
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NORMAL">Normal</SelectItem>
                      <SelectItem value="URGENT">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label>Scope</Label>
                  <Select value={scope} onValueChange={setScope}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">All Societies</SelectItem>
                      <SelectItem value="TARGETED">Targeted</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={mutation.isPending}>
                  {mutation.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                  Send Announcement
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
              {mutation.isError && <p className="text-sm text-red-600">{mutation.error.message}</p>}
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>All Announcements</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !announcements?.length ? (
            <div className="flex flex-col items-center gap-2 py-12">
              <Megaphone className="text-muted-foreground h-10 w-10" />
              <p className="text-muted-foreground text-sm">No announcements yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead className="text-right">Reads</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {announcements.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.subject}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`border-0 text-xs ${PRIORITY_COLORS[a.priority] ?? ""}`}
                      >
                        {a.priority}
                      </Badge>
                    </TableCell>
                    <TableCell>{a.scope}</TableCell>
                    <TableCell className="text-right">{a._count?.reads ?? 0}</TableCell>
                    <TableCell>{new Date(a.createdAt).toLocaleDateString("en-IN")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
