import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  counsellorAuditLog: { create: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { logCounsellorAudit } from "@/lib/counsellor/audit";

describe("logCounsellorAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes a row with defaults for optional fields", async () => {
    mockPrisma.counsellorAuditLog.create.mockResolvedValue({ id: "a-1" });
    await logCounsellorAudit({
      counsellorId: "c-1",
      actionType: "COUNSELLOR_VIEW_DASHBOARD",
      entityType: "Dashboard",
      entityId: "c-1",
    });
    expect(mockPrisma.counsellorAuditLog.create).toHaveBeenCalledWith({
      data: {
        counsellorId: "c-1",
        actionType: "COUNSELLOR_VIEW_DASHBOARD",
        entityType: "Dashboard",
        entityId: "c-1",
        societyId: null,
        metadata: undefined,
        ipAddress: null,
        userAgent: null,
      },
    });
  });

  it("passes through optional fields", async () => {
    mockPrisma.counsellorAuditLog.create.mockResolvedValue({ id: "a-2" });
    await logCounsellorAudit({
      counsellorId: "c-1",
      actionType: "COUNSELLOR_RESOLVE_ESCALATION",
      entityType: "ResidentTicketEscalation",
      entityId: "e-1",
      societyId: "s-1",
      metadata: { note: "ok" },
      ipAddress: "127.0.0.1",
      userAgent: "ua",
    });
    expect(mockPrisma.counsellorAuditLog.create).toHaveBeenCalledWith({
      data: {
        counsellorId: "c-1",
        actionType: "COUNSELLOR_RESOLVE_ESCALATION",
        entityType: "ResidentTicketEscalation",
        entityId: "e-1",
        societyId: "s-1",
        metadata: { note: "ok" },
        ipAddress: "127.0.0.1",
        userAgent: "ua",
      },
    });
  });

  it("swallows DB errors (non-blocking)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockPrisma.counsellorAuditLog.create.mockRejectedValue(new Error("boom"));
    await expect(
      logCounsellorAudit({
        counsellorId: "c-1",
        actionType: "COUNSELLOR_VIEW_DASHBOARD",
        entityType: "Dashboard",
        entityId: "c-1",
      }),
    ).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
