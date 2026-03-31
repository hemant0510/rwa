const BASE = "/api/v1/super-admin/societies";

function buildParams(filters?: Record<string, string | number | undefined | null>): string {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
    });
  }
  const str = params.toString();
  return str ? `?${str}` : "";
}

// --- Residents ---
export async function getSAResidents(
  societyId: string,
  filters?: { status?: string; search?: string; page?: number; limit?: number },
) {
  const res = await fetch(`${BASE}/${societyId}/residents${buildParams(filters)}`);
  if (!res.ok) throw new Error("Failed to fetch residents");
  return res.json();
}

export async function getSAResident(societyId: string, rid: string) {
  const res = await fetch(`${BASE}/${societyId}/residents/${rid}`);
  if (!res.ok) throw new Error("Failed to fetch resident");
  return res.json();
}

// --- Fees ---
export async function getSAFees(societyId: string, session?: string) {
  const res = await fetch(`${BASE}/${societyId}/fees${buildParams({ session })}`);
  if (!res.ok) throw new Error("Failed to fetch fees");
  return res.json();
}

export async function getSAFeesSummary(societyId: string, session?: string) {
  const res = await fetch(`${BASE}/${societyId}/fees/summary${buildParams({ session })}`);
  if (!res.ok) throw new Error("Failed to fetch fee summary");
  return res.json();
}

// --- Expenses ---
export async function getSAExpenses(
  societyId: string,
  filters?: {
    category?: string;
    scope?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  },
) {
  const res = await fetch(`${BASE}/${societyId}/expenses${buildParams(filters)}`);
  if (!res.ok) throw new Error("Failed to fetch expenses");
  return res.json();
}

export async function getSAExpensesSummary(societyId: string) {
  const res = await fetch(`${BASE}/${societyId}/expenses/summary`);
  if (!res.ok) throw new Error("Failed to fetch expense summary");
  return res.json();
}

// --- Events ---
export async function getSAEvents(
  societyId: string,
  filters?: { status?: string; category?: string; page?: number; limit?: number },
) {
  const res = await fetch(`${BASE}/${societyId}/events${buildParams(filters)}`);
  if (!res.ok) throw new Error("Failed to fetch events");
  return res.json();
}

export async function getSAEvent(societyId: string, eid: string) {
  const res = await fetch(`${BASE}/${societyId}/events/${eid}`);
  if (!res.ok) throw new Error("Failed to fetch event");
  return res.json();
}

// --- Petitions ---
export async function getSAPetitions(
  societyId: string,
  filters?: { status?: string; type?: string; page?: number; limit?: number },
) {
  const res = await fetch(`${BASE}/${societyId}/petitions${buildParams(filters)}`);
  if (!res.ok) throw new Error("Failed to fetch petitions");
  return res.json();
}

export async function getSAPetition(societyId: string, pid: string) {
  const res = await fetch(`${BASE}/${societyId}/petitions/${pid}`);
  if (!res.ok) throw new Error("Failed to fetch petition");
  return res.json();
}

export function getSAPetitionReportUrl(societyId: string, pid: string): string {
  return `${BASE}/${societyId}/petitions/${pid}/report`;
}

// --- Broadcasts ---
export async function getSABroadcasts(
  societyId: string,
  filters?: { page?: number; limit?: number },
) {
  const res = await fetch(`${BASE}/${societyId}/broadcasts${buildParams(filters)}`);
  if (!res.ok) throw new Error("Failed to fetch broadcasts");
  return res.json();
}

// --- Governing Body ---
export async function getSAGoverningBody(societyId: string) {
  const res = await fetch(`${BASE}/${societyId}/governing-body`);
  if (!res.ok) throw new Error("Failed to fetch governing body");
  return res.json();
}

// --- Migrations ---
export async function getSAMigrations(
  societyId: string,
  filters?: { page?: number; limit?: number },
) {
  const res = await fetch(`${BASE}/${societyId}/migrations${buildParams(filters)}`);
  if (!res.ok) throw new Error("Failed to fetch migrations");
  return res.json();
}

// --- Settings ---
export async function getSASettings(societyId: string) {
  const res = await fetch(`${BASE}/${societyId}/settings`);
  if (!res.ok) throw new Error("Failed to fetch settings");
  return res.json();
}

// --- Reports ---
export async function getSAReport(societyId: string, type: string, session?: string) {
  const res = await fetch(`${BASE}/${societyId}/reports/${type}${buildParams({ session })}`);
  if (!res.ok) throw new Error(`Failed to fetch ${type} report`);
  return res.json();
}
