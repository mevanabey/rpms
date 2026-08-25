/**
 * Pure clause model for the lease document — no rendering dependency.
 *
 * Reproduces the firm's two real templates verbatim (docs/new/lease-drafts/),
 * with only the bracketed variables substituted from the lease data:
 *   - commercial / bpo → Indenture of Lease (Lucky Seven pattern).
 *   - residential       → Condominium Lease Agreement (TRI-ZEN pattern).
 *
 * Both the DOCX builder (lease-docx.ts) and the on-screen preview
 * (lease-document-preview.tsx) consume this so the legal text lives once.
 */

import type { LeaseDocSettings } from "@/lib/demo/types";

import type { DocumentParty, LeaseDocumentData } from "./lease-document-data";

const DEFAULT_BRAND_LINE = "CAPITAL TRUST";
const DEFAULT_BRAND_TAGLINE = "Rental Property Management";
const DEFAULT_DRAFT_BANNER = "DRAFT — NOT YET EXECUTED. Subject to KYC and final review.";
const BLANK = "________________";

export type Block =
  | { kind: "center"; text: string }
  | { kind: "head"; text: string }
  | { kind: "para"; heading?: string; text: string };

export interface LeaseDocModel {
  title: string;
  subtitle: string;
  isDraft: boolean;
  draftBanner: string;
  brandLine: string;
  brandTagline: string;
  footerNote?: string;
  blocks: Block[];
  units: LeaseDocumentData["units"];
  scheduleHeading: string;
  sealLine: string;
  lessor: DocumentParty;
  lessee: DocumentParty;
  signatures?: LeaseDocumentData["signatures"];
  fileBaseName: string;
}

// ─────────────────────────────────────────────── value formatting

export function fig(m: { amount: number; currency: string } | undefined): string {
  if (!m) return BLANK;
  const n = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(m.amount);
  if (m.currency === "LKR") return `Rs. ${n}/-`;
  if (m.currency === "USD") return `USD ${n}/-`;
  return `${m.currency} ${n}/-`;
}

export function dt(iso: string | undefined): string {
  if (!iso) return BLANK;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "2-digit" });
}

function txt(v: string | number | undefined | null): string {
  if (v === undefined || v === null || v === "") return BLANK;
  return String(v);
}

function monthsBetween(a: string, b: string): number {
  const x = new Date(a);
  const y = new Date(b);
  if (Number.isNaN(x.getTime()) || Number.isNaN(y.getTime())) return 0;
  return (y.getFullYear() - x.getFullYear()) * 12 + (y.getMonth() - x.getMonth()) + 1;
}

function termYears(a: string, b: string): number {
  const m = monthsBetween(a, b);
  return m > 0 ? Math.round(m / 12) : 0;
}

function aggregate(
  tranches: LeaseDocumentData["tranches"],
): { amount: number; currency: string } | undefined {
  if (tranches.length === 0) return undefined;
  const currency = tranches[0].monthlyRent.currency;
  if (!tranches.every((t) => t.monthlyRent.currency === currency)) return undefined;
  let total = 0;
  for (const t of tranches) total += t.monthlyRent.amount * monthsBetween(t.startDate, t.endDate);
  return { amount: total, currency };
}

function scale(m: { amount: number; currency: string } | undefined, factor: number) {
  return m ? { amount: m.amount * factor, currency: m.currency } : undefined;
}

function partyName(p: DocumentParty, fallback: string): string {
  return p.legalName?.trim() || p.displayName?.trim() || fallback;
}

function isCompany(p: DocumentParty): boolean {
  return /(pvt|private limited|\bltd\b|\bplc\b|limited|holdings|residencies|towers|properties|company)/i.test(
    `${p.legalName ?? ""} ${p.displayName ?? ""}`,
  );
}

function responsibilitySentence(label: string, by: string | undefined): string {
  if (by === "lessor") return `The Lessor shall pay the ${label}`;
  if (by === "lessee") return `The Lessee shall pay the ${label}`;
  if (by === "shared") return `The ${label} shall be shared between the parties`;
  return `The ${label} shall be borne as agreed between the parties`;
}

function sublettingSentence(mode: string | undefined, note: string | undefined): string {
  const base =
    mode === "no"
      ? "The Lessee shall not sub-let or sublease the rights hereunder or part with possession of the Demised Premises or any part thereof to any third party during the Term of this Agreement."
      : mode === "with_consent"
        ? "The Lessee shall not sub-let or sublease the Demised Premises or any part thereof without the prior written consent of the Lessor."
        : mode === "to_group"
          ? "The Lessee may sub-let or sublease the Demised Premises only to its group entities or affiliates, remaining fully responsible for the conduct of such sub-lessee."
          : "The Lessee shall have the right to sub-let or sublease the rights hereunder during the Term provided that the Lessee shall bear all responsibilities pertaining thereto and shall indemnify and keep the Lessor indemnified from all suits, prosecutions, fines and damages arising in consequence.";
  return note ? `${base} ${note}` : base;
}

