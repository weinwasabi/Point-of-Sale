import type { Category, Cents, PaymentMethod, Transaction } from '../types';

export type RangeKey = 'today' | 'yesterday' | 'week' | 'month' | 'all';

export const RANGE_LABEL: Record<RangeKey, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  week: 'Last 7 days',
  month: 'This month',
  all: 'All time',
};

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Local-time bounds; `to` is exclusive. */
export function rangeBounds(key: RangeKey, now: Date): { from: Date | null; to: Date | null } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (key) {
    case 'today':
      return { from: today, to: addDays(today, 1) };
    case 'yesterday':
      return { from: addDays(today, -1), to: today };
    case 'week':
      return { from: addDays(today, -6), to: addDays(today, 1) };
    case 'month':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: addDays(today, 1) };
    case 'all':
      return { from: null, to: null };
  }
}

export interface MethodRow {
  method: PaymentMethod;
  sales: Cents;
  refunds: Cents;
}

export interface CategoryRow {
  id: string;
  name: string;
  qty: number;
  amount: Cents;
}

export interface ProductRow {
  key: string;
  name: string;
  qty: number;
  amount: Cents;
}

export interface Report {
  salesCount: number;
  grossSales: Cents;
  refundsCount: number;
  refundsTotal: Cents;
  netSales: Cents;
  netTax: Cents;
  discounts: Cents;
  averageSale: Cents;
  itemsSold: number;
  byMethod: MethodRow[];
  byCategory: CategoryRow[];
  topProducts: ProductRow[];
}

/** Totals for transactions in [from, to). Refunds count against the day they were issued. */
export function summarize(
  transactions: Transaction[],
  categories: Category[],
  from: Date | null,
  to: Date | null,
): Report {
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const methods = new Map<PaymentMethod, MethodRow>([
    ['cash', { method: 'cash', sales: 0, refunds: 0 }],
    ['card', { method: 'card', sales: 0, refunds: 0 }],
  ]);
  const byCategory = new Map<string, CategoryRow>();
  const byProduct = new Map<string, ProductRow>();

  let salesCount = 0;
  let grossSales = 0;
  let refundsCount = 0;
  let refundsTotal = 0;
  let netTax = 0;
  let discounts = 0;
  let itemsSold = 0;

  for (const t of transactions) {
    const at = new Date(t.createdAt);
    if ((from && at < from) || (to && at >= to)) continue;

    const sign = t.kind === 'sale' ? 1 : -1;
    if (t.kind === 'sale') {
      salesCount += 1;
      grossSales += t.total;
      netTax += t.tax;
      discounts += t.orderDiscount;
      for (const l of t.lines) discounts += l.lineDiscount;
    } else {
      refundsCount += 1;
      refundsTotal += t.total;
      netTax -= t.tax;
    }

    for (const p of t.payments) {
      const row = methods.get(p.method);
      if (!row) continue;
      if (t.kind === 'sale') row.sales += p.amount;
      else row.refunds += p.amount;
    }

    for (const l of t.lines) {
      itemsSold += sign * l.qty;

      const catId = l.categoryId ?? 'custom';
      const cat = byCategory.get(catId) ?? {
        id: catId,
        name: l.categoryId ? (categoryName.get(l.categoryId) ?? 'Deleted category') : 'Custom items',
        qty: 0,
        amount: 0,
      };
      cat.qty += sign * l.qty;
      cat.amount += sign * l.share;
      byCategory.set(catId, cat);

      const key = l.productId ?? `custom:${l.name}`;
      const product = byProduct.get(key) ?? { key, name: l.name, qty: 0, amount: 0 };
      product.qty += sign * l.qty;
      product.amount += sign * l.share;
      byProduct.set(key, product);
    }
  }

  return {
    salesCount,
    grossSales,
    refundsCount,
    refundsTotal,
    netSales: grossSales - refundsTotal,
    netTax,
    discounts,
    averageSale: salesCount ? Math.round(grossSales / salesCount) : 0,
    itemsSold,
    byMethod: [...methods.values()],
    byCategory: [...byCategory.values()].sort((a, b) => b.amount - a.amount),
    topProducts: [...byProduct.values()]
      .filter((p) => p.qty > 0)
      .sort((a, b) => b.qty - a.qty || b.amount - a.amount)
      .slice(0, 10),
  };
}
