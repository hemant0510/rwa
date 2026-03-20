import React from "react";

import { renderHook } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { SocietyContext, useSociety } from "@/hooks/useSociety";

describe("useSociety", () => {
  it("returns context value when inside provider", () => {
    const mockSociety = {
      id: "soc-1",
      name: "Eden Estate",
      societyCode: "EDEN",
    };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <SocietyContext.Provider value={{ society: mockSociety as never, isLoading: false }}>
        {children}
      </SocietyContext.Provider>
    );

    const { result } = renderHook(() => useSociety(), { wrapper });
    expect(result.current.society?.name).toBe("Eden Estate");
    expect(result.current.isLoading).toBe(false);
  });

  it("returns default context values", () => {
    const { result } = renderHook(() => useSociety());
    expect(result.current.society).toBeNull();
    expect(result.current.isLoading).toBe(true);
  });

  it("context.isLoading starts as true in default context", () => {
    const { result } = renderHook(() => useSociety());
    expect(result.current.isLoading).toBe(true);
    expect(result.current.society).toBeNull();
  });
});
