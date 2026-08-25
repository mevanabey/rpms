import type { MailMessage } from "@/core/services/mailer";
import type { Money } from "@/core/types";
import { formatCurrency, formatDate } from "@/lib/utils";

/**
 * Lease-onboarding email templates — the three sends in the Draft → Active
 * pipeline (SPEC §7, lease-progress stepper Step 2 and Step 3).
 *
 * Pure functions: context in, `MailMessage` out. No DB, no transport, no
 * `server-only` — so they can be rendered in a test or previewed without a
 * mailbox (CLAUDE.md §3).
 *
 * NOTE ON STYLING: this is the one place the no-hardcoded-tokens rule
 * (CLAUDE.md §4) cannot apply. Email clients strip <style> blocks and know
 * nothing about Tailwind or CSS custom properties, so every rule has to be
 * inline and literal. Keep the palette in `PALETTE` below rather than
 * scattering hex values through the markup.
 */

export type LeaseEmailKind = "lawyer" | "advisor" | "accounts";

export interface LeaseEmailContext {
  kind: LeaseEmailKind;
  /** Short human reference, e.g. "Lucky Seven — Level 4". */
  leaseRef: string;
  propertyName: string;
  unitLabels: string[];
  lessorName: string;
  lesseeName: string;
  startDate: string;
  endDate: string;
  monthlyRent?: Money;
  securityDeposit?: Money;
  /** Absolute URL back to the lease in RPMS. */
  leaseUrl: string;
  /** Who pressed the button — becomes the Reply-To. */
  sender: { name: string; email?: string };
  /** True when the generated agreement is attached to this message. */
  hasAgreement: boolean;
}

const PALETTE = {
  text: "#0f172a",
  muted: "#64748b",
  border: "#e2e8f0",
  accent: "#0f766e",
} as const;

const COPY: Record<
  LeaseEmailKind,
  { subject: (ref: string) => string; lead: string; ask: string }
> = {
  lawyer: {
    subject: (ref) => `For legal review — lease agreement, ${ref}`,
    lead: "The draft lease agreement below is ready for your legal review.",
    ask: "Please review the attached agreement and confirm whether it is fit for execution, or return it with your amendments.",
  },
  advisor: {
    subject: (ref) => `For approval — lease agreement, ${ref}`,
    lead: "The draft lease agreement below has been prepared and is ready for your approval.",
    ask: "Please review the terms and reply with your approval so we can move this to accounts.",
  },
  accounts: {
    subject: (ref) => `Approved for execution — lease agreement, ${ref}`,
    lead: "This lease has been approved by the advisors and is ready for execution.",
    ask: "Please raise the invoice, record the deposit and stamp duty, and proceed with signing.",
  },
};

function money(m: Money | undefined): string {
  if (!m) return "—";
  return formatCurrency(m.amount, { currency: m.currency, noDecimals: true });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function facts(ctx: LeaseEmailContext): [string, string][] {
  const rows: [string, string][] = [
    ["Property", ctx.propertyName],
    ["Unit(s)", ctx.unitLabels.length ? ctx.unitLabels.join(", ") : "—"],
    ["Lessor", ctx.lessorName],
    ["Lessee", ctx.lesseeName],
    ["Term", `${formatDate(ctx.startDate)} → ${formatDate(ctx.endDate)}`],
  ];
  if (ctx.monthlyRent) rows.push(["Monthly rent", money(ctx.monthlyRent)]);
  if (ctx.securityDeposit) rows.push(["Security deposit", money(ctx.securityDeposit)]);
  return rows;
}

function renderText(ctx: LeaseEmailContext): string {
  const copy = COPY[ctx.kind];
  const width = Math.max(...facts(ctx).map(([k]) => k.length));
  return [
    copy.lead,
    "",
    ...facts(ctx).map(([k, v]) => `  ${k.padEnd(width)}  ${v}`),
    "",
    ctx.hasAgreement
      ? "The lease agreement is attached to this email."
      : "The lease agreement has not been generated yet.",
    "",
    copy.ask,
    "",
    `View in RPMS: ${ctx.leaseUrl}`,
    "",
    "—",
    `Sent by ${ctx.sender.name} via RPMS, Capital Trust Properties.`,
  ].join("\n");
}

function renderHtml(ctx: LeaseEmailContext): string {
  const copy = COPY[ctx.kind];
  const rows = facts(ctx)
    .map(
      ([k, v]) =>
        `<tr>` +
        `<td style="padding:6px 16px 6px 0;color:${PALETTE.muted};font-size:13px;white-space:nowrap">${escapeHtml(k)}</td>` +
        `<td style="padding:6px 0;color:${PALETTE.text};font-size:13px;font-weight:500">${escapeHtml(v)}</td>` +
        `</tr>`,
    )
    .join("");

  return [
    `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:${PALETTE.text};max-width:560px">`,
    `<p style="font-size:14px;line-height:1.6;margin:0 0 20px">${escapeHtml(copy.lead)}</p>`,
    `<table style="border-collapse:collapse;border-top:1px solid ${PALETTE.border};border-bottom:1px solid ${PALETTE.border};margin:0 0 20px;width:100%">${rows}</table>`,
    ctx.hasAgreement
      ? `<p style="font-size:13px;color:${PALETTE.muted};margin:0 0 20px">The lease agreement is attached to this email.</p>`
      : `<p style="font-size:13px;color:${PALETTE.muted};margin:0 0 20px">The lease agreement has not been generated yet.</p>`,
    `<p style="font-size:14px;line-height:1.6;margin:0 0 20px">${escapeHtml(copy.ask)}</p>`,
    `<p style="margin:0 0 24px"><a href="${escapeHtml(ctx.leaseUrl)}" style="color:${PALETTE.accent};font-size:14px">View this lease in RPMS →</a></p>`,
    `<p style="font-size:12px;color:${PALETTE.muted};border-top:1px solid ${PALETTE.border};padding-top:12px;margin:0">Sent by ${escapeHtml(ctx.sender.name)} via RPMS, Capital Trust Properties.</p>`,
    `</div>`,
  ].join("");
}

/** Build the message body. The caller attaches the agreement and sets `to`. */
export function buildLeaseEmail(
  ctx: LeaseEmailContext,
): Pick<MailMessage, "subject" | "text" | "html" | "replyTo"> {
  return {
    subject: COPY[ctx.kind].subject(ctx.leaseRef),
    text: renderText(ctx),
    html: renderHtml(ctx),
    replyTo: ctx.sender.email
      ? { email: ctx.sender.email, name: ctx.sender.name }
      : undefined,
  };
}
