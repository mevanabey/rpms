import { notFound } from "next/navigation";
import Link from "next/link";

import { ArrowLeft, ArrowUpRight, Building2, GitBranch, MapPin, Mail, Phone } from "lucide-react";

import { DocumentsCard } from "@/components/app/documents-card";
import { LeaseDocumentSection } from "@/components/app/lease-document-section";
import { LeaseScopeGate } from "@/components/app/lease-scope-gate";
import { LeaseStatusBadge, ObligationStatusBadge } from "@/components/app/status-badge";
import { MoneyDisplay } from "@/components/app/money-display";
import { SectionHeader } from "@/components/app/section-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Money } from "@/core/types";
import { partyMap, unitMap } from "@/lib/lookup";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getBackend } from "@/server/container";
import { requireLeaseAccess } from "@/lib/auth/authorization";
import { getAssignableStaff } from "@/lib/auth/staff";
import { scopeByLease } from "@/lib/demo/scope";

import { LeaseDetailActions } from "./_components/lease-detail-actions";
import { LeaseEditBootstrap } from "./_components/lease-edit-bootstrap";
import { LeaseDetailsTable } from "./_components/lease-details-table";
import { LeaseProgressBlock } from "./_components/lease-progress-block";
import { LeaseParticipants } from "./_components/lease-participants";
import { LeaseViewSwitch } from "./_components/lease-view-switch";
import { RecentLedgerTable } from "./_components/recent-ledger-table";

const ROLE_LABELS: Record<string, string> = {
  lessor: "Landlord",
  lessee: "Tenant",
  client: "Client",
  tenant: "Tenant",
  introducer: "Introducer",
  advisor: "Advisor",
  lessor_lawyer: "Landlord's Lawyer",
  lessee_lawyer: "Tenant's Lawyer",
  accountant_handler: "Accountant / Handler",
  witness: "Witness",
};

function totalConsideration(tranches: { startDate: string; endDate: string; monthlyRent: Money }[]): Money | undefined {
  if (tranches.length === 0) return undefined;
  const currency = tranches[0].monthlyRent.currency;
  if (!tranches.every((t) => t.monthlyRent.currency === currency)) return undefined;
  let total = 0;
  for (const t of tranches) {
    const months = monthsBetween(t.startDate, t.endDate);
    total += t.monthlyRent.amount * months;
  }
  return { amount: total, currency };
}

function monthsBetween(startIso: string, endIso: string): number {
  const start = new Date(startIso);
  const end = new Date(endIso);
  return (
    (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()) + 1
  );
}

