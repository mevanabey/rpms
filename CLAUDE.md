@AGENTS.md

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Purpose

**RPMS — Rental Property Management System** — the Next.js + Vercel Workflows platform that replaces Capital Trust Holdings' Excel-based rental operation. It manages **300+ active tenancies** across multiple buildings (Lucky Seven, Trizen, Capitol TwinPeaks, CTR Thimbirgasyaya, Capital Trust Tower One, Alfred series, …) and a stakeholder graph of landlords, clients, tenants, introducers, lawyers, and accountants.

The system spans two materially different operations under one platform:

1. **Commercial head leases** *(Lucky Seven pattern)* — external landlords ↔ Capital Trust group entities. Single multi-million LKR agreements, notary-attested, 2-year escalations, heavy compliance (stamp duty bank drafts, legal fees cheques, VAT invoicing). Few in count, high stakes per agreement.
2. **BPO / residential subleases** *(Trizen / Capitol / CTR pattern)* — Capital Trust ↔ BPO clients (MRL, Tech City) and individual tenants. Standardised 1-year contracts, USD-denominated rent (1,250–1,500 USD typical), high volume, introducer-driven, mail-merge reminders to landlord *and* tenant on monthly / quarterly / bi-annual cadence.

Workflows run on **Vercel Workflows** today; the long-term path is to migrate agentic steps to **AgentFabriq** while keeping deterministic steps on Vercel Workflows. Every workflow handler is built as a pure typed function so the port is a transport swap, not a rewrite.

This repo is the customer-facing operator surface — staff (handlers, accountants, lawyers, introducers, admins) use this to run the rental business. A tenant-facing portal is out of scope for V1.

### Canonical specifications

- **Master spec**: [`docs/SPEC.md`](./docs/SPEC.md) — 17 sections covering: why we're building this, glossary, the Lucky Seven anchor table (every clause → typed field), two-product-surface model, full domain model with mermaid ER diagram, route IA, 11 named workflows with idempotency keys, tech stack picks, Vercel Workflows → AgentFabriq port path, XLSX migration plan, 8-phase rollout, multi-entity model, security/PDPA, open questions. **This is the source of truth for what we are building.** Read it before designing or building anything.
- **Signed head lease (anchor)**: [`docs/CamScanner-04-09-2026 11.47.pdf`](./docs/CamScanner-04-09-2026%2011.47.pdf) — the canonical Lucky Seven indenture (Rs. 879,134,400 / 10 years / 9 Apr 2026 → 8 Apr 2036). Every clause has a corresponding field in the data model. When in doubt about commercial-lease semantics, this is the authority. The plaintext mirror lives at [`docs/extracted/latest-draft-lease.VI  6.04.2026-S.txt`](./docs/extracted/) (the same lease as a draft DOCX).
- **Onboarding intake**: [`docs/check-list-lucky-seven.xlsx`](./docs/check-list-lucky-seven.xlsx) — the lawyer/handler intake checklist. Basis for the New-Lease wizard form fields. CSV mirror at [`docs/extracted/check-list-lucky-seven__Sheet1.csv`](./docs/extracted/check-list-lucky-seven__Sheet1.csv).
- **Legacy Excel (migration source)**: [`docs/rentals-sheet.xlsx`](./docs/rentals-sheet.xlsx) — 5 tabs (Monthly, Quarterly, Bi-Annual, Introducer, SD), ~300 rows. Frozen read-only on cutover. CSV mirrors live in [`docs/extracted/`](./docs/extracted/) — re-run [`docs/extract.py`](./docs/extract.py) after replacing any `.docx` or `.xlsx` source.

## Commands

```bash
pnpm dev          # Start dev server (localhost:3000; falls back to 3002 if 3000 is taken)
pnpm build        # Production build (Turbopack)
pnpm lint         # ESLint
python3 docs/extract.py   # Regenerate plaintext mirrors when a source .docx / .xlsx changes
```

## ⚠ Next.js 16 — read AGENTS.md first

Heed the warning at the top of this file: this Next.js version (16.2.4) has breaking changes from anything in training data. **Before writing routing / layout / data-fetching / config code, read the relevant guide in `node_modules/next/dist/docs/` and respect deprecation notices.** Don't guess — research first.

