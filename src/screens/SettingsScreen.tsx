import { useState } from 'react';
import { Field } from '../components/fields';
import { ConfirmModal, Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { newId } from '../lib/id';
import { useStore } from '../state/store';
import type { Role, Settings, Staff } from '../types';

export function SettingsScreen({ staff: me }: { staff: Staff }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [draft, setDraft] = useState<Settings>(state.settings);
  const [taxText, setTaxText] = useState(String(state.settings.taxRate));
  const [editingStaff, setEditingStaff] = useState<Staff | 'new' | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const taxRate = Number(taxText);
  const taxError = taxText.trim() === '' || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100 ? 'Enter a rate from 0 to 100' : undefined;
  const dirty = JSON.stringify({ ...draft, taxRate: taxError ? taxText : taxRate }) !== JSON.stringify(state.settings);
  const managers = state.staff.filter((s) => s.role === 'manager').length;

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setDraft((d) => ({ ...d, [key]: value }));

  function saveSettings() {
    if (taxError || !draft.storeName.trim()) return;
    dispatch({ type: 'settings/update', settings: { ...draft, storeName: draft.storeName.trim(), taxRate } });
    toast('Settings saved.');
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pos-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Settings</h1>
        <span className="spacer" />
        {dirty && <span className="muted">Unsaved changes</span>}
        <button type="button" className="btn btn-primary" onClick={saveSettings} disabled={!dirty || Boolean(taxError) || !draft.storeName.trim()}>
          Save settings
        </button>
      </div>

      <div className="settings-grid">
        <section className="card">
          <h2>Store &amp; receipt</h2>
          <div className="stack">
            <Field label="Store name" error={!draft.storeName.trim() ? 'Enter a store name' : undefined}>
              {(id) => <input id={id} value={draft.storeName} maxLength={40} onChange={(e) => set('storeName', e.target.value)} />}
            </Field>
            <Field label="Address">{(id) => <input id={id} value={draft.address} maxLength={80} onChange={(e) => set('address', e.target.value)} />}</Field>
            <Field label="Phone">{(id) => <input id={id} value={draft.phone} maxLength={30} onChange={(e) => set('phone', e.target.value)} />}</Field>
            <Field label="Receipt footer">
              {(id) => <input id={id} value={draft.receiptFooter} maxLength={80} onChange={(e) => set('receiptFooter', e.target.value)} />}
            </Field>
          </div>
        </section>

        <section className="card">
          <h2>Currency &amp; tax</h2>
          <div className="form-grid">
            <Field label="Currency symbol">
              {(id) => <input id={id} value={draft.currencySymbol} maxLength={4} onChange={(e) => set('currencySymbol', e.target.value)} />}
            </Field>
            <Field label="Tax name">{(id) => <input id={id} value={draft.taxName} maxLength={12} onChange={(e) => set('taxName', e.target.value)} />}</Field>
            <Field label="Tax rate (%)" error={taxError}>
              {(id) => (
                <input
                  id={id}
                  value={taxText}
                  inputMode="decimal"
                  onChange={(e) => {
                    if (/^\d{0,3}(\.\d{0,2})?$/.test(e.target.value)) setTaxText(e.target.value);
                  }}
                />
              )}
            </Field>
            <label className="check span-2">
              <input type="checkbox" checked={draft.taxInclusive} onChange={(e) => set('taxInclusive', e.target.checked)} />
              Prices already include tax
            </label>
          </div>
          <p className="card-note">Changes apply to new sales. Past receipts keep the tax they were sold with.</p>
        </section>

        <section className="card">
          <div className="row-between">
            <h2>Staff</h2>
            <button type="button" className="btn btn-sm btn-primary" onClick={() => setEditingStaff('new')}>
              Add staff
            </button>
          </div>
          <table className="data">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Role</th>
                <th scope="col">PIN</th>
                <th scope="col">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {state.staff.map((s) => (
                <tr key={s.id}>
                  <th scope="row">
                    {s.name}
                    {s.id === me.id && <span className="muted"> (you)</span>}
                  </th>
                  <td>{s.role === 'manager' ? 'Manager' : 'Cashier'}</td>
                  <td className="muted">••••</td>
                  <td className="num">
                    <button type="button" className="btn btn-sm" onClick={() => setEditingStaff(s)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="card-note">Managers can see reports, edit products and settings, and issue refunds. Cashiers can sell and view transactions.</p>
        </section>

        <section className="card">
          <h2>Data</h2>
          <p className="card-note">
            Everything is saved in this browser only. Export a backup regularly; clearing browser data erases sales history.
          </p>
          <div className="quick-row">
            <button type="button" className="btn" onClick={exportData}>
              Export backup (JSON)
            </button>
            <button type="button" className="btn btn-danger-ghost" onClick={() => setConfirmReset(true)}>
              Reset to demo data
            </button>
          </div>
        </section>
      </div>

      {editingStaff && (
        <StaffModal
          member={editingStaff === 'new' ? null : editingStaff}
          allStaff={state.staff}
          canDelete={editingStaff !== 'new' && editingStaff.id !== me.id && !(editingStaff.role === 'manager' && managers <= 1)}
          isLastManager={editingStaff !== 'new' && editingStaff.role === 'manager' && managers <= 1}
          onClose={() => setEditingStaff(null)}
          onSave={(member) => {
            dispatch({ type: 'staff/save', staff: member });
            setEditingStaff(null);
          }}
          onDelete={(id) => {
            dispatch({ type: 'staff/delete', id });
            setEditingStaff(null);
          }}
        />
      )}
      {confirmReset && (
        <ConfirmModal
          title="Reset all data?"
          message="This deletes every sale, refund, product change and staff change, and restores the demo store. Export a backup first if you need it."
          confirmLabel="Reset everything"
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => {
            setConfirmReset(false);
            dispatch({ type: 'data/reset' });
          }}
        />
      )}
    </div>
  );
}

function StaffModal({
  member,
  allStaff,
  canDelete,
  isLastManager,
  onSave,
  onDelete,
  onClose,
}: {
  member: Staff | null;
  allStaff: Staff[];
  canDelete: boolean;
  isLastManager: boolean;
  onSave: (staff: Staff) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(member?.name ?? '');
  const [role, setRole] = useState<Role>(member?.role ?? 'cashier');
  const [pin, setPin] = useState(member?.pin ?? '');
  const [submitted, setSubmitted] = useState(false);

  const errors = {
    name: !name.trim() ? 'Enter a name' : undefined,
    pin: !/^\d{4}$/.test(pin)
      ? 'PIN must be exactly 4 digits'
      : allStaff.some((s) => s.id !== member?.id && s.pin === pin)
        ? 'Another staff member already uses this PIN'
        : undefined,
  };
  const valid = !errors.name && !errors.pin;

  function save() {
    setSubmitted(true);
    if (!valid) return;
    onSave({ id: member?.id ?? newId(), name: name.trim(), role: isLastManager ? 'manager' : role, pin });
  }

  return (
    <Modal
      title={member ? 'Edit staff' : 'New staff member'}
      size="sm"
      onClose={onClose}
      footer={
        <>
          {member && (
            <button type="button" className="btn btn-danger-ghost" onClick={() => onDelete(member.id)} disabled={!canDelete}>
              Delete
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={save}>
            Save
          </button>
        </>
      }
    >
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Field label="Name" error={submitted ? errors.name : undefined}>
          {(id) => <input id={id} value={name} maxLength={30} onChange={(e) => setName(e.target.value)} data-autofocus />}
        </Field>
        <Field label="Role" hint={isLastManager ? 'The last manager must stay a manager.' : undefined}>
          {(id) => (
            <select id={id} value={role} disabled={isLastManager} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="cashier">Cashier</option>
              <option value="manager">Manager</option>
            </select>
          )}
        </Field>
        <Field label="PIN" error={submitted ? errors.pin : undefined} hint="4 digits, used to unlock the till.">
          {(id) => (
            <input
              id={id}
              value={pin}
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
          )}
        </Field>
        {member && !canDelete && (
          <p className="field-hint">{isLastManager ? 'The only manager can’t be deleted.' : 'You can’t delete yourself while signed in.'}</p>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
