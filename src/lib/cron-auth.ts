export function verifyCronSecret(request: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const secret = request.headers.get("authorization");
  return secret === `Bearer ${expected}`;
}
