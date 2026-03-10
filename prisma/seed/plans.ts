/**
 * Seed: Platform Subscription Plans
 * Run independently: npx tsx prisma/seed/plans.ts
 * Safe to re-run — uses upsert on slug.
 */

import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Feature flag shape stored in features_json
type PlanFeatures = {
  resident_management: boolean;
  fee_collection: boolean;
  expense_tracking: boolean;
  basic_reports: boolean;
  advanced_reports: boolean;
  whatsapp: boolean;
  elections: boolean;
  ai_insights: boolean;
  api_access: boolean;
  multi_admin: boolean; // true = more than 2 admins allowed
};

const CORE_FEATURES: PlanFeatures = {
  resident_management: true,
  fee_collection: true,
  expense_tracking: true,
  basic_reports: true,
  advanced_reports: false,
  whatsapp: false,
  elections: false,
  ai_insights: false,
  api_access: false,
  multi_admin: false,
};

const plans = [
  // ─────────────────────────────────────────────
  // 1. BASIC — Entry tier for small societies
  // ─────────────────────────────────────────────
  {
    name: "Basic",
    slug: "basic",
    description:
      "Perfect for small societies getting started. Core resident management and fee collection.",
    planType: "FLAT_FEE" as const,
    residentLimit: 150,
    pricePerUnit: null,
    isPublic: true,
    displayOrder: 1,
    badgeText: null,
    trialAccessLevel: false,
    featuresJson: { ...CORE_FEATURES } satisfies PlanFeatures,
    billingOptions: [
      { billingCycle: "MONTHLY" as const, price: 499 },
      { billingCycle: "ANNUAL" as const, price: 4990 }, // ~2 months free
      { billingCycle: "TWO_YEAR" as const, price: 9600 }, // ~4 months free
      { billingCycle: "THREE_YEAR" as const, price: 13500 }, // ~9 months free
    ],
  },

  // ─────────────────────────────────────────────
  // 2. BASIC+ — Most popular starter tier
  // ─────────────────────────────────────────────
  {
    name: "Basic+",
    slug: "basic-plus",
    description: "Advanced reports and multi-admin support for growing societies up to 300 units.",
    planType: "FLAT_FEE" as const,
    residentLimit: 300,
    pricePerUnit: null,
    isPublic: true,
    displayOrder: 2,
    badgeText: "Popular",
    trialAccessLevel: true, // Trial societies get Basic+ level access
    featuresJson: {
      ...CORE_FEATURES,
      advanced_reports: true,
      multi_admin: true,
    } satisfies PlanFeatures,
    billingOptions: [
      { billingCycle: "MONTHLY" as const, price: 999 },
      { billingCycle: "ANNUAL" as const, price: 9990 },
      { billingCycle: "TWO_YEAR" as const, price: 19200 },
      { billingCycle: "THREE_YEAR" as const, price: 27000 },
    ],
  },

  // ─────────────────────────────────────────────
  // 3. COMMUNITY — WhatsApp notifications included
  // ─────────────────────────────────────────────
  {
    name: "Community",
    slug: "community",
    description:
      "WhatsApp notifications and full analytics for active community management up to 750 units.",
    planType: "FLAT_FEE" as const,
    residentLimit: 750,
    pricePerUnit: null,
    isPublic: true,
    displayOrder: 3,
    badgeText: "Best Value",
    trialAccessLevel: false,
    featuresJson: {
      ...CORE_FEATURES,
      advanced_reports: true,
      whatsapp: true,
      multi_admin: true,
    } satisfies PlanFeatures,
    billingOptions: [
      { billingCycle: "MONTHLY" as const, price: 1799 },
      { billingCycle: "ANNUAL" as const, price: 17990 },
      { billingCycle: "TWO_YEAR" as const, price: 34560 },
      { billingCycle: "THREE_YEAR" as const, price: 48600 },
    ],
  },

  // ─────────────────────────────────────────────
  // 4. PRO — Full governance with elections
  // ─────────────────────────────────────────────
  {
    name: "Pro",
    slug: "pro",
    description: "Full RWA governance including digital elections module. Up to 2,000 units.",
    planType: "FLAT_FEE" as const,
    residentLimit: 2000,
    pricePerUnit: null,
    isPublic: true,
    displayOrder: 4,
    badgeText: null,
    trialAccessLevel: false,
    featuresJson: {
      ...CORE_FEATURES,
      advanced_reports: true,
      whatsapp: true,
      elections: true,
      multi_admin: true,
    } satisfies PlanFeatures,
    billingOptions: [
      { billingCycle: "MONTHLY" as const, price: 2999 },
      { billingCycle: "ANNUAL" as const, price: 29990 },
      { billingCycle: "TWO_YEAR" as const, price: 57600 },
      { billingCycle: "THREE_YEAR" as const, price: 80973 },
    ],
  },

  // ─────────────────────────────────────────────
  // 5. ENTERPRISE AI — Full platform with AI
  // ─────────────────────────────────────────────
  {
    name: "Enterprise AI",
    slug: "enterprise-ai",
    description: "Unlimited residents, AI-powered insights, API access, and dedicated support.",
    planType: "FLAT_FEE" as const,
    residentLimit: null, // unlimited
    pricePerUnit: null,
    isPublic: true,
    displayOrder: 5,
    badgeText: "All Features",
    trialAccessLevel: false,
    featuresJson: {
      resident_management: true,
      fee_collection: true,
      expense_tracking: true,
      basic_reports: true,
      advanced_reports: true,
      whatsapp: true,
      elections: true,
      ai_insights: true,
      api_access: true,
      multi_admin: true,
    } satisfies PlanFeatures,
    billingOptions: [
      { billingCycle: "MONTHLY" as const, price: 4999 },
      { billingCycle: "ANNUAL" as const, price: 49990 },
      { billingCycle: "TWO_YEAR" as const, price: 96000 },
      { billingCycle: "THREE_YEAR" as const, price: 134973 },
    ],
  },

  // ─────────────────────────────────────────────
  // 6. FLEX — Pay per unit, no resident cap
  // ─────────────────────────────────────────────
  {
    name: "Flex",
    slug: "flex",
    description:
      "Pay only for what you use. ₹8 per residential unit per month. Ideal for societies unsure of their size.",
    planType: "PER_UNIT" as const,
    residentLimit: null, // no limit — scales with units
    pricePerUnit: 8,
    isPublic: true,
    displayOrder: 6,
    badgeText: "Pay as you grow",
    trialAccessLevel: false,
    featuresJson: {
      ...CORE_FEATURES,
      advanced_reports: true,
      multi_admin: true,
    } satisfies PlanFeatures,
    billingOptions: [
      // Flex plan: monthly only (per-unit billing doesn't lock multi-year)
      { billingCycle: "MONTHLY" as const, price: 8 }, // price per unit
    ],
  },
];

