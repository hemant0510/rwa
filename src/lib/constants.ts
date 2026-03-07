export const APP_NAME = "RWA Connect";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Fee defaults
export const DEFAULT_JOINING_FEE = 1000;
export const DEFAULT_ANNUAL_FEE = 1200;
export const DEFAULT_GRACE_PERIOD_DAYS = 15;
export const DEFAULT_FEE_SESSION_START_MONTH = 4; // April

// Limits
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
export const ALLOWED_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];
export const MAX_OTP_ATTEMPTS_PER_HOUR = 3;
export const PIN_MAX_FAILED_ATTEMPTS = 5;
export const CORRECTION_WINDOW_HOURS = 48;
export const EXPENSE_CORRECTION_WINDOW_HOURS = 24;
export const ADMIN_SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 hours
export const RESIDENT_SESSION_DAYS = 30;

// Trial
export const TRIAL_PERIOD_DAYS = parseInt(process.env.TRIAL_PERIOD_DAYS || "14", 10);
export const MAX_TRIAL_RESIDENTS = parseInt(process.env.MAX_TRIAL_RESIDENTS || "50", 10);

// Society Code
export const SOCIETY_CODE_MIN_LENGTH = 4;
export const SOCIETY_CODE_MAX_LENGTH = 8;
export const SOCIETY_CODE_PATTERN = /^[A-Z0-9]+$/;

// Email verification
export const VERIFICATION_TOKEN_EXPIRY_HOURS = 24;
export const VERIFICATION_RESEND_COOLDOWN_SECONDS = 120;

// Indian mobile validation
export const INDIAN_MOBILE_PATTERN = /^[6-9]\d{9}$/;
export const PINCODE_PATTERN = /^\d{6}$/;

// Expense categories
export const EXPENSE_CATEGORIES = [
  "MAINTENANCE",
  "SECURITY",
  "CLEANING",
  "STAFF_SALARY",
  "INFRASTRUCTURE",
  "UTILITIES",
  "EMERGENCY",
  "ADMINISTRATIVE",
  "OTHER",
] as const;

// Floor levels for builder floors
export const FLOOR_LEVELS = ["GF", "1F", "2F", "3F", "4F", "Terrace"] as const;

// Indian states (code -> name)
export const INDIAN_STATES: Record<string, string> = {
  AP: "Andhra Pradesh",
  AR: "Arunachal Pradesh",
  AS: "Assam",
  BR: "Bihar",
  CG: "Chhattisgarh",
  GA: "Goa",
  GJ: "Gujarat",
  HR: "Haryana",
  HP: "Himachal Pradesh",
  JH: "Jharkhand",
  KA: "Karnataka",
  KL: "Kerala",
  MP: "Madhya Pradesh",
  MH: "Maharashtra",
  MN: "Manipur",
  ML: "Meghalaya",
  MZ: "Mizoram",
  NL: "Nagaland",
  OD: "Odisha",
  PB: "Punjab",
  RJ: "Rajasthan",
  SK: "Sikkim",
  TN: "Tamil Nadu",
  TS: "Telangana",
  TR: "Tripura",
  UP: "Uttar Pradesh",
  UK: "Uttarakhand",
  WB: "West Bengal",
  AN: "Andaman & Nicobar",
  CH: "Chandigarh",
  DL: "Delhi",
  DN: "Dadra & Nagar Haveli",
  JK: "Jammu & Kashmir",
  LA: "Ladakh",
  LD: "Lakshadweep",
  PY: "Puducherry",
};
