# Till POS

A countertop point-of-sale app for a café or small shop. Touch-friendly, works with a USB barcode scanner, and runs entirely in the browser.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # money, tax, refund and report checks
npm run build      # production build in dist/
```

Demo PINs: **1234** (Manager), **0000** (Cashier).

## What it does

- **Sale**: product tiles by category, search, barcode scan (just scan; no need to click the search box), custom open-price items, quantity +/−, per-line discount and note, whole-sale discount, hold/recall sales, void.
- **Payment**: cash with quick-note buttons and change due, card (simulated), split payments across both.
- **Receipts**: printable 80 mm till receipt; reprint from Transactions.
- **Transactions**: search by receipt number, full or partial refunds (manager only), optional restock.
- **Reports**: net sales, refunds, discounts, tax, cash vs card, sales by category, top products, for today / yesterday / 7 days / month / all time. Printable.
- **Products**: add/edit products, categories and tile colours, SKU, barcode, stock tracking with low/out-of-stock badges.
- **Settings**: store details, receipt footer, currency, tax rate (inclusive or added on top), staff and PINs, JSON backup, reset.

## How it's built

React + TypeScript + Vite, no UI framework. Money is stored in whole cents. Data lives in the browser's `localStorage`, so each device has its own copy. Export a backup from Settings.

- `src/lib/totals.ts`: discounts, tax, and refund maths (tested in `totals.test.ts`)
- `src/lib/sales.ts`: turns a cart into a sale or refund record
- `src/lib/reports.ts`: report totals
- `src/state/`: app data, actions, and saving
- `src/screens/`: one file per screen

Code conventions and pre-finish checks are in [`CODING_STANDARDS.md`](CODING_STANDARDS.md).

## Not included yet

Real card terminal integration, receipt printer drivers (it uses the browser print dialog), cash drawer kick, customer accounts, multi-device sync / a backend, and end-of-day Z-report closing.
