import type { BillingCycle } from "@prisma/client";

export function generateInvoiceNo(year: number, seq: number) {
  return `INV-${year}-${String(seq).padStart(6, "0")}`;
}

export function addBillingCycle(start: Date, cycle: BillingCycle): Date {
  const end = new Date(start);
  switch (cycle) {
    case "MONTHLY":
      end.setMonth(end.getMonth() + 1);
      break;
    case "ANNUAL":
      end.setFullYear(end.getFullYear() + 1);
      break;
    case "TWO_YEAR":
      end.setFullYear(end.getFullYear() + 2);
      break;
    case "THREE_YEAR":
      end.setFullYear(end.getFullYear() + 3);
      break;
  }
  return end;
}

export function toPeriodKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export function parseISODateOnly(input: string): Date {
  const [year, month, day] = input.split("-").map((n) => Number(n));
  return new Date(Date.UTC(year, month - 1, day));
}

export function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function diffDaysUtc(from: Date, to: Date): number {
  const a = startOfUtcDay(from).getTime();
  const b = startOfUtcDay(to).getTime();
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}
