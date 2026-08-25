import "server-only";

import type { IMailer, MailMessage, MailResult } from "@/core/services/mailer";

import { getMailConfig } from "./config";
import { consoleMailer } from "./console";
import { smtpMailer } from "./smtp";

/**
 * Rewrites a message so it lands in the redirect mailbox instead of the real
 * recipients, preserving who it *would* have gone to. This is the guard that
 * makes it safe to exercise the lease-onboarding flow against production data
 * — party rows hold real lawyers' and advisors' addresses, and a stray click
 * on "Send To Lawyer" in staging would otherwise reach them.
 */
function redirect(message: MailMessage, to: string): MailMessage {
  const intended = [
    `To:  ${message.to.map((a) => a.email).join(", ")}`,
    message.cc?.length ? `Cc:  ${message.cc.map((a) => a.email).join(", ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const banner =
    `[REDIRECTED — this email was not delivered to its real recipients]\n${intended}\n` +
    `${"─".repeat(60)}\n\n`;

  return {
    ...message,
    to: [{ email: to }],
    cc: undefined,
    subject: `[REDIRECTED] ${message.subject}`,
    text: banner + message.text,
    html: message.html
      ? `<pre style="font:12px/1.5 monospace;color:#b45309">${escapeHtml(banner)}</pre>${message.html}`
      : undefined,
  };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

let cached: IMailer | null = null;

/**
 * Resolves the active mail transport. Server actions call this; presentational
 * components never do (CLAUDE.md §3). Mirrors `getBackend()` in
 * `src/server/container.ts` — transport is an env flip, not a code change.
 */
export function getMailer(): IMailer {
  if (cached) return cached;

  const config = getMailConfig();
  const base = config.transport === "smtp" ? smtpMailer : consoleMailer;

  cached = {
    async send(message: MailMessage): Promise<MailResult> {
      if (!config.redirectTo) return base.send(message);
      const result = await base.send(redirect(message, config.redirectTo));
      return { ...result, redirected: true };
    },
    verify: () => base.verify(),
  };
  return cached;
}

export type { IMailer, MailMessage, MailResult } from "@/core/services/mailer";
