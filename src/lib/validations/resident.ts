import { z } from "zod";

export const registerResidentSchema = z
  .object({
    fullName: z.string().min(2, "Name must be at least 2 characters").max(100),
    mobile: z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian mobile number"),
    ownershipType: z.enum(["OWNER", "TENANT"]),
    email: z.string().email("Valid email is required"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    passwordConfirm: z.string(),
    consentWhatsApp: z.literal(true, { error: "WhatsApp consent is required" }),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: "Passwords do not match",
    path: ["passwordConfirm"],
  });

export type RegisterResidentInput = z.infer<typeof registerResidentSchema>;

// Dynamic unit validation per society type
export const unitFieldsSchema = {
  APARTMENT_COMPLEX: z.object({
    towerBlock: z.string().min(1, "Tower/Block is required"),
    floorNo: z.string().min(1, "Floor is required"),
    flatNo: z.string().min(1, "Flat number is required"),
  }),
  BUILDER_FLOORS: z.object({
    houseNo: z.string().min(1, "House number is required"),
    floorLevel: z.enum(["GF", "1F", "2F", "3F", "4F", "Terrace"]),
  }),
  GATED_COMMUNITY_VILLAS: z.object({
    villaNo: z.string().min(1, "Villa number is required"),
    streetPhase: z.string().optional(),
  }),
  INDEPENDENT_SECTOR: z.object({
    houseNo: z.string().min(1, "House number is required"),
    streetGali: z.string().min(1, "Street/Gali is required"),
    sectorBlock: z.string().min(1, "Sector/Block is required"),
  }),
  PLOTTED_COLONY: z.object({
    plotNo: z.string().min(1, "Plot number is required"),
    laneNo: z.string().optional(),
    phase: z.string().optional(),
  }),
} as const;
