import "server-only";

import { z } from "zod";

/**
 * Mail configuration, validated once at first use. Everything is read from
 * the environment — no hardcoded hosts or credentials (CLAUDE.md §6: no
 * environment-dependent branching outside config).
 */
const mailEnvSchema = z
  .object({
    SMTP_HOST: z.string().min(1).default("smtp.bizmail.yahoo.com"),
    SMTP_PORT: z.coerce.number().int().positive().default(465),
    SMTP_SECURE: z
      .enum(["true", "false"])
      .default("true")
      .transform((v) => v === "true"),
    SMTP_USER: z.email().optional(),
    SMTP_PASSWORD: z.string().min(1).optional(),
    MAIL_FROM_NAME: z.string().min(1).default("Capital Trust Properties"),
    MAIL_TRANSPORT: z.enum(["smtp", "console"]).default("console"),
    MAIL_REDIRECT_TO: z
      .string()
      .transform((v) => v.trim())
      .pipe(z.union([z.literal(""), z.email()]))
      .optional(),
  })
  .transform((env) => ({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    user: env.SMTP_USER,
    // Turbify displays app passwords in groups of four; the spaces are
    // presentational and are not part of the secret.
    password: env.SMTP_PASSWORD?.replace(/\s+/g, ""),
    fromName: env.MAIL_FROM_NAME,
    transport: env.MAIL_TRANSPORT,
    redirectTo: env.MAIL_REDIRECT_TO || undefined,
  }));

export type MailConfig = z.infer<typeof mailEnvSchema>;

let cached: MailConfig | null = null;

export function getMailConfig(): MailConfig {
  if (cached) return cached;

  const parsed = mailEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid mail configuration — ${detail}`);
  }

  const config = parsed.data;
  if (config.transport === "smtp" && (!config.user || !config.password)) {
    throw new Error(
      "MAIL_TRANSPORT=smtp requires SMTP_USER and SMTP_PASSWORD. " +
        "SMTP_PASSWORD must be a Turbify app password, not the mailbox login password.",
    );
  }

  cached = config;
  return config;
}

/** The address every outbound message is sent from. */
export function getFromAddress(): { email: string; name: string } {
  const { user, fromName } = getMailConfig();
  if (!user) {
    throw new Error("SMTP_USER is not configured — cannot build a From address.");
  }
  return { email: user, name: fromName };
}
