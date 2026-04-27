import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

interface FeatureModuleSectionProps {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  bullets: readonly string[];
  icon: React.ElementType;
  align?: "left" | "right";
  accent: string;
}

export function FeatureModuleSection({
  id,
  eyebrow,
  title,
  description,
  bullets,
  icon: Icon,
  align = "left",
  accent,
}: FeatureModuleSectionProps) {
  const textCol = (
    <div>
      <p className="text-primary mb-3 text-sm font-semibold tracking-wide uppercase">{eyebrow}</p>
      <h2 className="mb-4 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
      <p className="text-muted-foreground mb-6 text-base leading-relaxed">{description}</p>
      <ul className="space-y-2.5">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2 text-sm">
            <Check className="text-primary mt-0.5 h-4 w-4 shrink-0" />
            <span className="text-foreground/85">{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  const visualCol = (
    <div
      className={cn(
        "from-primary/15 to-chart-2/15 relative aspect-[4/3] overflow-hidden rounded-2xl border bg-gradient-to-br p-8",
      )}
    >
      <div
        className={cn(
          "absolute top-1/2 left-1/2 inline-flex h-24 w-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg",
          accent,
        )}
      >
        <Icon className="h-12 w-12 text-white" />
      </div>
      <div
        aria-hidden="true"
        className="absolute -top-8 -right-8 h-32 w-32 rounded-full bg-white/30 blur-2xl"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/20 blur-2xl"
      />
    </div>
  );

  return (
    <section id={id} className="scroll-mt-20 py-16">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-14">
        {align === "left" ? (
          <>
            {textCol}
            {visualCol}
          </>
        ) : (
          <>
            <div className="lg:order-2">{textCol}</div>
            <div className="lg:order-1">{visualCol}</div>
          </>
        )}
      </div>
    </section>
  );
}
