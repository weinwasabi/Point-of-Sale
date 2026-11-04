import { formatMoney } from '../lib/money';
import { receiptNumber } from '../lib/sales';
import type { Settings, Transaction } from '../types';

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

interface ReceiptProps {
  transaction: Transaction;
  settings: Settings;
  /** Receipt number of the sale a refund reverses. */
  originalNumber?: number;
}

/** A till-roll style receipt. Carries `print-area` so window.print() prints only this. */
export function Receipt({ transaction: t, settings, originalNumber }: ReceiptProps) {
  const money = (c: number) => formatMoney(c, settings.currencySymbol);
  const isRefund = t.kind === 'refund';
  const sign = isRefund ? -1 : 1;

  return (
    <article className="receipt print-area" aria-label={`Receipt ${receiptNumber(t.number)}`}>
      <header className="receipt-head">
        <strong className="receipt-store">{settings.storeName}</strong>
        {settings.address && <span>{settings.address}</span>}
        {settings.phone && <span>{settings.phone}</span>}
      </header>

      <div className="receipt-rule" />
      <div className="receipt-row">
        <span>{isRefund ? 'REFUND' : 'Receipt'} {receiptNumber(t.number)}</span>
      </div>
      {isRefund && originalNumber !== undefined && (
        <div className="receipt-row receipt-muted">
          <span>For sale {receiptNumber(originalNumber)}</span>
        </div>
      )}
      <div className="receipt-row receipt-muted">
        <span>{dateFormat.format(new Date(t.createdAt))}</span>
        <span>{t.staffName}</span>
      </div>
      <div className="receipt-rule" />

      {t.lines.map((line) => (
        <div key={line.id} className="receipt-line">
          <div className="receipt-row">
            <span>{line.name}</span>
            {isRefund && <span>{money(-line.share)}</span>}
          </div>
          {isRefund ? (
            <div className="receipt-row receipt-muted">
              <span>Qty {line.qty}</span>
            </div>
          ) : (
            <>
              <div className="receipt-row receipt-muted">
                <span>
                  {line.qty} × {money(line.unitPrice)}
                </span>
                <span>{money(line.unitPrice * line.qty)}</span>
              </div>
              {line.lineDiscount > 0 && (
                <div className="receipt-row receipt-muted">
                  <span>
                    Discount{line.discount?.kind === 'percent' ? ` ${line.discount.value}%` : ''}
                  </span>
                  <span>{money(-line.lineDiscount)}</span>
                </div>
              )}
              {line.refundedQty > 0 && (
                <div className="receipt-row receipt-muted">
                  <span>Refunded qty {line.refundedQty}</span>
                </div>
              )}
            </>
          )}
          {line.note && <div className="receipt-note">Note: {line.note}</div>}
        </div>
      ))}

      <div className="receipt-rule" />
      {!isRefund && (
        <div className="receipt-row">
          <span>Subtotal</span>
          <span>{money(t.subtotal)}</span>
        </div>
      )}
      {t.orderDiscount > 0 && (
        <div className="receipt-row">
          <span>
            Discount{t.orderDiscountRule?.kind === 'percent' ? ` ${t.orderDiscountRule.value}%` : ''}
          </span>
          <span>{money(-t.orderDiscount)}</span>
        </div>
      )}
      {!t.taxInclusive && t.taxRate > 0 && (
        <div className="receipt-row">
          <span>
            {t.taxName} {t.taxRate}%
          </span>
          <span>{money(sign * t.tax)}</span>
        </div>
      )}
      <div className="receipt-row receipt-total">
        <span>{isRefund ? 'Refund total' : 'Total'}</span>
        <span>{money(sign * t.total)}</span>
      </div>
      {t.taxInclusive && t.taxRate > 0 && (
        <div className="receipt-row receipt-muted">
          <span>
            Includes {t.taxName} {t.taxRate}%
          </span>
          <span>{money(sign * t.tax)}</span>
        </div>
      )}

      <div className="receipt-rule" />
      {t.payments.map((p) => (
        <div key={p.id} className="receipt-row">
          <span>
            {p.method === 'cash' ? 'Cash' : 'Card'}
            {p.tendered > p.amount ? ` (tendered ${money(p.tendered)})` : ''}
          </span>
          <span>{money(sign * p.amount)}</span>
        </div>
      ))}
      {t.change > 0 && (
        <div className="receipt-row receipt-total">
          <span>Change</span>
          <span>{money(t.change)}</span>
        </div>
      )}
      {t.reason && <div className="receipt-note">Reason: {t.reason}</div>}

      {settings.receiptFooter && (
        <>
          <div className="receipt-rule" />
          <p className="receipt-footer">{settings.receiptFooter}</p>
        </>
      )}
    </article>
  );
}
