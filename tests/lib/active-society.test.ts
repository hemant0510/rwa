import { describe, it, expect, beforeEach } from "vitest";

import {
  getActiveSocietyIdClient,
  setActiveSocietyId,
  clearActiveSocietyId,
} from "@/lib/active-society";

describe("active-society (client)", () => {
  beforeEach(() => {
    // Clear all cookies
    document.cookie.split(";").forEach((c) => {
      const name = c.trim().split("=")[0];
      document.cookie = `${name}=; max-age=0`;
    });
  });

  describe("getActiveSocietyIdClient", () => {
    it("returns null when no cookie is set", () => {
      expect(getActiveSocietyIdClient()).toBeNull();
    });

    it("returns null when document is undefined (SSR environment)", () => {
      const origDocument = global.document;
      // @ts-expect-error — simulate SSR where document is not defined
      delete global.document;
      expect(getActiveSocietyIdClient()).toBeNull();
      global.document = origDocument;
    });

    it("returns society ID when cookie is set", () => {
      document.cookie = "active-society-id=soc-123; path=/";
      expect(getActiveSocietyIdClient()).toBe("soc-123");
    });

    it("returns correct value when multiple cookies exist", () => {
      document.cookie = "other-cookie=value; path=/";
      document.cookie = "active-society-id=soc-456; path=/";
      expect(getActiveSocietyIdClient()).toBe("soc-456");
    });
  });

  describe("setActiveSocietyId", () => {
    it("sets the cookie", () => {
      setActiveSocietyId("soc-789");
      expect(getActiveSocietyIdClient()).toBe("soc-789");
    });

    it("overwrites previous value", () => {
      setActiveSocietyId("soc-111");
      setActiveSocietyId("soc-222");
      expect(getActiveSocietyIdClient()).toBe("soc-222");
    });
  });

  describe("clearActiveSocietyId", () => {
    it("removes the cookie", () => {
      setActiveSocietyId("soc-123");
      expect(getActiveSocietyIdClient()).toBe("soc-123");

      clearActiveSocietyId();
      expect(getActiveSocietyIdClient()).toBeNull();
    });

    it("does nothing when no cookie exists", () => {
      clearActiveSocietyId();
      expect(getActiveSocietyIdClient()).toBeNull();
    });
  });
});
