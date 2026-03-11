import { describe, it, expect, vi, beforeEach } from "vitest";

import { logAudit } from "@/lib/audit";

const mockPrisma = vi.hoisted(() => ({
  auditLog: { create: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

describe("logAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates audit log entry", async () => {
    mockPrisma.auditLog.create.mockResolvedValue({ id: "audit-1" });

    await logAudit({
      actionType: "RESIDENT_APPROVED",
      userId: "admin-1",
      societyId: "society-1",
      entityType: "USER",
      entityId: "user-1",
      oldValue: { status: "PENDING_APPROVAL" },
      newValue: { status: "ACTIVE_PENDING" },
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        actionType: "RESIDENT_APPROVED",
        userId: "admin-1",
        societyId: "society-1",
        entityType: "USER",
        entityId: "user-1",
      }),
    });
  });

  it("handles missing optional fields", async () => {
    mockPrisma.auditLog.create.mockResolvedValue({ id: "audit-2" });

    await logAudit({
      actionType: "ADMIN_LOGIN",
      userId: "admin-1",
      entityType: "SESSION",
      entityId: "session-1",
    });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        societyId: null,
        ipAddress: null,
        userAgent: null,
      }),
    });
  });

  it("does not throw on database error", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockPrisma.auditLog.create.mockRejectedValue(new Error("DB error"));

    await expect(
      logAudit({
        actionType: "ADMIN_LOGIN",
        userId: "admin-1",
        entityType: "SESSION",
        entityId: "session-1",
      }),
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
