"use client";

import { useState } from "react";

import { Eye } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface DirectorySettingsCardProps {
  showInDirectory: boolean;
  showPhoneInDirectory: boolean;
  onChange: (next: { showInDirectory: boolean; showPhoneInDirectory: boolean }) => void;
  pending?: boolean;
}

export function DirectorySettingsCard({
  showInDirectory,
  showPhoneInDirectory,
  onChange,
  pending = false,
}: DirectorySettingsCardProps) {
  const [localShow, setLocalShow] = useState(showInDirectory);
  const [localPhone, setLocalPhone] = useState(showPhoneInDirectory);

  function handleDirectoryToggle(next: boolean) {
    setLocalShow(next);
    // Cascade: when directory goes OFF, phone must also go OFF.
    const nextPhone = next ? localPhone : false;
    setLocalPhone(nextPhone);
    onChange({ showInDirectory: next, showPhoneInDirectory: nextPhone });
  }

  function handlePhoneToggle(next: boolean) {
    setLocalPhone(next);
    onChange({ showInDirectory: localShow, showPhoneInDirectory: next });
  }

  const phoneDisabled = !localShow || pending;

  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-lg">
            <Eye className="text-primary h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-base">Directory Settings</CardTitle>
            <p className="text-xs text-slate-500">Control whether other residents can find you</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between gap-3 rounded-md border p-3">
          <div>
            <Label htmlFor="dir-show" className="cursor-pointer">
              Show me in the directory
            </Label>
            <p className="text-muted-foreground mt-0.5 text-xs">
              When off, your name is hidden from other residents.
            </p>
          </div>
          <Switch
            id="dir-show"
            checked={localShow}
            onCheckedChange={handleDirectoryToggle}
            disabled={pending}
          />
        </div>

        <div className="flex items-center justify-between gap-3 rounded-md border p-3">
          <div>
            <Label htmlFor="dir-phone" className="cursor-pointer">
              Show my phone number
            </Label>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {localShow
                ? "Allow residents to see your number in the directory."
                : "Turn directory on to enable phone visibility."}
            </p>
          </div>
          <Switch
            id="dir-phone"
            checked={localPhone}
            onCheckedChange={handlePhoneToggle}
            disabled={phoneDisabled}
          />
        </div>
      </CardContent>
    </Card>
  );
}
