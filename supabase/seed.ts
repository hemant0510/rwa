import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // 1. Super Admin (separate table)
  // authUserId will be updated when the Supabase Auth user is linked
  await prisma.superAdmin.create({
    data: {
      authUserId: "00000000-0000-0000-0000-000000000000",
      email: "admin@superadmin.com",
      name: "Super Admin",
      isActive: true,
    },
  });

  // 2. Society: Greenwood Residency (demo society)
  const society = await prisma.society.create({
    data: {
      societyId: "RWA-HR-GGN-122001-0001",
      societyCode: "GRNW",
      name: "Greenwood Residency Resident Welfare Association",
      state: "HR",
      city: "Gurgaon",
      cityCode: "GGN",
      pincode: "122001",
      type: "INDEPENDENT_SECTOR",
      joiningFee: 1000,
      annualFee: 1200,
    },
  });

  // 3. Primary Admin (RWA Admin)
  const admin = await prisma.user.create({
    data: {
      societyId: society.id,
      name: "Arjun Kapoor",
      email: "arjun@greenwood.in",
      mobile: "9876543210",
      role: "RWA_ADMIN",
      adminPermission: "FULL_ACCESS",
      status: "ACTIVE_PAID",
      consentWhatsapp: true,
    },
  });

  // 4. Five demo residents with units and fee records
  const residents = [
    {
      name: "Rajesh Sharma",
      email: "rajesh@example.com",
      mobile: "9876543211",
      ownership: "OWNER" as const,
      houseNo: "110",
      street: "3",
      sector: "22",
      feeStatus: "PAID" as const,
    },
    {
      name: "Priya Singh",
      email: "priya@example.com",
      mobile: "9876543212",
      ownership: "TENANT" as const,
      houseNo: "301",
      street: "9",
      sector: "22",
      feeStatus: "PARTIAL" as const,
    },
    {
      name: "Amit Verma",
      email: "amit@example.com",
      mobile: "9876543213",
      ownership: "OWNER" as const,
      houseNo: "88",
      street: "2",
      sector: "22",
      feeStatus: "OVERDUE" as const,
    },
    {
      name: "Neha Gupta",
      email: "neha@example.com",
      mobile: "9876543214",
      ownership: "OWNER" as const,
      houseNo: "55",
      street: "1",
      sector: "22",
      feeStatus: "EXEMPTED" as const,
    },
    {
      name: "Deepak Malhotra",
      email: "deepak@example.com",
      mobile: "9876543215",
      ownership: "TENANT" as const,
      houseNo: "44",
      street: "4",
      sector: "22",
      feeStatus: "PENDING" as const,
    },
  ];

  for (const r of residents) {
    const user = await prisma.user.create({
      data: {
        societyId: society.id,
        rwaid: `RWA-HR-GGN-122001-0001-2025-${String(residents.indexOf(r) + 1).padStart(4, "0")}`,
        name: r.name,
        email: r.email,
        mobile: r.mobile,
        role: "RESIDENT",
        ownershipType: r.ownership,
        status:
          r.feeStatus === "PAID"
            ? "ACTIVE_PAID"
            : r.feeStatus === "PARTIAL"
              ? "ACTIVE_PARTIAL"
              : r.feeStatus === "OVERDUE"
                ? "ACTIVE_OVERDUE"
                : r.feeStatus === "EXEMPTED"
                  ? "ACTIVE_EXEMPTED"
                  : "ACTIVE_PENDING",
        consentWhatsapp: true,
        approvedAt: new Date(),
        joiningFeePaid: true,
      },
    });

    const unit = await prisma.unit.create({
      data: {
        societyId: society.id,
        displayLabel: `S${r.sector}-St${r.street}-H${r.houseNo}`,
        houseNo: r.houseNo,
        streetGali: `Street ${r.street}`,
        sectorBlock: `Sector ${r.sector}`,
      },
    });

    await prisma.userUnit.create({
      data: {
        userId: user.id,
        unitId: unit.id,
        relationship: r.ownership,
      },
    });

    // Create fee record for 2025-26
    await prisma.membershipFee.create({
      data: {
        userId: user.id,
        unitId: unit.id,
        societyId: society.id,
        sessionYear: "2025-26",
        sessionStart: new Date("2025-04-01"),
        sessionEnd: new Date("2026-03-31"),
        amountDue: 1200,
        amountPaid: r.feeStatus === "PAID" ? 1200 : r.feeStatus === "PARTIAL" ? 400 : 0,
        status: r.feeStatus,
        gracePeriodEnd: new Date("2025-04-15"),
        ...(r.feeStatus === "EXEMPTED"
          ? { exemptionReason: "Senior citizen exemption per society resolution" }
          : {}),
      },
    });
  }

  // 5. Fee session for 2025-26
  await prisma.feeSession.create({
    data: {
      societyId: society.id,
      sessionYear: "2025-26",
      annualFee: 1200,
      joiningFee: 1000,
      sessionStart: new Date("2025-04-01"),
      sessionEnd: new Date("2026-03-31"),
      gracePeriodEnd: new Date("2025-04-15"),
      status: "ACTIVE",
    },
  });

  // 6. Sample expenses
  const expenses = [
    { category: "SECURITY" as const, amount: 5000, desc: "Monthly security guard salary" },
    { category: "CLEANING" as const, amount: 3000, desc: "Street cleaning service" },
    { category: "MAINTENANCE" as const, amount: 2500, desc: "Park maintenance" },
  ];

  for (const exp of expenses) {
    await prisma.expense.create({
      data: {
        societyId: society.id,
        date: new Date(),
        amount: exp.amount,
        category: exp.category,
        description: exp.desc,
        loggedBy: admin.id,
      },
    });
  }

  console.log("Seed data created successfully!");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
