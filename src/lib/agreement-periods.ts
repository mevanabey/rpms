/** Monthly periods touched by an inclusive agreement range, anchored to its
 * start day. E.g. 2 Feb–1 Mar is one month, not two calendar months. This
 * counts billing periods; it does not calculate daily proration. */
export function agreementPeriodMonths(startIso: string, endIso: string): number {
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) return 0;
  const months = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + end.getUTCMonth() - start.getUTCMonth();
  return Math.max(1, months + (end.getUTCDate() >= start.getUTCDate() ? 1 : 0));
}
