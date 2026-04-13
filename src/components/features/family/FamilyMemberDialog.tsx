"use client";

import { useEffect, useRef, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { type Resolver, useForm } from "react-hook-form";
import { toast } from "sonner";

import { BLOOD_GROUP_LABELS } from "@/components/features/family/FamilyMemberCard";
import { RELATIONSHIP_LABELS } from "@/components/features/family/RelationshipBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { compressImage } from "@/lib/utils/compress-image";
import { type FamilyMemberInput, familyMemberSchema } from "@/lib/validations/family";
import {
  createFamilyMember,
  type FamilyMember,
  updateFamilyMember,
  uploadFamilyMemberIdProof,
  uploadFamilyMemberPhoto,
} from "@/services/family";

interface FamilyMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: FamilyMember | null;
  onSaved: () => void;
}

type FormValues = FamilyMemberInput;

const RELATIONSHIP_OPTIONS = Object.entries(RELATIONSHIP_LABELS) as Array<[string, string]>;
const BLOOD_GROUP_OPTIONS = Object.entries(BLOOD_GROUP_LABELS) as Array<[string, string]>;

function emptyDefaults(): FormValues {
  return {
    name: "",
    relationship: "OTHER",
    otherRelationship: "",
    dateOfBirth: "",
    bloodGroup: undefined,
    mobile: "",
    email: "",
    occupation: "",
    isEmergencyContact: false,
    emergencyPriority: undefined,
    medicalNotes: "",
  } as unknown as FormValues;
}

function memberToDefaults(member: FamilyMember): FormValues {
  return {
    name: member.name,
    relationship: member.relationship,
    otherRelationship: member.otherRelationship ?? "",
    dateOfBirth: member.dateOfBirth ?? "",
    bloodGroup: (member.bloodGroup as FormValues["bloodGroup"]) ?? undefined,
    mobile: member.mobile ?? "",
    email: member.email ?? "",
    occupation: member.occupation ?? "",
    isEmergencyContact: member.isEmergencyContact,
    emergencyPriority: (member.emergencyPriority as FormValues["emergencyPriority"]) ?? undefined,
    medicalNotes: member.medicalNotes ?? "",
  } as FormValues;
}

