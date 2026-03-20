import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSendMail = vi.fn().mockResolvedValue({});
vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      sendMail: mockSendMail,
    })),
  },
}));

describe("email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  describe("isEmailConfigured", () => {
    it("returns false when SMTP not configured", async () => {
      vi.stubEnv("SMTP_HOST", "");
      vi.stubEnv("SMTP_USER", "");
      vi.stubEnv("SMTP_PASS", "");
      // Re-import to test with new env
      const { isEmailConfigured } = await import("@/lib/email");
      expect(isEmailConfigured()).toBe(false);
    });

    it("returns true when SMTP configured", async () => {
      vi.stubEnv("SMTP_HOST", "smtp.gmail.com");
      vi.stubEnv("SMTP_USER", "test@gmail.com");
      vi.stubEnv("SMTP_PASS", "password123");
      const { isEmailConfigured } = await import("@/lib/email");
      expect(isEmailConfigured()).toBe(true);
    });
  });

  describe("sendEmail", () => {
    it("skips when not configured", async () => {
      vi.stubEnv("SMTP_HOST", "");
      vi.stubEnv("SMTP_USER", "");
      vi.stubEnv("SMTP_PASS", "");
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      const { sendEmail } = await import("@/lib/email");
      await sendEmail("test@example.com", "Test", "<p>Test</p>");
      expect(mockSendMail).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("sends email when configured", async () => {
      vi.stubEnv("SMTP_HOST", "smtp.gmail.com");
      vi.stubEnv("SMTP_USER", "test@gmail.com");
      vi.stubEnv("SMTP_PASS", "password123");
      vi.stubEnv("SMTP_FROM", "noreply@test.com");
      const { sendEmail } = await import("@/lib/email");
      await sendEmail("recipient@example.com", "Subject", "<p>Body</p>");
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "recipient@example.com",
          subject: "Subject",
          html: "<p>Body</p>",
        }),
      );
    });

    it("reuses cached transporter when config unchanged", async () => {
      vi.stubEnv("SMTP_HOST", "smtp.cached.com");
      vi.stubEnv("SMTP_USER", "cached@example.com");
      vi.stubEnv("SMTP_PASS", "cachedpass");
      const { sendEmail } = await import("@/lib/email");
      // First call creates the transporter
      await sendEmail("a@example.com", "First", "<p>1</p>");
      // Second call with same config reuses the cached transporter (false branch of if (!transporter || ...))
      await sendEmail("b@example.com", "Second", "<p>2</p>");
      expect(mockSendMail).toHaveBeenCalledTimes(2);
    });

    it("uses SMTP_USER as from address when SMTP_FROM is not set", async () => {
      vi.stubEnv("SMTP_HOST", "smtp.nofrom.com");
      vi.stubEnv("SMTP_USER", "nofrom@example.com");
      vi.stubEnv("SMTP_PASS", "pass");
      // SMTP_FROM intentionally not set — should fall back to SMTP_USER
      const { sendEmail } = await import("@/lib/email");
      await sendEmail("to@example.com", "Hi", "<p>Hi</p>");
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({ from: "nofrom@example.com" }),
      );
    });
  });
});
