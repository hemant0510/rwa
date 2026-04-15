export const COUNSELLOR_SLA_HOURS = 72;

export function computeSlaDeadline(createdAt: Date): Date {
  return new Date(createdAt.getTime() + COUNSELLOR_SLA_HOURS * 60 * 60 * 1000);
}

export interface SlaStatus {
  deadline: Date | null;
  hoursRemaining: number | null;
  isBreached: boolean;
}

export function describeSla(deadline: Date | null, now: Date = new Date()): SlaStatus {
  if (!deadline) return { deadline: null, hoursRemaining: null, isBreached: false };
  const msRemaining = deadline.getTime() - now.getTime();
  const hoursRemaining = Math.round(msRemaining / (60 * 60 * 1000));
  return {
    deadline,
    hoursRemaining,
    isBreached: msRemaining < 0,
  };
}