## Non-Negotiable Engineering Principles

These apply to every change in this repo. **Quality and robustness over speed of development — always.**

### 1. Reuse before you build
Check `src/components/` (currently `Sidebar`, `PageStub`) and `src/lib/` (currently `nav.ts`) before authoring anything new. If a pattern (button, card, table, form, dialog, sidebar item, page header) already exists, extend or compose it — never duplicate.

### 2. shadcn-style primitives are the floor — never rewrite them
When adding UI primitives, follow the shadcn pattern: `forwardRef`, `cva` variants, theme-token-driven styling. Place them in `src/components/ui/` (to be created when the first primitive is needed) and compose everywhere. Do not fork, hand-roll alternatives, or "improve" primitives at the call site. If a primitive is missing, add it once with a shadcn-faithful API; never reach past primitives to raw HTML when a primitive exists for the job.

### 3. Separate UI components from data components
We must be able to swap the visual layer (restyle, rebrand for a Capital Trust group entity, ship an alternate operator chrome) **without rewriting business logic**. To enable that:

- **Presentational components** live close to their route (`_components/`) or in `src/components/` and accept props only — no Drizzle queries, no Vercel Workflow triggers, no Clerk reads inside them.
- **Data components / containers** (server components, hooks, server actions, tRPC procedures) own fetching, mutations, and shape conversion — they pass plain props down.
- A presentational component must be testable / reusable with mock data alone. If you find yourself importing a DB client into a component that also renders JSX, split it.
- Keep types in a shared layer (`src/server/db/schema.ts`, `src/types/`, or feature-local `types.ts`) so both halves agree on shape.

### 4. No hardcoded design tokens — ever
Every visual property comes from Tailwind / the theme tokens in `src/app/globals.css`. This is what makes future per-entity branding and dark-mode parity work without rewrites.

- **Colors**: use semantic tokens defined via `@theme inline` in `src/app/globals.css` (currently `--color-background`, `--color-foreground`; expand the palette as needs arise). Never `#fff`, `rgb(...)`, `hsl(...)` literals, or fixed Tailwind palette colors like `bg-blue-500` in feature code.
- **Fonts**: only `font-sans` (Geist) / `font-mono` (Geist Mono) wired via `next/font/google`, or theme-defined font tokens. Never `font-family: "..."` inline.
- **Spacing**: only Tailwind scale (`p-4`, `gap-6`, `space-y-2`). No arbitrary `[17px]` values unless there's a documented reason.
- **Sizes**: Tailwind scale or component-defined sizes. No raw widths/heights at the call site.
- **Borders**: `border`, `border-2`, semantic border tokens. Never `border: 1px solid #ddd`.
- **Border-radius**: `rounded`, `rounded-md`, `rounded-lg`, `rounded-full`, or theme radius tokens. Never `border-radius: 8px` inline.
- **Shadows, opacity, transitions**: Tailwind utilities / theme tokens only.

If a token doesn't exist for a need, **add it to `@theme inline` in `src/app/globals.css` first**, then use it. Never bypass the theme.

### 5. Multi-entity tenancy is enforced server-side, never client-side
Capital Trust is a *group* — Holdings, Properties One, Residencies, Tech City Lanka, Capital BPO, Colombo BPO. Every lease, payment, document, and notification is owned by exactly one legal entity. Authorization is enforced in the server layer (Clerk org + role + Drizzle `where` clause / Postgres RLS) — **never trust the client to filter**. Sidebar visibility, page-level access, and data scoping all derive from `org_id` + `legal_entity_id` + `role`. Adding a new query without the entity scope is a bug.

### 6. Workflows are pure, typed, idempotent
Every workflow handler under `src/workflows/<kind>/` is `(input: ZodType) => Promise<Output>`. Steps are idempotent (safe to retry), have explicit `idempotency_key` (see SPEC §7.9), and declare compensations where relevant. State persists in `workflow_run`. **No hidden side effects, no module-level mutable state, no environment-dependent branching outside config.** This is what makes the AgentFabriq port a re-host, not a rewrite — handlers run unchanged on either executor.

