import type { Property, Unit, UnitStatus, UnitType } from "../types";

export interface PropertyCreateInput {
  name: string;
  addressLine: string;
  city: string;
  district?: string;
  lotNo?: string;
  planNo?: string;
  perches?: number;
  asstNo?: string;
  ownerPartyId?: string;
  /** Optional legal_entity code (e.g. "CTH"). Falls back to the default. */
  legalEntityCode?: string;
}

export interface UnitCreateInput {
  propertyId: string;
  label: string;
  type: UnitType;
  floor?: string;
  areaSqft?: number;
  bedrooms?: number;
  status?: UnitStatus;
}

/**
 * Editable subset of a property. Only the keys present are written; `null`
 * clears a nullable field.
 */
export interface PropertyUpdateInput {
  name?: string;
  addressLine?: string;
  city?: string;
  district?: string | null;
  lotNo?: string | null;
  planNo?: string | null;
  perches?: number | null;
  asstNo?: string | null;
}

export interface IPropertyService {
  listProperties(): Promise<Property[]>;
  getProperty(id: string): Promise<Property | null>;
  listUnits(propertyId?: string): Promise<Unit[]>;
  createProperty(input: PropertyCreateInput): Promise<Property>;
  createUnit(input: UnitCreateInput): Promise<Unit>;
  /** Patch a property's own fields. Throws if the property doesn't exist. */
  updateProperty(id: string, patch: PropertyUpdateInput): Promise<Property>;
}
