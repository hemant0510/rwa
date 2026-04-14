// ─── Counsellor ───────────────────────────────────────────────────

export interface CounsellorListItem {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  photoUrl: string | null;
  isActive: boolean;
  mfaEnrolledAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  _count: { assignments: number };
}

export interface CounsellorDetail {
  id: string;
  authUserId: string;
  name: string;
  email: string;
  mobile: string | null;
  nationalId: string | null;
  photoUrl: string | null;
  bio: string | null;
  publicBlurb: string | null;
  isActive: boolean;
  mfaRequired: boolean;
  mfaEnrolledAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CounsellorContext {
  counsellorId: string;
  authUserId: string;
  email: string;
  name: string;
}

// ─── Society Assignment ───────────────────────────────────────────

export interface CounsellorSocietyAssignmentItem {
  id: string;
  counsellorId: string;
  societyId: string;
  assignedById: string;
  assignedAt: string;
  isPrimary: boolean;
  isActive: boolean;
  revokedAt: string | null;
  revokedById: string | null;
  notes: string | null;
  society: {
    id: string;
    name: string;
    societyCode: string;
    city: string;
    state: string;
    totalUnits: number;
  };
}

// ─── Paginated Response ───────────────────────────────────────────

export interface PaginatedCounsellors {
  counsellors: CounsellorListItem[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Portfolio (Counsellor-self views) ────────────────────────────

export interface CounsellorDashboard {
  counsellor: {
    id: string;
    name: string;
    email: string;
    photoUrl: string | null;
  };
  totals: {
    societies: number;
    residents: number;
    openEscalations: number;
    pendingAck: number;
  };
  societies: Array<{
    id: string;
    name: string;
    societyCode: string;
    city: string;
    state: string;
    totalUnits: number;
    isPrimary: boolean;
    openEscalations: number;
  }>;
}

export interface CounsellorSocietySummary {
  id: string;
  name: string;
  societyCode: string;
  city: string;
  state: string;
  totalUnits: number;
  assignedAt: string;
  isPrimary: boolean;
}

export interface CounsellorSocietyDetail {
  id: string;
  name: string;
  societyCode: string;
  city: string;
  state: string;
  pincode: string;
  totalUnits: number;
  registrationNo: string | null;
  registrationDate: string | null;
  counsellorEscalationThreshold: number;
  onboardingDate: string;
  assignedAt: string;
  isPrimary: boolean;
  counts: {
    residents: number;
    governingBodyMembers: number;
    openEscalations: number;
  };
}

export interface CounsellorResidentListItem {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  photoUrl: string | null;
  unitLabel: string | null;
  ownershipType: "OWNER" | "TENANT" | null;
  status: string;
  role: string;
}

export interface PaginatedCounsellorResidents {
  residents: CounsellorResidentListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface CounsellorResidentDetail {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  photoUrl: string | null;
  role: string;
  status: string;
  ownershipType: "OWNER" | "TENANT" | null;
  registeredAt: string;
  approvedAt: string | null;
  society: {
    id: string;
    name: string;
  };
  units: Array<{
    id: string;
    displayLabel: string;
    towerBlock: string | null;
    floorNo: string | null;
    relationship: string;
    isPrimary: boolean;
  }>;
}

export interface CounsellorGoverningBodyMember {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  designation: string;
  photoUrl: string | null;
  assignedAt: string;
}
