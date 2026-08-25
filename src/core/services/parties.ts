import type { Party, PartyKind } from "../types";

export interface PartyListFilter {
  role?: import("../types").PartyRole;
  search?: string;
}

export interface PartyCreateInput {
  kind: PartyKind;
  displayName: string;
  legalName?: string;
  nicOrPassport?: string;
  companyRegNo?: string;
  emails?: string[];
  phones?: string[];
  address?: string;
  notes?: string;
  /** Optional legal_entity code (e.g. "CTH") to scope this party to. */
  legalEntityCode?: string;
}

/**
 * Editable subset of a party. Only the keys present are written; `null` clears
 * a nullable field.
 */
export interface PartyUpdateInput {
  kind?: PartyKind;
  displayName?: string;
  legalName?: string | null;
  nicOrPassport?: string | null;
  companyRegNo?: string | null;
  emails?: string[];
  phones?: string[];
  address?: string | null;
  notes?: string | null;
}

export interface IPartyService {
  list(filter?: PartyListFilter): Promise<Party[]>;
  get(id: string): Promise<Party | null>;
  create(input: PartyCreateInput): Promise<Party>;
  /** Patch a party's own fields. Throws if the party doesn't exist. */
  update(id: string, patch: PartyUpdateInput): Promise<Party>;
}
