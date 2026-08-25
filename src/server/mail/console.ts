import "server-only";

import type { IMailer, MailMessage, MailResult } from "@/core/services/mailer";

/**
 * Sends nothing; logs what *would* have gone out. The default transport so a
 * fresh checkout, a CI run, or a misconfigured environment can never email a
 * real lawyer or tenant. Opt in to real delivery with MAIL_TRANSPORT=smtp.
 */
export const consoleMailer: IMailer = {
  async send(message: MailMessage): Promise<MailResult> {
    const to = message.to.map((a) => a.email);
    console.info(
      [
        "[mail:console] not sent — MAIL_TRANSPORT=console",
        `  to:       ${to.join(", ")}`,
        message.cc?.length ? `  cc:       ${message.cc.map((a) => a.email).join(", ")}` : null,
        `  subject:  ${message.subject}`,
        message.attachments?.length
          ? `  attached: ${message.attachments.map((a) => a.filename).join(", ")}`
          : null,
        message.text
          .split("\n")
          .map((l) => `  | ${l}`)
          .join("\n"),
      ]
        .filter(Boolean)
        .join("\n"),
    );
    return {
      messageId: `console-${to.join(",")}`,
      accepted: to,
      rejected: [],
      redirected: false,
    };
  },

  async verify(): Promise<void> {
    // Nothing to verify — the console transport is always available.
  },
};
