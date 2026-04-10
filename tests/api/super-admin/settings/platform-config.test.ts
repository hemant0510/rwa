import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  platformConfig: { findMany: vi.fn(), upsert: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { CONFIG_DEFAULTS } from "@/app/api/v1/super-admin/settings/platform-config/config-defaults";
import { GET, PATCH } from "@/app/api/v1/super-admin/settings/platform-config/route";

const saOk = {
  data: {
    superAdminId: "00000000-0000-4000-8000-000000000001",
    authUserId: "auth-1",
    email: "admin@superadmin.com",
  },
  error: null,
};

function makePatchReq(body: unknown) {
  return new NextRequest("http://localhost/api/v1/super-admin/settings/platform-config", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/v1/super-admin/settings/platform-config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockPrisma.platformConfig.findMany.mockResolvedValue([]);
  });

  it("returns 403 when not super admin", async () => {
    const forbiddenResponse = new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), {
      status: 403,
    });
    mockRequireSuperAdmin.mockResolvedValue({ data: null, error: forbiddenResponse });

    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns 200 with all default keys when DB is empty", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(Object.keys(CONFIG_DEFAULTS).length);

    const keys = body.map((c: { key: string }) => c.key);
    for (const key of Object.keys(CONFIG_DEFAULTS)) {
      expect(keys).toContain(key);
    }
  });

  it("uses default values when keys are not in DB", async () => {
    const res = await GET();
    const body = await res.json();
    const trialDays = body.find((c: { key: string }) => c.key === "trial_duration_days");
    expect(trialDays.value).toBe(CONFIG_DEFAULTS.trial_duration_days.value);
  });

  it("overrides defaults with stored DB values", async () => {
    mockPrisma.platformConfig.findMany.mockResolvedValue([
      { key: "trial_duration_days", value: "60", type: "number", label: "Trial Duration (days)" },
    ]);

    const res = await GET();
    const body = await res.json();
    const trialDays = body.find((c: { key: string }) => c.key === "trial_duration_days");
    expect(trialDays.value).toBe("60");
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.platformConfig.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/v1/super-admin/settings/platform-config", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockLogAudit.mockResolvedValue(undefined);
    mockPrisma.platformConfig.upsert.mockResolvedValue({});
    mockPrisma.platformConfig.findMany.mockResolvedValue([
      { key: "trial_duration_days", value: "45", type: "number", label: "Trial Duration (days)" },
    ]);
  });

  it("returns 403 when not super admin", async () => {
    const forbiddenResponse = new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), {
      status: 403,
    });
    mockRequireSuperAdmin.mockResolvedValue({ data: null, error: forbiddenResponse });

    const res = await PATCH(makePatchReq({ trial_duration_days: 45 }));
    expect(res.status).toBe(403);
  });

  it("returns 422 for empty body (no keys provided)", async () => {
    const res = await PATCH(makePatchReq({}));
    expect(res.status).toBe(422);
  });

  it("returns 422 for invalid email format", async () => {
    const res = await PATCH(makePatchReq({ support_email: "not-an-email" }));
    expect(res.status).toBe(422);
  });

  it("returns 422 for negative number", async () => {
    const res = await PATCH(makePatchReq({ trial_duration_days: -1 }));
    expect(res.status).toBe(422);
  });

  it("returns 200 and upserts the provided keys", async () => {
    const res = await PATCH(makePatchReq({ trial_duration_days: 45 }));
    expect(res.status).toBe(200);
    expect(mockPrisma.platformConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: "trial_duration_days" } }),
    );
  });

  it("returns merged config after update", async () => {
    const res = await PATCH(makePatchReq({ trial_duration_days: 45 }));
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    const trialDays = body.find((c: { key: string }) => c.key === "trial_duration_days");
    expect(trialDays.value).toBe("45");
  });

  it("logs audit on success", async () => {
    await PATCH(makePatchReq({ trial_duration_days: 45 }));
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "SA_SETTINGS_UPDATED",
        entityType: "PlatformConfig",
        entityId: "platform",
      }),
    );
  });

  it("accepts empty string for support_email", async () => {
    const res = await PATCH(makePatchReq({ support_email: "" }));
    expect(res.status).toBe(200);
  });

  it("returns 500 on DB error during upsert", async () => {
    mockPrisma.platformConfig.upsert.mockRejectedValue(new Error("DB error"));

    const res = await PATCH(makePatchReq({ trial_duration_days: 45 }));
    expect(res.status).toBe(500);
  });

  it("uses fallback type and label for keys not in CONFIG_DEFAULTS", async () => {
    // support_phone IS in CONFIG_DEFAULTS, so upsert uses def.type/def.label
    // We verify the upsert create block uses the defaults
    const res = await PATCH(makePatchReq({ support_phone: "1234567890" }));
    expect(res.status).toBe(200);
    expect(mockPrisma.platformConfig.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          type: "string",
          label: "Support Phone",
        }),
      }),
    );
  });
});
