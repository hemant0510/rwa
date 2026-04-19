import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  user: { findFirst: vi.fn() },
  superAdmin: { findUnique: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { resolveCounsellorAuthUserId } from "@/lib/counsellor/resolve-auth-user";

type AdminMock = {
  auth: {
    admin: {
      createUser: ReturnType<typeof vi.fn>;
      listUsers: ReturnType<typeof vi.fn>;
      updateUserById: ReturnType<typeof vi.fn>;
    };
  };
};

function makeAdmin(): AdminMock {
  const admin: AdminMock = {
    auth: {
      admin: {
        createUser: vi.fn(),
        listUsers: vi.fn(),
        updateUserById: vi.fn(),
      },
    },
  };
  admin.auth.admin.updateUserById.mockResolvedValue({ error: null });
  return admin;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.user.findFirst.mockResolvedValue(null);
  mockPrisma.superAdmin.findUnique.mockResolvedValue(null);
});

describe("resolveCounsellorAuthUserId", () => {
  it("returns the newly created auth user id when createUser succeeds", async () => {
    const admin = makeAdmin();
    admin.auth.admin.createUser.mockResolvedValue({
      data: { user: { id: "new-auth-1" } },
      error: null,
    });

    const result = await resolveCounsellorAuthUserId(admin as never, "new@x.com");

    expect(result).toEqual({ ok: true, authUserId: "new-auth-1", adopted: false });
    expect(admin.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: "new@x.com", email_confirm: true }),
    );
    expect(admin.auth.admin.listUsers).not.toHaveBeenCalled();
  });

  it("returns AUTH_ERROR when createUser fails with a non-registered error", async () => {
    const admin = makeAdmin();
    admin.auth.admin.createUser.mockResolvedValue({
      data: null,
      error: { message: "rate limit hit" },
    });

    const result = await resolveCounsellorAuthUserId(admin as never, "x@x.com");

    expect(result).toEqual({
      ok: false,
      code: "AUTH_ERROR",
      message: "rate limit hit",
    });
  });

  it("returns AUTH_ERROR with fallback message when createUser error has no message", async () => {
    const admin = makeAdmin();
    admin.auth.admin.createUser.mockResolvedValue({
      data: null,
      error: {},
    });

    const result = await resolveCounsellorAuthUserId(admin as never, "x@x.com");

    expect(result).toEqual({
      ok: false,
      code: "AUTH_ERROR",
      message: "Failed to create auth account",
    });
  });

  it("returns AUTH_ERROR when createUser returns no data and no error", async () => {
    const admin = makeAdmin();
    admin.auth.admin.createUser.mockResolvedValue({ data: null, error: null });

    const result = await resolveCounsellorAuthUserId(admin as never, "x@x.com");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH_ERROR");
    }
  });

  it("adopts orphaned auth user when email is already registered and no role claims it", async () => {
    const admin = makeAdmin();
    admin.auth.admin.createUser.mockResolvedValue({
      data: null,
      error: { message: "User already registered" },
    });
    admin.auth.admin.listUsers.mockResolvedValue({
      data: { users: [{ id: "orphan-1", email: "TARGET@X.com" }] },
      error: null,
    });

    const result = await resolveCounsellorAuthUserId(admin as never, "target@x.com");

    expect(result).toEqual({ ok: true, authUserId: "orphan-1", adopted: true });
    expect(admin.auth.admin.updateUserById).toHaveBeenCalledWith(
      "orphan-1",
      expect.objectContaining({ password: expect.stringMatching(/^tmp_/) }),
    );
  });

  it("returns AUTH_ERROR when resetting the adopted user's password fails", async () => {
    const admin = makeAdmin();
    admin.auth.admin.createUser.mockResolvedValue({
      data: null,
      error: { message: "User already registered" },
    });
    admin.auth.admin.listUsers.mockResolvedValue({
      data: { users: [{ id: "orphan-2", email: "t@x.com" }] },
      error: null,
    });
    admin.auth.admin.updateUserById.mockResolvedValue({
      error: { message: "reset failed" },
    });

    const result = await resolveCounsellorAuthUserId(admin as never, "t@x.com");

    expect(result).toEqual({
      ok: false,
      code: "AUTH_ERROR",
      message: "reset failed",
    });
  });

  it("uses fallback message when password reset error has no message", async () => {
    const admin = makeAdmin();
    admin.auth.admin.createUser.mockResolvedValue({
      data: null,
      error: { message: "User already registered" },
    });
    admin.auth.admin.listUsers.mockResolvedValue({
      data: { users: [{ id: "orphan-3", email: "t@x.com" }] },
      error: null,
    });
    admin.auth.admin.updateUserById.mockResolvedValue({ error: {} });

    const result = await resolveCounsellorAuthUserId(admin as never, "t@x.com");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toBe("Failed to reset adopted auth account");
    }
  });

  it("rejects with EMAIL_CLAIMED_BY_OTHER_ROLE when a User row claims the auth user", async () => {
    const admin = makeAdmin();
    admin.auth.admin.createUser.mockResolvedValue({
      data: null,
      error: { message: "Email already registered" },
    });
    admin.auth.admin.listUsers.mockResolvedValue({
      data: { users: [{ id: "claimed-1", email: "t@x.com" }] },
      error: null,
    });
    mockPrisma.user.findFirst.mockResolvedValue({ id: "u-1" });

    const result = await resolveCounsellorAuthUserId(admin as never, "t@x.com");

    expect(result).toEqual({
      ok: false,
      code: "EMAIL_CLAIMED_BY_OTHER_ROLE",
      message: "This email is already registered under a different role.",
    });
  });

  it("rejects with EMAIL_CLAIMED_BY_OTHER_ROLE when a SuperAdmin row claims the auth user", async () => {
    const admin = makeAdmin();
    admin.auth.admin.createUser.mockResolvedValue({
      data: null,
      error: { message: "A user with this email address has already been registered" },
    });
    admin.auth.admin.listUsers.mockResolvedValue({
      data: { users: [{ id: "claimed-2", email: "sa@x.com" }] },
      error: null,
    });
    mockPrisma.superAdmin.findUnique.mockResolvedValue({ id: "sa-1" });

    const result = await resolveCounsellorAuthUserId(admin as never, "sa@x.com");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("EMAIL_CLAIMED_BY_OTHER_ROLE");
    }
  });

  it("returns AUTH_ERROR when listUsers finds no matching user on a short page", async () => {
    const admin = makeAdmin();
    admin.auth.admin.createUser.mockResolvedValue({
      data: null,
      error: { message: "User already registered" },
    });
    admin.auth.admin.listUsers.mockResolvedValue({
      data: { users: [{ id: "other-1", email: "someone-else@x.com" }] },
      error: null,
    });

    const result = await resolveCounsellorAuthUserId(admin as never, "missing@x.com");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH_ERROR");
    }
  });

  it("paginates listUsers and finds a match on a later page", async () => {
    const admin = makeAdmin();
    admin.auth.admin.createUser.mockResolvedValue({
      data: null,
      error: { message: "User already exists" },
    });

    const fullPage = Array.from({ length: 200 }, (_, i) => ({
      id: `u-${i}`,
      email: `other-${i}@x.com`,
    }));
    admin.auth.admin.listUsers
      .mockResolvedValueOnce({ data: { users: fullPage }, error: null })
      .mockResolvedValueOnce({
        data: { users: [{ id: "match-1", email: "target@x.com" }] },
        error: null,
      });

    const result = await resolveCounsellorAuthUserId(admin as never, "target@x.com");

    expect(admin.auth.admin.listUsers).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ok: true, authUserId: "match-1", adopted: true });
  });

  it("returns AUTH_ERROR when listUsers errors during lookup", async () => {
    const admin = makeAdmin();
    admin.auth.admin.createUser.mockResolvedValue({
      data: null,
      error: { message: "User already registered" },
    });
    admin.auth.admin.listUsers.mockResolvedValue({
      data: null,
      error: { message: "boom" },
    });

    const result = await resolveCounsellorAuthUserId(admin as never, "x@x.com");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH_ERROR");
    }
  });

  it("treats auth users with no email as non-matches during lookup", async () => {
    const admin = makeAdmin();
    admin.auth.admin.createUser.mockResolvedValue({
      data: null,
      error: { message: "User already registered" },
    });
    admin.auth.admin.listUsers.mockResolvedValue({
      data: { users: [{ id: "no-email", email: null }] },
      error: null,
    });

    const result = await resolveCounsellorAuthUserId(admin as never, "x@x.com");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("AUTH_ERROR");
    }
  });
});
