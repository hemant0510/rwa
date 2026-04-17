import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireCounsellor = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  counsellor: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock("@/lib/auth-guard", () => ({ requireCounsellor: mockRequireCounsellor }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET, PATCH } from "@/app/api/v1/counsellor/me/route";

const counsellorContext = {
  data: {
    counsellorId: "c-1",
    authUserId: "auth-1",
    email: "asha@x.com",
    name: "Asha",
  },
  error: null,
};

const mockProfile = {
  id: "c-1",
  authUserId: "auth-1",
  email: "asha@x.com",
  mobile: "+91 9876543210",
  name: "Asha Patel",
  nationalId: null,
  photoUrl: null,
  bio: null,
  publicBlurb: null,
  isActive: true,
  mfaRequired: true,
  mfaEnrolledAt: new Date().toISOString(),
  lastLoginAt: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const makePatchReq = (body: unknown) =>
  new Request("http://localhost/api/v1/counsellor/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;

describe("GET /api/v1/counsellor/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireCounsellor.mockResolvedValue(counsellorContext);
    mockPrisma.counsellor.findUnique.mockResolvedValue(mockProfile);
    mockPrisma.counsellor.update.mockResolvedValue({});
  });

  it("returns 403 when guard rejects", async () => {
    const forbidden = new Response("{}", { status: 403 });
    mockRequireCounsellor.mockResolvedValue({ data: null, error: forbidden });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns counsellor profile and updates lastLoginAt", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("c-1");
    expect(mockPrisma.counsellor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c-1" },
        data: expect.objectContaining({ lastLoginAt: expect.any(Date) }),
      }),
    );
  });

  it("returns SA identity when super admin calls GET", async () => {
    mockRequireCounsellor.mockResolvedValue({
      data: {
        counsellorId: "__super_admin__",
        authUserId: "auth-sa",
        email: "sa@x.com",
        name: "SA",
        isSuperAdmin: true,
      },
      error: null,
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("__super_admin__");
    expect(body.isSuperAdmin).toBe(true);
    expect(body.email).toBe("sa@x.com");
    expect(mockPrisma.counsellor.findUnique).not.toHaveBeenCalled();
  });

  it("swallows lastLoginAt update failure (best-effort)", async () => {
    mockPrisma.counsellor.update.mockRejectedValue(new Error("DB"));
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it("returns 500 when prisma findUnique throws", async () => {
    mockPrisma.counsellor.findUnique.mockRejectedValue(new Error("DB"));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/v1/counsellor/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireCounsellor.mockResolvedValue(counsellorContext);
    mockPrisma.counsellor.update.mockResolvedValue({
      id: "c-1",
      name: "New Name",
      email: "asha@x.com",
      mobile: null,
      bio: null,
      publicBlurb: null,
      photoUrl: null,
    });
  });

  it("returns 403 when guard rejects", async () => {
    const forbidden = new Response("{}", { status: 403 });
    mockRequireCounsellor.mockResolvedValue({ data: null, error: forbidden });
    const res = await PATCH(makePatchReq({ name: "New Name" }));
    expect(res.status).toBe(403);
  });

  it("returns 422 on invalid payload", async () => {
    const res = await PATCH(makePatchReq({ mobile: "abc" }));
    expect(res.status).toBe(422);
  });

  it("updates own profile and returns the new shape", async () => {
    const res = await PATCH(makePatchReq({ name: "New Name" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("New Name");
    expect(mockPrisma.counsellor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c-1" },
        data: expect.objectContaining({ name: "New Name" }),
      }),
    );
  });

  it("returns 500 on prisma update failure", async () => {
    mockPrisma.counsellor.update.mockRejectedValue(new Error("DB"));
    const res = await PATCH(makePatchReq({ name: "New Name" }));
    expect(res.status).toBe(500);
  });

  it("returns 403 for super admin", async () => {
    mockRequireCounsellor.mockResolvedValue({
      data: {
        counsellorId: "__super_admin__",
        authUserId: "auth-sa",
        email: "sa@x.com",
        name: "SA",
        isSuperAdmin: true,
      },
      error: null,
    });
    const res = await PATCH(makePatchReq({ name: "New Name" }));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.message).toContain("Super Admin");
  });
});
