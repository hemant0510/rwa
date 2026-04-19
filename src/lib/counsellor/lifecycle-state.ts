export type CounsellorLifecycleState =
  | "SUSPENDED"
  | "INVITE_PENDING"
  | "AWAITING_FIRST_LOGIN"
  | "ACTIVE";

interface LifecycleInput {
  isActive: boolean;
  passwordSetAt: string | null;
  lastLoginAt: string | null;
}

export function getCounsellorLifecycleState(c: LifecycleInput): CounsellorLifecycleState {
  if (!c.isActive) return "SUSPENDED";
  if (c.passwordSetAt === null) return "INVITE_PENDING";
  if (c.lastLoginAt === null) return "AWAITING_FIRST_LOGIN";
  return "ACTIVE";
}
