"use client";

import Link from "next/link";

import { ChevronLeft } from "lucide-react";

import { CounsellorCreateForm } from "@/components/features/sa-counsellors/CounsellorCreateForm";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/PageHeader";

export default function NewCounsellorPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/sa/counsellors"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm"
      >
        <ChevronLeft className="h-4 w-4" /> Back to counsellors
      </Link>

      <PageHeader
        title="New Counsellor"
        description="Appoint a Great Admin. They will receive an invitation email to set their password and enroll MFA."
      />

      <Card>
        <CardContent className="pt-6">
          <CounsellorCreateForm />
        </CardContent>
      </Card>
    </div>
  );
}
