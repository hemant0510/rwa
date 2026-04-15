import { prisma } from "@/lib/prisma";

import type { Prisma } from "@prisma/client";

export type CounsellorAuditAction =
  | "COUNSELLOR_LOGIN"
  | "COUNSELLOR_VIEW_DASHBOARD"
  | "COUNSELLOR_VIEW_SOCIETY"
  | "COUNSELLOR_VIEW_RESIDENT"
  | "COUNSELLOR_VIEW_TICKET"
  | "COUNSELLOR_ACKNOWLEDGE_ESCALATION"
  | "COUNSELLOR_RESOLVE_ESCALATION"
  | "COUNSELLOR_DEFER_ESCALATION"
  | "COUNSELLOR_POST_ADVISORY"
  | "COUNSELLOR_POST_PRIVATE_NOTE"
  | "COUNSELLOR_VIEW_ANALYTICS";

interface CounsellorAuditInput {
  counsellorId: string;
  actionType: CounsellorAuditAction;
  entityType: string;
  entityId: string;
  societyId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function logCounsellorAudit(input: CounsellorAuditInput): Promise<void> {
  try {
    await prisma.counsellorAuditLog.create({
      data: {
        counsellorId: input.counsellorId,
        actionType: input.actionType,
        entityType: input.entityType,
        entityId: input.entityId,
        societyId: input.societyId ?? null,
        metadata: input.metadata ?? undefined,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (err) {
    console.error("[CounsellorAudit] Failed to log:", err);
  }
}
