import { BloodGroup, RelationshipType } from "@prisma/client";
import { z } from "zod";

const familyMemberBaseSchema = z.object({
  name: z.string().min(2).max(100),
  relationship: z.nativeEnum(RelationshipType),
  otherRelationship: z.string().max(50).optional(),
  dateOfBirth: z.string().optional(),
  bloodGroup: z.nativeEnum(BloodGroup).optional(),
  mobile: z
    .string()
    .regex(/^[6-9]\d{9}$/)
    .optional()
    .or(z.literal("")),
  email: z.string().email().optional().or(z.literal("")),
  occupation: z.string().max(100).optional(),
  isEmergencyContact: z.boolean().default(false),
  emergencyPriority: z.number().int().min(1).max(2).optional(),
  medicalNotes: z.string().max(500).optional(),
});

export const familyMemberSchema = familyMemberBaseSchema.superRefine((data, ctx) => {
  if (data.relationship === "OTHER" && !data.otherRelationship?.trim()) {
    ctx.addIssue({
      code: "custom",
      path: ["otherRelationship"],
      message: "Please specify the relationship",
    });
  }
  if (data.isEmergencyContact && !data.emergencyPriority) {
    ctx.addIssue({
      code: "custom",
      path: ["emergencyPriority"],
      message: "Select Primary or Secondary",
    });
  }
});

export const familyMemberUpdateSchema = familyMemberBaseSchema
  .partial()
  .superRefine((data, ctx) => {
    if (data.relationship === "OTHER" && !data.otherRelationship?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["otherRelationship"],
        message: "Please specify the relationship",
      });
    }
    if (data.isEmergencyContact === true && !data.emergencyPriority) {
      ctx.addIssue({
        code: "custom",
        path: ["emergencyPriority"],
        message: "Select Primary or Secondary",
      });
    }
  });

export type FamilyMemberInput = z.infer<typeof familyMemberSchema>;
export type FamilyMemberUpdateInput = z.infer<typeof familyMemberUpdateSchema>;
