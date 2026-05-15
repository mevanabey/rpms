import type { Party, PartyRole } from "../types";

export interface PartyListFilter {
  role?: PartyRole;
  search?: string;
}

export interface IPartyService {
  list(filter?: PartyListFilter): Promise<Party[]>;
  get(id: string): Promise<Party | null>;
}
