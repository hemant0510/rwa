import { z } from "zod";

const PETITION_TYPE_ENUM = ["COMPLAINT", "PETITION", "NOTICE"] as const;

// ── Create Petition ──

export const createPetitionSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  description: z.string().max(5000).optional().nullable(),
  type: z.enum(PETITION_TYPE_ENUM),
  targetAuthority: z.string().max(200).optional().nullable(),
  minSignatures: z.number().int().min(1).optional().nullable(),
  deadline: z.string().optional().nullable(),
});

export type CreatePetitionInput = z.infer<typeof createPetitionSchema>;

// ── Update Petition (DRAFT only) ──

export const updatePetitionSchema = z
  .object({
    title: z.string().min(3).max(200).optional(),
    description: z.string().max(5000).optional().nullable(),
    type: z.enum(PETITION_TYPE_ENUM).optional(),
    targetAuthority: z.string().max(200).optional().nullable(),
    minSignatures: z.number().int().min(1).optional().nullable(),
    deadline: z.string().optional().nullable(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "At least one field must be provided",
  });

export type UpdatePetitionInput = z.infer<typeof updatePetitionSchema>;

// ── Close Petition ──

export const closePetitionSchema = z.object({
  reason: z.string().min(3, "Reason must be at least 3 characters").max(1000),
});

export type ClosePetitionInput = z.infer<typeof closePetitionSchema>;

// ── Sign Petition ──

export const signPetitionSchema = z.object({
  method: z.enum(["DRAWN", "UPLOADED"]),
  signatureDataUrl: z
    .string()
    .min(1, "Signature data is required")
    .refine((val) => val.startsWith("data:image/"), {
      message: "Must be a valid base64 data URL",
    }),
});

export type SignPetitionInput = z.infer<typeof signPetitionSchema>;
