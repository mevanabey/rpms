/**
 * Outbound-email PORT. Pure types only — no transport, no IO, no framework
 * imports (CLAUDE.md §6). Adapters live in `src/server/mail/`:
 *
 *   smtp    → Turbify Business Email (Capital Trust's ctp@capitaltrust.lk)
 *   console → logs and sends nothing (local dev / CI)
 *
 * Swapping to Resend for bulk tenant reminders later is a new adapter behind
 * this same interface, not a rewrite of the callers.
 */

export interface MailAddress {
  email: string;
  /** Display name — rendered as `Name <email>`. */
  name?: string;
}

export interface MailAttachment {
  filename: string;
  content: Uint8Array;
  contentType: string;
}

export interface MailMessage {
  to: MailAddress[];
  cc?: MailAddress[];
  replyTo?: MailAddress;
  subject: string;
  /** Plain-text body. Always required — never ship an HTML-only email. */
  text: string;
  html?: string;
  attachments?: MailAttachment[];
}

export interface MailResult {
  /** Provider message id, when the transport reports one. */
  messageId: string;
  /** Addresses the transport actually accepted. */
  accepted: string[];
  rejected: string[];
  /** True when `MAIL_REDIRECT_TO` rerouted this message away from `to`. */
  redirected: boolean;
}

export interface IMailer {
  send(message: MailMessage): Promise<MailResult>;
  /** Authenticate against the transport without sending. */
  verify(): Promise<void>;
}
