"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

interface Step {
  number: number;
  title: string;
  status: "completed" | "active" | "pending";
}

interface FormStepperProps {
  steps: Step[];
}

export function FormStepper({ steps }: FormStepperProps) {
  return (
    <div className="flex items-center justify-between">
      {steps.map((step, index) => (
        <div key={step.number} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium",
                step.status === "completed" && "border-primary bg-primary text-primary-foreground",
                step.status === "active" && "border-primary text-primary",
                step.status === "pending" && "border-muted-foreground/30 text-muted-foreground",
              )}
            >
              {step.status === "completed" ? <Check className="h-4 w-4" /> : step.number}
            </div>
            <span
              className={cn(
                "mt-1 text-xs",
                step.status === "active" ? "text-primary font-medium" : "text-muted-foreground",
              )}
            >
              {step.title}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={cn(
                "mx-2 h-0.5 w-12 sm:w-20",
                step.status === "completed" ? "bg-primary" : "bg-muted-foreground/30",
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
