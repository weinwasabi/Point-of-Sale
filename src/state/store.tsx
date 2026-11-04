import { createContext, useContext, useEffect, useReducer, type Dispatch, type ReactNode } from 'react';
import { createSeedData } from '../data/seed';
import { formatMoney } from '../lib/money';
import type { AppData } from '../types';
import { reducer, type Action } from './reducer';

const STORAGE_KEY = 'till-pos:data:v1';

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppData;
      if (parsed?.version === 1 && Array.isArray(parsed.products) && Array.isArray(parsed.transactions)) {
        return parsed;
      }
    }
  } catch {
    // Storage blocked or data unreadable: start from demo data.
  }
  return createSeedData();
}

function save(data: AppData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage full or blocked; the session keeps working in memory.
  }
}

interface StoreValue {
  state: AppData;
  dispatch: Dispatch<Action>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);

  useEffect(() => {
    save(state);
  }, [state]);

  return <StoreContext.Provider value={{ state, dispatch }}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore must be used inside <StoreProvider>');
  return value;
}

/** Shorthand for formatting money with the store's currency symbol. */
export function useMoney(): (cents: number) => string {
  const { state } = useStore();
  const symbol = state.settings.currencySymbol;
  return (cents) => formatMoney(cents, symbol);
}
