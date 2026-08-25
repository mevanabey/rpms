import type { ILeaseService } from "./leases";
import type { IOnboardingWorkflow } from "./onboarding";
import type { IPartyService } from "./parties";
import type { IPaymentService } from "./payments";
import type { IPropertyService } from "./properties";
import type { IReminderService } from "./reminders";

/**
 * The full backend contract. Every adapter (mock / vercel / agent-fabriq)
 * implements exactly this shape — see CLAUDE.md §6.
 */
export interface Backend {
  leases: ILeaseService;
  parties: IPartyService;
  properties: IPropertyService;
  payments: IPaymentService;
  reminders: IReminderService;
  onboarding: IOnboardingWorkflow;
}

export type {
  ILeaseService,
  IOnboardingWorkflow,
  IPartyService,
  IPaymentService,
  IPropertyService,
  IReminderService,
};

export type {
  LeaseClausesPatch,
  LeaseCreateIntent,
  LeaseListFilter,
  LeaseUpdateInput,
  TrancheUpdateInput,
} from "./leases";
export type { OnboardingIntent, OnboardingStep, OnboardingState } from "./onboarding";
export type {
  PartyCreateInput,
  PartyListFilter,
  PartyUpdateInput,
} from "./parties";
export type {
  MarkPaidInput,
  PaymentListFilter,
} from "./payments";
export type {
  PropertyCreateInput,
  PropertyUpdateInput,
  UnitCreateInput,
} from "./properties";
export type { ReminderListFilter } from "./reminders";
