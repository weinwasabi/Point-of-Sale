import type { Cart, Cents, Payment, PaymentMethod, SaleLine, Settings, Staff, Transaction } from '../types';
import { newId } from './id';
import { sum } from './money';
import { computeTotals, lineAmounts, refundAmountForLine, refundableQty, taxConfig } from './totals';

export function buildSale(args: {
  cart: Cart;
  settings: Settings;
  staff: Staff;
  payments: Payment[];
  change: Cents;
  number: number;
  now: Date;
}): Transaction {
  const { cart, settings, staff, payments, change, number, now } = args;
  const totals = computeTotals(cart, taxConfig(settings));
  const lines: SaleLine[] = cart.lines.map((line, i) => {
    const amounts = lineAmounts(line);
    return {
      ...line,
      lineDiscount: amounts.discount,
      net: amounts.net,
      share: totals.shares[i],
      refundedQty: 0,
      refundedAmount: 0,
    };
  });

  return {
    id: newId(),
    number,
    kind: 'sale',
    createdAt: now.toISOString(),
    staffId: staff.id,
    staffName: staff.name,
    lines,
    subtotal: totals.subtotal,
    orderDiscount: totals.orderDiscount,
    orderDiscountRule: cart.discount,
    tax: totals.tax,
    total: totals.total,
    payments,
    change,
    taxName: settings.taxName,
    taxRate: settings.taxRate,
    taxInclusive: settings.taxInclusive,
    refundOf: null,
    refundIds: [],
    reason: '',
    restocked: false,
  };
}

export interface RefundSelection {
  lineId: string;
  qty: number;
}

export function buildRefund(args: {
  original: Transaction;
  selections: RefundSelection[];
  method: PaymentMethod;
  reason: string;
  restock: boolean;
  staff: Staff;
  number: number;
  now: Date;
}): Transaction {
  const { original, selections, method, reason, restock, staff, number, now } = args;

  const lines: SaleLine[] = [];
  for (const selection of selections) {
    const line = original.lines.find((l) => l.id === selection.lineId);
    if (!line) continue;
    const qty = Math.min(selection.qty, refundableQty(line));
    if (qty <= 0) continue;
    const amount = refundAmountForLine(line, qty);
    lines.push({
      ...line,
      qty,
      discount: null,
      lineDiscount: 0,
      net: amount,
      share: amount,
      refundedQty: 0,
      refundedAmount: 0,
    });
  }

  const total = sum(lines.map((l) => l.share));
  const tax = original.total > 0 ? Math.round((total * original.tax) / original.total) : 0;

  return {
    id: newId(),
    number,
    kind: 'refund',
    createdAt: now.toISOString(),
    staffId: staff.id,
    staffName: staff.name,
    lines,
    subtotal: total,
    orderDiscount: 0,
    orderDiscountRule: null,
    tax,
    total,
    payments: [{ id: newId(), method, amount: total, tendered: total }],
    change: 0,
    taxName: original.taxName,
    taxRate: original.taxRate,
    taxInclusive: original.taxInclusive,
    refundOf: original.id,
    refundIds: [],
    reason,
    restocked: restock,
  };
}

export type TransactionStatus = 'completed' | 'partial' | 'refunded' | 'refund';

export function transactionStatus(t: Transaction): TransactionStatus {
  if (t.kind === 'refund') return 'refund';
  const sold = sum(t.lines.map((l) => l.qty));
  const returned = sum(t.lines.map((l) => l.refundedQty));
  if (returned === 0) return 'completed';
  return returned >= sold ? 'refunded' : 'partial';
}

export const STATUS_LABEL: Record<TransactionStatus, string> = {
  completed: 'Completed',
  partial: 'Part refunded',
  refunded: 'Refunded',
  refund: 'Refund',
};

export function canRefund(t: Transaction): boolean {
  return t.kind === 'sale' && t.lines.some((l) => refundableQty(l) > 0);
}

/** The method that took the most money, used as the default refund method. */
export function primaryMethod(t: Transaction): PaymentMethod {
  const cash = sum(t.payments.filter((p) => p.method === 'cash').map((p) => p.amount));
  const card = sum(t.payments.filter((p) => p.method === 'card').map((p) => p.amount));
  return card > cash ? 'card' : 'cash';
}

export function receiptNumber(n: number): string {
  return `#${String(n).padStart(6, '0')}`;
}
