import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  counsellor: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  },
  user: {
    findFirst: vi.fn(),
  },
  superAdmin: {
    findUnique: vi.fn(),
  },
}));
const mockAdminCreateUser = vi.hoisted(() => vi.fn());
const mockAdminDeleteUser = vi.hoisted(() => vi.fn());
const mockAdminGenerateLink = vi.hoisted(() => vi.fn());
const mockAdminListUsers = vi.hoisted(() => vi.fn());
const mockAdminUpdateUserById = vi.hoisted(() => vi.fn());
const mockSendEmail = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        createUser: mockAdminCreateUser,
        deleteUser: mockAdminDeleteUser,
        generateLink: mockAdminGenerateLink,
        listUsers: mockAdminListUsers,
        updateUserById: mockAdminUpdateUserById,
      },
    },
  }),
}));
vi.mock("@/lib/email", () => ({ sendEmail: mockSendEmail }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));

import { GET, POST } from "@/app/api/v1/super-admin/counsellors/route";

const mockSAContext = {
  data: { superAdminId: "sa-1", authUserId: "auth-sa-1", email: "sa@rwa.com" },
  error: null,
};

function makeGetRequest(query = "") {
  return new Request(`http://localhost/api/v1/super-admin/counsellors${query}`);
}

function makePostRequest(body: unknown) {
  return new Request("http://localhost/api/v1/super-admin/counsellors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validCreate = {
  name: "Asha Patel",
  email: "asha@eden.com",
  mobile: "+91 9876543210",
  bio: "10 years ombudsperson experience",
  publicBlurb: "Neutral advisor",
};

describe("GET /api/v1/super-admin/counsellors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(mockSAContext);
    mockPrisma.counsellor.findMany.mockResolvedValue([]);
    mockPrisma.counsellor.count.mockResolvedValue(0);
  });

  it("returns 403 when SA guard rejects", async () => {
    const forbidden = new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), {
      status: 403,
    });
    mockRequireSuperAdmin.mockResolvedValue({ data: null, error: forbidden });

    const res = await GET(makeGetRequest() as never);
    expect(res.status).toBe(403);
  });

  it("returns paginated list with default page + pageSize", async () => {
    mockPrisma.counsellor.findMany.mockResolvedValue([
      { id: "c-1", name: "A", email: "a@x.com", isActive: true },
    ]);
    mockPrisma.counsellor.count.mockResolvedValue(1);

    const res = await GET(makeGetRequest() as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.pageSize).toBe(20);
    expect(body.counsellors).toHaveLength(1);
  });

  it("applies status=active filter", async () => {
    await GET(makeGetRequest("?status=active") as never);
    expect(mockPrisma.counsellor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: true }) }),
    );
  });

  it("applies status=inactive filter", async () => {
    await GET(makeGetRequest("?status=inactive") as never);
    expect(mockPrisma.counsellor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isActive: false }) }),
    );
  });

  it("applies search filter across name/email/mobile", async () => {
    await GET(makeGetRequest("?search=Asha") as never);
    expect(mockPrisma.counsellor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([expect.objectContaining({ name: expect.anything() })]),
        }),
      }),
    );
  });

  it("clamps pageSize to max 100", async () => {
    await GET(makeGetRequest("?pageSize=500") as never);
    expect(mockPrisma.counsellor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });

  it("clamps page to min 1", async () => {
    await GET(makeGetRequest("?page=-3") as never);
    expect(mockPrisma.counsellor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0 }),
    );
  });

  it("returns 500 on prisma failure", async () => {
    mockPrisma.counsellor.findMany.mockRejectedValue(new Error("DB error"));
    const res = await GET(makeGetRequest() as never);
    expect(res.status).toBe(500);
  });
});

