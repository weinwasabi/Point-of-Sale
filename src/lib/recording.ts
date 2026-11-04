import type { AppData, SaleLine, Transaction } from '../types';
import { refundAmountForLine } from './totals';

function cents(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function validLines(lines: SaleLine[]): boolean {
  return lines.length > 0 && new Set(lines.map((line) => line.id)).size === lines.length && lines.every((line) =>
    line.id.length > 0 && Number.isSafeInteger(line.qty) && line.qty > 0 &&
    cents(line.unitPrice) && cents(line.share) && cents(line.refundedAmount) &&
    Number.isSafeInteger(line.refundedQty) && line.refundedQty >= 0,
  );
}

function validPayment(tx: Transaction): boolean {
  return cents(tx.total) && (tx.total === 0 || tx.payments.length > 0) && tx.payments.every((payment) =>
    cents(payment.amount) && cents(payment.tendered) && payment.tendered >= payment.amount,
  ) && tx.payments.reduce((total, payment) => total + payment.amount, 0) === tx.total;
}

function unusedIdentity(state: AppData, tx: Transaction): boolean {
  return tx.id.length > 0 && Number.isSafeInteger(tx.number) && tx.number > 0 &&
    !state.transactions.some((existing) => existing.id === tx.id || existing.number === tx.number);
}

export function canRecordSale(state: AppData, sale: Transaction): boolean {
  return sale.kind === 'sale' && sale.refundOf === null && unusedIdentity(state, sale) &&
    validLines(sale.lines) && validPayment(sale) &&
    sale.lines.every((line) => line.refundedQty === 0 && line.refundedAmount === 0) &&
    sale.lines.reduce((total, line) => total + line.share, 0) === sale.total;
}

export function canRecordRefund(state: AppData, refund: Transaction): boolean {
  if (refund.kind !== 'refund' || !refund.refundOf || !unusedIdentity(state, refund) ||
      !validLines(refund.lines) || !validPayment(refund)) return false;

  const original = state.transactions.find((tx) => tx.id === refund.refundOf && tx.kind === 'sale');
  if (!original || !state.staff.some((staff) => staff.id === refund.staffId && staff.role === 'manager')) return false;

  return refund.lines.every((line) => {
    const sold = original.lines.find((item) => item.id === line.id);
    return sold !== undefined && line.productId === sold.productId &&
      line.qty <= sold.qty - sold.refundedQty &&
      line.share === refundAmountForLine(sold, line.qty) &&
      line.refundedQty === 0 && line.refundedAmount === 0;
  }) && refund.lines.reduce((total, line) => total + line.share, 0) === refund.total;
}
