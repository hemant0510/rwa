import { CtaBand } from "@/components/features/marketing/sections/CtaBand";
import { Differentiators } from "@/components/features/marketing/sections/Differentiators";
import { FAQ } from "@/components/features/marketing/sections/FAQ";
import { FeatureShowcase } from "@/components/features/marketing/sections/FeatureShowcase";
import { Hero } from "@/components/features/marketing/sections/Hero";
import { HowItWorks } from "@/components/features/marketing/sections/HowItWorks";
import { PricingPreview } from "@/components/features/marketing/sections/PricingPreview";
import { ProblemSolution } from "@/components/features/marketing/sections/ProblemSolution";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RWA Connect — The OS for Indian housing societies",
  description:
    "Onboard residents in 60 seconds. Collect fees on UPI with zero gateway fees. Run petitions, community events, and resident support — from one app your secretary, treasurer, and residents will actually use.",
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <ProblemSolution />
      <FeatureShowcase />
      <HowItWorks />
      <PricingPreview />
      <Differentiators />
      <FAQ />
      <CtaBand />
    </>
  );
}
