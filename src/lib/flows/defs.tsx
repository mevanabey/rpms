"use client";

import type { FlowDef } from "./types";

/** Catalogue of demo flows shown in the picker. */
export const FLOWS: FlowDef[] = [
  {
    id: "welcome",
    emoji: "👋",
    title: "Welcome tour",
    description:
      "Quick walkthrough of the dashboard, leases list, a lease detail, and the rent ledger.",
    estimatedSeconds: 60,
    tags: ["overview", "guided"],
    steps: [
      { kind: "navigate", to: "/", settleMs: 700 },
      {
        kind: "popover",
        selector: '[data-onborda="dashboard-title"]',
        title: "This is the dashboard",
        side: "bottom",
        body: (
          <p>
            Everything Capital Trust runs lives here. The system updates this
            page on its own &mdash; you only step in when it asks.
          </p>
        ),
      },
      {
        kind: "popover",
        selector: '[data-onborda="dashboard-kpis"]',
        title: "Live KPIs",
        side: "bottom",
        body: (
          <p>
            Active leases, overdue rent, what&rsquo;s due in the next 14 days,
            and what&rsquo;s already been paid this month. Click a tile to drill
            in.
          </p>
        ),
      },
      {
        kind: "popover",
        selector: '[data-onborda="dashboard-leases"]',
        title: "The rent ledger, front and centre",
        side: "top",
        body: (
          <p>
            Every rent line across every lease. Filter, select, mark paid, send
            reminders &mdash; all from one table.
          </p>
        ),
      },
      { kind: "navigate", to: "/leases", settleMs: 700 },
      {
        kind: "popover",
        selector: '[data-onborda="leases-table"]',
        title: "Every lease in one list",
        side: "top",
        body: (
          <p>
            Head leases (Capital Trust as lessee) and BPO subleases (Capital
            Trust as lessor) all live in the same list.
          </p>
        ),
      },
      { kind: "navigate", to: "/leases/lease_lucky_seven_head", settleMs: 800 },
      {
        kind: "popover",
        selector: '[data-onborda="lease-detail-header"]',
        title: "Lucky Seven &middot; the anchor lease",
        side: "bottom",
        body: (
          <p>
            Rs.&nbsp;879M over 10 years. Every clause from the signed PDF is a
            typed field here &mdash; alertable on the right date.
          </p>
        ),
      },
      { kind: "navigate", to: "/rent", settleMs: 700 },
      {
        kind: "popover",
        selector: '[data-onborda="rent-title"]',
        title: "Rent ledger",
        side: "bottom",
        body: (
          <p>
            Bucketed into overdue, due-in-14-days, upcoming, and paid. Each row
            has its own mark-paid and send-reminder buttons; bulk actions live
            in the toolbar after you select.
          </p>
        ),
      },
      {
        kind: "toast",
        message: "Welcome tour complete",
        description: "Click the sparkle in the header to retake any flow.",
        tone: "success",
      },
    ],
  },

  {
    id: "onboard-tenant",
    emoji: "📝",
    title: "Onboard a new tenant",
    description:
      "Open the lease wizard, draft a sublease end-to-end, and see it land in the leases list as a draft.",
    estimatedSeconds: 45,
    tags: ["leases", "wizard"],
    steps: [
      { kind: "navigate", to: "/leases", settleMs: 700 },
      {
        kind: "popover",
        selector: '[data-onborda="leases-table"]',
        title: "Today&rsquo;s lease list",
        side: "top",
        body: (
          <p>
            We&rsquo;ll add a new sublease for a Trizen unit. Watch the list
            &mdash; it&rsquo;ll update once the wizard submits.
          </p>
        ),
      },
      { kind: "click", selector: 'a[href="/leases/new"]', postDelayMs: 700 },
      {
        kind: "popover",
        selector: '[data-onborda="page-title"]',
        title: "The lease wizard",
        side: "bottom",
        body: (
          <p>
            Property &amp; units &middot; parties &middot; terms &middot;
            schedule &middot; review. Properties and parties can both be added
            from inside the form &mdash; no need to jump out.
          </p>
        ),
      },
      { kind: "wait", ms: 800 },
      {
        kind: "store",
        caption: "Draft submitted",
        apply: (useStore) => {
          const s = useStore.getState();
          s.addDraftLease({
            propertyId: "prop_trizen",
            unitIds: ["unit_trz_t1_34_c3"],
            lessorPartyId: "party_landlord_shamil",
            lesseePartyId: "party_mrl",
            tenantPartyId: "party_tenant_farah",
            introducerPartyId: "party_introducer_stephen",
            kind: "sub",
            purpose: "bpo",
            startDate: "2026-06-01",
            endDate: "2027-05-31",
            paymentCadence: "monthly",
            defaultPaymentMethod: "lkr_transfer",
            graceMonths: 0,
            lockInYears: 0,
            tranches: [
              {
                startDate: "2026-06-01",
                endDate: "2027-05-31",
                monthlyRent: 1400,
                currency: "USD",
                dueDayOfMonth: 1,
              },
            ],
          });
        },
      },
      { kind: "navigate", to: "/leases", settleMs: 800 },
      {
        kind: "popover",
        selector: '[data-onborda="leases-table"]',
        title: "Your draft is in the list",
        side: "top",
        body: (
          <p>
            The wizard pushed the draft into the system. Open it to generate
            and download the lease PDF, or kick off e-sign from the detail
            page.
          </p>
        ),
      },
    ],
  },

  {
    id: "manage-rent",
    emoji: "💸",
    title: "Mark rent paid &middot; send reminders",
    description:
      "Filter to overdue rent, send a tenant a reminder, then reconcile a payment from the rent ledger.",
    estimatedSeconds: 35,
    tags: ["rent", "money"],
    steps: [
      { kind: "navigate", to: "/rent", settleMs: 700 },
      {
        kind: "popover",
        selector: '[data-onborda="rent-title"]',
        title: "The rent ledger",
        side: "bottom",
        body: (
          <p>
            Every inbound rent line lives here, bucketed by status. We&rsquo;ll
            walk through reconciling one without leaving the page.
          </p>
        ),
      },
      {
        kind: "popover",
        selector: '[role="tablist"]',
        title: "Bucket tabs",
        side: "bottom",
        body: (
          <p>
            Overdue &middot; due in 14 days &middot; upcoming &middot; paid
            &middot; all. The tabs slice the ledger; the filter button layers
            currency, cadence, property, and reminder state on top.
          </p>
        ),
      },
      {
        kind: "popover",
        selector: '[data-slot="table"] tbody tr',
        title: "Row actions",
        side: "top",
        body: (
          <p>
            <strong>Send reminder</strong> emails the tenant and landlord with
            the due-date amount. <strong>Mark paid</strong> closes the line
            once you&rsquo;ve seen the credit on the bank statement.
          </p>
        ),
      },
      {
        kind: "popover",
        selector: '[data-slot="table"] thead tr th:first-child',
        title: "Multi-select for bulk actions",
        side: "right",
        body: (
          <p>
            Tick the header to select the whole page, or individual rows.
            A toolbar appears with <em>Send reminder</em>, <em>Mark paid</em>,
            and <em>Export CSV</em> across the selection.
          </p>
        ),
      },
      {
        kind: "toast",
        message: "Rent walkthrough complete",
        description:
          "Reminders also surface on the lease detail and in the leases table per row.",
        tone: "success",
      },
    ],
  },

  {
    id: "switch-roles",
    emoji: "👥",
    title: "Switch users &middot; see role-based access",
    description:
      "Sign in as different team members and watch the sidebar and action buttons adapt to each role&rsquo;s permissions.",
    estimatedSeconds: 45,
    tags: ["RBAC", "users"],
    steps: [
      {
        kind: "store",
        apply: (useStore) => useStore.getState().loginAs("user_mevan"),
      },
      { kind: "navigate", to: "/admin/users", settleMs: 700 },
      {
        kind: "popover",
        selector: '[data-onborda="page-title"]',
        title: "All users in one place",
        side: "bottom",
        body: (
          <p>
            Click <strong>Sign in as</strong> next to any row to walk in their
            shoes. The whole UI redraws around what they&rsquo;re allowed to
            see.
          </p>
        ),
      },
      {
        kind: "store",
        caption: "Now signed in as Ruvini (lawyer)",
        apply: (useStore) => useStore.getState().loginAs("user_ruvini"),
      },
      { kind: "navigate", to: "/", settleMs: 700 },
      {
        kind: "popover",
        selector: '[data-onborda="sidebar"]',
        title: "A lawyer sees the legal surfaces",
        side: "right",
        body: (
          <p>
            Leases (only the ones they&rsquo;re assigned to) and properties.
            No admin tooling, no rent ledger.
          </p>
        ),
      },
      {
        kind: "store",
        caption: "Back to admin",
        apply: (useStore) => useStore.getState().loginAs("user_mevan"),
      },
      {
        kind: "popover",
        selector: '[data-onborda="sidebar"]',
        title: "Admin sees everything",
        side: "right",
        body: (
          <p>
            All groups, all routes, all admin tools. Permissions are enforced
            at four layers &mdash; sidebar, page guard, action, and lease scope.
          </p>
        ),
      },
    ],
  },

  {
    id: "customize-access",
    emoji: "🔐",
    title: "Customize roles & permissions",
    description:
      "Tweak what a role can do, then watch the sidebar redraw the next instant. Built-in roles can be relabelled; new roles can be added.",
    estimatedSeconds: 35,
    tags: ["admin", "RBAC"],
    steps: [
      {
        kind: "store",
        apply: (useStore) => useStore.getState().loginAs("user_mevan"),
      },
      { kind: "navigate", to: "/admin/access", settleMs: 700 },
      {
        kind: "popover",
        selector: '[data-onborda="page-title"]',
        title: "The Access matrix",
        side: "bottom",
        body: (
          <p>
            Single source of truth. Click any cell to grant or revoke that
            permission for that role. The sidebar reacts on the next render.
          </p>
        ),
      },
      {
        kind: "store",
        caption: "Granted account_manager · payments:reconcile",
        apply: (useStore) =>
          useStore
            .getState()
            .setPermission("account_manager", "payments:reconcile", true),
      },
      { kind: "wait", ms: 600 },
      {
        kind: "store",
        caption: "Revoked account_manager · payments:reconcile",
        apply: (useStore) =>
          useStore
            .getState()
            .setPermission("account_manager", "payments:reconcile", false),
      },
      { kind: "wait", ms: 400 },
      {
        kind: "store",
        caption: "Restored account_manager defaults",
        apply: (useStore) =>
          useStore.getState().resetRolePermissions("account_manager"),
      },
      {
        kind: "popover",
        selector: '[data-onborda="page-title"]',
        title: "Add a new role",
        side: "bottom",
        body: (
          <p>
            Click <strong>+ New role</strong> to define a custom role with its
            own label, colour, and permission set. It immediately becomes
            available to assign.
          </p>
        ),
      },
      {
        kind: "toast",
        tone: "success",
        message: "Walkthrough complete",
        description:
          "Built-in roles can be relabelled and reset; custom roles can be deleted as long as no user is assigned.",
      },
    ],
  },
];

export const FLOW_BY_ID: Record<string, FlowDef> = Object.fromEntries(
  FLOWS.map((f) => [f.id, f]),
);
