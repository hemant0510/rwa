import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetFullAccessAdmin = vi.hoisted(() => vi.fn());

vi.mock("@/lib/get-current-user", () => ({
  getFullAccessAdmin: mockGetFullAccessAdmin,
}));

import { mockPrisma } from "../__mocks__/prisma";

// eslint-disable-next-line import/order
import { GET } from "@/app/api/v1/societies/[id]/platform-payment-info/route";

const SOCIETY_ID = "soc-uuid-1";

const mockAdmin = {
  userId: "admin-uuid-1",
  societyId: SOCIETY_ID,
  role: "RWA_ADMIN",
};

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/v1/societies/[id]/platform-payment-info", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFullAccessAdmin.mockResolvedValue(mockAdmin);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetFullAccessAdmin.mockResolvedValue(null);
    const res = await GET({} as never, makeParams(SOCIETY_ID));
    expect(res.status).toBe(401);
  });

  it("returns 401 when societyId mismatches", async () => {
    const res = await GET({} as never, makeParams("other-soc"));
    expect(res.status).toBe(401);
  });

  it("returns platform UPI settings when all keys present", async () => {
    mockPrisma.platformSetting.findMany.mockResolvedValue([
      { settingKey: "platform_upi_id", settingValue: "rwaconnect@icici" },
      { settingKey: "platform_upi_qr_url", settingValue: "https://example.com/qr.png" },
      { settingKey: "platform_upi_account_name", settingValue: "RWA Connect Technologies" },
    ]);

    const res = await GET({} as never, makeParams(SOCIETY_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      platformUpiId: "rwaconnect@icici",
      platformUpiQrUrl: "https://example.com/qr.png",
      platformUpiAccountName: "RWA Connect Technologies",
    });
  });

  it("returns nulls when no platform settings are configured", async () => {
    mockPrisma.platformSetting.findMany.mockResolvedValue([]);

    const res = await GET({} as never, makeParams(SOCIETY_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      platformUpiId: null,
      platformUpiQrUrl: null,
      platformUpiAccountName: null,
    });
  });

  it("returns partial nulls when only some keys are set", async () => {
    mockPrisma.platformSetting.findMany.mockResolvedValue([
      { settingKey: "platform_upi_id", settingValue: "rwaconnect@icici" },
    ]);

    const res = await GET({} as never, makeParams(SOCIETY_ID));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.platformUpiId).toBe("rwaconnect@icici");
    expect(body.platformUpiQrUrl).toBeNull();
    expect(body.platformUpiAccountName).toBeNull();
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.platformSetting.findMany.mockRejectedValue(new Error("DB error"));
    const res = await GET({} as never, makeParams(SOCIETY_ID));
    expect(res.status).toBe(500);
  });
});
