import { useMemo, useState, type CSSProperties } from 'react';
import { Field, MoneyInput } from '../components/fields';
import { ConfirmModal, Modal } from '../components/Modal';
import { CATEGORY_COLORS } from '../data/seed';
import { newId } from '../lib/id';
import { centsToInput, formatMoney, parseMoney } from '../lib/money';
import { useStore } from '../state/store';
import type { Category, Product } from '../types';

type Tab = 'products' | 'categories';

export function ProductsScreen() {
  const { state, dispatch } = useStore();
  const { products, categories, settings } = state;
  const [tab, setTab] = useState<Tab>('products');
  const [query, setQuery] = useState('');
  const [editingProduct, setEditingProduct] = useState<Product | 'new' | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | 'new' | null>(null);
  const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(
      (p) => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.includes(q),
    );
  }, [products, query]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Products</h1>
        <div className="segmented segmented-sm" role="tablist" aria-label="Manage">
          {(['products', 'categories'] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className="segmented-option" onClick={() => setTab(t)}>
              {t === 'products' ? `Products (${products.length})` : `Categories (${categories.length})`}
            </button>
          ))}
        </div>
        <span className="spacer" />
        {tab === 'products' ? (
          <button type="button" className="btn btn-primary" onClick={() => setEditingProduct('new')} disabled={categories.length === 0}>
            Add product
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => setEditingCategory('new')}>
            Add category
          </button>
        )}
      </div>

      {tab === 'products' ? (
        <section className="card">
          <input
            type="search"
            className="table-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, SKU or barcode"
            aria-label="Search products"
          />
          <div className="table-wrap">
            <table className="data data-clickable">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Category</th>
                  <th scope="col">SKU</th>
                  <th scope="col">Barcode</th>
                  <th scope="col" className="num">
                    Price
                  </th>
                  <th scope="col" className="num">
                    Stock
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => {
                  const category = categoryById.get(p.categoryId);
                  return (
                    <tr key={p.id}>
                      <th scope="row">
                        <button type="button" className="link-button" onClick={() => setEditingProduct(p)}>
                          {p.name}
                        </button>
                      </th>
                      <td>
                        <span className="swatch-label">
                          <span className="swatch" style={{ '--swatch': category?.color } as CSSProperties} aria-hidden="true" />
                          {category?.name ?? '—'}
                        </span>
                      </td>
                      <td className="muted">{p.sku || '—'}</td>
                      <td className="muted num">{p.barcode || '—'}</td>
                      <td className="num">{formatMoney(p.price, settings.currencySymbol)}</td>
                      <td className="num">
                        {!p.trackStock ? (
                          <span className="muted">Not tracked</span>
                        ) : p.stock <= 0 ? (
                          <span className="badge badge-refunded">{p.stock} · Out</span>
                        ) : p.stock <= 5 ? (
                          <span className="badge badge-partial">{p.stock} · Low</span>
                        ) : (
                          p.stock
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {visible.length === 0 && <p className="empty">No products match.</p>}
          </div>
        </section>
      ) : (
        <section className="card">
          <ul className="category-list">
            {categories.map((c) => {
              const count = products.filter((p) => p.categoryId === c.id).length;
              return (
                <li key={c.id}>
                  <span className="swatch swatch-lg" style={{ '--swatch': c.color } as CSSProperties} aria-hidden="true" />
                  <strong>{c.name}</strong>
                  <span className="muted">
                    {count} product{count === 1 ? '' : 's'}
                  </span>
                  <span className="spacer" />
                  <button type="button" className="btn btn-sm" onClick={() => setEditingCategory(c)}>
                    Edit
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {editingProduct && (
        <ProductModal
          product={editingProduct === 'new' ? null : editingProduct}
          products={products}
          categories={categories}
          symbol={settings.currencySymbol}
          onClose={() => setEditingProduct(null)}
          onSave={(product) => {
            dispatch({ type: 'product/save', product });
            setEditingProduct(null);
          }}
          onDelete={(id) => {
            dispatch({ type: 'product/delete', id });
            setEditingProduct(null);
          }}
        />
      )}
      {editingCategory && (
        <CategoryModal
          category={editingCategory === 'new' ? null : editingCategory}
          productCount={editingCategory === 'new' ? 0 : products.filter((p) => p.categoryId === editingCategory.id).length}
          onClose={() => setEditingCategory(null)}
          onSave={(category) => {
            dispatch({ type: 'category/save', category });
            setEditingCategory(null);
          }}
          onDelete={(id) => {
            dispatch({ type: 'category/delete', id });
            setEditingCategory(null);
          }}
        />
      )}
    </div>
  );
}

function ProductModal({
  product,
  products,
  categories,
  symbol,
  onSave,
  onDelete,
  onClose,
}: {
  product: Product | null;
  products: Product[];
  categories: Category[];
  symbol: string;
  onSave: (product: Product) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(product?.name ?? '');
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? categories[0]?.id ?? '');
  const [price, setPrice] = useState(product ? centsToInput(product.price) : '');
  const [sku, setSku] = useState(product?.sku ?? '');
  const [barcode, setBarcode] = useState(product?.barcode ?? '');
  const [trackStock, setTrackStock] = useState(product?.trackStock ?? false);
  const [stock, setStock] = useState(String(product?.stock ?? 0));
  const [submitted, setSubmitted] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const others = products.filter((p) => p.id !== product?.id);
  const cents = parseMoney(price);
  const errors = {
    name: !name.trim() ? 'Enter a product name' : undefined,
    price: cents === null ? 'Enter a price, e.g. 120.00' : undefined,
    barcode: barcode && others.some((p) => p.barcode === barcode.trim()) ? 'Another product already uses this barcode' : undefined,
    sku: sku && others.some((p) => p.sku.toLowerCase() === sku.trim().toLowerCase()) ? 'Another product already uses this SKU' : undefined,
    stock: trackStock && !/^-?\d+$/.test(stock.trim()) ? 'Enter a whole number' : undefined,
  };
  const valid = !Object.values(errors).some(Boolean);
  const show = (key: keyof typeof errors) => (submitted ? errors[key] : undefined);

  function save() {
    setSubmitted(true);
    if (!valid || cents === null) return;
    onSave({
      id: product?.id ?? newId(),
      name: name.trim(),
      categoryId,
      price: cents,
      sku: sku.trim(),
      barcode: barcode.trim(),
      trackStock,
      stock: trackStock ? Number(stock.trim()) : (product?.stock ?? 0),
    });
  }

  if (confirmDelete && product) {
    return (
      <ConfirmModal
        title={`Delete ${product.name}?`}
        message="It will disappear from the till. Past receipts keep their copy of the item."
        confirmLabel="Delete product"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => onDelete(product.id)}
      />
    );
  }

  return (
    <Modal
      title={product ? 'Edit product' : 'New product'}
      onClose={onClose}
      footer={
        <>
          {product && (
            <button type="button" className="btn btn-danger-ghost" onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={save}>
            Save product
          </button>
        </>
      }
    >
      <form
        className="form-grid"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div className="span-2">
          <Field label="Name" error={show('name')}>
            {(id) => <input id={id} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} data-autofocus />}
          </Field>
        </div>
        <Field label="Category">
          {(id) => (
            <select id={id} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Price" error={show('price')}>
          {(id) => <MoneyInput id={id} value={price} onChange={setPrice} symbol={symbol} />}
        </Field>
        <Field label="SKU" error={show('sku')}>
          {(id) => <input id={id} value={sku} maxLength={24} onChange={(e) => setSku(e.target.value)} />}
        </Field>
        <Field label="Barcode" error={show('barcode')} hint="Scan into this field or type it.">
          {(id) => <input id={id} value={barcode} inputMode="numeric" maxLength={32} onChange={(e) => setBarcode(e.target.value)} />}
        </Field>
        <label className="check span-2">
          <input type="checkbox" checked={trackStock} onChange={(e) => setTrackStock(e.target.checked)} />
          Track stock for this product
        </label>
        {trackStock && (
          <Field label="Stock on hand" error={show('stock')}>
            {(id) => <input id={id} value={stock} inputMode="numeric" onChange={(e) => setStock(e.target.value)} />}
          </Field>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

function CategoryModal({
  category,
  productCount,
  onSave,
  onDelete,
  onClose,
}: {
  category: Category | null;
  productCount: number;
  onSave: (category: Category) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(category?.name ?? '');
  const [color, setColor] = useState(category?.color ?? CATEGORY_COLORS[0]);
  const colors = CATEGORY_COLORS.includes(color) ? CATEGORY_COLORS : [color, ...CATEGORY_COLORS];

  function save() {
    if (!name.trim()) return;
    onSave({ id: category?.id ?? newId(), name: name.trim(), color });
  }

  return (
    <Modal
      title={category ? 'Edit category' : 'New category'}
      onClose={onClose}
      footer={
        <>
          {category && (
            <button
              type="button"
              className="btn btn-danger-ghost"
              onClick={() => onDelete(category.id)}
              disabled={productCount > 0}
              title={productCount > 0 ? 'Move or delete its products first' : undefined}
            >
              Delete
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={!name.trim()}>
            Save category
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
        <Field label="Name">{(id) => <input id={id} value={name} maxLength={24} onChange={(e) => setName(e.target.value)} data-autofocus />}</Field>
        <fieldset className="fieldset">
          <legend>Tile colour</legend>
          <div className="swatch-picker" role="radiogroup" aria-label="Tile colour">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={c}
                className="swatch-option"
                style={{ '--swatch': c } as CSSProperties}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </fieldset>
        <div className="tile tile-preview" style={{ '--tile': color } as CSSProperties} aria-hidden="true">
          <span className="tile-name">{name || 'Preview'}</span>
          <span className="tile-meta">
            <span className="tile-price">Tile preview</span>
          </span>
        </div>
        {category && productCount > 0 && <p className="field-hint">This category has {productCount} products, so it can't be deleted yet.</p>}
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}
