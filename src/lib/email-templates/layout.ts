// Shared email layout — every transactional email in RWA Connect uses this shell.
// Brand: teal gradient header (matches marketing site), Navara Tech footer attribution.
// Email-client safe: tables for layout, inline styles, no external CSS, no flexbox/grid.

import { APP_NAME, APP_URL } from "@/lib/constants";

const BRAND_GRADIENT = "linear-gradient(135deg,#0d9488 0%,#1B6B45 100%)";
const BRAND_GRADIENT_FALLBACK = "#0d9488";
const BRAND_PRIMARY = "#0d9488";
const BRAND_DARK = "#0f3a2c";
const TEXT_PRIMARY = "#111827";
const TEXT_SECONDARY = "#52525b";
const TEXT_MUTED = "#71717a";
const TEXT_FAINT = "#a1a1aa";
const SURFACE_PAGE = "#f4f4f5";
const SURFACE_CARD = "#ffffff";
const SURFACE_FOOTER = "#f9fafb";
const BORDER = "#e4e4e7";
const FONT_STACK = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface EmailLayoutOptions {
  /** Used as <title> + the inbox-preview preheader text. Keep ≤120 chars. */
  preheader: string;
  /** Inner body HTML — built with the helpers below or freeform. */
  body: string;
  /** Optional eyebrow shown above the wordmark in the header (e.g., "Counsellor Program"). */
  eyebrow?: string;
}

export function emailLayout({ preheader, body, eyebrow }: EmailLayoutOptions): string {
  const year = new Date().getFullYear();
  const eyebrowHtml = eyebrow
    ? `<div style="margin:0 0 6px;color:rgba(255,255,255,0.85);font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;">${escapeHtml(eyebrow)}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="x-apple-disable-message-reformatting">
  <title>${escapeHtml(preheader)}</title>
</head>
<body style="margin:0;padding:0;background-color:${SURFACE_PAGE};font-family:${FONT_STACK};color:${TEXT_PRIMARY};">
  <!-- Preheader (hidden, shows up in inbox preview) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${SURFACE_PAGE};">
    ${escapeHtml(preheader)}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${SURFACE_PAGE};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:${SURFACE_CARD};border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06),0 1px 2px rgba(0,0,0,0.04);">

          <!-- HEADER (teal gradient with logo mark + wordmark) -->
          <tr>
            <td style="background-color:${BRAND_GRADIENT_FALLBACK};background-image:${BRAND_GRADIENT};padding:28px 32px;">
              ${eyebrowHtml}
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="vertical-align:middle;padding-right:12px;">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="background-color:rgba(255,255,255,0.18);border-radius:8px;padding:8px 9px;line-height:0;">
                          ${buildingIconSvg("#ffffff")}
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td style="vertical-align:middle;">
                    <div style="color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.02em;line-height:1;">${escapeHtml(APP_NAME)}</div>
                    <div style="color:rgba(255,255,255,0.85);font-size:12px;margin-top:3px;">The OS for Indian housing societies</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- BODY -->
          <tr>
            <td style="padding:32px;color:${TEXT_PRIMARY};">
              ${body}
            </td>
          </tr>

          <!-- FOOTER -->
          <tr>
            <td style="background-color:${SURFACE_FOOTER};padding:20px 32px;border-top:1px solid ${BORDER};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <p style="margin:0 0 4px;color:${TEXT_SECONDARY};font-size:12px;font-weight:600;">
                      ${escapeHtml(APP_NAME)} &mdash; a product by
                      <a href="https://navaratech.in" target="_blank" style="color:${BRAND_PRIMARY};text-decoration:none;">Navara Tech</a>
                    </p>
                    <p style="margin:0;color:${TEXT_FAINT};font-size:11px;">
                      Empowering communities. Elevating lives. &middot; &copy; ${year}
                    </p>
                  </td>
                  <td align="right" style="vertical-align:top;">
                    <a href="${escapeHtml(APP_URL)}" target="_blank" style="color:${TEXT_FAINT};font-size:11px;text-decoration:none;">${escapeHtml(stripProtocol(APP_URL))}</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function stripProtocol(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

function buildingIconSvg(color: string): string {
  // Mirrors the Building2 lucide icon used by Logo in the marketing site (24x24)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>`;
}

