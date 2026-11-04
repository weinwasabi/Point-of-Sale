import { useEffect, useState } from 'react';
import type { Staff } from '../types';

export interface NavItem<T extends string> {
  id: T;
  label: string;
}

const clockFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(timer);
  }, []);
  return <time dateTime={now.toISOString()}>{clockFormat.format(now)}</time>;
}

export function TopBar<T extends string>({
  storeName,
  staff,
  items,
  current,
  onNavigate,
  onLock,
}: {
  storeName: string;
  staff: Staff;
  items: NavItem<T>[];
  current: T;
  onNavigate: (id: T) => void;
  onLock: () => void;
}) {
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <span className="brand-mark brand-mark-sm" aria-hidden="true">
          T
        </span>
        <span className="topbar-store">{storeName}</span>
      </div>
      <nav className="topbar-nav" aria-label="Main">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="nav-item"
            aria-current={item.id === current ? 'page' : undefined}
            onClick={() => onNavigate(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      <div className="topbar-meta">
        <Clock />
        <span className="topbar-staff">
          {staff.name}
          <span className="topbar-role">{staff.role === 'manager' ? 'Manager' : 'Cashier'}</span>
        </span>
        <button type="button" className="btn btn-sm btn-on-dark" onClick={onLock}>
          Lock
        </button>
      </div>
    </header>
  );
}
