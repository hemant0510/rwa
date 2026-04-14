"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createCounsellorSchema } from "@/lib/validations/counsellor";
import { createCounsellor } from "@/services/counsellors";

type FormState = {
  name: string;
  email: string;
  mobile: string;
  nationalId: string;
  bio: string;
  publicBlurb: string;
};

const initial: FormState = {
  name: "",
  email: "",
  mobile: "",
  nationalId: "",
  bio: "",
  publicBlurb: "",
};

export function CounsellorCreateForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const mutation = useMutation({
    mutationFn: createCounsellor,
    onSuccess: (result) => {
      toast.success(
        result.inviteSent
          ? `Counsellor ${result.name} created — invitation email sent.`
          : `Counsellor ${result.name} created. Invitation email could not be sent; use "Resend invite" later.`,
      );
      router.push(`/sa/counsellors/${result.id}`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  function handleChange<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      email: form.email.trim(),
      mobile: form.mobile.trim() || null,
      nationalId: form.nationalId.trim() || null,
      bio: form.bio.trim() || null,
      publicBlurb: form.publicBlurb.trim() || null,
    };
    const parsed = createCounsellorSchema.safeParse(payload);
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setErrors({
        name: fieldErrors.name?.[0],
        email: fieldErrors.email?.[0],
        mobile: fieldErrors.mobile?.[0],
        nationalId: fieldErrors.nationalId?.[0],
        bio: fieldErrors.bio?.[0],
        publicBlurb: fieldErrors.publicBlurb?.[0],
      });
      return;
    }
    mutation.mutate(parsed.data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <Field label="Full name" error={errors.name} required>
        <Input
          value={form.name}
          onChange={(e) => handleChange("name", e.target.value)}
          placeholder="Asha Patel"
          maxLength={100}
          disabled={mutation.isPending}
        />
      </Field>

      <Field label="Email" error={errors.email} required>
        <Input
          type="email"
          value={form.email}
          onChange={(e) => handleChange("email", e.target.value)}
          placeholder="counsellor@example.com"
          maxLength={100}
          disabled={mutation.isPending}
        />
      </Field>

      <Field label="Mobile" error={errors.mobile}>
        <Input
          value={form.mobile}
          onChange={(e) => handleChange("mobile", e.target.value)}
          placeholder="+91 9876543210"
          maxLength={15}
          disabled={mutation.isPending}
        />
      </Field>

      <Field label="National ID (optional)" error={errors.nationalId}>
        <Input
          value={form.nationalId}
          onChange={(e) => handleChange("nationalId", e.target.value)}
          placeholder="e.g. PAN, Aadhaar"
          maxLength={30}
          disabled={mutation.isPending}
        />
      </Field>

      <Field
        label="Bio / Qualifications (internal)"
        hint="Longer description — visible only to SA and the counsellor."
        error={errors.bio}
      >
        <textarea
          value={form.bio}
          onChange={(e) => handleChange("bio", e.target.value)}
          rows={4}
          maxLength={5000}
          disabled={mutation.isPending}
          className="border-input bg-background placeholder:text-muted-foreground w-full rounded-md border px-3 py-2 text-sm"
        />
      </Field>

      <Field
        label="Public blurb"
        hint="Short public-facing description — up to 500 characters."
        error={errors.publicBlurb}
      >
        <textarea
          value={form.publicBlurb}
          onChange={(e) => handleChange("publicBlurb", e.target.value)}
          rows={2}
          maxLength={500}
          disabled={mutation.isPending}
          className="border-input bg-background placeholder:text-muted-foreground w-full rounded-md border px-3 py-2 text-sm"
        />
      </Field>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/sa/counsellors")}
          disabled={mutation.isPending}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "Creating..." : "Create Counsellor"}
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {hint && !error && <p className="text-muted-foreground text-xs">{hint}</p>}
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
