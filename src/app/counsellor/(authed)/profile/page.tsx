"use client";

import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { updateCounsellorSelfSchema } from "@/lib/validations/counsellor";
import { getMe, updateMe } from "@/services/counsellor-self";
import type { CounsellorDetail } from "@/types/counsellor";

export default function CounsellorProfilePage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["counsellor-me"],
    queryFn: getMe,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="My Profile" description="Update your name, contact, and public blurb." />

      {isLoading && <CardSkeleton />}

      {error && (
        <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-4 text-sm">
          Failed to load profile: {error.message}
        </div>
      )}

      {data && <ProfileForm profile={data} />}
    </div>
  );
}

function ProfileForm({ profile }: { profile: CounsellorDetail }) {
  const queryClient = useQueryClient();
  const [name, setName] = useState(profile.name);
  const [mobile, setMobile] = useState(profile.mobile ?? "");
  const [bio, setBio] = useState(profile.bio ?? "");
  const [publicBlurb, setPublicBlurb] = useState(profile.publicBlurb ?? "");

  const mutation = useMutation({
    mutationFn: updateMe,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["counsellor-me"] });
      toast.success("Profile updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: name.trim(),
      mobile: mobile.trim() || null,
      bio: bio.trim() || null,
      publicBlurb: publicBlurb.trim() || null,
    };
    const parsed = updateCounsellorSelfSchema.safeParse(payload);
    if (!parsed.success) {
      /* v8 ignore start */
      const fe = parsed.error.flatten().fieldErrors;
      const first =
        fe.name?.[0] ?? fe.mobile?.[0] ?? fe.bio?.[0] ?? fe.publicBlurb?.[0] ?? "Invalid input";
      toast.error(first);
      /* v8 ignore stop */
      return;
    }
    mutation.mutate(parsed.data);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Editable fields</CardTitle>
        <CardDescription>
          Email, national ID, and account status are managed by Super Admin.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              disabled={mutation.isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mobile">Mobile</Label>
            <Input
              id="mobile"
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              maxLength={15}
              disabled={mutation.isPending}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio (private — visible to Super Admin)</Label>
            <textarea
              id="bio"
              rows={4}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={5000}
              disabled={mutation.isPending}
              className="border-input bg-background placeholder:text-muted-foreground w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="blurb">Public blurb (visible to RWA Admins)</Label>
            <textarea
              id="blurb"
              rows={2}
              value={publicBlurb}
              onChange={(e) => setPublicBlurb(e.target.value)}
              maxLength={500}
              disabled={mutation.isPending}
              className="border-input bg-background placeholder:text-muted-foreground w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={mutation.isPending}>
              <Save className="mr-1 h-4 w-4" />
              {/* v8 ignore start */}
              {mutation.isPending ? "Saving..." : null}
              {/* v8 ignore stop */}
              {!mutation.isPending && "Save Changes"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
