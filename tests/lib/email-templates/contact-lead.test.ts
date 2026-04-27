import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  getLeadAutoReplyEmailHtml,
  getLeadOperatorEmailHtml,
} from "@/lib/email-templates/contact-lead";
import type { LeadInput } from "@/lib/validations/lead";

const ORIGINAL_ENV = { ...process.env };

const baseLead: LeadInput = {
  name: "Arjun Kapoor",
  email: "arjun@example.com",
  phone: "+91 98765 43210",
  societyName: "Greenwood Residency",
  unitCount: "120",
  message: "Looking for a demo",
  honeypot: "",
};

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("getLeadOperatorEmailHtml", () => {
  it("includes the lead name and society in the heading and rows", () => {
    const html = getLeadOperatorEmailHtml(baseLead);
    expect(html).toContain("New lead from RWA Connect");
    expect(html).toContain("Arjun Kapoor");
    expect(html).toContain("Greenwood Residency");
    expect(html).toContain("120");
    expect(html).toContain("Looking for a demo");
  });

  it("renders mailto link for email and tel link for phone", () => {
    const html = getLeadOperatorEmailHtml(baseLead);
    expect(html).toContain('href="mailto:arjun@example.com"');
    expect(html).toContain('href="tel:+91 98765 43210"');
  });

  it("omits optional rows when not provided", () => {
    const html = getLeadOperatorEmailHtml({
      name: "Solo",
      email: "solo@example.com",
      phone: "9999999999",
    });
    expect(html).toContain("Solo");
    expect(html).not.toContain("Society");
    expect(html).not.toContain("Units");
    expect(html).not.toContain("Message");
  });

  it("escapes HTML in user-supplied fields", () => {
    const html = getLeadOperatorEmailHtml({
      ...baseLead,
      name: "<script>x</script>",
      message: "<b>bold</b>",
    });
    expect(html).not.toContain("<script>x</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;b&gt;bold&lt;/b&gt;");
  });

  it("includes preheader summary when society is provided", () => {
    const html = getLeadOperatorEmailHtml(baseLead);
    expect(html).toContain("Arjun Kapoor — Greenwood Residency");
  });
});

describe("getLeadAutoReplyEmailHtml — link environments", () => {
  it("uses APP_URL (default localhost) for the marketing links when no env override", async () => {
    delete process.env.APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    vi.resetModules();
    const mod = await import("@/lib/email-templates/contact-lead");
    const html = mod.getLeadAutoReplyEmailHtml(baseLead);
    expect(html).toContain('href="http://localhost:3000/features"');
    expect(html).toContain('href="http://localhost:3000/pricing"');
    expect(html).toContain('href="http://localhost:3000/security"');
  });

  it("uses APP_URL from env when set (production host)", async () => {
    process.env.APP_URL = "https://rwaconnect.in";
    vi.resetModules();
    const mod = await import("@/lib/email-templates/contact-lead");
    const html = mod.getLeadAutoReplyEmailHtml(baseLead);
    expect(html).toContain('href="https://rwaconnect.in/features"');
    expect(html).toContain('href="https://rwaconnect.in/pricing"');
    expect(html).toContain('href="https://rwaconnect.in/security"');
  });

  it("falls back to NEXT_PUBLIC_APP_URL when APP_URL is unset", async () => {
    delete process.env.APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://staging.rwaconnect.in";
    vi.resetModules();
    const mod = await import("@/lib/email-templates/contact-lead");
    const html = mod.getLeadAutoReplyEmailHtml(baseLead);
    expect(html).toContain('href="https://staging.rwaconnect.in/features"');
  });
});

describe("getLeadAutoReplyEmailHtml — content", () => {
  it("greets by first name", () => {
    const html = getLeadAutoReplyEmailHtml(baseLead);
    expect(html).toContain("Thanks, Arjun!");
  });

  it("falls back to 'there' when name has no whitespace token", () => {
    const html = getLeadAutoReplyEmailHtml({ ...baseLead, name: " " });
    expect(html).toContain("Thanks, there!");
  });

  it("contains the next-steps callout copy", () => {
    const html = getLeadAutoReplyEmailHtml(baseLead);
    expect(html).toContain("What happens next");
    expect(html).toContain("review your note");
  });

  it("renders the three resource bullets with safe-link copy", () => {
    const html = getLeadAutoReplyEmailHtml(baseLead);
    expect(html).toContain("Browse the full feature list");
    expect(html).toContain("See pricing");
    expect(html).toContain("Read our security overview");
  });
});
