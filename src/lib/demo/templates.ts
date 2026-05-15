/**
 * Template defaults — authoring-time content for the lease document templates
 * and the notification (email / WhatsApp) templates surfaced on /admin/templates.
 *
 * Phase 02 swaps these for files on disk under src/templates/* (DOCX for leases,
 * react-email components for notifications). For the demo, the defaults below
 * are paired with an in-store `templateOverrides` map so users can edit any
 * template and watch their changes stick.
 */

export type TemplateChannel = "email" | "whatsapp" | "sms" | "letter";
export type TemplateLocale = "en" | "si" | "ta";
export type TemplateGroup = "lease" | "notification";

export interface TemplateVariable {
  key: string;
  label: string;
  /** Sample value used when rendering the Preview tab. */
  sample: string;
}

export interface TemplateDef {
  id: string;
  group: TemplateGroup;
  name: string;
  description: string;
  channels?: TemplateChannel[];
  locales?: TemplateLocale[];
  /** Lease templates: source filename hint shown on the card. */
  file?: string;
  /** For notifications: optional subject line (mustache vars allowed). */
  defaultSubject?: string;
  /** Mustache-style body. {{var.path}} placeholders. */
  defaultBody: string;
  variables: TemplateVariable[];
}

const COMMON_VARS: TemplateVariable[] = [
  { key: "tenant.name", label: "Tenant name", sample: "Ferdy Sugianto" },
  { key: "tenant.email", label: "Tenant email", sample: "ferdy@techcity.lk" },
  { key: "lessee.name", label: "Lessee", sample: "MRL (BPO Client)" },
  { key: "lessor.name", label: "Lessor", sample: "Mr. Upul P." },
  { key: "property.name", label: "Property", sample: "Capitol TwinPeaks · T2 12 B2" },
  { key: "lease.id", label: "Lease id", sample: "lease_cap_t2_12" },
  { key: "rent.amount", label: "Monthly rent", sample: "USD 1,250" },
  { key: "rent.dueDate", label: "Due date", sample: "2026-09-03" },
  { key: "rent.daysLate", label: "Days late", sample: "1" },
  { key: "deposit.amount", label: "Security deposit", sample: "USD 3,750" },
  { key: "handler.name", label: "Handler", sample: "Capital Trust Handler" },
];

