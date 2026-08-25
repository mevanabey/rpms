import "server-only";

import nodemailer, { type Transporter } from "nodemailer";

import type { IMailer, MailAddress, MailMessage, MailResult } from "@/core/services/mailer";

import { getFromAddress, getMailConfig } from "./config";

function format(a: MailAddress): string {
  return a.name ? `${a.name} <${a.email}>` : a.email;
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;
  const { host, port, secure, user, password } = getMailConfig();
  // getMailConfig() already rejects smtp-without-credentials; this narrows the
  // optional types and keeps the failure legible if that ever regresses.
  if (!user || !password) {
    throw new Error("SMTP transport selected without SMTP_USER / SMTP_PASSWORD.");
  }
  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass: password },
    // Turbify throttles aggressively on parallel connections; one pooled
    // connection reused across sends keeps us well inside their limits.
    pool: true,
    maxConnections: 1,
    maxMessages: 50,
  });
  return transporter;
}

/**
 * Turbify Business Email transport (smtp.bizmail.yahoo.com:465, implicit TLS).
 * Authentication requires a Turbify **app password** — the mailbox login
 * password is rejected with `535 5.7.0 (#AUTH005)`.
 */
export const smtpMailer: IMailer = {
  async send(message: MailMessage): Promise<MailResult> {
    const from = getFromAddress();
    try {
      const info = await getTransporter().sendMail({
        from: format(from),
        to: message.to.map(format),
        cc: message.cc?.map(format),
        replyTo: message.replyTo ? format(message.replyTo) : undefined,
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments: message.attachments?.map((a) => ({
          filename: a.filename,
          content: Buffer.from(a.content),
          contentType: a.contentType,
        })),
      });
      return {
        messageId: info.messageId,
        accepted: info.accepted.map(addressOf),
        rejected: info.rejected.map(addressOf),
        redirected: false,
      };
    } catch (e) {
      throw new Error(`SMTP send failed: ${describe(e)}`);
    }
  },

  async verify(): Promise<void> {
    try {
      await getTransporter().verify();
    } catch (e) {
      throw new Error(`SMTP verification failed: ${describe(e)}`);
    }
  },
};

/**
 * nodemailer reports accepted/rejected entries as either a bare address or an
 * `{ address, name }` object. `String(entry)` on the object form yields
 * "[object Object]", which would surface in the operator's toast as the
 * address the email reached.
 */
function addressOf(entry: string | { address: string }): string {
  return typeof entry === "string" ? entry : entry.address;
}

/**
 * Turn nodemailer's provider errors into something an operator can act on.
 * `#AUTH005` is Turbify's catch-all for a rejected credential — its literal
 * text ("Too many bad auth attempts") misleads people into waiting out a
 * lockout that isn't happening.
 */
function describe(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("AUTH005") || msg.includes("535")) {
    return `${msg} — the Turbify app password looks wrong or revoked. Regenerate it under Account info → Security & Privacy → Manage App Passwords.`;
  }
  if (msg.includes("ETIMEDOUT") || msg.includes("ECONNREFUSED")) {
    return `${msg} — could not reach the SMTP host. Check network egress on port 465.`;
  }
  return msg;
}
