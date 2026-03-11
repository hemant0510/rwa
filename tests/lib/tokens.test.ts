import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  generateVerificationToken,
  validateVerificationToken,
  deleteVerificationToken,
  generatePasswordResetToken,
  validatePasswordResetToken,
  deletePasswordResetToken,
} from "@/lib/tokens";

const mockPrisma = vi.hoisted(() => ({
  emailVerificationToken: {
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  passwordResetToken: {
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

describe("generateVerificationToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates a hex token and stores it", async () => {
    mockPrisma.emailVerificationToken.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.emailVerificationToken.create.mockResolvedValue({
      id: "token-1",
      userId: "user-1",
      token: "abc123",
      expiresAt: new Date(),
    });

    const token = await generateVerificationToken("user-1");
    expect(typeof token).toBe("string");
    expect(token.length).toBe(64); // 32 bytes as hex
    expect(mockPrisma.emailVerificationToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
    expect(mockPrisma.emailVerificationToken.create).toHaveBeenCalled();
  });
});

describe("validateVerificationToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns userId for valid token", async () => {
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 24);
    mockPrisma.emailVerificationToken.findUnique.mockResolvedValue({
      id: "token-1",
      userId: "user-1",
      token: "abc123",
      expiresAt: futureDate,
    });

    const result = await validateVerificationToken("abc123");
    expect(result).toEqual({ userId: "user-1" });
  });

  it("returns null for non-existent token", async () => {
    mockPrisma.emailVerificationToken.findUnique.mockResolvedValue(null);
    const result = await validateVerificationToken("nonexistent");
    expect(result).toBeNull();
  });

  it("returns null and deletes expired token", async () => {
    const pastDate = new Date();
    pastDate.setHours(pastDate.getHours() - 1);
    mockPrisma.emailVerificationToken.findUnique.mockResolvedValue({
      id: "token-1",
      userId: "user-1",
      token: "abc123",
      expiresAt: pastDate,
    });
    mockPrisma.emailVerificationToken.delete.mockResolvedValue({});

    const result = await validateVerificationToken("abc123");
    expect(result).toBeNull();
    expect(mockPrisma.emailVerificationToken.delete).toHaveBeenCalledWith({
      where: { id: "token-1" },
    });
  });
});

describe("deleteVerificationToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes token by value", async () => {
    mockPrisma.emailVerificationToken.deleteMany.mockResolvedValue({ count: 1 });
    await deleteVerificationToken("abc123");
    expect(mockPrisma.emailVerificationToken.deleteMany).toHaveBeenCalledWith({
      where: { token: "abc123" },
    });
  });
});

describe("generatePasswordResetToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates a hex token and stores it", async () => {
    mockPrisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.passwordResetToken.create.mockResolvedValue({
      id: "r-1",
      userId: "user-1",
      token: "reset123",
      expiresAt: new Date(),
    });

    const token = await generatePasswordResetToken("user-1");
    expect(typeof token).toBe("string");
    expect(token.length).toBe(64);
    expect(mockPrisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: "user-1" },
    });
    expect(mockPrisma.passwordResetToken.create).toHaveBeenCalled();
  });
});

describe("validatePasswordResetToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns userId for valid token", async () => {
    const futureDate = new Date();
    futureDate.setHours(futureDate.getHours() + 1);
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
      id: "r-1",
      userId: "user-1",
      token: "reset123",
      expiresAt: futureDate,
    });

    const result = await validatePasswordResetToken("reset123");
    expect(result).toEqual({ userId: "user-1" });
  });

  it("returns null for non-existent token", async () => {
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue(null);
    const result = await validatePasswordResetToken("nonexistent");
    expect(result).toBeNull();
  });

  it("returns null and deletes expired token", async () => {
    const pastDate = new Date();
    pastDate.setHours(pastDate.getHours() - 1);
    mockPrisma.passwordResetToken.findUnique.mockResolvedValue({
      id: "r-1",
      userId: "user-1",
      token: "reset123",
      expiresAt: pastDate,
    });
    mockPrisma.passwordResetToken.delete.mockResolvedValue({});

    const result = await validatePasswordResetToken("reset123");
    expect(result).toBeNull();
    expect(mockPrisma.passwordResetToken.delete).toHaveBeenCalledWith({
      where: { id: "r-1" },
    });
  });
});

describe("deletePasswordResetToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes reset token by value", async () => {
    mockPrisma.passwordResetToken.deleteMany.mockResolvedValue({ count: 1 });
    await deletePasswordResetToken("reset123");
    expect(mockPrisma.passwordResetToken.deleteMany).toHaveBeenCalledWith({
      where: { token: "reset123" },
    });
  });
});
