import { useId, type ReactNode } from 'react';
import { isMoneyDraft } from '../lib/money';
import type { Discount } from '../types';

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </div>
  );
}

/** Text input that only accepts money-shaped text (digits, up to two decimals). */
export function MoneyInput({
  id,
  value,
  onChange,
  symbol,
  autoFocus,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  symbol: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="money-input">
      <span aria-hidden="true">{symbol}</span>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        placeholder="0.00"
        data-autofocus={autoFocus || undefined}
        onChange={(event) => {
          const next = event.target.value.replace(/,/g, '');
          if (isMoneyDraft(next)) onChange(next);
        }}
      />
    </div>
  );
}

export interface DiscountDraft {
  kind: Discount['kind'];
  text: string;
}

export function toDiscountDraft(discount: Discount | null): DiscountDraft {
  if (!discount) return { kind: 'percent', text: '' };
  return discount.kind === 'percent'
    ? { kind: 'percent', text: String(discount.value) }
    : { kind: 'amount', text: (discount.value / 100).toFixed(2) };
}

const QUICK_PERCENTS = [5, 10, 15, 20, 25, 50];

/** Percent / fixed-amount discount picker with quick percentage buttons. */
export function DiscountEditor({
  draft,
  onChange,
  symbol,
  error,
}: {
  draft: DiscountDraft;
  onChange: (draft: DiscountDraft) => void;
  symbol: string;
  error?: string;
}) {
  const id = useId();
  return (
    <div className="discount-editor">
      <div className="segmented" role="radiogroup" aria-label="Discount type">
        {(['percent', 'amount'] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            role="radio"
            aria-checked={draft.kind === kind}
            className="segmented-option"
            onClick={() => onChange({ kind, text: '' })}
          >
            {kind === 'percent' ? 'Percent (%)' : `Amount (${symbol})`}
          </button>
        ))}
      </div>
      <div className="field">
        <label htmlFor={id}>{draft.kind === 'percent' ? 'Discount percent' : 'Discount amount'}</label>
        {draft.kind === 'percent' ? (
          <div className="money-input">
            <input
              id={id}
              inputMode="decimal"
              autoComplete="off"
              value={draft.text}
              placeholder="0"
              onChange={(event) => {
                if (/^\d{0,3}(\.\d{0,2})?$/.test(event.target.value)) onChange({ ...draft, text: event.target.value });
              }}
            />
            <span aria-hidden="true">%</span>
          </div>
        ) : (
          <MoneyInput id={id} value={draft.text} symbol={symbol} onChange={(text) => onChange({ ...draft, text })} />
        )}
        {error && <span className="field-error">{error}</span>}
      </div>
      {draft.kind === 'percent' && (
        <div className="quick-row">
          {QUICK_PERCENTS.map((pct) => (
            <button
              key={pct}
              type="button"
              className="btn btn-sm"
              aria-pressed={draft.text === String(pct)}
              onClick={() => onChange({ kind: 'percent', text: String(pct) })}
            >
              {pct}%
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Validate a discount draft against the amount it applies to. */
export function readDiscount(draft: DiscountDraft, base: number): { discount: Discount | null; error?: string } {
  const text = draft.text.trim();
  if (text === '' || Number(text) === 0) return { discount: null };
  if (draft.kind === 'percent') {
    const value = Number(text);
    if (!Number.isFinite(value) || value < 0 || value > 100) return { discount: null, error: 'Enter a percent from 0 to 100' };
    return { discount: { kind: 'percent', value } };
  }
  const [whole, frac = ''] = text.split('.');
  const cents = Number(whole || '0') * 100 + Number(frac.padEnd(2, '0'));
  if (cents > base) return { discount: null, error: 'Discount is more than the price' };
  return { discount: { kind: 'amount', value: cents } };
}
