"use client";

import { use, useRef, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Building2, CheckCircle, Info, Loader2, Upload, X } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { FormStepper } from "@/components/features/FormStepper";
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

const TOTAL_STEPS = 3;
const ALLOWED_ID_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_ID_SIZE = 5 * 1024 * 1024; // 5 MB

export default function RegisterPage({ params }: { params: Promise<{ societyCode: string }> }) {
  const { societyCode } = use(params);
  const [submitted, setSubmitted] = useState(false);
  const [requiresVerification, setRequiresVerification] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [step3Touched, setStep3Touched] = useState(false);
  const [idProofFile, setIdProofFile] = useState<File | null>(null);
  const [idProofError, setIdProofError] = useState<string | null>(null);
  const idProofInputRef = useRef<HTMLInputElement>(null);

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
      otherOwnershipDetail: "",
      email: "",
      password: "",
      passwordConfirm: "",
      consentWhatsApp: true as const,
    },
  });

  const ownershipType = useWatch({ control: form.control, name: "ownershipType" });
  const unitType = useWatch({ control: form.control, name: "unitType" });
  const consentWhatsApp = useWatch({ control: form.control, name: "consentWhatsApp" });

  const [unitFields, setUnitFields] = useState<Record<string, string>>({});
  const [existingAccount, setExistingAccount] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);

  const handleEmailBlur = async () => {
    const email = form.getValues("email");
    if (!email || !email.includes("@")) return;

    setCheckingEmail(true);
    try {
      const res = await fetch("/api/v1/auth/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        const data = (await res.json()) as { existsInAuth: boolean };
        setExistingAccount(data.existsInAuth);
        if (data.existsInAuth) {
          form.setValue("reuseAuth", true);
          form.setValue("password", undefined);
          form.setValue("passwordConfirm", undefined);
        } else {
          form.setValue("reuseAuth", undefined);
        }
      }
    } catch {
      // Silently fail — user can still register normally
    } finally {
      setCheckingEmail(false);
    }
  };

  const handleOwnershipTypeChange = (value: string) => {
    form.setValue("ownershipType", value as "OWNER" | "TENANT" | "OTHER");
    if (value !== "OTHER") {
      form.setValue("otherOwnershipDetail", "");
    }
  };

  const handleUnitTypeChange = (value: string) => {
    form.setValue("unitType", value as "FLOOR" | "HOUSE");
    if (value === "HOUSE") {
      setUnitFields((prev) => {
        const next = { ...prev };
        delete next.floorLevel;
        return next;
      });
    }
  };

  const validateUnitFields = (): boolean => {
    if (!society) return false;

    if (!unitType) {
      toast.error("Please select a unit type");
      return false;
    }

    // When HOUSE is selected, floorLevel is not required
    if (unitType === "HOUSE") {
      // Just need houseNo for any society type
      if (!unitFields.houseNo?.trim()) {
        toast.error("Please fill all address fields");
        return false;
      }
      return true;
    }

    // For FLOOR, validate required fields + floorLevel
    const societyType = society.type as SocietyType;
    const schema = unitFieldsSchema[societyType as keyof typeof unitFieldsSchema];
    if (schema) {
      const result = schema.safeParse(unitFields);
      if (!result.success) {
        toast.error("Please fill all address fields");
        return false;
      }
    }
    // floorLevel is always required when unit type is FLOOR
    if (!unitFields.floorLevel?.trim()) {
      toast.error("Please select a floor level");
      return false;
    }
    return true;
  };

  const handleNext = async () => {
    if (currentStep === 1) {
      const valid = await form.trigger(["fullName", "mobile", "email"]);
      if (!valid) return;
    } else if (currentStep === 2) {
      const fieldsToValidate: (keyof RegisterResidentInput)[] = ["ownershipType"];
      if (ownershipType === "OTHER") {
        fieldsToValidate.push("otherOwnershipDetail");
      }
      const valid = await form.trigger(fieldsToValidate);
      if (!valid) {
        // Check if errors are actually for our step's fields
        const hasStepErrors = fieldsToValidate.some((field) => form.formState.errors[field]);
        if (hasStepErrors) return;
      }
      if (!validateUnitFields()) return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
  };

  const handleBack = () => {
    setStep3Touched(false);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

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
      const result = (await res.json()) as {
        id: string;
        message: string;
        requiresVerification?: boolean;
      };

      // Upload ID proof if provided
      if (idProofFile && result.id) {
        const formData = new FormData();
        formData.append("file", idProofFile);
        // Best-effort upload — registration already succeeded, don't block on this
        await fetch(`/api/v1/residents/${result.id}/id-proof`, {
          method: "POST",
          body: formData,
        }).catch(() => {
          // Silently ignore upload failures — admin can request later
        });
      }

      return result;
    },
    onSuccess: (data) => {
      setRequiresVerification(data.requiresVerification ?? false);
      setSubmitted(true);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const steps: { number: number; title: string; status: "completed" | "active" | "pending" }[] = [
    {
      number: 1,
      title: "Personal Info",
      status: currentStep > 1 ? "completed" : currentStep === 1 ? "active" : "pending",
    },
    {
      number: 2,
      title: "Property",
      status: currentStep > 2 ? "completed" : currentStep === 2 ? "active" : "pending",
    },
    {
      number: 3,
      title: "Account",
      status: currentStep === 3 ? "active" : "pending",
    },
  ];

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
              {requiresVerification
                ? "Please check your email to verify your account. After verification, wait for the society admin to approve your registration."
                : "Your request has been sent to the society admin for approval."}{" "}
              You can{" "}
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
          <FormStepper steps={steps} />

          <form
            onSubmit={(e) => {
              setStep3Touched(true);
              form.handleSubmit((data) => {
                if (!validateUnitFields()) return;
                mutation.mutate(data);
              })(e);
            }}
            className="mt-6 space-y-4"
          >
            {/* Step 1: Personal Info */}
            {currentStep === 1 && (
              <div className="space-y-4">
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
                    <p className="text-destructive text-sm">
                      {form.formState.errors.fullName.message}
                    </p>
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
                    <p className="text-destructive text-sm">
                      {form.formState.errors.mobile.message}
                    </p>
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
                    {...form.register("email", { onBlur: handleEmailBlur })}
                  />
                  {checkingEmail && (
                    <p className="text-muted-foreground text-xs">Checking email...</p>
                  )}
                  {form.formState.errors.email && (
                    <p className="text-destructive text-sm">
                      {form.formState.errors.email.message}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Property Details */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>
                      Ownership Type <span className="text-destructive">*</span>
                    </Label>
                    <Select value={ownershipType} onValueChange={handleOwnershipTypeChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OWNER">Owner</SelectItem>
                        <SelectItem value="TENANT">Tenant</SelectItem>
                        <SelectItem value="OTHER">Other (specify)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>
                      Unit Type <span className="text-destructive">*</span>
                    </Label>
                    <Select value={unitType || ""} onValueChange={handleUnitTypeChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select unit type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FLOOR">Floor</SelectItem>
                        <SelectItem value="HOUSE">House</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {ownershipType === "OTHER" && (
                  <div className="space-y-2">
                    <Label htmlFor="otherOwnershipDetail">
                      Please specify <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="otherOwnershipDetail"
                      placeholder="e.g., Caretaker, Family member"
                      aria-invalid={!!form.formState.errors.otherOwnershipDetail}
                      {...form.register("otherOwnershipDetail")}
                    />
                    {form.formState.errors.otherOwnershipDetail && (
                      <p className="text-destructive text-sm">
                        {form.formState.errors.otherOwnershipDetail.message}
                      </p>
                    )}
                  </div>
                )}

                {addressFields && (
                  <div className="bg-muted/30 space-y-3 rounded-md border p-4">
                    <p className="text-sm font-medium">Address Details</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {addressFields.required
                        .filter((field) => field !== "floorLevel")
                        .map((field) => (
                          <div key={field} className="space-y-1">
                            <Label className="text-xs capitalize">
                              {field.replace(/([A-Z])/g, " $1").trim()} *
                            </Label>
                            <Input
                              value={unitFields[field] || ""}
                              onChange={(e) =>
                                setUnitFields((prev) => ({
                                  ...prev,
                                  [field]: e.target.value,
                                }))
                              }
                            />
                          </div>
                        ))}
                      {unitType === "FLOOR" && (
                        <div className="space-y-1">
                          <Label className="text-xs">Floor Level *</Label>
                          <Select
                            value={unitFields.floorLevel || ""}
                            onValueChange={(v) =>
                              setUnitFields((prev) => ({ ...prev, floorLevel: v }))
                            }
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
                        </div>
                      )}
                      {addressFields.optional.map((field) => (
                        <div key={field} className="space-y-1">
                          <Label className="text-xs capitalize">
                            {field.replace(/([A-Z])/g, " $1").trim()}
                          </Label>
                          <Input
                            value={unitFields[field] || ""}
                            onChange={(e) =>
                              setUnitFields((prev) => ({
                                ...prev,
                                [field]: e.target.value,
                              }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Account Setup */}
            {currentStep === 3 && (
              <div className="space-y-4">
                {existingAccount ? (
                  <div className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/30">
                    <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      You already have an RWA Connect account. Your existing password will be used.
                    </p>
                  </div>
                ) : (
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
                        {...form.register("password")}
                        aria-invalid={step3Touched && !!form.formState.errors.password}
                      />
                      {step3Touched && form.formState.errors.password && (
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
                        {...form.register("passwordConfirm")}
                        aria-invalid={step3Touched && !!form.formState.errors.passwordConfirm}
                      />
                      {step3Touched && form.formState.errors.passwordConfirm && (
                        <p className="text-destructive text-sm">
                          {form.formState.errors.passwordConfirm.message}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* ID Proof Upload */}
                <div className="space-y-2">
                  <Label className="text-sm">
                    ID Proof{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional — Aadhaar / Voter ID / Passport)
                    </span>
                  </Label>
                  {idProofFile ? (
                    <div className="bg-muted/30 flex items-center justify-between rounded-md border px-3 py-2">
                      <span className="max-w-[220px] truncate text-sm">{idProofFile.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setIdProofFile(null);
                          setIdProofError(null);
                          if (idProofInputRef.current) idProofInputRef.current.value = "";
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => idProofInputRef.current?.click()}
                      className="border-muted-foreground/30 hover:border-primary/50 flex w-full items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm transition-colors"
                    >
                      <Upload className="text-muted-foreground h-4 w-4 shrink-0" />
                      <span className="text-muted-foreground">
                        Click to upload (JPG, PNG, PDF — max 5 MB)
                      </span>
                    </button>
                  )}
                  <input
                    ref={idProofInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,.pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      setIdProofError(null);
                      if (!file) {
                        setIdProofFile(null);
                        return;
                      }
                      if (!ALLOWED_ID_TYPES.includes(file.type)) {
                        setIdProofError("Invalid file type. Use JPG, PNG, WebP, or PDF.");
                        setIdProofFile(null);
                        return;
                      }
                      if (file.size > MAX_ID_SIZE) {
                        setIdProofError("File too large. Max 5 MB allowed.");
                        setIdProofFile(null);
                        return;
                      }
                      setIdProofFile(file);
                    }}
                  />
                  {idProofError && <p className="text-destructive text-sm">{idProofError}</p>}
                </div>

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="consent"
                    checked={Boolean(consentWhatsApp)}
                    onCheckedChange={(checked) =>
                      form.setValue("consentWhatsApp", checked === true ? true : (false as never))
                    }
                  />
                  <Label htmlFor="consent" className="text-sm">
                    I consent to receive WhatsApp messages from this society
                  </Label>
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex gap-3 pt-2">
              {currentStep > 1 && (
                <Button type="button" variant="outline" className="flex-1" onClick={handleBack}>
                  Back
                </Button>
              )}
              {currentStep < TOTAL_STEPS ? (
                <Button type="button" className="flex-1" onClick={handleNext}>
                  Next
                </Button>
              ) : (
                <Button type="submit" className="flex-1" disabled={mutation.isPending}>
                  {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Registration
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
