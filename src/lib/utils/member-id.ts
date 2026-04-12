/**
 * Generates sub-IDs for household members off the head-of-household RWAID.
 * Format: <rwaid>-M<seq>, <rwaid>-P<seq>, <rwaid>-H<seq>
 */

export function generateMemberId(rwaid: string, seq: number): string {
  return `${rwaid}-M${seq}`;
}

export function generatePetId(rwaid: string, seq: number): string {
  return `${rwaid}-P${seq}`;
}

export function generateHelperId(rwaid: string, seq: number): string {
  return `${rwaid}-H${seq}`;
}