### 7. Money is a ledger, not a column
Every amount — rent, deposit, stamp duty, legal fees, VAT, late fee, refund, commission — is a `ledger_entry` row with `direction`, `amount`, `currency`, `due_date`, `paid_date`, `payment_method`. **Never** infer "paid" from a boolean column. **Never** compute totals from joined Excel-style flag fields. The legacy `Payment N (0|1)` columns are import-only; in the system, paid status is the existence of a matching `ledger_entry` with `paid_date IS NOT NULL`.

### 8. Lease clauses → typed fields → workflows
The signed lease (Lucky Seven anchor) is the contract. Every clause that produces a **date** (start, grace-end, lock-in-end, escalation boundary, renewal-notice window, expiry), an **amount** (tranche rent, deposit, stamp duty, late fee, liquidated damages), or a **recurring duty** (lift service, generator service, fire inspection, VAT request, colour wash, statue inspection) MUST encode as a typed, queryable, alertable `obligation` row, and MUST fire its workflow on the right date. If a clause exists in the PDF and not in the schema, the schema is wrong.

### 9. Composition over configuration
Prefer small, composable components and workflow steps that take `children` / render-props / step-input over giant prop-driven mega-components or omnibus workflows.

### 10. Type safety end-to-end
Zod schemas at every boundary — forms, server actions, tRPC procedures, workflow step inputs, webhook payloads, document-template variables. No `any`, no `as` casts to silence the compiler — fix the type instead.

### 11. Latest stable methodologies
Server Components by default; Client Components only when interactivity, hooks, or browser APIs require it. Use Next.js 16 / React 19 / App Router patterns (loading/error boundaries, route groups, parallel routes where appropriate). No legacy `getServerSideProps`-era thinking. Read `node_modules/next/dist/docs/` for any unfamiliar API.

### 12. Accessibility is a requirement
Use semantic HTML, label icon-only buttons (`aria-label`), keep visible focus rings, respect keyboard navigation. The operator surface will be used for hours a day by accountants and handlers — it has to be fast and a11y-clean.

### 13. Excel is read-only on cutover
The legacy `rentals-sheet.xlsx` workbook is the migration source, not a continuing system of record. Once the importer runs in production, the workbook is frozen — no further edits flow back into RPMS. New tenancies, payments, and reminders happen in-app, full stop. Don't write code that reads the workbook at runtime.

### 14. Show what the system is doing
The product narrative is "the system runs itself, and asks you only when it must". Every workflow event must surface as an `Activity`; every gated step must surface as an `ApprovalRequest`. The header bell, the approvals pill, the dashboard live panel, the `/activity` log, and the `/automation` matrix all subscribe to the same store. **Adding a new workflow without wiring it to the demo activity feed is a UI bug** — even when (especially when) the underlying handler is deterministic, the operator must see it run.

### 15. RBAC is a contract, not a sidebar filter
Sidebar visibility, page-level `<RoleGate>`, and action-level `can()` checks are three independent enforcement layers — and Phase 02 adds Postgres RLS as a fourth. For lease-scoped roles (today: `lawyer`), there's a fifth layer — `<LeaseScopeGate leaseId={...}>` — that refuses lease-detail / rent pages whose lease isn't on the user's `assignedLeaseIds`. **Adding a new feature is incomplete until you've added a `Resource` to `src/lib/demo/identity.ts`, granted it to the appropriate roles, tagged the nav item + the page-level guard with it, *and* (if the feature is per-lease) wired the data through `scopeByLease(user, rows, getLeaseId)` from `src/lib/demo/scope.ts`.** Hidden ≠ secure: assume an unauthorized user might still navigate to the URL directly. SPEC §21 + §21.1a.

### 16. Quality over speed
If a shortcut would compromise correctness, robustness, the design system, or the legal/financial integrity of a lease, take the longer path. Half-finished features stay on a branch until they're whole. When unfamiliar with a library or pattern, **research first** — never guess.

## Architecture

### Stack

