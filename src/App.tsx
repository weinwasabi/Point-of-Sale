import { useCallback, useState } from 'react';
import { ToastProvider } from './components/Toast';
import { TopBar, type NavItem } from './components/TopBar';
import { LockScreen } from './screens/LockScreen';
import { ProductsScreen } from './screens/ProductsScreen';
import { ReportsScreen } from './screens/ReportsScreen';
import { SaleScreen } from './screens/SaleScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TransactionsScreen } from './screens/TransactionsScreen';
import { StoreProvider, useStore } from './state/store';
import type { Staff } from './types';

type View = 'sale' | 'transactions' | 'reports' | 'products' | 'settings';

const NAV: (NavItem<View> & { managerOnly: boolean })[] = [
  { id: 'sale', label: 'Sale', managerOnly: false },
  { id: 'transactions', label: 'Transactions', managerOnly: false },
  { id: 'reports', label: 'Reports', managerOnly: true },
  { id: 'products', label: 'Products', managerOnly: true },
  { id: 'settings', label: 'Settings', managerOnly: true },
];

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </StoreProvider>
  );
}

function Shell() {
  const { state } = useStore();
  const [staffId, setStaffId] = useState<string | null>(null);
  const [view, setView] = useState<View>('sale');

  const unlock = useCallback((member: Staff) => {
    setStaffId(member.id);
    setView('sale');
  }, []);

  const staff = state.staff.find((s) => s.id === staffId) ?? null;
  if (!staff) return <LockScreen onUnlock={unlock} />;

  const items = NAV.filter((item) => !item.managerOnly || staff.role === 'manager');
  const current = items.some((item) => item.id === view) ? view : 'sale';

  return (
    <div className="app">
      <TopBar
        storeName={state.settings.storeName}
        staff={staff}
        items={items}
        current={current}
        onNavigate={setView}
        onLock={() => setStaffId(null)}
      />
      <main className="app-main">
        {current === 'sale' && <SaleScreen staff={staff} />}
        {current === 'transactions' && <TransactionsScreen staff={staff} />}
        {current === 'reports' && <ReportsScreen />}
        {current === 'products' && <ProductsScreen />}
        {current === 'settings' && <SettingsScreen staff={staff} />}
      </main>
    </div>
  );
}
