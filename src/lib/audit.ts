import { prisma } from "@/lib/prisma";

import type { Prisma } from "@prisma/client";

type AuditAction =
  | "SOCIETY_CREATED"
  | "SOCIETY_UPDATED"
  | "RESIDENT_REGISTERED"
  | "RESIDENT_APPROVED"
  | "RESIDENT_REJECTED"
  | "PAYMENT_RECORDED"
  | "PAYMENT_REVERSED"
  | "EXEMPTION_GRANTED"
  | "EXPENSE_CREATED"
  | "EXPENSE_REVERSED"
  | "BROADCAST_SENT"
  | "ADMIN_LOGIN"
  | "ADMIN_LOGOUT"
  | "MIGRATION_STARTED"
  | "MIGRATION_COMPLETED"
  | "EVENT_CREATED"
  | "EVENT_UPDATED"
  | "EVENT_DELETED"
  | "EVENT_PUBLISHED"
  | "EVENT_PAYMENT_TRIGGERED"
  | "EVENT_CANCELLED"
  | "EVENT_COMPLETED"
  | "EVENT_REGISTRATION_CREATED"
  | "EVENT_REGISTRATION_CANCELLED"
  | "EVENT_PAYMENT_RECORDED"
  | "EVENT_EXPENSE_ADDED"
  | "EVENT_SETTLED";

interface AuditLogInput {
  actionType: AuditAction;
  userId: string;
  societyId?: string;
  entityType: string;
  entityId: string;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAudit(input: AuditLogInput) {
  try {
    await prisma.auditLog.create({
      data: {
        actionType: input.actionType,
        userId: input.userId,
        societyId: input.societyId ?? null,
        entityType: input.entityType,
        entityId: input.entityId,
        oldValue: input.oldValue ?? undefined,
        newValue: input.newValue ?? undefined,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (err) {
    // Non-blocking: audit logging should never break the main flow
    console.error("[Audit] Failed to log:", err);
  }
}