export default async function LeaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const user = await requireLeaseAccess(id);
  // The leases list links here with ?edit=1 for its row-level Edit action —
  // the lease detail page is the one and only place a lease is edited.
  const startInEditMode = (user.role === "admin" || user.role === "account_manager") && query.edit === "1";
  const backend = getBackend();
  const lease = await backend.leases.get(id);
  if (!lease) notFound();

  const [allParties, propertyAll, propertyUnits, allObligations, allLedger, allLeases, staff] = await Promise.all([
    backend.parties.list(),
    backend.properties.getProperty(lease.propertyId),
    backend.properties.listUnits(lease.propertyId),
    backend.payments.listObligations(lease.id),
    backend.payments.listLedger({ leaseId: lease.id }),
    backend.leases.list(),
    user.role === "admin" || user.role === "account_manager" ? getAssignableStaff() : Promise.resolve([]),
  ]);
  const visibleLeases = scopeByLease(user, allLeases, (item) => item.id);
  const canEdit = user.role === "admin" || user.role === "account_manager";
  const partyIds = new Set([
    lease.lessorPartyId,
    lease.lesseePartyId,
    ...(lease.additionalRoles ?? []).map((item) => item.partyId),
  ]);
  const parties = canEdit ? allParties : allParties.filter((party) => partyIds.has(party.id));
  const units = canEdit ? propertyUnits : propertyUnits.filter((unit) => lease.unitIds.includes(unit.id));

  const partyById = partyMap(parties);
  const unitById = unitMap(units);
  const lessor = partyById.get(lease.lessorPartyId);
  const lessee = partyById.get(lease.lesseePartyId);
  const total = totalConsideration(lease.tranches);

  // Sub-lease nesting — paired tenancies created from a single checklist
  // (or wired manually) carry parentLeaseId; surface both directions.
  const parentLease = lease.parentLeaseId
    ? (visibleLeases.find((l) => l.id === lease.parentLeaseId) ?? null)
    : null;
  const childLeases = visibleLeases.filter((l) => l.parentLeaseId === lease.id);
  const parentLessee = parentLease ? partyById.get(parentLease.lesseePartyId) : undefined;

  const upcoming = allObligations
    .filter((o) => o.status !== "done")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 12);
  // Recurring-rent summary for the progress block. Falls back to the first
  // tranche's start date when the ledger has not been generated yet.
  const rentEntries = allLedger.filter(
    (e) => e.kind === "rent" && e.direction === "in",
  );
  const paid = rentEntries.filter((e) => Boolean(e.paidDate));
  const paymentsMade = paid.length;
  // IDs of already-paid rent entries — used by the Active panel to dedupe
  // its optimistic Mark-paid overlay so a single payment isn't counted
  // twice (once optimistically, once after router.refresh).
  const serverPaidEntryIds = paid.map((e) => e.id);
  // Cumulative balance = Σ (paid − contracted) per rent line. Positive when
  // tenants have overpaid (credit on account), negative when they've paid
  // less than the contracted rent for any period (still owed). Skipping
  // currency mismatches — the headline figure uses the lease's rent currency.
  const cumulativeCurrency: "LKR" | "USD" =
    lease.tranches[0]?.monthlyRent.currency ?? paid[0]?.amount.currency ?? "LKR";
  const expectedFor = (dueDate: string) => {
    const tranche =
      lease.tranches.find((t) => t.startDate <= dueDate && dueDate <= t.endDate) ??
      lease.tranches[0];
    return tranche?.monthlyRent;
  };
  const cumulativeBalance =
    paid.length > 0
      ? {
          amount: paid.reduce((sum, e) => {
            if (e.amount.currency !== cumulativeCurrency) return sum;
            const expected = expectedFor(e.dueDate);
            if (!expected || expected.currency !== cumulativeCurrency) return sum;
            return sum + (e.amount.amount - expected.amount);
          }, 0),
          currency: cumulativeCurrency,
        }
      : undefined;
  const nextUnpaid = rentEntries
    .filter((e) => !e.paidDate)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
  const nextDueDate = nextUnpaid?.dueDate ?? lease.tranches[0]?.startDate;
  const today = new Date().toISOString().slice(0, 10);

  const recentLedger = [...allLedger]
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate))
    .slice(0, 12);

  return (
    <LeaseScopeGate leaseId={lease.id}>
    <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
      <LeaseEditBootstrap leaseId={lease.id} edit={startInEditMode} />
      <div data-onborda="lease-detail-header">
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/leases">
            <ArrowLeft className="size-3.5" /> All leases
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-bold text-2xl tracking-tight">
                {propertyAll?.name ?? lessee?.displayName ?? "Lease"}
              </h1>
              <LeaseStatusBadge status={lease.status} />
              <Badge variant="outline">{lease.kind}</Badge>
              <Badge variant="outline">{lease.purpose}</Badge>
            </div>
            <p className="mt-1 text-muted-foreground text-sm">
              <span className="text-foreground font-medium">
                {lessee?.displayName ?? "—"}
              </span>{" "}
              · {lease.unitIds.length}{" "}
              {lease.unitIds.length === 1 ? "unit" : "units"} ·{" "}
              {formatDate(lease.startDate)} → {formatDate(lease.endDate)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && <LeaseDetailActions lease={lease} parties={parties} />}
          </div>
        </div>
      </div>

      {parentLease && (
        <Card className="border-violet-200 bg-violet-50/40 dark:border-violet-900 dark:bg-violet-950/20">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="flex items-center gap-2 text-sm">
              <GitBranch className="size-4 text-violet-700 dark:text-violet-300" />
              <span className="text-muted-foreground">Sub-tenancy of</span>
              <Link
                href={`/leases/${parentLease.id}`}
                className="font-medium text-violet-800 hover:underline dark:text-violet-200"
              >
                {parentLessee?.displayName ?? parentLease.id}
              </Link>
              <Badge variant="outline" className="text-xs">
                {parentLease.kind} · {parentLease.purpose}
              </Badge>
            </div>
            <Button asChild variant="ghost" size="sm">
              <Link href={`/leases/${parentLease.id}`}>
                Open master <ArrowUpRight className="size-3.5" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Top KPI strip — above the progress panel so the operator sees the
          money figures before the workflow stepper. */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card>
          <CardHeader>
            <CardDescription>Monthly rental</CardDescription>
            <CardTitle className="text-xl">
              <MoneyDisplay amount={lease.tranches[0]?.monthlyRent} />
              <span className="ml-1 text-muted-foreground text-xs">/ month</span>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Advance payment</CardDescription>
            <CardTitle className="text-xl">
              {lease.clauses?.advancePaymentAmount ? (
                <MoneyDisplay amount={lease.clauses.advancePaymentAmount} />
              ) : typeof lease.advanceMonths === "number" ? (
                <>
                  {lease.advanceMonths}
                  <span className="ml-1 text-muted-foreground text-xs">
                    month{lease.advanceMonths === 1 ? "" : "s"}
                  </span>
                </>
              ) : (
                "—"
              )}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Refundable deposit</CardDescription>
            <CardTitle className="text-xl">
              <MoneyDisplay amount={lease.securityDeposit} />
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Stamp duty</CardDescription>
            <CardTitle className="text-xl">
              <MoneyDisplay amount={lease.stampDuty} />
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Legal fees</CardDescription>
            <CardTitle className="text-xl">
              <MoneyDisplay amount={lease.legalFees} />
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Total Rent of Lease</CardDescription>
            <CardTitle className="text-xl">
              <MoneyDisplay amount={total} />
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {canEdit && <LeaseProgressBlock
        leaseId={lease.id}
        status={lease.status}
        onboardingStage={lease.onboardingStage}
        agreementPath={lease.agreementPath}
        lawyerEmailSentAt={lease.lawyerEmailSentAt}
        advisorEmailSentAt={lease.advisorEmailSentAt}
        nextDueDate={nextDueDate}
        paymentsMade={paymentsMade}
        cumulativeBalance={cumulativeBalance}
        rentCurrency={lease.tranches[0]?.monthlyRent.currency}
        rentAmount={lease.tranches[0]?.monthlyRent}
        paymentCadence={lease.paymentCadence}
        serverPaidEntryIds={serverPaidEntryIds}
        today={today}
      />}

      <LeaseParticipants lease={lease} parties={parties} staff={staff}
        canEdit={canEdit} />

      {/* Below the progress block, the operator can toggle between the rich
          default layout and a compact two-column "details" table. The rent
          schedule + obligations + ledger render in BOTH views below this
          switch. Documents + Lease document also live in both at the bottom. */}
      <LeaseViewSwitch
        leaseId={lease.id}
        defaultView={
          <>
            <PremisesCard
              property={propertyAll ?? undefined}
              units={lease.unitIds.map((uid) => unitById.get(uid)).filter((u): u is NonNullable<typeof u> => Boolean(u))}
              purpose={lease.purpose}
              kind={lease.kind}
            />
          </>
        }
        detailsView={
          <LeaseDetailsTable
            lease={lease}
            parties={parties}
            property={propertyAll ?? undefined}
            units={units}
          />
        }
      />

      {/* Default-view-only block: parties, clauses, sub-tenancies, units.
          In details view these are replaced by the two-column table above. */}
      <LeaseViewSwitch
        leaseId={lease.id}
        detailsView={null}
        defaultView={
          <div className="flex flex-col gap-4 md:gap-6">
      {/* Parties + key dates */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Parties</CardTitle>
            <CardDescription>Roles defined in the lease.</CardDescription>
          </CardHeader>
          {(() => {
            // Dedicated tiles for Lawyer + Advisor on each side, always
            // rendered (placeholder when not on file). Other extra roles
            // (witness, introducer, …) still render as standalone tiles.
            const extras = lease.additionalRoles ?? [];
            const findParty = (role: string) => {
              const ref = extras.find((r) => r.role === role);
              return ref ? partyById.get(ref.partyId) : undefined;
            };
            const advisorParty = findParty("advisor");
            const landlordLawyer = findParty("lessor_lawyer");
            const tenantLawyer = findParty("lessee_lawyer");
            const landlordAdvisor = lease.kind === "sub" ? advisorParty : undefined;
            const tenantAdvisor = lease.kind === "head" ? advisorParty : undefined;
            const otherRoles = extras.filter(
              (r) =>
                r.role !== "lessor_lawyer" &&
                r.role !== "lessee_lawyer" &&
                r.role !== "advisor",
            );
            return (
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <PartyTile
                  label="Landlord"
                  name={lessor?.displayName ?? "—"}
                  legal={lessor?.legalName}
                  ids={lessor?.nicOrPassport ?? lessor?.companyRegNo}
                  address={lessor?.address}
                  emails={lessor?.emails}
                  phones={lessor?.phones}
                />
                <PartyTile
                  label="Tenant"
                  name={lessee?.displayName ?? "—"}
                  legal={lessee?.legalName}
                  ids={lessee?.nicOrPassport ?? lessee?.companyRegNo}
                  address={lessee?.address}
                  emails={lessee?.emails}
                  phones={lessee?.phones}
                />
                <RoleTile label="Landlord's Lawyer" party={landlordLawyer} />
                <RoleTile label="Tenant's Lawyer" party={tenantLawyer} />
                <RoleTile label="Landlord's Advisor" party={landlordAdvisor} />
                <RoleTile label="Tenant's Advisor" party={tenantAdvisor} />
                {otherRoles.map((r) => {
                  const p = partyById.get(r.partyId);
                  return (
                    <PartyTile
                      key={`${r.role}_${r.partyId}`}
                      label={ROLE_LABELS[r.role] ?? r.role}
                      name={p?.displayName ?? "—"}
                      legal={p?.legalName}
                      ids={p?.nicOrPassport ?? p?.companyRegNo}
                      address={p?.address}
                      emails={p?.emails}
                      phones={p?.phones}
                    />
                  );
                })}
              </CardContent>
            );
          })()}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Key dates</CardTitle>
            <CardDescription>From the lease body.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <DateRow label="Start">{formatDate(lease.startDate)}</DateRow>
            <DateRow label="End">{formatDate(lease.endDate)}</DateRow>
            {lease.graceEndDate && (
              <DateRow label="Grace ends" subtle>
                {formatDate(lease.graceEndDate)}
              </DateRow>
            )}
            {lease.lockInEndDate && (
              <DateRow label="Locking period ends" subtle>
                {formatDate(lease.lockInEndDate)}
              </DateRow>
            )}
            <Separator className="my-2" />
            <div className="text-muted-foreground text-xs">
              Payment frequency:{" "}
              <span className="text-foreground">{lease.paymentCadence}</span>
            </div>
            <div className="text-muted-foreground text-xs">
              Default payment:{" "}
              <span className="text-foreground">
                {lease.defaultPaymentMethod.replace("_", " ")}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Clauses & operations — captured by the lease intake form (per the
          lawyer/handler checklist). Empty fields are hidden. */}
      <ClausesCard lease={lease} />

      {childLeases.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHeader
            title="Sub-tenancies"
            description={`${childLeases.length} sub-tenancy${childLeases.length === 1 ? "" : "ies"} under this lease.`}
          />
          <Card>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Term</TableHead>
                    <TableHead className="text-right">Monthly rental</TableHead>
                    <TableHead>Payment frequency</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {childLeases.map((c) => {
                    const childTenant = partyById.get(c.lesseePartyId);
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">
                          {childTenant?.displayName ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums">
                          {formatDate(c.startDate)} → {formatDate(c.endDate)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <MoneyDisplay amount={c.tranches[0]?.monthlyRent} />
                        </TableCell>
                        <TableCell className="text-xs">
                          {c.paymentCadence}
                        </TableCell>
                        <TableCell>
                          <LeaseStatusBadge status={c.status} />
                        </TableCell>
                        <TableCell>
                          <Button asChild variant="ghost" size="icon-sm" aria-label={`Open ${c.id}`}>
                            <Link href={`/leases/${c.id}`}>
                              <ArrowUpRight className="size-3.5" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      )}

      {/* Apartment / House / Office — units carried on the lease. */}
      <section className="flex flex-col gap-3">
        <SectionHeader
          title="Apartment/House/Office"
          description={`${lease.unitIds.length} unit(s) on this lease.`}
        />
        <Card>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit</TableHead>
                  <TableHead>Building Name</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Floor</TableHead>
                  <TableHead className="text-right">Area</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lease.unitIds.map((uid) => {
                  const u = unitById.get(uid);
                  const address = propertyAll
                    ? [propertyAll.addressLine, propertyAll.city]
                        .filter(Boolean)
                        .join(", ")
                    : "—";
                  return (
                    <TableRow key={uid}>
                      <TableCell className="font-mono text-xs">{u?.label ?? uid}</TableCell>
                      <TableCell className="font-medium">
                        {propertyAll?.name ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {address}
                      </TableCell>
                      <TableCell>{u?.floor ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {u?.areaSqft ? `${u.areaSqft.toLocaleString()} sqft` : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>
          </div>
        }
      />

      {/* Tranches */}
      <section className="flex flex-col gap-3">
        <SectionHeader
          title="Rent schedule"
          description="Escalation periods. Per lease clause § 3."
        />
        <Card>
          <CardContent className="px-0">
            <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Monthly rent</TableHead>
                <TableHead className="text-right">Advance set-off</TableHead>
                <TableHead className="text-right">Balance / month</TableHead>
                <TableHead className="text-right">Period total</TableHead>
                <TableHead>Due Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lease.tranches.map((t) => {
                const balance = t.advanceSetoff
                  ? { amount: t.monthlyRent.amount - t.advanceSetoff.amount, currency: t.monthlyRent.currency }
                  : t.monthlyRent;
                const months = monthsBetween(t.startDate, t.endDate);
                const periodTotal = {
                  amount: t.monthlyRent.amount * months,
                  currency: t.monthlyRent.currency,
                } as const;
                return (
                  <TableRow key={t.id}>
                    <TableCell>{t.sequence}</TableCell>
                    <TableCell>
                      {formatDate(t.startDate)} → {formatDate(t.endDate)}
                      <div className="text-muted-foreground text-xs">{months} months</div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <MoneyDisplay amount={t.monthlyRent} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      <MoneyDisplay amount={t.advanceSetoff} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <MoneyDisplay amount={balance} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <MoneyDisplay amount={periodTotal} />
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatDate(t.startDate)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </section>

      {/* Obligations + Ledger side by side */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <SectionHeader
            title="Upcoming obligations"
            description="Earliest 12 unfinished items. Each row maps back to a lease clause."
          />
          <Card>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Due</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Clause</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {upcoming.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground text-sm">
                        No outstanding obligations.
                      </TableCell>
                    </TableRow>
                  )}
                  {upcoming.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>{formatDate(o.dueDate)}</TableCell>
                      <TableCell className="text-xs">{o.kind.replace(/_/g, " ")}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <MoneyDisplay amount={o.amount} />
                      </TableCell>
                      <TableCell>
                        <ObligationStatusBadge status={o.status} />
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {o.sourceClause ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        <section className="flex flex-col gap-3">
          <SectionHeader
            title="Recent ledger"
            description="Last 12 entries by due date."
          />
          <Card>
            <CardContent className="px-0">
              <RecentLedgerTable
                leaseId={lease.id}
                serverEntries={recentLedger}
              />
            </CardContent>
          </Card>
        </section>
      </div>

      {/* Documents — KYC IDs, generated drafts, signed instruments. Lives at
          the bottom because the lease's primary identity (parties, money,
          tranches, ledger) is more useful day-to-day. */}
      <DocumentsCard
        leaseId={lease.id}
        description="KYC IDs, generated drafts, signed instruments — everything attached during decisions on this lease."
        emptyState="No documents attached to decisions for this lease yet."
      />

      {/* Auto-generated lease document — preview + sign. Collapsed by
          default; the operator already has "View agreement" in the header. */}
      <LeaseDocumentSection
        lease={lease}
        parties={parties}
        property={propertyAll ?? undefined}
        units={units}
        readOnly={!canEdit}
      />
    </div>
    </LeaseScopeGate>
  );
}

/** A party-or-placeholder tile. Same visual treatment as `PartyTile`; when
 *  the role isn't on file, shows "Not on file" instead of vanishing so the
 *  operator always sees the slot. */
function RoleTile({
  label,
  party,
}: {
  label: string;
  party?: import("@/core/types").Party;
}) {
  if (!party) {
    return (
      <div className="rounded-lg border p-3">
        <div className="text-muted-foreground text-[11px] uppercase tracking-wider">{label}</div>
        <div className="mt-0.5 italic text-muted-foreground text-sm">Not on file</div>
      </div>
    );
  }
  return (
    <PartyTile
      label={label}
      name={party.displayName}
      legal={party.legalName}
      ids={party.nicOrPassport ?? party.companyRegNo}
      address={party.address}
      emails={party.emails}
      phones={party.phones}
    />
  );
}

function PartyTile({
  label,
  name,
  legal,
  ids,
  address,
  emails,
  phones,
}: {
  label: string;
  name: React.ReactNode;
  legal?: string;
  ids?: string;
  address?: string;
  emails?: string[];
  phones?: string[];
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-muted-foreground text-[11px] uppercase tracking-wider">{label}</div>
      <div className="mt-0.5 font-medium">{name}</div>
      {legal && legal !== name && (
        <div className="text-muted-foreground text-xs">{legal}</div>
      )}
      {ids && <div className="mt-0.5 font-mono text-muted-foreground text-xs">{ids}</div>}
      {address && (
        <div className="mt-1.5 flex items-start gap-1.5 text-muted-foreground text-xs">
          <MapPin className="mt-0.5 size-3 shrink-0" /> <span>{address}</span>
        </div>
      )}
      {((emails?.length ?? 0) + (phones?.length ?? 0) > 0) && (
        <div className="mt-2 space-y-0.5 text-xs">
          {emails?.map((e) => (
            <div key={e} className="flex items-center gap-1.5 text-muted-foreground">
              <Mail className="size-3" /> {e}
            </div>
          ))}
          {phones?.map((p) => (
            <div key={p} className="flex items-center gap-1.5 text-muted-foreground">
              <Phone className="size-3" /> {p}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PremisesCard({
  property,
  units,
  purpose,
  kind,
}: {
  property?: import("@/core/types").Property;
  units: import("@/core/types").Unit[];
  purpose: import("@/core/types").LeasePurpose;
  kind: import("@/core/types").LeaseKind;
}) {
  if (!property) return null;
  return (
    <Card>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-muted p-2">
              <Building2 className="size-5 text-muted-foreground" />
            </div>
            <div>
              <div className="text-muted-foreground text-[11px] uppercase tracking-wider">
                Property Name
              </div>
              <div className="font-semibold text-lg leading-tight">
                {property.name}
              </div>
              <div className="mt-1 flex items-start gap-1.5 text-muted-foreground text-sm">
                <MapPin className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  {property.addressLine}
                  {property.city ? `, ${property.city}` : ""}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">{kind}</Badge>
            <Badge variant="outline">{purpose}</Badge>
            <Badge variant="outline">
              {units.length} {units.length === 1 ? "unit" : "units"}
            </Badge>
          </div>
        </div>
        {units.length > 0 && (
          <div className="flex flex-wrap gap-2 border-t pt-3">
            {units.map((u) => (
              <div
                key={u.id}
                className="flex flex-col rounded-md border bg-muted/40 px-3 py-2 text-xs"
              >
                <span className="font-medium font-mono">{u.label}</span>
                <span className="text-muted-foreground">
                  {[
                    u.type,
                    typeof u.bedrooms === "number" && u.bedrooms > 0
                      ? `${u.bedrooms}-bed`
                      : null,
                    u.floor ? `floor ${u.floor}` : null,
                    u.areaSqft ? `${u.areaSqft.toLocaleString()} sqft` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DateRow({
  label,
  children,
  subtle,
}: {
  label: string;
  children: React.ReactNode;
  subtle?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={subtle ? "text-muted-foreground" : ""}>{label}</span>
      <span className="font-medium tabular-nums">{children}</span>
    </div>
  );
}

const RESPONSIBLE_LABEL: Record<string, string> = {
  lessor: "Landlord",
  lessee: "Tenant",
  shared: "Shared",
  other: "Other",
};

const SUBLETTING_LABEL: Record<string, string> = {
  no: "Not permitted",
  with_consent: "Permitted with consent",
  to_group: "Permitted to group / affiliates",
  yes: "Permitted",
};

const DEPOSIT_REFUND_LABEL: Record<string, string> = {
  lessee: "Refunded to Tenant",
  lessor: "Refunded to Landlord",
  other: "Other",
};

const AGREEMENT_LABEL: Record<string, string> = {
  lease_agreement: "Lease",
  rental_agreement: "Rent",
  other: "Other",
};

function ClausesCard({
  lease,
}: {
  lease: import("@/core/types").Lease;
}) {
  const c = lease.clauses;
  // Per-unit-rate clauses (minor repairs, handover penalty) are stored as
  // the unit rate; on multi-unit leases the display appends " per unit"
  // so "USD 100 / day" reads correctly against a contract that says
  // "USD 100 per day per unit".
  const perUnitSuffix = lease.unitIds.length > 1 ? " per unit" : "";

  // Build rows so we can skip the whole card when nothing is populated.
  type Row = { label: string; value: React.ReactNode };
  const rows: Row[] = [];

  if (lease.agreementLabel) {
    rows.push({
      label: "Agreement type",
      value:
        lease.agreementLabel === "other"
          ? (lease.agreementLabelOther ?? "Other")
          : AGREEMENT_LABEL[lease.agreementLabel],
    });
  }
  // Advance payment now lives in the KPI strip above; surface the lease
  // currency here instead (LKR / USD), since that's the operator-facing
  // signal the checklist captures separately on rent rows.
  {
    const currency =
      lease.tranches[0]?.monthlyRent.currency ??
      lease.securityDeposit?.currency ??
      c?.advancePaymentAmount?.currency;
    if (currency) {
      rows.push({ label: "Currency (LKR/USD)", value: currency });
    }
  }
  if (typeof lease.occupancyCap === "number") {
    rows.push({
      label: "Occupancy cap",
      value: `Not more than ${lease.occupancyCap} persons`,
    });
  }

  if (c?.managementFeesBy) {
    rows.push({
      label: "Management fees paid by",
      value: (
        <span>
          {RESPONSIBLE_LABEL[c.managementFeesBy]}
          {c.managementFeesNote && (
            <span className="ml-1 text-muted-foreground">· {c.managementFeesNote}</span>
          )}
        </span>
      ),
    });
  }
  if (c?.serviceChargesBy) {
    rows.push({
      label: "Service charges paid by",
      value: (
        <span>
          {RESPONSIBLE_LABEL[c.serviceChargesBy]}
          {c.serviceChargesNote && (
            <span className="ml-1 text-muted-foreground">· {c.serviceChargesNote}</span>
          )}
        </span>
      ),
    });
  }
  if (c?.acServiceBy) {
    rows.push({
      label: "A/C service paid by",
      value: (
        <span>
          {RESPONSIBLE_LABEL[c.acServiceBy]}
          {c.acServiceNote && (
            <span className="ml-1 text-muted-foreground">· {c.acServiceNote}</span>
          )}
        </span>
      ),
    });
  }
  if (c?.minorRepairsThreshold) {
    rows.push({
      label: "Minor repairs threshold",
      value: (
        <span className="tabular-nums">
          {formatCurrency(c.minorRepairsThreshold.amount, {
            currency: c.minorRepairsThreshold.currency,
            noDecimals: true,
          })}{" "}
          / job{perUnitSuffix}
        </span>
      ),
    });
  }
  if (c?.handoverDelayPenalty) {
    rows.push({
      label: "Penalty for delay handover",
      value: (
        <span className="tabular-nums">
          {formatCurrency(c.handoverDelayPenalty.amount, {
            currency: c.handoverDelayPenalty.currency,
            noDecimals: true,
          })}{" "}
          / day{perUnitSuffix}
        </span>
      ),
    });
  }
  if (c?.acServicePeriod) {
    rows.push({ label: "A/C service period", value: c.acServicePeriod });
  }
  if (c?.additionalCharges) {
    rows.push({ label: "Additional charges", value: c.additionalCharges });
  }
  if (c?.taxApplicabilityNote || c?.taxApplicabilityBy) {
    rows.push({
      label: "Applicability of WHT & other taxes",
      value: (
        <span>
          {c.taxApplicabilityBy ? RESPONSIBLE_LABEL[c.taxApplicabilityBy] : "—"}
          {c.taxApplicabilityNote &&
            c.taxApplicabilityNote.toLowerCase() !==
              (c.taxApplicabilityBy ?? "") && (
              <span className="ml-1 text-muted-foreground">
                · {c.taxApplicabilityNote}
              </span>
            )}
        </span>
      ),
    });
  }
  if (c?.fxBasis) {
    rows.push({ label: "FX rate basis (USD)", value: c.fxBasis });
  }
  if (typeof c?.firstFxRate === "number") {
    rows.push({
      label: "First exchange rate",
      value: (
        <span className="tabular-nums">
          LKR {c.firstFxRate.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
          / USD
          {c.firstFxRateNote &&
            !/^\s*[\d.,\s]+$/.test(c.firstFxRateNote) && (
              <span className="ml-1 text-muted-foreground">
                · {c.firstFxRateNote}
              </span>
            )}
        </span>
      ),
    });
  }
  if (c?.lockInPeriodText) {
    rows.push({ label: "Locking period", value: c.lockInPeriodText });
  }
  if (c?.ctpLawyerName) {
    rows.push({ label: "CTP Lawyer", value: c.ctpLawyerName });
  }
  if (c?.legalFeesNote && !lease.legalFees) {
    rows.push({ label: "Legal fees (note)", value: c.legalFeesNote });
  }
  if (c?.stampDutyNote && !lease.stampDuty) {
    rows.push({ label: "Stamp duty (note)", value: c.stampDutyNote });
  }
  if (typeof c?.terminationNoticeMonths === "number") {
    rows.push({
      label: "Termination notice",
      value: `${c.terminationNoticeMonths} month${c.terminationNoticeMonths === 1 ? "" : "s"}`,
    });
  }
  if (typeof c?.renewalNoticeMonths === "number") {
    rows.push({
      label: "Renewal notice",
      value: `${c.renewalNoticeMonths} month${c.renewalNoticeMonths === 1 ? "" : "s"}`,
    });
  }
  if (c?.sublettingAllowed) {
    rows.push({
      label: "Subletting",
      value: (
        <span>
          {SUBLETTING_LABEL[c.sublettingAllowed]}
          {c.sublettingNote && (
            <span className="ml-1 text-muted-foreground">· {c.sublettingNote}</span>
          )}
        </span>
      ),
    });
  }
  if (c?.depositRefundTo) {
    rows.push({
      label: "Deposit credited to",
      value:
        c.depositRefundTo === "other"
          ? (c.depositRefundOther ?? "Other")
          : DEPOSIT_REFUND_LABEL[c.depositRefundTo],
    });
  }
  if (c?.earlyTerminationPenalty) {
    rows.push({ label: "Penalty for early termination", value: c.earlyTerminationPenalty });
  }

  if (rows.length === 0 && !c?.maintenanceText) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clauses & operations</CardTitle>
        {/* <CardDescription>
        </CardDescription> */}
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.length > 0 && (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm md:grid-cols-2">
            {rows.map((r, i) => (
              <div key={i} className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground text-xs uppercase tracking-wider">
                  {r.label}
                </dt>
                <dd className="font-medium">{r.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {c?.maintenanceText && (
          <div>
            <div className="text-muted-foreground text-xs uppercase tracking-wider">
              Maintenance & cleanliness
            </div>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">
              {c.maintenanceText}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
