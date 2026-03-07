import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/email", () => ({
  isEmailConfigured: vi.fn().mockReturnValue(true),
  sendEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/tokens", () => ({
  generateVerificationToken: vi.fn().mockResolvedValue("test-token-123"),
}));

vi.mock("@/lib/email-templates/verification", () => ({
  getVerificationEmailHtml: vi.fn().mockReturnValue("<p>Verify</p>"),
}));

import { isEmailConfigured, sendEmail } from "@/lib/email";
import { generateVerificationToken } from "@/lib/tokens";
import { isVerificationRequired, sendVerificationEmail, autoVerifyUser } from "@/lib/verification";

import { mockPrisma } from "../__mocks__/prisma";

describe("isVerificationRequired", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false when SMTP not configured", async () => {
    vi.mocked(isEmailConfigured).mockReturnValue(false);
    const result = await isVerificationRequired("society-1");
    expect(result).toBe(false);
  });

  it("returns society setting when SMTP configured", async () => {
    vi.mocked(isEmailConfigured).mockReturnValue(true);
    mockPrisma.society.findUnique.mockResolvedValue({ emailVerificationRequired: true });
    const result = await isVerificationRequired("society-1");
    expect(result).toBe(true);
  });

  it("returns false when society has verification disabled", async () => {
    vi.mocked(isEmailConfigured).mockReturnValue(true);
    mockPrisma.society.findUnique.mockResolvedValue({ emailVerificationRequired: false });
    const result = await isVerificationRequired("society-1");
    expect(result).toBe(false);
  });

  it("defaults to true when society not found", async () => {
    vi.mocked(isEmailConfigured).mockReturnValue(true);
    mockPrisma.society.findUnique.mockResolvedValue(null);
    const result = await isVerificationRequired("society-1");
    expect(result).toBe(true);
  });
});

describe("sendVerificationEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates token and sends email", async () => {
    await sendVerificationEmail("user-1", "test@example.com", "Test User");

    expect(generateVerificationToken).toHaveBeenCalledWith("user-1");
    expect(sendEmail).toHaveBeenCalledWith(
      "test@example.com",
      "Verify your email — RWA Connect",
      "<p>Verify</p>",
    );
  });
});

describe("autoVerifyUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets isEmailVerified to true", async () => {
    mockPrisma.user.update.mockResolvedValue({});
    await autoVerifyUser("user-1");
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { isEmailVerified: true },
    });
  });
});
