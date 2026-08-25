# RPMS — Features & Integrations List

A scannable list of every capability on the RPMS roadmap. Companion to `PROPOSAL-future-roadmap.md` (which has the narrative + sales framing).

**Legend:** ✅ live in V1 · 🟡 designed / reserved · ⬜ planned

---

## V1 (lean MVP, shipping now)

- ✅ Dashboard — KPI cards + leases table
- ✅ Properties — list + detail
- ✅ Leases — list, detail, new-lease wizard
- ✅ Rent — bucketed ledger (Overdue / Due in 14d / Upcoming / Paid)
  - ✅ Manual *Mark paid* (after operator verifies bank credit)
  - ✅ Manual *Send reminder* (logged, no real email send)
- ✅ Admin — Import, Templates, Workflows, Users, Access (RBAC matrix)
- ✅ Three roles — admin, account_manager, lawyer (lease-scoped)
- ✅ Theme tokens (light/dark, restyle-ready)
- ✅ Multi-currency in model (LKR / USD)
- ✅ Lucky Seven anchor encoded as typed lease fields

> **Explicitly NOT in V1:** no automation, no AI, no bank integration, no live activity feed, no autonomy banners, no real outbound messaging, no workflows running.

---

## Architectural foundation (built / designed; surfaced later)

- ✅ Typed domain model (Lucky Seven clauses → typed fields)
- ✅ Ports-and-adapters backend (`getBackend()` env-driven)
- ✅ RBAC with 5 enforcement layers (sidebar → page → action → data scope → RLS)
- 🟡 Vercel Workflows runtime + AgentFabriq port path
- 🟡 Multi-entity tenancy (Holdings, Properties One, Residencies, Tech City, Capital BPO, Colombo BPO)
- 🟡 Autonomy ladder (Suggest → Draft → Auto-with-approval → Full auto)
- 🟡 Activity feed + approvals surface
- 🟡 Document templating pipeline (DOCX → mustache → PDF → Blob)

---

## Core RPMS feature parity (table-stakes vs AppFolio / Yardi / Buildium / DoorLoop / Propertyware / Hemlane / TenantCloud)

### Property & lease management
- ⬜ Property gallery, floor plans, virtual tour embed
- ⬜ Units page (occupancy view)
- ⬜ Parties / tenant directory
- ⬜ Documents vault with version history
- ⬜ Move-in / move-out inspections (photo + checklist + condition score)
- ⬜ E-sign on lease (DropboxSign default, DocuSign optional)
- ⬜ Lease renewal workflow + auto-escalation
- ⬜ Lease amendment / addendum management

### Payments & money
- ⬜ Online rent payment (cards, bank transfer, wallets)
- ⬜ Recurring auto-debit / standing order
- ⬜ Late fee automation (Lucky Seven §6(k): Rs. 25,000/day)
- ⬜ Trust accounting for security deposits
- ⬜ Bank deposits & reconciliation
- ⬜ Refund workflow (deposit returns)
- ⬜ Multi-currency rent with FX-rate-of-the-day capture
- ⬜ Partial payment support
- ⬜ Receipt auto-generation (PDF + email + WhatsApp)

### Maintenance
- ⬜ Tenant ticket submission (photo / video / voice)
- ⬜ AI classification & vendor routing
- ⬜ Vendor app — accept / schedule / complete / upload evidence
- ⬜ SLA tracking + vendor scorecard
- ⬜ Spend cap enforcement (Lucky Seven §4(m): Rs. 75,000/job)
- ⬜ Landlord reimbursement workflow

### Reporting
- ⬜ Rent roll (by building / entity / period)
- ⬜ Arrears ageing (current / 30 / 60 / 90+)
- ⬜ Escalation pipeline (next 90 / 180 / 365 days)
- ⬜ Cashflow projection (12 months with confidence band)
- ⬜ Vacancy & occupancy rate
- ⬜ Maintenance backlog & SLA performance
- ⬜ Handler productivity report
- ⬜ Compliance status dashboard

### Operations
- ⬜ Mobile app for operators (React Native, offline-first)
- ⬜ Calendar integrations (Google, Outlook)
- ⬜ Workflow visual builder ("if-this-then-that")
- ⬜ Audit log / activity stream
- ⬜ Public API + webhooks + Zapier
- ⬜ Bulk import / export

---

## Tenant portal (web + mobile)

