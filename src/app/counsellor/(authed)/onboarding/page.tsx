"use client";

import { useState } from "react";

import { useRouter } from "next/navigation";

import { CheckCircle2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

const COC_BULLETS = [
  "Maintain neutrality between residents and RWA Admins.",
  "Use society and resident data only for case advisory — never share externally.",
  "Disclose any conflict of interest before acting on a society's case.",
  "Treat all communications as confidential.",
  "Respond to escalations within the platform SLA (72 hours).",
];

export default function CounsellorOnboardingPage() {
  const router = useRouter();
  const [accepted, setAccepted] = useState(false);

  function handleContinue() {
    router.push("/counsellor");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-6">
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <Sparkles className="h-6 w-6 text-emerald-600" />
          </div>
          <CardTitle className="text-2xl">Welcome to RWA Connect</CardTitle>
          <CardDescription>
            Your account is set up. Please review the code of conduct before continuing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3 rounded-md border bg-zinc-50 p-4">
            <h3 className="text-sm font-semibold">Counsellor Code of Conduct</h3>
            <ul className="space-y-2 text-sm text-zinc-700">
              {COC_BULLETS.map((b) => (
                <li key={b} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={accepted}
              onCheckedChange={(v) => setAccepted(v === true)}
              aria-label="Accept code of conduct"
            />
            <span>I have read and agree to abide by the Counsellor Code of Conduct.</span>
          </label>

          <Button className="w-full" disabled={!accepted} onClick={handleContinue}>
            Continue to Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
