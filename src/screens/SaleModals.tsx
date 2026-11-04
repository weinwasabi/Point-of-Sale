import { useState } from 'react';
import { DiscountEditor, Field, MoneyInput, readDiscount, toDiscountDraft, type DiscountDraft } from '../components/fields';
import { Keypad } from '../components/Keypad';
import { Modal } from '../components/Modal';
import { Receipt } from '../components/Receipt';
import { applyKey } from '../lib/keypad';
import { formatMoney, parseMoney, sum } from '../lib/money';
import { computeTotals, lineAmounts, taxConfig } from '../lib/totals';
import type { CartLine, Cents, Discount, HeldSale, Settings, Transaction } from '../types';
import type { LinePatch } from '../state/reducer';

export function LineEditorModal({
  line,
  symbol,
  onSave,
  onRemove,
  onClose,
}: {
  line: CartLine;
  symbol: string;
  onSave: (patch: LinePatch) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [qty, setQty] = useState(line.qty);
  const [price, setPrice] = useState((line.unitPrice / 100).toFixed(2));
  const [discount, setDiscount] = useState<DiscountDraft>(toDiscountDraft(line.discount));
  const [note, setNote] = useState(line.note);
  const isCustom = line.productId === null;

  const unitPrice = isCustom ? (parseMoney(price) ?? 0) : line.unitPrice;
  const parsed = readDiscount(discount, unitPrice * qty);
  const preview = lineAmounts({ unitPrice, qty, discount: parsed.discount });
  const money = (c: Cents) => formatMoney(c, symbol);

  function save() {
    if (parsed.error) return;
    onSave({ qty, discount: parsed.discount, note: note.trim(), ...(isCustom ? { unitPrice } : {}) });
  }

  return (
    <Modal
      title={line.name}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-danger-ghost" onClick={onRemove}>
            Remove item
          </button>
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={Boolean(parsed.error)}>
            Save · {money(preview.net)}
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="field">
          <span className="field-label" id="qty-label">
            Quantity
          </span>
          <div className="stepper" role="group" aria-labelledby="qty-label">
            <button type="button" className="btn btn-lg" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">
              −
            </button>
            <output className="stepper-value num" aria-live="polite">
              {qty}
            </output>
            <button type="button" className="btn btn-lg" onClick={() => setQty((q) => Math.min(999, q + 1))} aria-label="Increase quantity" data-autofocus>
              +
            </button>
          </div>
        </div>

        {isCustom && (
          <Field label="Unit price">{(id) => <MoneyInput id={id} value={price} onChange={setPrice} symbol={symbol} />}</Field>
        )}

        <fieldset className="fieldset">
          <legend>Line discount</legend>
          <DiscountEditor draft={discount} onChange={setDiscount} symbol={symbol} error={parsed.error} />
        </fieldset>

        <Field label="Note" hint="Printed on the receipt, e.g. “oat milk” or “no sugar”.">
          {(id) => <input id={id} value={note} maxLength={80} onChange={(e) => setNote(e.target.value)} />}
        </Field>
      </div>
    </Modal>
  );
}

export function OrderDiscountModal({
  current,
  subtotal,
  symbol,
  onApply,
  onClose,
}: {
  current: Discount | null;
  subtotal: Cents;
  symbol: string;
  onApply: (discount: Discount | null) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<DiscountDraft>(toDiscountDraft(current));
  const parsed = readDiscount(draft, subtotal);

  return (
    <Modal
      title="Discount whole sale"
      onClose={onClose}
      footer={
        <>
          {current && (
            <button type="button" className="btn btn-danger-ghost" onClick={() => onApply(null)}>
              Remove discount
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onApply(parsed.discount)} disabled={Boolean(parsed.error)}>
            Apply
          </button>
        </>
      }
    >
      <DiscountEditor draft={draft} onChange={setDraft} symbol={symbol} error={parsed.error} />
    </Modal>
  );
}

export function CustomItemModal({
  symbol,
  onAdd,
  onClose,
}: {
  symbol: string;
  onAdd: (name: string, price: Cents) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const cents = parseMoney(price);

  function add() {
    if (cents === null) return;
    onAdd(name.trim() || 'Custom item', cents);
  }

  return (
    <Modal
      title="Custom item"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={add} disabled={cents === null}>
            Add to sale
          </button>
        </>
      }
    >
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Field label="Description">
          {(id) => <input id={id} value={name} placeholder="Custom item" maxLength={40} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="Price">{(id) => <MoneyInput id={id} value={price} onChange={setPrice} symbol={symbol} autoFocus />}</Field>
        <Keypad onKey={(key) => setPrice((v) => applyKey(v, key, { decimals: 2 }))} />
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

export function HoldModal({ suggested, onHold, onClose }: { suggested: string; onHold: (label: string) => void; onClose: () => void }) {
  const [label, setLabel] = useState('');
  return (
    <Modal
      title="Hold sale"
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onHold(label.trim() || suggested)}>
            Hold
          </button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onHold(label.trim() || suggested);
        }}
      >
        <Field label="Label" hint="A table number or customer name helps you find it later.">
          {(id) => <input id={id} value={label} placeholder={suggested} maxLength={30} data-autofocus onChange={(e) => setLabel(e.target.value)} />}
        </Field>
      </form>
    </Modal>
  );
}

const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: 'short' });

export function RecallModal({
  held,
  settings,
  cartHasItems,
  onRecall,
  onDelete,
  onClose,
}: {
  held: HeldSale[];
  settings: Settings;
  cartHasItems: boolean;
  onRecall: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const money = (c: Cents) => formatMoney(c, settings.currencySymbol);
  return (
    <Modal title="Held sales" onClose={onClose}>
      {cartHasItems && <p className="notice">Finish or hold the current sale before recalling another one.</p>}
      {held.length === 0 ? (
        <p className="empty">No sales on hold.</p>
      ) : (
        <ul className="held-list">
          {held.map((h) => {
            const totals = computeTotals(h.cart, taxConfig(settings));
            return (
              <li key={h.id}>
                <div>
                  <strong>{h.label}</strong>
                  <span className="muted">
                    {timeFormat.format(new Date(h.heldAt))} · {h.staffName} · {sum(h.cart.lines.map((l) => l.qty))} items
                  </span>
                </div>
                <span className="num strong">{money(totals.total)}</span>
                <button type="button" className="btn btn-sm btn-danger-ghost" onClick={() => onDelete(h.id)}>
                  Delete
                </button>
                <button type="button" className="btn btn-sm btn-primary" onClick={() => onRecall(h.id)} disabled={cartHasItems}>
                  Recall
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

export function ReceiptModal({ transaction, settings, onClose }: { transaction: Transaction; settings: Settings; onClose: () => void }) {
  const money = (c: Cents) => formatMoney(c, settings.currencySymbol);
  return (
    <Modal
      title="Sale complete"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={() => window.print()}>
            Print receipt
          </button>
          <button type="button" className="btn btn-accent" onClick={onClose} data-autofocus>
            New sale
          </button>
        </>
      }
    >
      {transaction.change > 0 && (
        <div className="change-banner" role="status">
          <span>Change due</span>
          <strong>{money(transaction.change)}</strong>
        </div>
      )}
      <Receipt transaction={transaction} settings={settings} />
    </Modal>
  );
}
