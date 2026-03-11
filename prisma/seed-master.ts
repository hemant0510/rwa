// prisma/seed-master.ts
// Sets up master/platform tables only — no society or resident data.
// This is the "factory reset" script for a fresh database.
//
// Usage: npm run db:seed:master
//   or:  npx tsx prisma/seed-master.ts

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Setting up master/platform data...\n");

  // ─── 1. Super Admin ───────────────────────────────
  const superAdmin = await prisma.superAdmin.upsert({
    where: { email: "admin@superadmin.com" },
    update: {},
    create: {
      authUserId: "d406abbb-dc7d-479c-92df-89c424494f5e",
      email: "admin@superadmin.com",
      name: "Super Admin",
      isActive: true,
    },
  });
  console.log("  Super Admin:", superAdmin.email);

  // ─── 2. Platform Plans ────────────────────────────
  const planConfigs = [
    {
      name: "Basic",
      slug: "basic",
      planType: "FLAT_FEE" as const,
      residentLimit: 150,
      pricePerUnit: null,
      featuresJson: {
        whatsapp: false,
        elections: false,
        api_access: false,
        ai_insights: false,
        multi_admin: false,
        basic_reports: true,
        fee_collection: true,
        advanced_reports: false,
        expense_tracking: true,
        resident_management: true,
      },
      isPublic: true,
      displayOrder: 1,
      badgeText: null,
      trialAccessLevel: false,
      billing: {
        MONTHLY: 499,
        ANNUAL: 4990,
        TWO_YEAR: 9600,
        THREE_YEAR: 13500,
      },
    },
    {
      name: "Basic+",
      slug: "basic-plus",
      planType: "FLAT_FEE" as const,
      residentLimit: 300,
      pricePerUnit: null,
      featuresJson: {
        whatsapp: false,
        elections: false,
        api_access: false,
        ai_insights: false,
        multi_admin: true,
        basic_reports: true,
        fee_collection: true,
        advanced_reports: true,
        expense_tracking: true,
        resident_management: true,
      },
      isPublic: false,
      displayOrder: 2,
      badgeText: "Popular",
      trialAccessLevel: false,
      billing: {
        MONTHLY: 999,
        ANNUAL: 9990,
        TWO_YEAR: 19200,
        THREE_YEAR: 27000,
      },
    },
    {
      name: "Community",
      slug: "community",
      planType: "FLAT_FEE" as const,
      residentLimit: 750,
      pricePerUnit: null,
      featuresJson: {
        whatsapp: true,
        elections: false,
        api_access: false,
        ai_insights: false,
        multi_admin: true,
        basic_reports: true,
        fee_collection: true,
        advanced_reports: true,
        expense_tracking: true,
        resident_management: true,
      },
      isPublic: false,
      displayOrder: 3,
      badgeText: "Best Value",
      trialAccessLevel: false,
      billing: {
        MONTHLY: 1799,
        ANNUAL: 17990,
        TWO_YEAR: 34560,
        THREE_YEAR: 48600,
      },
    },
    {
      name: "Pro",
      slug: "pro",
      planType: "FLAT_FEE" as const,
      residentLimit: 2000,
      pricePerUnit: null,
      featuresJson: {
        whatsapp: true,
        elections: true,
        api_access: false,
        ai_insights: false,
        multi_admin: true,
        basic_reports: true,
        fee_collection: true,
        advanced_reports: true,
        expense_tracking: true,
        resident_management: true,
      },
      isPublic: false,
      displayOrder: 4,
      badgeText: null,
      trialAccessLevel: false,
      billing: {
        MONTHLY: 2999,
        ANNUAL: 29990,
        TWO_YEAR: 57600,
        THREE_YEAR: 80973,
      },
    },
    {
      name: "Enterprise AI",
      slug: "enterprise-ai",
      planType: "FLAT_FEE" as const,
      residentLimit: null,
      pricePerUnit: null,
      featuresJson: {
        whatsapp: true,
        elections: true,
        api_access: true,
        ai_insights: true,
        multi_admin: true,
        basic_reports: true,
        fee_collection: true,
        advanced_reports: true,
        expense_tracking: true,
        resident_management: true,
      },
      isPublic: false,
      displayOrder: 5,
      badgeText: "All Features",
      trialAccessLevel: false,
      billing: {
        MONTHLY: 4999,
        ANNUAL: 49990,
        TWO_YEAR: 96000,
        THREE_YEAR: 134973,
      },
    },
    {
      name: "Flex",
      slug: "flex",
      planType: "PER_UNIT" as const,
      residentLimit: null,
      pricePerUnit: 10,
      featuresJson: {
        whatsapp: false,
        elections: false,
        api_access: false,
        ai_insights: false,
        multi_admin: true,
        basic_reports: true,
        fee_collection: true,
        advanced_reports: true,
        expense_tracking: true,
        resident_management: true,
      },
      isPublic: true,
      displayOrder: 6,
      badgeText: "Pay as you grow",
      trialAccessLevel: false,
      billing: {
        MONTHLY: 10,
        ANNUAL: 99,
        TWO_YEAR: null,
        THREE_YEAR: null,
      },
    },
  ];

  const billingCycles = ["MONTHLY", "ANNUAL", "TWO_YEAR", "THREE_YEAR"] as const;
  let planCount = 0;
  let billingCount = 0;

  for (const config of planConfigs) {
    const plan = await prisma.platformPlan.upsert({
      where: { slug: config.slug },
      update: {},
      create: {
        name: config.name,
        slug: config.slug,
        planType: config.planType,
        residentLimit: config.residentLimit,
        pricePerUnit: config.pricePerUnit,
        featuresJson: config.featuresJson,
        isActive: true,
        isPublic: config.isPublic,
        displayOrder: config.displayOrder,
        badgeText: config.badgeText,
        trialAccessLevel: config.trialAccessLevel,
      },
    });
    planCount++;

    for (const cycle of billingCycles) {
      const price = config.billing[cycle];
      if (price === null) continue;

      // Check if billing option exists before creating
      const existing = await prisma.planBillingOption.findUnique({
        where: { planId_billingCycle: { planId: plan.id, billingCycle: cycle } },
      });
      if (!existing) {
        await prisma.planBillingOption.create({
          data: {
            planId: plan.id,
            billingCycle: cycle,
            price,
            isActive: true,
          },
        });
        billingCount++;
      }
    }
  }

  console.log(`  Platform Plans: ${planCount} created`);
  console.log(`  Billing Options: ${billingCount} created`);

  // ─── Summary ──────────────────────────────────────
  console.log("\nMaster data setup complete!");
  console.log("\n  Tables seeded:");
  console.log("    - super_admins (1 record)");
  console.log(`    - platform_plans (${planCount} records)`);
  console.log(`    - plan_billing_options (${billingCount} records)`);
  console.log("\n  Tables NOT seeded (created via app flows):");
  console.log("    - societies, users, units (onboarding flow)");
  console.log("    - designations (created per-society by admin)");
  console.log("    - society_subscriptions (created when society picks a plan)");
  console.log("    - All other operational tables");
  console.log("\n  Next steps:");
  console.log("    1. Verify Super Admin can log in via Supabase Auth");
  console.log("    2. Create a society through the onboarding flow");
  console.log("    3. Or run 'npm run db:seed:dev' for demo data");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
