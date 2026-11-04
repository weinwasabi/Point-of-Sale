import { describe, expect, it } from 'vitest';
import { createSeedData } from '../data/seed';
import { reducer } from '../state/reducer';
import type { Cart, CartLine, Payment } from '../types';
import { applyKey } from './keypad';
import { formatMoney, parseMoney, sum } from './money';
import { rangeBounds, summarize } from './reports';
import { buildRefund, buildSale, transactionStatus } from './sales';
import { allocate, cashSuggestions, computeTotals, discountValue, refundAmountForLine } from './totals';

function line(unitPrice: number, qty: number, extra: Partial<CartLine> = {}): CartLine {
  return { id: `l${unitPrice}-${qty}`, productId: null, name: 'Item', categoryId: null, unitPrice, qty, discount: null, note: '', ...extra };
}

describe('money', () => {
  it('formats cents with grouping and sign', () => {
    expect(formatMoney(123456, '₱')).toBe('₱1,234.56');
    expect(formatMoney(-50, '₱')).toBe('-₱0.50');
  });

  it('parses typed amounts into cents', () => {
    expect(parseMoney('12.5')).toBe(1250);
    expect(parseMoney('1,000')).toBe(100000);
    expect(parseMoney('.75')).toBe(75);
    expect(parseMoney('')).toBeNull();
    expect(parseMoney('1.234')).toBeNull();
    expect(parseMoney('abc')).toBeNull();
  });
});

describe('keypad', () => {
  it('builds decimal amounts', () => {
    let v = '';
    for (const k of ['5', '0', '0'] as const) v = applyKey(v, k, { decimals: 2 });
    expect(v).toBe('500');
    expect(applyKey('', '.', { decimals: 2 })).toBe('0.');
    expect(applyKey('1.25', '9', { decimals: 2 })).toBe('1.25');
    expect(applyKey('0', '7', { decimals: 2 })).toBe('7');
    expect(applyKey('12', 'back', { decimals: 2 })).toBe('1');
  });

  it('keeps leading zeros in PINs and caps length', () => {
    let v = '';
    for (const k of ['0', '0', '0', '0', '1'] as const) v = applyKey(v, k, { decimals: 0, maxLength: 4 });
    expect(v).toBe('0000');
  });
});

describe('totals', () => {
  it('caps discounts at the base amount', () => {
    expect(discountValue(1000, { kind: 'percent', value: 10 })).toBe(100);
    expect(discountValue(1000, { kind: 'amount', value: 5000 })).toBe(1000);
    expect(discountValue(1000, { kind: 'percent', value: 150 })).toBe(1000);
  });

  it('extracts tax from tax-inclusive prices', () => {
    const cart: Cart = { lines: [line(11200, 1)], discount: null };
    const t = computeTotals(cart, { rate: 12, inclusive: true });
    expect(t.total).toBe(11200);
    expect(t.tax).toBe(1200);
  });

  it('adds tax on top for tax-exclusive prices', () => {
    const cart: Cart = { lines: [line(10000, 1)], discount: null };
    const t = computeTotals(cart, { rate: 12, inclusive: false });
    expect(t.tax).toBe(1200);
    expect(t.total).toBe(11200);
  });

  it('applies line discounts before the order discount', () => {
    const cart: Cart = {
      lines: [line(15000, 2, { discount: { kind: 'percent', value: 10 } }), line(5000, 1)],
      discount: { kind: 'amount', value: 2000 },
    };
    const t = computeTotals(cart, { rate: 12, inclusive: true });
    expect(t.subtotal).toBe(27000 + 5000);
    expect(t.lineDiscounts).toBe(3000);
    expect(t.orderDiscount).toBe(2000);
    expect(t.total).toBe(30000);
    expect(sum(t.shares)).toBe(t.total);
  });

  it('allocates totals so the parts always add up', () => {
    expect(allocate(1000, [1, 1, 1])).toEqual([334, 333, 333]);
    expect(sum(allocate(9999, [333, 777, 1]))).toBe(9999);
    expect(allocate(0, [0, 0])).toEqual([0, 0]);
  });

  it('suggests likely cash notes above the amount due', () => {
    expect(cashSuggestions(24300)).toEqual([24500, 25000, 26000, 30000]);
    expect(cashSuggestions(0)).toEqual([]);
  });
});

