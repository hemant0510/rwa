import { vi } from "vitest";

export const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
    count: vi.fn(),
  },
  society: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  unit: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  userUnit: {
    findMany: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  membershipFee: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  },
  feePayment: {
    findMany: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  emailVerificationToken: {
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  passwordResetToken: {
    findUnique: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  notificationPreference: {
    deleteMany: vi.fn(),
  },
  notification: {
    deleteMany: vi.fn(),
  },
  dependent: {
    deleteMany: vi.fn(),
  },
  visitorLog: {
    deleteMany: vi.fn(),
  },
  blacklistedNumber: {
    findFirst: vi.fn(),
    deleteMany: vi.fn(),
  },
  expense: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  },
  expenseQuery: {
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
  },
  festivalContribution: {
    deleteMany: vi.fn(),
  },
  propertyTransfer: {
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
  },
  broadcast: {
    findMany: vi.fn(),
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  adminTerm: {
    deleteMany: vi.fn(),
    updateMany: vi.fn(),
  },
  vehicle: {
    deleteMany: vi.fn(),
  },
  superAdmin: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  platformPlan: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  planBillingOption: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  planDiscount: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  societySubscription: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  societySubscriptionHistory: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn((arg: unknown) => {
    if (typeof arg === "function") {
      return (arg as (tx: typeof mockPrisma) => Promise<unknown>)(mockPrisma);
    }
    // Array of promises (e.g., reorder)
    return Promise.resolve((arg as unknown[]).map(() => ({})));
  }),
};

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
}));
