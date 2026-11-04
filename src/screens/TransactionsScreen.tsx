import { useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { Receipt } from '../components/Receipt';
import { useToast } from '../components/Toast';
import { formatMoney, sum } from '../lib/money';
import { canRecordRefund } from '../lib/recording';
import { buildRefund, canRefund, primaryMethod, receiptNumber, STATUS_LABEL, transactionStatus, type RefundSelection } from '../lib/sales';
import { refundableQty, refundAmountForLine } from '../lib/totals';
import { useStore } from '../state/store';
import type { Cents, PaymentMethod, Staff, Transaction } from '../types';

type Filter = 'all' | 'sale' | 'refund';

const listTime = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function TransactionsScreen({ staff }: { staff: Staff }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const { settings } = state;
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [refunding, setRefunding] = useState(false);
  const money = (c: Cents) => formatMoney(c, settings.currencySymbol);

  const byId = useMemo(() => new Map(state.transactions.map((t) => [t.id, t])), [state.transactions]);

  const list = useMemo(() => {
    const q = query.trim().replace(/^#/, '').replace(/^0+/, '');
    return [...state.transactions]
      .reverse()
      .filter((t) => filter === 'all' || t.kind === filter)
      .filter((t) => !q || String(t.number).includes(q) || t.staffName.toLowerCase().includes(q.toLowerCase()));
  }, [state.transactions, query, filter]);

  const selected = (selectedId && byId.get(selectedId)) || list[0] || null;
  const isManager = staff.role === 'manager';

  function confirmRefund(original: Transaction, selections: RefundSelection[], method: PaymentMethod, reason: string, restock: boolean) {
    const refund = buildRefund({ original, selections, method, reason, restock, staff, number: state.nextNumber, now: new Date() });
    if (!canRecordRefund(state, refund)) {
      toast('Refund could not be recorded. Check the sale and try again.', 'error');
      return;
    }
    dispatch({ type: 'refund/record', refund });
    setRefunding(false);
    setSelectedId(refund.id);
    toast(`Refunded ${money(refund.total)} by ${method}.`);
  }

  return (
    <div className="split">
      <section className="split-list" aria-label="Transactions">
        <div className="split-toolbar">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Receipt # or staff name"
            aria-label="Search transactions"
          />
          <div className="segmented segmented-sm" role="radiogroup" aria-label="Show">
            {(['all', 'sale', 'refund'] as const).map((f) => (
              <button key={f} type="button" role="radio" aria-checked={filter === f} className="segmented-option" onClick={() => setFilter(f)}>
                {f === 'all' ? 'All' : f === 'sale' ? 'Sales' : 'Refunds'}
              </button>
            ))}
          </div>
        </div>

        {list.length === 0 ? (
          <p className="empty">{state.transactions.length === 0 ? 'No transactions yet. Completed sales appear here.' : 'Nothing matches.'}</p>
        ) : (
          <ul className="tx-list">
            {list.map((t) => {
              const status = transactionStatus(t);
              return (
                <li key={t.id}>
                  <button type="button" className="tx-row" aria-current={selected?.id === t.id ? 'true' : undefined} onClick={() => setSelectedId(t.id)}>
                    <span className="tx-number num">{receiptNumber(t.number)}</span>
                    <span className="tx-time muted">
                      {listTime.format(new Date(t.createdAt))} · {t.staffName}
                    </span>
                    <span className={`badge badge-${status}`}>{STATUS_LABEL[status]}</span>
                    <span className="tx-total num">{money(t.kind === 'refund' ? -t.total : t.total)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="split-detail" aria-label="Transaction detail">
        {selected ? (
          <>
            <div className="detail-actions">
              <button type="button" className="btn" onClick={() => window.print()}>
                Print receipt
              </button>
              {selected.kind === 'sale' && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={!isManager || !canRefund(selected)}
                  onClick={() => setRefunding(true)}
                  title={!isManager ? 'Only a manager can issue refunds' : undefined}
                >
                  Refund
                </button>
              )}
              {selected.kind === 'sale' && !isManager && <span className="muted">Refunds need a manager.</span>}
              {selected.kind === 'refund' && selected.refundOf && byId.get(selected.refundOf) && (
                <button type="button" className="btn btn-ghost" onClick={() => setSelectedId(selected.refundOf)}>
                  View original sale
                </button>
              )}
            </div>
            <Receipt
              transaction={selected}
              settings={settings}
              originalNumber={selected.refundOf ? byId.get(selected.refundOf)?.number : undefined}
            />
            {selected.refundIds.length > 0 && (
              <div className="detail-links">
                <span className="muted">Refunds:</span>
                {selected.refundIds.map((id) => {
                  const r = byId.get(id);
                  return r ? (
                    <button key={id} type="button" className="btn btn-sm btn-ghost" onClick={() => setSelectedId(id)}>
                      {receiptNumber(r.number)} ({money(-r.total)})
                    </button>
                  ) : null;
                })}
              </div>
            )}
          </>
        ) : (
          <p className="empty">Select a transaction to see its receipt.</p>
        )}
      </section>

      {refunding && selected && selected.kind === 'sale' && (
        <RefundModal
          sale={selected}
          symbol={settings.currencySymbol}
          onClose={() => setRefunding(false)}
          onConfirm={(selections, method, reason, restock) => confirmRefund(selected, selections, method, reason, restock)}
        />
      )}
    </div>
  );
}

function RefundModal({
  sale,
  symbol,
  onClose,
  onConfirm,
}: {
  sale: Transaction;
  symbol: string;
  onClose: () => void;
  onConfirm: (selections: RefundSelection[], method: PaymentMethod, reason: string, restock: boolean) => void;
}) {
  const lines = sale.lines.filter((l) => refundableQty(l) > 0);
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<PaymentMethod>(primaryMethod(sale));
  const [reason, setReason] = useState('');
  const [restock, setRestock] = useState(true);
  const money = (c: Cents) => formatMoney(c, symbol);

  const selections = lines.map((l) => ({ lineId: l.id, qty: qtys[l.id] ?? 0 })).filter((s) => s.qty > 0);
  const amount = sum(lines.map((l) => refundAmountForLine(l, qtys[l.id] ?? 0)));
  const setQty = (id: string, qty: number, max: number) => setQtys((q) => ({ ...q, [id]: Math.min(Math.max(qty, 0), max) }));

  return (
    <Modal
      title={`Refund ${receiptNumber(sale.number)}`}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={selections.length === 0}
            onClick={() => onConfirm(selections, method, reason.trim(), restock)}
          >
            Refund {money(amount)}
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="row-between">
          <span className="muted">Choose how many of each item are coming back.</span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => setQtys(Object.fromEntries(lines.map((l) => [l.id, refundableQty(l)])))}
          >
            Select everything
          </button>
        </div>
        <table className="data">
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col" className="num">
                Can refund
              </th>
              <th scope="col">Qty to refund</th>
              <th scope="col" className="num">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const max = refundableQty(l);
              const qty = qtys[l.id] ?? 0;
              return (
                <tr key={l.id}>
                  <td>{l.name}</td>
                  <td className="num">{max}</td>
                  <td>
                    <div className="stepper stepper-sm" role="group" aria-label={`Quantity of ${l.name} to refund`}>
                      <button type="button" className="btn btn-sm" onClick={() => setQty(l.id, qty - 1, max)} aria-label="Fewer" disabled={qty === 0}>
                        −
                      </button>
                      <output className="stepper-value num">{qty}</output>
                      <button type="button" className="btn btn-sm" onClick={() => setQty(l.id, qty + 1, max)} aria-label="More" disabled={qty === max}>
                        +
                      </button>
                    </div>
                  </td>
                  <td className="num">{money(refundAmountForLine(l, qty))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="form-grid">
          <div className="field">
            <span className="field-label" id="refund-method">
              Pay back by
            </span>
            <div className="segmented" role="radiogroup" aria-labelledby="refund-method">
              {(['cash', 'card'] as const).map((m) => (
                <button key={m} type="button" role="radio" aria-checked={method === m} className="segmented-option" onClick={() => setMethod(m)}>
                  {m === 'cash' ? 'Cash' : 'Card'}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label htmlFor="refund-reason">Reason (optional)</label>
            <input id="refund-reason" value={reason} maxLength={80} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Wrong order" />
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} />
          Put returned items back into stock
        </label>
      </div>
    </Modal>
  );
}
