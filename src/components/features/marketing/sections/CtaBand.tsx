import Link from "next/link";

import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export function CtaBand() {
  return (
    <section className="relative overflow-hidden">
      <div className="from-primary to-chart-2 absolute inset-0 bg-gradient-to-br" />
      <div
        aria-hidden="true"
        className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-white/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-white/10 blur-3xl"
      />
      <div className="relative mx-auto max-w-5xl px-4 py-16 text-center sm:px-6 sm:py-24">
        <h2 className="text-primary-foreground mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
          Ready to digitise your society?
        </h2>
        <p className="text-primary-foreground/90 mx-auto mb-8 max-w-xl text-lg">
          Set up takes about two minutes. The 14-day trial gives you full access to every paid
          feature. No credit card.
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/register-society">
            <Button size="lg" variant="secondary" className="w-full sm:w-auto">
              Start free trial
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
          <Link href="/contact">
            <Button
              size="lg"
              variant="outline"
              className="w-full border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white sm:w-auto"
            >
              Talk to sales
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