- **Next.js 16** (App Router, Turbopack), **React 19**, TypeScript
- **Tailwind CSS v4** — token-driven via `@theme inline` in `src/app/globals.css`; never hardcode visual values
- **shadcn-style primitives** in `src/components/ui/` (to be added) — built locally to match shadcn conventions (`forwardRef` + `cva`)
- **lucide-react** for UI icons (default); add `@iconify/react` later if richer icon needs emerge
- **`class-variance-authority`** + **`clsx`** + **`tailwind-merge`** composed via a `cn()` helper in `src/lib/utils.ts` (to be added when first primitive is added) for variant-driven styling
- **ESLint** (`eslint-config-next`) for linting
- **pnpm** for package management
- **Neon Postgres** (serverless) + **Drizzle ORM** for the database layer — schema in `src/server/db/schema.ts`, migrations via `drizzle-kit`. Branching for staging.
- **Clerk** for auth — Sri Lanka phone OTP, organizations modeling the Capital Trust group, role-based access (`admin | handler | accountant | lawyer | viewer | introducer`).
- **Vercel Blob** for file storage (lease PDFs, KYC, receipts, invoices) — SHA-256 dedupe.
- **Vercel Workflows** for orchestration — handlers in `src/workflows/<kind>/`. Long-term port to **AgentFabriq** for agentic steps (bank-reconcile email parsing, KYC review, tenant Q&A); deterministic steps stay on Vercel Workflows.
- **Resend** for outbound email + **react-email** for templates; **Resend Inbound** (or SendGrid Parse) for inbound bank-advice email parsing.
- **Twilio** for WhatsApp / SMS (Sri Lanka long codes; tenants overwhelmingly on WhatsApp).
- **DropboxSign** (default) or **DocuSign** for e-signature — webhook-driven, lease draft → signed.
- **docxtemplater** + headless LibreOffice (or Cloudmersive) for DOCX → PDF document generation.
- **Anthropic claude-opus-4-7** with vision for OCR fallback on lessor-supplied scans.
- **Sentry + Axiom + Vercel Observability** for logs, traces, errors.

### File structure

