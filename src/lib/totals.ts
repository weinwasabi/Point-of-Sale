import type { Cart, CartLine, Cents, Discount, SaleLine, Settings } from '../types';
import { sum } from './money';

export interface TaxConfig {
  /** Percent, e.g. 12. */
  rate: number;
  inclusive: boolean;
}

export function taxConfig(settings: Settings): TaxConfig {
  return { rate: settings.taxRate, inclusive: settings.taxInclusive };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** How much a discount takes off `base`. Never more than `base`. */
export function discountValue(base: Cents, discount: Discount | null): Cents {
  if (!discount || base <= 0) return 0;
  if (discount.kind === 'percent') {
    return Math.round((base * clamp(discount.value, 0, 100)) / 100);
  }
  return clamp(Math.round(discount.value), 0, base);
}

export function lineAmounts(line: Pick<CartLine, 'unitPrice' | 'qty' | 'discount'>) {
  const gross = line.unitPrice * line.qty;
  const discount = discountValue(gross, line.discount);
  return { gross, discount, net: gross - discount };
}

/**
 * Split `total` across lines in proportion to `weights`, so the parts add up
 * to exactly `total` (largest-remainder rounding).
 */
export function allocate(total: Cents, weights: Cents[]): Cents[] {
  const weightSum = sum(weights);
  if (weights.length === 0) return [];
  if (weightSum <= 0) return weights.map(() => 0);

  const raw = weights.map((w) => (total * w) / weightSum);
  const parts = raw.map(Math.floor);
  const leftover = total - sum(parts);
  const byRemainder = raw
    .map((r, i) => ({ i, frac: r - parts[i] }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; k < leftover; k++) parts[byRemainder[k % byRemainder.length].i] += 1;
  return parts;
}

export interface Totals {
  itemCount: number;
  /** Sum of line values after line discounts. */
  subtotal: Cents;
  lineDiscounts: Cents;
  orderDiscount: Cents;
  tax: Cents;
  total: Cents;
  /** Each line's portion of `total`, in cart order. */
  shares: Cents[];
}

export function computeTotals(cart: Cart, tax: TaxConfig): Totals {
  const amounts = cart.lines.map(lineAmounts);
  const nets = amounts.map((a) => a.net);
  const subtotal = sum(nets);
  const orderDiscount = discountValue(subtotal, cart.discount);
  const afterDiscount = subtotal - orderDiscount;

  let taxAmount: Cents;
  let total: Cents;
  if (tax.inclusive) {
    total = afterDiscount;
    taxAmount = Math.round((total * tax.rate) / (100 + tax.rate));
  } else {
    taxAmount = Math.round((afterDiscount * tax.rate) / 100);
    total = afterDiscount + taxAmount;
  }

  return {
    itemCount: sum(cart.lines.map((l) => l.qty)),
    subtotal,
    lineDiscounts: sum(amounts.map((a) => a.discount)),
    orderDiscount,
    tax: taxAmount,
    total,
    shares: allocate(total, nets),
  };
}

export function refundableQty(line: SaleLine): number {
  return line.qty - line.refundedQty;
}

/**
 * Money to give back for `qty` units of a sold line. Refunding the last
 * remaining units returns exactly what is left of the line, so a sale refunded
 * in several steps never pays back more or less than was taken.
 */
export function refundAmountForLine(line: SaleLine, qty: number): Cents {
  const remaining = refundableQty(line);
  if (qty <= 0 || remaining <= 0) return 0;
  if (qty >= remaining) return line.share - line.refundedAmount;
  return Math.round((line.share * qty) / line.qty);
}

/** Cash notes a customer is likely to hand over for `due`, above the exact amount. */
export function cashSuggestions(due: Cents): Cents[] {
  if (due <= 0) return [];
  const steps = [1, 5, 10, 20, 50, 100, 200, 500, 1000].map((d) => d * 100);
  const options = new Set<Cents>();
  for (const step of steps) {
    const rounded = Math.ceil(due / step) * step;
    if (rounded > due) options.add(rounded);
  }
  return [...options].sort((a, b) => a - b).slice(0, 4);
}
