import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { ConfirmModal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { formatMoney, sum } from '../lib/money';
import { canRecordSale } from '../lib/recording';
import { buildSale } from '../lib/sales';
import { computeTotals, lineAmounts, taxConfig } from '../lib/totals';
import { useStore } from '../state/store';
import type { Cents, Payment, Product, Staff } from '../types';
import { PaymentModal } from './PaymentModal';
import { CustomItemModal, HoldModal, LineEditorModal, OrderDiscountModal, ReceiptModal, RecallModal } from './SaleModals';

type SaleModal =
  | null
  | { kind: 'line'; lineId: string }
  | { kind: 'discount' }
  | { kind: 'custom' }
  | { kind: 'hold' }
  | { kind: 'recall' }
  | { kind: 'void' }
  | { kind: 'pay' }
  | { kind: 'receipt'; transactionId: string };

const LOW_STOCK = 5;

export function SaleScreen({ staff }: { staff: Staff }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const { settings, categories, products, cart, held } = state;
  const [categoryId, setCategoryId] = useState('all');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<SaleModal>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const totals = useMemo(() => computeTotals(cart, taxConfig(settings)), [cart, settings]);
  const money = (c: Cents) => formatMoney(c, settings.currencySymbol);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q) {
      return products.filter(
        (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase() === q || (p.barcode !== '' && p.barcode === q),
      );
    }
    return categoryId === 'all' ? products : products.filter((p) => p.categoryId === categoryId);
  }, [products, query, categoryId]);

  // A barcode scanner types like a keyboard. Send stray keystrokes to the search box
  // so scanning works without tapping the field first.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey || event.key.length !== 1 || event.key === ' ') return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement) return;
      searchRef.current?.focus();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  function addProduct(product: Product) {
    const inCart = sum(cart.lines.filter((l) => l.productId === product.id).map((l) => l.qty));
    dispatch({ type: 'cart/addProduct', product });
    if (product.trackStock && inCart + 1 > product.stock) {
      toast(`Stock warning: only ${Math.max(product.stock, 0)} ${product.name} on record.`, 'error');
    }
  }

  function submitSearch() {
    const q = query.trim();
    if (!q) return;
    const exact =
      products.find((p) => p.barcode !== '' && p.barcode === q) ??
      products.find((p) => p.sku.toLowerCase() === q.toLowerCase());
    const target = exact ?? (visible.length === 1 ? visible[0] : null);
    if (target) {
      addProduct(target);
      setQuery('');
    } else {
      toast(visible.length > 1 ? 'Several products match. Tap the one you want.' : `Nothing matches “${q}”.`, 'error');
    }
  }

  function completeSale(payments: Payment[], change: Cents) {
    const transaction = buildSale({ cart, settings, staff, payments, change, number: state.nextNumber, now: new Date() });
    if (!canRecordSale(state, transaction)) {
      toast('Sale could not be recorded. Check the payment and try again.', 'error');
      return;
    }
    dispatch({ type: 'sale/record', transaction });
    setModal({ kind: 'receipt', transactionId: transaction.id });
  }

  const editingLine = modal?.kind === 'line' ? cart.lines.find((l) => l.id === modal.lineId) : undefined;
  const receiptTx = modal?.kind === 'receipt' ? state.transactions.find((t) => t.id === modal.transactionId) : undefined;
  const hasItems = cart.lines.length > 0;

  return (
    <div className="sale">
      <section className="catalog" aria-label="Products">
        <form
          className="catalog-toolbar"
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            submitSearch();
          }}
        >
          <input
            ref={searchRef}
            className="search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search, or scan a barcode"
            aria-label="Search products or scan a barcode"
            autoComplete="off"
          />
          <button type="button" className="btn btn-lg" onClick={() => setModal({ kind: 'custom' })}>
            Custom item
          </button>
        </form>

        {!query && (
          <div className="category-tabs" role="toolbar" aria-label="Categories">
            <button type="button" className="chip" aria-pressed={categoryId === 'all'} onClick={() => setCategoryId('all')}>
              All
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                className="chip"
                style={{ '--chip': c.color } as CSSProperties}
                aria-pressed={categoryId === c.id}
                onClick={() => setCategoryId(c.id)}
              >
                <span className="chip-dot" aria-hidden="true" />
                {c.name}
              </button>
            ))}
          </div>
        )}

        <div className="product-grid">
          {visible.map((p) => {
            const color = categoryById.get(p.categoryId)?.color ?? '#475569';
            const stockState = !p.trackStock ? null : p.stock <= 0 ? 'out' : p.stock <= LOW_STOCK ? 'low' : 'ok';
            return (
              <button key={p.id} type="button" className="tile" style={{ '--tile': color } as CSSProperties} onClick={() => addProduct(p)}>
                <span className="tile-name">{p.name}</span>
                <span className="tile-meta">
                  <span className="tile-price num">{money(p.price)}</span>
                  {stockState && (
                    <span className={`tile-stock tile-stock-${stockState}`}>{stockState === 'out' ? 'Out of stock' : `${p.stock} left`}</span>
                  )}
                </span>
              </button>
            );
          })}
          {visible.length === 0 && <p className="empty grid-empty">No products {query ? `match “${query}”` : 'in this category yet'}.</p>}
        </div>
      </section>

      <aside className="basket" aria-label="Current sale">
        <header className="basket-head">
          <h2>Current sale</h2>
          <button type="button" className="btn btn-sm" onClick={() => setModal({ kind: 'recall' })}>
            Held{held.length > 0 ? ` (${held.length})` : ''}
          </button>
        </header>

        {hasItems ? (
          <ul className="basket-lines">
            {cart.lines.map((line) => {
              const amounts = lineAmounts(line);
              return (
                <li key={line.id} className="line">
                  <button type="button" className="line-main" onClick={() => setModal({ kind: 'line', lineId: line.id })}>
                    <span className="line-name">{line.name}</span>
                    <span className="line-detail">
                      {money(line.unitPrice)} each
                      {amounts.discount > 0 && ` · −${money(amounts.discount)}`}
                      {line.note && ` · ${line.note}`}
                    </span>
                  </button>
                  <div className="line-qty">
                    <button
                      type="button"
                      className="qty-btn"
                      aria-label={`One less ${line.name}`}
                      onClick={() => dispatch({ type: 'cart/updateLine', lineId: line.id, patch: { qty: line.qty - 1 } })}
                    >
                      −
                    </button>
                    <span className="num" aria-label={`Quantity ${line.qty}`}>
                      {line.qty}
                    </span>
                    <button
                      type="button"
                      className="qty-btn"
                      aria-label={`One more ${line.name}`}
                      onClick={() => dispatch({ type: 'cart/updateLine', lineId: line.id, patch: { qty: line.qty + 1 } })}
                    >
                      +
                    </button>
                  </div>
                  <span className="line-total num">{money(amounts.net)}</span>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="basket-empty">
            <p>Tap a product to start a sale.</p>
          </div>
        )}

        <dl className="totals">
          <div className="totals-row">
            <dt>Items</dt>
            <dd className="num">{totals.itemCount}</dd>
          </div>
          <div className="totals-row">
            <dt>Subtotal</dt>
            <dd className="num">{money(totals.subtotal)}</dd>
          </div>
          {totals.orderDiscount > 0 && (
            <div className="totals-row totals-discount">
              <dt>
                Discount{cart.discount?.kind === 'percent' ? ` (${cart.discount.value}%)` : ''}
              </dt>
              <dd className="num">−{money(totals.orderDiscount)}</dd>
            </div>
          )}
          {settings.taxRate > 0 && (
            <div className="totals-row totals-muted">
              <dt>
                {settings.taxName} {settings.taxRate}%{settings.taxInclusive ? ' (included)' : ''}
              </dt>
              <dd className="num">{money(totals.tax)}</dd>
            </div>
          )}
          <div className="totals-row totals-grand">
            <dt>Total</dt>
            <dd className="num">{money(totals.total)}</dd>
          </div>
        </dl>

        <div className="basket-actions">
          <button type="button" className="btn" disabled={!hasItems} onClick={() => setModal({ kind: 'discount' })}>
            Discount
          </button>
          <button type="button" className="btn" disabled={!hasItems} onClick={() => setModal({ kind: 'hold' })}>
            Hold
          </button>
          <button type="button" className="btn btn-danger-ghost" disabled={!hasItems} onClick={() => setModal({ kind: 'void' })}>
            Void sale
          </button>
        </div>

        <button type="button" className="pay-button" disabled={!hasItems} onClick={() => setModal({ kind: 'pay' })}>
          <span>Pay</span>
          <span className="num">{money(totals.total)}</span>
        </button>
      </aside>

      {editingLine && (
        <LineEditorModal
          line={editingLine}
          symbol={settings.currencySymbol}
          onClose={() => setModal(null)}
          onRemove={() => {
            dispatch({ type: 'cart/removeLine', lineId: editingLine.id });
            setModal(null);
          }}
          onSave={(patch) => {
            dispatch({ type: 'cart/updateLine', lineId: editingLine.id, patch });
            setModal(null);
          }}
        />
      )}
      {modal?.kind === 'discount' && (
        <OrderDiscountModal
          current={cart.discount}
          subtotal={totals.subtotal}
          symbol={settings.currencySymbol}
          onClose={() => setModal(null)}
          onApply={(discount) => {
            dispatch({ type: 'cart/setDiscount', discount });
            setModal(null);
          }}
        />
      )}
      {modal?.kind === 'custom' && (
        <CustomItemModal
          symbol={settings.currencySymbol}
          onClose={() => setModal(null)}
          onAdd={(name, price) => {
            dispatch({ type: 'cart/addCustom', name, price });
            setModal(null);
          }}
        />
      )}
      {modal?.kind === 'hold' && (
        <HoldModal
          suggested={`Sale ${held.length + 1}`}
          onClose={() => setModal(null)}
          onHold={(label) => {
            dispatch({ type: 'held/hold', label, staffName: staff.name, at: new Date().toISOString() });
            setModal(null);
            toast(`“${label}” is on hold.`);
          }}
        />
      )}
      {modal?.kind === 'recall' && (
        <RecallModal
          held={held}
          settings={settings}
          cartHasItems={hasItems}
          onClose={() => setModal(null)}
          onDelete={(id) => dispatch({ type: 'held/delete', id })}
          onRecall={(id) => {
            dispatch({ type: 'held/recall', id });
            setModal(null);
          }}
        />
      )}
      {modal?.kind === 'void' && (
        <ConfirmModal
          title="Void this sale?"
          message="All items and discounts in the current sale will be cleared. Nothing is recorded."
          confirmLabel="Void sale"
          onCancel={() => setModal(null)}
          onConfirm={() => {
            dispatch({ type: 'cart/clear' });
            setModal(null);
          }}
        />
      )}
      {modal?.kind === 'pay' && (
        <PaymentModal total={totals.total} symbol={settings.currencySymbol} onCancel={() => setModal(null)} onComplete={completeSale} />
      )}
      {receiptTx && <ReceiptModal transaction={receiptTx} settings={settings} onClose={() => setModal(null)} />}
    </div>
  );
}
