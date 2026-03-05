/**
 * Pro-rata fee calculation engine.
 * Shared between server and client.
 */

interface ProRataInput {
  annualFee: number;
  joiningFee: number;
  sessionStartMonth: number; // 1-12, default 4 (April)
  approvalMonth: number; // 1-12
}

interface ProRataResult {
  joiningFee: number;
  annualFee: number;
  monthlyRate: number;
  remainingMonths: number;
  proRataAmount: number;
  totalFirstPayment: number;
}

export function calculateProRata({
  annualFee,
  joiningFee,
  sessionStartMonth,
  approvalMonth,
}: ProRataInput): ProRataResult {
  const monthlyRate = annualFee / 12;

  let remainingMonths: number;
  if (approvalMonth >= sessionStartMonth) {
    remainingMonths = 12 - (approvalMonth - sessionStartMonth);
  } else {
    remainingMonths = sessionStartMonth - approvalMonth;
  }

  const proRataAmount = Math.round(monthlyRate * remainingMonths);
  const totalFirstPayment = joiningFee + proRataAmount;

  return {
    joiningFee,
    annualFee,
    monthlyRate: Math.round(monthlyRate * 100) / 100,
    remainingMonths,
    proRataAmount,
    totalFirstPayment,
  };
}

/**
 * Get the session year string (e.g., "2025-26") for a given date.
 */
export function getSessionYear(date: Date, sessionStartMonth: number = 4): string {
  const month = date.getMonth() + 1; // 1-indexed
  const year = date.getFullYear();

  if (month >= sessionStartMonth) {
    return `${year}-${String(year + 1).slice(2)}`;
  }
  return `${year - 1}-${String(year).slice(2)}`;
}

/**
 * Get session start and end dates for a session year string.
 */
export function getSessionDates(
  sessionYear: string,
  sessionStartMonth: number = 4,
): { start: Date; end: Date } {
  const startYear = parseInt(sessionYear.split("-")[0]);
  const start = new Date(startYear, sessionStartMonth - 1, 1);
  const end = new Date(startYear + 1, sessionStartMonth - 1, 0); // Last day of month before session start

  return { start, end };
}

/**
 * Generate display label for a unit based on society type.
 */
export function generateUnitDisplayLabel(
  societyType: string,
  fields: Record<string, string | undefined>,
): string {
  switch (societyType) {
    case "APARTMENT_COMPLEX":
      return `${fields.towerBlock}-${fields.floorNo}-${fields.flatNo}`;
    case "BUILDER_FLOORS":
      return `${fields.houseNo}-${fields.floorLevel}`;
    case "GATED_COMMUNITY_VILLAS": {
      const parts = [`Villa-${fields.villaNo}`];
      if (fields.streetPhase) parts.push(`P${fields.streetPhase}`);
      return parts.join("-");
    }
    case "INDEPENDENT_SECTOR":
      return `S${fields.sectorBlock}-St${fields.streetGali}-H${fields.houseNo}`;
    case "PLOTTED_COLONY": {
      const parts = [`Plot-${fields.plotNo}`];
      if (fields.laneNo) parts.push(`L${fields.laneNo}`);
      return parts.join("-");
    }
    default:
      return "Unknown";
  }
}

/**
 * Generate Society ID from components.
 * Format: RWA-[STATE]-[CITY3]-[PINCODE]-[SEQ]
 */
export function generateSocietyId(
  state: string,
  cityCode: string,
  pincode: string,
  sequence: number,
): string {
  return `RWA-${state}-${cityCode}-${pincode}-${String(sequence).padStart(4, "0")}`;
}

/**
 * Generate RWAID from components.
 * Format: RWA-[STATE]-[CITY3]-[PINCODE]-[SOCSEQ]-[YEAR]-[RESSEQ]
 */
export function generateRWAID(societyId: string, year: number, residentSequence: number): string {
  return `${societyId}-${year}-${String(residentSequence).padStart(4, "0")}`;
}

/**
 * Generate receipt number.
 * Format: [SOCIETYCODE]-[YEAR]-R[SEQ]
 */
export function generateReceiptNo(societyCode: string, year: number, sequence: number): string {
  return `${societyCode}-${year}-R${String(sequence).padStart(4, "0")}`;
}