```
src/
  app/                              # Next.js 16 App Router
    layout.tsx                      # Root layout — ThemeProvider + TooltipProvider + DashboardShell
    globals.css                     # @theme tokens, base layer, utilities
    page.tsx                        # /  — Dashboard (KPIs, today's actions)
    properties/page.tsx             # /properties (stub)
    units/, parties/, leases/, leases/new/, documents/,
    payments/, payments/inbox/, commissions/, reminders/,
    maintenance/, compliance/,
    reports/{rent-roll,arrears,escalations,cashflow}/,
    admin/{import,templates,workflows,users}/
  components/
    PageStub.tsx                    # Card-based stub header for every unbuilt route
    ui/                             # shadcn-style primitives (radix-nova) — read theme tokens
    data-table/                     # TanStack Table wrappers (column-header, pagination)
    date-range-picker.tsx           # Calendar + range picker
    simple-icon.tsx                 # simple-icons helper
    app/                            # Composed app shell (route-aware components)
      app-sidebar.tsx               # Driven by getSidebarItems()
      dashboard-shell.tsx           # SidebarProvider + header + main
      dashboard-breadcrumb.tsx      # Path-driven breadcrumb
      entity-switcher.tsx           # Capital Trust group entity placeholder
      nav-main.tsx                  # Renders NavGroup[] items
      nav-user-placeholder.tsx      # Auth menu placeholder (Clerk in Phase 02)
      theme-provider.tsx            # next-themes wrapper
      theme-toggle.tsx              # Light/dark toggle
      sidebar/search-dialog.tsx     # ⌘K command palette → routes
  navigation/
    sidebar/sidebar-items.ts        # Single source of truth for sidebar nav
  lib/
    utils.ts                        # cn(), formatDate, formatCurrency (LKR default), excelSerialToDate
    cookie.client.ts                # Cookie helpers
    local-storage.client.ts         # localStorage helpers
  hooks/
    use-mobile.ts                   # Mobile breakpoint hook used by Sidebar primitive
  core/                             # PORTS — domain types + service interfaces (CLAUDE.md §6)
    types.ts                        # Money, Party, Property, Unit, Lease, RentScheduleTranche,
                                    #   LedgerEntry, Obligation, Notification, Document, WorkflowRun
    services/
      index.ts                      # Backend = { leases, parties, properties, payments,
                                    #             reminders, onboarding }
      leases.ts                     # ILeaseService
      parties.ts                    # IPartyService
      properties.ts                 # IPropertyService
      payments.ts                   # IPaymentService
      reminders.ts                  # IReminderService
      onboarding.ts                 # IOnboardingWorkflow
                                    # core/ MUST NOT import next, react, drizzle, clerk,
                                    # vercel, supabase, or anything from src/server|app|components.
                                    # Enforced by ESLint no-restricted-imports.
  server/                           # ADAPTERS — implements `Backend`, picks via env
    container.ts                    # getBackend() — resolves adapter by `BACKEND` env var
    adapters/
      mock/                         # Phase 01 — in-memory + Lucky Seven seed
        index.ts
        seed.ts                     # Lucky Seven head lease + sample BPO subleases
      vercel/                       # Phase 02 — Vercel Workflows (README.md only for now)
      agent-fabriq/                 # Phase 03 — AgentFabriq (README.md only for now)
    db/                             # (TBD) Drizzle schema + migrations
    trpc/                           # (TBD) tRPC routers
    lib/                            # (TBD) Server-only helpers (auth guards, RLS scopers, …)
  workflows/                        # (TBD) Vercel Workflows handlers — pure typed functions
    onboard-tenant/, rent-collection-cycle/, lease-lifecycle-tick/,
    compliance-scheduler/, bank-reconcile/, commission-accrual/,
    commission-payout/, esign-resume/, breach-detect/,
    renewal-open/, move-out/
  templates/                        # (TBD)
    leases/                         # DOCX templates with mustache vars
    emails/                         # react-email templates
docs/
  SPEC.md                           # Master spec — read before building
  CamScanner-04-09-2026 11.47.pdf   # Signed Lucky Seven head lease (anchor)
  latest-draft-lease.VI  6.04.2026-S.docx   # Editable draft of the same lease
  check-list-lucky-seven.xlsx       # Onboarding intake checklist
  rentals-sheet.xlsx                # Legacy operational workbook (~300 rows)
  extract.py                        # stdlib-only converter for .docx / .xlsx → .txt / .csv
  extracted/                        # Auto-generated plaintext mirrors (re-run extract.py)
public/
```

Keep this structure tight: presentational composites under `src/components/app/` (when added), primitives under `src/components/ui/`, server-only code under `src/server/`, workflows under `src/workflows/`, route-specific components colocated as `_components/` inside the route folder.

### Theme tokens (current)

Defined in `src/app/globals.css` via `@theme inline`. Reading these is how every component picks up the operator-surface aesthetic for free. The current set is minimal (background/foreground + Geist fonts) — expand it as primitives are added; **never inline raw values when a token would do**, and **add the token first** when a new visual need arises.

| Group | Tokens |
|---|---|
| Surfaces | `--color-background`, `--color-foreground` (expand: `--color-canvas`, `--color-surface`, `--color-surface-strong`, `--color-border`, `--color-border-soft` as needed) |
| Foreground | `--color-foreground` (expand: `--color-muted-foreground`, `--color-subtle-foreground` as needed) |
| Fonts | `--font-sans` (Geist), `--font-mono` (Geist Mono) |

### Key patterns

**App shell**: `src/app/layout.tsx` renders `<Sidebar />` + `<main>{children}</main>`. The sidebar is driven entirely by `src/lib/nav.ts` — to add a route to the IA, add an entry there; do not hand-roll links inside the sidebar component.

**Stub pages**: every unbuilt route renders `<PageStub title=… blurb=… spec="§N" todos={[…]} />`. The `spec` prop points at the section of `docs/SPEC.md` that defines the page; the `todos` list seeds the next implementation slice. When you implement a route, replace the stub with the real page; keep the same SPEC § anchor in a comment for traceability.

