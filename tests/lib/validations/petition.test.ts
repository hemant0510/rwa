import { describe, it, expect } from "vitest";

import {
  createPetitionSchema,
  updatePetitionSchema,
  closePetitionSchema,
  signPetitionSchema,
} from "@/lib/validations/petition";

describe("createPetitionSchema", () => {
  const validInput = {
    title: "Fix the broken street light",
    type: "COMPLAINT" as const,
  };

  it("passes with valid minimal input", () => {
    expect(createPetitionSchema.safeParse(validInput).success).toBe(true);
  });

  it("passes with all fields provided", () => {
    expect(
      createPetitionSchema.safeParse({
        title: "Request for new park benches",
        description: "The park lacks adequate seating for elderly residents.",
        type: "PETITION" as const,
        targetAuthority: "Municipal Corporation",
        minSignatures: 50,
        deadline: "2026-12-31",
      }).success,
    ).toBe(true);
  });

  it("fails when title is too short", () => {
    expect(createPetitionSchema.safeParse({ ...validInput, title: "Ab" }).success).toBe(false);
  });

  it("fails when title exceeds 200 chars", () => {
    expect(createPetitionSchema.safeParse({ ...validInput, title: "A".repeat(201) }).success).toBe(
      false,
    );
  });

  it("fails with invalid type", () => {
    expect(createPetitionSchema.safeParse({ ...validInput, type: "INVALID" }).success).toBe(false);
  });

  it("accepts all valid types", () => {
    for (const type of ["COMPLAINT", "PETITION", "NOTICE"]) {
      expect(createPetitionSchema.safeParse({ ...validInput, type }).success).toBe(true);
    }
  });

  it("accepts optional fields as null", () => {
    expect(
      createPetitionSchema.safeParse({
        ...validInput,
        description: null,
        targetAuthority: null,
        minSignatures: null,
        deadline: null,
      }).success,
    ).toBe(true);
  });

  it("accepts optional string fields", () => {
    expect(
      createPetitionSchema.safeParse({
        ...validInput,
        description: "Detailed description of the issue.",
        targetAuthority: "Society Committee",
        deadline: "2026-06-30",
      }).success,
    ).toBe(true);
  });

  it("fails when minSignatures is less than 1", () => {
    expect(createPetitionSchema.safeParse({ ...validInput, minSignatures: 0 }).success).toBe(false);
  });

  it("fails when minSignatures is negative", () => {
    expect(createPetitionSchema.safeParse({ ...validInput, minSignatures: -5 }).success).toBe(
      false,
    );
  });

  it("fails when minSignatures is non-integer", () => {
    expect(createPetitionSchema.safeParse({ ...validInput, minSignatures: 2.5 }).success).toBe(
      false,
    );
  });

  it("fails when description exceeds 5000 chars", () => {
    expect(
      createPetitionSchema.safeParse({ ...validInput, description: "A".repeat(5001) }).success,
    ).toBe(false);
  });

  it("fails when targetAuthority exceeds 200 chars", () => {
    expect(
      createPetitionSchema.safeParse({
        ...validInput,
        targetAuthority: "A".repeat(201),
      }).success,
    ).toBe(false);
  });

  it("fails when type is missing", () => {
    const { type: _, ...noType } = validInput;
    expect(createPetitionSchema.safeParse(noType).success).toBe(false);
  });
});

describe("updatePetitionSchema", () => {
  it("passes with partial title update", () => {
    expect(updatePetitionSchema.safeParse({ title: "Updated petition title" }).success).toBe(true);
  });

  it("passes with partial type update", () => {
    expect(updatePetitionSchema.safeParse({ type: "NOTICE" as const }).success).toBe(true);
  });

  it("passes with multiple fields", () => {
    expect(
      updatePetitionSchema.safeParse({
        title: "New title for petition",
        description: "Updated description text.",
        minSignatures: 100,
      }).success,
    ).toBe(true);
  });

  it("fails when no fields are provided", () => {
    expect(updatePetitionSchema.safeParse({}).success).toBe(false);
  });

  it("fails with invalid type", () => {
    expect(updatePetitionSchema.safeParse({ type: "INVALID" }).success).toBe(false);
  });

  it("fails when title is too short", () => {
    expect(updatePetitionSchema.safeParse({ title: "Ab" }).success).toBe(false);
  });

  it("passes with nullable fields alongside a provided field", () => {
    expect(
      updatePetitionSchema.safeParse({
        description: null,
        targetAuthority: null,
      }).success,
    ).toBe(true);
  });
});

describe("closePetitionSchema", () => {
  it("passes with valid reason", () => {
    expect(
      closePetitionSchema.safeParse({ reason: "Issue has been resolved by the authority." })
        .success,
    ).toBe(true);
  });

  it("passes with reason at minimum length", () => {
    expect(closePetitionSchema.safeParse({ reason: "Ok." }).success).toBe(true);
  });

  it("passes with reason at maximum length", () => {
    expect(closePetitionSchema.safeParse({ reason: "A".repeat(1000) }).success).toBe(true);
  });

  it("fails with short reason", () => {
    expect(closePetitionSchema.safeParse({ reason: "No" }).success).toBe(false);
  });

  it("fails when reason exceeds 1000 chars", () => {
    expect(closePetitionSchema.safeParse({ reason: "A".repeat(1001) }).success).toBe(false);
  });

  it("fails when reason is missing", () => {
    expect(closePetitionSchema.safeParse({}).success).toBe(false);
  });
});

describe("signPetitionSchema", () => {
  const validDrawn = {
    method: "DRAWN" as const,
    signatureDataUrl:
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  };

  const validUploaded = {
    method: "UPLOADED" as const,
    signatureDataUrl:
      "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQ==",
  };

  it("passes with valid DRAWN signature", () => {
    expect(signPetitionSchema.safeParse(validDrawn).success).toBe(true);
  });

  it("passes with valid UPLOADED signature", () => {
    expect(signPetitionSchema.safeParse(validUploaded).success).toBe(true);
  });

  it("fails when signatureDataUrl is empty", () => {
    expect(signPetitionSchema.safeParse({ ...validDrawn, signatureDataUrl: "" }).success).toBe(
      false,
    );
  });

  it("fails when signatureDataUrl does not start with data:image/", () => {
    expect(
      signPetitionSchema.safeParse({
        ...validDrawn,
        signatureDataUrl: "https://cdn.example.com/signature.png",
      }).success,
    ).toBe(false);
  });

  it("fails when signatureDataUrl is a plain base64 string without data URI prefix", () => {
    expect(
      signPetitionSchema.safeParse({
        ...validDrawn,
        signatureDataUrl: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJ",
      }).success,
    ).toBe(false);
  });

  it("fails with invalid method", () => {
    expect(signPetitionSchema.safeParse({ ...validDrawn, method: "TYPED" }).success).toBe(false);
  });

  it("fails when method is missing", () => {
    const { method: _, ...noMethod } = validDrawn;
    expect(signPetitionSchema.safeParse(noMethod).success).toBe(false);
  });

  it("fails when signatureDataUrl is missing", () => {
    const { signatureDataUrl: _, ...noUrl } = validDrawn;
    expect(signPetitionSchema.safeParse(noUrl).success).toBe(false);
  });
});
