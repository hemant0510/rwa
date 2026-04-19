import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireCounsellor = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  counsellor: { update: vi.fn() },
}));
const mockAdminUpdateUserById = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-guard", () => ({ requireCounsellor: mockRequireCounsellor }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { updateUserById: mockAdminUpdateUserById } },
  }),
}));

import { POST } from "@/app/api/v1/counsellor/first-password/route";

const counsellorContext = {
  data: {
    counsellorId: "c-1",
    authUserId: "auth-1",
    email: "asha@x.com",
    name: "Asha",
    isSuperAdmin: false,
  },
  error: null,
};

function makeReq(body: unknown) {
  return new Request("http://localhost/api/v1/counsellor/first-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/counsellor/first-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireCounsellor.mockResolvedValue(counsellorContext);
    mockPrisma.counsellor.update.mockResolvedValue({});
    mockAdminUpdateUserById.mockResolvedValue({ error: null });
  });

  it("returns 403 when guard rejects", async () => {
    const forbidden = new Response("{}", { status: 403 });
    mockRequireCounsellor.mockResolvedValue({ data: null, error: forbidden });
    const res = await POST(makeReq({ password: "password123" }));
    expect(res.status).toBe(403);
  });

  it("returns 403 when caller is super admin", async () => {
    mockRequireCounsellor.mockResolvedValue({
      data: { ...counsellorContext.data, isSuperAdmin: true },
      error: null,
    });
    const res = await POST(makeReq({ password: "password123" }));
    expect(res.status).toBe(403);
    expect(mockAdminUpdateUserById).not.toHaveBeenCalled();
    expect(mockPrisma.counsellor.update).not.toHaveBeenCalled();
  });

  it("returns 422 when password is too short", async () => {
    const res = await POST(makeReq({ password: "short" }));
    expect(res.status).toBe(422);
    expect(mockAdminUpdateUserById).not.toHaveBeenCalled();
  });

  it("returns 422 when password field is missing", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(422);
  });

  it("sets password via admin and stamps passwordSetAt on success", async () => {
    const res = await POST(makeReq({ password: "eden@1234" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.passwordSet).toBe(true);

    expect(mockAdminUpdateUserById).toHaveBeenCalledWith("auth-1", {
      password: "eden@1234",
    });
    expect(mockPrisma.counsellor.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "c-1" },
        data: expect.objectContaining({ passwordSetAt: expect.any(Date) }),
      }),
    );
  });

  it("returns 400 when admin password update fails", async () => {
    mockAdminUpdateUserById.mockResolvedValue({ error: { message: "weak password" } });
    const res = await POST(makeReq({ password: "password123" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("PASSWORD_UPDATE_FAILED");
    expect(body.error.message).toBe("weak password");
    expect(mockPrisma.counsellor.update).not.toHaveBeenCalled();
  });

  it("falls back to generic message when admin error has no message", async () => {
    mockAdminUpdateUserById.mockResolvedValue({ error: {} });
    const res = await POST(makeReq({ password: "password123" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toBe("Failed to update password.");
  });

  it("returns 500 when prisma update throws", async () => {
    mockPrisma.counsellor.update.mockRejectedValue(new Error("db"));
    const res = await POST(makeReq({ password: "password123" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.message).toContain("Password set");
  });
});
