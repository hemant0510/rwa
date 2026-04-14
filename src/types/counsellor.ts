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
