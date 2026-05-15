import type { Money } from "@/core/types";
import { formatCurrency } from "@/lib/utils";

type Props = {
  amount?: Money | null;
  noDecimals?: boolean;
  className?: string;
};

export function MoneyDisplay({ amount, noDecimals = true, className }: Props) {
  if (!amount) return <span className={className}>—</span>;
  return (
    <span className={className}>
      {formatCurrency(amount.amount, { currency: amount.currency, noDecimals })}
    </span>
  );
}
