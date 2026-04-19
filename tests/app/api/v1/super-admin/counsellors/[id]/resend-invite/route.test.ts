import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  counsellor: { findUnique: vi.fn() },
}));
const mockGenerateLink = vi.hoisted(() => vi.fn());
const mockSendEmail = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { generateLink: mockGenerateLink } },
  }),
}));
vi.mock("@/lib/email", () => ({ sendEmail: mockSendEmail }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));

import { POST } from "@/app/api/v1/super-admin/counsellors/[id]/resend-invite/route";

const mockSAContext = {
  data: { superAdminId: "sa-1", authUserId: "auth-sa-1", email: "sa@rwa.com" },
  error: null,
};

const makeParams = (id = "c-1") => ({ params: Promise.resolve({ id }) });
const makeReq = () =>
  new Request("http://localhost/api/v1/super-admin/counsellors/c-1/resend-invite", {
    method: "POST",
  }) as never;

describe("POST /api/v1/super-admin/counsellors/[id]/resend-invite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(mockSAContext);
    mockPrisma.counsellor.findUnique.mockResolvedValue({
      id: "c-1",
      email: "asha@x.com",
      name: "Asha",
      isActive: true,
      passwordSetAt: null,
    });
    mockGenerateLink.mockResolvedValue({
      data: {
        properties: { hashed_token: "hash-abc", verification_type: "invite" },
      },
      error: null,
    });
    mockSendEmail.mockResolvedValue(undefined);
  });

  it("returns 403 when SA guard rejects", async () => {
    const forbidden = new Response("{}", { status: 403 });
    mockRequireSuperAdmin.mockResolvedValue({ data: null, error: forbidden });
    const res = await POST(makeReq(), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 404 when counsellor not found", async () => {
    mockPrisma.counsellor.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq(), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 400 when counsellor is suspended", async () => {
    mockPrisma.counsellor.findUnique.mockResolvedValue({
      id: "c-1",
      email: "asha@x.com",
      name: "Asha",
      isActive: false,
      passwordSetAt: null,
    });
    const res = await POST(makeReq(), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("COUNSELLOR_SUSPENDED");
  });

  it("returns 400 when counsellor has already set their password", async () => {
    mockPrisma.counsellor.findUnique.mockResolvedValue({
      id: "c-1",
      email: "asha@x.com",
      name: "Asha",
      isActive: true,
      passwordSetAt: new Date(),
    });
    const res = await POST(makeReq(), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("ALREADY_ONBOARDED");
  });

  it("returns 500 when generateLink fails", async () => {
    mockGenerateLink.mockResolvedValue({ data: null, error: { message: "rate" } });
    const res = await POST(makeReq(), makeParams());
    expect(res.status).toBe(500);
  });

  it("falls back to recovery when Supabase rejects a repeat invite", async () => {
    mockGenerateLink
      .mockResolvedValueOnce({ data: null, error: { message: "User already registered" } })
      .mockResolvedValueOnce({
        data: {
          properties: { hashed_token: "hash-recovery", verification_type: "recovery" },
        },
        error: null,
      });

    const res = await POST(makeReq(), makeParams());

    expect(res.status).toBe(200);
    expect(mockGenerateLink).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ type: "invite", email: "asha@x.com" }),
    );
    expect(mockGenerateLink).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ type: "recovery", email: "asha@x.com" }),
    );
    expect(mockSendEmail).toHaveBeenCalled();
  });

  it("uses fallback message when generateLink error has no message", async () => {
    mockGenerateLink.mockResolvedValue({ data: null, error: {} });
    const res = await POST(makeReq(), makeParams());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.message).toBe("Failed to generate invite link");
  });

  it("returns 500 when generateLink succeeds but no action_link", async () => {
    mockGenerateLink.mockResolvedValue({ data: { properties: {} }, error: null });
    const res = await POST(makeReq(), makeParams());
    expect(res.status).toBe(500);
  });

  it("sends invite email and logs audit on success", async () => {
    const res = await POST(makeReq(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sent).toBe(true);
    expect(mockSendEmail).toHaveBeenCalled();
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "SA_COUNSELLOR_INVITE_RESENT" }),
    );
  });

  it("returns 500 on unexpected prisma error", async () => {
    mockPrisma.counsellor.findUnique.mockRejectedValue(new Error("DB"));
    const res = await POST(makeReq(), makeParams());
    expect(res.status).toBe(500);
  });
});
