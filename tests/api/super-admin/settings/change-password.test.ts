import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockSignInWithPassword = vi.hoisted(() => vi.fn());
const mockUpdateUserById = vi.hoisted(() => vi.fn());
const mockCreateClient = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ auth: { signInWithPassword: mockSignInWithPassword } }),
);
const mockCreateAdminClient = vi.hoisted(() =>
  vi.fn().mockReturnValue({ auth: { admin: { updateUserById: mockUpdateUserById } } }),
);

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mockCreateClient }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mockCreateAdminClient }));

import { POST } from "@/app/api/v1/super-admin/settings/change-password/route";

const saOk = {
  data: {
    superAdminId: "00000000-0000-4000-8000-000000000001",
    authUserId: "00000000-0000-4000-8000-000000000002",
    email: "admin@superadmin.com",
  },
  error: null,
};

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/v1/super-admin/settings/change-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  currentPassword: "OldPassword1!",
  newPassword: "NewPassword1!",
  confirmPassword: "NewPassword1!",
};

describe("POST /api/v1/super-admin/settings/change-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockSignInWithPassword.mockResolvedValue({ error: null });
    mockUpdateUserById.mockResolvedValue({ error: null });
  });

  it("returns 403 when not super admin", async () => {
    const forbiddenResponse = new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), {
      status: 403,
    });
    mockRequireSuperAdmin.mockResolvedValue({ data: null, error: forbiddenResponse });

    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(403);
  });

  it("returns 422 for invalid body (missing fields)", async () => {
    const res = await POST(makeReq({ currentPassword: "pass" }));
    expect(res.status).toBe(422);
  });

  it("returns 422 for newPassword too short", async () => {
    const res = await POST(
      makeReq({ currentPassword: "OldPass1!", newPassword: "short", confirmPassword: "short" }),
    );
    expect(res.status).toBe(422);
  });

  it("returns 422 when passwords do not match", async () => {
    const res = await POST(
      makeReq({
        currentPassword: "OldPass1!",
        newPassword: "NewPassword1!",
        confirmPassword: "DifferentPassword1!",
      }),
    );
    expect(res.status).toBe(422);
  });

  it("returns 400 when current password is incorrect", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: { message: "Invalid credentials" } });

    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("returns 500 when updateUserById fails", async () => {
    mockUpdateUserById.mockResolvedValue({ error: { message: "Update failed" } });

    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(500);
  });

  it("returns 200 on success", async () => {
    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("calls signInWithPassword with correct email and current password", async () => {
    await POST(makeReq(validBody));
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: saOk.data.email,
      password: validBody.currentPassword,
    });
  });

  it("calls updateUserById with authUserId and new password", async () => {
    await POST(makeReq(validBody));
    expect(mockUpdateUserById).toHaveBeenCalledWith(saOk.data.authUserId, {
      password: validBody.newPassword,
    });
  });

  it("returns 500 on unexpected error", async () => {
    mockSignInWithPassword.mockRejectedValue(new Error("Network error"));

    const res = await POST(makeReq(validBody));
    expect(res.status).toBe(500);
  });
});
