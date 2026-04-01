import { z } from "zod";

export const createAnnouncementSchema = z.object({
  subject: z.string().min(5, "Subject must be at least 5 characters").max(200),
  body: z.string().min(10, "Body must be at least 10 characters").max(5000),
  priority: z.enum(["NORMAL", "URGENT"]).default("NORMAL"),
  scope: z.enum(["ALL", "TARGETED"]).default("ALL"),
  societyIds: z.array(z.string().uuid()).default([]),
  sentVia: z.array(z.enum(["IN_APP", "EMAIL", "WHATSAPP"])).default(["IN_APP"]),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
