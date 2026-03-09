import { z } from "zod";

export const registerResidentSchema = z
  .object({
    // Step 1: Personal Info
    fullName: z.string().min(2, "Name must be at least 2 characters").max(100),
    mobile: z.string().regex(/^[6-9]\d{9}$/, "Invalid Indian mobile number"),
    email: z.string().email("Valid email is required"),

    // Step 2: Property Details
    ownershipType: z.enum(["OWNER", "TENANT", "OTHER"]),
    otherOwnershipDetail: z.string().max(100).optional(),
    unitType: z.enum(["FLOOR", "HOUSE"]).optional(),

    // Step 3: Account Setup
    password: z.string().min(8, "Password must be at least 8 characters").optional(),
    passwordConfirm: z.string().optional(),
    reuseAuth: z.boolean().optional(),
    consentWhatsApp: z.literal(true, { error: "WhatsApp consent is required" }),
  })
  .refine(
    (data) =>
      data.ownershipType !== "OTHER" ||
      (data.otherOwnershipDetail && data.otherOwnershipDetail.trim().length >= 2),
    {
      message: "Please specify ownership type (min 2 characters)",
      path: ["otherOwnershipDetail"],
    },
  )
  .refine((data) => data.reuseAuth || (data.password && data.password.length >= 8), {
    message: "Password must be at least 8 characters",
    path: ["password"],
  })
  .refine((data) => data.reuseAuth || data.password === data.passwordConfirm, {
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
  BUILDER_FLOORS_FLOOR: z.object({
    houseNo: z.string().min(1, "House number is required"),
    floorLevel: z.enum(["1F", "2F", "3F", "4F"]),
  }),
  BUILDER_FLOORS_HOUSE: z.object({
    houseNo: z.string().min(1, "House number is required"),
  }),
  GATED_COMMUNITY_VILLAS: z.object({
    villaNo: z.string().min(1, "Villa number is required"),
    streetPhase: z.string().optional(),
  }),
  INDEPENDENT_SECTOR: z.object({
    houseNo: z.string().min(1, "House number is required"),
    streetGali: z.string().min(1, "Street/Gali is required"),
    sectorBlock: z.string().optional(),
  }),
  PLOTTED_COLONY: z.object({
    plotNo: z.string().min(1, "Plot number is required"),
    laneNo: z.string().optional(),
    phase: z.string().optional(),
  }),
} as const;

export function getBuilderFloorsSchema(unitType: "FLOOR" | "HOUSE") {
  return unitType === "HOUSE"
    ? unitFieldsSchema.BUILDER_FLOORS_HOUSE
    : unitFieldsSchema.BUILDER_FLOORS_FLOOR;
}

// Field names for each registration step (for per-step validation)
export const REGISTER_STEP_FIELDS = {
  step1: ["fullName", "mobile", "email"] as const,
  step2: ["ownershipType", "otherOwnershipDetail", "unitType"] as const,
  step3: ["password", "passwordConfirm", "consentWhatsApp"] as const,
} as const;
