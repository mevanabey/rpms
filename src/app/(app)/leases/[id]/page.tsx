import { notFound } from "next/navigation";
import Link from "next/link";

import { ArrowLeft, MapPin, Mail, Phone } from "lucide-react";

import { DocumentsCard } from "@/components/app/documents-card";
import { LeaseDocumentSection } from "@/components/app/lease-document-section";
import { LeaseScopeGate } from "@/components/app/lease-scope-gate";
import { LeaseStatusBadge, ObligationStatusBadge } from "@/components/app/status-badge";
import { MoneyDisplay } from "@/components/app/money-display";
import { SectionHeader } from "@/components/app/section-header";
import { SignedLeaseDialog } from "@/components/app/signed-lease-dialog";
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

const ROLE_LABELS: Record<string, string> = {
  lessor: "Lessor",
  lessee: "Lessee",
  client: "Client",
  tenant: "Tenant",
  introducer: "Introducer",
  advisor: "Advisor",
  lessor_lawyer: "Lessor's Lawyer",
  lessee_lawyer: "Lessee's Lawyer",
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
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const backend = getBackend();
  const lease = await backend.leases.get(id);
  if (!lease) notFound();

  const [parties, propertyAll, units, allObligations, allLedger] = await Promise.all([
    backend.parties.list(),
    backend.properties.getProperty(lease.propertyId),
    backend.properties.listUnits(lease.propertyId),
    backend.payments.listObligations(lease.id),
    backend.payments.listLedger({ leaseId: lease.id }),
  ]);

  const partyById = partyMap(parties);
  const unitById = unitMap(units);
  const lessor = partyById.get(lease.lessorPartyId);
  const lessee = partyById.get(lease.lesseePartyId);
  const total = totalConsideration(lease.tranches);

  const upcoming = allObligations
    .filter((o) => o.status !== "done")
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 12);
  const recentLedger = [...allLedger]
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate))
    .slice(0, 12);

  return (
    <LeaseScopeGate leaseId={lease.id}>
    <div className="@container/main flex flex-1 flex-col gap-4 md:gap-6">
      <div data-onborda="lease-detail-header">
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/leases">
            <ArrowLeft className="size-3.5" /> All leases
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-bold text-2xl tracking-tight">{lease.id}</h1>
              <LeaseStatusBadge status={lease.status} />
              <Badge variant="outline">{lease.kind}</Badge>
              <Badge variant="outline">{lease.purpose}</Badge>
            </div>
            <p className="mt-1 text-muted-foreground text-sm">
              {propertyAll?.name ?? "—"} · {lease.unitIds.length}{" "}
              {lease.unitIds.length === 1 ? "unit" : "units"} ·{" "}
              {formatDate(lease.startDate)} → {formatDate(lease.endDate)}
            </p>
          </div>
          <div className="flex gap-2">
            <SignedLeaseDialog
              leaseId={lease.id}
              title={propertyAll?.name ? `${propertyAll.name} · signed lease` : "Signed lease"}
              hasSignedPdf={lease.status !== "draft"}
            />
            <Button variant="outline" size="sm">
              Generate notice
            </Button>
          </div>
        </div>
      </div>

      {/* Top KPI strip */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Current rent</CardDescription>
            <CardTitle className="text-xl">
              <MoneyDisplay amount={lease.tranches[0]?.monthlyRent} />
              <span className="ml-1 text-muted-foreground text-xs">/ month</span>
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Total consideration</CardDescription>
            <CardTitle className="text-xl">
              <MoneyDisplay amount={total} />
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Security deposit</CardDescription>
            <CardTitle className="text-xl">
              <MoneyDisplay amount={lease.securityDeposit} />
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Stamp duty (2%)</CardDescription>
            <CardTitle className="text-xl">
              <MoneyDisplay amount={lease.stampDuty} />
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Parties + key dates */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Parties</CardTitle>
            <CardDescription>Roles defined in the lease.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <PartyTile label="Lessor" name={lessor?.displayName ?? "—"} legal={lessor?.legalName} ids={lessor?.nicOrPassport ?? lessor?.companyRegNo} address={lessor?.address} emails={lessor?.emails} phones={lessor?.phones} />
            <PartyTile label="Lessee" name={lessee?.displayName ?? "—"} legal={lessee?.legalName} ids={lessee?.nicOrPassport ?? lessee?.companyRegNo} address={lessee?.address} emails={lessee?.emails} phones={lessee?.phones} />
            {lease.additionalRoles?.map((r) => {
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
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Key dates</CardTitle>
            <CardDescription>From the lease body.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <DateRow label="Start" date={lease.startDate} />
            <DateRow label="End" date={lease.endDate} />
            {lease.graceEndDate && <DateRow label="Grace ends" date={lease.graceEndDate} subtle />}
            {lease.lockInEndDate && (
              <DateRow label="Lock-in ends" date={lease.lockInEndDate} subtle />
            )}
            <Separator className="my-2" />
            <div className="text-muted-foreground text-xs">
              Cadence: <span className="text-foreground">{lease.paymentCadence}</span>
            </div>
            <div className="text-muted-foreground text-xs">
              Default payment:{" "}
              <span className="text-foreground">{lease.defaultPaymentMethod.replace("_", " ")}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Clauses & operations — captured by the lease intake form (per the
          lawyer/handler checklist). Empty fields are hidden. */}
      <ClausesCard lease={lease} />

      {/* Auto-generated lease document — viewable, downloadable, signable. */}
      <LeaseDocumentSection
        lease={lease}
        parties={parties}
        property={propertyAll ?? undefined}
        units={units}
      />

      {/* Documents — pulls anything attached via approvals (KYC, generated drafts, …) */}
      <DocumentsCard
        leaseId={lease.id}
        description="KYC IDs, generated drafts, signed instruments — everything attached during decisions on this lease."
        emptyState="No documents attached to decisions for this lease yet."
      />

      {/* Units */}
      <section className="flex flex-col gap-3">
        <SectionHeader
          title="Units covered"
          description={`${lease.unitIds.length} unit(s) on this lease.`}
        />
        <Card>
          <CardContent className="px-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Floor</TableHead>
                  <TableHead className="text-right">Area (sqft)</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lease.unitIds.map((uid) => {
                  const u = unitById.get(uid);
                  return (
                    <TableRow key={uid}>
                      <TableCell className="font-medium">{u?.label ?? uid}</TableCell>
                      <TableCell>{u?.type ?? "—"}</TableCell>
                      <TableCell>{u?.floor ?? "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {u?.areaSqft ? u.areaSqft.toLocaleString() : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{u?.status ?? "—"}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* Tranches */}
      <section className="flex flex-col gap-3">
        <SectionHeader
          title="Rent schedule"
          description="Escalation tranches. Per lease clause § 3."
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
                <TableHead>Due day</TableHead>
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
                    <TableCell>{t.dueDayOfMonth}</TableCell>
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Due</TableHead>
                    <TableHead>Kind</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Paid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentLedger.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground text-sm">
                        No ledger entries yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {recentLedger.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell>{formatDate(e.dueDate)}</TableCell>
                      <TableCell className="text-xs">{e.kind}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCurrency(
                          e.direction === "out" ? -e.amount.amount : e.amount.amount,
                          { currency: e.amount.currency, noDecimals: true },
                        )}
                      </TableCell>
                      <TableCell>
                        {e.paidDate ? (
                          <Badge variant="outline" className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                            {formatDate(e.paidDate)}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200">
                            unpaid
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
    </LeaseScopeGate>
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
  name: string;
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

function DateRow({ label, date, subtle }: { label: string; date: string; subtle?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className={subtle ? "text-muted-foreground" : ""}>{label}</span>
      <span className="font-medium tabular-nums">{formatDate(date)}</span>
    </div>
  );
}

const RESPONSIBLE_LABEL: Record<string, string> = {
  lessor: "Lessor (Landlord)",
  lessee: "Lessee (Tenant)",
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
  lessee: "Refunded to Lessee (Tenant)",
  lessor: "Refunded to Lessor (Landlord)",
  other: "Other",
};

const AGREEMENT_LABEL: Record<string, string> = {
  lease_agreement: "Lease Agreement",
  rental_agreement: "Rental Agreement",
  other: "Other",
};

function ClausesCard({
  lease,
}: {
  lease: import("@/core/types").Lease;
}) {
  const c = lease.clauses;

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
  if (typeof lease.advanceMonths === "number") {
    rows.push({
      label: "Advance payment",
      value: `${lease.advanceMonths} month${lease.advanceMonths === 1 ? "" : "s"}`,
    });
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
          / job
        </span>
      ),
    });
  }
  if (c?.handoverDelayPenalty) {
    rows.push({
      label: "Handover delay penalty",
      value: (
        <span className="tabular-nums">
          {formatCurrency(c.handoverDelayPenalty.amount, {
            currency: c.handoverDelayPenalty.currency,
            noDecimals: true,
          })}{" "}
          / day
        </span>
      ),
    });
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
    rows.push({ label: "Early-termination penalty", value: c.earlyTerminationPenalty });
  }

  if (rows.length === 0 && !c?.maintenanceText) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Clauses & operations</CardTitle>
        <CardDescription>
          Captured at intake. Mirrors the lawyer/handler checklist.
        </CardDescription>
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
