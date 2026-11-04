import type { Cents } from '../types';

export function formatMoney(cents: Cents, symbol: string): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Math.round(cents));
  const whole = Math.floor(abs / 100).toLocaleString('en-US');
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}${symbol}${whole}.${frac}`;
}

/** Parse a typed amount like "12.5" into cents (1250). Returns null when empty or invalid. */
export function parseMoney(input: string): Cents | null {
  const text = input.trim().replace(/,/g, '');
  if (!/^(\d+(\.\d{0,2})?|\.\d{1,2})$/.test(text)) return null;
  const [whole, frac = ''] = text.split('.');
  return Number(whole || '0') * 100 + Number(frac.padEnd(2, '0'));
}

export function centsToInput(cents: Cents): string {
  return (cents / 100).toFixed(2);
}

/** Accepts partial money input while typing: digits with up to two decimals. */
export function isMoneyDraft(text: string): boolean {
  return /^\d{0,7}(\.\d{0,2})?$/.test(text);
}

export function sum(values: number[]): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}
