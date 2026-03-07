import { describe, it, expect } from "vitest";
import { ZodError, z } from "zod";

import {
  successResponse,
  errorResponse,
  validationError,
  notFoundError,
  unauthorizedError,
  forbiddenError,
  internalError,
  parseBody,
} from "@/lib/api-helpers";

describe("successResponse", () => {
  it("returns 200 by default", () => {
    const res = successResponse({ message: "ok" });
    expect(res.status).toBe(200);
  });

  it("returns custom status", () => {
    const res = successResponse({ id: "1" }, 201);
    expect(res.status).toBe(201);
  });

  it("includes data in body", async () => {
    const res = successResponse({ name: "Test" });
    const body = await res.json();
    expect(body.name).toBe("Test");
  });
});

describe("errorResponse", () => {
  it("returns correct status and body", async () => {
    const res = errorResponse({ code: "TEST", message: "Test error", status: 418 });
    expect(res.status).toBe(418);
    const body = await res.json();
    expect(body.error.code).toBe("TEST");
    expect(body.error.message).toBe("Test error");
  });
});

describe("validationError", () => {
  it("returns 422 with field errors", async () => {
    const schema = z.object({ email: z.string().email() });
    try {
      schema.parse({ email: "invalid" });
    } catch (err) {
      const res = validationError(err as ZodError);
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error.code).toBe("VALIDATION_ERROR");
      expect(body.error.details).toBeDefined();
    }
  });
});

describe("notFoundError", () => {
  it("returns 404 with default message", async () => {
    const res = notFoundError();
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.message).toBe("Resource not found");
  });

  it("returns 404 with custom message", async () => {
    const res = notFoundError("Resident not found");
    const body = await res.json();
    expect(body.error.message).toBe("Resident not found");
  });
});

describe("unauthorizedError", () => {
  it("returns 401 with default message", async () => {
    const res = unauthorizedError();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.message).toBe("Not authenticated");
  });

  it("returns 401 with custom message", async () => {
    const res = unauthorizedError("Session expired");
    const body = await res.json();
    expect(body.error.message).toBe("Session expired");
  });
});

describe("forbiddenError", () => {
  it("returns 403 with default message", async () => {
    const res = forbiddenError();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.message).toBe("Forbidden");
  });

  it("returns 403 with custom message", async () => {
    const res = forbiddenError("Not authorized");
    const body = await res.json();
    expect(body.error.message).toBe("Not authorized");
  });
});

describe("internalError", () => {
  it("returns 500 with default message", async () => {
    const res = internalError();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.message).toBe("Internal server error");
  });

  it("returns 500 with custom message", async () => {
    const res = internalError("Database down");
    const body = await res.json();
    expect(body.error.message).toBe("Database down");
  });
});

describe("parseBody", () => {
  const schema = z.object({ name: z.string().min(2) });

  it("parses valid body", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ name: "Test" }),
    });
    const { data, error } = await parseBody(request, schema);
    expect(data).toEqual({ name: "Test" });
    expect(error).toBeNull();
  });

  it("returns validation error for invalid data", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ name: "T" }),
    });
    const { data, error } = await parseBody(request, schema);
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error!.status).toBe(422);
  });

  it("returns invalid JSON error for bad body", async () => {
    const request = new Request("http://localhost", {
      method: "POST",
      body: "not json",
    });
    const { data, error } = await parseBody(request, schema);
    expect(data).toBeNull();
    expect(error).not.toBeNull();
    expect(error!.status).toBe(400);
  });
});
