import type { Step } from "onborda";

interface Tour {
  tour: string;
  steps: Step[];
}

/**
 * Guided demo tour. Each step targets a `data-onborda="..."` selector and
 * navigates between pages where needed. Designed for a non-technical
 * audience — narrate the product, not the architecture.
 */
export const TOURS: Tour[] = [
  {
    tour: "rpms-main",
    steps: [
      {
        icon: "👋",
        title: "Welcome to RPMS",
        content: (
          <div className="space-y-2">
            <p>
              This is the <strong>Rental Property Management System</strong> for
              Capital Trust — replacing your Excel-based operation with a system
              that runs itself.
            </p>
            <p className="text-muted-foreground text-xs">
              Take a quick tour. Each screen shows a different part of how the
              system works for you.
            </p>
          </div>
        ),
        selector: '[data-onborda="dashboard-title"]',
        side: "bottom",
        pointerPadding: 6,
        pointerRadius: 8,
        nextRoute: "/",
      },
      {
        icon: "📊",
        title: "Live overview",
        content: (
          <p>
            These tiles update on their own. Active leases, parties, and
            outstanding amounts — all driven from real data, no spreadsheet.
          </p>
        ),
        selector: '[data-onborda="dashboard-kpis"]',
        side: "bottom",
        pointerPadding: 6,
        pointerRadius: 12,
      },
      {
        icon: "🤖",
        title: "What's the system doing?",
        content: (
          <div className="space-y-2">
            <p>
              The activity feed is the system's <strong>working log</strong>.
              Reminders sent, payments matched, lifecycle events — every
              autonomous action shows up here.
            </p>
            <p className="text-muted-foreground text-xs">
              New events arrive every few seconds. Watch the green dots.
            </p>
          </div>
        ),
        selector: '[data-onborda="live-activity"]',
        side: "right",
        pointerPadding: 6,
        pointerRadius: 12,
      },
      {
        icon: "🛡️",
        title: "When the system needs you",
        content: (
          <p>
            Some decisions need a human. The system collects them here so you
            don't drown in email. Click <strong>Approve</strong> or{" "}
            <strong>Reject</strong> — it remembers and learns to do it without
            you next time.
          </p>
        ),
        selector: '[data-onborda="dashboard-approvals"]',
        side: "left",
        pointerPadding: 6,
        pointerRadius: 12,
      },
      {
        icon: "🎓",
        title: "The training matrix",
        content: (
          <p>
            Every workflow has an autonomy level — from <em>manual</em> all the
            way up to <em>fully automated</em>. As you approve more decisions,
            the system graduates to higher autonomy. Your team focuses only on
            the exceptions.
          </p>
        ),
        selector: '[data-onborda="dashboard-autonomy"]',
        side: "left",
        pointerPadding: 6,
        pointerRadius: 12,
      },
      {
        icon: "🔔",
        title: "Notifications & approvals",
        content: (
          <div className="space-y-2">
            <p>
              The bell shows everything that just happened. The amber pill
              counts decisions that need a human.
            </p>
            <p className="text-muted-foreground text-xs">
              Both update in real time as the system works.
            </p>
          </div>
        ),
        selector: '[data-onborda="header-chrome"]',
        side: "bottom",
        pointerPadding: 6,
        pointerRadius: 12,
      },
      {
        icon: "🏢",
        title: "Leases — the centre of everything",
        content: (
          <p>
            Every lease — head leases owned by Capital Trust, BPO subleases,
            commercial agreements — lives here. Click any row to see the full
            contract: parties, schedule, money in, money out.
          </p>
        ),
        selector: '[data-onborda="sidebar"]',
        side: "right",
        pointerPadding: 4,
        pointerRadius: 8,
        nextRoute: "/leases",
      },
      {
        icon: "📋",
        title: "Lease list",
        content: (
          <p>
            Filter by property, party, status. Click a row to drill in. You can
            create a new lease through a guided wizard — the system handles
            KYC, the draft, e-signature, deposits, and activation.
          </p>
        ),
        selector: '[data-onborda="leases-table"]',
        side: "top",
        pointerPadding: 6,
        pointerRadius: 12,
        nextRoute: "/leases/lease_lucky_seven_head",
      },
      {
        icon: "📜",
        title: "The Lucky Seven lease",
        content: (
          <div className="space-y-2">
            <p>
              The signed head lease — Rs. 879 million over 10 years, with rent
              escalations every 2 years. Every clause in the PDF is a field
              here, alertable on the right date.
            </p>
            <p className="text-muted-foreground text-xs">
              Stamp duty, deposit, lock-in, escalations — all tracked.
            </p>
          </div>
        ),
        selector: '[data-onborda="lease-detail-header"]',
        side: "bottom",
        pointerPadding: 6,
        pointerRadius: 12,
      },
      {
        icon: "💰",
        title: "Money flows live",
        content: (
          <p>
            Every rent receipt, deposit, late fee, refund — recorded as a ledger
            entry. The system can match incoming bank advices automatically; if
            it's unsure, it asks you.
          </p>
        ),
        selector: '[data-onborda="sidebar-money"]',
        side: "right",
        pointerPadding: 4,
        pointerRadius: 8,
        nextRoute: "/payments",
      },
      {
        icon: "📨",
        title: "Reminders that send themselves",
        content: (
          <p>
            T-7 day pre-bills, due-day notices, late escalations — all queued
            here and sent through email + WhatsApp. No more Excel mail merge.
          </p>
        ),
        selector: '[data-onborda="sidebar-operations"]',
        side: "right",
        pointerPadding: 4,
        pointerRadius: 8,
        nextRoute: "/reminders",
      },
      {
        icon: "🛡️",
        title: "Compliance calendar",
        content: (
          <p>
            Lift servicing, generator maintenance, fire inspection, VAT, stamp
            duty, the 13 Italian sculptures — every clause-derived obligation
            on a single calendar.
          </p>
        ),
        selector: '[data-onborda="page-title"]',
        side: "bottom",
        pointerPadding: 6,
        pointerRadius: 12,
        nextRoute: "/compliance",
      },
      {
        icon: "📥",
        title: "Your decisions, in one place",
        content: (
          <p>
            All open approvals — payment matches, KYC reviews, penalty waivers,
            renewal openings. Every click teaches the system to handle it the
            same way next time.
          </p>
        ),
        selector: '[data-onborda="page-title"]',
        side: "bottom",
        pointerPadding: 6,
        pointerRadius: 12,
        nextRoute: "/tasks",
      },
      {
        icon: "🤖",
        title: "Watch it learn",
        content: (
          <p>
            Each workflow's autonomy meter rises with every approval. When it
            crosses the threshold, it graduates — and starts running without
            asking. You stay in charge of exceptions only.
          </p>
        ),
        selector: '[data-onborda="page-title"]',
        side: "bottom",
        pointerPadding: 6,
        pointerRadius: 12,
        nextRoute: "/automation",
      },
      {
        icon: "✨",
        title: "That's it",
        content: (
          <div className="space-y-2">
            <p>
              The system runs in the background, ticking forward. You only step
              in when it asks. As you train it, it handles more.
            </p>
            <p className="text-muted-foreground text-xs">
              Click the sparkle in the header any time to retake this tour.
            </p>
          </div>
        ),
        selector: '[data-onborda="tour-launcher"]',
        side: "bottom",
        pointerPadding: 4,
        pointerRadius: 8,
      },
    ],
  },
];
