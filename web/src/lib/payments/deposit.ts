import { money } from "@/lib/payments/record";

/** Percent of customer_total required before deposit_received_at is set. */
export const DEFAULT_DEPOSIT_PERCENT = 50;

export function depositThreshold(customerTotal: number, depositPercent: number): number {
  const percent = Number.isFinite(depositPercent) ? depositPercent : DEFAULT_DEPOSIT_PERCENT;
  return money((customerTotal * percent) / 100);
}

export function outstandingBalance(customerTotal: number, paid: number): number {
  return money(Math.max(0, customerTotal - paid));
}

export function depositIsCovered(customerTotal: number, depositPercent: number, paid: number): boolean {
  return paid + 0.001 >= depositThreshold(customerTotal, depositPercent);
}
