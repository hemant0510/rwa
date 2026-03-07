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
  });
});