describe("POST /api/v1/super-admin/counsellors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(mockSAContext);
    mockPrisma.counsellor.findUnique.mockResolvedValue(null);
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.superAdmin.findUnique.mockResolvedValue(null);
    mockAdminCreateUser.mockResolvedValue({
      data: { user: { id: "auth-c-1" } },
      error: null,
    });
    mockAdminListUsers.mockResolvedValue({
      data: { users: [] },
      error: null,
    });
    mockAdminUpdateUserById.mockResolvedValue({ error: null });
    mockPrisma.counsellor.create.mockResolvedValue({
      id: "c-1",
      authUserId: "auth-c-1",
      email: validCreate.email,
      name: validCreate.name,
    });
    mockAdminGenerateLink.mockResolvedValue({
      data: {
        properties: { hashed_token: "hash-abc", verification_type: "invite" },
      },
      error: null,
    });
    mockSendEmail.mockResolvedValue(undefined);
    mockAdminDeleteUser.mockResolvedValue({ error: null });
  });

  it("returns 403 when SA guard rejects", async () => {
    const forbidden = new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), {
      status: 403,
    });
    mockRequireSuperAdmin.mockResolvedValue({ data: null, error: forbidden });

    const res = await POST(makePostRequest(validCreate) as never);
    expect(res.status).toBe(403);
  });

  it("returns 422 for invalid input", async () => {
    const res = await POST(makePostRequest({ email: "bad" }) as never);
    expect(res.status).toBe(422);
  });

  it("returns 409 when email already exists", async () => {
    mockPrisma.counsellor.findUnique.mockResolvedValue({ id: "c-existing" });
    const res = await POST(makePostRequest(validCreate) as never);
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("DUPLICATE_EMAIL");
  });

  it("returns 400 when Supabase Auth createUser fails", async () => {
    mockAdminCreateUser.mockResolvedValue({
      data: null,
      error: { message: "Email already used in auth" },
    });
    const res = await POST(makePostRequest(validCreate) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("AUTH_ERROR");
  });

  it("creates auth user + counsellor + sends invite email on success", async () => {
    const res = await POST(makePostRequest(validCreate) as never);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("c-1");
    expect(body.inviteSent).toBe(true);

    expect(mockAdminCreateUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: validCreate.email, email_confirm: true }),
    );
    expect(mockPrisma.counsellor.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          authUserId: "auth-c-1",
          isActive: true,
          mfaRequired: false,
        }),
      }),
    );
    expect(mockAdminGenerateLink).toHaveBeenCalledWith(
      expect.objectContaining({ type: "invite", email: validCreate.email }),
    );
    expect(mockSendEmail).toHaveBeenCalled();
    const sentHtml = mockSendEmail.mock.calls[0][2] as string;
    expect(sentHtml).toContain("/auth/confirm?");
    expect(sentHtml).toContain("token_hash=hash-abc");
    expect(sentHtml).toContain("type=invite");
    expect(sentHtml).toContain("next=%2Fcounsellor%2Fset-password");
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "SA_COUNSELLOR_CREATED" }),
    );
  });

  it("returns inviteSent=false when generateLink fails but counsellor is still created", async () => {
    mockAdminGenerateLink.mockResolvedValue({ data: null, error: { message: "rate limit" } });
    const res = await POST(makePostRequest(validCreate) as never);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.inviteSent).toBe(false);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("falls back to a recovery link when invite link says user is already registered", async () => {
    mockAdminGenerateLink
      .mockResolvedValueOnce({ data: null, error: { message: "User already registered" } })
      .mockResolvedValueOnce({
        data: {
          properties: { hashed_token: "hash-recovery", verification_type: "recovery" },
        },
        error: null,
      });

    const res = await POST(makePostRequest(validCreate) as never);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.inviteSent).toBe(true);
    expect(mockAdminGenerateLink).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ type: "invite", email: validCreate.email }),
    );
    expect(mockAdminGenerateLink).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ type: "recovery", email: validCreate.email }),
    );
    expect(mockSendEmail).toHaveBeenCalled();
  });

  it("rolls back auth user when prisma.counsellor.create throws", async () => {
    mockPrisma.counsellor.create.mockRejectedValue(new Error("DB error"));
    const res = await POST(makePostRequest(validCreate) as never);
    expect(res.status).toBe(500);
    expect(mockAdminDeleteUser).toHaveBeenCalledWith("auth-c-1");
  });

  it("swallows rollback error when deleteUser rejects", async () => {
    mockPrisma.counsellor.create.mockRejectedValue(new Error("DB error"));
    mockAdminDeleteUser.mockRejectedValue(new Error("auth delete failed"));
    const res = await POST(makePostRequest(validCreate) as never);
    expect(res.status).toBe(500);
  });

  it("returns 400 when authData.user is missing", async () => {
    mockAdminCreateUser.mockResolvedValue({ data: {}, error: null });
    const res = await POST(makePostRequest(validCreate) as never);
    expect(res.status).toBe(400);
  });

  it("falls back to generic auth error message when authError has no message", async () => {
    mockAdminCreateUser.mockResolvedValue({ data: null, error: {} });
    const res = await POST(makePostRequest(validCreate) as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toBe("Failed to create auth account");
  });

  it("creates counsellor with null for omitted optional fields", async () => {
    const minimal = { name: "Minimal", email: "min@eden.com" };
    const res = await POST(makePostRequest(minimal) as never);
    expect(res.status).toBe(201);
    expect(mockPrisma.counsellor.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mobile: null,
          nationalId: null,
          bio: null,
          publicBlurb: null,
        }),
      }),
    );
  });

  it("returns inviteSent=false when generateLink returns no action_link", async () => {
    mockAdminGenerateLink.mockResolvedValue({ data: { properties: {} }, error: null });
    const res = await POST(makePostRequest(validCreate) as never);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.inviteSent).toBe(false);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("adopts orphaned auth user when createUser says already registered", async () => {
    mockAdminCreateUser.mockResolvedValue({
      data: null,
      error: { message: "User already registered" },
    });
    mockAdminListUsers.mockResolvedValue({
      data: { users: [{ id: "orphan-auth-1", email: validCreate.email.toUpperCase() }] },
      error: null,
    });
    mockPrisma.counsellor.create.mockResolvedValue({
      id: "c-1",
      authUserId: "orphan-auth-1",
      email: validCreate.email,
      name: validCreate.name,
    });

    const res = await POST(makePostRequest(validCreate) as never);

    expect(res.status).toBe(201);
    expect(mockPrisma.counsellor.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ authUserId: "orphan-auth-1" }),
      }),
    );
  });

  it("returns 409 when email is claimed by a User role", async () => {
    mockAdminCreateUser.mockResolvedValue({
      data: null,
      error: { message: "Email already registered" },
    });
    mockAdminListUsers.mockResolvedValue({
      data: { users: [{ id: "claimed-auth-1", email: validCreate.email }] },
      error: null,
    });
    mockPrisma.user.findFirst.mockResolvedValue({ id: "user-1" });

    const res = await POST(makePostRequest(validCreate) as never);

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("EMAIL_CLAIMED_BY_OTHER_ROLE");
    expect(mockPrisma.counsellor.create).not.toHaveBeenCalled();
  });

  it("returns 409 when email is claimed by a SuperAdmin", async () => {
    mockAdminCreateUser.mockResolvedValue({
      data: null,
      error: { message: "User already registered" },
    });
    mockAdminListUsers.mockResolvedValue({
      data: { users: [{ id: "claimed-auth-2", email: validCreate.email }] },
      error: null,
    });
    mockPrisma.superAdmin.findUnique.mockResolvedValue({ id: "sa-1" });

    const res = await POST(makePostRequest(validCreate) as never);

    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("EMAIL_CLAIMED_BY_OTHER_ROLE");
    expect(mockPrisma.counsellor.create).not.toHaveBeenCalled();
  });

  it("returns 400 when auth reports already registered but listUsers finds no match", async () => {
    mockAdminCreateUser.mockResolvedValue({
      data: null,
      error: { message: "User already registered" },
    });
    mockAdminListUsers.mockResolvedValue({
      data: { users: [] },
      error: null,
    });

    const res = await POST(makePostRequest(validCreate) as never);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("AUTH_ERROR");
  });

  it("skips auth user delete on rollback when counsellor was adopted", async () => {
    mockAdminCreateUser.mockResolvedValue({
      data: null,
      error: { message: "User already registered" },
    });
    mockAdminListUsers.mockResolvedValue({
      data: { users: [{ id: "orphan-auth-2", email: validCreate.email }] },
      error: null,
    });
    mockPrisma.counsellor.create.mockRejectedValue(new Error("DB error"));

    const res = await POST(makePostRequest(validCreate) as never);

    expect(res.status).toBe(500);
    expect(mockAdminDeleteUser).not.toHaveBeenCalled();
  });
});
