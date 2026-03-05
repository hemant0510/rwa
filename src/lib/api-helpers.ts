import { NextResponse } from "next/server";

import { ZodError } from "zod";

export interface ApiError {
  code: string;
  message: string;
  status: number;
  details?: unknown;
}

export function successResponse<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function errorResponse(error: ApiError) {
  return NextResponse.json({ error }, { status: error.status });
}

export function validationError(zodError: ZodError) {
  return errorResponse({
    code: "VALIDATION_ERROR",
    message: "Validation failed",
    status: 422,
    details: zodError.flatten().fieldErrors,
  });
}

export function notFoundError(message = "Resource not found") {
  return errorResponse({ code: "NOT_FOUND", message, status: 404 });
}

export function unauthorizedError(message = "Not authenticated") {
  return errorResponse({ code: "UNAUTHORIZED", message, status: 401 });
}

export function forbiddenError(message = "Forbidden") {
  return errorResponse({ code: "FORBIDDEN", message, status: 403 });
}

export function internalError(message = "Internal server error") {
  return errorResponse({ code: "INTERNAL_ERROR", message, status: 500 });
}

/**
 * Parse request body safely, returning validation error if invalid.
 */
export async function parseBody<T>(request: Request, schema: { parse: (data: unknown) => T }) {
  try {
    const body = await request.json();
    return { data: schema.parse(body), error: null };
  } catch (err) {
    if (err instanceof ZodError) {
      return { data: null, error: validationError(err) };
    }
    return {
      data: null,
      error: errorResponse({ code: "INVALID_JSON", message: "Invalid request body", status: 400 }),
    };
  }
}
