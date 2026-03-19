import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

import { mockPrisma } from "../../__mocks__/prisma";

const { mockGeneratePasswordResetToken, mockSendEmail } = vi.hoisted(() => ({
  mockGeneratePasswordResetToken: vi.fn(),
  mockSendEmail: vi.fn(),
}));

vi.mock("@/lib/tokens", () => ({ generatePasswordResetToken: mockGeneratePasswordResetToken }));
vi.mock("@/lib/email", () => ({ sendEmail: mockSendEmail }));
vi.mock("@/lib/email-templates/welcome-setup", () => ({
  getWelcomeSetupEmailHtml: vi.fn().mockReturnValue("<html>welcome</html>"),
}));

import { POST } from "@/app/api/v1/residents/[id]/send-setup-email/route";

function makeReq(id: string) {
  return new NextRequest(`http://localhost/api/v1/residents/${id}/send-setup-email`, {
    method: "POST",
  });
}

const mockResident = {
  id: "r1",
  name: "Rajesh Kumar",
  email: "rajesh@eden.com",
  society: { name: "Eden Estate" },
};

describe("POST /api/v1/residents/[id]/send-setup-email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue(mockResident);
    mockGeneratePasswordResetToken.mockResolvedValue("token-abc");
    mockSendEmail.mockResolvedValue(undefined);
  });

  it("returns 404 when resident not found", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq("r1"), { params: Promise.resolve({ id: "r1" }) });
    expect(res.status).toBe(404);
  });

  it("returns 400 when resident has no email", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockResident, email: null });
    const res = await POST(makeReq("r1"), { params: Promise.resolve({ id: "r1" }) });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("NO_EMAIL");
  });

  it("generates token with 7-day expiry (168 hours)", async () => {
    await POST(makeReq("r1"), { params: Promise.resolve({ id: "r1" }) });
    expect(mockGeneratePasswordResetToken).toHaveBeenCalledWith("r1", 168);
  });

  it("sends setup email to resident", async () => {
    await POST(makeReq("r1"), { params: Promise.resolve({ id: "r1" }) });
    expect(mockSendEmail).toHaveBeenCalledWith(
      "rajesh@eden.com",
      expect.stringContaining("Eden Estate"),
      expect.any(String),
    );
  });

  it("email subject mentions society name", async () => {
    await POST(makeReq("r1"), { params: Promise.resolve({ id: "r1" }) });
    const [, subject] = mockSendEmail.mock.calls[0];
    expect(subject).toContain("Eden Estate");
    expect(subject).toContain("Create your password");
  });

  it("returns 200 with success on valid resident", async () => {
    const res = await POST(makeReq("r1"), { params: Promise.resolve({ id: "r1" }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("uses fallback society name when society is null", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockResident, society: null });
    await POST(makeReq("r1"), { params: Promise.resolve({ id: "r1" }) });
    const [, subject] = mockSendEmail.mock.calls[0];
    expect(subject).toContain("your society");
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error("DB error"));
    const res = await POST(makeReq("r1"), { params: Promise.resolve({ id: "r1" }) });
    expect(res.status).toBe(500);
  });
});
