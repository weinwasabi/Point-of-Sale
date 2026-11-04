import type { AppData, Category, Product } from '../types';

/** Tile colours, dark enough for white bold text to stay readable. */
export const CATEGORY_COLORS = [
  '#1d4ed8', // blue
  '#15803d', // green
  '#b45309', // amber
  '#b91c1c', // red
  '#6d28d9', // violet
  '#0e7490', // cyan
  '#be185d', // pink
  '#4d7c0f', // lime
  '#c2410c', // orange
  '#475569', // slate
];

const categories: Category[] = [
  { id: 'cat-coffee', name: 'Coffee', color: '#7c3f1d' },
  { id: 'cat-drinks', name: 'Tea & Drinks', color: CATEGORY_COLORS[5] },
  { id: 'cat-bakery', name: 'Bakery', color: CATEGORY_COLORS[2] },
  { id: 'cat-meals', name: 'Meals', color: CATEGORY_COLORS[3] },
  { id: 'cat-snacks', name: 'Snacks', color: CATEGORY_COLORS[4] },
  { id: 'cat-retail', name: 'Retail', color: CATEGORY_COLORS[0] },
];

type SeedProduct = [name: string, categoryId: string, price: number, stock?: number, barcode?: string];

const seedProducts: SeedProduct[] = [
  ['Espresso', 'cat-coffee', 100],
  ['Americano', 'cat-coffee', 120],
  ['Cappuccino', 'cat-coffee', 150],
  ['Café Latte', 'cat-coffee', 150],
  ['Mocha', 'cat-coffee', 165],
  ['Caramel Macchiato', 'cat-coffee', 175],
  ['Iced Latte', 'cat-coffee', 160],
  ['Cold Brew', 'cat-coffee', 170],
  ['Green Tea', 'cat-drinks', 110],
  ['Milk Tea', 'cat-drinks', 130],
  ['Calamansi Juice', 'cat-drinks', 90],
  ['Hot Chocolate', 'cat-drinks', 140],
  ['Bottled Water', 'cat-drinks', 35, 48, '4800000000017'],
  ['Soda in Can', 'cat-drinks', 55, 36, '4800000000024'],
  ['Ensaymada', 'cat-bakery', 65, 20],
  ['Pandesal (6 pcs)', 'cat-bakery', 40, 30],
  ['Butter Croissant', 'cat-bakery', 95, 12],
  ['Banana Bread', 'cat-bakery', 85, 10],
  ['Cheese Roll', 'cat-bakery', 55, 18],
  ['Chocolate Cookie', 'cat-bakery', 60, 4],
  ['Chicken Adobo Rice', 'cat-meals', 185],
  ['Beef Tapsilog', 'cat-meals', 195],
  ['Spaghetti', 'cat-meals', 160],
  ['Club Sandwich', 'cat-meals', 210],
  ['Pancit Canton', 'cat-meals', 150],
  ['Potato Chips', 'cat-snacks', 45, 40, '4800000000031'],
  ['Granola Bar', 'cat-snacks', 50, 25, '4800000000048'],
  ['Turon', 'cat-snacks', 35, 15],
  ['Coffee Beans 250g', 'cat-retail', 450, 8, '4800000000055'],
  ['Travel Tumbler', 'cat-retail', 495, 6, '4800000000062'],
  ['Ceramic Mug', 'cat-retail', 350, 0, '4800000000079'],
  ['Tote Bag', 'cat-retail', 280, 9, '4800000000086'],
];

function slug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function createSeedData(): AppData {
  const products: Product[] = seedProducts.map(([name, categoryId, price, stock, barcode], i) => ({
    id: `prd-${slug(name)}`,
    name,
    categoryId,
    price: price * 100,
    sku: `SKU-${String(i + 1).padStart(3, '0')}`,
    barcode: barcode ?? '',
    trackStock: stock !== undefined,
    stock: stock ?? 0,
  }));

  return {
    version: 1,
    settings: {
      storeName: 'Corner Café',
      address: '123 Main Street',
      phone: '',
      receiptFooter: 'Thank you, come again!',
      currencySymbol: '₱',
      taxName: 'VAT',
      taxRate: 12,
      taxInclusive: true,
    },
    staff: [
      { id: 'staff-manager', name: 'Manager', pin: '1234', role: 'manager' },
      { id: 'staff-cashier', name: 'Cashier', pin: '0000', role: 'cashier' },
    ],
    categories,
    products,
    transactions: [],
    held: [],
    cart: { lines: [], discount: null },
    nextNumber: 1001,
  };
}