export const TEMPLATE_DEFS: TemplateDef[] = [
  // ─────────────────────── Lease document templates ───────────────────────
  {
    id: "tpl_lease_commercial",
    group: "lease",
    name: "Commercial head lease",
    description:
      "Modeled on the signed Lucky Seven indenture (15 pages, 7 schedules). Filled by docxtemplater, converted to PDF via headless LibreOffice, sent to e-sign.",
    file: "src/templates/leases/commercial.docx",
    defaultBody: `INDENTURE OF LEASE

Made on this {{lease.startDate}} between:

LESSOR: {{lessor.name}} ({{lessor.nicOrPassport}}) of {{lessor.address}}
LESSEE: {{lessee.name}} ({{lessee.companyRegNo}}) of {{lessee.address}}

WHEREAS the Lessor is the absolute owner of {{property.name}} bearing
Assessment No. {{property.asstNo}} and more fully described in Schedule 1.

NOW THIS INDENTURE WITNESSETH:

1. TERM. The Lessor hereby leases to the Lessee the said premises for a
   term of {{lease.termYears}} years commencing {{lease.startDate}} and
   expiring {{lease.endDate}}.

2. RENT. The Lessee shall pay rent in tranches as set out in Schedule 2:
{{#each tranches}}
   T{{sequence}}: {{startDate}} → {{endDate}} · {{monthlyRent}} / month
{{/each}}

3. STAMP DUTY. Stamp duty of {{stamp_duty}} (2% of total consideration)
   shall be borne by the Lessee and remitted by bank draft prior to
   notarial attestation.

4. LEGAL FEES. {{legal_fees}} payable to lessor's lawyers by cheque on
   the date of attestation.

5. LOCK-IN. The Lessee shall not terminate prior to {{lease.lockInEnd}}
   except for material breach as defined in Schedule 4.

(continued — schedules, covenants, breach, indemnity, governing law…)`,
    variables: [
      { key: "lessor.name", label: "Lessor name", sample: "Mr. Saroja Kumara" },
      { key: "lessor.nicOrPassport", label: "Lessor NIC", sample: "198030103456" },
      { key: "lessor.address", label: "Lessor address", sample: "12, Galle Road, Colombo 03" },
      { key: "lessee.name", label: "Lessee", sample: "Capital Trust Holdings (Pvt) Ltd" },
      { key: "lessee.companyRegNo", label: "Lessee co. reg", sample: "PV 12345" },
      { key: "lessee.address", label: "Lessee address", sample: "27, Marine Drive, Colombo 04" },
      { key: "property.name", label: "Property", sample: "Lucky Seven, Colombo 03" },
      { key: "property.asstNo", label: "Assessment No.", sample: "47/3" },
      { key: "lease.startDate", label: "Start date", sample: "2026-04-09" },
      { key: "lease.endDate", label: "End date", sample: "2036-04-08" },
      { key: "lease.termYears", label: "Term (years)", sample: "10" },
      { key: "lease.lockInEnd", label: "Lock-in end", sample: "2028-04-08" },
      { key: "stamp_duty", label: "Stamp duty", sample: "Rs. 17,582,688" },
      { key: "legal_fees", label: "Legal fees", sample: "Rs. 879,134" },
    ],
  },
  {
    id: "tpl_lease_bpo",
    group: "lease",
    name: "BPO sublease (1 year, monthly)",
    description:
      "Standard 1-year BPO accommodation contract used for Trizen / Capitol / CTR units. USD-denominated rent, 3-month deposit, lessor + tenant on copy.",
    file: "src/templates/leases/bpo.docx",
    defaultBody: `SUBLEASE AGREEMENT

This Sublease Agreement is made on {{lease.startDate}} between:

  LESSEE / SUBLESSOR: {{lessee.name}}
  TENANT:             {{tenant.name}} ({{tenant.passport}})
  CLIENT:             {{client.name}}

In respect of the premises {{property.name}}.

1. Term: {{lease.startDate}} → {{lease.endDate}} (12 months).
2. Rent: {{rent.amount}} per month, payable on the {{rent.dueDay}} of each month.
3. Deposit: {{deposit.amount}} (refundable subject to Schedule A condition report).
4. Utilities: paid directly by the Tenant unless otherwise agreed.
5. House rules: as per Schedule B; smoking is prohibited in all common areas.
6. Termination: 30 days' written notice; deposit refunded within 14 days
   of move-out and condition reconciliation.

Signed,
{{lessee.name}}                    {{tenant.name}}`,
    variables: [
      { key: "lessee.name", label: "Sublessor", sample: "Capital Trust Residencies (Pvt) Ltd" },
      { key: "tenant.name", label: "Tenant", sample: "Ferdy Sugianto" },
      { key: "tenant.passport", label: "Tenant passport", sample: "P3245678" },
      { key: "client.name", label: "BPO Client", sample: "MRL" },
      { key: "property.name", label: "Property", sample: "Capitol TwinPeaks · T2 12 B2" },
      { key: "lease.startDate", label: "Start date", sample: "2026-09-03" },
      { key: "lease.endDate", label: "End date", sample: "2027-09-02" },
      { key: "rent.amount", label: "Monthly rent", sample: "USD 1,250" },
      { key: "rent.dueDay", label: "Due day", sample: "3" },
      { key: "deposit.amount", label: "Security deposit", sample: "USD 3,750" },
    ],
  },

  // ────────────────────── Notification templates ──────────────────────
  {
    id: "tpl_email_pre_bill",
    group: "notification",
    name: "Rent due — T-7 days",
    description:
      "Friendly heads-up that rent is due in a week. Sent via Resend (email) and Twilio (WhatsApp).",
    channels: ["email", "whatsapp"],
    locales: ["en"],
    defaultSubject: "Rent reminder · {{property.name}} · due {{rent.dueDate}}",
    defaultBody: `Hi {{tenant.name}},

A friendly reminder that rent of {{rent.amount}} for {{property.name}} is due
on {{rent.dueDate}} (in 7 days).

If you've already paid, thank you — please ignore this message.

— {{handler.name}} · Capital Trust`,
    variables: COMMON_VARS,
  },
  {
    id: "tpl_email_due_today",
    group: "notification",
    name: "Rent due — today",
    description: "Day-of reminder. Same channels as the T-7 message.",
    channels: ["email", "whatsapp"],
    locales: ["en"],
    defaultSubject: "Rent due today · {{property.name}}",
    defaultBody: `Hi {{tenant.name}},

This is a reminder that rent of {{rent.amount}} for {{property.name}} is due today.

Bank: Sampath Bank · Account: Capital Trust Holdings · Ref: {{lease.id}}

Reach out to {{handler.name}} if you need anything.`,
    variables: COMMON_VARS,
  },
  {
    id: "tpl_email_late_1d",
    group: "notification",
    name: "Rent late — day 1",
    description: "First gentle nudge after the due date.",
    channels: ["email", "whatsapp"],
    locales: ["en"],
    defaultSubject: "Rent overdue · {{property.name}} · day {{rent.daysLate}}",
    defaultBody: `Hi {{tenant.name}},

Our records show rent of {{rent.amount}} for {{property.name}} hasn't yet been
received (due {{rent.dueDate}}, {{rent.daysLate}} day(s) ago).

If the payment is in transit, no action needed. Otherwise please send it at
your earliest convenience or reply with an ETA.

— {{handler.name}}`,
    variables: COMMON_VARS,
  },
  {
    id: "tpl_email_late_14d",
    group: "notification",
    name: "Rent late — day 14 (handler escalation)",
    description: "Escalation notice with handler CC. Triggers an approval gate before sending.",
    channels: ["email"],
    locales: ["en"],
    defaultSubject: "URGENT · rent overdue 14 days · {{property.name}}",
    defaultBody: `Dear {{tenant.name}},

Rent of {{rent.amount}} for {{property.name}} is now {{rent.daysLate}} days overdue.

Per the lease, late fees may begin to accrue. Please remit immediately or
contact {{handler.name}} to discuss a payment arrangement before further
action is taken.

This message is escalated to our handlers and accountants.

— Capital Trust`,
    variables: COMMON_VARS,
  },
  {
    id: "tpl_email_renewal_open",
    group: "notification",
    name: "Renewal — 12 months out",
    description: "Opens the renewal conversation a year before lease expiry.",
    channels: ["email"],
    locales: ["en"],
    defaultSubject: "Renewal window · {{property.name}}",
    defaultBody: `Hi {{tenant.name}},

Your lease at {{property.name}} expires on {{lease.endDate}}. We'd like to
start the renewal conversation now so there's plenty of time to align on
terms.

Are you interested in renewing? If yes, we'll send draft terms within the
week.

— {{handler.name}}`,
    variables: COMMON_VARS,
  },
  {
    id: "tpl_email_move_out",
    group: "notification",
    name: "Move-out checklist",
    description: "Sent after move-out is confirmed; references condition report.",
    channels: ["email"],
    locales: ["en"],
    defaultSubject: "Move-out checklist · {{property.name}}",
    defaultBody: `Hi {{tenant.name}},

Thanks for your tenancy at {{property.name}}. Here's the move-out checklist:

  • Hand back keys / access cards
  • Final utility readings
  • Walk-through with handler ({{handler.name}})
  • Deposit reconciliation — refund within 14 days

Reply to confirm a slot for the walk-through.

— Capital Trust`,
    variables: COMMON_VARS,
  },
];

export function findTemplate(id: string): TemplateDef | undefined {
  return TEMPLATE_DEFS.find((t) => t.id === id);
}

/**
 * Render a template body by substituting {{var.path}} placeholders. The render
 * is deliberately lightweight (no #each, no conditionals) — production uses
 * docxtemplater / react-email. This is just for the Preview tab.
 */
export function renderTemplate(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, key) => vars[key] ?? `{{${key}}}`);
}

export function sampleVarMap(t: TemplateDef): Record<string, string> {
  return Object.fromEntries(t.variables.map((v) => [v.key, v.sample]));
}
