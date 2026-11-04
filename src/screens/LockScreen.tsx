import { useEffect, useState } from 'react';
import { Keypad } from '../components/Keypad';
import { applyKey, type PadKey } from '../lib/keypad';
import { useStore } from '../state/store';
import type { Staff } from '../types';

const PIN_LENGTH = 4;

export function LockScreen({ onUnlock }: { onUnlock: (staff: Staff) => void }) {
  const { state } = useStore();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  function press(key: PadKey) {
    setError(false);
    setPin((current) => applyKey(current, key, { decimals: 0, maxLength: PIN_LENGTH }));
  }

  useEffect(() => {
    if (pin.length < PIN_LENGTH) return;
    const match = state.staff.find((s) => s.pin === pin);
    if (match) {
      onUnlock(match);
    } else {
      setError(true);
      setPin('');
    }
  }, [pin, state.staff, onUnlock]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (/^\d$/.test(event.key)) press(event.key as PadKey);
      else if (event.key === 'Backspace') press('back');
      else if (event.key === 'Escape') press('clear');
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="lock">
      <div className="lock-card">
        <div className="brand-mark" aria-hidden="true">
          T
        </div>
        <h1>{state.settings.storeName}</h1>
        <p className="muted">Enter your 4-digit PIN to start</p>

        <div className={`pin-dots${error ? ' pin-dots-error' : ''}`} aria-hidden="true">
          {Array.from({ length: PIN_LENGTH }, (_, i) => (
            <span key={i} className={i < pin.length ? 'filled' : ''} />
          ))}
        </div>
        <p className="pin-status" role="status" aria-live="assertive">
          {error ? 'That PIN didn’t match. Try again.' : `${pin.length} of ${PIN_LENGTH} digits`}
        </p>

        <Keypad decimal={false} onKey={press} />

        <p className="lock-hint">Demo PINs: 1234 (Manager) · 0000 (Cashier)</p>
      </div>
    </div>
  );
}
