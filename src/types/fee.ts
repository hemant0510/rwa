export interface MembershipFee {
  id: string;
  userId: string;
  societyId: string;
  sessionYear: string;
  amountDue: number;
  amountPaid: number;
  balance: number;
  status: FeeStatus;
  isProrata: boolean;
  prorataMonths: number | null;
  joiningFeeIncluded: boolean;
  exemptionReason: string | null;
}

export interface FeePayment {
  id: string;
  feeId: string;
  userId: string;
  amount: number;
  paymentMode: PaymentMode;
  referenceNo: string | null;
  receiptNo: string;
  receiptUrl: string | null;
  paymentDate: string;
  notes: string | null;
  isReversal: boolean;
  isReversed: boolean;
  createdAt: string;
}

export type FeeStatus = "NOT_YET_DUE" | "PENDING" | "OVERDUE" | "PARTIAL" | "PAID" | "EXEMPTED";

export type PaymentMode = "CASH" | "UPI" | "BANK_TRANSFER" | "OTHER";

export const FEE_STATUS_LABELS: Record<FeeStatus, string> = {
  NOT_YET_DUE: "Not Yet Due",
  PENDING: "Pending",
  OVERDUE: "Overdue",
  PARTIAL: "Partial",
  PAID: "Paid",
  EXEMPTED: "Exempted",
};

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  CASH: "Cash",
  UPI: "UPI",
  BANK_TRANSFER: "Bank Transfer",
  OTHER: "Other",
};
