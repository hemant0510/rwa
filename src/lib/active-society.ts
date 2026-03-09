const COOKIE_NAME = "active-society-id";
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

/**
 * Client-side: read active society ID from document.cookie.
 */
export function getActiveSocietyIdClient(): string | null {
  if (typeof document === "undefined") return null;

  const match = document.cookie.split("; ").find((c) => c.startsWith(`${COOKIE_NAME}=`));

  return match ? match.split("=")[1] : null;
}

/**
 * Client-side: set active society ID cookie.
 */
export function setActiveSocietyId(societyId: string): void {
  document.cookie = `${COOKIE_NAME}=${societyId}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

/**
 * Client-side: remove active society ID cookie.
 */
export function clearActiveSocietyId(): void {
  document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}
