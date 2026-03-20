import { describe, expect, it } from "vitest";

import { loginSchema, superAdminLoginSchema, resetPasswordSchema } from "@/lib/validations/auth";

describe("loginSchema", () => {
  it("passes with valid input", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "password123",
    });

    expect(result.success).toBe(true);
  });

  it("fails with an invalid email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "password123",
    });

    expect(result.success).toBe(false);
  });

  it("fails with a short password (less than 8 characters)", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "short",
    });

    expect(result.success).toBe(false);
  });

  it("fails with empty email", () => {
    const result = loginSchema.safeParse({
      email: "",
      password: "password123",
    });

    expect(result.success).toBe(false);
  });

  it("fails with empty password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "",
    });

    expect(result.success).toBe(false);
  });

  it("fails with both fields empty", () => {
    const result = loginSchema.safeParse({
      email: "",
      password: "",
    });

    expect(result.success).toBe(false);
  });
});

describe("superAdminLoginSchema", () => {
  it("passes with valid input", () => {
    const result = superAdminLoginSchema.safeParse({
      email: "admin@rwaconnect.in",
      password: "securepass1",
    });

    expect(result.success).toBe(true);
  });

  it("fails with an invalid email", () => {
    const result = superAdminLoginSchema.safeParse({
      email: "bad-email",
      password: "securepass1",
    });

    expect(result.success).toBe(false);
  });

  it("fails with a short password (less than 8 characters)", () => {
    const result = superAdminLoginSchema.safeParse({
      email: "admin@rwaconnect.in",
      password: "short",
    });

    expect(result.success).toBe(false);
  });

  it("fails with empty email", () => {
    const result = superAdminLoginSchema.safeParse({
      email: "",
      password: "securepass1",
    });

    expect(result.success).toBe(false);
  });

  it("fails with empty password", () => {
    const result = superAdminLoginSchema.safeParse({
      email: "admin@rwaconnect.in",
      password: "",
    });

    expect(result.success).toBe(false);
  });

  it("fails with both fields empty", () => {
    const result = superAdminLoginSchema.safeParse({
      email: "",
      password: "",
    });

    expect(result.success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  const validReset = {
    token: "reset-token-abc",
    password: "newpassword123",
    confirmPassword: "newpassword123",
  };

  it("passes with matching passwords", () => {
    const result = resetPasswordSchema.safeParse(validReset);
    expect(result.success).toBe(true);
  });

  it("fails when passwords do not match", () => {
    const result = resetPasswordSchema.safeParse({
      ...validReset,
      confirmPassword: "differentpassword",
    });
    expect(result.success).toBe(false);
  });

  it("fails when token is empty", () => {
    const result = resetPasswordSchema.safeParse({ ...validReset, token: "" });
    expect(result.success).toBe(false);
  });

  it("fails when password is too short", () => {
    const result = resetPasswordSchema.safeParse({
      ...validReset,
      password: "short",
      confirmPassword: "short",
    });
    expect(result.success).toBe(false);
  });
});
