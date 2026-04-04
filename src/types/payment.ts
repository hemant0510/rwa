// Const enum for type-safe status checks throughout the app
export const ClaimStatus = {
  PENDING: "PENDING",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
} as const;
export type ClaimStatus = (typeof ClaimStatus)[keyof typeof ClaimStatus];

export interface PaymentClaim {
  id: string;
  societyId: string;
  userId: string;
  membershipFeeId: string;
  claimedAmount: number;
  utrNumber: string;
  paymentDate: string;
  screenshotUrl: string | null;
  status: ClaimStatus;
  verifiedBy: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  adminNotes: string | null;
  // No feePaymentId here — FK lives on FeePayment. Use feePayments[] join if needed.
  createdAt: string;
  updatedAt: string;
  // joins
  user?: { name: string; unitNumber: string };
  membershipFee?: { sessionYear: string; amountDue: number };
}

export interface SubscriptionPaymentClaim {
  id: string;
  societyId: string;
  subscriptionId: string;
  amount: number;
  utrNumber: string;
  paymentDate: string;
  screenshotUrl: string | null;
  status: ClaimStatus;
  verifiedBy: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  createdAt: string;
  // joins
  society?: { name: string };
  subscription?: { planName: string };
}

export interface UpiSettings {
  upiId: string | null;
  upiQrUrl: string | null;
  upiAccountName: string | null;
}

export interface PlatformUpiSettings {
  platformUpiId: string | null;
  platformUpiQrUrl: string | null;
  platformUpiAccountName: string | null;
}