### Account
- ⬜ WhatsApp OTP login (Sri Lanka primary)
- ⬜ Email magic-link login (fallback)
- ⬜ Profile (NIC, employer, emergency contact, dependants)
- ⬜ Multi-tenant household / roommate split

### Rent & money
- ⬜ One-tap pay — PayHere, Direct Pay, JustPay, FriMi, Genie, eZ Cash, mCash
- ⬜ USD pay — Stripe, Wise
- ⬜ Auto-debit mandate setup
- ⬜ Pay rent + utility in one charge
- ⬜ Live ledger (every charge + payment)
- ⬜ Running late-fee meter
- ⬜ Annual statement download
- ⬜ VAT invoice download
- ⬜ Hardship / partial-payment flow

### Maintenance
- ⬜ Submit ticket with photo / video / voice note
- ⬜ Live status (Submitted → Assigned → Scheduled → Resolved → Sign-off)
- ⬜ Rate the vendor
- ⬜ Emergency escalation button

### Documents
- ⬜ Signed lease + addenda
- ⬜ Every monthly invoice + receipt
- ⬜ Inspection reports
- ⬜ Self-serve letters (rent confirmation, accommodation letter for visa/loan/school)

### Renewals & moves
- ⬜ 90-day renewal prompt
- ⬜ AI-suggested renewal terms
- ⬜ Move-out checklist
- ⬜ Deposit-return ETA

### Comms
- ⬜ Unified inbox (rent reminders, building circulars, AGM minutes, policy)
- ⬜ Channel preferences (WhatsApp / email / SMS / push)
- ⬜ Building-wide / cohort notices

### Engagement
- ⬜ Refer-a-tenant code
- ⬜ Bilingual UI (English / Sinhala / Tamil)

---

## Landlord / lessor portal

- ⬜ Head-lease at-a-glance (tranches, escalations, lock-in remaining)
- ⬜ Payment history (with bank references)
- ⬜ VAT invoices issued
- ⬜ TDS / WHT certificates download
- ⬜ Compliance status (per Lucky Seven recurring obligations)
- ⬜ Direct-message channel to account manager
- ⬜ Document vault (signed lease + addenda)
- ⬜ Optional white-label for multi-property lessors

---

## Bank & payment integrations

### Inbound bank reconciliation
- ⬜ Resend Inbound / SendGrid Parse email ingestion
- ⬜ AgentFabriq parser (LLM + vision on PDF advices)
- ⬜ Auto-match (amount ± tolerance, narration, due-date proximity)
- ⬜ Confidence-tiered routing (auto / queue / escalate)
- ⬜ Self-training matcher (per-tenant promotion to full auto)

### Bank APIs (where available)
- ⬜ Sampath Pay Direct API
- ⬜ HNB Solo API
- ⬜ Commercial Bank ComBank+ API
- ⬜ NDB Bank API
- ⬜ DFCC, BOC, People's Bank (as APIs ship)
- ⬜ Hosted-browser fallback for accounts without APIs

### Open banking / payment rails
- ⬜ LankaPay CEFTS bulk payment file generation
- ⬜ JustPay (LankaPay) auto-debit
- ⬜ SLIPS for low-priority recurring
- ⬜ CBSL Open Banking framework (when live)

### International
- ⬜ Wise API (USD inbound from BPO clients)
- ⬜ Stripe (card payments)
- ⬜ Visa Account Updater (card-on-file refresh)

### Payment gateways
- ⬜ PayHere (Visa / Master / Amex)
- ⬜ Direct Pay (LankaPay)
- ⬜ FriMi, Genie, eZ Cash, mCash
- ⬜ Crypto rails (USDC) — optional

### Outbound
- ⬜ Landlord disbursements (monthly batch)
- ⬜ Vendor payments
- ⬜ Refunds (deposit returns)
- ⬜ Two-eyes approval flow (preparer + approver)
- ⬜ WHT auto-deduction with separate journal entry

### Special workflows
- ⬜ Stamp Duty bank-draft request (DOCX → bank email → reconcile draft serial)
- ⬜ Legal fees cheque issuance & reconciliation
- ⬜ FX gain/loss capture per USD payment

---

## Accounting & tax integrations

### Connectors
- ⬜ QuickBooks Online
- ⬜ Xero (Sri Lanka edition with WHT + VAT mappings)
- ⬜ Tally (XML export / scheduled import)
- ⬜ SAP Business One
- ⬜ Zoho Books

