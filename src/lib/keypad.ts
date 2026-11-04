export type PadKey =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | '00' | '.' | 'back' | 'clear';

/** Apply one on-screen keypad press to a typed value. */
export function applyKey(
  value: string,
  key: PadKey,
  opts: { decimals: number; maxLength?: number },
): string {
  const maxLength = opts.maxLength ?? 10;
  if (key === 'clear') return '';
  if (key === 'back') return value.slice(0, -1);
  if (key === '.') {
    if (opts.decimals === 0 || value.includes('.')) return value;
    return value === '' ? '0.' : `${value}.`;
  }

  let next = value + key;
  if (next.includes('.')) {
    const [whole, frac] = next.split('.');
    if (frac.length > opts.decimals) return value;
    next = `${whole.replace(/^0+(?=\d)/, '')}.${frac}`;
  } else if (opts.decimals > 0) {
    next = next.replace(/^0+(?=\d)/, '');
  }
  return next.length > maxLength ? value : next;
}
