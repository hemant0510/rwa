export interface User {
  id: string;
  societyId: string | null;
  rwaid: string | null;
  name: string;
  mobile: string | null;
  email: string;
  photoUrl: string | null;
  role: UserRole;
  ownershipType: OwnershipType | null;
  status: ResidentStatus;
  adminPermission: AdminPermission | null;
  isEmailVerified: boolean;
  consentWhatsapp: boolean;
  joiningFeePaid: boolean;
  registeredAt: string;
  approvedAt: string | null;
  createdAt: string;
}

export type UserRole = "RWA_ADMIN" | "RESIDENT";

export type OwnershipType = "OWNER" | "TENANT";

export type AdminPermission = "FULL_ACCESS" | "READ_NOTIFY";

export type ResidentStatus =
  | "PENDING_APPROVAL"
  | "ACTIVE_PAID"
  | "ACTIVE_PENDING"
  | "ACTIVE_OVERDUE"
  | "ACTIVE_PARTIAL"
  | "ACTIVE_EXEMPTED"
  | "REJECTED"
  | "MIGRATED_PENDING"
  | "DORMANT"
  | "DEACTIVATED"
  | "TRANSFERRED_DEACTIVATED"
  | "TENANT_DEPARTED";

export const RESIDENT_STATUS_LABELS: Record<ResidentStatus, string> = {
  PENDING_APPROVAL: "Pending Approval",
  ACTIVE_PAID: "Active (Paid)",
  ACTIVE_PENDING: "Active (Pending)",
  ACTIVE_OVERDUE: "Active (Overdue)",
  ACTIVE_PARTIAL: "Active (Partial)",
  ACTIVE_EXEMPTED: "Active (Exempted)",
  REJECTED: "Rejected",
  MIGRATED_PENDING: "Migrated (Pending)",
  DORMANT: "Dormant",
  DEACTIVATED: "Deactivated",
  TRANSFERRED_DEACTIVATED: "Transferred",
  TENANT_DEPARTED: "Tenant Departed",
};
