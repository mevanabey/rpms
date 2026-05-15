import type { Notification } from "../types";

export interface ReminderListFilter {
  leaseId?: string;
  status?: Notification["status"][];
}

export interface IReminderService {
  listQueue(filter?: ReminderListFilter): Promise<Notification[]>;
  /** Deterministic side: just queues. Phase 02 wires the real send. */
  enqueue(input: Omit<Notification, "id" | "status" | "sentAt" | "openedAt">): Promise<Notification>;
}