**Server Components by default**: pages and data containers are server components. Client components are opt-in with `"use client"` only when interactivity (state, effects, browser APIs) requires it.

**Workflows**: every workflow lives under `src/workflows/<kind>/index.ts` with an exported step graph. Step functions are pure typed functions. State, retries, idempotency, and step results are persisted to `workflow_run`. Triggers (cron / event / webhook) are wired in the workflow's `route.ts` under `src/app/api/workflows/<kind>/`. See SPEC §7 for the full inventory.

**Backend resolution (ports & adapters)**: pages and server actions never import an adapter directly. They call `getBackend()` from `@/server/container`, which returns a `Backend` (defined in `@/core/services`). The active adapter is picked from `process.env.BACKEND` — `mock` (Phase 01, default), `vercel` (Phase 02), `agentfabriq` (Phase 03). Swapping phases is a single env-var flip; UI and core types stay frozen. See CLAUDE.md §6.

**Demo overlay (`src/lib/demo/`)**: in addition to the server-rendered mock backend, Phase 01 includes a *client-side* demo overlay that drives the live feel — activities, approvals, autonomy training matrix, draft leases. It's a Zustand store persisted in `localStorage` with `skipHydration: true` (avoids the SSR/CSR snapshot loop), seeded deterministically (no `Math.random()` / `Date.now()` at module load — see `src/lib/demo/seed.ts`), and ticked by `SimProvider` every ~14s. Read it through the helper hooks in `src/lib/demo/use-store.ts` (`useActivities`, `usePendingApprovals`, `useAutonomyMatrix`, …) which apply `useShallow`. **Never call `useDemoStore((s) => s.activities)` directly** — the array identity changes on every render and triggers infinite renders. SPEC §18-§20.

**Live primitives**: three reusable atoms make "the system is alive" visible at every layer.

| Primitive | Purpose | Where it shows |
|---|---|---|
| `LiveDot` (`@/components/ui/live-dot`) | Pulsing tone-aware dot. | Header pill, fresh activities, autonomy banners. |
| `StatusPill` (`@/components/ui/status-pill`) | Semantic icon + colour pill. Used by `LeaseStatusBadge` / `ObligationStatusBadge` so a single tone-map serves all status displays. | Every list, detail page, badge in tables. |
| `AutonomyMeter` (`@/components/ui/autonomy-meter`) | Confidence bar with promotion threshold tick + level label. | `/automation` matrix and dashboard summary. |

When you add a new domain status, map it to a `StatusTone` in `src/components/app/status-badge.tsx` rather than hand-rolling a new badge component.

**Onborda tour**: a guided walkthrough lives in `src/lib/tour/steps.tsx` and renders through `src/components/app/tour-card.tsx` (branded popover) + `OnbordaProvider` + `Onborda`. Auto-launches once via `FirstRunTour`; the sparkle icon in the header re-launches it any time. Each step targets a `data-onborda="..."` selector; current selectors are catalogued in SPEC §20.2. **Adding a new top-level page or major widget is incomplete until you've added a `data-onborda` anchor and a step covering it.**

**Document generation**: `docs/CamScanner-04-09-2026 11.47.pdf` (signed) and the matching DOCX draft are the canonical templates for commercial leases. Templates under `src/templates/leases/` use mustache variables; `docxtemplater` fills them; headless LibreOffice converts to PDF; PDFs are stored in Vercel Blob with SHA-256 dedupe and a `document` row.

**Migration**: `src/app/admin/import/page.tsx` (stub today) is the one-shot importer for `rentals-sheet.xlsx` via the CSVs in `docs/extracted/`. Excel serial dates are decoded once via a single helper. Parties auto-merge by `display_name + email`, with a manual-merge queue for ambiguous cases. Output: `import_report.csv`. After cutover, the workbook is frozen.

### Routes (current)

**MVP carve-out (2026-05-13).** The sidebar surfaces only the rows below. All other routes still exist on disk (and the next column of this table is the full long-term IA) — they're commented out of `sidebar-items.ts` until the client asks for the next piece. See SPEC §0.1.