export function FamilyMemberDialog({
  open,
  onOpenChange,
  member,
  onSaved,
}: FamilyMemberDialogProps) {
  const photoRef = useRef<HTMLInputElement>(null);
  const idProofRef = useRef<HTMLInputElement>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [idProofFile, setIdProofFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(familyMemberSchema) as unknown as Resolver<FormValues>,
    defaultValues: member ? memberToDefaults(member) : emptyDefaults(),
  });

  useEffect(() => {
    if (open) {
      form.reset(member ? memberToDefaults(member) : emptyDefaults());
      setPhotoFile(null);
      setIdProofFile(null);
    }
  }, [open, member, form]);

  const relationship = form.watch("relationship");
  const isEmergencyContact = form.watch("isEmergencyContact");

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const cleaned: FormValues = {
        ...values,
        otherRelationship: values.relationship === "OTHER" ? values.otherRelationship : undefined,
        emergencyPriority: values.isEmergencyContact ? values.emergencyPriority : undefined,
      };

      const saved = member
        ? await updateFamilyMember(member.id, cleaned)
        : await createFamilyMember(cleaned);

      if (photoFile) {
        try {
          const compressed = await compressImage(photoFile);
          await uploadFamilyMemberPhoto(saved.id, compressed);
        } catch {
          toast.error("Photo upload failed — member saved");
        }
      }
      if (idProofFile) {
        try {
          await uploadFamilyMemberIdProof(saved.id, idProofFile);
        } catch {
          toast.error("ID proof upload failed — member saved");
        }
      }

      toast.success(member ? "Family member updated" : "Family member added");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to save family member";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  const errors = form.formState.errors;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{member ? "Edit Family Member" : "Add Family Member"}</DialogTitle>
          <DialogDescription>
            {member
              ? "Update the family member's details below."
              : "Add a family member who lives in your household."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="fm-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input id="fm-name" {...form.register("name")} aria-invalid={!!errors.name} />
            {errors.name && (
              <p className="text-destructive text-xs" id="fm-name-error">
                {errors.name.message}
              </p>
            )}
          </div>

          {/* Relationship */}
          <div className="space-y-1.5">
            <Label htmlFor="fm-relationship">
              Relationship <span className="text-destructive">*</span>
            </Label>
            <Select
              value={form.watch("relationship")}
              onValueChange={(v) => form.setValue("relationship", v as FormValues["relationship"])}
            >
              <SelectTrigger id="fm-relationship" className="w-full">
                <SelectValue placeholder="Select relationship" />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIP_OPTIONS.map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* v8 ignore start */}
            {errors.relationship && (
              <p className="text-destructive text-xs">{errors.relationship.message}</p>
            )}
            {/* v8 ignore stop */}
          </div>

          {/* Other relationship — conditional */}
          {relationship === "OTHER" && (
            <div className="space-y-1.5">
              <Label htmlFor="fm-other-rel">
                Specify Relationship <span className="text-destructive">*</span>
              </Label>
              <Input
                id="fm-other-rel"
                placeholder="e.g. Family Friend"
                {...form.register("otherRelationship")}
              />
              {errors.otherRelationship && (
                <p className="text-destructive text-xs">{errors.otherRelationship.message}</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* DOB */}
            <div className="space-y-1.5">
              <Label htmlFor="fm-dob">Date of Birth</Label>
              <Input id="fm-dob" type="date" {...form.register("dateOfBirth")} />
              {/* v8 ignore start */}
              {errors.dateOfBirth && (
                <p className="text-destructive text-xs">{errors.dateOfBirth.message}</p>
              )}
              {/* v8 ignore stop */}
            </div>

            {/* Blood Group */}
            <div className="space-y-1.5">
              <Label htmlFor="fm-blood">Blood Group</Label>
              <Select
                value={form.watch("bloodGroup") ?? ""}
                onValueChange={(v) =>
                  form.setValue(
                    "bloodGroup",
                    /* v8 ignore next */
                    (v || undefined) as FormValues["bloodGroup"],
                  )
                }
              >
                <SelectTrigger id="fm-blood" className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {BLOOD_GROUP_OPTIONS.map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Mobile */}
            <div className="space-y-1.5">
              <Label htmlFor="fm-mobile">Mobile</Label>
              <Input
                id="fm-mobile"
                placeholder="10-digit number"
                {...form.register("mobile")}
                aria-invalid={!!errors.mobile}
              />
              {errors.mobile && (
                <p className="text-destructive text-xs">Enter a valid 10-digit mobile</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="fm-email">Email</Label>
              <Input
                id="fm-email"
                type="email"
                {...form.register("email")}
                aria-invalid={!!errors.email}
              />
              {/* v8 ignore start */}
              {errors.email && <p className="text-destructive text-xs">Enter a valid email</p>}
              {/* v8 ignore stop */}
            </div>
          </div>

          {/* Occupation */}
          <div className="space-y-1.5">
            <Label htmlFor="fm-occupation">Occupation</Label>
            <Input id="fm-occupation" {...form.register("occupation")} />
          </div>

          {/* Photo + ID Proof */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fm-photo">Photo (optional)</Label>
              <Input
                id="fm-photo"
                ref={photoRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) =>
                  /* v8 ignore next */
                  setPhotoFile(e.target.files?.[0] ?? null)
                }
              />
              {photoFile && (
                <p className="text-muted-foreground text-xs">Selected: {photoFile.name}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fm-id-proof">ID Proof (optional)</Label>
              <Input
                id="fm-id-proof"
                ref={idProofRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) =>
                  /* v8 ignore next */
                  setIdProofFile(e.target.files?.[0] ?? null)
                }
              />
              {idProofFile && (
                <p className="text-muted-foreground text-xs">Selected: {idProofFile.name}</p>
              )}
            </div>
          </div>

          {/* Emergency Contact toggle */}
          <div className="space-y-2 rounded-md border p-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="fm-emergency" className="cursor-pointer">
                Emergency Contact
              </Label>
              <Switch
                id="fm-emergency"
                checked={isEmergencyContact}
                onCheckedChange={(v) => form.setValue("isEmergencyContact", v)}
              />
            </div>

            {isEmergencyContact && (
              <div className="space-y-1.5 pt-2">
                <Label>Priority</Label>
                <RadioGroup
                  value={
                    form.watch("emergencyPriority") !== undefined
                      ? String(form.watch("emergencyPriority"))
                      : ""
                  }
                  onValueChange={(v) => form.setValue("emergencyPriority", Number(v) as 1 | 2)}
                  className="flex gap-4"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem id="prio-1" value="1" />
                    <Label htmlFor="prio-1" className="cursor-pointer text-sm">
                      Primary
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem id="prio-2" value="2" />
                    <Label htmlFor="prio-2" className="cursor-pointer text-sm">
                      Secondary
                    </Label>
                  </div>
                </RadioGroup>
                {errors.emergencyPriority && (
                  <p className="text-destructive text-xs">{errors.emergencyPriority.message}</p>
                )}
              </div>
            )}
          </div>

          {/* Medical Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="fm-notes">Medical Notes</Label>
            <Textarea
              id="fm-notes"
              rows={3}
              maxLength={500}
              placeholder="Allergies, conditions, etc."
              {...form.register("medicalNotes")}
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {/* v8 ignore start */}
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {/* v8 ignore stop */}
              {member ? "Save Changes" : "Add Member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
