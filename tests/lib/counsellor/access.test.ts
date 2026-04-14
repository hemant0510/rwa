import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  counsellorSocietyAssignment: {
    findFirst: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { assertCounsellorSocietyAccess } from "@/lib/counsellor/access";

const VALID_UUID = "11111111-2222-3333-4444-555555555555";

describe("assertCounsellorSocietyAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 when societyId is not a valid UUID", async () => {
    const res = await assertCounsellorSocietyAccess("c-1", "not-a-uuid");
    expect(res?.status).toBe(404);
    expect(mockPrisma.counsellorSocietyAssignment.findFirst).not.toHaveBeenCalled();
  });

  it("returns 403 when counsellor has no active assignment to the society", async () => {
    mockPrisma.counsellorSocietyAssignment.findFirst.mockResolvedValue(null);
    const res = await assertCounsellorSocietyAccess("c-1", VALID_UUID);
    expect(res?.status).toBe(403);
    expect(mockPrisma.counsellorSocietyAssignment.findFirst).toHaveBeenCalledWith({
      where: { counsellorId: "c-1", societyId: VALID_UUID, isActive: true },
      select: { id: true },
    });
  });

  it("returns null when active assignment exists", async () => {
    mockPrisma.counsellorSocietyAssignment.findFirst.mockResolvedValue({ id: "a-1" });
    const res = await assertCounsellorSocietyAccess("c-1", VALID_UUID);
    expect(res).toBeNull();
  });
});
