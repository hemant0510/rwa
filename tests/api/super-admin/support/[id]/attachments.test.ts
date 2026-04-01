import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));

import { POST } from "@/app/api/v1/super-admin/support/[id]/attachments/route";

const mockSA = {
  data: { superAdminId: "sa-1", authUserId: "auth-sa-1", email: "sa@rwa.com" },
  error: null,
};

function makeReq(id: string, formDataValue: Record<string, unknown>) {
  const mockRequest = {
    formData: () =>
      Promise.resolve({
        get: (key: string) => formDataValue[key] ?? null,
      }),
  } as unknown as Request;

  return [mockRequest, { params: Promise.resolve({ id }) }] as const;
}

describe("SA Support Attachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(mockSA);
  });

  it("returns 403 when not SA", async () => {
    mockRequireSuperAdmin.mockResolvedValue({
      data: null,
      error: new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403 }),
    });
    const [req, ctx] = makeReq("r-1", {});
    const res = await POST(req, ctx);
    expect(res.status).toBe(403);
  });

  it("uploads file and returns path", async () => {
    const file = { name: "screenshot.png", size: 1024 };
    const [req, ctx] = makeReq("r-1", { file });
    const res = await POST(req, ctx);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.path).toContain("support-attachments/r-1/screenshot.png");
  });

  it("returns 400 when no file provided", async () => {
    const [req, ctx] = makeReq("r-1", {});
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain("File is required");
  });

  it("returns 400 when file exceeds 5MB", async () => {
    const file = { name: "large.pdf", size: 6 * 1024 * 1024 };
    const [req, ctx] = makeReq("r-1", { file });
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain("5MB");
  });

  it("returns 500 on unexpected error", async () => {
    const mockRequest = {
      formData: () => Promise.reject(new Error("Parse error")),
    } as unknown as Request;
    const res = await POST(mockRequest, { params: Promise.resolve({ id: "r-1" }) });
    expect(res.status).toBe(500);
  });
});