async function seedPlans() {
  console.log("🌱 Seeding platform subscription plans...\n");

  for (const plan of plans) {
    const { billingOptions, ...planData } = plan;

    // Upsert plan by slug
    const upserted = await prisma.platformPlan.upsert({
      where: { slug: planData.slug },
      create: {
        ...planData,
        featuresJson: planData.featuresJson,
      },
      update: {
        name: planData.name,
        description: planData.description,
        residentLimit: planData.residentLimit,
        pricePerUnit: planData.pricePerUnit,
        featuresJson: planData.featuresJson,
        displayOrder: planData.displayOrder,
        badgeText: planData.badgeText,
        trialAccessLevel: planData.trialAccessLevel,
      },
    });

    // Upsert billing options
    for (const option of billingOptions) {
      await prisma.planBillingOption.upsert({
        where: {
          planId_billingCycle: {
            planId: upserted.id,
            billingCycle: option.billingCycle,
          },
        },
        create: {
          planId: upserted.id,
          billingCycle: option.billingCycle,
          price: option.price,
        },
        update: {
          price: option.price,
        },
      });
    }

    const cyclesLabel = billingOptions.map((o) => `${o.billingCycle}: ₹${o.price}`).join(", ");
    console.log(`  ✓ ${upserted.name} (${upserted.planType}) — ${cyclesLabel}`);
  }

  console.log(`\n✅ ${plans.length} plans seeded successfully.`);
}

seedPlans()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
