/**
 * One-time backfill script.
 *
 * Finds MembershipFee rows where amountPaid > 0 but no non-reversal FeePayment
 * exists, and creates a synthetic CASH FeePayment to make the ledger consistent
 * with the denormalized amountPaid field.
 *
 * Run once on existing databases that were seeded before this fix:
 *   npx ts-node --project tsconfig.json prisma/backfill-fee-payments.ts
 */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Find all fees that have amountPaid > 0 but no active FeePayment records
  const fees = await prisma.membershipFee.findMany({
    where: {
      amountPaid: { gt: 0 },
      feePayments: { none: { isReversal: false, isReversed: false } },
    },
    include: { society: { select: { id: true } } },
  });

  if (fees.length === 0) {
    console.log("No orphaned amountPaid values found. Nothing to backfill.");
    return;
  }

  console.log(`Found ${fees.length} fee record(s) to backfill.`);

  // Find a recorder — use the first RWA_ADMIN of each society
  const adminBySociety = new Map<string, string>();
  for (const fee of fees) {
    if (!adminBySociety.has(fee.societyId)) {
      const admin = await prisma.user.findFirst({
        where: { societyId: fee.societyId, role: "RWA_ADMIN" },
        select: { id: true },
      });
      if (admin) adminBySociety.set(fee.societyId, admin.id);
    }
  }

  let created = 0;
  for (const fee of fees) {
    const recordedBy = adminBySociety.get(fee.societyId);
    if (!recordedBy) {
      console.warn(`No RWA_ADMIN found for society ${fee.societyId}, skipping fee ${fee.id}`);
      continue;
    }

    await prisma.feePayment.create({
      data: {
        feeId: fee.id,
        userId: fee.userId,
        societyId: fee.societyId,
        amount: fee.amountPaid,
        paymentMode: "CASH",
        receiptNo: `BACKFILL-${fee.id.slice(0, 8).toUpperCase()}`,
        paymentDate: fee.sessionStart ?? new Date(),
        recordedBy,
        isReversal: false,
        isReversed: false,
        notes: "Backfilled from seed data — amountPaid had no corresponding FeePayment record",
      },
    });
    created++;
  }

  console.log(`Backfill complete. Created ${created} FeePayment record(s).`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