describe('sales and refunds', () => {
  function sellAndRefund() {
    let state = createSeedData();
    const latte = state.products.find((p) => p.name === 'Café Latte')!;
    const croissant = state.products.find((p) => p.name === 'Butter Croissant')!;
    state = reducer(state, { type: 'cart/addProduct', product: latte });
    state = reducer(state, { type: 'cart/addProduct', product: latte });
    state = reducer(state, { type: 'cart/addProduct', product: latte });
    state = reducer(state, { type: 'cart/addProduct', product: croissant });
    state = reducer(state, { type: 'cart/setDiscount', discount: { kind: 'percent', value: 10 } });

    const staff = state.staff[0];
    const totals = computeTotals(state.cart, { rate: 12, inclusive: true });
    const payments: Payment[] = [{ id: 'p1', method: 'cash', amount: totals.total, tendered: 100000 }];
    const sale = buildSale({ cart: state.cart, settings: state.settings, staff, payments, change: 100000 - totals.total, number: state.nextNumber, now: new Date() });
    state = reducer(state, { type: 'sale/record', transaction: sale });
    return { state, sale, staff, croissantId: croissant.id };
  }

  it('records the sale, clears the cart and reduces tracked stock', () => {
    const { state, sale, croissantId } = sellAndRefund();
    expect(sale.lines).toHaveLength(2);
    expect(sale.lines[0].qty).toBe(3);
    expect(sale.total).toBe(Math.round((45000 + 9500) * 0.9));
    expect(state.cart.lines).toHaveLength(0);
    expect(state.nextNumber).toBe(1002);
    expect(state.products.find((p) => p.id === croissantId)!.stock).toBe(11);
  });

  it('refunds in parts without paying back more than was taken', () => {
    let { state, sale, staff } = sellAndRefund();
    const latteLine = sale.lines[0];

    const first = buildRefund({ original: sale, selections: [{ lineId: latteLine.id, qty: 1 }], method: 'cash', reason: '', restock: true, staff, number: state.nextNumber, now: new Date() });
    state = reducer(state, { type: 'refund/record', refund: first });
    let updated = state.transactions.find((t) => t.id === sale.id)!;
    expect(transactionStatus(updated)).toBe('partial');

    const rest = updated.lines.map((l) => ({ lineId: l.id, qty: l.qty - l.refundedQty }));
    const second = buildRefund({ original: updated, selections: rest, method: 'card', reason: 'Wrong order', restock: true, staff, number: state.nextNumber, now: new Date() });
    state = reducer(state, { type: 'refund/record', refund: second });
    updated = state.transactions.find((t) => t.id === sale.id)!;

    expect(first.total + second.total).toBe(sale.total);
    expect(transactionStatus(updated)).toBe('refunded');
    expect(refundAmountForLine(updated.lines[0], 1)).toBe(0);
    expect(state.products.find((p) => p.name === 'Butter Croissant')!.stock).toBe(12);
  });

  it('reports net sales after refunds', () => {
    let { state, sale, staff } = sellAndRefund();
    const refund = buildRefund({ original: sale, selections: [{ lineId: sale.lines[1].id, qty: 1 }], method: 'cash', reason: '', restock: false, staff, number: state.nextNumber, now: new Date() });
    state = reducer(state, { type: 'refund/record', refund });

    const { from, to } = rangeBounds('today', new Date());
    const report = summarize(state.transactions, state.categories, from, to);
    expect(report.salesCount).toBe(1);
    expect(report.refundsCount).toBe(1);
    expect(report.netSales).toBe(sale.total - refund.total);
    expect(report.itemsSold).toBe(3);
    const cash = report.byMethod.find((m) => m.method === 'cash')!;
    expect(cash.sales - cash.refunds).toBe(report.netSales);
  });

  it('does not record a duplicate sale or reuse its receipt number', () => {
    const { state, sale } = sellAndRefund();
    expect(reducer(state, { type: 'sale/record', transaction: sale })).toBe(state);
    expect(reducer(state, { type: 'sale/record', transaction: { ...sale, id: 'another-id' } })).toBe(state);
  });

  it('allows a fully discounted sale with no payment', () => {
    const initial = createSeedData();
    const cart: Cart = { lines: [line(1000, 1)], discount: { kind: 'percent', value: 100 } };
    const sale = buildSale({
      cart,
      settings: initial.settings,
      staff: initial.staff[0],
      payments: [],
      change: 0,
      number: initial.nextNumber,
      now: new Date(),
    });
    expect(sale.total).toBe(0);
    expect(reducer(initial, { type: 'sale/record', transaction: sale }).transactions).toHaveLength(1);
  });

  it('rejects an unknown, unauthorized, or over-limit refund without changing the sale', () => {
    const { state, sale, staff } = sellAndRefund();
    const refund = buildRefund({
      original: sale,
      selections: [{ lineId: sale.lines[0].id, qty: 1 }],
      method: 'cash',
      reason: '',
      restock: false,
      staff,
      number: state.nextNumber,
      now: new Date(),
    });
    const examples = [
      { ...refund, refundOf: 'missing-sale' },
      { ...refund, staffId: state.staff.find((person) => person.role === 'cashier')!.id },
      { ...refund, lines: [{ ...refund.lines[0], qty: sale.lines[0].qty + 1 }] },
      { ...refund, lines: [{ ...refund.lines[0], productId: state.products[0].id }] },
      { ...refund, lines: [{ ...refund.lines[0], share: refund.lines[0].share + 1 }], total: refund.total + 1,
        payments: [{ ...refund.payments[0], amount: refund.total + 1, tendered: refund.total + 1 }] },
    ];
    for (const invalid of examples) {
      expect(reducer(state, { type: 'refund/record', refund: invalid })).toBe(state);
    }
    const recorded = reducer(state, { type: 'refund/record', refund });
    expect(recorded.transactions).toHaveLength(state.transactions.length + 1);
    expect(reducer(recorded, { type: 'refund/record', refund })).toBe(recorded);
  });
});