// ─────────────────────────────────────────────── residential agreement (TRI-ZEN)

function residentialBlocks(data: LeaseDocumentData): Block[] {
  const years = termYears(data.startDate, data.endDate);
  const unitCount = Math.max(1, data.units.length);
  const ratePerUnit = aggregate(data.tranches);
  const rateAll = scale(ratePerUnit, unitCount);
  const lessor = partyName(data.lessor, "the Lessor");
  const lessee = partyName(data.lessee, "the Lessee");
  const c = data.clauses;
  const depositAll = scale(data.securityDeposit, unitCount);

  const blocks: Block[] = [
    { kind: "para", text: `THIS AGREEMENT made and entered into at ${txt(data.property.city || "Colombo")} in the Republic of Sri Lanka on this ${dt(data.startDate)}` },
    { kind: "center", text: "BY AND BETWEEN" },
    {
      kind: "para",
      text: `${lessor}, a company duly incorporated under the laws of Sri Lanka, bearing registration No. ${txt(data.lessor.idNumber)} and having its registered office at ${txt(data.lessor.address)} (hereinafter sometimes called and referred to as the “LESSOR” which term or expression as herein used shall where the context so requires or admits mean and include the said ${lessor} and its successor and assigns) of the FIRST PART`,
    },
    { kind: "center", text: "AND" },
    {
      kind: "para",
      text: `${lessee}, ${isCompany(data.lessee) ? "a company duly incorporated under the laws of Sri Lanka, bearing registration" : "bearing"} No. ${txt(data.lessee.idNumber)} and having its ${isCompany(data.lessee) ? "registered office" : "address"} at ${txt(data.lessee.address)} (hereinafter called and referred to as “LESSEE” which term or expression as herein used shall where the context so requires or admits mean and include the said ${lessee} and its successor and assigns) of the OTHER PART`,
    },
    { kind: "center", text: "- WITNESSETH -" },
    {
      kind: "para",
      text: `WHEREAS the Lessor is seised and possessed of or otherwise well and sufficiently entitled to all the Residential Apartment Units morefully described in the First Schedule hereto (hereinafter collectively called and referred to as “Apartment Units” and individually as “Apartment Unit” as the context may require) depicted in the Condominium Plan${data.property.planNo ? " No. " + data.property.planNo : ""} located in the condominium building called and referred to as “${txt(data.property.name)}” (the “Building”) together with all the fixtures, fittings and equipment contained therein.`,
    },
    {
      kind: "para",
      text: `AND WHEREAS the Lessor has agreed to let, lease and demise unto the Lessee and the Lessee has agreed to take on lease the said Apartment Units which are morefully described in the First Schedule hereto located in the Building together with the furniture fixtures and fittings thereon morefully described in the Annexure hereto marked “Annexure X” signed and acknowledged by both parties, for a period of ${years} year commencing on the ${dt(data.startDate)} and ending on the ${dt(data.endDate)} and subject to the terms and conditions hereinafter contained.`,
    },
    { kind: "para", text: "NOW THIS AGREEMENT WITNESSETH AND IT IS HEREBY AGREED BETWEEN THE LESSOR AND THE LESSEE AS FOLLOWS:" },
    {
      kind: "para",
      text: `That in pursuance of the said Agreement and in consideration of the rents by the Lessee as hereinafter provided and of the covenants and conditions hereinafter contained on the part of the Lessee to be paid done observed and performed the Lessor doth hereby let lease and demised unto the Lessee the Apartment Units morefully described in the First Schedule hereto (hereinafter sometimes collectively referred to as “Demised Premises”) located in the Building together with fixtures fittings and equipment morefully respectively described in the Annexure X hereto and all other rights ways means of access, privileges, easements, servitudes, advantages and appurtenances whatsoever thereunto belonging or in anywise appertaining or held to belong or be appurtenant thereto used or enjoyed therewith.`,
    },
    {
      kind: "para",
      text: `TO HOLD the said Apartment Units unto and to the use of the Lessee for the term and period of ${years} year commencing on the ${dt(data.startDate)} and ending on the ${dt(data.endDate)} (hereinafter called and referred to as “Term”)`,
    },
    {
      kind: "para",
      text: `YIELDING AND PAYING THEREFOR unto the Lessor during the said Term of ${years} year a rental of ${fig(ratePerUnit)} per Apartment Unit inclusive of all applicable taxes prevalent at the time of executing these presents${unitCount > 1 ? `, aggregating to a total of ${fig(rateAll)} for ${unitCount} Apartment Units` : ""} to be paid in the following manner:-`,
    },
  ];

  data.tranches.forEach((t, idx) => {
    const months = monthsBetween(t.startDate, t.endDate);
    const periodPerUnit = { amount: t.monthlyRent.amount * months, currency: t.monthlyRent.currency };
    const periodAll = scale(periodPerUnit, unitCount);
    const when = idx === 0 ? "on or before the execution of these Presents" : `on or before the ${dt(t.startDate)}`;
    blocks.push({
      kind: "para",
      text: `For the period commencing from ${dt(t.startDate)} to ${dt(t.endDate)} a total rental of ${fig(periodPerUnit)} per Apartment Unit (calculated at the rate of ${fig(t.monthlyRent)} per month per Apartment Unit), equivalent to ${months} months' rental per Apartment Unit${unitCount > 1 ? ` amounting to a sum of ${fig(periodAll)}` : ""} shall be paid ${when};`,
    });
  });

  blocks.push(
    {
      kind: "para",
      text: `For purposes of calculating Stamp Duty, the total value of this Indenture of Lease comprising of the aggregate value of Rent for the full Term Reserved hereunder amounts to ${fig(data.stampDuty)} only.`,
    },
    { kind: "center", text: "THE LESSEE TO THE INTENT THAT THE OBLIGATIONS MAY CONTINUE EQUALLY THROUGHOUT THE TERM HEREBY CREATED DOTH HEREBY COVENANT AND AGREE WITH THE LESSOR AS FOLLOWS:" },
    {
      kind: "para",
      heading: "Maintenance of the Demised Premises:",
      text: "The Lessee shall maintain and keep the Demised Premises and the fixtures fittings and equipment morefully respectively described in the Annexure X in a clean and sanitary state and in strict conformity with the rules and regulations laws and by laws of the relevant Local Authority or the Urban Development Authority and any other statutory body in force in the Democratic Socialist Republic of Sri Lanka and to keep the Lessor freed and indemnified from all prosecutions and fines which may be imposed in consequence of the breach or non-performance of any laws or by-laws as far as the Demised Premises are concerned.",
    },
    {
      kind: "para",
      text: "The Lessee shall make good any damages caused to the Demised Premises and to the fixtures fittings and equipment morefully described respectively in the Annexure X as a result of the Lessee, the Lessee's agents, employees, licensees and invitees' negligence or misuse.",
    },
    {
      kind: "para",
      heading: "Security Deposit:",
      text: `The Lessee shall deposit with the Lessor a sum of ${fig(data.securityDeposit)} equivalent to Three (03) months' lease rental per Apartment Unit${unitCount > 1 ? ` amounting to a total sum of ${fig(depositAll)}` : ""} as a Refundable Security Deposit to be refunded within One (01) month once the Lessee hands over peaceful and vacant possession of the said Demised Premises/Apartment Units unto the Lessor at the expiration or sooner determination thereof subject to deductions of any sum or sums of money that may be payable by the Lessee on any account whatsoever inclusive of any sums due on account of arrears of rent, unpaid electricity and water bills or for any damage caused (normal wear and tear excepted).`,
    },
    {
      kind: "para",
      text: "To avoid any confusion, where the rentals and/or any other payment due to the Lessor is to be paid by the Lessee in a currency other than in United States Dollars, then the rentals and/or any such other payment due to the Lessor shall be paid in a sum equivalent thereto converted at the prevailing exchange rates published by the Central Bank of Sri Lanka which would be the mid-rate as provided by the Lessor based on rates prevalent at the date of raising their invoice.",
    },
    {
      kind: "para",
      heading: "Authorization for the Lessor to enter the Demised Premises:",
      text: "The Lessee shall permit the Lessor or its agents, employees, officers or representatives where necessary with any workmen and appliances after reasonable notice in writing at all reasonable times to enter the Demised Premises for the purpose of inspecting the state and condition thereof or for effecting any repairs to the Demised Premises as the Lessor may deem necessary.",
    },
    {
      kind: "para",
      heading: "Usage and Purpose of the Lease:",
      text: `The Lessee shall use the Demised Premises only for residential purposes and not for any commercial or immoral purposes. At any given time, the total number of persons occupying each Apartment Unit in the Demised Premises morefully described in the First Schedule hereto shall not exceed ${txt(data.occupancyCap)} persons. It is strictly prohibited for the Lessee to bring any pets, birds and any other animals to the Demised Premises. The Lessee further warrants that throughout the Term all the occupiers shall have the requisite government permits and approvals to reside in Sri Lanka, and shall indemnify the Lessor against all costs, prosecutions and fines arising from any breach of any law, rule, regulation and/or by-law.`,
    },
    {
      kind: "para",
      heading: "No Commercial activities to be carried out:",
      text: "The Lessee shall not in any way or manner carry out any commercial activity at the Demised Premises or register any company or entity at the Demised Premises or use the address of the Demised Premises to register any such company or entity, and shall indemnify and keep the Lessor indemnified against all costs prosecutions and fines arising from any breach of this covenant.",
    },
    {
      kind: "para",
      heading: "Assignment of Lease upon Sale of Apartment:",
      text: "The Lessee agrees and acknowledges that the Lessor has the right to sell, transfer or convey the Apartment Unit(s) and/or the Demised Premises to any third party at the discretion of the Lessor, and that such sale, transfer or conveyance shall not affect the validity or enforceability of this Agreement. In such event all rights, duties and obligations of the Lessor shall be assigned to the new owner who shall be deemed the Lessor for all purposes herein, and this Agreement shall remain binding upon the Lessee and such new owner for the unexpired portion of the Term.",
    },
    { kind: "para", heading: "Subletting:", text: sublettingSentence(c?.sublettingAllowed, c?.sublettingNote) },
    {
      kind: "para",
      heading: "Utility Payments:",
      text: "The Lessee shall pay all charges that may be charged or levied for electricity, water, telephone and any other utility bill consumed and utilized on the Demised Premises during the said Term, and shall indemnify the Lessor against any and all suits, prosecutions and fines resulting from non-payment of the dues or misuse of the services. Copies of utility bills and receipts of payments shall be forwarded to the Lessor monthly.",
    },
    {
      kind: "para",
      heading: "Minor Repairs:",
      text: `The Lessee shall attend to all minor repairs and maintenance of the Demised Premises and to any fixture and fittings therein belonging to the Lessor at any one time below the sum of ${fig(c?.minorRepairsThreshold)} per one Apartment Unit, and effect all repairs which may be caused by any negligence, wilful act or omission on the part of the Lessee, and any replaced fixtures and fittings shall be of the same pattern and quality.`,
    },
    {
      kind: "para",
      heading: "No Structural Alterations:",
      text: "Not to make or effect any structural alterations or additions to the Demised Premises without the prior written consent of the Lessor and not to cut or damage the fixtures fittings and equipment, roof, floor, walls, windows, doors or any other part of the Demised Premises. The Lessor shall have no liability for the alterations or additions made and no compensation will be payable for improvements made by the Lessee at the expiry of these presents.",
    },
    {
      kind: "para",
      heading: "Vacant Possession:",
      text: "The Lessee shall at the expiration or sooner determination of the Term hereby created, peaceably and quietly deliver up, surrender and yield up the said Demised Premises/Apartment Units together with the fixtures fittings and equipment morefully respectively described in the Annexure X hereto unto the Lessor in good order and condition in accordance with the Lessee's covenants herein, reasonable wear and tear excepted.",
    },
    {
      kind: "para",
      text: `If at the expiration or the sooner determination of the Term, the Lessee fails or otherwise neglects to peaceably surrender and yield up unto the Lessor the Demised Premises, the Lessee shall pay to the Lessor ${fig(c?.handoverDelayPenalty)} per day per Apartment Unit as liquidated damages and not as a penalty for each day of delay in handing over vacant possession, and the Lessor shall have the right to sue the Lessee for ejectment and for the recovery of continuing damages.`,
    },
  );

  if (c?.maintenanceText) {
    blocks.push({ kind: "para", heading: "Maintenance and Cleanliness:", text: c.maintenanceText });
  }

  blocks.push(
    {
      kind: "para",
      heading: "Taxation:",
      text: "If the Lessee is required to make a Tax deduction in the nature of a Withholding Tax from the rent payments, the Lessor shall make that Tax deduction within the time allowed and in the minimum amount required by Sri Lankan law, and within thirty (30) days deliver to the Lessor evidence that the Tax deduction has been made together with the relevant Withholding Tax / Tax certificate.",
    },
    { kind: "center", text: "AND THE LESSOR TO THE INTENT THAT ITS OBLIGATIONS HEREIN CONTAINED SHALL CONTINUE THROUGHOUT THE TERM HEREBY CREATED, COVENANT WITH THE LESSEE AS FOLLOWS:" },
    {
      kind: "para",
      heading: "Assessment Rates and Taxes:",
      text: "The Lessor shall pay all Rates, Taxes and other levies imposed by the Local Authority in respect of the Demised Premises. In the event of any increase over and above the rates and taxes levied as at the date of these presents, such increased amount shall be paid by the Lessee.",
    },
    {
      kind: "para",
      heading: "Service Charges and Management Fees:",
      text: `${responsibilitySentence("service charges", c?.serviceChargesBy)}. ${responsibilitySentence("applicable management fees", c?.managementFeesBy)} payable to the management corporation or the developer (until the management corporation is formed) of the Building in respect of the Demised Premises.`,
    },
    {
      kind: "para",
      heading: "Peaceful and vacant possession:",
      text: "The Lessor covenants that the Lessee paying the rent hereby reserved and duly observing and performing the covenants and conditions herein contained shall peaceably and quietly possess and enjoy the said Demised Premises during the said Term without any unlawful interruption from or by the Lessor or any person lawfully claiming from or under them.",
    },
    { kind: "para", heading: "Title to the Demised Premises:", text: "The Lessor shall warrant and defend the title to the Demised Premises." },
    {
      kind: "para",
      heading: "Refunding Security Deposit:",
      text: `To refund to the Lessee within One (01) month of the handing over of vacant possession of the Demised Premises/Apartment Units at the expiry or sooner determination of the said Term the said sum of ${fig(data.securityDeposit)} per Apartment Unit paid as an interest-free Refundable Security Deposit, subject to the Lessor's right to deduct the cost of any damage and any arrears in utility payments.`,
    },
    { kind: "center", text: "PROVIDED ALWAYS AND IT IS HEREBY MUTUALLY AGREED BY AND BETWEEN THE PARTIES HERETO AS FOLLOWS:" },
    {
      kind: "para",
      heading: "Breach by the Lessee:",
      text: "If the Lessee shall commit a breach of any of the covenants on the part of the Lessee to be observed or performed, it shall be lawful for the Lessor to give reasonable time of Fourteen (14) days to remedy the breach, and thereafter if not remedied to re-enter upon the Demised Premises whereupon this demise shall absolutely determine, without prejudice to any antecedent right of action of the Lessor.",
    },
    {
      kind: "para",
      text: `Either party may terminate these presents before the expiry of the Term hereby created by giving the other party ${txt(c?.terminationNoticeMonths ?? 3)} months' prior notice in writing, and in the event of such prior termination the Lessor shall refund any unutilized balance of the Refundable Security Deposit (non-interest bearing) and any unutilized advance rent in respect of the remaining period.`,
    },
    {
      kind: "para",
      heading: "Renewal:",
      text: `If either party wishes to renew this Agreement, such party shall give the other written notice of its intention. Renewal shall be at the sole discretion of the Lessor and, upon the Lessor agreeing, the parties shall enter into a fresh lease agreement to be executed ${txt(c?.renewalNoticeMonths ?? 1)} month(s) prior to the expiry of the Term hereby created.`,
    },
    {
      kind: "para",
      heading: "Costs and expenses:",
      text: `Either party will bear its own legal expenses in respect of the preparation and execution of these presents, provided that the Stamp Duty${data.stampDuty ? ` (${fig(data.stampDuty)})` : ""} shall be borne and paid by the Lessee in terms of Section 6(C) of the Stamp Duty (Special Provisions) Act No. 12 of 2006.`,
    },
    {
      kind: "para",
      heading: "Governing Law and Jurisdiction:",
      text: "This Agreement shall be construed, interpreted and applied in accordance with and shall be governed by the laws applicable in Sri Lanka and shall be subject to the exclusive jurisdiction of the Courts held at Colombo. The parties acknowledge that the Demised Premises is exempted from the Rent Act and its amendments.",
    },
  );

  return blocks;
}

