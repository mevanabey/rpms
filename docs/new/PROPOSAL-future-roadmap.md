# RPMS — Future Roadmap & Capability Proposal

**Prepared for:** Capital Trust Holdings Limited (and group entities — Capital Trust Properties One, Capital Trust Residencies, Tech City Lanka, Capital BPO, Colombo BPO)
**Prepared by:** Algocity
**Status:** Proposal v1.0 — 2026-06-18

---

## 0. Executive summary

This document is the **menu of everything Capital Trust can do on this platform** — feature-by-feature parity with global RPMS leaders (AppFolio, Yardi, Buildium, DoorLoop, Propertyware, Hemlane, TenantCloud), plus a layer of AI and Sri Lanka-specific capability that no off-the-shelf product can ship.

It is organised in 14 capability domains, each with: *what existing systems do today, what we will do, why ours is better, and what it unlocks for Capital Trust*.

> **Important framing — V1 is deliberately lean.** The MVP we are building right now ships as a **clean, manual operator surface — no automations, no AI, no bank integration, no autonomy banners, no activity feed, no workflow runtime visible.** That is by design. We pulled the original full-platform vision back to a focused surface so Capital Trust validates one piece at a time. Everything in this proposal is the **roadmap from that lean MVP outward** — each capability gets unhidden, built, or wired up only as the prior piece is proven in production.

---

## 1. What ships in V1 (the lean MVP — what Capital Trust sees on day one)

The shipping surface is intentionally narrow. The client should not feel a half-built omnibus — they should feel a clean tool that does five things well, with the rest revealed as they ask for it.

| Surface | What it does in V1 | What is **explicitly not in V1** |
|---|---|---|
| **Dashboard** | KPI cards (active leases, parties, buildings, overdue) + a single leases table. | No live activity feed, no autonomy banners, no "next 14 days" panel. |
| **Properties** | List of buildings + detail page. | No units page, no parties directory, no documents vault. |
| **Leases** | Lease list, lease detail (parties, schedule, units, rent schedule, recent ledger), new-lease wizard. | No documents tab, no draft-lease decision queue. |
| **Rent** | One page showing every rent ledger line bucketed *Overdue / Due in 14 days / Upcoming / Paid*. Per row: **Mark paid** (after the user has manually verified the bank credit) + **Send reminder**. | No bank-reconciliation inbox, no commissions, no automated rent-collection cycle, no reminder queue, no auto-debit. |
| **Admin** (admin role only) | Import, Templates, Workflow registry, Users, Access (RBAC matrix). | Workflow registry is a static list — nothing is *running*. |

**Three roles only** in V1: `admin`, `account_manager`, `lawyer` (lease-scoped). Legacy roles (handler, accountant, viewer, introducer) and their resource grants are turned off.

**No automation runs.** Every reconciliation, every reminder, every status change happens because a human clicked a button. The platform records what they did. That is the entire V1 product.

This matters for the proposal: **the foundations described in §2 below are architected for everything in §3–§14**, but in V1 they are deliberately not surfaced. Each later phase is a sidebar edit + a backend wire-up away from being live.

---

## 2. The architectural foundation (what makes everything below additive, not a rewrite)

These are the design choices already in the codebase. They are the reason a tenant portal, a bank reconciler, or an AI agent can be added later as a *slot*, not a rebuild.

| Foundation | Built today | What it unlocks |
|---|---|---|
| **Typed domain model** | ✅ in mock backend — every Lucky Seven clause is a typed field | Any future workflow, report, or AI step queries one canonical shape |
| **Ports-and-adapters backend** | ✅ — UI calls `getBackend()`, adapter swaps via env var | Phase 2 swaps mock → Drizzle/Neon with zero UI rewrite |
| **Vercel Workflows + AgentFabriq port path** | 🟡 designed, no handlers running yet | Idempotent typed workflow handlers can be added one at a time |
| **Multi-entity tenancy** | 🟡 designed in types; not yet enforced via Postgres RLS | Per-entity rollups, per-entity branding, group-level reporting |
| **RBAC with lease-scoped roles** | ✅ MVP surface uses it (5 enforcement layers ready, RLS pending) | Lawyer / accountant / introducer / landlord portals are role flips, not rebuilds |
| **Autonomy ladder + activity feed** | 🟡 designed in SPEC §18–§20; hidden in V1 | Every future workflow shows up with its autonomy level + audit trail with no per-feature wiring |
| **Document templating** | 🟡 designed; templates folder reserved | Lease, invoice, receipt, notice, bank-draft request — all the same pipeline |
| **Theme-token UI** | ✅ enforced project-wide | White-label per entity = adding a `brand` object, not a rewrite |