### Native finance
- ⬜ Tenant ledger, owner ledger, vendor ledger
- ⬜ Aged receivables / payables
- ⬜ Trust accounting for deposits
- ⬜ Multi-currency journal entries
- ⬜ Group-level consolidation (across 6 entities)

### Sri Lanka tax
- ⬜ VAT register (15%) — monthly IRD filing prep
- ⬜ WHT register (5% / 14% / 8%) — monthly e-filing prep
- ⬜ Stamp Duty register
- ⬜ BIR / annual income tax pre-calc per entity
- ⬜ IRD e-invoicing (when API ships)
- ⬜ IRD Online Stamp Duty Service integration
- ⬜ BOI status & foreign-earnings reporting
- ⬜ CBSL FX reporting (Foreign Exchange Act)

---

## AI capabilities

### Document understanding
- ⬜ Lease intake — scanned PDF → typed lease model
- ⬜ Bank advice parsing (email + PDF)
- ⬜ KYC OCR — NIC, passport, utility bill, employer letter
- ⬜ Invoice intake — vendor invoice → ledger + GL coding
- ⬜ Cheque / draft MICR reader

### Conversational AI
- ⬜ Tenant WhatsApp / portal chatbot (lease-aware)
- ⬜ Multilingual (English / Sinhala / Tamil)
- ⬜ Confidence-based escalation to handler
- ⬜ Internal AI copilot for operators (natural language → query)

### Voice operations
- ⬜ AI receptionist on Capital Trust hotline (Twilio + ElevenLabs + Claude)
- ⬜ Inbound: pay rent, report leak, leave message, book callback
- ⬜ Outbound: rent reminder calls in tenant's preferred language

### Predictive analytics
- ⬜ Late-payment risk score per tenant
- ⬜ Churn / non-renewal risk
- ⬜ Maintenance-failure prediction (equipment hours-of-use)
- ⬜ Market-rent estimator per unit / micro-market

### Smart drafting
- ⬜ Lease auto-draft from checklist
- ⬜ Notice auto-draft (default, termination, lock-in waiver)
- ⬜ Vendor RFP & PO terms auto-draft

### Anomaly detection
- ⬜ Off-amount payment flagging
- ⬜ Suspicious handler activity (too-fast reconciliations)
- ⬜ Vendor invoice outlier detection
- ⬜ Lease clause deviation flagging

### Autonomous lease lifecycle
- ⬜ Wire all routine events (rent due → invoice → bank notify → reconcile → receipt) into the autonomy ladder
- ⬜ AgentFabriq migration of agentic steps (deterministic steps stay on Vercel Workflows)

---

## Communications

### Channels
- ⬜ WhatsApp Business API (primary)
- ⬜ Twilio SMS
- ⬜ Resend + react-email (transactional)
- ⬜ Mobile push
- ⬜ In-app inbox

### Hub
- ⬜ Unified thread per tenant (WhatsApp + email + SMS + voice + portal)
- ⬜ Auto-translate (English ↔ Sinhala ↔ Tamil)
- ⬜ AI-suggested replies
- ⬜ Templated reminders (D-5, D-1, D+1, D+7, D+30) with versioning + A/B test

### Mass
- ⬜ Building-wide notices
- ⬜ Entity-wide notices
- ⬜ Cohort notices (e.g., all Q3 renewals)
- ⬜ Open / read / click tracking

---

## Compliance (Sri Lanka)

- ⬜ Stamp Duty (2%) — bank-draft workflow + IRD register
- ⬜ VAT (15%) — auto-invoice + monthly return prep
- ⬜ WHT — auto-deduct + certificates + e-filing
- ⬜ BOI status / foreign-exchange earnings reporting
- ⬜ Foreign Exchange Act — monthly CBSL report
- ⬜ Inland Revenue e-Filing
- ⬜ Companies Registry — annual returns per entity
- ⬜ Notary public workflow (notary assignment, scheduling, archival)
- ⬜ CRIB credit check (with consent)
- ⬜ PDPA — consent capture, DSAR, right-to-erasure
- ⬜ Data residency options (Sri Lanka-hosted / on-prem)
- ⬜ Bilingual contracts (English + Sinhala / Tamil)
- ⬜ Lease-clause obligation engine (every recurring duty → workflow)
  - ⬜ Lift service schedule
  - ⬜ Generator service + fuel-cost share
  - ⬜ Fire detection inspection
  - ⬜ Statue inspection (Lucky Seven §4(p) — 13 Italian cement sculptures)
  - ⬜ VAT reimbursement request (within 14 days of invoice)
  - ⬜ Colour-wash schedule

