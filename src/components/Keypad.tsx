import type { PadKey } from '../lib/keypad';

interface KeypadProps {
  onKey: (key: PadKey) => void;
  /** Show the "." and "00" keys. */
  decimal?: boolean;
  disabled?: boolean;
}

const DIGITS: PadKey[] = ['7', '8', '9', '4', '5', '6', '1', '2', '3'];

export function Keypad({ onKey, decimal = true, disabled = false }: KeypadProps) {
  const bottom: PadKey[] = decimal ? ['.', '0', '00'] : ['clear', '0', 'back'];
  return (
    <div className="keypad" role="group" aria-label="Number pad">
      {[...DIGITS, ...bottom].map((key) => (
        <button
          key={key}
          type="button"
          className={`keypad-key${key === 'clear' || key === 'back' ? ' keypad-key-muted' : ''}`}
          onClick={() => onKey(key)}
          disabled={disabled}
          aria-label={key === 'back' ? 'Delete last digit' : key === 'clear' ? 'Clear' : undefined}
        >
          {key === 'back' ? '⌫' : key === 'clear' ? 'C' : key}
        </button>
      ))}
      {decimal && (
        <>
          <button type="button" className="keypad-key keypad-key-muted" onClick={() => onKey('clear')} disabled={disabled}>
            Clear
          </button>
          <button
            type="button"
            className="keypad-key keypad-key-muted keypad-span-2"
            onClick={() => onKey('back')}
            disabled={disabled}
            aria-label="Delete last digit"
          >
            ⌫
          </button>
        </>
      )}
    </div>
  );
}
