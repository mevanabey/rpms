import type { Property, Unit } from "../types";

export interface IPropertyService {
  listProperties(): Promise<Property[]>;
  getProperty(id: string): Promise<Property | null>;
  listUnits(propertyId?: string): Promise<Unit[]>;
}