Legend: ✅ live in MVP · 🟡 designed and reserved, not yet built/wired

> **Why this matters for the proposal:** every capability in §3–§14 is a delta on top of foundations that already exist. We are not selling a rebuild between phases — we are selling an unhide + a wire-up.

---

## 3. Feature parity with established RPMS players

The global market is dominated by **AppFolio**, **Buildium**, **Yardi Voyager**, **DoorLoop**, **Propertyware**, **Rentec Direct**, **Hemlane**, **TenantCloud**, **Avail**, **Innago**, **Re-Leased**, and **MRI Software**. The table below is the table-stakes feature list — what any serious RPMS must ship. RPMS already covers the rows marked ✅; the rest are scoped in this proposal.

| Capability | V1 MVP | Planned phase | Notes |
|---|---|---|---|
| Property & unit register with photos, amenities, floor plans | ✅ buildings only; units deferred | P2 polish + P3 | Add gallery, virtual tour embed |
| Tenant / party directory + KYC | Parties exist in model; no UI in V1 | P3 + P7 KYC API | NIC OCR + sanctions screen |
| Lease lifecycle (draft → active → renewal → terminated) | ✅ basic (create + view) | P2 | Full anchor table from Lucky Seven; renewal workflow later |
| Document vault with version history | Deferred (model-ready) | P2 e-sign | DropboxSign / DocuSign webhook resume |
| Rent roll, arrears, escalation, cashflow reports | ✅ rent bucketed view only | P6 BI | Pivotable, exportable, scheduled email |
| Online rent payment (cards, bank transfer, wallets) | — | **P3** | PayHere + Direct Pay + Stripe |
| Recurring auto-debit / standing order | — | **P3** | LankaPay CEFTS + Visa Account Updater |
| Late fee automation | Configured in lease anchor; not applied automatically in V1 | P3 | Tenant pays late fee after manual operator post |
| Bank reconciliation (auto-match credits to invoices) | — | **P4** | See §7 — inbound email + bank API |
| Maintenance ticketing + vendor assignment | Deferred | **P3** | See §9 |
| Vendor / contractor marketplace | — | **P10** | Vetted plumbers, electricians, cleaners |
| Property inspections (move-in / move-out / periodic) | — | **P5** | Photo + checklist + condition score |
| Tenant screening (credit, criminal, eviction) | — | **P7** | Sri Lanka adaptation — CRIB + employer + ref check |
| E-sign on lease (legally binding) | — | **P2** | DropboxSign default, DocuSign optional |
| Owner / landlord portal | — | **P6** | See §6 |
| Tenant portal (web + mobile) | — | **P3** | See §5 |
| Accounting (GL, journal entries, financial statements) | — | **P5** | See §8 |
| Tax (Sri Lanka: VAT, WHT, Stamp Duty) | Anchor fields modelled; nothing computed | **P5** | Auto VAT invoice + WHT reconciliation |
| Bank deposits & trust accounting | — | **P5** | Required for security deposits |
| Renters insurance integration | — | **P10** | Bundled at lease signing |
| Listing syndication (Zillow / Realtor / portals) | — | **P9** | LankaPropertyWeb, ikman, Lamudi, House.lk |
| Lead capture + automated tour scheduling | — | **P9** | AI tour booking agent |
| Marketing site builder per property | — | **P9** | Auto-generated landing page per building |
| Communications hub (email, SMS, WhatsApp) | Manual *Send reminder* button only in V1 — no real send | **P3** | Resend + Twilio + WhatsApp Business |
| Mobile app for operators | — | **P6** | React Native + offline sync |
| Calendar integrations (Google, Outlook) | — | **P4** | Inspections, court dates, viewings |
| Workflow automations / "if-this-then-that" builder | Architected but **no automations run in V1** | **P5 UI** | Workflow runtime + visual builder both later |
| Reporting dashboards (BI) | — | **P6** | See §12 |
| Audit log / activity stream | Deferred from V1 (model-ready) | **P3** | Every workflow event surfaces |
| Multi-currency | ✅ LKR / USD in lease anchor | — | BPO subleases USD-denominated |
| Multi-entity (group of companies) | ✅ in types; UI is single-entity in V1 | **P2** | Entity switcher placeholder shipped |
| API / webhooks for integrations | — | **P5** | OpenAPI + Zapier app |

