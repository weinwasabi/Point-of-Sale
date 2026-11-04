import { useEffect, useRef, useState } from 'react';
import { Keypad } from '../components/Keypad';
import { MoneyInput } from '../components/fields';
import { Modal } from '../components/Modal';
import { newId } from '../lib/id';
import { applyKey } from '../lib/keypad';
import { formatMoney, parseMoney, sum } from '../lib/money';
import { cashSuggestions } from '../lib/totals';
import type { Cents, Payment, PaymentMethod } from '../types';

interface PaymentModalProps {
  total: Cents;
  symbol: string;
  onCancel: () => void;
  onComplete: (payments: Payment[], change: Cents) => void;
}

const CARD_DELAY_MS = 1400;

export function PaymentModal({ total, symbol, onCancel, onComplete }: PaymentModalProps) {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [entry, setEntry] = useState('');
  const [cardBusy, setCardBusy] = useState(false);
  const [error, setError] = useState('');
  const cardTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (cardTimer.current) window.clearTimeout(cardTimer.current);
    },
    [],
  );

  const money = (c: Cents) => formatMoney(c, symbol);
  const paid = sum(payments.map((p) => p.amount));
  const remaining = total - paid;
  const entered = parseMoney(entry);

  function record(next: Payment[], change: Cents) {
    setPayments(next);
    setEntry('');
    setError('');
    if (sum(next.map((p) => p.amount)) >= total) onComplete(next, change);
  }

  function takeCash(amount: Cents | null) {
    if (amount === null || amount <= 0) {
      setError('Enter the cash received, or tap a quick amount.');
      return;
    }
    const applied = Math.min(amount, remaining);
    record([...payments, { id: newId(), method: 'cash', amount: applied, tendered: amount }], Math.max(0, amount - remaining));
  }

  function chargeCard() {
    const amount = entered ?? remaining;
    if (amount <= 0) {
      setError('Enter an amount to charge.');
      return;
    }
    if (amount > remaining) {
      setError(`A card can't be charged more than the ${money(remaining)} balance.`);
      return;
    }
    setError('');
    setCardBusy(true);
    cardTimer.current = window.setTimeout(() => {
      cardTimer.current = null;
      setCardBusy(false);
      record([...payments, { id: newId(), method: 'card', amount, tendered: amount }], 0);
    }, CARD_DELAY_MS);
  }

  function removePayment(id: string) {
    setPayments((current) => current.filter((p) => p.id !== id));
  }

  const nothingDue = total === 0;

  return (
    <Modal
      title="Take payment"
      size="lg"
      onClose={onCancel}
      dismissible={!cardBusy && payments.length === 0}
      footer={
        <button type="button" className="btn" onClick={onCancel} disabled={cardBusy || payments.length > 0}>
          {payments.length > 0 ? 'Remove payments to cancel' : 'Back to sale'}
        </button>
      }
    >
      <div className="pay-layout">
        <section className="pay-summary" aria-label="Balance">
          <div className="pay-figure">
            <span>Total</span>
            <strong>{money(total)}</strong>
          </div>
          <div className="pay-figure pay-figure-due">
            <span>Balance due</span>
            <strong>{money(remaining)}</strong>
          </div>
          {payments.length > 0 && (
            <ul className="pay-list" aria-label="Payments taken">
              {payments.map((p) => (
                <li key={p.id}>
                  <span>{p.method === 'cash' ? 'Cash' : 'Card'}</span>
                  <span className="num">{money(p.amount)}</span>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => removePayment(p.id)} disabled={cardBusy}>
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="pay-entry" aria-label="Payment entry">
          {nothingDue ? (
            <div className="pay-zero">
              <p>Nothing to pay on this sale.</p>
              <button type="button" className="btn btn-accent btn-lg" onClick={() => onComplete([], 0)} data-autofocus>
                Complete sale
              </button>
            </div>
          ) : (
            <>
              <div className="segmented" role="radiogroup" aria-label="Payment method">
                {(['cash', 'card'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={method === m}
                    className="segmented-option"
                    disabled={cardBusy}
                    onClick={() => {
                      setMethod(m);
                      setEntry('');
                      setError('');
                    }}
                  >
                    {m === 'cash' ? 'Cash' : 'Card'}
                  </button>
                ))}
              </div>

              <div className="field">
                <label htmlFor="pay-amount">{method === 'cash' ? 'Cash received' : `Amount to charge (blank = ${money(remaining)})`}</label>
                <MoneyInput id="pay-amount" value={entry} onChange={setEntry} symbol={symbol} autoFocus />
                {error && (
                  <span className="field-error" role="alert">
                    {error}
                  </span>
                )}
              </div>

              {method === 'cash' && (
                <div className="quick-row">
                  <button type="button" className="btn" onClick={() => takeCash(remaining)}>
                    Exact {money(remaining)}
                  </button>
                  {cashSuggestions(remaining).map((amount) => (
                    <button key={amount} type="button" className="btn" onClick={() => takeCash(amount)}>
                      {money(amount)}
                    </button>
                  ))}
                </div>
              )}

              <Keypad disabled={cardBusy} onKey={(key) => setEntry((v) => applyKey(v, key, { decimals: 2 }))} />

              {method === 'cash' ? (
                <button type="button" className="btn btn-accent btn-lg" onClick={() => takeCash(entered)}>
                  Take cash{entered ? ` ${money(entered)}` : ''}
                </button>
              ) : (
                <button type="button" className="btn btn-accent btn-lg" onClick={chargeCard} disabled={cardBusy}>
                  {cardBusy ? 'Waiting for card…' : `Charge card ${money(entered ?? remaining)}`}
                </button>
              )}
              {method === 'card' && (
                <p className="field-hint">Card payments are simulated. No card reader is connected.</p>
              )}
            </>
          )}
        </section>
      </div>
    </Modal>
  );
}
