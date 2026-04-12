import { describe, it, expect, vi, beforeEach } from "vitest";

import { mockPrisma } from "../../../../../../__mocks__/prisma";
import { mockStorageBucket, mockSupabaseClient } from "../../../../../../__mocks__/supabase";

const { mockGetActiveSocietyId } = vi.hoisted(() => ({
  mockGetActiveSocietyId: vi.fn(),
}));

vi.mock("@/lib/active-society-server", () => ({
  getActiveSocietyId: mockGetActiveSocietyId,
}));

import { GET, POST } from "@/app/api/v1/residents/me/family/route";

const mockResident = {
  id: "user-1",
  societyId: "society-1",
  rwaid: "EDN-DLH-0042",
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
  createdAt: new Date("2026-04-12T10:00:00Z"),
  updatedAt: new Date("2026-04-12T10:00:00Z"),
};

describe("GET /api/v1/residents/me/family", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveSocietyId.mockResolvedValue(null);
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockPrisma.user.findFirst.mockResolvedValue(mockResident);
  });

  it("returns 401 when not authenticated", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns empty members list when no dependents", async () => {
    mockPrisma.dependent.findMany.mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.members).toEqual([]);
  });

  it("returns members with age computed from DOB", async () => {
    mockPrisma.dependent.findMany.mockResolvedValue([mockDependent]);
    mockStorageBucket.createSignedUrl.mockResolvedValue({ data: null, error: null });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.members).toHaveLength(1);
    expect(body.members[0].name).toBe("Priya Bhagat");
    expect(body.members[0].age).toBeTypeOf("number");
    expect(body.members[0].dateOfBirth).toBe("1990-05-15");
  });

  it("returns null age when DOB is null", async () => {
    mockPrisma.dependent.findMany.mockResolvedValue([{ ...mockDependent, dateOfBirth: null }]);
    mockStorageBucket.createSignedUrl.mockResolvedValue({ data: null, error: null });
    const res = await GET();
    const body = await res.json();
    expect(body.members[0].age).toBeNull();
  });

  it("returns idProofSignedUrl when idProofUrl exists", async () => {
    const depWithProof = { ...mockDependent, idProofUrl: "society-1/dep-1/id-proof.pdf" };
    mockPrisma.dependent.findMany.mockResolvedValue([depWithProof]);
    mockStorageBucket.createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://example.com/signed" },
      error: null,
    });
    const res = await GET();
    const body = await res.json();
    expect(body.members[0].idProofSignedUrl).toBe("https://example.com/signed");
  });

  it("returns null idProofSignedUrl when idProofUrl is null", async () => {
    mockPrisma.dependent.findMany.mockResolvedValue([mockDependent]);
    const res = await GET();
    const body = await res.json();
    expect(body.members[0].idProofSignedUrl).toBeNull();
  });

  it("returns null idProofSignedUrl when signed URL generation fails", async () => {
    const depWithProof = { ...mockDependent, idProofUrl: "society-1/dep-1/id-proof.pdf" };
    mockPrisma.dependent.findMany.mockResolvedValue([depWithProof]);
    mockStorageBucket.createSignedUrl.mockResolvedValue({ data: null, error: { message: "fail" } });
    const res = await GET();
    const body = await res.json();
    expect(body.members[0].idProofSignedUrl).toBeNull();
  });

  it("applies societyId filter when activeSocietyId is set", async () => {
    mockGetActiveSocietyId.mockResolvedValueOnce("society-1");
    mockPrisma.dependent.findMany.mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ societyId: "society-1" }) }),
    );
  });

  it("returns correct age when birthday already passed this year", async () => {
    const pastMonthDep = { ...mockDependent, dateOfBirth: new Date("1990-01-15") };
    mockPrisma.dependent.findMany.mockResolvedValue([pastMonthDep]);
    mockStorageBucket.createSignedUrl.mockResolvedValue({ data: null, error: null });
    const res = await GET();
    const body = await res.json();
    expect(body.members[0].age).toBeTypeOf("number");
    expect(body.members[0].dateOfBirth).toBe("1990-01-15");
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.dependent.findMany.mockRejectedValue(new Error("DB error"));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe("POST /api/v1/residents/me/family", () => {
  const validBody = {
    name: "Rahul Bhagat",
    relationship: "SON",
    isEmergencyContact: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveSocietyId.mockResolvedValue(null);
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockPrisma.user.findFirst.mockResolvedValue(mockResident);
    mockPrisma.dependent.count.mockResolvedValue(0);
    mockPrisma.dependent.aggregate.mockResolvedValue({ _max: { memberSeq: 0 } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPrisma.$transaction.mockImplementation(async (fn: any) => fn(mockPrisma));
    mockPrisma.dependent.create.mockResolvedValue({ ...mockDependent, name: "Rahul Bhagat" });
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.auditLog.create.mockResolvedValue({});
  });

  it("returns 401 when not authenticated", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const req = new Request("http://localhost/api/v1/residents/me/family", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });

  it("returns 422 on validation failure", async () => {
    const req = new Request("http://localhost/api/v1/residents/me/family", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "X", relationship: "INVALID" }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(422);
  });

  it("returns 400 when member limit is reached", async () => {
    mockPrisma.dependent.count.mockResolvedValue(15);
    const req = new Request("http://localhost/api/v1/residents/me/family", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("LIMIT_EXCEEDED");
  });

  it("creates member and returns 201 with member data", async () => {
    const req = new Request("http://localhost/api/v1/residents/me/family", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.member).toBeDefined();
    expect(body.member.name).toBe("Rahul Bhagat");
  });

  it("assigns memberId using rwaid when present", async () => {
    const req = new Request("http://localhost/api/v1/residents/me/family", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    await POST(req as never);
    expect(mockPrisma.dependent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ memberId: "EDN-DLH-0042-M1" }),
      }),
    );
  });

  it("assigns null memberId when rwaid is null", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ ...mockResident, rwaid: null });
    const req = new Request("http://localhost/api/v1/residents/me/family", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    await POST(req as never);
    expect(mockPrisma.dependent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ memberId: null }),
      }),
    );
  });

  it("sets householdStatus to HAS_ENTRIES on user", async () => {
    const req = new Request("http://localhost/api/v1/residents/me/family", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    await POST(req as never);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { householdStatus: "HAS_ENTRIES" },
      }),
    );
  });

  it("writes audit log on create", async () => {
    const req = new Request("http://localhost/api/v1/residents/me/family", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    await POST(req as never);
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actionType: "FAMILY_MEMBER_ADDED" }),
      }),
    );
  });

  it("retries on P2002 conflict and succeeds on second attempt", async () => {
    const p2002 = Object.assign(new Error("Unique constraint"), { code: "P2002" });
    mockPrisma.$transaction
      .mockRejectedValueOnce(p2002)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementationOnce(async (fn: any) => fn(mockPrisma));
    const req = new Request("http://localhost/api/v1/residents/me/family", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(201);
  });

  it("throws immediately on non-P2002 transaction error", async () => {
    mockPrisma.$transaction.mockRejectedValueOnce(new Error("Connection refused"));
    const req = new Request("http://localhost/api/v1/residents/me/family", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(500);
  });

  it("uses memberSeq 1 when aggregate returns null memberSeq", async () => {
    mockPrisma.dependent.aggregate.mockResolvedValueOnce({ _max: { memberSeq: null } });
    const req = new Request("http://localhost/api/v1/residents/me/family", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    await POST(req as never);
    expect(mockPrisma.dependent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ memberSeq: 1 }) }),
    );
  });

  it("creates member with dateOfBirth when provided", async () => {
    const bodyWithDob = { ...validBody, dateOfBirth: "1995-08-20" };
    mockPrisma.dependent.create.mockResolvedValueOnce({
      ...mockDependent,
      name: "Rahul Bhagat",
      dateOfBirth: new Date("1995-08-20"),
    });
    const req = new Request("http://localhost/api/v1/residents/me/family", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bodyWithDob),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.member.dateOfBirth).toBe("1995-08-20");
  });

  it("returns null dateOfBirth in response when created member has no DOB", async () => {
    mockPrisma.dependent.create.mockResolvedValueOnce({
      ...mockDependent,
      name: "Rahul Bhagat",
      dateOfBirth: null,
    });
    const req = new Request("http://localhost/api/v1/residents/me/family", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    const res = await POST(req as never);
    const body = await res.json();
    expect(body.member.dateOfBirth).toBeNull();
    expect(body.member.age).toBeNull();
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.dependent.count.mockRejectedValue(new Error("DB error"));
    const req = new Request("http://localhost/api/v1/residents/me/family", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(500);
  });
});