// ─────────────────────────────────────────────── commercial indenture (Lucky Seven)

function commercialBlocks(data: LeaseDocumentData): Block[] {
  const years = termYears(data.startDate, data.endDate);
  const agg = aggregate(data.tranches);
  const lessor = partyName(data.lessor, "the Lessor");
  const lessee = partyName(data.lessee, "the Lessee");
  const individual = !isCompany(data.lessor);
  const floors = data.units.map((u) => u.label).join(", ");
  const c = data.clauses;
  const adv = data.tranches[0]?.advanceSetoff;
  const advTotal = data.advanceMonths && adv ? { amount: data.advanceMonths * adv.amount, currency: adv.currency } : undefined;
  const lockYears = data.lockInEndDate ? termYears(data.startDate, data.lockInEndDate) : 0;
  const dueDay = data.tranches[0]?.dueDayOfMonth ?? 26;

  const blocks: Block[] = [
    {
      kind: "para",
      text: `THIS INDENTURE of Lease made and entered into at ${txt(data.property.city || "Colombo")} in the Democratic Socialist Republic of Sri Lanka on this ${dt(data.startDate)} between ${lessor} ${individual ? `(Holder of National Identity Card No. ${txt(data.lessor.idNumber)})` : `bearing registration No. ${txt(data.lessor.idNumber)}`} of ${txt(data.lessor.address)} (hereinafter called and referred to as the Lessor) which term or expression as herein used shall where the context so requires or admits mean and include the said ${lessor}${individual ? " his heirs, executors and administrators" : " and its successors and assigns"} of the First part`,
    },
    { kind: "center", text: "And" },
    {
      kind: "para",
      text: `${lessee} a company duly incorporated in the said Republic of Sri Lanka and registered under the Companies Act No. 7 of 2007 and bearing registration No. ${txt(data.lessee.idNumber)} and having its registered office at ${txt(data.lessee.address)} (hereinafter called and referred to as the “Lessee” which term or expression as herein used shall where the context so requires or admits mean and include the said ${lessee} and its successor or successors in business) of the Second part.`,
    },
    {
      kind: "para",
      text: `WHEREAS the Lessor is seised and possessed of or otherwise well and sufficiently entitled to all that land and premises bearing Assessment No. ${txt(data.property.addressLine)} and the building erected thereon, morefully described in the Schedule hereto.`,
    },
    {
      kind: "para",
      text: `AND WHEREAS the Lessor has agreed to let, lease and demise and the said Lessee has agreed to take on lease, subject to the terms and conditions hereinafter stipulated, ${floors || "the demised premises"} of the building standing on the premises in the Schedule hereto fully described${data.property.perches ? `, the land containing in extent ${data.property.perches} perches,` : ""} for a period of ${years} years at the rent and upon the terms, covenants and conditions contained herein.`,
    },
    { kind: "para", text: "NOW THIS INDENTURE WITNESSETH and it is hereby agreed by and between the parties as follows:-" },
    {
      kind: "para",
      text: `That in pursuance of the said Agreement and in consideration of the refundable deposit amounting to ${fig(data.securityDeposit)} well and truly paid by the Lessee to the Lessor at the time of execution of these presents, being a refundable security deposit to be refunded to the Lessee at the expiration or sooner determination of this lease after vacant possession of the demised premises shall have been handed over and after deducting such sums as may be necessary to pay unpaid bills and the payments hereinafter reserved, the Lessor doth hereby demise and lease unto the Lessee the demised premises together with the fixtures and fittings therein contained and all rights, ways, privileges, easements, servitudes and appurtenances thereto belonging.`,
    },
    {
      kind: "para",
      text: `TO HOLD the said demised premises unto the Lessee for the full term of ${years} Years commencing from the ${dt(data.startDate)} and ending on the ${dt(data.endDate)} (hereinafter referred to as the said term).`,
    },
    { kind: "head", text: "YIELDING AND PAYING therefor unto the Lessor the rental of;" },
  ];

  data.tranches.forEach((t) => {
    blocks.push({
      kind: "para",
      text: `${fig(t.monthlyRent)} per mensem for the period commencing from the ${dt(t.startDate)} and ending on the ${dt(t.endDate)}.`,
    });
  });

  if (agg) {
    blocks.push({
      kind: "para",
      text: `Aggregating to ${fig(agg)} for the full period of ${years} Years and payable in the manner following;`,
    });
  }
  if (advTotal) {
    blocks.push({
      kind: "para",
      text: `${fig(advTotal)} as rent in advance at or before the execution of these presents which shall be set off in ${data.advanceMonths} monthly installments of ${fig(adv)} each from and against the rent payable over the said term; and the balance rent payable in monthly installments on or before the ${dueDay}th day of each and every month, the first of such installments being payable on or before the execution of this Lease.`,
    });
  }

  blocks.push(
    { kind: "center", text: "THE LESSEE to the intent that the obligations may continue throughout the term hereby created covenants with the Lessor as follows:-" },
    { kind: "para", text: "To pay the Lessor the monthly balance rent without any deductions save as aforesaid on the due dates and in the manner aforesaid." },
    {
      kind: "para",
      text: "To keep the demised premises in a clean and sanitary state in good order and condition and in strict conformity with the laws and by-laws of the Authority having jurisdiction, and to keep the Lessor freed and indemnified from and against all prosecutions and fines which may be imposed in consequence of the breach or non-observance by the Lessee of any such laws or by-laws.",
    },
    {
      kind: "para",
      text: "To effect at the Lessee's cost and expense the re-decoration, colour-washing, tiling, air conditioning, shop-front glazing and glass paneling of the interior of the demised premises including repairs to and maintenance of the said items of work, such work to be attended to by a contractor appointed by the Lessee but approved by the Lessor in writing.",
    },
    {
      kind: "para",
      text: `Not to sub-let the demised premises without the prior written consent of the Lessor and to use the demised premises only for the purpose of carrying on ${data.purpose === "bpo" ? "Business Process Outsourcing (BPO) services to foreign clients such as Customer Support Services, Accounting, IT, HR and Entertainment" : "the permitted commercial business"} and for no other purpose whatsoever, and not to use the premises for any residential purpose without the Lessor's prior written approval.`,
    },
    {
      kind: "para",
      text: "To permit the Lessor and his agents, engineers, workmen and other persons authorized in writing by the Lessor to enter upon the demised premises at all reasonable hours after previous notice in writing to view and examine the state of repair and condition of the demised premises and to carry out structural repairs which it is the obligation of the Lessor to carry out.",
    },
    {
      kind: "para",
      text: "To pay and discharge all meter and other charges incidental to the supply of electricity and water to the demised premises to the respective authorities.",
    },
    {
      kind: "para",
      text: `To carry out all running maintenance and minor repairs to the demised premises up to a sum of ${fig(c?.minorRepairsThreshold)} per job per floor.`,
    },
    {
      kind: "para",
      text: "To reimburse the Lessor the Value Added Tax (VAT) or any other statutory payment in respect of the receipt by the Lessor of the rentals paid by the Lessee, within 14 days of the Lessor producing the relevant VAT invoice.",
    },
    {
      kind: "para",
      text: "At the expiration or sooner determination of this lease peaceably and quietly to surrender and yield up possession of the demised premises unto the Lessor in the same good order, state of repair and condition as at the commencement of this lease (reasonable wear and tear excepted) with all the Lessor's fixtures and fittings.",
    },
    { kind: "center", text: "THE LESSOR to the intent that the obligations on his part herein contained may continue throughout the term hereby granted covenants with the Lessee as follows:-" },
    {
      kind: "para",
      text: "That the Lessee paying the deposit and the rents hereby reserved and observing and performing the several conditions and agreements herein contained shall and may peaceably and quietly occupy and enjoy the demised premises during the said term without any interruption or disturbance from or by the Lessor or any person claiming under the Lessor.",
    },
    {
      kind: "para",
      text: "To pay and discharge all rates, taxes, assessments and other charges levied on the demised premises, provided that any increase over and above the rates payable as at the date hereof shall be borne by the Lessee.",
    },
    {
      kind: "para",
      text: "To warrant and defend the title of the demised premises and to keep the Lessee indemnified against all claims, prosecutions, demands, costs, damages, losses and outgoings arising out of any defect or dispute as to the title of the demised premises.",
    },
    {
      kind: "para",
      text: "To maintain the common services serving the demised premises including the passenger lift, the generator (adequate for the business of the Lessee), the allocated parking lots and the fire-detection system, and to insure and keep insured the buildings against fire, lightning, riots and civil commotion, terrorist activity, storms, floods and tempest.",
    },
    {
      kind: "para",
      text: `The Lessor agrees to refund to the Lessee the refundable deposit of ${fig(data.securityDeposit)} at the termination or sooner determination of this lease, subject to the right of the Lessor to set off the cost of any damage and any unpaid rentals, electricity, water or telephone bills.`,
    },
    { kind: "center", text: "PROVIDED ALWAYS and it is hereby mutually agreed and declared as follows:-" },
    {
      kind: "para",
      text: `If any of the covenants and conditions on the part of the Lessee herein contained shall not be observed or performed, the Lessor shall give to the Lessee ${txt(c?.terminationNoticeMonths ?? 3)} months notice in writing to observe or perform such covenant, and if at the expiration of the said notice such covenant shall not have been observed or performed then the Lessor shall be entitled to re-enter upon the demised premises whereupon this demise shall absolutely cease and determine, without prejudice to any right of action of either party in respect of any antecedent breach.`,
    },
  );

  if (data.lockInEndDate) {
    blocks.push(
      {
        kind: "para",
        text: `The Parties agree that the first ${lockYears} years of the Lease Term (up to ${dt(data.lockInEndDate)}) shall constitute the Lock-in Period, during which neither the Lessor nor the Lessee shall terminate this Lease Agreement except in the event of a material breach by the other party.`,
      },
      {
        kind: "para",
        text: "In the event the Lessee terminates the Lease during the Lock-in Period, the Lessee shall pay six (6) months' rent as liquidated damages, which the parties agree represent a genuine pre-estimate of the loss that would be suffered by the Lessor.",
      },
      {
        kind: "para",
        text: `Upon the expiry of the Lock-in Period, either party may terminate this Lease Agreement by giving the other party ${txt(c?.terminationNoticeMonths ?? 3)} months prior written notice; and if the Lessee terminates after the Lock-in Period the Lessee shall pay three (3) months' rent as liquidated damages to the Lessor.`,
      },
      {
        kind: "para",
        text: "In the event of early termination of this Lease by the Lessee (including termination during or after the Lock-in Period) the Lessee shall reimburse the Lessor fifty per cent (50%) of the stamp duty and legal fees paid at the time of execution of this Lease, within thirty (30) days of handing over vacant possession.",
      },
    );
  }

  blocks.push(
    {
      kind: "para",
      text: `That the Lessee duly observing and performing all the conditions herein and giving the Lessor notice in writing not later than ${txt(c?.renewalNoticeMonths ?? 12)} months before the expiration of the term that a renewal is required, the Lessor may grant a renewal of this Lease for a further term upon the rent, terms and conditions as may be mutually agreed at that time.`,
    },
    {
      kind: "para",
      text: `In case of delays in payment of the monthly rent for more than seven (7) days, the Lessee shall be liable for ${fig(c?.handoverDelayPenalty)} per delayed day as penalty; and if the monthly rent is delayed or not paid for a consecutive period of three months, it shall constitute a material breach entitling the Lessor to terminate this Lease and re-enter the premises.`,
    },
    {
      kind: "para",
      text: "The Lessee shall bear and pay the Stamp Duty payable on this Lease and the Lessor shall bear and pay all legal fees in connection with the preparation and execution of this Lease.",
    },
    {
      kind: "para",
      text: "Any notice required to be given hereunder shall be deemed sufficiently given if sent by registered post, in the case of the Lessor to the address mentioned hereof and in the case of the Lessee to the demised premises, and shall be deemed received on the next working day following the date of posting.",
    },
    { kind: "head", text: "THE FIRST SCHEDULE ABOVE REFERRED TO:" },
    {
      kind: "para",
      text: `All that allotment of land${data.property.lotNo ? ` marked Lot ${data.property.lotNo}` : ""}${data.property.planNo ? ` depicted in Survey Plan No. ${data.property.planNo}` : ""} together with the building and everything standing thereon bearing Assessment No. ${txt(data.property.addressLine)} situated at ${txt(data.property.city || "Colombo")}${data.property.perches ? ` and containing in extent ${data.property.perches} perches` : ""}, with the boundaries and registration particulars as more fully set out in the title deeds.`,
    },
  );

  return blocks;
}