---

## Building operations & IoT

### Maintenance & vendor
- ⬜ Vendor marketplace (plumbers, electricians, AC, carpenters, cleaners, pest, security, gardeners, painters, glass, locksmiths)
- ⬜ KYC + insurance verification
- ⬜ Rate cards + two-way ratings
- ⬜ Quarterly vendor performance reviews

### Facility management
- ⬜ Common-area expense tracking
- ⬜ Capex planning + depreciation calendar
- ⬜ Purchase orders + GRNs + three-way match

### Energy & utilities
- ⬜ CEB / LECO bill OCR
- ⬜ Sub-metering per unit
- ⬜ Tenant-side kWh usage trend
- ⬜ Solar PPA management

### IoT / smart building
- ⬜ Smart locks (Igloo / August / Yale-Asia) — guest + move-in/out codes
- ⬜ Smart meters (Modbus / MQTT) — auto bill split
- ⬜ CCTV (Hikvision / Dahua) — clip auto-attach to maintenance tickets
- ⬜ Access control (T&A turnstiles) for BPO tenants
- ⬜ HVAC monitoring (failure prediction)

---

## Reporting & BI

### Operational
- ⬜ Rent roll, arrears, escalation, cashflow, vacancy
- ⬜ Maintenance & vendor scorecards
- ⬜ Handler productivity
- ⬜ Compliance traffic-light

### Investor / board
- ⬜ Monthly board pack (auto PDF, branded)
- ⬜ Quarterly investor letter draft
- ⬜ NOI, GRM, cap-rate per building
- ⬜ 5-year cashflow with stress tests
- ⬜ Group rollup across 6 entities

### Custom
- ⬜ Drag-and-drop dashboard builder
- ⬜ Saved views per role
- ⬜ Scheduled email delivery
- ⬜ Export (PDF / Excel / Google Sheets / API)
- ⬜ Embedded analytics in tenant + landlord portals

---

## Adjacent revenue surfaces

### Listings & leads
- ⬜ Syndication — LankaPropertyWeb, ikman, Lamudi, House.lk, Saleme
- ⬜ Auto landing page per unit (photos, floor plan, virtual tour, neighbourhood)
- ⬜ Lead CRM pipeline
- ⬜ AI tour-booking agent (WhatsApp / portal)

### Insurance
- ⬜ Embedded renters insurance at lease signing (Ceylinco / Allianz / Janashakthi)

### Concierge
- ⬜ Move-in / move-out partner network (movers, cleaners, utility connections)

### Loyalty
- ⬜ On-time-payment streak rewards
- ⬜ Partner-merchant discounts (groceries, telco, ride-hailing)

### BPO-specific
- ⬜ Shift-pattern access control
- ⬜ Dedicated parking allocation
- ⬜ 24/7 cleaning contracts
- ⬜ Cafeteria procurement

### Investment marketplace
- ⬜ Fractional investment in next Capital Trust building (long-tenure tenants)

---

## Operator extensions

- ⬜ React Native mobile app for handlers (offline-first, GPS-pinned photo evidence)
- ⬜ Workflow visual builder (non-developer admins)
- ⬜ Public API + Zapier app + OpenAPI spec
- ⬜ White-label per group entity (subdomain + brand object)
- ⬜ Internal AI copilot (natural-language → query / draft / diagnose)

---

## Phased delivery summary

| Phase | Theme |
|---|---|
| **P1** (V1, now) | Lean MVP — manual operator surface |
| **P2** | Real backend (Drizzle / Neon / Clerk / Blob / e-sign) |
| **P3** | Tenant portal v1 + payments + comms + maintenance + activity feed |
| **P4** | Bank reconciliation + first AI + conversational tenant agent |
| **P5** | Accounting + tax + public API + workflow visual builder |
| **P6** | Landlord portal + operator mobile + BI + AI copilot |
| **P7** | Tenant screening + white-label per entity |
| **P8** | Compliance hardening (full obligation engine + PDPA + IRD) |
| **P9** | Marketing & listings & AI tour bookings |
| **P10** | Vendor marketplace + insurance + concierge |
| **P11** | Energy + smart-building + tenant rewards |
| **P12** | IoT + voice ops (AI receptionist) |
| **P13** | Investment marketplace |