// ── Composable building blocks ───────────────────────────────────────────────

export function emailHeading(text: string): string {
  return `<h1 style="margin:0 0 12px;color:${BRAND_DARK};font-size:22px;font-weight:700;line-height:1.3;letter-spacing:-0.01em;">${escapeHtml(text)}</h1>`;
}

export function emailGreeting(name: string): string {
  return `<p style="margin:0 0 16px;color:${TEXT_PRIMARY};font-size:15px;line-height:1.6;">Hi ${escapeHtml(name)},</p>`;
}

/** Paragraph — pass already-escaped HTML if you need links/bold inside. */
export function emailParagraph(html: string): string {
  return `<p style="margin:0 0 16px;color:${TEXT_SECONDARY};font-size:14px;line-height:1.7;">${html}</p>`;
}

export function emailButton({ href, label }: { href: string; label: string }): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
    <tr>
      <td style="background-color:${BRAND_PRIMARY};background-image:${BRAND_GRADIENT};border-radius:10px;">
        <a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;line-height:1;">
          ${escapeHtml(label)}
        </a>
      </td>
    </tr>
  </table>`;
}

export function emailFallbackLink({ href, hint }: { href: string; hint?: string }): string {
  const hintLine =
    hint ?? "If the button doesn't work, copy and paste this link into your browser:";
  return `<p style="margin:0;color:${TEXT_FAINT};font-size:12px;line-height:1.6;">
    ${escapeHtml(hintLine)}<br>
    <a href="${escapeHtml(href)}" style="color:${BRAND_PRIMARY};word-break:break-all;text-decoration:underline;">${escapeHtml(href)}</a>
  </p>`;
}

export function emailDivider(): string {
  return `<hr style="border:none;border-top:1px solid ${BORDER};margin:24px 0;">`;
}

export function emailMutedNote(text: string): string {
  return `<p style="margin:0 0 16px;color:${TEXT_MUTED};font-size:13px;line-height:1.6;">${escapeHtml(text)}</p>`;
}

/** Two-column info table — labels left, values right. Values may include HTML. */
export function emailInfoTable(rows: { label: string; value: string }[]): string {
  if (rows.length === 0) return "";
  const inner = rows
    .map(
      (r, i) => `<tr>
      <td style="padding:10px 12px;color:${TEXT_MUTED};font-size:13px;width:130px;vertical-align:top;${i > 0 ? `border-top:1px solid ${BORDER};` : ""}">${escapeHtml(r.label)}</td>
      <td style="padding:10px 12px;color:${TEXT_PRIMARY};font-size:14px;font-weight:500;vertical-align:top;white-space:pre-wrap;${i > 0 ? `border-top:1px solid ${BORDER};` : ""}">${r.value}</td>
    </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f9fafb;border:1px solid ${BORDER};border-radius:10px;margin:8px 0 20px;">
    ${inner}
  </table>`;
}

export function emailUnorderedList(items: string[]): string {
  if (items.length === 0) return "";
  const li = items
    .map(
      (item) =>
        `<li style="margin:0 0 8px;color:${TEXT_SECONDARY};font-size:14px;line-height:1.6;">${item}</li>`,
    )
    .join("");
  return `<ul style="margin:0 0 20px;padding-left:20px;">${li}</ul>`;
}

/** Highlighted callout box with optional accent color. */
export function emailCallout(html: string, tone: "info" | "success" | "warning" = "info"): string {
  const palette = {
    info: { bg: "#ecfeff", border: "#a5f3fc", text: "#0e7490" },
    success: { bg: "#ecfdf5", border: "#a7f3d0", text: "#047857" },
    warning: { bg: "#fffbeb", border: "#fde68a", text: "#92400e" },
  }[tone];
  return `<div style="margin:0 0 20px;padding:14px 16px;background-color:${palette.bg};border:1px solid ${palette.border};border-radius:10px;color:${palette.text};font-size:13px;line-height:1.6;">
    ${html}
  </div>`;
}

export function emailLink(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" target="_blank" style="color:${BRAND_PRIMARY};text-decoration:underline;">${escapeHtml(label)}</a>`;
}
