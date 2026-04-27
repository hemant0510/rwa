"use client";

import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { leadSchema, type LeadInput } from "@/lib/validations/lead";

export function LeadForm() {
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<LeadInput>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      societyName: "",
      message: "",
      honeypot: "",
    },
  });

  const onSubmit = async (values: LeadInput) => {
    try {
      const res = await fetch("/api/v1/public/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        toast.error("Could not submit — please try again or email us directly.");
        return;
      }
      toast.success("Thanks! We'll be in touch within 24 hours.");
      setSubmitted(true);
      form.reset();
    } catch {
      toast.error("Network error — please try again or email us directly.");
    }
  };

  if (submitted) {
    return (
      <div className="bg-primary/5 border-primary/20 rounded-2xl border p-10 text-center">
        <CheckCircle2 className="text-primary mx-auto mb-4 h-12 w-12" />
        <h3 className="text-foreground mb-2 text-xl font-bold">Message received</h3>
        <p className="text-muted-foreground mb-6 text-sm">
          Someone from our team will reach out within 24 hours. In the meantime, check out our{" "}
          <a href="/features" className="text-primary underline">
            features
          </a>{" "}
          or{" "}
          <a href="/pricing" className="text-primary underline">
            pricing
          </a>
          .
        </p>
        <Button variant="outline" onClick={() => setSubmitted(false)}>
          Send another
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">
            Name <span className="text-destructive">*</span>
          </Label>
          <Input id="name" {...form.register("name")} placeholder="Arjun Kapoor" />
          {form.formState.errors.name ? (
            <p className="text-destructive text-xs">{form.formState.errors.name.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">
            Email <span className="text-destructive">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            {...form.register("email")}
            placeholder="you@example.com"
          />
          {form.formState.errors.email ? (
            <p className="text-destructive text-xs">{form.formState.errors.email.message}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone">
            Phone <span className="text-destructive">*</span>
          </Label>
          <Input id="phone" {...form.register("phone")} placeholder="+91 98765 43210" />
          {form.formState.errors.phone ? (
            <p className="text-destructive text-xs">{form.formState.errors.phone.message}</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="societyName">Society name</Label>
          <Input
            id="societyName"
            {...form.register("societyName")}
            placeholder="Greenwood Residency, Sec 15"
          />
          {form.formState.errors.societyName ? (
            <p className="text-destructive text-xs">{form.formState.errors.societyName.message}</p>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="unitCount">Number of units</Label>
        <Input id="unitCount" {...form.register("unitCount")} placeholder="120" />
        {form.formState.errors.unitCount ? (
          <p className="text-destructive text-xs">{form.formState.errors.unitCount.message}</p>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="message">How can we help?</Label>
        <Textarea
          id="message"
          rows={4}
          {...form.register("message")}
          placeholder="Tell us about your society and what you're looking for…"
        />
      </div>

      {/* Honeypot — hidden from humans, bots fill it */}
      <input
        type="text"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
        {...form.register("honeypot")}
      />

      <Button type="submit" size="lg" className="w-full" disabled={form.formState.isSubmitting}>
        {form.formState.isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending…
          </>
        ) : (
          "Send message"
        )}
      </Button>

      <p className="text-muted-foreground text-center text-xs">
        We typically respond within a few hours during business days.
      </p>
    </form>
  );
}
