import type { Money, PaymentCadence, PaymentMethod } from "../types";

export interface OnboardingIntent {
  propertyId: string;
  unitIds: string[];
  lessorPartyId: string;
  lesseePartyId: string;
  clientPartyId?: string;
  tenantPartyId?: string;
  introducerPartyId?: string;
  handlerPartyId?: string;
  monthlyRent: Money;
  startDate: string;
  durationMonths: number;
  cadence: PaymentCadence;
  defaultPaymentMethod: PaymentMethod;
  securityDeposit?: Money;
  graceMonths?: number;
}

export type OnboardingStep =
  | "kyc_collect"
  | "draft_generate"
  | "lawyer_review"
  | "esign_send"
  | "esign_await"
  | "money_collect_initial"
  | "schedule_materialize"
  | "compliance_kickoff"
  | "welcome_notify"
  | "commission_accrue"
  | "done";

export interface OnboardingState {
  leaseId: string;
  step: OnboardingStep;
  finished: boolean;
  error?: string;
  startedAt: string;
  updatedAt: string;
}

export interface IOnboardingWorkflow {
  initiate(intent: OnboardingIntent): Promise<{ leaseId: string; state: OnboardingState }>;
  status(leaseId: string): Promise<OnboardingState | null>;
}
