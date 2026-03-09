import { cookies } from "next/headers";

const COOKIE_NAME = "active-society-id";

/**
 * Server-side: read active society ID from cookie.
 * Must be called within a server context (API routes, server components).
 */
export async function getActiveSocietyId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value ?? null;
}
