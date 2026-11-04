import { createSeedData } from '../data/seed';
import { newId } from '../lib/id';
import { canRecordRefund, canRecordSale } from '../lib/recording';
import type {
  AppData,
  Cart,
  CartLine,
  Category,
  Cents,
  Discount,
  Product,
  Settings,
  Staff,
  Transaction,
} from '../types';

export type LinePatch = Partial<Pick<CartLine, 'qty' | 'discount' | 'note' | 'unitPrice' | 'name'>>;

export type Action =
  | { type: 'cart/addProduct'; product: Product }
  | { type: 'cart/addCustom'; name: string; price: Cents }
  | { type: 'cart/updateLine'; lineId: string; patch: LinePatch }
  | { type: 'cart/removeLine'; lineId: string }
  | { type: 'cart/setDiscount'; discount: Discount | null }
  | { type: 'cart/clear' }
  | { type: 'held/hold'; label: string; staffName: string; at: string }
  | { type: 'held/recall'; id: string }
  | { type: 'held/delete'; id: string }
  | { type: 'sale/record'; transaction: Transaction }
  | { type: 'refund/record'; refund: Transaction }
  | { type: 'product/save'; product: Product }
  | { type: 'product/delete'; id: string }
  | { type: 'category/save'; category: Category }
  | { type: 'category/delete'; id: string }
  | { type: 'staff/save'; staff: Staff }
  | { type: 'staff/delete'; id: string }
  | { type: 'settings/update'; settings: Settings }
  | { type: 'data/reset' };

const EMPTY_CART: Cart = { lines: [], discount: null };

function withCart(state: AppData, cart: Cart): AppData {
  return { ...state, cart };
}

function upsert<T extends { id: string }>(items: T[], item: T): T[] {
  return items.some((i) => i.id === item.id)
    ? items.map((i) => (i.id === item.id ? item : i))
    : [...items, item];
}

/** Add `direction * qty` to the stock of each tracked product in `qtyByProduct`. */
function adjustStock(products: Product[], qtyByProduct: Map<string, number>, direction: 1 | -1): Product[] {
  if (qtyByProduct.size === 0) return products;
  return products.map((p) => {
    const qty = qtyByProduct.get(p.id);
    return qty && p.trackStock ? { ...p, stock: p.stock + direction * qty } : p;
  });
}

function qtyByProduct(lines: { productId: string | null; qty: number }[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const l of lines) {
    if (l.productId) map.set(l.productId, (map.get(l.productId) ?? 0) + l.qty);
  }
  return map;
}

export function reducer(state: AppData, action: Action): AppData {
  switch (action.type) {
    case 'cart/addProduct': {
      const { product } = action;
      const lines = state.cart.lines;
      // Tapping the same product again bumps its quantity, unless that line was customised.
      const index = lines.findIndex(
        (l) => l.productId === product.id && !l.discount && !l.note && l.unitPrice === product.price,
      );
      const next =
        index >= 0
          ? lines.map((l, i) => (i === index ? { ...l, qty: l.qty + 1 } : l))
          : [
              ...lines,
              {
                id: newId(),
                productId: product.id,
                name: product.name,
                categoryId: product.categoryId,
                unitPrice: product.price,
                qty: 1,
                discount: null,
                note: '',
              },
            ];
      return withCart(state, { ...state.cart, lines: next });
    }

    case 'cart/addCustom':
      return withCart(state, {
        ...state.cart,
        lines: [
          ...state.cart.lines,
          {
            id: newId(),
            productId: null,
            name: action.name,
            categoryId: null,
            unitPrice: action.price,
            qty: 1,
            discount: null,
            note: '',
          },
        ],
      });

    case 'cart/updateLine': {
      const { lineId, patch } = action;
      if (patch.qty !== undefined && patch.qty <= 0) {
        return withCart(state, { ...state.cart, lines: state.cart.lines.filter((l) => l.id !== lineId) });
      }
      return withCart(state, {
        ...state.cart,
        lines: state.cart.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)),
      });
    }

    case 'cart/removeLine':
      return withCart(state, { ...state.cart, lines: state.cart.lines.filter((l) => l.id !== action.lineId) });

    case 'cart/setDiscount':
      return withCart(state, { ...state.cart, discount: action.discount });

    case 'cart/clear':
      return withCart(state, EMPTY_CART);

    case 'held/hold':
      if (state.cart.lines.length === 0) return state;
      return {
        ...state,
        cart: EMPTY_CART,
        held: [
          ...state.held,
          { id: newId(), label: action.label, cart: state.cart, heldAt: action.at, staffName: action.staffName },
        ],
      };

    case 'held/recall': {
      const sale = state.held.find((h) => h.id === action.id);
      if (!sale || state.cart.lines.length > 0) return state;
      return { ...state, cart: sale.cart, held: state.held.filter((h) => h.id !== action.id) };
    }

    case 'held/delete':
      return { ...state, held: state.held.filter((h) => h.id !== action.id) };

    case 'sale/record': {
      const tx = action.transaction;
      if (!canRecordSale(state, tx)) return state;
      return {
        ...state,
        transactions: [...state.transactions, tx],
        nextNumber: Math.max(state.nextNumber, tx.number + 1),
        cart: EMPTY_CART,
        products: adjustStock(state.products, qtyByProduct(tx.lines), -1),
      };
    }

    case 'refund/record': {
      const { refund } = action;
      if (!canRecordRefund(state, refund)) return state;
      const transactions = state.transactions.map((t) => {
        if (t.id !== refund.refundOf) return t;
        return {
          ...t,
          refundIds: [...t.refundIds, refund.id],
          lines: t.lines.map((l) => {
            const returned = refund.lines.find((r) => r.id === l.id);
            return returned
              ? { ...l, refundedQty: l.refundedQty + returned.qty, refundedAmount: l.refundedAmount + returned.share }
              : l;
          }),
        };
      });
      return {
        ...state,
        transactions: [...transactions, refund],
        nextNumber: Math.max(state.nextNumber, refund.number + 1),
        products: refund.restocked ? adjustStock(state.products, qtyByProduct(refund.lines), 1) : state.products,
      };
    }

    case 'product/save':
      return { ...state, products: upsert(state.products, action.product) };

    case 'product/delete':
      return { ...state, products: state.products.filter((p) => p.id !== action.id) };

    case 'category/save':
      return { ...state, categories: upsert(state.categories, action.category) };

    case 'category/delete':
      if (state.products.some((p) => p.categoryId === action.id)) return state;
      return { ...state, categories: state.categories.filter((c) => c.id !== action.id) };

    case 'staff/save':
      return { ...state, staff: upsert(state.staff, action.staff) };

    case 'staff/delete': {
      const remaining = state.staff.filter((s) => s.id !== action.id);
      if (!remaining.some((s) => s.role === 'manager')) return state;
      return { ...state, staff: remaining };
    }

    case 'settings/update':
      return { ...state, settings: action.settings };

    case 'data/reset':
      return createSeedData();
  }
}