| Status | Group | Route | File | Purpose |
|---|---|---|---|---|
| ✅ MVP | Overview | `/` | `app/(app)/page.tsx` | Dashboard — KPIs + leases table. |
| ✅ MVP | Estate | `/properties` `/properties/[id]` | `app/(app)/properties/...` | Buildings list + detail. |
| ✅ MVP | Agreements | `/leases` `/leases/new` `/leases/[id]` | `app/(app)/leases/...` | Lease list, onboarding wizard, lease detail (scoped for lawyers via `<LeaseScopeGate>`). |
| ✅ MVP | Rent | `/rent` | `app/(app)/rent/...` | Bucketed rent ledger (overdue/due-soon/upcoming/paid). Per-row **Mark paid** + **Send reminder** actions write to `state.rentPayments` + `state.rentReminders` and push a `human` activity. |
| ✅ MVP | Admin | `/admin/import` `/admin/templates` `/admin/workflows` `/admin/users` `/admin/access` | `app/(app)/admin/...` | XLSX migration, templates, workflow registry, users, RBAC matrix. |
| ❌ deferred | Estate (rest) | `/units` `/parties` `/parties/[id]` | `app/(app)/{units,parties}/...` | Unit-centric occupancy view, party directory. |
| ❌ deferred | Agreements (rest) | `/documents` | `app/(app)/documents/page.tsx` | Document vault. |
| ❌ deferred | Money | `/payments` `/payments/inbox` `/commissions` | `app/(app)/{payments,commissions}/...` | Full ledger, bank-recon inbox, introducer payouts. |
| ❌ deferred | Operations | `/reminders` `/maintenance` `/compliance` | `app/(app)/{reminders,maintenance,compliance}/...` | Notification queue, tickets, compliance calendar. |
| ❌ deferred | Decisions | `/tasks` `/activity` `/activity/[id]` `/automation` | `app/(app)/{tasks,activity,automation}/...` | Pending approvals, activity feed, autonomy ladder. |
| ❌ deferred | Reports | `/reports/{rent-roll,arrears,escalations,cashflow}` | `app/(app)/reports/...` | Standard portfolio reports. |

Match the IA in `src/navigation/sidebar/sidebar-items.ts` when adding new routes. **To unhide a deferred route**: re-add its `NavMainItem` to `sidebar-items.ts`, make sure at least one active role grants its `requires` resource, and add an MVP-→-active note to SPEC §0.1.

### Reference material

- [`docs/SPEC.md`](./docs/SPEC.md) is the visual / structural / behavioural source-of-truth. Always consult it before creating a new component, route, workflow, or schema entity. If a pattern is missing in code but defined in spec, build it once in the most generic way possible and place it in the right `src/` subfolder so the next slice can reuse it.
- [`docs/CamScanner-04-09-2026 11.47.pdf`](./docs/CamScanner-04-09-2026%2011.47.pdf) is the legal anchor — when designing schemas or workflows around commercial leases, read the relevant clause first.
- [`docs/extracted/`](./docs/extracted/) holds plaintext mirrors of every binary doc so the agent (and the importer) can read them without binary parsers. Re-run `python3 docs/extract.py` after any source-doc replacement.

## Code Style

- **Formatter / linter**: ESLint (`eslint-config-next`). Respect existing formatting — 2-space indent, double quotes, semicolons, trailing commas.
- `src/components/ui/` (when added) follows shadcn conventions; do not modify primitives ad-hoc to fix a one-off use case — extend the API instead.
- **Import order**: react → next → packages → aliases (`@/`) → relative paths.
- **No hardcoded color/font/spacing/size/border/radius values** — use theme tokens (see principle #4).
- **No `any` and no escape-hatch `as` casts** — model the type properly.
- **Server Components by default**; mark Client Components explicitly with `"use client"` only when interactivity, hooks, or browser APIs require it. Stub pages and dashboard cards are correctly server-rendered; forms, calendars, and toggles will be client.
- Keep presentational components free of data fetching (see principle #3).
- Workflows: handlers as pure typed functions (see principle #6); never reach for module-level mutable state or environment-dependent branching outside config.
- Money: every amount is a `ledger_entry` (see principle #7); never store paid status as a boolean.
