import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Masks a 10-digit mobile number showing only the last 5 digits.
 * "9876543210" → "XXXXX 43210"
 * Non-10-digit strings are returned as-is (no mobile provided).
 */
export function maskMobile(mobile: string | null | undefined): string {
  if (!mobile) return "—";
  if (!/^\d{10}$/.test(mobile)) return mobile;
  return `XXXXX ${mobile.slice(5)}`;
}
