import { describe, it, expect, vi, beforeEach } from "vitest";

import { mockPrisma } from "../../../../../../../__mocks__/prisma";
import { mockSupabaseClient } from "../../../../../../../__mocks__/supabase";

const { mockGetActiveSocietyId } = vi.hoisted(() => ({
  mockGetActiveSocietyId: vi.fn(),
}));

vi.mock("@/lib/active-society-server", () => ({
  getActiveSocietyId: mockGetActiveSocietyId,
}));

import { PATCH, DELETE } from "@/app/api/v1/residents/me/family/[id]/route";

const mockResident = {
  id: "user-1",
  societyId: "society-1",
};

const mockDependent = {
  id: "dep-1",
  userId: "user-1",
  societyId: "society-1",
  memberId: "EDN-DLH-0042-M1",
  memberSeq: 1,
  name: "Priya Bhagat",
  relationship: "SPOUSE",
  otherRelationship: null,
  dateOfBirth: new Date("1990-05-15"),
  bloodGroup: "O_POS",
  mobile: "9876543210",
  email: null,
  occupation: null,
  photoUrl: null,
  idProofUrl: null,
  isEmergencyContact: true,
  emergencyPriority: 1,
  medicalNotes: null,
  isActive: true,
  deactivatedAt: null,
  createdAt: new Date("2026-04-12T10:00:00Z"),
  updatedAt: new Date("2026-04-12T10:00:00Z"),
};

const makeRequest = (method: string, body?: object) =>
  new Request(`http://localhost/api/v1/residents/me/family/dep-1`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });

const makeParams = (id = "dep-1") => ({ params: Promise.resolve({ id }) });

describe("PATCH /api/v1/residents/me/family/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveSocietyId.mockResolvedValue(null);
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockPrisma.user.findFirst.mockResolvedValue(mockResident);
    mockPrisma.dependent.findUnique.mockResolvedValue(mockDependent);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
    mockPrisma.dependent.update.mockResolvedValue({ ...mockDependent, name: "Updated Name" });
    mockPrisma.auditLog.create.mockResolvedValue({});
  });

  it("returns 401 when not authenticated", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const res = await PATCH(makeRequest("PATCH", { name: "X" }) as never, makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when dependent not found", async () => {
    mockPrisma.dependent.findUnique.mockResolvedValueOnce(null);
    const res = await PATCH(makeRequest("PATCH", { name: "X" }) as never, makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when dependent belongs to another user", async () => {
    mockPrisma.dependent.findUnique.mockResolvedValueOnce({
      ...mockDependent,
      userId: "other-user",
    });
    const res = await PATCH(makeRequest("PATCH", { name: "X" }) as never, makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 422 on validation failure", async () => {
    const res = await PATCH(
      makeRequest("PATCH", { name: "X", relationship: "INVALID" }) as never,
      makeParams(),
    );
    expect(res.status).toBe(422);
  });

  it("updates member and returns 200", async () => {
    const res = await PATCH(makeRequest("PATCH", { name: "Updated Name" }) as never, makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.member.name).toBe("Updated Name");
  });

  it("writes audit log on update", async () => {
    await PATCH(makeRequest("PATCH", { name: "Updated" }) as never, makeParams());
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actionType: "FAMILY_MEMBER_UPDATED" }),
      }),
    );
  });

  it("passes dateOfBirth as Date when provided in body", async () => {
    await PATCH(makeRequest("PATCH", { dateOfBirth: "1992-03-10" }) as never, makeParams());
    expect(mockPrisma.dependent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ dateOfBirth: new Date("1992-03-10") }),
      }),
    );
  });

  it("passes dateOfBirth as null when empty string provided", async () => {
    await PATCH(makeRequest("PATCH", { dateOfBirth: "" }) as never, makeParams());
    expect(mockPrisma.dependent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ dateOfBirth: null }),
      }),
    );
  });

  it("returns null dateOfBirth when updated member has no DOB", async () => {
    mockPrisma.dependent.update.mockResolvedValue({
      ...mockDependent,
      dateOfBirth: null,
      name: "Updated Name",
    });
    const res = await PATCH(makeRequest("PATCH", { name: "Updated Name" }) as never, makeParams());
    const body = await res.json();
    expect(body.member.dateOfBirth).toBeNull();
  });

  it("includes all optional fields in update when provided", async () => {
    await PATCH(
      makeRequest("PATCH", {
        name: "Full Update",
        relationship: "OTHER",
        otherRelationship: "Friend",
        bloodGroup: "A_POS",
        mobile: "9876543210",
        email: "test@example.com",
        occupation: "Engineer",
        isEmergencyContact: true,
        emergencyPriority: 1,
        medicalNotes: "None",
      }) as never,
      makeParams(),
    );
    expect(mockPrisma.dependent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          otherRelationship: "Friend",
          bloodGroup: "A_POS",
          mobile: "9876543210",
          email: "test@example.com",
          occupation: "Engineer",
          emergencyPriority: 1,
          medicalNotes: "None",
        }),
      }),
    );
  });

  it("maps empty mobile and email to null in update", async () => {
    await PATCH(makeRequest("PATCH", { mobile: "", email: "" }) as never, makeParams());
    expect(mockPrisma.dependent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mobile: null, email: null }),
      }),
    );
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.dependent.findUnique.mockRejectedValue(new Error("DB error"));
    const res = await PATCH(makeRequest("PATCH", { name: "X" }) as never, makeParams());
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/v1/residents/me/family/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveSocietyId.mockResolvedValue(null);
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockPrisma.user.findFirst.mockResolvedValue(mockResident);
    mockPrisma.dependent.findUnique.mockResolvedValue(mockDependent);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
    mockPrisma.dependent.update.mockResolvedValue({});
    mockPrisma.auditLog.create.mockResolvedValue({});
    mockPrisma.dependent.count.mockResolvedValue(1);
    mockPrisma.user.update.mockResolvedValue({});
  });

  it("returns 401 when not authenticated", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const res = await DELETE(makeRequest("DELETE") as never, makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when dependent not found", async () => {
    mockPrisma.dependent.findUnique.mockResolvedValueOnce(null);
    const res = await DELETE(makeRequest("DELETE") as never, makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when dependent belongs to another user", async () => {
    mockPrisma.dependent.findUnique.mockResolvedValueOnce({
      ...mockDependent,
      userId: "other-user",
    });
    const res = await DELETE(makeRequest("DELETE") as never, makeParams());
    expect(res.status).toBe(404);
  });

  it("soft deletes the member and returns success", async () => {
    const res = await DELETE(makeRequest("DELETE") as never, makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockPrisma.dependent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isActive: false }),
      }),
    );
  });

  it("writes audit log on delete", async () => {
    await DELETE(makeRequest("DELETE") as never, makeParams());
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actionType: "FAMILY_MEMBER_REMOVED" }),
      }),
    );
  });

  it("reverts householdStatus to NOT_SET when no active dependents remain", async () => {
    mockPrisma.dependent.count.mockResolvedValueOnce(0);
    await DELETE(makeRequest("DELETE") as never, makeParams());
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { householdStatus: "NOT_SET" },
      }),
    );
  });

  it("does not revert householdStatus when other active dependents remain", async () => {
    mockPrisma.dependent.count.mockResolvedValueOnce(2);
    await DELETE(makeRequest("DELETE") as never, makeParams());
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.dependent.findUnique.mockRejectedValue(new Error("DB error"));
    const res = await DELETE(makeRequest("DELETE") as never, makeParams());
    expect(res.status).toBe(500);
  });
});
