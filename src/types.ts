/** All money is stored as whole cents (integers) to avoid floating-point drift. */
export type Cents = number;

export type Role = 'manager' | 'cashier';

export interface Staff {
  id: string;
  name: string;
  /** Exactly 4 digits, unique across staff. */
  pin: string;
  role: Role;
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Product {
  id: string;
  name: string;
  categoryId: string;
  price: Cents;
  sku: string;
  barcode: string;
  trackStock: boolean;
  stock: number;
}

export interface Discount {
  kind: 'percent' | 'amount';
  /** percent: 0–100. amount: cents. */
  value: number;
}

export interface CartLine {
  id: string;
  /** null for a custom (open-price) item. */
  productId: string | null;
  name: string;
  categoryId: string | null;
  unitPrice: Cents;
  qty: number;
  discount: Discount | null;
  note: string;
}

export interface Cart {
  lines: CartLine[];
  discount: Discount | null;
}

export interface HeldSale {
  id: string;
  label: string;
  cart: Cart;
  heldAt: string;
  staffName: string;
}

export type PaymentMethod = 'cash' | 'card';

export interface Payment {
  id: string;
  method: PaymentMethod;
  /** Amount applied to the sale. */
  amount: Cents;
  /** Amount handed over. Larger than `amount` only for cash with change due. */
  tendered: Cents;
}

export interface SaleLine extends CartLine {
  lineDiscount: Cents;
  /** Line value after its own discount. */
  net: Cents;
  /** This line's portion of the transaction total (after order discount, incl. tax). */
  share: Cents;
  refundedQty: number;
  refundedAmount: Cents;
}

export interface Transaction {
  id: string;
  number: number;
  kind: 'sale' | 'refund';
  createdAt: string;
  staffId: string;
  staffName: string;
  lines: SaleLine[];
  subtotal: Cents;
  orderDiscount: Cents;
  orderDiscountRule: Discount | null;
  tax: Cents;
  /** Always positive. A refund's total is money paid back. */
  total: Cents;
  payments: Payment[];
  change: Cents;
  taxName: string;
  taxRate: number;
  taxInclusive: boolean;
  /** Refunds: the sale they reverse. */
  refundOf: string | null;
  /** Sales: refunds issued against them. */
  refundIds: string[];
  reason: string;
  restocked: boolean;
}

export interface Settings {
  storeName: string;
  address: string;
  phone: string;
  receiptFooter: string;
  currencySymbol: string;
  taxName: string;
  /** Percent, e.g. 12 for 12%. */
  taxRate: number;
  taxInclusive: boolean;
}

export interface AppData {
  version: 1;
  settings: Settings;
  staff: Staff[];
  categories: Category[];
  products: Product[];
  transactions: Transaction[];
  held: HeldSale[];
  cart: Cart;
  nextNumber: number;
}