**Net:** by end of Phase 6 we are at *feature parity with AppFolio plus the items they don't even attempt* (multi-entity group accounting, lawyer-scoped lease access, Sri Lanka tax compliance, lease-clause-driven obligation engine).

---

## 4. The asymmetric advantage — what off-the-shelf RPMS cannot do

Before listing the new capabilities, this is the strategic frame. **AppFolio, Yardi, Buildium were built for the US single-family / multifamily landlord.** They have:

- No concept of a *head lease + sublease spread* (Capital Trust's core business).
- No multi-entity ownership graph (just "portfolio = list of properties").
- No Sri Lanka tax (Stamp Duty 2%, VAT 15%, WHT, IRD e-invoicing).
- No notarised contract workflow.
- No bilingual operations (English + Sinhala / Tamil for tenants).
- No LKR/USD multi-currency rent with FX-rate-of-the-day capture.
- No BPO-aware compliance (operating-licence renewal, BOI status, foreign-exchange reporting).
- No introducer commission ledger.
- No "the system runs itself, asks only when it must" autonomy model.

Every one of those is a hard constraint for Capital Trust and a moat for this platform. **RPMS is not catching up to AppFolio; AppFolio cannot catch up to RPMS in Capital Trust's market.**

---

## 5. Tenant-facing portal (mobile + web)

### Today
Tenants get a WhatsApp from a handler or an email from the workbook's mail-merge. No self-service.

### The product

A single tenant-facing surface — responsive web + native mobile (iOS + Android via React Native) — that becomes the tenant's only touchpoint with Capital Trust.

**Account & onboarding**
- One-tap login via WhatsApp OTP (Sri Lanka primary) or email magic link.
- View their lease, rent schedule, deposit, escalations — surfaced from the same typed lease model the operators use.
- Profile (NIC photo, employer, emergency contact, dependants) — kept fresh by the system asking once a year.

**Pay rent**
- One-tap pay via PayHere (Visa/Master/Amex), Direct Pay (LankaPay), JustPay (LankaPay CEFTS), FriMi, Genie, eZ Cash, mCash. USD payments via Stripe or Wise.
- Auto-debit setup with bank mandate — saves the tenant clicking every month.
- "Pay rent + utility together" — single charge, split internally.
- Receipt auto-issued (PDF + email + portal copy + WhatsApp PDF).
- Partial payment support for hardship cases (with a flag to operations).

**Bills & ledger**
- See every charge ever billed and every payment ever credited, exactly matching the operator's ledger.
- Overdue items with running late-fee meter (per Lucky Seven clause §6(k): Rs. 25,000/day after 7-day delay) shown live.
- Annual statement download (for tax filings).
- VAT invoice download when applicable.

**Maintenance requests**
- Submit a ticket with photo + video + voice note.
- AI classifier auto-tags (plumbing / electrical / AC / structural / cosmetic) and routes to the right vendor pool.
- Live status: Submitted → Assigned to vendor → Scheduled (with date) → Resolved → Awaiting your sign-off.
- Tenant rates the work; rating feeds vendor scorecard.
- Emergency-button workflow (gas leak, flood, fire) — immediate escalation to building manager + on-call vendor.

**Documents**
- Signed lease, addenda, deposit receipt, every monthly invoice, inspection reports.
- "Letter of accommodation" / "Rent confirmation letter" — self-service download for visa, loan, school admission (a common ask, today handled manually).

**Renewals & moves**
- 90 days before lease end: portal shows "Renew" / "Don't renew" / "I want a different unit".
- AI suggests the renewal terms (escalation per lease formula, comparable market rents).
- Move-out checklist: notify date, schedule inspection, deposit-return ETA.

**Notices & inbox**
- All notices from Capital Trust in one inbox: rent reminders, building circulars, maintenance windows, AGM minutes, policy changes.
- WhatsApp + email + push — tenant picks channels.

**Refer-a-tenant**
- Tenant gets a referral code; if redeemed, they get one month's rent off or LKR equivalent. Feeds the introducer ledger.

**Roommate / co-tenant management**
- For shared units, each occupant has their own profile and split-rent share. Disputes have an audit trail.

### Why this matters for Capital Trust
- **Reduces handler load by ~70%** on routine queries (when's my rent due, what's my deposit balance, can I get a letter).
- **Cuts AR days** — auto-debit + one-tap pay materially shifts payment timing.
- **Builds the data layer** for tenant scoring, retention modelling, churn prediction.
- **A defensible brand surface** — tenants in Trizen / Capitol experience "Capital Trust" not "an Excel sheet a guy named Stephen runs".

---

## 6. Landlord / lessor portal

For external landlords (Y.S.H. Sunil Malcom Silva of Lucky Seven, and similar lessors on other commercial head leases), a read-mostly surface that shows them their lease is being well-run.

- Their head lease at a glance (rent tranche schedule, next escalation date, lock-in remaining).
- Payment history (every rent payment Capital Trust made to them, with bank reference).
- Compliance status (VAT invoices issued, late fees, repair reimbursements claimed).
- Document vault (the signed lease + any addenda).
- Direct-message channel to their account manager.
- TDS / WHT certificates downloadable (eliminates phone tag at tax time).

Optional white-label so a landlord with a portfolio (e.g., the Alfred series owners) can use it as their own mini-property-manager view.

---

## 7. Bank & payment integrations

This is the single highest-ROI capability and the largest pain point in the legacy operation.

### 7.1 Inbound bank reconciliation

**Today:** A handler sees a Sampath / HNB / Commercial Bank credit-advice email, opens the Excel, finds the row, ticks a checkbox. ~300 rows × 4 cadences = thousands of manual matches per year.

**Planned:**
- Resend Inbound (or SendGrid Parse) receives the bank email at a dedicated address (`bank-advices@capitaltrust.app`).
- An AgentFabriq agent parses the email body + PDF advice (LLM with vision), extracts `{date, amount, currency, narration, account_last4}`.
- The system matches against open `ledger_entry` rows on `(amount ± tolerance, narration ⊂ tenant_alias, due_date proximity)`.
- High-confidence match (≥95%) → auto-reconcile, push to activity feed.
- Medium confidence (60–95%) → queue in Bank Inbox for one-click confirm.
- Low confidence → escalate to handler with the candidate matches ranked.
- Promotes itself: a handler's repeated confirms train the matcher; after N successful auto-matches on a tenant, that tenant moves to full-auto.

**Open Banking API path (forward-leaning)**
- Sri Lanka's open-banking landscape is nascent but moving (LankaClear's JustPay, CEFTS, and the upcoming Open Banking framework under CBSL's PaymentEx programme).
- Where available, RPMS reads transactions directly from Capital Trust's operating accounts (Sampath Pay Direct API, HNB Solo, Commercial Bank ComBank+, NDB Bank API) — no email parsing needed.
- For accounts without an API, we'll support **screen-scraping via tenant-supplied read-only credentials in a hosted browser** (the pattern Plaid / Yodlee used for years) — never store passwords, only refresh tokens.
- International: Wise API for USD inbound from BPO clients; Stripe for card payments.

### 7.2 Outbound payments (paying landlords, vendors, refunds)

**Today:** Bank drafts and cheques typed by hand, walked to the bank, photographed for proof.

**Planned:**
- LankaPay CEFTS bulk payment file generation for monthly landlord disbursements — one click, all 30+ lessors paid same day.
- SLIPS for low-priority recurring (vendor retainers).
- Per-bank API where available (Sampath, HNB, COMBANK, NDB).
- Two-eyes approval baked in — accountant prepares, account manager approves, only then released.
- WHT (Withholding Tax) auto-deducted, separate journal entry, e-filed to IRD.

### 7.3 Stamp duty & legal fees

- The current pain (Rs. 17,582,688 stamp duty + Rs. 4,395,672 legal fees on Lucky Seven) is paid via bank draft.
- We generate the bank-draft request as a DOCX, e-mail it to the issuing bank, and reconcile the draft serial back into the lease's compliance log.
- IRD's Online Stamp Duty Service (where supported) is API-callable for tax types it accepts.

### 7.4 Foreign exchange capture

- Every USD payment from BPO clients (Trizen / Capitol / CTR at $1,250–1,500/mo) captures both the USD invoiced amount *and* the LKR realised amount with the bank's day-rate.
- FX gain/loss line item per lease, per quarter — currently invisible in the workbook.
- BOI reporting (foreign earnings) auto-prepared.

---

## 8. Accounting, financial & tax integrations

The system should not replace the accountant's general ledger — it should *feed* it, accurately, automatically.

**Integrations**
- **QuickBooks Online** — push journal entries; pull chart of accounts.
- **Xero** — same, with the Sri Lanka edition's WHT + VAT mappings.
- **Tally** (the de-facto SL standard for CA firms) — Tally Connector via XML export + scheduled import.
- **SAP Business One** — for the day Capital Trust grows past Tally.
- **Zoho Books** — Zoho is widely used in Colombo CA practice.

**Native finance**
- Trust accounting for security deposits (regulated handling).
- Tenant ledger, owner ledger, vendor ledger — independent and reconcilable.
- Aged receivables and payables.
- VAT register (15%) — auto-generated, ready for monthly IRD filing.
- WHT register (5% / 14% / 8% depending on payee) — auto-deducted on outbound, monthly e-filing prep.
- Stamp duty register — every lease, every addendum, every amendment.
- BIR / Annual Income Tax pre-calc by entity.

**E-invoicing**
- Sri Lanka's IRD is moving toward mandatory e-invoicing — when the API ships, we issue compliant invoices direct from the platform.
- Tenant gets the e-invoice in their portal, on WhatsApp, by email — same file, same hash, same legal status.

---

## 9. Maintenance, vendor & building operations

### Maintenance ticketing (Phase 3)
- Tenant submits with photo / video / voice (see §4).
- AI triage routes to the right vendor pool by category + building + urgency.
- Vendor app: accept job, propose time, mark complete, upload photo, get rated.
- SLA tracking per vendor; chronic underperformers auto-deprioritised.
- Spend cap enforcement (Lucky Seven §4(m): Rs. 75,000 per job per floor — auto-flag if exceeded).
- Reimbursement workflow with landlord (when landlord is responsible) — invoice generated, sent, tracked.

### Vendor marketplace (Phase 9)
- Vetted vendor directory: plumbers, electricians, AC technicians, carpenters, cleaners, pest control, security, gardeners, painters, glass, locksmiths.
- KYC + insurance verified.
- Rate cards published.
- Two-way ratings; quarterly performance reviews triggered by data.

### Compliance scheduler
- Lucky Seven's recurring obligations — lift service, generator service, fire detection inspection, statue inspection, VAT request — each is an `obligation` row that fires its own workflow on schedule.
- Photo evidence of completion captured, attached to the obligation.
- Lessor receives a quarterly compliance certificate auto-generated.

### Facility management (Phase 10)
- Common-area expenses (Lucky Seven Penthouse: 13 Italian cement statues need annual inspection; building security; landscaping).
- Capex planning (HVAC replacement, lift modernisation) with depreciation calendar.
- Vendor purchase orders, GRNs (goods received notes), three-way match.

### Energy & utilities (Phase 11)
- CEB / LECO bill capture (OCR the monthly bill, ingest meter readings).
- Per-unit sub-metering integration where installed.
- Tenant-side: see your kWh usage trend in the portal.
- Solar PPA management (if Capital Trust ever puts solar on Lucky Seven roof).

### IoT & smart building (Phase 12)
- Smart locks (Igloo, August, Yale-Asia) — guest codes, move-in / move-out codes auto-generated and auto-expired.
- Smart meters via Modbus / MQTT — automatic monthly bill split.
- CCTV (Hikvision / Dahua) — incident clip auto-attached to a maintenance ticket when relevant.
- Access control (T&A turnstiles) for BPO tenants — headcount feeds into capacity reports.

---

## 10. AI — where the platform pulls ahead

Every AI capability below is a workflow step. Each starts at autonomy level 1 (Suggest), graduates to 4 (Full auto) only after enough confirmed runs. Nothing fires without human gatekeeping at first.

### 10.1 Document understanding
- **Lease intake:** drop a scanned PDF (CamScanner style) — the system extracts every clause into the typed lease model. Today handled by a lawyer reading and a handler typing.
- **Bank advice parsing:** §7.1.
- **KYC document OCR:** NIC, passport, utility bill, employer letter — auto-extract, auto-fill, auto-validate.
- **Invoice intake:** any vendor invoice → ledger entry + GL coding suggestion.
- **Cheque/draft photo:** snap a photo, system reads MICR line, books it.

### 10.2 Conversational AI for tenants (Phase 4)
- WhatsApp / portal chatbot trained on Capital Trust's policies, the tenant's own lease, and a curated FAQ.
- Answers: "When is rent due?" "What's my balance?" "How do I report a leak?" "Can I sublet?" "What's my notice period?"
- Escalates to a handler when (a) confidence drops, (b) the user explicitly asks, or (c) the topic is on a hardcoded escalation list (legal, complaint, deposit dispute).
- Multilingual: English, Sinhala, Tamil. The model translates both ways.

### 10.3 Voice operations (Phase 6)
- Capital Trust hotline answered by an AI receptionist (Twilio + ElevenLabs voice synthesis + Claude).
- "I want to pay my rent" → reads balance, takes payment by reading card.
- "I have a leak" → triages, dispatches.
- "I want to speak to Stephen" → transfers if Stephen's free, takes a message if not, books a callback.
- Outbound voice: rent reminder calls in the tenant's preferred language for tenants who don't engage with email/WhatsApp.

### 10.4 Predictive analytics
- **Late-payment risk score** per tenant — drives proactive outreach (a gentle reminder 3 days *before* due if score's elevated).
- **Churn / non-renewal risk** — flags 90 days before renewal so the account manager can intervene.
- **Maintenance prediction** — equipment failure modelling from past tickets (the generator in the basement is overdue for a service based on hours).
- **Market rent estimator** per unit, building, micro-market — drives escalation negotiation.

### 10.5 Smart drafting
- Lease auto-drafted from a checklist — already prototyped via the existing template engine; AI fills the qualitative clauses ("Use restriction: …", "Permitted sublessees: …") based on the deal context.
- Notices (default notice, termination notice, lock-in waiver) auto-drafted with the lawyer reviewing rather than authoring.
- Vendor RFPs and PO terms auto-drafted from a job description.

### 10.6 Anomaly detection
- "This rent payment is 7% off the expected amount — likely a FX-rate slip."
- "This handler is reconciling 3× faster than their team — verify they're not auto-confirming without reading."
- "This vendor invoice is 40% above the median for this job type."
- "This lease draft has clause language that materially deviates from the standard — flag for legal review."

### 10.7 Autonomous lease lifecycle
- The big-picture AI goal: every routine event in a lease's life (rent due → invoice → bank notification → reconcile → receipt → next month) happens with zero human touch on the happy path. Humans see only exceptions.
- The autonomy ladder and the typed obligation engine are *designed for* this; they will be wired into running workflows in Phase 4 onward. (None of this is live in V1.)

### 10.8 AgentFabriq integration
- Long-term: the agentic steps above (document understanding, tenant chatbot, voice ops, drafting) run on AgentFabriq.
- Deterministic steps (rent invoice generation, ledger writes, cron triggers) stay on Vercel Workflows.
- Same handler code, transport swap. The architecture is already designed for it.

---

## 11. Communications & engagement

### Unified comms hub
- One thread per tenant aggregating WhatsApp, email, SMS, voice transcript, portal messages — handler sees the full history regardless of channel.
- Auto-translate on inbound and outbound (English ↔ Sinhala ↔ Tamil).
- AI-suggested replies a handler can send-as-is or edit.
- Template library — every recurring message (rent reminder D-5, D-1, D+1, D+7, D+30) versioned and a/b-tested.

### Channels
- WhatsApp Business API (the primary channel in Sri Lanka).
- Twilio SMS for fallback.
- Resend for transactional + react-email templates.
- Push notifications for mobile app.
- In-app inbox.

### Mass communications
- Bulk notices to a building (planned water cut on Saturday).
- Bulk notices to all tenants in an entity (new policy).
- Bulk notices to specific cohorts (all tenants whose lease renews in Q3).
- Open / read / click tracking; A/B tested over time.

---

## 12. Reporting, BI & investor-grade dashboards

### Operational reports (Phase 5)
- Rent roll (by building / entity / period).
- Arrears ageing (current / 30 / 60 / 90+).
- Escalation pipeline (next 90 / 180 / 365 days of contractual rent increases).
- Cashflow projection (12 months out, with confidence band).
- Vacancy & occupancy rate by building.
- Maintenance backlog & SLA performance.
- Vendor scorecard.
- Handler productivity (tickets closed, reminders sent, reconciliations done).
- Compliance status dashboard (every recurring obligation, traffic-light).

### Investor / board reports (Phase 6)
- Monthly board pack (auto-generated PDF, branded).
- Quarterly investor letter draft.
- NOI, GRM, cap-rate per building.
- Five-year cashflow with stress tests (5% / 10% / 20% rent shock).
- Group-level rollup across all six entities.

### Custom dashboards
- Drag-and-drop dashboard builder powered by the same typed model.
- Saved views per role (handler view, accountant view, CFO view, landlord view).
- Scheduled email delivery.
- Export to PDF / Excel / Google Sheets / API.

### Embedded analytics
- Same charts available embedded in the tenant portal (their own usage / payment history) and landlord portal (their own lease KPIs).

---

## 13. Sri Lanka compliance — the moat no foreign vendor can build

Capital Trust's regulatory surface is non-trivial and largely unautomated in the market today.

- **Stamp Duty** — 2% on lease consideration; bank-draft workflow + IRD register. (Lucky Seven: Rs. 17.58M.)
- **VAT** — 15%; auto-invoice, monthly return prep, input/output reconciliation.
- **Withholding Tax** — auto-deducted on outbound rent to landlords; certificates issued; monthly e-filing prep.
- **BOI status** — for Tech City Lanka / Capital BPO operations; foreign-exchange earnings reporting.
- **Foreign Exchange Act** — USD inbound, LKR conversion at bank rate, monthly CBSL report.
- **Inland Revenue e-Filing** — IRD's e-services API where available.
- **Companies Registry** — auto-prepared annual returns for each group entity.
- **Notary public workflow** — every commercial lease must be notary-attested; the system tracks notary assignment (Sulochana Manamperi on Lucky Seven), schedules the signing, archives the attested copy.
- **CRIB credit check** — for tenant screening (where consented).
- **PDPA (Personal Data Protection Act 2022)** — consent capture, data-subject-access-request workflow, right-to-erasure flow.
- **Data residency** — Sri Lanka-hosted Postgres option (Neon EU + replicated read replica in Singapore today; on-prem option available).
- **Bilingual contracts** — every standard contract template available in English + Sinhala (Tamil where requested).

---

## 14. Adjacent revenue surfaces

Capabilities that turn RPMS from a cost centre into a revenue driver for Capital Trust.

### 14.1 Listings & lead generation (Phase 9)
- Sync vacancies to LankaPropertyWeb, ikman, Lamudi, House.lk, Saleme.
- Auto-generated property landing page per unit, with photos, floor plan, virtual tour, neighbourhood data.
- Inbound enquiries land in a CRM-lite pipeline (lead → tour booked → application → screened → leased).
- AI tour-booking agent — handles WhatsApp enquiries, qualifies the lead, books on Google Calendar, sends confirmation, sends reminder.

### 14.2 Tenant insurance (Phase 10)
- Embedded renters insurance at lease signing — partner with a local insurer (Ceylinco / Allianz / Janashakthi).
- Capital Trust earns a referral; tenant gets one-tap coverage; handler doesn't chase a certificate.

### 14.3 Move-in / move-out concierge (Phase 10)
- Curated movers, cleaners, utility-connection helpers booked from the portal — commission to Capital Trust.

### 14.4 Tenant rewards & loyalty (Phase 11)
- On-time-payment streaks unlock discounts on partner merchants (groceries, telco top-ups, ride hailing).
- Costs little, materially shifts payment behaviour.

### 14.5 BPO-aware services (Phase 12)
- The BPO tenants (MRL, Tech City Lanka) have unique needs: shift-pattern access control, dedicated parking, 24/7 cleaning, on-site cafeteria contracts. RPMS can become the procurement layer for all of that.

### 14.6 Property investment marketplace (Phase 13)
- Tenants of three years' tenure get pre-vetted access to invest in Capital Trust's next building (fractional, regulated).
- Closes the loop: tenant → loyal customer → investor.

---

## 15. Operator surface — beyond V1

### Mobile app for operators (Phase 6)
- React Native (shares the typed Backend contract with the web).
- Offline-first — a handler at a building with patchy data still ticks the inspection.
- Photo capture pinned to GPS + timestamp for evidence.
- Push notifications for approvals.

### Workflow visual builder (Phase 5)
- The workflow engine is already typed and pluggable. The next slice is a visual editor where a non-developer admin can add a new step ("CC the building manager when a ticket is overdue 48h") without code.

### Public API + Zapier (Phase 5)
- OpenAPI-spec'd, key-auth + scope.
- Zapier app to wire RPMS to whatever ad-hoc tool a partner uses (Trello, Notion, Asana, Pipedrive).
- Webhooks for every domain event.

### White-label per entity (Phase 7)
- The theme tokens already isolate visual style. Add a "brand" object per entity (logo, colours, primary domain) — Capital Trust Residencies and Tech City Lanka can run on their own subdomains with their own look.

### Internal AI copilot for operators (Phase 4)
- A chat sidebar that knows the whole system: "show me all leases expiring in Q4 with no renewal notice sent" — gets back a real result, with a one-click drilldown.
- "Draft a hardship letter to tenant X for the next three months." → drafted, ready to edit.
- "Why is the cashflow projection lower this quarter?" → diagnosed.

---

## 16. Phased roadmap

Each phase delivers user-visible value end-to-end. No phase is a back-end-only sprint.

| Phase | Focus | Duration | Status |
|---|---|---|---|
| **P0 — Architectural foundation** | Domain model, ports/adapters, RBAC scaffolding, theme tokens | Done | ✅ |
| **P1 — Lean MVP (V1, currently shipping)** | Dashboard, Properties, Leases, Rent (manual mark-paid + manual send-reminder), Admin. Three roles. **No automation, no AI, no bank integration, no activity feed, no autonomy banners.** | — | 🟡 In flight |
| **P2 — Real backend wiring** | Drizzle + Neon swap of the mock adapter, Clerk auth, Vercel Blob, multi-entity scoping enforced via RLS, e-sign + DOCX→PDF for leases | 6 weeks | — |
| **P3 — Tenant portal v1 + payments + comms + maintenance + activity feed** | Web portal, WhatsApp OTP, view lease/ledger, PayHere + Direct Pay, real outbound rent reminders via Resend/WhatsApp, tenant-submitted maintenance tickets, live activity feed surfaces in-app | 8 weeks | — |
| **P4 — Bank reconciliation + first AI** | Inbound bank email parsing, AgentFabriq match agent, calendar integrations, conversational AI for tenant FAQ — first workflows fire, autonomy ladder becomes visible | 8 weeks | — |
| **P5 — Accounting + tax + API** | QuickBooks/Xero/Tally connectors, VAT/WHT/Stamp-Duty registers, public API, workflow visual builder, full accounting GL | 10 weeks | — |
| **P6 — Landlord portal + mobile + BI** | Lessor surface, operator mobile app, dashboards & investor reports, AI copilot | 8 weeks | — |
| **P7 — Tenant screening + white-label** | CRIB + employer + reference checks, per-entity white-label, application pipeline | 6 weeks | — |
| **P8 — Compliance hardening** | Full obligation engine across portfolio, PDPA flows, IRD e-filing where available, data residency options | 6 weeks | — |
| **P9 — Marketing & listings** | Syndication, AI tour bookings, lead CRM, marketing site builder | 6 weeks | — |
| **P10 — Marketplace + insurance + concierge** | Vendor marketplace, renters insurance, move-in concierge | 6 weeks | — |
| **P11 — Energy + smart building** | Utility OCR, sub-metering, solar PPA, tenant rewards | 8 weeks | — |
| **P12 — IoT + voice ops** | Smart locks, smart meters, CCTV integration, AI voice receptionist | 8 weeks | — |
| **P13 — Investment marketplace** | Fractional investing surface for long-tenure tenants | 10 weeks | — |

Total to feature-complete + AI-saturated: ~24 months. Each phase ships independently and the system is usable / sellable at every step.

---

## 17. What this becomes when finished

Capital Trust will run on a **single source of truth** for:

- Every property, every unit, every lease, every clause, every party.
- Every rent invoice, every payment, every refund, every late fee, every stamp duty, every VAT, every WHT, every commission.
- Every maintenance ticket, every vendor job, every compliance obligation, every signature.
- Every email, WhatsApp, SMS, voice call exchanged with a tenant or landlord.
- Every operator action, with timestamp, actor, and reason.
- Every AI suggestion, every approval, every override.

Tenants will pay rent in one tap, report leaks in three taps, and never speak to a handler unless they want to. Handlers will spend their time on the 5% of cases that need human judgement — and the system will tell them which cases those are. Accountants will close the books in days, not weeks. Lawyers will draft from templates, not from scratch. Landlords will see their cashflow on a phone. The CEO will have a real-time P&L for every entity, every building, every unit.

The platform becomes Capital Trust's competitive moat — and a product that Capital Trust can sell as a service to other Sri Lankan landlords once it's proven on its own portfolio.

---

## 18. The strategic pitch in one paragraph

You don't have to choose between AppFolio and bespoke. AppFolio is built for someone else's market and cannot legally or operationally handle Sri Lanka. Bespoke historically meant five years and an in-house team. We've collapsed that. V1 is deliberately a lean, manual operator surface — five clean screens, three roles, zero automation by design — so Capital Trust validates one piece at a time without a "kitchen sink" rebuild. Underneath that surface sits a typed, port-and-adapter platform with a workflow runtime ready to be wired up. Every capability in this proposal is an additive slot on that platform — buy each phase as you need it, in priority order, with measurable value at each step. The end state is a system that runs Capital Trust's rental business with materially less human effort, materially higher tenant satisfaction, materially better compliance posture, and a brand surface tenants and landlords actually like using — and which you own, can extend, and can ultimately sell.

---

*Drafted: 2026-06-18. For internal review before client circulation.*
