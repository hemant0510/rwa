"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { normalizeRegNumber } from "@/lib/utils/vehicle-utils";

type InputProps = React.ComponentProps<typeof Input>;

export interface RegistrationNumberInputProps extends Omit<InputProps, "onChange" | "value"> {
  value?: string;
  onChange?: (value: string) => void;
  onBlurValue?: (value: string) => void;
}

/**
 * Auto-uppercases input and strips spaces/hyphens on blur to produce
 * the canonical normalised registration number (e.g. DL3CAB1234).
 */
export const RegistrationNumberInput = React.forwardRef<
  HTMLInputElement,
  RegistrationNumberInputProps
>(function RegistrationNumberInput(
  { value = "", onChange, onBlurValue, onBlur, placeholder, ...rest },
  ref,
) {
  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value.toUpperCase();
    onChange?.(next);
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    const normalised = normalizeRegNumber(e.target.value);
    if (normalised !== e.target.value) {
      onChange?.(normalised);
    }
    onBlurValue?.(normalised);
    onBlur?.(e);
  }

  return (
    <Input
      ref={ref}
      value={value}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder ?? "DL 3C AB 1234"}
      autoCapitalize="characters"
      spellCheck={false}
      {...rest}
    />
  );
});