// ─────────────────────────────────────────────── public model builder

export function leaseDocModel(data: LeaseDocumentData, settings?: LeaseDocSettings): LeaseDocModel {
  const isResidential = data.purpose === "residential";
  const title = (settings?.agreementTitleOverride?.trim() || data.agreementTitle).toUpperCase();
  const sealLine = isResidential
    ? `IN WITNESS WHEREOF the duly authorised signatories of the Lessor and the Lessee have set their respective hands hereunto and to three others of the same tenor and date as these presents at ${data.property.city || "Colombo"} on ${dt(data.startDate)}.`
    : "IN WITNESS WHEREOF the Lessor set his hand and the Lessee hath caused the Common Seal to be affixed hereunto and to three others of the same tenor and date as these presents on the day, month and year first above written.";

  return {
    title,
    subtitle: `${data.property.name}${data.units.length > 0 ? ` · ${data.units.map((u) => u.label).join(", ")}` : ""}`,
    isDraft: data.isDraft,
    draftBanner: settings?.draftBannerText?.trim() || DEFAULT_DRAFT_BANNER,
    brandLine: settings?.brandLine?.trim() || DEFAULT_BRAND_LINE,
    brandTagline: settings?.brandTagline?.trim() || DEFAULT_BRAND_TAGLINE,
    footerNote: settings?.footerNote?.trim() || undefined,
    blocks: isResidential ? residentialBlocks(data) : commercialBlocks(data),
    units: data.units,
    scheduleHeading: isResidential ? "THE FIRST SCHEDULE ABOVE REFERRED TO" : "Demised premises",
    sealLine,
    lessor: data.lessor,
    lessee: data.lessee,
    signatures: data.signatures,
    fileBaseName: `${(settings?.agreementTitleOverride?.trim() || data.agreementTitle).replace(/\s+/g, "-").toLowerCase()}-${data.id}`,
  };
}
