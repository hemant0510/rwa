"use client";

import { useContext, createContext } from "react";

import type { Society } from "@/types/society";

interface SocietyContextValue {
  society: Society | null;
  isLoading: boolean;
}

export const SocietyContext = createContext<SocietyContextValue>({
  society: null,
  isLoading: true,
});

export function useSociety() {
  const context = useContext(SocietyContext);
  if (!context) {
    throw new Error("useSociety must be used within a SocietyProvider");
  }
  return context;
}
