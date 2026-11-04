import { useMemo, useState } from 'react';
import { formatMoney } from '../lib/money';
import { RANGE_LABEL, rangeBounds, summarize, type RangeKey } from '../lib/reports';
import { useStore } from '../state/store';
import type { Cents } from '../types';

const RANGES: RangeKey[] = ['today', 'yesterday', 'week', 'month', 'all'];
const printedAt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function ReportsScreen() {
  const { state } = useStore();
  const [range, setRange] = useState<RangeKey>('today');
  const money = (c: Cents) => formatMoney(c, state.settings.currencySymbol);

  const report = useMemo(() => {
    const { from, to } = rangeBounds(range, new Date());
    return summarize(state.transactions, state.categories, from, to);
  }, [range, state.transactions, state.categories]);

  const cash = report.byMethod.find((m) => m.method === 'cash');

  return (
    <div className="page">
      <div className="page-header">
        <h1>Reports</h1>
        <div className="segmented segmented-sm" role="radiogroup" aria-label="Date range">
          {RANGES.map((r) => (
            <button key={r} type="button" role="radio" aria-checked={range === r} className="segmented-option" onClick={() => setRange(r)}>
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>
        <button type="button" className="btn" onClick={() => window.print()}>
          Print report
        </button>
      </div>

      <div className="print-area report">
        <p className="print-only">
          <strong>{state.settings.storeName}</strong> · Sales report · {RANGE_LABEL[range]} · printed {printedAt.format(new Date())}
        </p>

        <div className="stat-grid">
          <Stat
            label="Net sales"
            value={money(report.netSales)}
            note={`${plural(report.salesCount, 'sale')}, ${plural(report.refundsCount, 'refund')}`}
            hero
          />
          <Stat label="Average sale" value={money(report.averageSale)} />
          <Stat label="Items sold" value={String(report.itemsSold)} note="Net of returns" />
          <Stat label="Refunds" value={money(report.refundsTotal)} />
          <Stat label="Discounts given" value={money(report.discounts)} />
          <Stat label={`${state.settings.taxName} collected`} value={money(report.netTax)} />
        </div>

        {report.salesCount === 0 && report.refundsCount === 0 ? (
          <p className="empty">No sales in this period yet.</p>
        ) : (
          <div className="report-grid">
            <section className="card">
              <h2>Payments</h2>
              <table className="data">
                <thead>
                  <tr>
                    <th scope="col">Method</th>
                    <th scope="col" className="num">
                      Taken
                    </th>
                    <th scope="col" className="num">
                      Refunded
                    </th>
                    <th scope="col" className="num">
                      Net
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.byMethod.map((m) => (
                    <tr key={m.method}>
                      <th scope="row">{m.method === 'cash' ? 'Cash' : 'Card'}</th>
                      <td className="num">{money(m.sales)}</td>
                      <td className="num">{money(-m.refunds)}</td>
                      <td className="num strong">{money(m.sales - m.refunds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {cash && (
                <p className="card-note">
                  Expected cash in drawer from sales: <strong className="num">{money(cash.sales - cash.refunds)}</strong> (plus your opening float).
                </p>
              )}
            </section>

            <section className="card">
              <h2>By category</h2>
              <table className="data">
                <thead>
                  <tr>
                    <th scope="col">Category</th>
                    <th scope="col" className="num">
                      Qty
                    </th>
                    <th scope="col" className="num">
                      Sales
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.byCategory.map((c) => (
                    <tr key={c.id}>
                      <th scope="row">{c.name}</th>
                      <td className="num">{c.qty}</td>
                      <td className="num">{money(c.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="card">
              <h2>Top products</h2>
              <table className="data">
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col" className="num">
                      Qty
                    </th>
                    <th scope="col" className="num">
                      Sales
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.topProducts.map((p) => (
                    <tr key={p.key}>
                      <th scope="row">{p.name}</th>
                      <td className="num">{p.qty}</td>
                      <td className="num">{money(p.amount)}</td>
                    </tr>
                  ))}
                  {report.topProducts.length === 0 && (
                    <tr>
                      <td colSpan={3} className="muted">
                        Everything sold in this period was refunded.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function Stat({ label, value, note, hero }: { label: string; value: string; note?: string; hero?: boolean }) {
  return (
    <div className={`stat${hero ? ' stat-hero' : ''}`}>
      <span className="stat-label">{label}</span>
      <strong className="stat-value num">{value}</strong>
      {note && <span className="stat-note">{note}</span>}
    </div>
  );
}
