"use client";

import { use, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Building2, CheckCircle, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FLOOR_LEVELS } from "@/lib/constants";
import {
  registerResidentSchema,
  type RegisterResidentInput,
  unitFieldsSchema,
} from "@/lib/validations/resident";
import { getSocietyByCode } from "@/services/societies";
import { SOCIETY_TYPE_ADDRESS_FIELDS, type SocietyType } from "@/types/society";

export default function RegisterPage({ params }: { params: Promise<{ societyCode: string }> }) {
  const { societyCode } = use(params);
  const [submitted, setSubmitted] = useState(false);

  const {
    data: society,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["societies", "code", societyCode],
    queryFn: () => getSocietyByCode(societyCode),
  });

  const form = useForm<RegisterResidentInput>({
    resolver: zodResolver(registerResidentSchema),
    defaultValues: {
      fullName: "",
      mobile: "",
      ownershipType: "OWNER",
      email: "",
      password: "",
      passwordConfirm: "",
      consentWhatsApp: true as const,
    },
  });

  const [unitFields, setUnitFields] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: async (data: RegisterResidentInput) => {
      const res = await fetch("/api/v1/residents/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          societyCode,
          unitAddress: unitFields,
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: { message?: string } };
        throw new Error(err.error?.message || "Registration failed");
      }
      return (await res.json()) as { id: string; message: string };
    },
    onSuccess: () => setSubmitted(true),
    onError: (err: Error) => toast.error(err.message),
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="text-primary h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (error || !society) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-6">
            <p className="text-lg font-medium">Society not found</p>
            <p className="text-muted-foreground mt-1 text-sm">
              The registration link may be invalid or expired.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="space-y-4 pt-6">
            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
            <h2 className="text-xl font-bold">Registration Submitted!</h2>
            <p className="text-muted-foreground text-sm">
              Your request has been sent to the society admin for approval. You can{" "}
              <a href="/login" className="text-primary underline">
                sign in
              </a>{" "}
              to check your status.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const addressFields = SOCIETY_TYPE_ADDRESS_FIELDS[society.type as SocietyType];

  return (
    <div className="bg-muted/30 flex min-h-screen items-center justify-center px-4 py-8">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="bg-primary/10 mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full">
            <Building2 className="text-primary h-6 w-6" />
          </div>
          <CardTitle>{society.name}</CardTitle>
          <CardDescription>
            {society.city}, {society.state} &mdash; Resident Registration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit((data) => {
              // Validate unit fields
              const schema = unitFieldsSchema[society.type as SocietyType];
              if (schema) {
                const result = schema.safeParse(unitFields);
                if (!result.success) {
                  toast.error("Please fill all address fields");
                  return;
                }
              }
              mutation.mutate(data);
            })}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="fullName">
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fullName"
                placeholder="Enter your full name"
                aria-invalid={!!form.formState.errors.fullName}
                {...form.register("fullName")}
              />
              {form.formState.errors.fullName && (
                <p className="text-destructive text-sm">{form.formState.errors.fullName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="mobile">
                Mobile Number <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <span className="bg-muted text-muted-foreground flex items-center rounded-md border px-3 text-sm">
                  +91
                </span>
                <Input
                  id="mobile"
                  placeholder="9876543210"
                  maxLength={10}
                  aria-invalid={!!form.formState.errors.mobile}
                  {...form.register("mobile")}
                />
              </div>
              {form.formState.errors.mobile && (
                <p className="text-destructive text-sm">{form.formState.errors.mobile.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="email@example.com"
                autoComplete="off"
                aria-invalid={!!form.formState.errors.email}
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-destructive text-sm">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="password">
                  Password <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min 8 characters"
                  autoComplete="new-password"
                  aria-invalid={!!form.formState.errors.password}
                  {...form.register("password")}
                />
                {form.formState.errors.password && (
                  <p className="text-destructive text-sm">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="passwordConfirm">
                  Confirm Password <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="passwordConfirm"
                  type="password"
                  autoComplete="new-password"
                  aria-invalid={!!form.formState.errors.passwordConfirm}
                  {...form.register("passwordConfirm")}
                />
                {form.formState.errors.passwordConfirm && (
                  <p className="text-destructive text-sm">
                    {form.formState.errors.passwordConfirm.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>
                Ownership Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={form.watch("ownershipType")}
                onValueChange={(v) => form.setValue("ownershipType", v as "OWNER" | "TENANT")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OWNER">Owner</SelectItem>
                  <SelectItem value="TENANT">Tenant</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {addressFields && (
              <div className="bg-muted/30 space-y-3 rounded-md border p-4">
                <p className="text-sm font-medium">Address Details</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {addressFields.required.map((field) => (
                    <div key={field} className="space-y-1">
                      <Label className="text-xs capitalize">
                        {field.replace(/([A-Z])/g, " $1").trim()} *
                      </Label>
                      {field === "floorLevel" ? (
                        <Select
                          value={unitFields[field] || ""}
                          onValueChange={(v) => setUnitFields((prev) => ({ ...prev, [field]: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select floor" />
                          </SelectTrigger>
                          <SelectContent>
                            {FLOOR_LEVELS.map((f) => (
                              <SelectItem key={f} value={f}>
                                {f}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={unitFields[field] || ""}
                          onChange={(e) =>
                            setUnitFields((prev) => ({ ...prev, [field]: e.target.value }))
                          }
                        />
                      )}
                    </div>
                  ))}
                  {addressFields.optional.map((field) => (
                    <div key={field} className="space-y-1">
                      <Label className="text-xs capitalize">
                        {field.replace(/([A-Z])/g, " $1").trim()}
                      </Label>
                      <Input
                        value={unitFields[field] || ""}
                        onChange={(e) =>
                          setUnitFields((prev) => ({ ...prev, [field]: e.target.value }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Checkbox
                id="consent"
                checked={Boolean(form.watch("consentWhatsApp"))}
                onCheckedChange={(checked) =>
                  form.setValue("consentWhatsApp", checked === true ? true : (false as never))
                }
              />
              <Label htmlFor="consent" className="text-sm">
                I consent to receive WhatsApp messages from this society
              </Label>
            </div>

            <Button type="submit" className="w-full" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Registration
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
