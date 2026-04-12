import { VehicleType } from "@prisma/client";
import { z } from "zod";

// Accepts common Indian formats: DL3CAB1234 / DL 3C AB 1234 / DL-3C-AB-1234
const REG_REGEX = /^[A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{1,3}[\s-]?\d{4}$/i;

const vehicleBaseSchema = z.object({
  registrationNumber: z
    .string()
    .regex(REG_REGEX, "Enter a valid registration number (e.g. DL 3C AB 1234)"),
  vehicleType: z.nativeEnum(VehicleType),
  make: z.string().max(50).optional(),
  model: z.string().max(50).optional(),
  colour: z.string().max(30).optional(),
  unitId: z.string().uuid(),
  dependentOwnerId: z.string().uuid().nullable().optional(),
  parkingSlot: z.string().max(20).optional(),
  insuranceExpiry: z.string().date().optional(),
  pucExpiry: z.string().date().optional(),
  rcExpiry: z.string().date().optional(),
  fastagId: z.string().max(30).optional(),
  notes: z.string().max(300).optional(),
});

export const vehicleSchema = vehicleBaseSchema;

export const vehicleUpdateSchema = vehicleBaseSchema
  .omit({ unitId: true }) // unitId cannot be changed after creation
  .partial();

export type VehicleInput = z.infer<typeof vehicleSchema>;
export type VehicleUpdateInput = z.infer<typeof vehicleUpdateSchema>;
